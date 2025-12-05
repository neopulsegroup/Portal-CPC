import { Routes, Route, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Briefcase,
  Users,
  FileText,
  Plus,
  ChevronRight,
  Eye,
  CheckCircle,
} from 'lucide-react';

// Sub-pages
import CreateJobPage from './company/CreateJobPage';
import MyJobsPage from './company/MyJobsPage';
import JobApplicationsPage from './company/JobApplicationsPage';
import CandidateProfilePage from './company/CandidateProfilePage';

function CompanyHome() {
  const { profile } = useAuth();

  const stats = [
    { label: 'Ofertas Ativas', value: 3, icon: Briefcase },
    { label: 'Candidaturas Recebidas', value: 12, icon: FileText },
    { label: 'Candidatos Visualizados', value: 8, icon: Eye },
    { label: 'Contratações', value: 2, icon: CheckCircle },
  ];

  const activeJobs = [
    {
      id: 1,
      title: 'Auxiliar de Limpeza',
      location: 'Lisboa',
      applications: 5,
      status: 'Ativa',
      postedDate: '25 Nov',
    },
    {
      id: 2,
      title: 'Operador de Armazém',
      location: 'Sintra',
      applications: 4,
      status: 'Ativa',
      postedDate: '20 Nov',
    },
    {
      id: 3,
      title: 'Assistente Administrativo',
      location: 'Lisboa',
      applications: 3,
      status: 'Em revisão',
      postedDate: '15 Nov',
    },
  ];

  const recentCandidates = [
    { id: 1, name: 'Maria Silva', position: 'Auxiliar de Limpeza', date: '02 Dez', status: 'Novo' },
    { id: 2, name: 'Ahmed Hassan', position: 'Operador de Armazém', date: '01 Dez', status: 'Visualizado' },
    { id: 3, name: 'Ana Pereira', position: 'Auxiliar de Limpeza', date: '30 Nov', status: 'Em análise' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Ativa':
        return 'bg-green-100 text-green-700';
      case 'Em revisão':
        return 'bg-yellow-100 text-yellow-700';
      case 'Novo':
        return 'bg-blue-100 text-blue-700';
      case 'Visualizado':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">
            Portal Empresas
          </h1>
          <p className="text-muted-foreground mt-1">
            Bem-vindo(a), {profile?.name}
          </p>
        </div>
        <Link to="/dashboard/empresa/nova-oferta">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nova Oferta
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="cpc-card p-6">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
              <stat.icon className="h-5 w-5" />
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Active Jobs */}
        <div className="cpc-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              Ofertas Ativas
            </h2>
            <Link to="/dashboard/empresa/ofertas" className="text-sm text-primary hover:underline">
              Ver todas
            </Link>
          </div>

          <div className="space-y-3">
            {activeJobs.map((job) => (
              <Link
                key={job.id}
                to="/dashboard/empresa/ofertas"
                className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div>
                  <p className="font-medium">{job.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {job.location} • {job.applications} candidaturas
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(job.status)}`}>
                    {job.status}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Candidates */}
        <div className="cpc-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Candidaturas Recentes
            </h2>
            <Link to="/dashboard/empresa/candidatos" className="text-sm text-primary hover:underline">
              Ver todas
            </Link>
          </div>

          <div className="space-y-3">
            {recentCandidates.map((candidate) => (
              <Link
                key={candidate.id}
                to={`/dashboard/empresa/candidatos/${candidate.id}`}
                className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-medium">
                    {candidate.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium">{candidate.name}</p>
                    <p className="text-sm text-muted-foreground">{candidate.position}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(candidate.status)}`}>
                    {candidate.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Info Card */}
        <div className="cpc-card p-6 lg:col-span-2 cpc-gradient-bg text-primary-foreground">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">Encontre os melhores candidatos</h3>
              <p className="opacity-90 text-sm">
                Publique ofertas e aceda a uma bolsa de candidatos qualificados e motivados
              </p>
            </div>
            <Link to="/dashboard/empresa/nova-oferta">
              <Button variant="hero-outline" size="lg">
                <Plus className="mr-2 h-5 w-5" />
                Criar Oferta
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

export default function CompanyDashboard() {
  return (
    <Layout>
      <div className="cpc-section">
        <div className="cpc-container">
          <Routes>
            <Route index element={<CompanyHome />} />
            <Route path="nova-oferta" element={<CreateJobPage />} />
            <Route path="ofertas" element={<MyJobsPage />} />
            <Route path="ofertas/:jobId/candidaturas" element={<JobApplicationsPage />} />
            <Route path="candidatos/:candidateId" element={<CandidateProfilePage />} />
          </Routes>
        </div>
      </div>
    </Layout>
  );
}
