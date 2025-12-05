import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Circle,
  Play,
  FileText,
  File,
  ExternalLink,
  List,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Module {
  id: string;
  title: string;
  content_type: string;
  content_text: string | null;
  content_url: string | null;
  duration_minutes: number | null;
  order_index: number;
  trail_id: string;
}

interface Trail {
  id: string;
  title: string;
  modules_count: number | null;
  category: string;
}

interface UserProgress {
  modules_completed: number;
  progress_percent: number;
}

export default function ModuleViewerPage() {
  const { trailId, moduleId } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [module, setModule] = useState<Module | null>(null);
  const [trail, setTrail] = useState<Trail | null>(null);
  const [allModules, setAllModules] = useState<Module[]>([]);
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const isDemo = !!trailId && trailId.startsWith('demo-');
  const getDemoKey = (id: string) => `demoTrailProgress:${id}:${user?.id || 'anon'}`;
  const getCommentsKey = (id: string) => `moduleComments:${id}`;
  const getLastKey = (trail: string, uid?: string) => `lastModuleViewed:${trail}:${uid || 'anon'}`;

  type ModuleComment = {
    id: string;
    user_id: string | null;
    user_name: string;
    avatar_url: string | null;
    content: string;
    created_at: string;
  };

  const [comments, setComments] = useState<ModuleComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (trailId && moduleId) fetchData();
  }, [trailId, moduleId]);

  async function fetchData() {
    try {
      if (isDemo) {
        const demoTrails: Record<string, Trail> = {
          'demo-trail-1': { id: 'demo-trail-1', title: 'Direitos Laborais em Portugal', modules_count: 3, category: 'rights' },
          'demo-trail-2': { id: 'demo-trail-2', title: 'Cultura e Costumes Portugueses', modules_count: 3, category: 'culture' },
          'demo-trail-3': { id: 'demo-trail-3', title: 'Sistema de Saúde em Portugal', modules_count: 3, category: 'health' },
          'demo-trail-4': { id: 'demo-trail-4', title: 'Preparação para o Trabalho', modules_count: 3, category: 'work' },
        };
        const mods: Record<string, Module[]> = {
          'demo-trail-1': [
            { id: 'demo-module-1-1', trail_id: 'demo-trail-1', title: 'Introdução aos direitos laborais', content_type: 'video', content_text: null, content_url: 'https://www.youtube.com/watch?v=ysz5S6PUM-U', duration_minutes: 8, order_index: 1 },
            { id: 'demo-module-1-2', trail_id: 'demo-trail-1', title: 'Contrato de trabalho', content_type: 'text', content_text: 'Tipos de contrato, período de prova e rescisão.', content_url: null, duration_minutes: 12, order_index: 2 },
            { id: 'demo-module-1-3', trail_id: 'demo-trail-1', title: 'Segurança Social', content_type: 'pdf', content_text: null, content_url: 'https://example.com/seguranca-social.pdf', duration_minutes: 15, order_index: 3 },
          ],
          'demo-trail-2': [
            { id: 'demo-module-2-1', trail_id: 'demo-trail-2', title: 'Boas-vindas à cultura portuguesa', content_type: 'video', content_text: null, content_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', duration_minutes: 6, order_index: 1 },
            { id: 'demo-module-2-2', trail_id: 'demo-trail-2', title: 'Etiqueta e convivência', content_type: 'text', content_text: 'Cumprimentos, pontualidade e convivência social.', content_url: null, duration_minutes: 10, order_index: 2 },
            { id: 'demo-module-2-3', trail_id: 'demo-trail-2', title: 'Feriados e tradições', content_type: 'pdf', content_text: null, content_url: 'https://example.com/tradicoes.pdf', duration_minutes: 10, order_index: 3 },
          ],
          'demo-trail-3': [
            { id: 'demo-module-3-1', trail_id: 'demo-trail-3', title: 'Introdução ao SNS', content_type: 'video', content_text: null, content_url: 'https://www.youtube.com/watch?v=ysz5S6PUM-U', duration_minutes: 7, order_index: 1 },
            { id: 'demo-module-3-2', trail_id: 'demo-trail-3', title: 'Centros de saúde e hospitais', content_type: 'text', content_text: 'Diferenças e quando procurar cada serviço.', content_url: null, duration_minutes: 12, order_index: 2 },
            { id: 'demo-module-3-3', trail_id: 'demo-trail-3', title: 'Documentação necessária', content_type: 'pdf', content_text: null, content_url: 'https://example.com/saude-docs.pdf', duration_minutes: 8, order_index: 3 },
          ],
          'demo-trail-4': [
            { id: 'demo-module-4-1', trail_id: 'demo-trail-4', title: 'Como procurar vagas', content_type: 'video', content_text: null, content_url: 'https://www.youtube.com/watch?v=ysz5S6PUM-U', duration_minutes: 9, order_index: 1 },
            { id: 'demo-module-4-2', trail_id: 'demo-trail-4', title: 'Construindo o seu CV', content_type: 'text', content_text: 'Estrutura, competências e experiências.', content_url: null, duration_minutes: 14, order_index: 2 },
            { id: 'demo-module-4-3', trail_id: 'demo-trail-4', title: 'Entrevistas de emprego', content_type: 'pdf', content_text: null, content_url: 'https://example.com/entrevistas.pdf', duration_minutes: 12, order_index: 3 },
          ],
        };
        const t = demoTrails[trailId as string] || null;
        const all = mods[trailId as string] || [];
        const mod = all.find(m => m.id === moduleId) || null;
        setTrail(t);
        setAllModules(all);
        setModule(mod);
        const raw = localStorage.getItem(getDemoKey(trailId as string));
        if (raw) {
          try {
            const val = JSON.parse(raw) as UserProgress;
            setUserProgress(val);
          } catch { void 0; }
        } else {
          const idx = all.findIndex(m => m.id === moduleId);
          if (idx >= 0) {
            const percent = Math.round(((idx) / all.length) * 100);
            setUserProgress({ modules_completed: idx, progress_percent: percent });
          }
        }
      } else {
        const [moduleRes, trailRes, modulesRes, progressRes] = await Promise.all([
          supabase.from('trail_modules').select('*').eq('id', moduleId).single(),
          supabase.from('trails').select('id, title, modules_count, category').eq('id', trailId).single(),
          supabase.from('trail_modules').select('*').eq('trail_id', trailId).order('order_index'),
          user ? supabase.from('user_trail_progress').select('modules_completed, progress_percent').eq('user_id', user.id).eq('trail_id', trailId).maybeSingle() : null,
        ]);
        if (moduleRes.data) setModule(moduleRes.data);
        if (trailRes.data) setTrail(trailRes.data);
        if (modulesRes.data) setAllModules(modulesRes.data);
        if (progressRes?.data) setUserProgress(progressRes.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!moduleId) return;
    try {
      const raw = localStorage.getItem(getCommentsKey(moduleId));
      if (raw) {
        const parsed = JSON.parse(raw) as ModuleComment[];
        setComments(parsed);
      } else {
        setComments([]);
      }
    } catch {
      setComments([]);
    }
  }, [moduleId]);

  useEffect(() => {
    if (!trailId || !moduleId || !module) return;
    try {
      const info = { module_id: moduleId, title: module.title };
      localStorage.setItem(getLastKey(trailId as string, user?.id), JSON.stringify(info));
    } catch (e) { void e; }
  }, [trailId, moduleId, module, user]);

  async function addComment() {
    if (!newComment.trim()) return;
    setPosting(true);
    try {
      const comment: ModuleComment = {
        id: `${Date.now()}`,
        user_id: user?.id || null,
        user_name: profile?.name || 'Anónimo',
        avatar_url: profile?.avatar_url || null,
        content: newComment.trim(),
        created_at: new Date().toISOString(),
      };
      const updated = [comment, ...comments];
      setComments(updated);
      if (moduleId) {
        localStorage.setItem(getCommentsKey(moduleId), JSON.stringify(updated));
      }
      setNewComment('');
    } catch (e) {
      // no-op
    } finally {
      setPosting(false);
    }
  }

  async function completeModule() {
    if (!trailId || !module) return;
    setCompleting(true);
    try {
      if (!isDemo) {
        if (!user) return;
        const { data: progress } = await supabase
          .from('user_trail_progress')
          .select('*')
          .eq('user_id', user.id)
          .eq('trail_id', trailId)
          .maybeSingle();
        if (progress) {
          const newModulesCompleted = progress.modules_completed + 1;
          const totalModules = trail?.modules_count || allModules.length;
          const newProgressPercent = Math.round((newModulesCompleted / totalModules) * 100);
          const isComplete = newModulesCompleted >= totalModules;
          await supabase
            .from('user_trail_progress')
            .update({ modules_completed: newModulesCompleted, progress_percent: newProgressPercent, completed_at: isComplete ? new Date().toISOString() : null })
            .eq('id', progress.id);
        }
      }
      if (isDemo) {
        const total = allModules.length;
        const completed = (userProgress?.modules_completed || 0) + 1;
        const percent = Math.round((completed / total) * 100);
        const demo = { modules_completed: completed, progress_percent: percent };
        localStorage.setItem(getDemoKey(trailId), JSON.stringify(demo));
        setUserProgress(demo);
      }
      const currentIndex = allModules.findIndex(m => m.id === moduleId);
      if (currentIndex < allModules.length - 1) {
        navigate(`/dashboard/migrante/trilhas/${trailId}/modulo/${allModules[currentIndex + 1].id}`);
      } else {
        navigate(`/dashboard/migrante/trilhas/${trailId}`);
      }
    } catch (error) {
      console.error('Error completing module:', error);
    } finally {
      setCompleting(false);
    }
  }

  const currentIndex = allModules.findIndex(m => m.id === moduleId);
  const prevModule = currentIndex > 0 ? allModules[currentIndex - 1] : null;
  const nextModule = currentIndex < allModules.length - 1 ? allModules[currentIndex + 1] : null;
  const progressPercent = userProgress?.progress_percent || 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!module) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Módulo não encontrado</p>
        <Link to={`/dashboard/migrante/trilhas/${trailId}`} className="text-primary hover:underline mt-2 inline-block">
          Voltar à trilha
        </Link>
      </div>
    );
  }

  const getYouTubeEmbedUrl = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? `https://www.youtube.com/embed/${match[2]}` : url;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Breadcrumb Navigation */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/dashboard/migrante/trilhas" className="hover:text-foreground">
              Trilhas
            </Link>
            <span>/</span>
            <Link to={`/dashboard/migrante/trilhas/${trailId}`} className="hover:text-foreground">
              {trail?.title}
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium truncate max-w-[200px]">{module.title}</span>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <Link
              to={`/dashboard/migrante/trilhas/${trailId}`}
              className="inline-flex items-center text-sm text-primary hover:underline"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar para a Trilha
            </Link>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={completeModule}
                disabled={completing}
                className="gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                {completing ? 'A guardar...' : 'Marcar como concluída'}
              </Button>

              {prevModule && (
                <Link to={`/dashboard/migrante/trilhas/${trailId}/modulo/${prevModule.id}`}>
                  <Button variant="outline" size="sm" className="gap-1">
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                </Link>
              )}

              {nextModule && (
                <Link to={`/dashboard/migrante/trilhas/${trailId}/modulo/${nextModule.id}`}>
                  <Button variant="outline" size="sm" className="gap-1">
                    Próximo
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSidebar(!showSidebar)}
                className="gap-2"
              >
                <List className="h-4 w-4" />
                Ver Módulos
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Content Area */}
          <div className={cn("flex-1 min-w-0", showSidebar ? "lg:pr-6" : "")}>
            {/* Module Title */}
            <h1 className="text-xl md:text-2xl font-bold mb-4">
              {trail?.title}: Aula {currentIndex + 1} - {module.title}
            </h1>

            {/* Video Content */}
            {module.content_type === 'video' && module.content_url && (
              <div className="aspect-video bg-muted rounded-lg mb-6 overflow-hidden shadow-lg">
                {module.content_url.includes('youtube.com') || module.content_url.includes('youtu.be') ? (
                  <iframe
                    src={getYouTubeEmbedUrl(module.content_url)}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video
                    src={module.content_url}
                    controls
                    className="w-full h-full"
                  />
                )}
              </div>
            )}

            {/* PDF Content */}
            {module.content_type === 'pdf' && module.content_url && (
              <div className="space-y-4 mb-6">
                <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden shadow-lg">
                  <iframe
                    src={module.content_url}
                    className="w-full h-full"
                    title={module.title}
                  />
                </div>
                <a
                  href={module.content_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir PDF em nova janela
                </a>
              </div>
            )}

          {/* Description Section */}
          <div className="bg-card rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">Descrição</h2>
            {module.content_type === 'text' && module.content_text ? (
              <div className="prose prose-slate dark:prose-invert max-w-none">
                <div dangerouslySetInnerHTML={{ __html: module.content_text.replace(/\n/g, '<br/>') }} />
              </div>
            ) : (
              <p className="text-muted-foreground">
                {module.duration_minutes && `Duração estimada: ${module.duration_minutes} minutos`}
              </p>
            )}
          </div>

          <div className="bg-card rounded-lg border p-6 mt-6">
            <h2 className="text-lg font-semibold mb-4">Comentários</h2>
            <div className="flex items-start gap-3 mb-4">
              <Avatar>
                {profile?.avatar_url ? (
                  <AvatarImage src={profile.avatar_url} alt={profile?.name || 'Utilizador'} />
                ) : (
                  <AvatarFallback>{(profile?.name || 'A').slice(0, 1)}</AvatarFallback>
                )}
              </Avatar>
              <div className="flex-1">
                <Textarea
                  placeholder="Escreva um comentário..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="mb-2"
                />
                <div className="flex justify-end">
                  <Button size="sm" onClick={addComment} disabled={posting || !newComment.trim()}>
                    {posting ? 'A publicar...' : 'Publicar'}
                  </Button>
                </div>
              </div>
            </div>

            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ainda não há comentários. Seja o primeiro a comentar!</p>
            ) : (
              <div className="space-y-4">
                {comments.map((c) => (
                  <div key={c.id} className="flex items-start gap-3">
                    <Avatar>
                      {c.avatar_url ? (
                        <AvatarImage src={c.avatar_url} alt={c.user_name} />
                      ) : (
                        <AvatarFallback>{(c.user_name || 'A').slice(0, 1)}</AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{c.user_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(c.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm mt-1">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

          {/* Sidebar - Module List */}
          {showSidebar && (
            <div className="hidden lg:block w-80 flex-shrink-0">
              <div className="bg-card rounded-lg border sticky top-4">
                {/* Progress Header */}
                <div className="p-4 border-b">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{trail?.title}</span>
                    <span className="text-xs text-primary font-semibold">{progressPercent}%</span>
                  </div>
                  <Progress value={progressPercent} className="h-2" />
                </div>

                {/* Module List */}
                <ScrollArea className="h-[400px]">
                  <div className="p-2">
                    {allModules.map((mod, index) => {
                      const isCompleted = index < (userProgress?.modules_completed || 0);
                      const isCurrent = mod.id === moduleId;

                      return (
                        <Link
                          key={mod.id}
                          to={`/dashboard/migrante/trilhas/${trailId}/modulo/${mod.id}`}
                          className={cn(
                            "flex items-start gap-3 p-3 rounded-lg transition-colors",
                            isCurrent
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-muted"
                          )}
                        >
                          <div className="mt-0.5">
                            {isCompleted ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : isCurrent ? (
                              <Circle className="h-4 w-4 text-primary fill-primary" />
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-sm font-medium truncate",
                              isCurrent && "text-primary"
                            )}>
                              {mod.title}
                            </p>
                            {mod.duration_minutes && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {mod.duration_minutes} min
                              </p>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
