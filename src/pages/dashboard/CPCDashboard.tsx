import { Link, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Users,
  Calendar,
  BookOpen,
  Briefcase,
  AlertCircle,
  TrendingUp,
  Clock,
  ChevronRight,
  Download,
  FileText,
  ArrowUp,
  ArrowDown,
  Filter,
} from 'lucide-react';

export default function CPCDashboard() {
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');
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
  const [recentMigrants, setRecentMigrants] = useState<Array<{ id: string; name: string; status: string; urgency: boolean; date: string }>>([]);
  const [todaySessions, setTodaySessions] = useState<Array<{ id: string; migrant: string; type: string; time: string; status: string }>>([]);
  const [messagesPending, setMessagesPending] = useState(0);

  function CandidaturasDetalhadas() {
    const [loadingList, setLoadingList] = useState(true);
    const [rows, setRows] = useState<Array<{ id: string; applicant: string; email: string; job: string; status: string; created_at: string }>>([]);
    useEffect(() => {
      async function fetchAll() {
        setLoadingList(true);
        try {
          const { data: apps } = await supabase
            .from('job_applications')
            .select('id, applicant_id, job_id, status, created_at')
            .order('created_at', { ascending: false });
          const applicantIds = Array.from(new Set((apps || []).map(a => a.applicant_id)));
          const jobIds = Array.from(new Set((apps || []).map(a => a.job_id)));
          type ProfileBasic = { user_id: string; name: string; email: string };
          type JobBasic = { id: string; title: string };
          const profilesData: ProfileBasic[] = applicantIds.length
            ? ((await supabase.from('profiles').select('user_id, name, email').in('user_id', applicantIds)).data || [])
            : [];
          const jobsData: JobBasic[] = jobIds.length
            ? ((await supabase.from('job_offers').select('id, title').in('id', jobIds)).data || [])
            : [];
          const pmap: Record<string, { name: string; email: string }> = {};
          profilesData.forEach(p => { pmap[p.user_id] = { name: p.name, email: p.email }; });
          const jmap: Record<string, { title: string }> = {};
          jobsData.forEach(j => { jmap[j.id] = { title: j.title }; });
          const out = (apps || []).map(a => ({
            id: a.id,
            applicant: pmap[a.applicant_id]?.name || a.applicant_id,
            email: pmap[a.applicant_id]?.email || '',
            job: jmap[a.job_id]?.title || a.job_id,
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
          const { data } = await supabase
            .from('job_offers')
            .select('id, title, location, created_at')
            .eq('status', 'pending_review')
            .order('created_at', { ascending: false });
          setRows((data || []) as Array<{ id: string; title: string; location: string | null; created_at: string }>);
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

        const [profilesRes, profiles7Res, profiles30Res, sessionsTodayRes, sessionsWeekRes, sessionsCompletedRes, companiesRes, offersActiveRes, offersPendingRes, applicationsRes, progressRes, triageRes, migrantsPeriodRes, migrantsPrevRes, sessionsPeriodRes, sessionsPrevRes, applicationsPeriodRes, applicationsPrevRes] = await Promise.all([
          supabase.from('profiles').select('user_id', { count: 'estimated', head: true }).eq('role', 'migrant'),
          supabase.from('profiles').select('user_id', { count: 'estimated', head: true }).eq('role', 'migrant').gte('created_at', sevenDaysAgo.toISOString()),
          supabase.from('profiles').select('user_id', { count: 'estimated', head: true }).eq('role', 'migrant').gte('created_at', thirtyDaysAgo.toISOString()),
          supabase.from('sessions').select('id', { count: 'estimated', head: true }).eq('status', 'Agendada').eq('scheduled_date', todayISO),
          supabase.from('sessions').select('id').eq('status', 'Agendada').gte('scheduled_date', weekStart.toISOString().slice(0,10)).lte('scheduled_date', weekEnd.toISOString().slice(0,10)),
          supabase.from('sessions').select('id', { count: 'estimated', head: true }).eq('status', 'Concluída'),
          supabase.from('companies').select('id', { count: 'estimated', head: true }),
          supabase.from('job_offers').select('id', { count: 'estimated', head: true }).eq('status', 'active'),
          supabase.from('job_offers').select('id', { count: 'estimated', head: true }).eq('status', 'pending_review'),
          supabase.from('job_applications').select('id', { count: 'estimated', head: true }),
          supabase.from('user_trail_progress').select('progress_percent'),
          supabase.from('triage').select('user_id, urgencies'),
          supabase.from('profiles').select('user_id', { count: 'estimated', head: true }).eq('role', 'migrant').gte('created_at', periodStartISO).lte('created_at', periodEndISO),
          supabase.from('profiles').select('user_id', { count: 'estimated', head: true }).eq('role', 'migrant').gte('created_at', prevStartISO).lte('created_at', prevEndISO),
          supabase.from('sessions').select('id', { count: 'estimated', head: true }).eq('status', 'Agendada').gte('scheduled_date', periodStartISO).lte('scheduled_date', periodEndISO),
          supabase.from('sessions').select('id', { count: 'estimated', head: true }).eq('status', 'Agendada').gte('scheduled_date', prevStartISO).lte('scheduled_date', prevEndISO),
          supabase.from('job_applications').select('id', { count: 'estimated', head: true }).gte('created_at', periodStartISO).lte('created_at', periodEndISO),
          supabase.from('job_applications').select('id', { count: 'estimated', head: true }).gte('created_at', prevStartISO).lte('created_at', prevEndISO)
        ]);

        setMigrantsTotal(profilesRes.count || 0);
        setMigrantsNew7(profiles7Res.count || 0);
        setMigrantsNew30(profiles30Res.count || 0);
        setMigrantsPeriodNew(migrantsPeriodRes.count || 0);
        setMigrantsPrevNew(migrantsPrevRes.count || 0);
        setSessionsTodayCount(sessionsTodayRes.count || 0);
        setSessionsCompletedCount(sessionsCompletedRes.count || 0);
        setCompaniesTotal(companiesRes.count || 0);
        setJobOffersActive(offersActiveRes.count || 0);
        setJobOffersPendingApproval(offersPendingRes.count || 0);
        setApplicationsTotal(applicationsRes.count || 0);
        setSessionsPeriodCount(sessionsPeriodRes.count || 0);
        setSessionsPrevCount(sessionsPrevRes.count || 0);
        setApplicationsPeriodCount(applicationsPeriodRes.count || 0);
        setApplicationsPrevCount(applicationsPrevRes.count || 0);

        const weekList = (sessionsWeekRes.data || []) as Array<{ id: string }>;
        setSessionsWeekCount(weekList.length);

        const progressValues = ((progressRes.data || []) as Array<{ progress_percent: number | null }>).map(p => p.progress_percent || 0);
        const avg = progressValues.length ? Math.round(progressValues.reduce((a,b)=>a+b,0) / progressValues.length) : 0;
        setAvgProgress(avg);

        const triages = (triageRes.data || []) as Array<{ user_id: string; urgencies: string[] | null }>;
        const agg = { juridico: 0, psicologico: 0, habitacional: 0 };
        triages.forEach(t => {
          (t.urgencies || []).forEach(u => {
            if (u === 'juridico') agg.juridico += 1;
            if (u === 'psicologico') agg.psicologico += 1;
            if (u === 'habitacional') agg.habitacional += 1;
          });
        });
        setUrgencies(agg);

        const { data: recentProfiles } = await supabase
          .from('profiles')
          .select('user_id, name')
          .eq('role', 'migrant')
          .order('created_at', { ascending: false })
          .limit(3);
        const recentTyped = (recentProfiles || []) as Array<{ user_id: string; name: string }>;
        const recentList = recentTyped.map(p => ({ id: p.user_id, name: p.name, status: '—', urgency: false, date: new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }) }));
        setRecentMigrants(recentList);

        const { data: todaySess } = await supabase
          .from('sessions')
          .select('id, session_type, scheduled_time, status, migrant_id')
          .eq('scheduled_date', todayISO)
          .order('scheduled_time', { ascending: true });
        const todaySessTyped = (todaySess || []) as Array<{ id: string; session_type: string; scheduled_time: string; status: string | null; migrant_id: string }>; 
        const migrantIds = Array.from(new Set(todaySessTyped.map(s => s.migrant_id).filter(Boolean)));
        const migrantMap: Record<string, string> = {};
        if (migrantIds.length) {
          const { data: migProfiles } = await supabase
            .from('profiles')
            .select('user_id, name')
            .in('user_id', migrantIds);
          const migTyped = (migProfiles || []) as Array<{ user_id: string; name: string }>;
          migTyped.forEach(p => { migrantMap[p.user_id] = p.name; });
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
          const rawMsgs = localStorage.getItem('cpcMessagesPending');
          setMessagesPending(rawMsgs ? Number(rawMsgs) || 0 : 0);
        } catch { setMessagesPending(0); }
      } finally {
        setLoading(false);
      }
    }
    fetchOverview();
  }, [period]);

  const periodLabel = useMemo(() => period === 'today' ? 'Hoje' : period === 'week' ? 'Semana' : 'Mês', [period]);
  const migrantsDelta = migrantsPeriodNew - migrantsPrevNew;
  const sessionsDelta = sessionsPeriodCount - sessionsPrevCount;
  const applicationsDelta = applicationsPeriodCount - applicationsPrevCount;

  type StatItem = { label: string; value: number; icon: React.ComponentType<unknown>; change: string; delta?: number; linkTo?: string };
  const stats: StatItem[] = useMemo(() => ([
    { label: 'Migrantes Ativos', value: migrantsTotal, icon: Users, change: `+${migrantsPeriodNew} no período`, delta: migrantsDelta },
    { label: 'Sessões', value: period === 'today' ? sessionsTodayCount : sessionsPeriodCount, icon: Calendar, change: `${sessionsWeekCount} na semana`, delta: sessionsDelta },
    { label: 'Candidaturas enviadas', value: applicationsPeriodCount, icon: FileText, change: `Total: ${applicationsTotal}`, delta: applicationsDelta, linkTo: 'candidaturas' },
    { label: 'Ofertas Ativas', value: jobOffersActive, icon: Briefcase, change: `${jobOffersPendingApproval} em aprovação`, delta: 0 },
    { label: 'Ofertas aguardando aprovação', value: jobOffersPendingApproval, icon: Briefcase, change: '—', delta: 0, linkTo: 'ofertas' },
    { label: 'Mensagens pendentes', value: messagesPending, icon: AlertCircle, change: '—', delta: 0 },
  ]), [period, migrantsTotal, migrantsPeriodNew, migrantsDelta, sessionsTodayCount, sessionsPeriodCount, sessionsWeekCount, sessionsDelta, applicationsPeriodCount, applicationsTotal, applicationsDelta, jobOffersActive, jobOffersPendingApproval, messagesPending]);

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

  function exportCSV() {
    const headers = ['Indicador', 'Valor', 'Detalhe'];
    const rows = stats.map(s => [s.label, String(s.value), s.change]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cpc-dashboard-${periodLabel.toLowerCase()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportPDF() {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Export</title><style>body{font-family:system-ui;padding:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px}th{background:#f5f5f5;text-align:left}</style></head><body><h1>Painel CPC (${periodLabel})</h1><table><thead><tr><th>Indicador</th><th>Valor</th><th>Detalhe</th></tr></thead><tbody>${stats.map(s=>`<tr><td>${s.label}</td><td>${s.value}</td><td>${s.change}</td></tr>`).join('')}</tbody></table></body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.print();
    }
  }

  return (
    <Layout>
      <div className="cpc-section">
        <div className="cpc-container">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                Painel CPC
              </h1>
            <p className="text-muted-foreground mt-1">
              Bem-vindo(a), {profile?.name}
              </p>
            </div>
            <div className="flex gap-2 items-center">
              <div className="w-44">
                <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Hoje</SelectItem>
                    <SelectItem value="week">Semana</SelectItem>
                    <SelectItem value="month">Mês</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" onClick={exportCSV}>
                <Download className="mr-2 h-4 w-4" />
                Exportar CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportPDF}>
                <FileText className="mr-2 h-4 w-4" />
                Exportar PDF
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((stat) => (
              <div key={stat.label} className="cpc-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <stat.icon className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-2">
                    {stat.label === 'Pedidos Urgentes' && stat.value > 0 && (
                      <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                    )}
                    {stat.linkTo && (
                      <Link to={`/dashboard/cpc/${stat.linkTo}`} className="text-xs text-primary hover:underline">Ver detalhes</Link>
                    )}
                  </div>
                </div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <div className="flex items-center gap-2 mt-2">
                  <p className="text-xs text-primary">{stat.change}</p>
                  {typeof stat.delta === 'number' && stat.delta !== 0 && (
                    stat.delta > 0 ? (
                      <ArrowUp className="h-3 w-3 text-green-600" />
                    ) : (
                      <ArrowDown className="h-3 w-3 text-red-600" />
                    )
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Recent Migrants */}
            <div className="cpc-card p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-semibold flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Migrantes Recentes
                </h2>
                <Link to="/dashboard/cpc/migrantes" className="text-sm text-primary hover:underline">
                  Ver todos
                </Link>
              </div>

              <div className="space-y-3">
                {recentMigrants.map((migrant) => (
                  <Link
                    key={migrant.id}
                    to={`/dashboard/cpc/candidatos/${migrant.id}`}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-medium">
                        {migrant.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium flex items-center gap-2">
                          {migrant.name}
                          {migrant.urgency && (
                            <span className="w-2 h-2 rounded-full bg-destructive" />
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">{migrant.status}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{migrant.date}</span>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Today's Sessions */}
            <div className="cpc-card p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-semibold flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Sessões de Hoje
                </h2>
                <Link to="/dashboard/cpc/agenda" className="text-sm text-primary hover:underline">
                  Ver agenda
                </Link>
              </div>

              <div className="space-y-3">
                {todaySessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                        <Clock className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">{session.migrant}</p>
                        <p className="text-sm text-muted-foreground">{session.type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{session.time}</p>
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(session.status)}`}>
                        {session.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="cpc-card p-6 lg:col-span-2">
              <h2 className="font-semibold mb-6">Ações Rápidas</h2>
              <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
                <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                  <Users className="h-5 w-5" />
                  <span>Novo Migrante</span>
                </Button>
                <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                  <Calendar className="h-5 w-5" />
                  <span>Agendar Sessão</span>
                </Button>
                <Link to="/dashboard/cpc/trilhas">
                  <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                    <BookOpen className="h-5 w-5" />
                    <span>Gerir Trilhas</span>
                  </Button>
                </Link>
                <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                  <Briefcase className="h-5 w-5" />
                  <span>Ofertas Emprego</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
        <Routes>
          <Route path="candidatos/:candidateId" element={<CandidateProfilePage />} />
          <Route path="migrantes" element={<MigrantsAdminPage />} />
          <Route path="agenda" element={<TeamAgendaPage />} />
          <Route path="candidaturas" element={<CandidaturasDetalhadas />} />
          <Route path="ofertas" element={<OfertasAguardandoAprovacao />} />
        </Routes>
      </div>
    </Layout>
  );
}
import CandidateProfilePage from './company/CandidateProfilePage';
import MigrantsAdminPage from './cpc/MigrantsAdminPage';
import TeamAgendaPage from './cpc/TeamAgendaPage';
