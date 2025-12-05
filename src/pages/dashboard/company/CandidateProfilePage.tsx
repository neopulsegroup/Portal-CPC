import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { User, Mail, Phone, ArrowLeft, FileText, Briefcase, Calendar, ExternalLink, BookOpen, CheckCircle, Clock } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';

interface Profile {
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
}

interface ApplicationSummary {
  id: string;
  job_title: string;
  created_at: string;
  status: string | null;
}

export default function CandidateProfilePage() {
  const { candidateId } = useParams();
  const { profile: viewerProfile } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Array<{ id: string; session_type: string; scheduled_date: string; scheduled_time: string; status: string | null }>>([]);
  const [progress, setProgress] = useState<Array<{ trail_id: string; progress_percent: number | null; modules_completed: number | null; completed_at: string | null }>>([]);
  const [trails, setTrails] = useState<Record<string, { id: string; title: string; modules_count: number | null }>>({});

  useEffect(() => {
    fetchCandidate();
  }, [candidateId]);

  async function fetchCandidate() {
    if (!candidateId) return;
    try {
      const { data: prof } = await supabase
        .from('profiles')
        .select('user_id, name, email, phone, avatar_url')
        .eq('user_id', candidateId)
        .maybeSingle();

      if (prof) {
        setProfile(prof as Profile);
      } else {
        const demo = getDemoProfile(candidateId);
        setProfile(demo);
        setResumeUrl(getDemoResume(candidateId));
      }

      const { data: apps } = await supabase
        .from('job_applications')
        .select('id, created_at, status, job_id')
        .eq('applicant_id', candidateId)
        .order('created_at', { ascending: false });

      if (apps && apps.length > 0) {
        const jobIds = apps.map(a => a.job_id);
        const { data: jobs } = await supabase
          .from('job_offers')
          .select('id, title')
          .in('id', jobIds);
        const summaries: ApplicationSummary[] = apps.map(a => ({
          id: a.id,
          job_title: jobs?.find(j => j.id === a.job_id)?.title || 'Oferta',
          created_at: a.created_at,
          status: a.status as string | null,
        }));
        setApplications(summaries);
      }

      const { data: sess } = await supabase
        .from('sessions')
        .select('id, session_type, scheduled_date, scheduled_time, status')
        .eq('migrant_id', candidateId)
        .order('scheduled_date', { ascending: true });
      setSessions(sess || []);

      const { data: prog } = await supabase
        .from('user_trail_progress')
        .select('trail_id, progress_percent, modules_completed, completed_at')
        .eq('user_id', candidateId);
      const progArr = (prog || []) as Array<{ trail_id: string; progress_percent: number | null; modules_completed: number | null; completed_at: string | null }>;
      setProgress(progArr);
      const trailIds = Array.from(new Set(progArr.map(p => p.trail_id).filter(Boolean)));
      if (trailIds.length > 0) {
        const { data: trailsRes } = await supabase
          .from('trails')
          .select('id, title, modules_count')
          .in('id', trailIds);
        const typed = (trailsRes || []) as Array<{ id: string; title: string; modules_count: number | null }>;
        const map: Record<string, { id: string; title: string; modules_count: number | null }> = {};
        typed.forEach(t => { map[t.id] = t; });
        setTrails(map);
      } else {
        setTrails({});
      }

      // Try to resolve a stored resume url conventionally (optional bucket)
      if (!resumeUrl && prof) {
        const maybe = localStorage.getItem(`resume:${candidateId}`);
        if (maybe) setResumeUrl(maybe);
      }
    } catch (e) {
      console.error('Erro ao carregar candidato:', e);
    } finally {
      setLoading(false);
    }
  }

  function getDemoProfile(id: string): Profile {
    const demos: Record<string, Profile> = {
      '1': { user_id: '1', name: 'Maria Silva', email: 'maria.silva@example.com', phone: '+351 910 000 001', avatar_url: null },
      '2': { user_id: '2', name: 'Ahmed Hassan', email: 'ahmed.hassan@example.com', phone: '+351 910 000 002', avatar_url: null },
      '3': { user_id: '3', name: 'Ana Pereira', email: 'ana.pereira@example.com', phone: '+351 910 000 003', avatar_url: null },
    };
    return demos[id] || { user_id: id, name: 'Candidato', email: 'candidato@example.com', phone: null, avatar_url: null };
  }

  function getDemoResume(id: string): string | null {
    return 'https://example.com/cv-demo.pdf';
  }

  if (loading) {
    return (
      <Layout>
        <div className="cpc-section">
          <div className="cpc-container">
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div className="cpc-section">
          <div className="cpc-container">
            <div className="text-center py-12">
              <p className="text-muted-foreground">Candidato não encontrado</p>
          <Link to={viewerProfile?.role === 'company' ? "/dashboard/empresa" : "/dashboard/cpc"} className="text-primary hover:underline mt-2 inline-block">
            Voltar
          </Link>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="cpc-section">
        <div className="cpc-container">
          <Link to={viewerProfile?.role === 'company' ? "/dashboard/empresa" : "/dashboard/cpc"} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar ao painel
          </Link>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <User className="h-7 w-7" />
                  </div>
                  <div>
                    <h1 className="text-xl font-semibold">{profile.name}</h1>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{profile.email}</span>
                      {profile.phone && (<span className="flex items-center gap-1"><Phone className="h-3 w-3" />{profile.phone}</span>)}
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h2 className="font-semibold mb-4 flex items-center gap-2"><FileText className="h-5 w-5" /> Currículo</h2>
                {resumeUrl ? (
                  <div className="space-y-4">
                    <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden">
                      <iframe src={resumeUrl} className="w-full h-full" title="Currículo" />
                    </div>
                    <a href={resumeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-primary hover:underline">
                      <ExternalLink className="h-4 w-4" />
                      Abrir CV em nova janela
                    </a>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Currículo não disponível. Solicite o envio do CV ao candidato.
                  </div>
                )}
              </Card>

              <Card className="p-6">
                <h2 className="font-semibold mb-4 flex items-center gap-2"><Calendar className="h-5 w-5" /> Marcações</h2>
                {sessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem marcações registadas.</p>
                ) : (
                  <div className="space-y-3">
                    {sessions.map((s) => (
                      <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                            <Clock className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{s.session_type}</p>
                            <p className="text-xs text-muted-foreground">Status: {s.status || 'Agendada'}</p>
                          </div>
                        </div>
                        <div className="text-right text-xs">
                          <p className="font-medium">{new Date(s.scheduled_date).toLocaleDateString('pt-PT')}</p>
                          <p className="text-muted-foreground">{s.scheduled_time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-6">
                <h2 className="font-semibold mb-4 flex items-center gap-2"><BookOpen className="h-5 w-5" /> Trilhas Assistidas</h2>
                {progress.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem progresso em trilhas.</p>
                ) : (
                  <div className="space-y-3">
                    {progress.map((p) => {
                      const t = trails[p.trail_id];
                      const isCompleted = p.completed_at !== null;
                      const percent = p.progress_percent || 0;
                      const total = t?.modules_count || 0;
                      const completed = p.modules_completed || 0;
                      return (
                        <Link key={p.trail_id} to={`/dashboard/migrante/trilhas/${p.trail_id}`} className="block p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-medium text-sm">{t?.title || p.trail_id}</p>
                            {isCompleted ? (
                              <span className="text-xs text-green-600 flex items-center gap-1">
                                <CheckCircle className="h-4 w-4" /> Completa
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">{completed}/{total} módulos</span>
                            )}
                          </div>
                          <Progress value={percent} className="h-2" />
                        </Link>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="p-6">
                <h2 className="font-semibold mb-4 flex items-center gap-2"><Briefcase className="h-5 w-5" /> Candidaturas</h2>
                {applications.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem candidaturas registadas para este candidato.</p>
                ) : (
                  <div className="space-y-3">
                    {applications.map(app => (
                      <div key={app.id} className="p-3 rounded-lg border">
                        <p className="font-medium">{app.job_title}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(app.created_at).toLocaleDateString('pt-PT')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Button variant="outline" onClick={() => {
                if (profile?.user_id) {
                  const demo = getDemoResume(profile.user_id);
                  setResumeUrl(demo);
                }
              }}>Usar CV de demonstração</Button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
