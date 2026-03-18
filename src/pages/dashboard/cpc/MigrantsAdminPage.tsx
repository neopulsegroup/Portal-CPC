import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteDocument, getDocument, queryDocuments } from '@/integrations/firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { Users, Filter, Eye, Ban, CheckCircle, AlertTriangle, Clock, ClipboardList, Download, FileSpreadsheet, FileText, Loader2, Trash2 } from 'lucide-react';

type TriageAnswers = Record<string, unknown>;

type MigrantRow = {
  user_id: string;
  name: string;
  email: string;
  nif?: string | null;
  birth_date?: string | null;
  nationality?: string | null;
  arrival_date?: string | null;
  legal_status?: string | null;
  work_status?: string | null;
  language_level?: string | null;
  urgencies?: string[] | null;
  triage_answers?: TriageAnswers | null;
  upcoming_sessions?: number;
  trails_progress_avg?: number;
  blocked?: boolean;
};

type UserDoc = { id: string; name?: string | null; email?: string | null; role?: string | null; nif?: string | null };
type ProfileDoc = { name?: string | null; email?: string | null; birthDate?: string | null; nationality?: string | null; arrivalDate?: string | null };
type TriageDoc = { legal_status?: string | null; work_status?: string | null; language_level?: string | null; urgencies?: string[] | null; answers?: TriageAnswers | null };
type SessionDoc = { migrant_id?: string | null; scheduled_date?: string | null; status?: string | null };
type ProgressDoc = { user_id?: string | null; progress_percent?: number | null };

function normalizeLegalStatus(value?: string | null): 'regular' | 'irregular' | 'pendente' | '' {
  if (!value) return '';
  const v = value.toLowerCase();
  if (['regular', 'regularized', 'refugee'].includes(v)) return 'regular';
  if (['irregular', 'not_regularized'].includes(v)) return 'irregular';
  if (['pendente', 'pending'].includes(v)) return 'pendente';
  return '';
}

function normalizeWorkStatus(value?: string | null): 'empregado' | 'desempregado' | 'informal' | '' {
  if (!value) return '';
  const v = value.toLowerCase();
  if (['empregado', 'employed'].includes(v)) return 'empregado';
  if (['desempregado', 'unemployed', 'unemployed_seeking'].includes(v)) return 'desempregado';
  if (['informal', 'student', 'other'].includes(v)) return 'informal';
  return '';
}

function normalizeLanguageLevel(value?: string | null): 'iniciante' | 'intermediario' | 'avancado' | '' {
  if (!value) return '';
  const v = value.toLowerCase();
  if (['iniciante', 'basic', 'none'].includes(v)) return 'iniciante';
  if (['intermediario', 'intermediate'].includes(v)) return 'intermediario';
  if (['avancado', 'advanced', 'native', 'fluent'].includes(v)) return 'avancado';
  return '';
}

function normalizeUrgencyToken(value?: string | null): 'juridico' | 'psicologico' | 'habitacional' | '' {
  if (!value) return '';
  const v = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  if (v.includes('jurid')) return 'juridico';
  if (v.includes('psicolog')) return 'psicologico';
  if (v.includes('habitac')) return 'habitacional';
  return '';
}

function normalizeUrgencies(values?: string[] | null): Array<'juridico' | 'psicologico' | 'habitacional'> {
  if (!values || values.length === 0) return [];
  const set = new Set<'juridico' | 'psicologico' | 'habitacional'>();
  values.forEach((value) => {
    const normalized = normalizeUrgencyToken(value);
    if (normalized) set.add(normalized);
  });
  return Array.from(set);
}

