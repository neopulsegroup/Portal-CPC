import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  BookOpen,
  Clock,
  Search,
  Filter,
  ChevronRight,
  CheckCircle,
  Play,
} from 'lucide-react';

interface Trail {
  id: string;
  title: string;
  description: string | null;
  category: string;
  difficulty: string | null;
  duration_minutes: number | null;
  modules_count: number | null;
  isDemo?: boolean;
}

interface UserProgress {
  trail_id: string;
  progress_percent: number;
  modules_completed: number;
  completed_at: string | null;
}

export default function TrailsPage() {
  const { user } = useAuth();
  const [trails, setTrails] = useState<Trail[]>([]);
  const [userProgress, setUserProgress] = useState<Record<string, UserProgress>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [usingDemoData, setUsingDemoData] = useState(false);

  useEffect(() => {
    fetchTrails();
  }, [user]);

  async function fetchTrails() {
    try {
      const { data: trailsData } = await supabase
        .from('trails')
        .select('*')
        .eq('is_active', true)
        .order('category');

      if (trailsData && trailsData.length > 0) {
        setTrails(trailsData);
        setUsingDemoData(false);
      } else {
        const DEMO_TRAILS: Trail[] = [
          {
            id: 'demo-trail-1',
            title: 'Direitos Laborais em Portugal',
            description: 'Conheça seus direitos e deveres no ambiente de trabalho em Portugal.',
            category: 'rights',
            difficulty: 'beginner',
            duration_minutes: 35,
            modules_count: 3,
            isDemo: true,
          },
          {
            id: 'demo-trail-2',
            title: 'Cultura e Costumes Portugueses',
            description: 'Aspectos culturais, etiqueta e costumes do dia a dia.',
            category: 'culture',
            difficulty: 'beginner',
            duration_minutes: 26,
            modules_count: 3,
            isDemo: true,
          },
          {
            id: 'demo-trail-3',
            title: 'Sistema de Saúde em Portugal',
            description: 'Como aceder aos serviços de saúde e o que esperar.',
            category: 'health',
            difficulty: 'intermediate',
            duration_minutes: 27,
            modules_count: 3,
            isDemo: true,
          },
          {
            id: 'demo-trail-4',
            title: 'Preparação para o Trabalho',
            description: 'Passos para buscar emprego e preparar o CV.',
            category: 'work',
            difficulty: 'beginner',
            duration_minutes: 35,
            modules_count: 3,
            isDemo: true,
          },
        ];
        setTrails(DEMO_TRAILS);
        setUsingDemoData(true);
      }

      const progressMap: Record<string, UserProgress> = {};
      if (user) {
        const { data: progressData } = await supabase
          .from('user_trail_progress')
          .select('*')
          .eq('user_id', user.id);
        if (progressData) {
          progressData.forEach(p => { progressMap[p.trail_id] = p; });
        }
      }
      if (usingDemoData || (!trailsData || trailsData.length === 0)) {
        const uid = user?.id || 'anon';
        for (const t of [
          'demo-trail-1','demo-trail-2','demo-trail-3','demo-trail-4'
        ]) {
          const raw = localStorage.getItem(`demoTrailProgress:${t}:${uid}`);
          if (raw) {
            try {
              const val = JSON.parse(raw) as UserProgress;
              progressMap[t] = val;
            } catch { void 0; }
          }
        }
      }
      setUserProgress(progressMap);
    } catch (error) {
      console.error('Error fetching trails:', error);
    } finally {
      setLoading(false);
    }
  }

  const categories = ['all', ...new Set(trails.map(t => t.category))];

  const filteredTrails = trails.filter(trail => {
    const matchesSearch = trail.title.toLowerCase().includes(search.toLowerCase()) ||
      trail.description?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || trail.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      'work': 'Trabalho',
      'health': 'Saúde',
      'rights': 'Direitos',
      'culture': 'Cultura',
      'entrepreneurship': 'Empreendedorismo',
      'all': 'Todas',
    };
    return labels[category] || category;
  };

  const getDifficultyColor = (difficulty: string | null) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-700';
      case 'intermediate': return 'bg-yellow-100 text-yellow-700';
      case 'advanced': return 'bg-red-100 text-red-700';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getDifficultyLabel = (difficulty: string | null) => {
    switch (difficulty) {
      case 'beginner': return 'Iniciante';
      case 'intermediate': return 'Intermédio';
      case 'advanced': return 'Avançado';
      default: return difficulty;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
          <BookOpen className="h-8 w-8 text-primary" />
          Trilhas Formativas
        </h1>
        <p className="text-muted-foreground mt-1">
          Explore conteúdos educativos para apoiar a sua integração
        </p>
        {usingDemoData && (
          <div className="mt-3 text-xs px-3 py-2 rounded-md bg-amber-100 text-amber-800 inline-block">
            A mostrar conteúdos de demonstração
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar trilhas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {getCategoryLabel(cat)}
            </button>
          ))}
        </div>
      </div>

      {/* Trails Grid */}
      {filteredTrails.length === 0 ? (
        <div className="cpc-card p-12 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold mb-2">Nenhuma trilha encontrada</h3>
          <p className="text-muted-foreground">
            Tente ajustar os filtros de pesquisa
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTrails.map(trail => {
            const progress = userProgress[trail.id];
            const isCompleted = progress?.completed_at !== null;
            const isStarted = progress && progress.progress_percent > 0;

            return (
              <Link
                key={trail.id}
                to={`/dashboard/migrante/trilhas/${trail.id}`}
                className="cpc-card p-6 hover:border-primary/50 transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                    {getCategoryLabel(trail.category)}
                  </span>
                  {trail.difficulty && (
                    <span className={`text-xs px-2 py-1 rounded-full ${getDifficultyColor(trail.difficulty)}`}>
                      {getDifficultyLabel(trail.difficulty)}
                    </span>
                  )}
                </div>

                <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">
                  {trail.title}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                  {trail.description}
                </p>

                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-4 w-4" />
                    {trail.modules_count || 0} módulos
                  </span>
                  {trail.duration_minutes && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {trail.duration_minutes} min
                    </span>
                  )}
                  {trail.isDemo && (
                    <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800">Demo</span>
                  )}
                </div>

                {progress && !trail.isDemo ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {progress.modules_completed}/{trail.modules_count} módulos
                      </span>
                      {isCompleted ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          Completa
                        </span>
                      ) : (
                        <span>{progress.progress_percent}%</span>
                      )}
                    </div>
                    <Progress value={progress.progress_percent} className="h-2" />
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Não iniciada</span>
                    <span className="flex items-center gap-1 text-primary">
                      <Play className="h-4 w-4" />
                      Começar
                    </span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
