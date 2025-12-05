import { Link, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
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
  Filter,
} from 'lucide-react';

export default function CPCDashboard() {
  const { profile } = useAuth();

  const stats = [
    { label: 'Migrantes Ativos', value: 127, icon: Users, change: '+12 este mês' },
    { label: 'Sessões Hoje', value: 8, icon: Calendar, change: '3 pendentes' },
    { label: 'Pedidos Urgentes', value: 5, icon: AlertCircle, change: 'Requer atenção' },
    { label: 'Colocações', value: 23, icon: Briefcase, change: '+5 este mês' },
  ];

  const recentMigrants = [
    { id: 1, name: 'Maria Silva', status: 'Triagem completa', urgency: false, date: '02 Dez' },
    { id: 2, name: 'Ahmed Hassan', status: 'Aguarda sessão', urgency: true, date: '01 Dez' },
    { id: 3, name: 'Ana Pereira', status: 'Em acompanhamento', urgency: false, date: '30 Nov' },
  ];

  const todaySessions = [
    { id: 1, migrant: 'Carlos Santos', type: 'Mediação', time: '10:00', status: 'Concluída' },
    { id: 2, migrant: 'Fatima Ahmed', type: 'Jurídico', time: '11:30', status: 'Em curso' },
    { id: 3, migrant: 'João Lima', type: 'Psicológico', time: '14:00', status: 'Agendada' },
  ];

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
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                Filtrar
              </Button>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Exportar
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
                  {stat.label === 'Pedidos Urgentes' && stat.value > 0 && (
                    <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                  )}
                </div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-xs text-primary mt-2">{stat.change}</p>
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
        </Routes>
      </div>
    </Layout>
  );
}
import CandidateProfilePage from './company/CandidateProfilePage';
