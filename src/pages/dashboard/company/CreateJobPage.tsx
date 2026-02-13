import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save } from 'lucide-react';

export default function CreateJobPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    sector: '',
    contract_type: 'full_time',
    salary_range: '',
    requirements: '',
  });

  useEffect(() => {
    fetchCompany();
  }, [user]);

  async function fetchCompany() {
    if (!user) return;

    const { data } = await supabase
      .from('companies')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setCompanyId(data.id);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!companyId) {
      toast({
        title: 'Erro',
        description: 'Perfil de empresa não encontrado.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('job_offers')
        .insert({
          company_id: companyId,
          title: form.title,
          description: form.description || null,
          location: form.location || null,
          sector: form.sector || null,
          contract_type: form.contract_type || null,
          salary_range: form.salary_range || null,
          requirements: form.requirements || null,
          status: 'pending_review',
        });

      if (error) throw error;

      toast({
        title: 'Oferta criada!',
        description: 'A sua oferta foi submetida para revisão.',
      });
      navigate('/dashboard/empresa/ofertas');
    } catch (error) {
      console.error('Error creating job:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar a oferta. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Link
        to="/dashboard/empresa"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Voltar ao painel
      </Link>

      <div className="max-w-2xl">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Nova Oferta de Emprego</h1>
        <p className="text-muted-foreground mb-8">
          Preencha os detalhes da oferta. Após submissão, será revista pela equipa CPC.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="cpc-card p-6 space-y-4">
            <h2 className="font-semibold">Informações da Oferta</h2>

            <div>
              <label className="text-sm font-medium mb-2 block">Título do Cargo *</label>
              <Input
                placeholder="Ex: Auxiliar de Limpeza"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Descrição</label>
              <Textarea
                placeholder="Descreva as responsabilidades e tarefas do cargo..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Localização</label>
                <Input
                  placeholder="Ex: Lisboa"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Setor</label>
                <Input
                  placeholder="Ex: Serviços, Logística"
                  value={form.sector}
                  onChange={(e) => setForm({ ...form, sector: e.target.value })}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Tipo de Contrato</label>
                <select
                  value={form.contract_type}
                  onChange={(e) => setForm({ ...form, contract_type: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-input bg-background"
                >
                  <option value="full_time">Tempo Inteiro</option>
                  <option value="part_time">Part-time</option>
                  <option value="temporary">Temporário</option>
                  <option value="internship">Estágio</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Faixa Salarial</label>
                <Input
                  placeholder="Ex: 900€ - 1100€/mês"
                  value={form.salary_range}
                  onChange={(e) => setForm({ ...form, salary_range: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Requisitos</label>
              <Textarea
                placeholder="Liste os requisitos e qualificações necessárias..."
                value={form.requirements}
                onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                rows={4}
              />
            </div>
          </div>

          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/dashboard/empresa')}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !form.title}>
              {loading ? (
                'A guardar...'
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Publicar Oferta
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
