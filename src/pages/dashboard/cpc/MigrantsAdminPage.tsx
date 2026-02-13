import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Users, Filter, Eye, Ban, CheckCircle, AlertTriangle, Clock } from 'lucide-react';

type MigrantRow = {
  user_id: string;
  name: string;
  email: string;
  legal_status?: string | null;
  work_status?: string | null;
  language_level?: string | null;
  urgencies?: string[] | null;
  upcoming_sessions?: number;
  trails_progress_avg?: number;
  blocked?: boolean;
};

export default function MigrantsAdminPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<MigrantRow>>([]);
  const [query, setQuery] = useState('');
  const [legalFilter, setLegalFilter] = useState<'all' | 'regular' | 'irregular' | 'pendente'>('all');
  const [workFilter, setWorkFilter] = useState<'all' | 'empregado' | 'desempregado' | 'informal'>('all');
  const [langFilter, setLangFilter] = useState<'all' | 'iniciante' | 'intermediario' | 'avancado'>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'juridico' | 'psicologico' | 'habitacional'>('all');

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      try {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, name, email')
          .eq('role', 'migrant')
          .order('created_at', { ascending: false });
        const profileList = (profiles || []) as Array<{ user_id: string; name: string; email: string }>;
        const userIds = profileList.map(p => p.user_id);

        const triageMap: Record<string, { legal_status?: string | null; work_status?: string | null; language_level?: string | null; urgencies?: string[] | null }> = {};
        if (userIds.length) {
          const { data: triages } = await supabase
            .from('triage')
            .select('user_id, legal_status, work_status, language_level, urgencies')
            .in('user_id', userIds);
          (triages || []).forEach(t => {
            const item = t as { user_id: string; legal_status?: string | null; work_status?: string | null; language_level?: string | null; urgencies?: string[] | null };
            triageMap[item.user_id] = { legal_status: item.legal_status, work_status: item.work_status, language_level: item.language_level, urgencies: item.urgencies };
          });
        }

        const sessionsMap: Record<string, number> = {};
        if (userIds.length) {
          const todayISO = new Date().toISOString().slice(0, 10);
          const { data: sess } = await supabase
            .from('sessions')
            .select('migrant_id')
            .in('migrant_id', userIds)
            .gte('scheduled_date', todayISO)
            .eq('status', 'Agendada');
          (sess || []).forEach(s => {
            const item = s as { migrant_id: string };
            sessionsMap[item.migrant_id] = (sessionsMap[item.migrant_id] || 0) + 1;
          });
        }

        const progressMap: Record<string, number> = {};
        if (userIds.length) {
          const { data: progress } = await supabase
            .from('user_trail_progress')
            .select('user_id, progress_percent')
            .in('user_id', userIds);
          const agg: Record<string, { sum: number; count: number }> = {};
          (progress || []).forEach(p => {
            const item = p as { user_id: string; progress_percent: number | null };
            const val = item.progress_percent || 0;
            const prev = agg[item.user_id] || { sum: 0, count: 0 };
            agg[item.user_id] = { sum: prev.sum + val, count: prev.count + 1 };
          });
          Object.keys(agg).forEach(uid => {
            const a = agg[uid];
            progressMap[uid] = Math.round(a.count ? a.sum / a.count : 0);
          });
        }

        const blockedRaw = localStorage.getItem('blockedMigrants');
        const blockedSet = new Set<string>(blockedRaw ? JSON.parse(blockedRaw) as string[] : []);

        const result: Array<MigrantRow> = profileList.map(p => ({
          user_id: p.user_id,
          name: p.name,
          email: p.email,
          legal_status: triageMap[p.user_id]?.legal_status || null,
          work_status: triageMap[p.user_id]?.work_status || null,
          language_level: triageMap[p.user_id]?.language_level || null,
          urgencies: triageMap[p.user_id]?.urgencies || [],
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
      const matchLegal = legalFilter === 'all' || (r.legal_status || '').toLowerCase() === legalFilter;
      const matchWork = workFilter === 'all' || (r.work_status || '').toLowerCase() === workFilter;
      const matchLang = langFilter === 'all' || (r.language_level || '').toLowerCase() === langFilter;
      const matchUrg = urgencyFilter === 'all' || (r.urgencies || []).includes(urgencyFilter);
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
                    <span className="flex items-center gap-1"><CheckCircle className="h-4 w-4" /> {r.legal_status || '—'}</span>
                    <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {r.work_status || '—'}</span>
                    <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {r.language_level || '—'}</span>
                    <span className="flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> {(r.urgencies || []).length} urgências</span>
                    <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {r.upcoming_sessions || 0} sessões futuras</span>
                    <span className="flex items-center gap-1"><CheckCircle className="h-4 w-4" /> {r.trails_progress_avg || 0}% progresso médio</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link to={`/dashboard/cpc/candidatos/${r.user_id}`} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm hover:bg-muted"><Eye className="h-4 w-4" /> Ver perfil</Link>
                  <Button variant="outline" className="inline-flex items-center gap-2" onClick={() => toggleBlock(r.user_id)}>
                    <Ban className="h-4 w-4" /> {r.blocked ? 'Ativar' : 'Bloquear'}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
