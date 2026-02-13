import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Briefcase,
  MapPin,
  Users,
  Clock,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';

interface JobOffer {
  id: string;
  title: string;
  location: string | null;
  status: string;
  applications_count: number | null;
  created_at: string;
}

export default function MyJobsPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<JobOffer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJobs();
  }, [user]);

  async function fetchJobs() {
    if (!user) return;

    try {
      // First get company id
      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (company) {
        const { data } = await supabase
          .from('job_offers')
          .select('id, title, location, status, applications_count, created_at')
          .eq('company_id', company.id)
          .order('created_at', { ascending: false });

        if (data) setJobs(data);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active':
        return { label: 'Ativa', color: 'bg-green-100 text-green-700' };
      case 'pending_review':
        return { label: 'Em revisão', color: 'bg-yellow-100 text-yellow-700' };
      case 'closed':
        return { label: 'Fechada', color: 'bg-muted text-muted-foreground' };
      case 'rejected':
        return { label: 'Rejeitada', color: 'bg-red-100 text-red-700' };
      default:
        return { label: status, color: 'bg-muted text-muted-foreground' };
    }
  };

  const getTimeAgo = (date: string) => {
    const now = new Date();
    const posted = new Date(date);
    const diffDays = Math.floor((now.getTime() - posted.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `Há ${diffDays} dias`;
    return `Há ${Math.floor(diffDays / 7)} semanas`;
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
      <Link
        to="/dashboard/empresa"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Voltar ao painel
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <Briefcase className="h-8 w-8 text-primary" />
            Minhas Ofertas
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie as suas ofertas de emprego
          </p>
        </div>
        <Link to="/dashboard/empresa/nova-oferta">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nova Oferta
          </Button>
        </Link>
      </div>

      {/* Jobs List */}
      {jobs.length === 0 ? (
        <div className="cpc-card p-12 text-center">
          <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold mb-2">Sem ofertas</h3>
          <p className="text-muted-foreground mb-4">
            Ainda não publicou nenhuma oferta de emprego.
          </p>
          <Link to="/dashboard/empresa/nova-oferta">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeira Oferta
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map(job => {
            const statusConfig = getStatusConfig(job.status);

            return (
              <Link
                key={job.id}
                to={`/dashboard/empresa/ofertas/${job.id}/candidaturas`}
                className="cpc-card p-6 block hover:border-primary/50 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                        {job.title}
                      </h3>
                      <span className={`text-xs px-2 py-1 rounded-full ${statusConfig.color}`}>
                        {statusConfig.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {job.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {job.location}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {job.applications_count || 0} candidaturas
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {getTimeAgo(job.created_at)}
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
