import { Routes, Route, Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Calendar,
  BookOpen,
  Briefcase,
  User,
  ChevronRight,
  Clock,
  ArrowRight,
  Bell,
  AlertTriangle,
  MessageCircle,
  FileText,
  Settings,
  ClipboardList,
  ShieldCheck,
  CheckCircle,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

// Sub-pages
import TrailsPage from './migrant/TrailsPage';
import TrailDetailPage from './migrant/TrailDetailPage';
import ModuleViewerPage from './migrant/ModuleViewerPage';
import JobsPage from './migrant/JobsPage';
import JobDetailPage from './migrant/JobDetailPage';
import ProfilePage from './migrant/ProfilePage';

function MigrantHome() {
  const { t } = useLanguage();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Array<{ id: string; session_type: string; scheduled_date: string; scheduled_time: string; status: string | null }>>([]);
  const [progress, setProgress] = useState<Array<{ trail_id: string; progress_percent: number | null; modules_completed: number | null; completed_at: string | null }>>([]);
  const [trails, setTrails] = useState<Record<string, { id: string; title: string; modules_count: number | null }>>({});
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; body: string; date: string; type?: string }>>([]);
  const [triage, setTriage] = useState<{ legal_status?: string | null; work_status?: string | null; language_level?: string | null; interests?: string[] | null; urgencies?: string[] | null } | null>(null);
  const [bookOpen, setBookOpen] = useState(false);
  const [bookType, setBookType] = useState<'mediador' | 'jurista' | 'psicologa'>('mediador');
  const [bookDate, setBookDate] = useState('');
  const [bookTime, setBookTime] = useState('');
  const [urgentOpen, setUrgentOpen] = useState(false);
  const [urgentType, setUrgentType] = useState<'juridico' | 'psicologico' | 'habitacional' | 'necessidades'>('juridico');
  const [urgentDesc, setUrgentDesc] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; text: string; date: string; from: 'migrante' | 'cpc' }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [extras, setExtras] = useState<{ nationality?: string; originCountry?: string; arrivalDate?: string; skills?: string; languagesList?: string; mainNeeds?: string; professionalTitle?: string; professionalExperience?: string; contactPreference?: 'email' | 'phone' } | null>(null);
  const [accessibility, setAccessibility] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem('cpc-accessibility');
      return raw === 'true';
    } catch { return false; }
  });

  useEffect(() => {
    async function fetchAll() {
      if (!user) return;
      setLoading(true);
      try {
        const [sessionsRes, progressRes, triRes] = await Promise.all([
          supabase.from('sessions').select('id, session_type, scheduled_date, scheduled_time, status').eq('migrant_id', user.id),
          supabase.from('user_trail_progress').select('trail_id, progress_percent, modules_completed, completed_at').eq('user_id', user.id),
          supabase.from('triage').select('legal_status, work_status, language_level, interests, urgencies').eq('user_id', user.id).maybeSingle(),
        ]);
        setSessions(sessionsRes.data || []);
        const prog = (progressRes.data || []) as Array<{ trail_id: string; progress_percent: number | null; modules_completed: number | null; completed_at: string | null }>;
        setProgress(prog);
        if (triRes.data) setTriage(triRes.data as typeof triage);
        const trailIds = Array.from(new Set(prog.map(p => p.trail_id).filter(Boolean)));
        if (trailIds.length > 0) {
          const { data: trailsRes } = await supabase.from('trails').select('id, title, modules_count').in('id', trailIds);
          const map: Record<string, { id: string; title: string; modules_count: number | null }> = {};
          const trailsResData = (trailsRes || []) as Array<{ id: string; title: string; modules_count: number | null }>;
          trailsResData.forEach(t => { map[t.id] = t; });
          setTrails(map);
        } else {
          setTrails({});
        }
        try {
          const rawNotif = localStorage.getItem(`notifications:${user.id}`);
          setNotifications(rawNotif ? JSON.parse(rawNotif) : []);
        } catch { setNotifications([]); }
        try {
          const rawExtras = localStorage.getItem(`profileExtras:${user.id}`);
          setExtras(rawExtras ? JSON.parse(rawExtras) : null);
        } catch { setExtras(null); }
        try {
          const rawChat = localStorage.getItem(`chat:${user.id}`);
          setChatMessages(rawChat ? JSON.parse(rawChat) : []);
        } catch { setChatMessages([]); }
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, [user]);

  const upcomingSessions = useMemo(() => {
    const now = new Date().toISOString().slice(0,10);
    return sessions.filter(s => s.scheduled_date >= now).sort((a,b) => a.scheduled_date.localeCompare(b.scheduled_date));
  }, [sessions]);

  const trailsProgressAvg = useMemo(() => {
    const values = progress.map(p => p.progress_percent || 0);
    if (values.length === 0) return 0;
    return Math.round(values.reduce((a,b)=>a+b,0) / values.length);
  }, [progress]);

  const sessionsProgress = useMemo(() => {
    const count = sessions.length;
    const percent = Math.min(100, Math.round((count / 5) * 100));
    return percent;
  }, [sessions]);

  const profileCompleteness = useMemo(() => {
    const fields = [extras?.nationality, extras?.originCountry, extras?.arrivalDate, extras?.skills, extras?.languagesList, extras?.mainNeeds, extras?.professionalTitle, extras?.professionalExperience, extras?.contactPreference, profile?.phone, profile?.name];
    const filled = fields.filter(v => !!v && String(v).trim().length > 0).length;
    const percent = Math.round((filled / fields.length) * 100);
    return percent;
  }, [extras, profile]);

  const overallProgress = useMemo(() => {
    const parts = [trailsProgressAvg, sessionsProgress, profileCompleteness];
    return Math.round(parts.reduce((a,b)=>a+b,0) / parts.length);
  }, [trailsProgressAvg, sessionsProgress, profileCompleteness]);

  const suggestedActions = useMemo(() => {
    const actions: Array<{ label: string; href: string }> = [];
    if (!extras?.professionalExperience || !extras?.professionalTitle) actions.push({ label: 'Completar CV', href: '/dashboard/migrante/perfil' });
    if (progress.length === 0) actions.push({ label: 'Iniciar trilha formativa', href: '/dashboard/migrante/trilhas' });
    if (upcomingSessions.length === 0) actions.push({ label: 'Marcar sessão', href: '#' });
    return actions;
  }, [extras, progress, upcomingSessions.length]);

  async function bookSession() {
    if (!user || !bookDate || !bookTime) return;
    await supabase.from('sessions').insert({ migrant_id: user.id, session_type: bookType, scheduled_date: bookDate, scheduled_time: bookTime, status: 'Agendada' });
    setBookOpen(false);
    const { data } = await supabase.from('sessions').select('id, session_type, scheduled_date, scheduled_time, status').eq('migrant_id', user.id);
    setSessions(data || []);
  }

  function addUrgentRequest() {
    if (!user || !urgentDesc) return;
    const req: { id: string; type: typeof urgentType; description: string; status: string; date: string } = { id: String(Date.now()), type: urgentType, description: urgentDesc, status: 'submetido', date: new Date().toISOString() };
    try {
      const raw = localStorage.getItem(`urgentRequests:${user.id}`);
      const list = raw ? (JSON.parse(raw) as Array<{ id: string; type: typeof urgentType; description: string; status: string; date: string }>) : [];
      const next = [req, ...list];
      localStorage.setItem(`urgentRequests:${user.id}`, JSON.stringify(next));
    } catch { void 0; }
    setUrgentOpen(false);
    setUrgentDesc('');
  }

  function sendChat() {
    if (!user || !chatInput.trim()) return;
    const msg = { id: String(Date.now()), text: chatInput.trim(), date: new Date().toISOString(), from: 'migrante' as const };
    const next = [msg, ...chatMessages];
    setChatMessages(next);
    localStorage.setItem(`chat:${user.id}`, JSON.stringify(next));
    setChatInput('');
  }

  useEffect(() => {
    if (accessibility) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
    try { localStorage.setItem('cpc-accessibility', accessibility ? 'true' : 'false'); } catch { void 0; }
  }, [accessibility]);

  const navItems = [
    { icon: Calendar, label: t.dashboard.sessions, href: '/dashboard/migrante/sessoes', count: upcomingSessions.length },
    { icon: BookOpen, label: t.dashboard.trails, href: '/dashboard/migrante/trilhas' },
    { icon: Briefcase, label: t.dashboard.employment, href: '/dashboard/migrante/emprego' },
    { icon: User, label: t.dashboard.profile, href: '/dashboard/migrante/perfil' },
  ];

  if (loading) {
    return (
      <div className="py-12 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold">Bem-vindo(a), {profile?.name}!</h1>
        <p className="text-muted-foreground mt-1">Resumo personalizado da sua integração</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {navItems.map((item) => (
          <Link key={item.label} to={item.href} className="cpc-card p-4 flex flex-col items-center text-center hover:border-primary/50 transition-colors">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                <item.icon className="h-6 w-6" />
              </div>
              {item.count ? (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">{item.count}</span>
              ) : null}
            </div>
            <span className="text-sm font-medium">{item.label}</span>
          </Link>
        ))}
      </div>

      <div className="grid xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="cpc-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Visão Geral</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Perfil de necessidades</p>
                <div className="mt-2 text-sm">
                  <span className="font-medium">Urgências:</span> {(triage?.urgencies || []).join(', ') || '—'}
                </div>
                <div className="mt-1 text-sm">
                  <span className="font-medium">Interesses:</span> {(triage?.interests || []).join(', ') || '—'}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Progresso Geral</p>
                <div className="mt-2">
                  <Progress value={overallProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-2">Trilhas {trailsProgressAvg}% • Sessões {sessionsProgress}% • Perfil {profileCompleteness}%</p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {suggestedActions.map(a => (
                <Link key={a.label} to={a.href} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm hover:bg-muted"><ClipboardList className="h-4 w-4" />{a.label}</Link>
              ))}
              <Button variant="outline" size="sm" onClick={() => setBookOpen(true)}><Calendar className="h-4 w-4 mr-2" />Marcar sessão</Button>
            </div>
            <div className="mt-6">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Bell className="h-4 w-4" /> Notificações importantes</h3>
              {notifications.length > 0 ? (
                <div className="space-y-3 mt-2">
                  {notifications.slice(0,4).map(n => (
                    <div key={n.id} className="p-3 rounded-lg bg-muted/50 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{n.title}</p>
                        <p className="text-xs text-muted-foreground">{n.body}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{new Date(n.date).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-2">Sem notificações</p>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="cpc-card p-6">
              <div className="flex items-center justify-between mb-4"><h2 className="font-semibold flex items-center gap-2"><Calendar className="h-5 w-5 text-primary" /> Agendamentos</h2><Link to="/dashboard/migrante/sessoes" className="text-sm text-primary hover:underline">Ver todas</Link></div>
              {upcomingSessions.length > 0 ? (
                <div className="space-y-3">
                  {upcomingSessions.slice(0,4).map(s => (
                    <div key={s.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Clock className="h-5 w-5" /></div>
                      <div className="flex-1"><p className="text-sm font-medium">{s.session_type}</p><p className="text-xs text-muted-foreground">{new Date(s.scheduled_date).toLocaleDateString()} • {s.scheduled_time}</p></div>
                      <span className="text-xs text-muted-foreground">{s.status || 'Agendada'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Sem sessões futuras</div>
              )}
              <div className="mt-3"><Button variant="outline" size="sm" onClick={() => setBookOpen(true)}>Marcar sessão</Button></div>
            </div>
            <div className="cpc-card p-6">
              <div className="flex items-center justify-between mb-4"><h2 className="font-semibold flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" /> Trilhas Formativas</h2><Link to="/dashboard/migrante/trilhas" className="text-sm text-primary hover:underline">Ver todas</Link></div>
              {progress.length > 0 ? (
                <div className="space-y-3">
                  {progress.slice(0,4).map(p => (
                    <div key={p.trail_id} className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-between mb-1"><p className="text-sm font-medium">{trails[p.trail_id]?.title || p.trail_id}</p><span className="text-xs text-muted-foreground">{p.modules_completed || 0}/{trails[p.trail_id]?.modules_count || 0} módulos</span></div>
                      <Progress value={p.progress_percent || 0} className="h-2" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Sem trilhas iniciadas</div>
              )}
              <div className="mt-3"><Link to="/dashboard/migrante/trilhas" className="text-sm text-primary hover:underline inline-flex items-center"><ArrowRight className="h-4 w-4 mr-1" /> Explorar trilhas</Link></div>
            </div>
          </div>

          <div className="cpc-card p-6">
            <div className="flex items-center justify-between mb-4"><h2 className="font-semibold flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary" /> Área de Emprego</h2><Link to="/dashboard/migrante/emprego" className="text-sm text-primary hover:underline">Ver todas</Link></div>
            <div className="flex flex-wrap gap-2"><Link to="/dashboard/migrante/perfil" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm hover:bg-muted"><FileText className="h-4 w-4" />Criar/editar CV</Link><Link to="/dashboard/migrante/emprego" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm hover:bg-muted"><Briefcase className="h-4 w-4" />Ver vagas</Link></div>
            <div className="grid md:grid-cols-2 gap-3 mt-4">
              {[{ id: '1', title: 'Auxiliar de Limpeza', company: 'CleanPro', location: 'Lisboa' }, { id: '2', title: 'Operador de Armazém', company: 'LogiTech', location: 'Sintra' }].map(job => (
                <Link key={job.id} to="/dashboard/migrante/emprego" className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted">
                  <div><p className="text-sm font-medium">{job.title}</p><p className="text-xs text-muted-foreground">{job.company} • {job.location}</p></div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="cpc-card p-6">
            <h2 className="font-semibold mb-4">Solicitação de Apoio</h2>
            <p className="text-sm text-muted-foreground">Crie um pedido urgente para necessidades imediatas</p>
            <div className="mt-3"><Button variant="outline" size="sm" onClick={() => setUrgentOpen(true)}><AlertTriangle className="h-4 w-4 mr-2" />Novo pedido urgente</Button></div>
          </div>
          <div className="cpc-card p-6">
            <h2 className="font-semibold mb-4">Comunicação</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-2"><MessageCircle className="h-4 w-4" /><span className="text-sm">Mensagens com a equipa CPC</span></div>
              <div className="flex items-center gap-2">
                <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Escrever mensagem" />
                <Button onClick={sendChat}>Enviar</Button>
              </div>
              <div className="space-y-2">
                {chatMessages.slice(0,5).map(m => (
                  <div key={m.id} className="p-2 rounded-md bg-muted/50 text-sm flex items-center justify-between"><span>{m.text}</span><span className="text-[10px] text-muted-foreground">{new Date(m.date).toLocaleString()}</span></div>
                ))}
              </div>
            </div>
          </div>
          <div className="cpc-card p-6">
            <h2 className="font-semibold mb-4">Histórico & Relatórios</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-md bg-muted/50"><p className="font-medium">Sessões realizadas</p><p className="text-muted-foreground">{sessions.filter(s => (s.status || '') === 'Concluída').length}</p></div>
              <div className="p-3 rounded-md bg-muted/50"><p className="font-medium">Módulos concluídos</p><p className="text-muted-foreground">{progress.reduce((a,b)=>a+(b.modules_completed||0),0)}</p></div>
              <div className="p-3 rounded-md bg-muted/50"><p className="font-medium">Candidaturas</p><p className="text-muted-foreground">—</p></div>
              <div className="p-3 rounded-md bg-muted/50"><p className="font-medium">Relatório de progresso</p><p className="text-muted-foreground">{overallProgress}%</p></div>
            </div>
          </div>
          <div className="cpc-card p-6">
            <h2 className="font-semibold mb-4">Configurações</h2>
            <div className="grid grid-cols-1 gap-3 text-sm">
              <div>
                <Label>Idioma</Label>
                <div className="mt-1">
                  <Select value={localStorage.getItem('cpc-language') || 'pt'} onValueChange={(v) => { localStorage.setItem('cpc-language', v); location.reload(); }}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="pt">Português</SelectItem><SelectItem value="en">English</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <label className="flex items-center gap-2"><Checkbox checked={accessibility} onCheckedChange={(c) => setAccessibility(!!c)} /> Modo de acessibilidade (alto contraste)</label>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={bookOpen} onOpenChange={setBookOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Marcar sessão</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={bookType} onValueChange={(v) => setBookType(v as typeof bookType)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mediador">Mediador</SelectItem>
                  <SelectItem value="jurista">Jurista</SelectItem>
                  <SelectItem value="psicologa">Psicóloga</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={bookDate} onChange={(e) => setBookDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Hora</Label>
              <Input type="time" value={bookTime} onChange={(e) => setBookTime(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter><Button onClick={bookSession}>Confirmar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={urgentOpen} onOpenChange={setUrgentOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo pedido urgente</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={urgentType} onValueChange={(v) => setUrgentType(v as typeof urgentType)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="juridico">Jurídico</SelectItem>
                  <SelectItem value="psicologico">Psicológico</SelectItem>
                  <SelectItem value="habitacional">Habitacional</SelectItem>
                  <SelectItem value="necessidades">Necessidades básicas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Descrição</Label>
              <Textarea value={urgentDesc} onChange={(e) => setUrgentDesc(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter><Button onClick={addUrgentRequest}>Submeter</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function MigrantDashboard() {
  return (
    <Layout>
      <div className="cpc-section">
        <div className="cpc-container">
          <Routes>
            <Route index element={<MigrantHome />} />
            <Route path="trilhas" element={<TrailsPage />} />
            <Route path="trilhas/:trailId" element={<TrailDetailPage />} />
            <Route path="trilhas/:trailId/modulo/:moduleId" element={<ModuleViewerPage />} />
            <Route path="emprego" element={<JobsPage />} />
            <Route path="emprego/:jobId" element={<JobDetailPage />} />
            <Route path="perfil" element={<ProfilePage />} />
          </Routes>
        </div>
      </div>
    </Layout>
  );
}
