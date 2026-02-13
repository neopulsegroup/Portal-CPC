import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft,
  User,
  Mail,
  Calendar,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
} from 'lucide-react';

interface Application {
  id: string;
  cover_letter: string | null;
  status: string;
  created_at: string;
  applicant: {
    name: string;
    email: string;
  };
}

interface JobOffer {
  id: string;
  title: string;
  location: string | null;
}

export default function JobApplicationsPage() {
  const { jobId } = useParams();
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [job, setJob] = useState<JobOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);

  useEffect(() => {
    fetchJobAndApplications();
  }, [jobId]);

  async function fetchJobAndApplications() {
    if (!jobId) return;

    try {
      // Fetch job details
      const { data: jobData } = await supabase
        .from('job_offers')
        .select('id, title, location')
        .eq('id', jobId)
        .single();

      if (jobData) setJob(jobData);

      // Fetch applications with applicant profiles
      const { data: appsData } = await supabase
        .from('job_applications')
        .select(`
          id,
          cover_letter,
          status,
          created_at,
          applicant_id
        `)
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });

      if (appsData) {
        // Fetch applicant profiles
        const applicantIds = appsData.map(app => app.applicant_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, name, email')
          .in('user_id', applicantIds);

        const applicationsWithProfiles = appsData.map(app => ({
          ...app,
          applicant: profiles?.find(p => p.user_id === app.applicant_id) || { name: 'Unknown', email: '' }
        }));

        setApplications(applicationsWithProfiles);
      }
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateApplicationStatus(applicationId: string, newStatus: 'submitted' | 'viewed' | 'interview' | 'accepted' | 'rejected') {
    const { error } = await supabase
      .from('job_applications')
      .update({ status: newStatus })
      .eq('id', applicationId);

    if (!error) {
      setApplications(prev =>
        prev.map(app =>
          app.id === applicationId ? { ...app, status: newStatus } : app
        )
      );
      setSelectedApplication(null);
    }
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'submitted':
        return { label: 'Novo', color: 'bg-blue-100 text-blue-700', icon: Clock };
      case 'reviewing':
        return { label: 'Em análise', color: 'bg-yellow-100 text-yellow-700', icon: Eye };
      case 'interview':
        return { label: 'Entrevista', color: 'bg-purple-100 text-purple-700', icon: Calendar };
      case 'accepted':
        return { label: 'Aceite', color: 'bg-green-100 text-green-700', icon: CheckCircle };
      case 'rejected':
        return { label: 'Rejeitado', color: 'bg-red-100 text-red-700', icon: XCircle };
      default:
        return { label: status, color: 'bg-muted text-muted-foreground', icon: Clock };
    }
  };

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

  return (
    <Layout>
      <div className="cpc-section">
        <div className="cpc-container">
          {/* Header */}
          <div className="mb-8">
            <Link
              to="/dashboard/empresa/ofertas"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar às ofertas
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold">
              Candidaturas: {job?.title}
            </h1>
            <p className="text-muted-foreground mt-1">
              {applications.length} candidatura(s) recebida(s)
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Applications List */}
            <div className="lg:col-span-2 space-y-4">
              {applications.length === 0 ? (
                <div className="cpc-card p-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">Sem candidaturas</h3>
                  <p className="text-muted-foreground">
                    Esta oferta ainda não recebeu candidaturas.
                  </p>
                </div>
              ) : (
                applications.map((app) => {
                  const statusConfig = getStatusConfig(app.status);
                  const StatusIcon = statusConfig.icon;

                  return (
                    <div
                      key={app.id}
                      className={`cpc-card p-6 cursor-pointer transition-all ${
                        selectedApplication?.id === app.id
                          ? 'ring-2 ring-primary'
                          : 'hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedApplication(app)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-lg">
                            {app.applicant.name.charAt(0)}
                          </div>
                          <div>
                            <h3 className="font-semibold">{app.applicant.name}</h3>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {app.applicant.email}
                            </p>
                          </div>
                        </div>
                        <span className={`text-xs px-3 py-1 rounded-full flex items-center gap-1 ${statusConfig.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig.label}
                        </span>
                      </div>

                      <div className="mt-4 pt-4 border-t border-border">
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Candidatou-se em {new Date(app.created_at).toLocaleDateString('pt-PT')}
                        </p>
                        {app.cover_letter && (
                          <p className="text-sm mt-2 line-clamp-2">{app.cover_letter}</p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Application Details Panel */}
            <div className="lg:col-span-1">
              {selectedApplication ? (
                <div className="cpc-card p-6 sticky top-24">
                  <h3 className="font-semibold mb-4">Detalhes da Candidatura</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-muted-foreground">Candidato</label>
                      <p className="font-medium">{selectedApplication.applicant.name}</p>
                    </div>

                    <div>
                      <label className="text-sm text-muted-foreground">Email</label>
                      <p className="font-medium">{selectedApplication.applicant.email}</p>
                    </div>

                    <div>
                      <label className="text-sm text-muted-foreground">Data</label>
                      <p className="font-medium">
                        {new Date(selectedApplication.created_at).toLocaleDateString('pt-PT')}
                      </p>
                    </div>

                    {selectedApplication.cover_letter && (
                      <div>
                        <label className="text-sm text-muted-foreground">Carta de Apresentação</label>
                        <p className="text-sm mt-1 p-3 bg-muted rounded-lg">
                          {selectedApplication.cover_letter}
                        </p>
                      </div>
                    )}

                    <div className="pt-4 border-t border-border space-y-2">
                      <p className="text-sm font-medium mb-2">Atualizar estado:</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateApplicationStatus(selectedApplication.id, 'viewed')}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Em análise
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateApplicationStatus(selectedApplication.id, 'interview')}
                        >
                          <Calendar className="h-4 w-4 mr-1" />
                          Entrevista
                        </Button>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => updateApplicationStatus(selectedApplication.id, 'accepted')}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Aceitar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => updateApplicationStatus(selectedApplication.id, 'rejected')}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Rejeitar
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="cpc-card p-6 text-center">
                  <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Selecione uma candidatura para ver os detalhes
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
