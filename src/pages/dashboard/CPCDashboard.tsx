import { Link, NavLink, Routes, Route, useLocation } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEffect, useMemo, useState } from 'react';
import { countDocuments, getDocument, queryDocuments, updateDocument } from '@/integrations/firebase/firestore';
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
const CPC_TEAM_ROLE_LABELS: Record<CpcTeamRole, string> = {
  admin: 'Admin',
  manager: 'Gestor',
  coordinator: 'Coordenador',
  mediator: 'Mediador',
  lawyer: 'Jurista',
  psychologist: 'Psicólogo',
  trainer: 'Formador',
};

function normalizeText(value?: string | null): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
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

export default function CPCDashboard() {
  const { profile } = useAuth();
  const location = useLocation();

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
  const [todaySessions, setTodaySessions] = useState<Array<{ id: string; migrant: string; type: string; time: string; status: string }>>([]);
  const [messagesPending, setMessagesPending] = useState(0);

  const numberFormatter = useMemo(() => new Intl.NumberFormat('pt-PT'), []);

  function formatKpiChange(current: number, prev: number): { label: string; className: string } {
    if (!Number.isFinite(current) || !Number.isFinite(prev)) return { label: 'Estável', className: 'text-muted-foreground' };
    if (prev <= 0) return current > 0 ? { label: 'Novo', className: 'text-emerald-700' } : { label: 'Estável', className: 'text-muted-foreground' };
    const delta = current - prev;
    if (delta === 0) return { label: 'Estável', className: 'text-muted-foreground' };
    const percent = Math.round((Math.abs(delta) / prev) * 100);
    return delta > 0 ? { label: `+${percent}%`, className: 'text-emerald-700' } : { label: `-${percent}%`, className: 'text-rose-700' };
  }

  function formatRelativeTime(from: Date, to: Date): string {
    const diffMs = Math.max(0, to.getTime() - from.getTime());
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `há ${Math.max(1, mins)} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `há ${hours} hora${hours === 1 ? '' : 's'}`;
    const days = Math.floor(hours / 24);
    return `há ${days} dia${days === 1 ? '' : 's'}`;
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

    async function loadTeam() {
      setLoadingList(true);
      try {
        const users = await queryDocuments<CpcTeamUserDoc>('users', []);
        const filtered = users
          .filter((u): u is CpcTeamUserDoc & { role: CpcTeamRole } => CPC_TEAM_ROLES.includes(normalizeText(u.role) as CpcTeamRole))
          .map((u) => ({
            id: u.id,
            name: u.name || u.email || 'Utilizador',
            email: u.email || '—',
            role: normalizeText(u.role) as CpcTeamRole,
            active: u.active !== false,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setRows(filtered);
      } finally {
        setLoadingList(false);
      }
    }

    useEffect(() => {
      loadTeam();
    }, []);

    async function handleCreateUser() {
      if (!name.trim() || !email.trim() || !password.trim()) {
        setFormError('Preencha nome, email e password.');
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
        const message = error instanceof Error ? error.message : 'Erro ao criar utilizador.';
        setFormError(message);
      } finally {
        setSaving(false);
      }
    }

    function openEdit(user: { id: string; name: string; role: CpcTeamRole }) {
      setEditTarget(user);
      setEditName(user.name);
      setEditRole(user.role);
      setEditOpen(true);
    }

    async function handleSaveEdit() {
      if (!editTarget) return;
      if (!editName.trim()) {
        setFormError('Nome é obrigatório.');
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
        const message = error instanceof Error ? error.message : 'Erro ao atualizar utilizador.';
        setFormError(message);
      } finally {
        setSaving(false);
      }
    }

    async function toggleActive(user: { id: string; active: boolean }) {
      setActionLoadingId(user.id);
      setFormError('');
      try {
        await updateDocument('users', user.id, {
          active: !user.active,
          disabledAt: user.active ? new Date().toISOString() : null,
        });
        await loadTeam();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erro ao atualizar estado do utilizador.';
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
        if (sortBy === 'role') return CPC_TEAM_ROLE_LABELS[a.role].localeCompare(CPC_TEAM_ROLE_LABELS[b.role]);
        if (sortBy === 'status') return Number(b.active) - Number(a.active) || a.name.localeCompare(b.name);
        return a.name.localeCompare(b.name);
      });
      return sorted;
    }, [query, roleFilter, rows, sortBy, statusFilter]);

    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <UserCog className="h-7 w-7 text-primary" /> Equipa
            </h1>
            <p className="text-muted-foreground mt-1">Gestão da equipa com filtros, perfis e estado de acesso</p>
          </div>
          <Button onClick={() => setOpen(true)} className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Adicionar novo
          </Button>
        </div>

        <div className="cpc-card p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Label>Pesquisa</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nome ou email" />
                <Button variant="outline" className="gap-2">
                  <Filter className="h-4 w-4" /> Filtrar
                </Button>
              </div>
            </div>
            <div>
              <Label>Perfil</Label>
              <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {CPC_TEAM_ROLES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {CPC_TEAM_ROLE_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="inactive">Desativados</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ordenar</Label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Nome</SelectItem>
                  <SelectItem value="role">Perfil</SelectItem>
                  <SelectItem value="status">Estado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Resumo</Label>
              <div className="mt-1 h-10 rounded-md border bg-muted/40 flex items-center px-3 text-sm text-muted-foreground">
                {filtered.length} utilizadores
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
            <h3 className="font-semibold mb-2">Sem utilizadores encontrados</h3>
            <p className="text-muted-foreground">Ajuste os filtros ou a pesquisa.</p>
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
                        <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">Desativado</span>
                      ) : null}
                      <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                        {CPC_TEAM_ROLE_LABELS[r.role]}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{r.email}</p>

                    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 mt-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <UserCog className="h-4 w-4" /> {CPC_TEAM_ROLE_LABELS[r.role]}
                      </span>
                      <span className="flex items-center gap-1">
                        {r.active ? <CheckCircle className="h-4 w-4" /> : <Ban className="h-4 w-4" />} {r.active ? 'Ativo' : 'Desativado'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Mail className="h-4 w-4" /> {r.email || '—'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-stretch gap-2 w-full lg:w-56">
                    <Button
                      variant="outline"
                      className="inline-flex items-center justify-center gap-2 w-full"
                      onClick={() => openEdit(r)}
                    >
                      <Pencil className="h-4 w-4" /> Editar
                    </Button>
                    <Button
                      variant="outline"
                      className="inline-flex items-center justify-center gap-2 w-full"
                      onClick={() => toggleActive(r)}
                      disabled={actionLoadingId === r.id}
                    >
                      {r.active ? <UserX className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                      {r.active ? 'Desativar' : 'Reativar'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar novo utilizador</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="email@dominio.com" />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Mínimo 6 caracteres" />
              </div>
              <div className="space-y-2">
                <Label>Perfil</Label>
                <Select value={role} onValueChange={(v) => setRole(v as CpcTeamRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CPC_TEAM_ROLES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {CPC_TEAM_ROLE_LABELS[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
              <Button className="w-full" onClick={handleCreateUser} disabled={saving}>
                {saving ? 'A guardar...' : 'Criar utilizador'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Editar utilizador</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nome completo" />
              </div>
              <div className="space-y-2">
                <Label>Perfil</Label>
                <Select value={editRole} onValueChange={(v) => setEditRole(v as CpcTeamRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CPC_TEAM_ROLES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {CPC_TEAM_ROLE_LABELS[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
              <Button className="w-full" onClick={handleSaveEdit} disabled={saving}>
                {saving ? 'A guardar...' : 'Guardar alterações'}
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
            <h2 className="font-semibold">Candidaturas enviadas</h2>
            <Link to="/dashboard/cpc" className="text-sm text-primary hover:underline">Voltar</Link>
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
                    <p className="text-sm">{new Date(r.created_at).toLocaleString('pt-PT')}</p>
                    <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">{r.status}</span>
                  </div>
                </div>
              ))}
              {rows.length === 0 && (
                <div className="cpc-card p-12 text-center text-muted-foreground">Sem candidaturas no período</div>
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
            <h2 className="font-semibold">Ofertas aguardando aprovação</h2>
            <Link to="/dashboard/cpc" className="text-sm text-primary hover:underline">Voltar</Link>
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
                    <p className="text-sm">{new Date(r.created_at).toLocaleDateString('pt-PT')}</p>
                    <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">Em aprovação</span>
                  </div>
                </div>
              ))}
              {rows.length === 0 && (
                <div className="cpc-card p-12 text-center text-muted-foreground">Sem ofertas pendentes</div>
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
          queryDocuments<FirebaseUserDoc>('users', [{ field: 'role', operator: '==', value: 'migrant' }]),
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

          const statusLabel = !hasTriage ? 'DOC. PENDENTES' : urgenciesCount > 0 ? 'EM REVISÃO' : 'COMPLETO';
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
            dateLabel: createdAt.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }),
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
        const todayList = todaySessTyped.map(s => ({
          id: s.id,
          migrant: migrantMap[s.migrant_id] || s.migrant_id,
          type: s.session_type,
          time: s.scheduled_time,
          status: s.status || 'Agendada'
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
        label: 'MIGRANTES',
        value: migrantsTotal,
        icon: Users,
        change: formatKpiChange(migrantsPeriodNew, migrantsPrevNew),
      },
      {
        key: 'sessions',
        label: 'SESSÕES',
        value: period === 'today' ? sessionsTodayCount : sessionsPeriodCount,
        icon: Calendar,
        change: formatKpiChange(sessionsPeriodCount, sessionsPrevCount),
      },
      {
        key: 'applications',
        label: 'CANDIDATURAS',
        value: applicationsTotal,
        icon: FileText,
        change: formatKpiChange(applicationsPeriodCount, applicationsPrevCount),
      },
      {
        key: 'offers_active',
        label: 'OFERTAS',
        value: jobOffersActive,
        icon: Briefcase,
        change: { label: 'Estável', className: 'text-muted-foreground' },
      },
      {
        key: 'offers_pending',
        label: 'AGUARDANDO',
        value: jobOffersPendingApproval,
        icon: Clock,
        change: { label: 'Estável', className: 'text-muted-foreground' },
      },
      {
        key: 'pending',
        label: 'PENDENTES',
        value: messagesPending,
        icon: Mail,
        change: { label: 'Estável', className: 'text-muted-foreground' },
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
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Concluída':
        return 'bg-green-100 text-green-700';
      case 'Em curso':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const sidebarItems = [
    { to: '/dashboard/cpc', label: 'Visão geral', icon: TrendingUp },
    { to: '/dashboard/cpc/migrantes', label: 'Migrantes', icon: Users },
    { to: '/dashboard/cpc/agenda', label: 'Agenda', icon: Calendar },
    { to: '/dashboard/cpc/candidaturas', label: 'Candidaturas', icon: FileText },
    { to: '/dashboard/cpc/ofertas', label: 'Ofertas', icon: Briefcase },
    { to: '/dashboard/cpc/trilhas', label: 'Trilhas', icon: BookOpen },
    { to: '/dashboard/cpc/equipa', label: 'Equipa', icon: UserCog },
  ];
  const isHome = location.pathname === '/dashboard/cpc' || location.pathname === '/dashboard/cpc/';

  return (
    <Layout>
      <div className="cpc-section">
        <div className="cpc-container">
          <div className="grid lg:grid-cols-[250px_minmax(0,1fr)] gap-6">
            <aside className="cpc-card p-4 h-fit lg:sticky lg:top-24">
              <div className="mb-4 px-2">
                <p className="text-sm text-muted-foreground">Menu CPC</p>
                <p className="font-semibold">{profile?.name || 'Utilizador'}</p>
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
                      Bem-vindo(a), <span className="text-primary">CPC</span>
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      Aqui está um resumo das atividades de hoje, {new Date().toLocaleDateString('pt-PT')}.
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
                          <h2 className="text-lg font-semibold">Migrantes Recentes</h2>
                          <Link to="/dashboard/cpc/migrantes" className="text-sm text-primary hover:underline">
                            Ver todos
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
                                  aria-label="Ações"
                                >
                                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                </button>
                              </div>
                            </div>
                          ))}

                          {recentMigrants.length === 0 ? (
                            <div className="py-10 text-center text-sm text-muted-foreground">Sem registos recentes</div>
                          ) : null}
                        </div>
                      </div>

                      <div className="cpc-card p-6">
                        <div className="flex items-center justify-between">
                          <h2 className="text-lg font-semibold">Sessões</h2>
                          <Link to="/dashboard/cpc/agenda" className="text-sm text-primary hover:underline">
                            Ver agenda
                          </Link>
                        </div>

                        {todaySessions.length === 0 ? (
                          <div className="mt-6 rounded-2xl bg-muted/40 p-8 flex items-center justify-between gap-6">
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <CalendarX className="h-6 w-6" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold">Sem sessões agendadas</p>
                                <p className="text-sm text-muted-foreground truncate">Hoje não há sessões marcadas.</p>
                              </div>
                            </div>
                            <Link to="/dashboard/cpc/agenda">
                              <Button className="rounded-xl">Nova Sessão</Button>
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
                                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(session.status)}`}>{session.status}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="cpc-card p-6">
                        <h2 className="text-lg font-semibold">Ações Rápidas</h2>
                        <p className="text-sm text-muted-foreground mt-1">Aceda rapidamente às funcionalidades principais.</p>

                        <div className="grid grid-cols-2 gap-4 mt-6">
                          <Link to="/dashboard/cpc/migrantes" className="cpc-card p-4 hover:shadow-md transition-shadow">
                            <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                              <UserPlus className="h-5 w-5" />
                            </div>
                            <p className="font-semibold mt-3">Novo Migrante</p>
                            <p className="text-sm text-muted-foreground mt-1">Adicionar manualmente</p>
                          </Link>
                          <Link to="/dashboard/cpc/agenda" className="cpc-card p-4 hover:shadow-md transition-shadow">
                            <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                              <CalendarPlus className="h-5 w-5" />
                            </div>
                            <p className="font-semibold mt-3">Agenda</p>
                            <p className="text-sm text-muted-foreground mt-1">Marcar nova reunião</p>
                          </Link>
                          <Link to="/dashboard/cpc/trilhas" className="cpc-card p-4 hover:shadow-md transition-shadow">
                            <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                              <BookOpen className="h-5 w-5" />
                            </div>
                            <p className="font-semibold mt-3">Gerir Trilhas</p>
                            <p className="text-sm text-muted-foreground mt-1">Editar fluxos de integração</p>
                          </Link>
                          <Link to="/dashboard/cpc/ofertas" className="cpc-card p-4 hover:shadow-md transition-shadow">
                            <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                              <Briefcase className="h-5 w-5" />
                            </div>
                            <p className="font-semibold mt-3">Criar Oferta</p>
                            <p className="text-sm text-muted-foreground mt-1">Publicar vaga de emprego</p>
                          </Link>
                        </div>
                      </div>

                      <div className="cpc-card overflow-hidden relative">
                        <div className="relative h-44 bg-gradient-to-br from-emerald-100 via-emerald-50 to-slate-50">
                          <div className="absolute top-4 left-4 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold shadow-sm">
                            <MapPin className="h-4 w-4 text-emerald-700" />
                            CENTRO DE APOIO: LISBOA
                          </div>
                        </div>
                        <div className="p-6">
                          <div className="flex items-center justify-between gap-4">
                            <p className="font-semibold">Capacidade Atual</p>
                            <p className="text-sm font-semibold text-muted-foreground">82%</p>
                          </div>
                          <div className="mt-3">
                            <Progress value={82} />
                          </div>
                        </div>
                        <div className="absolute inset-0 bg-white/30 dark:bg-background/45 backdrop-blur-sm flex items-center justify-center z-10 cursor-not-allowed">
                          <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/80 text-white/90 px-5 py-2 text-xs font-semibold shadow-md">
                            <Wrench className="h-4 w-4" />
                            EM BREVE
                          </div>
                        </div>
                      </div>

                      <div className="cpc-card p-6 relative overflow-hidden">
                        <div className="flex items-center justify-between">
                          <h2 className="text-lg font-semibold">Equipa em serviço</h2>
                          <span className="text-xs font-semibold text-muted-foreground">Hoje</span>
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
                                  <p className="text-sm text-muted-foreground shrink-0">{m.tickets} tickets</p>
                                </div>
                                <div className="mt-2">
                                  <Progress value={m.percent} />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="absolute inset-0 bg-white/30 dark:bg-background/45 backdrop-blur-sm flex items-center justify-center z-10 cursor-not-allowed">
                          <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/80 text-white/90 px-5 py-2 text-xs font-semibold shadow-md">
                            <Wrench className="h-4 w-4" />
                            EM BREVE
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
                <Route path="equipa" element={<EquipaPage />} />
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
