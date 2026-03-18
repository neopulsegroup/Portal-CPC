import { Link, NavLink, Routes, Route, useLocation } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { addDocument, countDocuments, getDocument, queryDocuments, serverTimestamp, updateDocument } from '@/integrations/firebase/firestore';
import { registerUser } from '@/integrations/firebase/auth';
import {
  Users,
  Calendar,
  BookOpen,
  Briefcase,
  TrendingUp,
  Clock,
  CalendarX,
  FileText,
  Filter,
  CheckCircle,
  Ban,
  MapPin,
  Mail,
  MoreVertical,
  UserCog,
  Plus,
  Pencil,
  UserPlus,
  CalendarPlus,
  UserX,
  RotateCcw,
  Wrench,
  Languages,
} from 'lucide-react';

type FirebaseUserDoc = {
  id: string;
  role?: string | null;
  createdAt?: unknown;
};

type CpcTeamRole = 'admin' | 'manager' | 'coordinator' | 'mediator' | 'lawyer' | 'psychologist' | 'trainer';
type CpcTeamUserDoc = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  active?: boolean | null;
};

const CPC_TEAM_ROLES: CpcTeamRole[] = ['admin', 'manager', 'coordinator', 'mediator', 'lawyer', 'psychologist', 'trainer'];

function normalizeText(value?: string | null): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function deriveNameFromEmail(email?: string | null): string {
  if (!email) return '';
  const local = email.split('@')[0] ?? '';
  const parts = local.split(/[._-]+/g).filter(Boolean);
  if (parts.length === 0) return '';
  return parts
    .map((p) => p.slice(0, 1).toUpperCase() + p.slice(1))
    .join(' ');
}

function parseUnknownDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'object') {
    if ('toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
      const date = (value as { toDate: () => Date }).toDate();
      return Number.isNaN(date.getTime()) ? null : date;
    }
    if ('seconds' in value && typeof (value as { seconds?: unknown }).seconds === 'number') {
      const parsed = new Date(((value as { seconds: number }).seconds) * 1000);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }
  return null;
}

function countDatesBetween(dates: Date[], startISO: string, endISO: string): number {
  return dates.filter((d) => {
    const iso = d.toISOString().slice(0, 10);
    return iso >= startISO && iso <= endISO;
  }).length;
}

function isCancelledSessionStatus(status?: string | null): boolean {
  return ['cancelled', 'cancelada'].includes(normalizeText(status));
}

function isCompletedSessionStatus(status?: string | null): boolean {
  return ['completed', 'concluida'].includes(normalizeText(status));
}

function isInProgressSessionStatus(status?: string | null): boolean {
  return ['in_progress', 'em curso'].includes(normalizeText(status));
}

