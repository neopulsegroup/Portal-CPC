import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { BookOpen, Plus, Clock, CheckCircle } from 'lucide-react';

interface Trail {
  id: string;
  title: string;
  description: string | null;
  category: string;
  difficulty: string | null;
  duration_minutes: number | null;
  modules_count: number | null;
  is_active: boolean;
}

export default function TrailsAdminPage() {
  const navigate = useNavigate();
  const [trails, setTrails] = useState<Trail[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedResults, setSeedResults] = useState<{ title: string; status: 'created' | 'exists' | 'error'; message?: string }[]>([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'work',
    difficulty: 'beginner',
  });

  useEffect(() => {
    fetchTrails();
  }, []);

  async function fetchTrails() {
    try {
      const { data } = await supabase
        .from('trails')
        .select('*')
        .order('created_at', { ascending: false });
      setTrails(data || []);
    } catch (e) {
      console.error('Erro ao carregar trilhas', e);
    } finally {
      setLoading(false);
    }
  }

  async function createTrail(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('trails')
        .insert({
          title: form.title,
          description: form.description || null,
          category: form.category,
          difficulty: form.difficulty,
          is_active: true,
          modules_count: 0,
          duration_minutes: 0,
        })
        .select('*')
        .single();

      if (error) throw error;
      if (data) {
        navigate(`/dashboard/cpc/trilhas/${data.id}`);
      }
    } catch (e) {
      console.error('Erro ao criar trilha', e);
    } finally {
      setCreating(false);
    }
  }

  async function seedDemo() {
    setSeeding(true);
    setSeedResults([]);
    const demos = [
      {
        title: 'Direitos Laborais em Portugal',
        description: 'Conheça seus direitos e deveres no ambiente de trabalho em Portugal.',
        category: 'rights',
        difficulty: 'beginner',
        modules: [
          { title: 'Introdução aos direitos laborais', type: 'video', url: 'https://www.youtube.com/watch?v=ysz5S6PUM-U', duration: 8 },
          { title: 'Contrato de trabalho', type: 'text', text: 'Tipos de contrato, período de prova e rescisão.', duration: 12 },
          { title: 'Segurança Social', type: 'pdf', url: 'https://example.com/seguranca-social.pdf', duration: 15 },
        ],
      },
      {
        title: 'Cultura e Costumes Portugueses',
        description: 'Aspectos culturais, etiqueta e costumes do dia a dia.',
        category: 'culture',
        difficulty: 'beginner',
        modules: [
          { title: 'Boas-vindas à cultura portuguesa', type: 'video', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', duration: 6 },
          { title: 'Etiqueta e convivência', type: 'text', text: 'Cumprimentos, pontualidade e convivência social.', duration: 10 },
          { title: 'Feriados e tradições', type: 'pdf', url: 'https://example.com/tradicoes.pdf', duration: 10 },
        ],
      },
      {
        title: 'Sistema de Saúde em Portugal',
        description: 'Como aceder aos serviços de saúde e o que esperar.',
        category: 'health',
        difficulty: 'intermediate',
        modules: [
          { title: 'Introdução ao SNS', type: 'video', url: 'https://www.youtube.com/watch?v=ysz5S6PUM-U', duration: 7 },
          { title: 'Centros de saúde e hospitais', type: 'text', text: 'Diferenças e quando procurar cada serviço.', duration: 12 },
          { title: 'Documentação necessária', type: 'pdf', url: 'https://example.com/saude-docs.pdf', duration: 8 },
        ],
      },
      {
        title: 'Preparação para o Trabalho',
        description: 'Passos para buscar emprego e preparar o CV.',
        category: 'work',
        difficulty: 'beginner',
        modules: [
          { title: 'Como procurar vagas', type: 'video', url: 'https://www.youtube.com/watch?v=ysz5S6PUM-U', duration: 9 },
          { title: 'Construindo o seu CV', type: 'text', text: 'Estrutura, competências e experiências.', duration: 14 },
          { title: 'Entrevistas de emprego', type: 'pdf', url: 'https://example.com/entrevistas.pdf', duration: 12 },
        ],
      },
    ];

    const results: { title: string; status: 'created' | 'exists' | 'error'; message?: string }[] = [];
    try {
      for (const demo of demos) {
        const { data: existing } = await supabase
          .from('trails')
          .select('id')
          .eq('title', demo.title)
          .maybeSingle();

        if (existing?.id) {
          results.push({ title: demo.title, status: 'exists' });
          continue;
        }

        const { data: trail, error: trailError } = await supabase
          .from('trails')
          .insert({
            title: demo.title,
            description: demo.description,
            category: demo.category,
            difficulty: demo.difficulty,
            is_active: true,
            modules_count: 0,
            duration_minutes: 0,
          })
          .select('*')
          .single();

        if (trailError || !trail) {
          results.push({ title: demo.title, status: 'error', message: trailError?.message || 'Falha ao criar trilha' });
          continue;
        }

        let order = 1;
        let totalDuration = 0;
        for (const m of demo.modules) {
          totalDuration += m.duration;
          const isText = m.type === 'text';
          const { error: modError } = await supabase
            .from('trail_modules')
            .insert({
              trail_id: trail.id,
              title: m.title,
              content_type: m.type,
              content_url: isText ? null : m.url,
              content_text: isText ? m.text : null,
              duration_minutes: m.duration,
              order_index: order,
            });
          if (modError) {
            results.push({ title: `${demo.title} - módulo`, status: 'error', message: modError.message });
          }
          order += 1;
        }

        await supabase
          .from('trails')
          .update({ modules_count: order - 1, duration_minutes: totalDuration })
          .eq('id', trail.id);

        results.push({ title: demo.title, status: 'created' });
      }
    } catch (e) {
      results.push({ title: 'seed', status: 'error', message: e instanceof Error ? e.message : 'Erro desconhecido' });
    }

    setSeedResults(results);
    setSeeding(false);
    fetchTrails();
  }

  return (
    <Layout>
      <div className="cpc-section">
        <div className="cpc-container">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <BookOpen className="h-7 w-7 text-primary" />
              Gerir Trilhas Formativas
            </h1>
            <Link to="/dashboard/cpc">
              <Button variant="outline">Voltar ao CPC</Button>
            </Link>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 cpc-card p-6">
              <h2 className="font-semibold mb-4">Trilhas existentes</h2>
              <div className="mb-4 flex items-center gap-2">
                <Button onClick={seedDemo} disabled={seeding}>
                  {seeding ? 'A criar...' : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Criar trilhas demo
                    </>
                  )}
                </Button>
              </div>
              {seedResults.length > 0 && (
                <div className="mb-6 space-y-2">
                  {seedResults.map((r) => (
                    <div key={`${r.title}-${r.status}`} className="flex items-center justify-between rounded-md border p-3 text-sm">
                      <span className="font-medium">{r.title}</span>
                      <span className={r.status === 'created' ? 'text-green-600' : r.status === 'exists' ? 'text-amber-600' : 'text-red-600'}>
                        {r.status}
                        {r.message ? `: ${r.message}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : trails.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhuma trilha criada ainda.</div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {trails.map((trail) => (
                    <Link
                      key={trail.id}
                      to={`/dashboard/cpc/trilhas/${trail.id}`}
                      className="cpc-card p-4 hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                          {trail.category}
                        </span>
                        {trail.is_active ? (
                          <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">Ativa</span>
                        ) : (
                          <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">Inativa</span>
                        )}
                      </div>
                      <h3 className="font-medium mb-1">{trail.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{trail.description}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-4 w-4" />
                          {trail.modules_count || 0} módulos
                        </span>
                        {trail.duration_minutes ? (
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {trail.duration_minutes} min
                          </span>
                        ) : null}
                        {trail.modules_count && trail.modules_count > 0 ? (
                          <span className="flex items-center gap-1">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            Conteúdo
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="cpc-card p-6">
              <h2 className="font-semibold mb-4">Nova Trilha</h2>
              <form onSubmit={createTrail} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Título *</label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Descrição</label>
                  <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Categoria</label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-input bg-background"
                    >
                      <option value="work">Trabalho</option>
                      <option value="health">Saúde</option>
                      <option value="rights">Direitos</option>
                      <option value="culture">Cultura</option>
                      <option value="entrepreneurship">Empreendedorismo</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Nível</label>
                    <select
                      value={form.difficulty}
                      onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-input bg-background"
                    >
                      <option value="beginner">Iniciante</option>
                      <option value="intermediate">Intermédio</option>
                      <option value="advanced">Avançado</option>
                    </select>
                  </div>
                </div>
                <Button type="submit" disabled={creating}>
                  {creating ? 'A criar...' : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Criar Trilha
                    </>
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
