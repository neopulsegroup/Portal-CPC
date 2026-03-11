import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDocument, queryDocuments } from '@/integrations/firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, Filter, Eye, Ban, CheckCircle, AlertTriangle, Clock, ClipboardList } from 'lucide-react';

type TriageAnswers = Record<string, unknown>;

type MigrantRow = {
  user_id: string;
  name: string;
  email: string;
  legal_status?: string | null;
  work_status?: string | null;
  language_level?: string | null;
  urgencies?: string[] | null;
  triage_answers?: TriageAnswers | null;
  upcoming_sessions?: number;
  trails_progress_avg?: number;
  blocked?: boolean;
};

type UserDoc = { id: string; name?: string | null; email?: string | null; role?: string | null };
type ProfileDoc = { name?: string | null; email?: string | null };
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

function legalLabel(value?: string | null): string {
  const normalized = normalizeLegalStatus(value);
  if (normalized === 'regular') return 'Regular';
  if (normalized === 'irregular') return 'Irregular';
  if (normalized === 'pendente') return 'Pendente';
  return '—';
}

function workLabel(value?: string | null): string {
  const normalized = normalizeWorkStatus(value);
  if (normalized === 'empregado') return 'Empregado';
  if (normalized === 'desempregado') return 'Desempregado';
  if (normalized === 'informal') return 'Informal';
  return '—';
}

function languageLabel(value?: string | null): string {
  const normalized = normalizeLanguageLevel(value);
  if (normalized === 'iniciante') return 'Iniciante';
  if (normalized === 'intermediario') return 'Intermediário';
  if (normalized === 'avancado') return 'Avançado';
  return '—';
}

function answerValue(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => String(item)).join(', ');
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default function MigrantsAdminPage() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<MigrantRow>>([]);
  const [query, setQuery] = useState('');
  const [legalFilter, setLegalFilter] = useState<'all' | 'regular' | 'irregular' | 'pendente'>('all');
  const [workFilter, setWorkFilter] = useState<'all' | 'empregado' | 'desempregado' | 'informal'>('all');
  const [langFilter, setLangFilter] = useState<'all' | 'iniciante' | 'intermediario' | 'avancado'>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'juridico' | 'psicologico' | 'habitacional'>('all');
  const [selectedTriage, setSelectedTriage] = useState<MigrantRow | null>(null);

  function answerLabel(key: string): string {
    const path = `triage.questions.${key}`;
    const translated = t.get(path);
    if (translated !== path) return translated;
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (m) => m.toUpperCase());
  }

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      try {
        const migrants = await queryDocuments<UserDoc>('users', [{ field: 'role', operator: '==', value: 'migrant' }]);
        const profileList = migrants.map((u) => ({ user_id: u.id, name: u.name || '', email: u.email || '' }));
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
          name: profileMap[p.user_id]?.name || p.name || p.email || 'Migrante',
          email: profileMap[p.user_id]?.email || p.email || '—',
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
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><Users className="h-7 w-7 text-primary" /> Migrantes</h1>
          <p className="text-muted-foreground mt-1">Lista completa com filtros e acesso ao perfil</p>
        </div>
      </div>

      <div className="cpc-card p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <Label>Pesquisa</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nome" />
              <Button variant="outline" className="gap-2"><Filter className="h-4 w-4" /> Filtrar</Button>
            </div>
          </div>
          <div>
            <Label>Situação legal</Label>
            <Select value={legalFilter} onValueChange={(v) => setLegalFilter(v as typeof legalFilter)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="regular">Regular</SelectItem>
                <SelectItem value="irregular">Irregular</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Situação laboral</Label>
            <Select value={workFilter} onValueChange={(v) => setWorkFilter(v as typeof workFilter)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="empregado">Empregado</SelectItem>
                <SelectItem value="desempregado">Desempregado</SelectItem>
                <SelectItem value="informal">Informal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nível de língua</Label>
            <Select value={langFilter} onValueChange={(v) => setLangFilter(v as typeof langFilter)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="iniciante">Iniciante</SelectItem>
                <SelectItem value="intermediario">Intermediário</SelectItem>
                <SelectItem value="avancado">Avançado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Urgências</Label>
            <Select value={urgencyFilter} onValueChange={(v) => setUrgencyFilter(v as typeof urgencyFilter)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="juridico">Jurídico</SelectItem>
                <SelectItem value="psicologico">Psicológico</SelectItem>
                <SelectItem value="habitacional">Habitacional</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="cpc-card p-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold mb-2">Sem migrantes encontrados</h3>
          <p className="text-muted-foreground">Ajuste os filtros ou a pesquisa.</p>
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
                      <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">Bloqueado</span>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{r.email}</p>
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 mt-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><CheckCircle className="h-4 w-4" /> {legalLabel(r.legal_status)}</span>
                    <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {workLabel(r.work_status)}</span>
                    <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {languageLabel(r.language_level)}</span>
                    <span className="flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> {(r.urgencies || []).length} urgências</span>
                    <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {r.upcoming_sessions || 0} sessões futuras</span>
                    <span className="flex items-center gap-1"><CheckCircle className="h-4 w-4" /> {r.trails_progress_avg || 0}% progresso médio</span>
                  </div>
                </div>
                <div className="flex flex-col items-stretch gap-2">
                  <Link to={`/dashboard/cpc/candidatos/${r.user_id}`} className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-md border text-sm hover:bg-muted"><Eye className="h-4 w-4" /> Ver perfil</Link>
                  <Button variant="outline" className="inline-flex items-center justify-center gap-2 w-full" onClick={() => setSelectedTriage(r)}>
                    <ClipboardList className="h-4 w-4" /> Triagem Inicial
                  </Button>
                  <Button variant="outline" className="inline-flex items-center justify-center gap-2 w-full" onClick={() => toggleBlock(r.user_id)}>
                    <Ban className="h-4 w-4" /> {r.blocked ? 'Ativar' : 'Bloquear'}
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
            <DialogTitle>Triagem Inicial — {selectedTriage?.name || 'Migrante'}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            {(selectedTriage?.triage_answers && Object.keys(selectedTriage.triage_answers).length > 0) ? (
              <div className="space-y-3">
                {Object.entries(selectedTriage.triage_answers).map(([key, value]) => (
                  <div key={key} className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{answerLabel(key)}</p>
                    <p className="text-sm font-medium break-words">{answerValue(value)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border p-6 text-sm text-muted-foreground text-center">
                Este migrante ainda não possui respostas registradas da triagem inicial.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