export default function MigrantsAdminPage() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<MigrantRow>>([]);
  const [query, setQuery] = useState('');
  const [legalFilter, setLegalFilter] = useState<'all' | 'regular' | 'irregular' | 'pendente'>('all');
  const [workFilter, setWorkFilter] = useState<'all' | 'empregado' | 'desempregado' | 'informal'>('all');
  const [langFilter, setLangFilter] = useState<'all' | 'iniciante' | 'intermediario' | 'avancado'>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'juridico' | 'psicologico' | 'habitacional'>('all');
  const [selectedTriage, setSelectedTriage] = useState<MigrantRow | null>(null);
  const [exporting, setExporting] = useState<'csv' | 'xlsx' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MigrantRow | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const xlsxModuleRef = useRef<typeof import('xlsx') | null>(null);
  const xlsxLoaderRef = useRef<Promise<typeof import('xlsx')> | null>(null);

  function isoDateToPt(value: string): string | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const [, y, m, d] = match;
    return `${d}/${m}/${y}`;
  }

  function answerLabel(key: string): string {
    const path = `triage.questions.${key}`;
    const translated = t.get(path);
    if (translated !== path) return translated;
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (m) => m.toUpperCase());
  }

  function optionLabel(questionId: string, option: string): string {
    const path = `triage.options.${questionId}.${option}`;
    const translated = t.get(path);
    if (translated !== path) return translated;
    if (option === 'yes') return t.get('common.yes');
    if (option === 'no') return t.get('common.no');
    return option;
  }

  function answerValue(questionId: string, value: unknown): string {
    if (Array.isArray(value)) {
      return value
        .map((item) => (typeof item === 'string' ? optionLabel(questionId, item) : String(item)))
        .join(', ');
    }
    if (typeof value === 'boolean') return value ? t.get('common.yes') : t.get('common.no');
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'string') {
      const datePt = isoDateToPt(value);
      if (datePt) return datePt;
      return optionLabel(questionId, value);
    }
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  function getExportTimestamp(now = new Date()): string {
    const y = String(now.getFullYear());
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${y}${m}${d}_${hh}${mm}${ss}`;
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function csvEscape(value: string): string {
    const shouldQuote = /[",\r\n]/.test(value);
    if (!shouldQuote) return value;
    return `"${value.replace(/"/g, '""')}"`;
  }

  function getStringFromCell(value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'string') {
      const datePt = isoDateToPt(value);
      if (datePt) return datePt;
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return JSON.stringify(value);
  }

  function normalizeEmail(value: unknown): { value: string; valid: boolean } {
    if (typeof value !== 'string') return { value: '—', valid: false };
    const trimmed = value.trim();
    if (!trimmed || trimmed === '—') return { value: '—', valid: false };
    const normalized = trimmed.toLowerCase();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
    return { value: valid ? normalized : '—', valid };
  }

  function legalLabel(value?: string | null): string {
    const normalized = normalizeLegalStatus(value);
    if (normalized === 'regular') return t.get('cpc.migrantsAdmin.legal.regular');
    if (normalized === 'irregular') return t.get('cpc.migrantsAdmin.legal.irregular');
    if (normalized === 'pendente') return t.get('cpc.migrantsAdmin.legal.pending');
    return '—';
  }

  function workLabel(value?: string | null): string {
    const normalized = normalizeWorkStatus(value);
    if (normalized === 'empregado') return t.get('cpc.migrantsAdmin.work.employed');
    if (normalized === 'desempregado') return t.get('cpc.migrantsAdmin.work.unemployed');
    if (normalized === 'informal') return t.get('cpc.migrantsAdmin.work.informal');
    return '—';
  }

  function languageLabel(value?: string | null): string {
    const normalized = normalizeLanguageLevel(value);
    if (normalized === 'iniciante') return t.get('cpc.migrantsAdmin.language.beginner');
    if (normalized === 'intermediario') return t.get('cpc.migrantsAdmin.language.intermediate');
    if (normalized === 'avancado') return t.get('cpc.migrantsAdmin.language.advanced');
    return '—';
  }

  function exportRowValue(row: MigrantRow, key: 'birth_date' | 'nationality' | 'arrival_date'): string {
    const fromAnswers = row.triage_answers?.[key] ?? row.triage_answers?.[key === 'arrival_date' ? 'arrival_date_pt' : key];
    if (typeof fromAnswers === 'string') return getStringFromCell(fromAnswers);
    if (key === 'birth_date') return getStringFromCell(row.birth_date);
    if (key === 'nationality') return getStringFromCell(row.nationality);
    return getStringFromCell(row.arrival_date);
  }

  async function handleExport(format: 'csv' | 'xlsx') {
    if (!profile || !['admin', 'manager', 'coordinator', 'mediator', 'lawyer', 'psychologist', 'trainer'].includes(profile.role)) {
      toast({
        title: t.get('cpc.migrantsAdmin.export.no_permission.title'),
        description: t.get('cpc.migrantsAdmin.export.no_permission.description'),
        variant: 'destructive',
      });
      return;
    }

    if (format === 'xlsx' && !xlsxModuleRef.current) {
      setExporting('xlsx');
      try {
        if (!xlsxLoaderRef.current) {
          xlsxLoaderRef.current = import('xlsx');
        }
        const module = await xlsxLoaderRef.current;
        xlsxModuleRef.current = module;
      } catch {
        toast({
          title: t.get('cpc.migrantsAdmin.export.error_title'),
          description: t.get('cpc.migrantsAdmin.export.xlsx_prepare_error'),
          variant: 'destructive',
        });
      } finally {
        setExporting(null);
      }
      toast({
        title: t.get('cpc.migrantsAdmin.export.xlsx_ready.title'),
        description: t.get('cpc.migrantsAdmin.export.xlsx_ready.description'),
      });
      return;
    }

    if (filtered.length === 0) {
      toast({ title: t.get('cpc.migrantsAdmin.export.no_results.title'), description: t.get('cpc.migrantsAdmin.export.no_results.description') });
      return;
    }

    if (filtered.length > 10000) {
      toast({
        title: t.get('cpc.migrantsAdmin.export.limit_exceeded.title'),
        description: t.get('cpc.migrantsAdmin.export.limit_exceeded.description'),
        variant: 'destructive',
      });
      return;
    }

    setExporting(format);
    try {
      const header = [
        t.get('cpc.migrantsAdmin.export.columns.name'),
        t.get('cpc.migrantsAdmin.export.columns.email'),
        t.get('cpc.migrantsAdmin.export.columns.birth_date'),
        t.get('cpc.migrantsAdmin.export.columns.nationality'),
        t.get('cpc.migrantsAdmin.export.columns.legal_status'),
        t.get('cpc.migrantsAdmin.export.columns.arrival_date'),
      ];
      const data: string[][] = new Array(filtered.length + 1);
      data[0] = header;
      let invalidEmailCount = 0;

      for (let i = 0; i < filtered.length; i += 1) {
        const r = filtered[i];
        const email = normalizeEmail(r.email);
        if (!email.valid) invalidEmailCount += 1;
        data[i + 1] = [
          getStringFromCell(r.name),
          email.value,
          exportRowValue(r, 'birth_date'),
          exportRowValue(r, 'nationality'),
          legalLabel(r.legal_status),
          exportRowValue(r, 'arrival_date'),
        ];
      }

      const timestamp = getExportTimestamp();
      const baseName = `migrantes_export_${timestamp}`;

      if (format === 'csv') {
        const lines: string[] = new Array(data.length);
        for (let i = 0; i < data.length; i += 1) {
          const row = data[i];
          const cols: string[] = new Array(row.length);
          for (let j = 0; j < row.length; j += 1) {
            cols[j] = csvEscape(row[j] ?? '');
          }
          lines[i] = cols.join(',');
        }
        const csv = `\uFEFF${lines.join('\r\n')}`;
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${baseName}.csv`);
      } else {
        const XLSX = xlsxModuleRef.current;
        if (!XLSX) {
          throw new Error(t.get('cpc.migrantsAdmin.export.xlsx_missing_module'));
        }
        const worksheet = XLSX.utils.aoa_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, t.get('cpc.migrantsAdmin.title'));
        const out = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        downloadBlob(
          new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
          `${baseName}.xlsx`,
        );
      }
      toast({
        title: t.get('cpc.migrantsAdmin.export.done.title'),
        description: t.get('cpc.migrantsAdmin.export.done.description', { count: filtered.length }),
      });
      if (invalidEmailCount > 0) {
        toast({
          title: t.get('cpc.migrantsAdmin.export.warning.title'),
          description: t.get('cpc.migrantsAdmin.export.warning.description', { count: invalidEmailCount }),
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t.get('cpc.migrantsAdmin.export.generic_error');
      toast({ title: t.get('cpc.migrantsAdmin.export.error_title'), description: message, variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  }

  useEffect(() => {
    if (!xlsxLoaderRef.current) {
      xlsxLoaderRef.current = import('xlsx');
      xlsxLoaderRef.current
        .then((module) => {
          xlsxModuleRef.current = module;
        })
        .catch(() => {});
    }

    async function fetchAll() {
      setLoading(true);
      try {
        const migrants = await queryDocuments<UserDoc>('users', [{ field: 'role', operator: '==', value: 'migrant' }]);
        const profileList = migrants.map((u) => ({ user_id: u.id, name: u.name || '', email: u.email || '', nif: u.nif || null }));
        const userIds = profileList.map((p) => p.user_id);

        const [profileDocs, triageDocs, sessionDocs, progressDocs] = await Promise.all([
          Promise.all(userIds.map(async (uid) => ({ uid, profile: await getDocument<ProfileDoc>('profiles', uid) }))),
          Promise.all(userIds.map(async (uid) => ({ uid, triage: await getDocument<TriageDoc>('triage', uid) }))),
          queryDocuments<SessionDoc>('sessions', [{ field: 'status', operator: '==', value: 'Agendada' }]),
          queryDocuments<ProgressDoc>('user_trail_progress', []),
        ]);

        const profileMap: Record<string, ProfileDoc> = {};
        profileDocs.forEach((p) => {
          if (p.profile) profileMap[p.uid] = p.profile;
        });

        const triageMap: Record<string, TriageDoc> = {};
        triageDocs.forEach((t) => {
          if (t.triage) triageMap[t.uid] = t.triage;
        });

        const sessionsMap: Record<string, number> = {};
        const todayISO = new Date().toISOString().slice(0, 10);
        sessionDocs.forEach((s) => {
          if (!s.migrant_id) return;
          if (!userIds.includes(s.migrant_id)) return;
          if (!s.scheduled_date || s.scheduled_date < todayISO) return;
          sessionsMap[s.migrant_id] = (sessionsMap[s.migrant_id] || 0) + 1;
        });

        const progressMap: Record<string, number> = {};
        const agg: Record<string, { sum: number; count: number }> = {};
        progressDocs.forEach((p) => {
          if (!p.user_id || !userIds.includes(p.user_id)) return;
          const val = p.progress_percent || 0;
          const prev = agg[p.user_id] || { sum: 0, count: 0 };
          agg[p.user_id] = { sum: prev.sum + val, count: prev.count + 1 };
        });
        Object.keys(agg).forEach((uid) => {
          const a = agg[uid];
          progressMap[uid] = Math.round(a.count ? a.sum / a.count : 0);
        });

        const blockedRaw = localStorage.getItem('blockedMigrants');
        const blockedSet = new Set<string>(blockedRaw ? JSON.parse(blockedRaw) as string[] : []);

        const result: Array<MigrantRow> = profileList.map(p => ({
          user_id: p.user_id,
          name: profileMap[p.user_id]?.name || p.name || p.email || t.get('cpc.migrantsAdmin.fallback_migrant'),
          email: profileMap[p.user_id]?.email || p.email || '—',
          nif: p.nif || null,
          birth_date: profileMap[p.user_id]?.birthDate || null,
          nationality: profileMap[p.user_id]?.nationality || null,
          arrival_date: profileMap[p.user_id]?.arrivalDate || null,
          legal_status: triageMap[p.user_id]?.legal_status || null,
          work_status: triageMap[p.user_id]?.work_status || null,
          language_level: triageMap[p.user_id]?.language_level || null,
          urgencies: normalizeUrgencies(triageMap[p.user_id]?.urgencies),
          triage_answers: triageMap[p.user_id]?.answers || null,
          upcoming_sessions: sessionsMap[p.user_id] || 0,
          trails_progress_avg: progressMap[p.user_id] || 0,
          blocked: blockedSet.has(p.user_id),
        }));

        setRows(result);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : t.get('cpc.migrantsAdmin.load.generic_error');
        toast({
          title: t.get('cpc.migrantsAdmin.load.error_title'),
          description: message,
          variant: 'destructive',
        });
        setRows([]);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  function toggleBlock(uid: string) {
    const blockedRaw = localStorage.getItem('blockedMigrants');
    const blockedList = blockedRaw ? JSON.parse(blockedRaw) as string[] : [];
    const set = new Set<string>(blockedList);
    if (set.has(uid)) set.delete(uid); else set.add(uid);
    localStorage.setItem('blockedMigrants', JSON.stringify(Array.from(set)));
    setRows(prev => prev.map(r => r.user_id === uid ? { ...r, blocked: set.has(uid) } : r));
  }

  async function confirmDeleteMigrant() {
    if (!deleteTarget) return;
    const uid = deleteTarget.user_id;
    const name = deleteTarget.name || t.get('cpc.migrantsAdmin.fallback_migrant');
    const allowedRoles: Array<string> = ['admin', 'manager', 'coordinator'];
    if (!profile || !allowedRoles.includes(profile.role)) {
      toast({
        title: t.get('cpc.migrantsAdmin.delete.no_permission.title'),
        description: t.get('cpc.migrantsAdmin.delete.no_permission.description'),
        variant: 'destructive',
      });
      return;
    }

    setDeletingUserId(uid);
    try {
      const [sessions, progress, applications] = await Promise.all([
        queryDocuments<{ id: string }>('sessions', [{ field: 'migrant_id', operator: '==', value: uid }]),
        queryDocuments<{ id: string }>('user_trail_progress', [{ field: 'user_id', operator: '==', value: uid }]),
        queryDocuments<{ id: string }>('job_applications', [{ field: 'applicant_id', operator: '==', value: uid }]),
      ]);

      await Promise.all([
        ...sessions.map((s) => deleteDocument('sessions', s.id)),
        ...progress.map((p) => deleteDocument('user_trail_progress', p.id)),
        ...applications.map((a) => deleteDocument('job_applications', a.id)),
      ]);

      await Promise.all([
        deleteDocument('triage', uid),
        deleteDocument('profiles', uid),
        deleteDocument('users', uid),
      ]);

      const stillExists = await getDocument<{ id: string }>('users', uid);
      if (stillExists) {
        throw new Error(t.get('cpc.migrantsAdmin.delete.error.not_persisted'));
      }

      const blockedRaw = localStorage.getItem('blockedMigrants');
      if (blockedRaw) {
        const blockedList = JSON.parse(blockedRaw) as string[];
        const next = blockedList.filter((id) => id !== uid);
        localStorage.setItem('blockedMigrants', JSON.stringify(next));
      }

      setRows((prev) => prev.filter((r) => r.user_id !== uid));
      setSelectedTriage((prev) => (prev?.user_id === uid ? null : prev));

      toast({
        title: t.get('cpc.migrantsAdmin.delete.success.title'),
        description: t.get('cpc.migrantsAdmin.delete.success.description', { name }),
      });
      setDeleteTarget(null);
    } catch (error: unknown) {
      const rawMessage = error instanceof Error ? error.message : '';
      const message = rawMessage.includes('Missing or insufficient permissions')
        ? t.get('cpc.migrantsAdmin.delete.error.permission_denied')
        : rawMessage || t.get('cpc.migrantsAdmin.delete.error.generic');
      toast({
        title: t.get('cpc.migrantsAdmin.delete.error.title'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setDeletingUserId(null);
    }
  }

  const filtered = useMemo(() => {
    return rows.filter(r => {
      const matchQuery = query.trim().length === 0 || r.name.toLowerCase().includes(query.toLowerCase());
      const matchLegal = legalFilter === 'all' || normalizeLegalStatus(r.legal_status) === legalFilter;
      const matchWork = workFilter === 'all' || normalizeWorkStatus(r.work_status) === workFilter;
      const matchLang = langFilter === 'all' || normalizeLanguageLevel(r.language_level) === langFilter;
      const matchUrg = urgencyFilter === 'all' || normalizeUrgencies(r.urgencies).includes(urgencyFilter);
      return matchQuery && matchLegal && matchWork && matchLang && matchUrg;
    });
  }, [rows, query, legalFilter, workFilter, langFilter, urgencyFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><Users className="h-7 w-7 text-primary" /> {t.get('cpc.migrantsAdmin.title')}</h1>
          <p className="text-muted-foreground mt-1">{t.get('cpc.migrantsAdmin.subtitle')}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="gap-2" disabled={exporting !== null}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {t.get('cpc.migrantsAdmin.export.button')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={exporting !== null} onSelect={() => void handleExport('csv')}>
              <FileText className="h-4 w-4 mr-2" />
              {t.get('cpc.migrantsAdmin.export.formats.csv')}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={exporting !== null} onSelect={() => void handleExport('xlsx')}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              {t.get('cpc.migrantsAdmin.export.formats.xlsx')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="cpc-card p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <Label>{t.get('cpc.migrantsAdmin.filters.search.label')}</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.get('cpc.migrantsAdmin.filters.search.placeholder')} />
              <Button variant="outline" className="gap-2"><Filter className="h-4 w-4" /> {t.get('cpc.migrantsAdmin.filters.search.action')}</Button>
            </div>
          </div>
          <div>
            <Label>{t.get('cpc.migrantsAdmin.filters.legal.label')}</Label>
            <Select value={legalFilter} onValueChange={(v) => setLegalFilter(v as typeof legalFilter)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.get('cpc.migrantsAdmin.filters.legal.all')}</SelectItem>
                <SelectItem value="regular">{t.get('cpc.migrantsAdmin.legal.regular')}</SelectItem>
                <SelectItem value="irregular">{t.get('cpc.migrantsAdmin.legal.irregular')}</SelectItem>
                <SelectItem value="pendente">{t.get('cpc.migrantsAdmin.legal.pending')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t.get('cpc.migrantsAdmin.filters.work.label')}</Label>
            <Select value={workFilter} onValueChange={(v) => setWorkFilter(v as typeof workFilter)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.get('cpc.migrantsAdmin.filters.work.all')}</SelectItem>
                <SelectItem value="empregado">{t.get('cpc.migrantsAdmin.work.employed')}</SelectItem>
                <SelectItem value="desempregado">{t.get('cpc.migrantsAdmin.work.unemployed')}</SelectItem>
                <SelectItem value="informal">{t.get('cpc.migrantsAdmin.work.informal')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t.get('cpc.migrantsAdmin.filters.language.label')}</Label>
            <Select value={langFilter} onValueChange={(v) => setLangFilter(v as typeof langFilter)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.get('cpc.migrantsAdmin.filters.language.all')}</SelectItem>
                <SelectItem value="iniciante">{t.get('cpc.migrantsAdmin.language.beginner')}</SelectItem>
                <SelectItem value="intermediario">{t.get('cpc.migrantsAdmin.language.intermediate')}</SelectItem>
                <SelectItem value="avancado">{t.get('cpc.migrantsAdmin.language.advanced')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t.get('cpc.migrantsAdmin.filters.urgencies.label')}</Label>
            <Select value={urgencyFilter} onValueChange={(v) => setUrgencyFilter(v as typeof urgencyFilter)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.get('cpc.migrantsAdmin.filters.urgencies.all')}</SelectItem>
                <SelectItem value="juridico">{t.get('cpc.migrantsAdmin.urgencies.legal')}</SelectItem>
                <SelectItem value="psicologico">{t.get('cpc.migrantsAdmin.urgencies.psychological')}</SelectItem>
                <SelectItem value="habitacional">{t.get('cpc.migrantsAdmin.urgencies.housing')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="cpc-card p-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold mb-2">{t.get('cpc.migrantsAdmin.empty.title')}</h3>
          <p className="text-muted-foreground">{t.get('cpc.migrantsAdmin.empty.subtitle')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(r => (
            <div key={r.user_id} className="cpc-card p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold">{r.name}</h3>
                    {r.blocked ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">{t.get('cpc.migrantsAdmin.badges.blocked')}</span>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{r.email}</p>
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 mt-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><CheckCircle className="h-4 w-4" /> {legalLabel(r.legal_status)}</span>
                    <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {workLabel(r.work_status)}</span>
                    <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {languageLabel(r.language_level)}</span>
                    <span className="flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> {t.get('cpc.migrantsAdmin.stats.urgencies', { count: (r.urgencies || []).length })}</span>
                    <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {t.get('cpc.migrantsAdmin.stats.upcoming_sessions', { count: r.upcoming_sessions || 0 })}</span>
                    <span className="flex items-center gap-1"><CheckCircle className="h-4 w-4" /> {t.get('cpc.migrantsAdmin.stats.avg_progress', { count: r.trails_progress_avg || 0 })}</span>
                  </div>
                </div>
                <div className="flex flex-col items-stretch gap-2">
                  <Link to={`/dashboard/cpc/migrantes/${r.user_id}/perfil`} className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-md border text-sm hover:bg-muted"><Eye className="h-4 w-4" /> {t.get('cpc.migrantsAdmin.actions.view_profile')}</Link>
                  <Button variant="outline" className="inline-flex items-center justify-center gap-2 w-full" onClick={() => setSelectedTriage(r)}>
                    <ClipboardList className="h-4 w-4" /> {t.get('cpc.migrantsAdmin.actions.triage')}
                  </Button>
                  <Button variant="outline" className="inline-flex items-center justify-center gap-2 w-full" onClick={() => toggleBlock(r.user_id)}>
                    <Ban className="h-4 w-4" /> {r.blocked ? t.get('cpc.migrantsAdmin.actions.activate') : t.get('cpc.migrantsAdmin.actions.block')}
                  </Button>
                  <Button
                    variant="destructive"
                    className="inline-flex items-center justify-center gap-2 w-full"
                    onClick={() => setDeleteTarget(r)}
                    disabled={deletingUserId !== null}
                  >
                    {deletingUserId === r.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    {t.get('cpc.migrantsAdmin.actions.delete')}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!selectedTriage} onOpenChange={(open) => { if (!open) setSelectedTriage(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t.get('cpc.migrantsAdmin.triageDialog.title', { name: selectedTriage?.name || t.get('cpc.migrantsAdmin.fallback_migrant') })}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            {(selectedTriage?.triage_answers && Object.keys(selectedTriage.triage_answers).length > 0) ? (
              <div className="space-y-3">
                {Object.entries(selectedTriage.triage_answers).map(([key, value]) => (
                  <div key={key} className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{answerLabel(key)}</p>
                    <p className="text-sm font-medium break-words">{answerValue(key, value)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border p-6 text-sm text-muted-foreground text-center">
                {t.get('cpc.migrantsAdmin.triageDialog.empty')}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t.get('cpc.migrantsAdmin.delete.confirm.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t.get('cpc.migrantsAdmin.delete.confirm.description', { name: deleteTarget?.name || t.get('cpc.migrantsAdmin.fallback_migrant') })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingUserId !== null}>
              {t.get('cpc.migrantsAdmin.delete.buttons.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDeleteMigrant()} disabled={deletingUserId !== null}>
              {t.get('cpc.migrantsAdmin.delete.buttons.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