export default function CPCDashboard() {
  const { profile, profileData, user } = useAuth();
  const { t, language } = useLanguage();
  const location = useLocation();

  const cpcDisplayName = useMemo(() => {
    const profileDocName = typeof profileData?.name === 'string' ? profileData.name.trim() : '';
    const userDocName = typeof profile?.name === 'string' ? profile.name.trim() : '';
    const authName = typeof user?.displayName === 'string' ? user.displayName.trim() : '';
    const rawName = profileDocName || userDocName || authName;
    const rawEmail = typeof profile?.email === 'string' ? profile.email.trim() : '';
    const authEmail = typeof user?.email === 'string' ? user.email.trim() : '';
    const email = rawEmail || authEmail;
    const derivedFromEmail = deriveNameFromEmail(email);
    const normalizedName = normalizeText(rawName);
    const normalizedRole = normalizeText(profile?.role ?? null);
    const isGeneric =
      normalizedName.length === 0 ||
      normalizedName === 'cpc' ||
      normalizedName === normalizedRole ||
      ['admin', 'administrador', 'equipa', 'staff', 'team'].includes(normalizedName);
    return isGeneric ? (derivedFromEmail || t.get('cpc.menu.user_fallback')) : rawName;
  }, [profile?.email, profile?.name, profile?.role, profileData?.name, t, user?.displayName, user?.email]);

  const [loading, setLoading] = useState(true);
  const [period] = useState<'today' | 'week' | 'month'>('week');
  const [migrantsTotal, setMigrantsTotal] = useState(0);
  const [migrantsNew7, setMigrantsNew7] = useState(0);
  const [migrantsNew30, setMigrantsNew30] = useState(0);
  const [migrantsPeriodNew, setMigrantsPeriodNew] = useState(0);
  const [migrantsPrevNew, setMigrantsPrevNew] = useState(0);
  const [sessionsTodayCount, setSessionsTodayCount] = useState(0);
  const [sessionsWeekCount, setSessionsWeekCount] = useState(0);
  const [sessionsCompletedCount, setSessionsCompletedCount] = useState(0);
  const [sessionsPeriodCount, setSessionsPeriodCount] = useState(0);
  const [sessionsPrevCount, setSessionsPrevCount] = useState(0);
  const [companiesTotal, setCompaniesTotal] = useState(0);
  const [jobOffersActive, setJobOffersActive] = useState(0);
  const [jobOffersPendingApproval, setJobOffersPendingApproval] = useState(0);
  const [applicationsTotal, setApplicationsTotal] = useState(0);
  const [applicationsPeriodCount, setApplicationsPeriodCount] = useState(0);
  const [applicationsPrevCount, setApplicationsPrevCount] = useState(0);
  const [avgProgress, setAvgProgress] = useState(0);
  const [urgencies, setUrgencies] = useState<{ juridico: number; psicologico: number; habitacional: number }>(() => ({ juridico: 0, psicologico: 0, habitacional: 0 }));
  const [recentMigrants, setRecentMigrants] = useState<
    Array<{ id: string; name: string; subtitle: string; statusLabel: string; statusClassName: string; dateLabel: string }>
  >([]);
  const [todaySessions, setTodaySessions] = useState<
    Array<{ id: string; migrant: string; type: string; time: string; status: string; statusRaw?: string | null }>
  >([]);
  const [messagesPending, setMessagesPending] = useState(0);

  const locale = useMemo(() => {
    if (language === 'en') return 'en-GB';
    if (language === 'es') return 'es-ES';
    return 'pt-PT';
  }, [language]);

  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const shortDateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' }),
    [locale]
  );
  const longDateFormatter = useMemo(() => new Intl.DateTimeFormat(locale), [locale]);

  function formatSessionStatusLabel(status?: string | null): string {
    if (isCompletedSessionStatus(status)) return t.get('cpc.sessions.status.completed');
    if (isCancelledSessionStatus(status)) return t.get('cpc.sessions.status.cancelled');
    if (isInProgressSessionStatus(status)) return t.get('cpc.sessions.status.in_progress');
    return t.get('cpc.sessions.status.scheduled');
  }

  function formatKpiChange(current: number, prev: number): { label: string; className: string } {
    if (!Number.isFinite(current) || !Number.isFinite(prev)) return { label: t.get('cpc.kpi.change.stable'), className: 'text-muted-foreground' };
    if (prev <= 0) return current > 0 ? { label: t.get('cpc.kpi.change.new'), className: 'text-emerald-700' } : { label: t.get('cpc.kpi.change.stable'), className: 'text-muted-foreground' };
    const delta = current - prev;
    if (delta === 0) return { label: t.get('cpc.kpi.change.stable'), className: 'text-muted-foreground' };
    const percent = Math.round((Math.abs(delta) / prev) * 100);
    return delta > 0 ? { label: `+${percent}%`, className: 'text-emerald-700' } : { label: `-${percent}%`, className: 'text-rose-700' };
  }

  function formatRelativeTime(from: Date, to: Date): string {
    const diffMs = Math.max(0, to.getTime() - from.getTime());
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return t.get('cpc.relative.minutes', { count: Math.max(1, mins) });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t.get('cpc.relative.hours', { count: hours });
    const days = Math.floor(hours / 24);
    return t.get('cpc.relative.days', { count: days });
  }

  function EquipaPage() {
    const [loadingList, setLoadingList] = useState(true);
    const [saving, setSaving] = useState(false);
    const [rows, setRows] = useState<Array<{ id: string; name: string; email: string; role: CpcTeamRole; active: boolean }>>([]);
    const [query, setQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<'all' | CpcTeamRole>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [sortBy, setSortBy] = useState<'name' | 'role' | 'status'>('name');
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<CpcTeamRole>('mediator');
    const [editOpen, setEditOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<{ id: string; name: string; role: CpcTeamRole } | null>(null);
    const [editName, setEditName] = useState('');
    const [editRole, setEditRole] = useState<CpcTeamRole>('mediator');
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
    const [formError, setFormError] = useState('');
    const isAdmin = profile?.role === 'admin';
    const hasLoggedUnauthorizedAccess = useRef(false);

    async function logUnauthorizedAttempt(context: string, targetId?: string) {
      const actorId = user?.uid;
      if (!actorId) return;
      try {
        await addDocument('audit_logs', {
          action: 'unauthorized_attempt',
          actor_id: actorId,
          target_id: targetId ?? null,
          context,
          createdAt: serverTimestamp(),
        });
      } catch {
        return;
      }
    }

    function getRoleLabel(roleValue: CpcTeamRole): string {
      return t.get(`cpc.team.roles.${roleValue}` as never);
    }

    async function loadTeam() {
      setLoadingList(true);
      setFormError('');
      try {
        const users = await queryDocuments<CpcTeamUserDoc>('users', []);
        const filtered = users
          .filter((u): u is CpcTeamUserDoc & { role: CpcTeamRole } => CPC_TEAM_ROLES.includes(normalizeText(u.role) as CpcTeamRole))
          .map((u) => ({
            id: u.id,
            name: u.name || u.email || t.get('cpc.team.user_fallback'),
            email: u.email || '—',
            role: normalizeText(u.role) as CpcTeamRole,
            active: u.active !== false,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setRows(filtered);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : t.get('cpc.team.errors.load_failed');
        setFormError(message);
        setRows([]);
      } finally {
        setLoadingList(false);
      }
    }

    useEffect(() => {
      loadTeam();
    }, []);

    useEffect(() => {
      if (isAdmin) return;
      if (!user?.uid) return;
      if (hasLoggedUnauthorizedAccess.current) return;
      hasLoggedUnauthorizedAccess.current = true;
      logUnauthorizedAttempt('cpc.team.page_access');
    }, [isAdmin, user?.uid]);

    async function handleCreateUser() {
      if (!isAdmin) {
        await logUnauthorizedAttempt('cpc.team.create');
        setFormError(t.get('cpc.team.errors.no_permission'));
        return;
      }
      if (!name.trim() || !email.trim() || !password.trim()) {
        setFormError(t.get('cpc.team.errors.required_fields'));
        return;
      }
      setSaving(true);
      setFormError('');
      try {
        await registerUser(email.trim(), password, name.trim(), role);
        setOpen(false);
        setName('');
        setEmail('');
        setPassword('');
        setRole('mediator');
        await loadTeam();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : t.get('cpc.team.errors.create_failed');
        setFormError(message);
      } finally {
        setSaving(false);
      }
    }

    function openEdit(user: { id: string; name: string; role: CpcTeamRole }) {
      if (!isAdmin) {
        logUnauthorizedAttempt('cpc.team.edit.open', user.id);
        setFormError(t.get('cpc.team.errors.no_permission'));
        return;
      }
      setEditTarget(user);
      setEditName(user.name);
      setEditRole(user.role);
      setEditOpen(true);
    }

    async function handleSaveEdit() {
      if (!editTarget) return;
      if (!isAdmin) {
        await logUnauthorizedAttempt('cpc.team.edit.save', editTarget.id);
        setFormError(t.get('cpc.team.errors.no_permission'));
        return;
      }
      if (!editName.trim()) {
        setFormError(t.get('cpc.team.errors.name_required'));
        return;
      }
      setSaving(true);
      setFormError('');
      try {
        await updateDocument('users', editTarget.id, {
          name: editName.trim(),
          role: editRole,
        });
        await updateDocument('profiles', editTarget.id, { name: editName.trim() });
        setEditOpen(false);
        setEditTarget(null);
        await loadTeam();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : t.get('cpc.team.errors.update_failed');
        setFormError(message);
      } finally {
        setSaving(false);
      }
    }

    async function toggleActive(teamUser: { id: string; active: boolean }) {
      if (!isAdmin) {
        await logUnauthorizedAttempt('cpc.team.toggle_active', teamUser.id);
        setFormError(t.get('cpc.team.errors.no_permission'));
        return;
      }
      setActionLoadingId(teamUser.id);
      setFormError('');
      try {
        await updateDocument('users', teamUser.id, {
          active: !teamUser.active,
          disabledAt: teamUser.active ? new Date().toISOString() : null,
        });
        const actorId = user?.uid;
        if (actorId) {
          await addDocument('audit_logs', {
            action: teamUser.active ? 'user.deactivated' : 'user.reactivated',
            actor_id: actorId,
            target_id: teamUser.id,
            createdAt: serverTimestamp(),
          });
        }
        await loadTeam();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : t.get('cpc.team.errors.update_state_failed');
        setFormError(message);
      } finally {
        setActionLoadingId(null);
      }
    }

    const filtered = useMemo(() => {
      const q = query.trim().toLowerCase();
      const list = rows.filter((r) => {
        const matchQuery = q.length === 0 || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q);
        const matchRole = roleFilter === 'all' || r.role === roleFilter;
        const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? r.active : !r.active);
        return matchQuery && matchRole && matchStatus;
      });

      const sorted = [...list];
      sorted.sort((a, b) => {
        if (sortBy === 'role') return getRoleLabel(a.role).localeCompare(getRoleLabel(b.role));
        if (sortBy === 'status') return Number(b.active) - Number(a.active) || a.name.localeCompare(b.name);
        return a.name.localeCompare(b.name);
      });
      return sorted;
    }, [query, roleFilter, rows, sortBy, statusFilter, language]);

    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                <UserCog className="h-7 w-7 text-primary" /> {t.get('cpc.team.title')}
            </h1>
              <p className="text-muted-foreground mt-1">{t.get('cpc.team.subtitle')}</p>
              {!isAdmin ? (
                <p className="text-sm mt-2 text-amber-700">{t.get('cpc.team.errors.no_permission')}</p>
              ) : null}
          </div>
          {isAdmin ? (
            <Button onClick={() => setOpen(true)} className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {t.get('cpc.team.actions.add')}
            </Button>
          ) : null}
        </div>

        <div className="cpc-card p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
                <Label>{t.get('cpc.team.search.label')}</Label>
              <div className="flex items-center gap-2 mt-1">
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.get('cpc.team.search.placeholder')} />
                <Button variant="outline" className="gap-2">
                    <Filter className="h-4 w-4" /> {t.get('cpc.team.actions.filter')}
                </Button>
              </div>
            </div>
            <div>
                <Label>{t.get('cpc.team.role.label')}</Label>
              <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">{t.get('cpc.team.role.all')}</SelectItem>
                  {CPC_TEAM_ROLES.map((item) => (
                    <SelectItem key={item} value={item}>
                        {getRoleLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
                <Label>{t.get('cpc.team.status.label')}</Label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">{t.get('cpc.team.status.all')}</SelectItem>
                    <SelectItem value="active">{t.get('cpc.team.status.active')}</SelectItem>
                    <SelectItem value="inactive">{t.get('cpc.team.status.inactive')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
                <Label>{t.get('cpc.team.sort.label')}</Label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="name">{t.get('cpc.team.sort.name')}</SelectItem>
                    <SelectItem value="role">{t.get('cpc.team.sort.role')}</SelectItem>
                    <SelectItem value="status">{t.get('cpc.team.sort.status')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
                <Label>{t.get('cpc.team.summary.label')}</Label>
              <div className="mt-1 h-10 rounded-md border bg-muted/40 flex items-center px-3 text-sm text-muted-foreground">
                  {t.get('cpc.team.summary.users', { count: filtered.length })}
              </div>
            </div>
          </div>

          {formError ? <p className="text-sm text-red-600 mt-4">{formError}</p> : null}
        </div>

        {loadingList ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="cpc-card p-12 text-center">
            <UserCog className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">{t.get('cpc.team.empty.title')}</h3>
            <p className="text-muted-foreground">{t.get('cpc.team.empty.subtitle')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((r) => (
              <div key={r.id} className="cpc-card p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold truncate">{r.name}</h3>
                      {!r.active ? (
                        <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">{t.get('cpc.team.status.inactive_label')}</span>
                      ) : null}
                      <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                        {getRoleLabel(r.role)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{r.email}</p>

                    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 mt-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <UserCog className="h-4 w-4" /> {getRoleLabel(r.role)}
                      </span>
                      <span className="flex items-center gap-1">
                        {r.active ? <CheckCircle className="h-4 w-4" /> : <Ban className="h-4 w-4" />}{' '}
                        {r.active ? t.get('cpc.team.status.active_label') : t.get('cpc.team.status.inactive_label')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Mail className="h-4 w-4" /> {r.email || '—'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-stretch gap-2 w-full lg:w-56">
                    {isAdmin ? (
                      <>
                        <Button
                          variant="outline"
                          className="inline-flex items-center justify-center gap-2 w-full"
                          onClick={() => openEdit(r)}
                        >
                          <Pencil className="h-4 w-4" /> {t.get('cpc.team.actions.edit')}
                        </Button>
                        <Button
                          variant="outline"
                          className="inline-flex items-center justify-center gap-2 w-full"
                          onClick={() => toggleActive(r)}
                          disabled={actionLoadingId === r.id}
                        >
                          {r.active ? <UserX className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                          {r.active ? t.get('cpc.team.actions.deactivate') : t.get('cpc.team.actions.reactivate')}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog
          open={open}
          onOpenChange={(next) => {
            if (next && !isAdmin) {
              logUnauthorizedAttempt('cpc.team.create.open');
              setFormError(t.get('cpc.team.errors.no_permission'));
              return;
            }
            setOpen(next);
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t.get('cpc.team.dialogs.add_title')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t.get('cpc.team.fields.name')}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.get('cpc.team.fields.name_placeholder')} />
              </div>
              <div className="space-y-2">
                <Label>{t.get('cpc.team.fields.email')}</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder={t.get('cpc.team.fields.email_placeholder')} />
              </div>
              <div className="space-y-2">
                <Label>{t.get('cpc.team.fields.password')}</Label>
                <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder={t.get('cpc.team.fields.password_placeholder')} />
              </div>
              <div className="space-y-2">
                <Label>{t.get('cpc.team.fields.profile')}</Label>
                <Select value={role} onValueChange={(v) => setRole(v as CpcTeamRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CPC_TEAM_ROLES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {getRoleLabel(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
              <Button className="w-full" onClick={handleCreateUser} disabled={saving}>
                {saving ? t.get('cpc.team.actions.saving') : t.get('cpc.team.actions.create_user')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={editOpen}
          onOpenChange={(next) => {
            if (next && !isAdmin) {
              logUnauthorizedAttempt('cpc.team.edit.open');
              setFormError(t.get('cpc.team.errors.no_permission'));
              return;
            }
            setEditOpen(next);
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t.get('cpc.team.dialogs.edit_title')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t.get('cpc.team.fields.name')}</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder={t.get('cpc.team.fields.name_placeholder')} />
              </div>
              <div className="space-y-2">
                <Label>{t.get('cpc.team.fields.profile')}</Label>
                <Select value={editRole} onValueChange={(v) => setEditRole(v as CpcTeamRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CPC_TEAM_ROLES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {getRoleLabel(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
              <Button className="w-full" onClick={handleSaveEdit} disabled={saving}>
                {saving ? t.get('cpc.team.actions.saving') : t.get('cpc.team.actions.save_changes')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  function CandidaturasDetalhadas() {
    const [loadingList, setLoadingList] = useState(true);
    const [rows, setRows] = useState<Array<{ id: string; applicant: string; email: string; job: string; status: string; created_at: string }>>([]);
    useEffect(() => {
      async function fetchAll() {
        setLoadingList(true);
        try {
          const apps = await queryDocuments<{ id: string; applicant_id: string; job_id: string; status: string; created_at: string }>(
            'job_applications',
            [],
            { field: 'created_at', direction: 'desc' },
            200
          );
          const applicantIds = Array.from(new Set(apps.map(a => a.applicant_id).filter(Boolean)));
          const jobIds = Array.from(new Set(apps.map(a => a.job_id).filter(Boolean)));

          const profileDocs = await Promise.all(applicantIds.map(id => getDocument<{ name?: string | null; email?: string | null }>('profiles', id)));
          const pmap = new Map<string, { name: string; email: string }>();
          applicantIds.forEach((id, idx) => {
            const p = profileDocs[idx];
            if (p) pmap.set(id, { name: p.name || id, email: p.email || '' });
          });

          const jobDocs = await Promise.all(jobIds.map(id => getDocument<{ title?: string | null }>('job_offers', id)));
          const jmap = new Map<string, { title: string }>();
          jobIds.forEach((id, idx) => {
            const j = jobDocs[idx];
            if (j) jmap.set(id, { title: j.title || id });
          });

          const out = apps.map(a => ({
            id: a.id,
            applicant: pmap.get(a.applicant_id)?.name || a.applicant_id,
            email: pmap.get(a.applicant_id)?.email || '',
            job: jmap.get(a.job_id)?.title || a.job_id,
            status: a.status,
            created_at: a.created_at,
          }));
          setRows(out);
        } finally {
          setLoadingList(false);
        }
      }
      fetchAll();
    }, []);

    return (
      <div className="cpc-section">
        <div className="cpc-container">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold">{t.get('cpc.pages.applications.title')}</h2>
            <Link to="/dashboard/cpc" className="text-sm text-primary hover:underline">{t.get('cpc.actions.back')}</Link>
          </div>
          {loadingList ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map(r => (
                <div key={r.id} className="cpc-card p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{r.applicant}</p>
                    <p className="text-sm text-muted-foreground">{r.email} • {r.job}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">{new Date(r.created_at).toLocaleString(locale)}</p>
                    <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">{r.status}</span>
                  </div>
                </div>
              ))}
              {rows.length === 0 && (
                <div className="cpc-card p-12 text-center text-muted-foreground">{t.get('cpc.pages.applications.empty')}</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  function OfertasAguardandoAprovacao() {
    const [loadingList, setLoadingList] = useState(true);
    const [rows, setRows] = useState<Array<{ id: string; title: string; location: string | null; created_at: string }>>([]);
    useEffect(() => {
      async function fetchAll() {
        setLoadingList(true);
        try {
          const data = await queryDocuments<{ id: string; title: string; location: string | null; created_at: string }>(
            'job_offers',
            [{ field: 'status', operator: '==', value: 'pending_review' }],
            { field: 'created_at', direction: 'desc' },
            200
          );
          setRows(data || []);
        } finally {
          setLoadingList(false);
        }
      }
      fetchAll();
    }, []);

    return (
      <div className="cpc-section">
        <div className="cpc-container">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold">{t.get('cpc.pages.offers.title')}</h2>
            <Link to="/dashboard/cpc" className="text-sm text-primary hover:underline">{t.get('cpc.actions.back')}</Link>
          </div>
          {loadingList ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map(r => (
                <div key={r.id} className="cpc-card p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{r.title}</p>
                    <p className="text-sm text-muted-foreground">{r.location || '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">{new Date(r.created_at).toLocaleDateString(locale)}</p>
                    <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">{t.get('cpc.pages.offers.status_pending')}</span>
                  </div>
                </div>
              ))}
              {rows.length === 0 && (
                <div className="cpc-card p-12 text-center text-muted-foreground">{t.get('cpc.pages.offers.empty')}</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  useEffect(() => {
    async function fetchOverview() {
      setLoading(true);
      try {
        const now = new Date();
        const todayISO = now.toISOString().slice(0, 10);
        const weekStart = new Date(now);
        const day = weekStart.getDay();
        const diffToMonday = day === 0 ? 6 : day - 1;
        weekStart.setDate(weekStart.getDate() - diffToMonday);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 7);
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);

        const prevDay = new Date(now);
        prevDay.setDate(now.getDate() - 1);
        const prevWeekStart = new Date(weekStart);
        prevWeekStart.setDate(weekStart.getDate() - 7);
        const prevWeekEnd = new Date(weekEnd);
        prevWeekEnd.setDate(weekEnd.getDate() - 7);
        const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

        const periodStartISO = period === 'today' ? todayISO : period === 'week' ? weekStart.toISOString().slice(0, 10) : monthStart.toISOString().slice(0, 10);
        const periodEndISO = period === 'today' ? todayISO : period === 'week' ? weekEnd.toISOString().slice(0, 10) : monthEnd.toISOString().slice(0, 10);
        const prevStartISO = period === 'today' ? prevDay.toISOString().slice(0, 10) : period === 'week' ? prevWeekStart.toISOString().slice(0, 10) : prevMonthStart.toISOString().slice(0, 10);
        const prevEndISO = period === 'today' ? prevDay.toISOString().slice(0, 10) : period === 'week' ? prevWeekEnd.toISOString().slice(0, 10) : prevMonthEnd.toISOString().slice(0, 10);

        const [firebaseMigrants, allSessionsRaw, companiesTotalCount, offersActiveCount, offersPendingCount, applicationsTotalCount, progressRaw, triageRaw, applicationsPeriodCountRaw, applicationsPrevCountRaw] = await Promise.all([
          queryDocuments<FirebaseUserDoc>('users', [{ field: 'role', operator: 'in', value: ['migrant', 'Migrant', 'MIGRANT'] }]),
          queryDocuments<{ id: string; scheduled_date: string; status: string | null; session_type: string; scheduled_time: string; migrant_id: string }>(
            'sessions',
            [],
            { field: 'scheduled_date', direction: 'asc' }
          ),
          countDocuments('companies', []),
          countDocuments('job_offers', [{ field: 'status', operator: '==', value: 'active' }]),
          countDocuments('job_offers', [{ field: 'status', operator: '==', value: 'pending_review' }]),
          countDocuments('job_applications', []),
          queryDocuments<{ progress_percent: number | null }>('user_trail_progress', []),
          queryDocuments<{ id: string; urgencies: string[] | null }>('triage', []),
          countDocuments('job_applications', [
            { field: 'created_at', operator: '>=', value: periodStartISO },
            { field: 'created_at', operator: '<=', value: periodEndISO },
          ]),
          countDocuments('job_applications', [
            { field: 'created_at', operator: '>=', value: prevStartISO },
            { field: 'created_at', operator: '<=', value: prevEndISO },
          ]),
        ]);

        const migrantDates = firebaseMigrants
          .map((u) => parseUnknownDate(u.createdAt))
          .filter((d): d is Date => d !== null);
        setMigrantsTotal(firebaseMigrants.length);
        setMigrantsNew7(migrantDates.filter((d) => d >= sevenDaysAgo).length);
        setMigrantsNew30(migrantDates.filter((d) => d >= thirtyDaysAgo).length);
        setMigrantsPeriodNew(countDatesBetween(migrantDates, periodStartISO, periodEndISO));
        setMigrantsPrevNew(countDatesBetween(migrantDates, prevStartISO, prevEndISO));

        const allSessions = (allSessionsRaw || []).filter((s) => !isCancelledSessionStatus(s.status));
        setSessionsTodayCount(allSessions.filter((s) => s.scheduled_date === todayISO).length);
        setSessionsWeekCount(allSessions.filter((s) => s.scheduled_date >= weekStart.toISOString().slice(0, 10) && s.scheduled_date <= weekEnd.toISOString().slice(0, 10)).length);
        setSessionsCompletedCount(allSessions.filter((s) => isCompletedSessionStatus(s.status)).length);
        setSessionsPeriodCount(allSessions.filter((s) => s.scheduled_date >= periodStartISO && s.scheduled_date <= periodEndISO).length);
        setSessionsPrevCount(allSessions.filter((s) => s.scheduled_date >= prevStartISO && s.scheduled_date <= prevEndISO).length);

        setCompaniesTotal(companiesTotalCount || 0);
        setJobOffersActive(offersActiveCount || 0);
        setJobOffersPendingApproval(offersPendingCount || 0);
        setApplicationsTotal(applicationsTotalCount || 0);
        setApplicationsPeriodCount(applicationsPeriodCountRaw || 0);
        setApplicationsPrevCount(applicationsPrevCountRaw || 0);

        const progressValues = (progressRaw || []).map(p => p.progress_percent || 0);
        const avg = progressValues.length ? Math.round(progressValues.reduce((a,b)=>a+b,0) / progressValues.length) : 0;
        setAvgProgress(avg);

        const agg = { juridico: 0, psicologico: 0, habitacional: 0 };
        triageRaw.forEach(t => {
          (t.urgencies || []).forEach(u => {
            if (u === 'juridico') agg.juridico += 1;
            if (u === 'psicologico') agg.psicologico += 1;
            if (u === 'habitacional') agg.habitacional += 1;
          });
        });
        setUrgencies(agg);

        const recentRaw = [...firebaseMigrants]
          .map((m) => ({ id: m.id, createdAt: parseUnknownDate(m.createdAt) }))
          .filter((m): m is { id: string; createdAt: Date } => m.createdAt !== null)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, 4);
        const recentIds = recentRaw.map((m) => m.id);
        const [recentProfiles, recentTriage] = await Promise.all([
          Promise.all(recentIds.map((id) => getDocument<{ name?: string | null; professionalTitle?: string | null }>('profiles', id))),
          Promise.all(recentIds.map((id) => getDocument<{ urgencies?: string[] | null }>('triage', id))),
        ]);

        const recentList = recentRaw.map((m, idx) => {
          const profileDoc = recentProfiles[idx];
          const triageDoc = recentTriage[idx];
          const urgenciesCount = (triageDoc?.urgencies || []).length;
          const hasTriage = Boolean(triageDoc);

          const statusLabel = !hasTriage
            ? t.get('cpc.recentMigrants.status.pending_docs')
            : urgenciesCount > 0
              ? t.get('cpc.recentMigrants.status.in_review')
              : t.get('cpc.recentMigrants.status.complete');
          const statusClassName = !hasTriage
            ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
            : urgenciesCount > 0
              ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
              : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';

          const createdAt = m.createdAt;
          const relative = formatRelativeTime(createdAt, now);
          const title = profileDoc?.professionalTitle ? ` • ${profileDoc.professionalTitle}` : '';

          return {
            id: m.id,
            name: profileDoc?.name || m.id,
            subtitle: `${relative}${title}`,
            statusLabel,
            statusClassName,
            dateLabel: shortDateFormatter.format(createdAt),
          };
        });
        setRecentMigrants(recentList);

        const todaySessTyped = allSessions
          .filter((s) => s.scheduled_date === todayISO)
          .sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time));
        const migrantIds = Array.from(new Set(todaySessTyped.map(s => s.migrant_id).filter(Boolean)));
        const migrantMap: Record<string, string> = {};
        if (migrantIds.length) {
          const migrantProfiles = await Promise.all(migrantIds.map((id) => getDocument<{ name?: string | null }>('profiles', id)));
          migrantIds.forEach((id, idx) => {
            migrantMap[id] = migrantProfiles[idx]?.name || id;
          });
        }
        const todayList = todaySessTyped.map((s) => ({
          id: s.id,
          migrant: migrantMap[s.migrant_id] || s.migrant_id,
          type: s.session_type,
          time: s.scheduled_time,
          status: formatSessionStatusLabel(s.status),
          statusRaw: s.status,
        }));
        setTodaySessions(todayList);

        try {
          let pendingChats = 0;
          let pendingUrgencies = 0;
          firebaseMigrants.forEach((migrant) => {
            const chatRaw = localStorage.getItem(`chat:${migrant.id}`);
            if (chatRaw) {
              const chatList = JSON.parse(chatRaw) as Array<{ from?: string }>;
              if (chatList.length > 0 && normalizeText(chatList[0]?.from) === 'migrante') {
                pendingChats += 1;
              }
            }
            const urgentRaw = localStorage.getItem(`urgentRequests:${migrant.id}`);
            if (urgentRaw) {
              const urgentList = JSON.parse(urgentRaw) as Array<{ status?: string }>;
              pendingUrgencies += urgentList.filter((item) => ['submetido', 'pending', 'pendente'].includes(normalizeText(item.status))).length;
            }
          });
          setMessagesPending(pendingChats + pendingUrgencies);
        } catch { setMessagesPending(0); }
      } finally {
        setLoading(false);
      }
    }
    fetchOverview();
  }, [period]);

  const migrantsDelta = migrantsPeriodNew - migrantsPrevNew;
  const sessionsDelta = sessionsPeriodCount - sessionsPrevCount;
  const applicationsDelta = applicationsPeriodCount - applicationsPrevCount;

  type KpiItem = {
    key: string;
    label: string;
    value: number;
    icon: React.ComponentType<{ className?: string }>;
    change: { label: string; className: string };
  };

  const kpis: KpiItem[] = useMemo(() => {
    return [
      {
        key: 'migrants_active',
        label: t.get('cpc.kpi.migrants'),
        value: migrantsTotal,
        icon: Users,
        change: formatKpiChange(migrantsPeriodNew, migrantsPrevNew),
      },
      {
        key: 'sessions',
        label: t.get('cpc.kpi.sessions'),
        value: period === 'today' ? sessionsTodayCount : sessionsPeriodCount,
        icon: Calendar,
        change: formatKpiChange(sessionsPeriodCount, sessionsPrevCount),
      },
      {
        key: 'applications',
        label: t.get('cpc.kpi.applications'),
        value: applicationsTotal,
        icon: FileText,
        change: formatKpiChange(applicationsPeriodCount, applicationsPrevCount),
      },
      {
        key: 'offers_active',
        label: t.get('cpc.kpi.offers_active'),
        value: jobOffersActive,
        icon: Briefcase,
        change: { label: t.get('cpc.kpi.change.stable'), className: 'text-muted-foreground' },
      },
      {
        key: 'offers_pending',
        label: t.get('cpc.kpi.offers_pending'),
        value: jobOffersPendingApproval,
        icon: Clock,
        change: { label: t.get('cpc.kpi.change.stable'), className: 'text-muted-foreground' },
      },
      {
        key: 'pending',
        label: t.get('cpc.kpi.pending'),
        value: messagesPending,
        icon: Mail,
        change: { label: t.get('cpc.kpi.change.stable'), className: 'text-muted-foreground' },
      },
    ];
  }, [
    applicationsPeriodCount,
    applicationsPrevCount,
    applicationsTotal,
    jobOffersActive,
    jobOffersPendingApproval,
    messagesPending,
    migrantsPeriodNew,
    migrantsPrevNew,
    migrantsTotal,
    period,
    sessionsPeriodCount,
    sessionsPrevCount,
    sessionsTodayCount,
    language,
    t,
  ]);

  const getStatusColor = (status?: string | null) => {
    if (isCompletedSessionStatus(status)) return 'bg-green-100 text-green-700';
    if (isInProgressSessionStatus(status)) return 'bg-blue-100 text-blue-700';
    if (isCancelledSessionStatus(status)) return 'bg-rose-100 text-rose-700';
    return 'bg-muted text-muted-foreground';
  };

  const sidebarItems = [
    { to: '/dashboard/cpc', label: t.get('cpc.menu.overview'), icon: TrendingUp },
    { to: '/dashboard/cpc/migrantes', label: t.get('cpc.menu.migrants'), icon: Users },
    { to: '/dashboard/cpc/agenda', label: t.get('cpc.menu.agenda'), icon: Calendar },
    { to: '/dashboard/cpc/candidaturas', label: t.get('cpc.menu.applications'), icon: FileText },
    { to: '/dashboard/cpc/ofertas', label: t.get('cpc.menu.offers'), icon: Briefcase },
    { to: '/dashboard/cpc/trilhas', label: t.get('cpc.menu.trails'), icon: BookOpen },
    { to: '/dashboard/cpc/equipa', label: t.get('cpc.menu.team'), icon: UserCog },
    { to: '/dashboard/cpc/traducoes', label: t.get('cpcTranslations.title'), icon: Languages },
  ];
  const isHome = location.pathname === '/dashboard/cpc' || location.pathname === '/dashboard/cpc/';

  return (
    <Layout>
      <div className="cpc-section">
        <div className="cpc-container">
          <div className="grid lg:grid-cols-[250px_minmax(0,1fr)] gap-6">
            <aside className="cpc-card p-4 h-fit lg:sticky lg:top-24">
              <div className="mb-4 px-2">
                <p className="text-sm text-muted-foreground">{t.get('cpc.menu.title')}</p>
                <p className="font-semibold">{cpcDisplayName}</p>
              </div>
              <nav className="space-y-1">
                {sidebarItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/dashboard/cpc'}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`
                    }
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </nav>
            </aside>

            <div>
              {isHome ? (
                <>
                  <div className="mb-8">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                      {t.get('cpc.dashboard.welcome')}, <span className="text-primary">{cpcDisplayName}</span>
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t.get('cpc.dashboard.today_summary', { date: longDateFormatter.format(new Date()) })}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
                    {kpis.map((kpi) => (
                      <div key={kpi.key} className="cpc-card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                            <kpi.icon className="h-4 w-4" />
                          </div>
                          <span className={`text-xs font-semibold ${kpi.change.className}`}>{kpi.change.label}</span>
                        </div>
                        <div className="mt-4">
                          <p className="text-xs tracking-widest text-muted-foreground font-semibold">{kpi.label}</p>
                          <p className="text-2xl font-bold leading-tight mt-1">{numberFormatter.format(kpi.value)}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6">
                    <div className="space-y-6">
                      <div className="cpc-card p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-lg font-semibold">{t.get('cpc.recentMigrants.title')}</h2>
                          <Link to="/dashboard/cpc/migrantes" className="text-sm text-primary hover:underline">
                            {t.get('cpc.actions.view_all')}
                          </Link>
                        </div>

                        <div className="divide-y divide-border">
                          {recentMigrants.map((migrant) => (
                            <div key={migrant.id} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                              <Link to={`/dashboard/cpc/candidatos/${migrant.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold shrink-0">
                                  {(migrant.name || 'U').slice(0, 1).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold truncate">{migrant.name}</p>
                                  <p className="text-sm text-muted-foreground truncate">{migrant.subtitle}</p>
                                </div>
                              </Link>

                              <div className="flex items-center gap-3 shrink-0">
                                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${migrant.statusClassName}`}>
                                  {migrant.statusLabel}
                                </span>
                                <button
                                  type="button"
                                  className="h-9 w-9 rounded-lg hover:bg-muted inline-flex items-center justify-center"
                                  aria-label={t.get('cpc.actions.actions')}
                                >
                                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                </button>
                              </div>
                            </div>
                          ))}

                          {recentMigrants.length === 0 ? (
                            <div className="py-10 text-center text-sm text-muted-foreground">{t.get('cpc.recentMigrants.empty')}</div>
                          ) : null}
                        </div>
                      </div>

                      <div className="cpc-card p-6">
                        <div className="flex items-center justify-between">
                          <h2 className="text-lg font-semibold">{t.get('cpc.sessions.title')}</h2>
                          <Link to="/dashboard/cpc/agenda" className="text-sm text-primary hover:underline">
                            {t.get('cpc.sessions.view_agenda')}
                          </Link>
                        </div>

                        {todaySessions.length === 0 ? (
                          <div className="mt-6 rounded-2xl bg-muted/40 p-8 flex items-center justify-between gap-6">
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <CalendarX className="h-6 w-6" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold">{t.get('cpc.sessions.empty')}</p>
                                <p className="text-sm text-muted-foreground truncate">{t.get('cpc.sessions.empty_subtitle')}</p>
                              </div>
                            </div>
                            <Link to="/dashboard/cpc/agenda">
                              <Button className="rounded-xl">{t.get('cpc.sessions.new_session')}</Button>
                            </Link>
                          </div>
                        ) : (
                          <div className="mt-4 space-y-3">
                            {todaySessions.map((session) => (
                              <div key={session.id} className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-muted/40">
                                <div className="min-w-0">
                                  <p className="font-semibold truncate">{session.migrant}</p>
                                  <p className="text-sm text-muted-foreground truncate">{session.type}</p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="font-semibold">{session.time}</p>
                                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(session.statusRaw)}`}>{session.status}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="cpc-card p-6">
                        <h2 className="text-lg font-semibold">{t.get('cpc.quickActions.title')}</h2>
                        <p className="text-sm text-muted-foreground mt-1">{t.get('cpc.quickActions.subtitle')}</p>

                        <div className="grid grid-cols-2 gap-4 mt-6">
                          <Link to="/dashboard/cpc/migrantes" className="cpc-card p-4 hover:shadow-md transition-shadow">
                            <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                              <UserPlus className="h-5 w-5" />
                            </div>
                            <p className="font-semibold mt-3">{t.get('cpc.quickActions.new_migrant')}</p>
                            <p className="text-sm text-muted-foreground mt-1">{t.get('cpc.quickActions.new_migrant_subtitle')}</p>
                          </Link>
                          <Link to="/dashboard/cpc/agenda" className="cpc-card p-4 hover:shadow-md transition-shadow">
                            <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                              <CalendarPlus className="h-5 w-5" />
                            </div>
                            <p className="font-semibold mt-3">{t.get('cpc.quickActions.agenda')}</p>
                            <p className="text-sm text-muted-foreground mt-1">{t.get('cpc.quickActions.agenda_subtitle')}</p>
                          </Link>
                          <Link to="/dashboard/cpc/trilhas" className="cpc-card p-4 hover:shadow-md transition-shadow">
                            <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                              <BookOpen className="h-5 w-5" />
                            </div>
                            <p className="font-semibold mt-3">{t.get('cpc.quickActions.manage_trails')}</p>
                            <p className="text-sm text-muted-foreground mt-1">{t.get('cpc.quickActions.manage_trails_subtitle')}</p>
                          </Link>
                          <Link to="/dashboard/cpc/ofertas" className="cpc-card p-4 hover:shadow-md transition-shadow">
                            <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                              <Briefcase className="h-5 w-5" />
                            </div>
                            <p className="font-semibold mt-3">{t.get('cpc.quickActions.create_offer')}</p>
                            <p className="text-sm text-muted-foreground mt-1">{t.get('cpc.quickActions.create_offer_subtitle')}</p>
                          </Link>
                        </div>
                      </div>

                      <div className="cpc-card overflow-hidden relative">
                        <div className="relative h-44 bg-gradient-to-br from-emerald-100 via-emerald-50 to-slate-50">
                          <div className="absolute top-4 left-4 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold shadow-sm">
                            <MapPin className="h-4 w-4 text-emerald-700" />
                            {t.get('cpc.capacity.center')}
                          </div>
                        </div>
                        <div className="p-6">
                          <div className="flex items-center justify-between gap-4">
                            <p className="font-semibold">{t.get('cpc.capacity.title')}</p>
                            <p className="text-sm font-semibold text-muted-foreground">82%</p>
                          </div>
                          <div className="mt-3">
                            <Progress value={82} />
                          </div>
                        </div>
                        <div className="absolute inset-0 bg-background/45 backdrop-blur-sm flex items-center justify-center z-10 cursor-not-allowed">
                          <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/80 text-white/90 px-5 py-2 text-xs font-semibold shadow-md">
                            <Wrench className="h-4 w-4" />
                            {t.get('cpc.soon')}
                          </div>
                        </div>
                      </div>

                      <div className="cpc-card p-6 relative overflow-hidden">
                        <div className="flex items-center justify-between">
                          <h2 className="text-lg font-semibold">{t.get('cpc.teamOnDuty.title')}</h2>
                          <span className="text-xs font-semibold text-muted-foreground">{t.get('cpc.teamOnDuty.today')}</span>
                        </div>
                        <div className="mt-6 space-y-5">
                          {[
                            { name: 'João Duarte', role: 'Mediador', tickets: 12, percent: 75 },
                            { name: 'Sofia Costa', role: 'Psicóloga', tickets: 8, percent: 50 },
                          ].map((m) => (
                            <div key={m.name} className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold shrink-0">
                                {m.name.split(' ').slice(0, 2).map((p) => p.slice(0, 1)).join('').toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-4">
                                  <div className="min-w-0">
                                    <p className="font-semibold truncate">{m.name}</p>
                                    <p className="text-sm text-muted-foreground truncate">{m.role}</p>
                                  </div>
                                  <p className="text-sm text-muted-foreground shrink-0">{t.get('cpc.teamOnDuty.tickets', { count: m.tickets })}</p>
                                </div>
                                <div className="mt-2">
                                  <Progress value={m.percent} />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="absolute inset-0 bg-background/45 backdrop-blur-sm flex items-center justify-center z-10 cursor-not-allowed">
                          <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/80 text-white/90 px-5 py-2 text-xs font-semibold shadow-md">
                            <Wrench className="h-4 w-4" />
                            {t.get('cpc.soon')}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}

              <Routes>
                <Route path="candidatos/:candidateId" element={<CandidateProfilePage />} />
                <Route path="migrantes/:migrantId/perfil" element={<MigrantProfilePage />} />
                <Route path="migrantes" element={<MigrantsAdminPage />} />
                <Route path="agenda" element={<TeamAgendaPage />} />
                <Route path="candidaturas" element={<CandidaturasDetalhadas />} />
                <Route path="ofertas" element={<OfertasAguardandoAprovacao />} />
                <Route path="trilhas" element={<TrailsAdminPage />} />
                <Route path="trilhas/:trailId" element={<TrailEditorPage />} />
                <Route path="equipa" element={<EquipaPage />} />
                <Route path="traducoes" element={<TranslationsAdminPage />} />
              </Routes>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
import CandidateProfilePage from './company/CandidateProfilePage';
import MigrantsAdminPage from './cpc/MigrantsAdminPage';
import TeamAgendaPage from './cpc/TeamAgendaPage';
import MigrantProfilePage from './migrant/ProfilePage';
import TrailsAdminPage from './cpc/TrailsAdminPage';
import TrailEditorPage from './cpc/TrailEditorPage';
import TranslationsAdminPage from './cpc/TranslationsAdminPage';
