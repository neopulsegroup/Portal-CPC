import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Briefcase,
  MapPin,
  Clock,
  Search,
  Building,
  ChevronRight,
  Euro,
} from 'lucide-react';

interface JobOffer {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  sector: string | null;
  contract_type: string | null;
  salary_range: string | null;
  created_at: string;
  company: {
    company_name: string;
  } | null;
  isDemo?: boolean;
}

// Demo jobs for when there are no real offers
const DEMO_JOBS: JobOffer[] = [
  {
    id: 'demo-1',
    title: 'Programador Web Junior',
    description: 'Procuramos programador web para desenvolvimento de aplicações. Formação será dada. Ambiente dinâmico e oportunidade de crescimento.',
    location: 'Lisboa',
    sector: 'Tecnologia',
    contract_type: 'full_time',
    salary_range: '1200€ - 1500€',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    company: { company_name: 'TechPT Solutions' },
    isDemo: true,
  },
  {
    id: 'demo-2',
    title: 'Pedreiro Experiente',
    description: 'Procuramos pedreiro com experiência em obras residenciais. Trabalho em equipa, bom ambiente.',
    location: 'Porto',
    sector: 'Construção',
    contract_type: 'full_time',
    salary_range: '1100€ - 1400€',
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    company: { company_name: 'Construções Atlântico' },
    isDemo: true,
  },
  {
    id: 'demo-3',
    title: 'Cozinheiro(a)',
    description: 'Cozinheiro para restaurante tradicional. Especialidade em pratos portugueses. Horário rotativo.',
    location: 'Faro',
    sector: 'Restauração',
    contract_type: 'full_time',
    salary_range: '1000€ - 1200€',
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    company: { company_name: 'Restaurante O Português' },
    isDemo: true,
  },
  {
    id: 'demo-4',
    title: 'Empregado(a) de Mesa',
    description: 'Atendimento ao público em restaurante. Horário rotativo incluindo fins de semana.',
    location: 'Faro',
    sector: 'Restauração',
    contract_type: 'part_time',
    salary_range: '700€ - 850€',
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    company: { company_name: 'Restaurante O Português' },
    isDemo: true,
  },
  {
    id: 'demo-5',
    title: 'Técnico de Limpeza',
    description: 'Limpeza de escritórios e espaços comerciais. Horário: 6h-14h. Disponibilidade imediata.',
    location: 'Coimbra',
    sector: 'Serviços',
    contract_type: 'full_time',
    salary_range: '820€ - 900€',
    created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    company: { company_name: 'CleanPro Serviços' },
    isDemo: true,
  },
  {
    id: 'demo-6',
    title: 'Rececionista de Hotel',
    description: 'Atendimento na receção de hotel 4 estrelas. Turnos rotativos. Inglês fluente necessário.',
    location: 'Albufeira',
    sector: 'Hotelaria',
    contract_type: 'full_time',
    salary_range: '950€ - 1100€',
    created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    company: { company_name: 'Hotelaria Costa' },
    isDemo: true,
  },
  {
    id: 'demo-7',
    title: 'Ajudante de Construção',
    description: 'Função de apoio em obras. Não necessita experiência prévia. Boa condição física.',
    location: 'Porto',
    sector: 'Construção',
    contract_type: 'full_time',
    salary_range: '850€ - 950€',
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    company: { company_name: 'Construções Atlântico' },
    isDemo: true,
  },
  {
    id: 'demo-8',
    title: 'Técnico de Suporte IT',
    description: 'Suporte técnico a clientes empresariais. Horário flexível disponível. Trabalho remoto parcial.',
    location: 'Lisboa (Remoto)',
    sector: 'Tecnologia',
    contract_type: 'full_time',
    salary_range: '1000€ - 1300€',
    created_at: new Date().toISOString(),
    company: { company_name: 'TechPT Solutions' },
    isDemo: true,
  },
];

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [usingDemoData, setUsingDemoData] = useState(false);

  useEffect(() => {
    fetchJobs();
  }, []);

  async function fetchJobs() {
    try {
      const { data } = await supabase
        .from('job_offers')
        .select(`
          id,
          title,
          description,
          location,
          sector,
          contract_type,
          salary_range,
          created_at,
          company_id
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        const companyIds = [...new Set(data.map(j => j.company_id))];
        const { data: companies } = await supabase
          .from('companies')
          .select('id, company_name')
          .in('id', companyIds);

        const jobsWithCompanies = data.map(job => ({
          ...job,
          company: companies?.find(c => c.id === job.company_id) || null
        }));

        setJobs(jobsWithCompanies);
      } else {
        // Use demo data when no real jobs exist
        setJobs(DEMO_JOBS);
        setUsingDemoData(true);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
      // Fallback to demo data on error
      setJobs(DEMO_JOBS);
      setUsingDemoData(true);
    } finally {
      setLoading(false);
    }
  }

  const allJobs = jobs;
  const sectors = ['all', ...new Set(allJobs.map(j => j.sector).filter(Boolean))];
  const locations = ['all', ...new Set(allJobs.map(j => j.location).filter(Boolean))];

  const filteredJobs = allJobs.filter(job => {
    const matchesSearch = 
      job.title.toLowerCase().includes(search.toLowerCase()) ||
      job.description?.toLowerCase().includes(search.toLowerCase()) ||
      job.company?.company_name.toLowerCase().includes(search.toLowerCase());
    const matchesSector = selectedSector === 'all' || job.sector === selectedSector;
    const matchesLocation = selectedLocation === 'all' || job.location === selectedLocation;
    return matchesSearch && matchesSector && matchesLocation;
  });

  const getContractLabel = (type: string | null) => {
    const labels: Record<string, string> = {
      'full_time': 'Tempo Inteiro',
      'part_time': 'Part-time',
      'temporary': 'Temporário',
      'internship': 'Estágio',
    };
    return type ? labels[type] || type : null;
  };

  const getTimeAgo = (date: string) => {
    const now = new Date();
    const posted = new Date(date);
    const diffDays = Math.floor((now.getTime() - posted.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `Há ${diffDays} dias`;
    if (diffDays < 30) return `Há ${Math.floor(diffDays / 7)} semanas`;
    return `Há ${Math.floor(diffDays / 30)} meses`;
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
          <Briefcase className="h-8 w-8 text-primary" />
          Ofertas de Emprego
        </h1>
        <p className="text-muted-foreground mt-1">
          Encontre oportunidades de trabalho em Portugal
        </p>
      </div>

      {/* Demo Data Notice */}
      {usingDemoData && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 rounded-lg p-4 mb-6">
          <p className="text-sm">
            <strong>Modo de demonstração:</strong> Estas são ofertas de exemplo para visualização da plataforma.
          </p>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-card rounded-xl border p-4 mb-8">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por cargo, empresa ou palavra-chave..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="px-4 py-2 rounded-lg border border-input bg-background text-sm"
          >
            <option value="all">Todos os setores</option>
            {sectors.filter(s => s !== 'all').map(sector => (
              <option key={sector} value={sector}>{sector}</option>
            ))}
          </select>

          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="px-4 py-2 rounded-lg border border-input bg-background text-sm"
          >
            <option value="all">Todas as localizações</option>
            {locations.filter(l => l !== 'all').map(location => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground mb-4">
        {filteredJobs.length} oferta(s) encontrada(s)
      </p>

      {/* Jobs List */}
      {filteredJobs.length === 0 ? (
        <div className="bg-card rounded-xl border p-12 text-center">
          <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold mb-2">Nenhuma oferta encontrada</h3>
          <p className="text-muted-foreground">
            Tente ajustar os filtros de pesquisa
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredJobs.map(job => (
            <Link
              key={job.id}
              to={job.isDemo ? '#' : `/dashboard/migrante/emprego/${job.id}`}
              onClick={job.isDemo ? (e) => e.preventDefault() : undefined}
              className="bg-card rounded-xl border p-6 block hover:border-primary/50 hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                      {job.title}
                    </h3>
                    {job.contract_type && (
                      <Badge variant="secondary" className="text-xs">
                        {getContractLabel(job.contract_type)}
                      </Badge>
                    )}
                    {job.isDemo && (
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                        Demo
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3 flex-wrap">
                    {job.company && (
                      <span className="flex items-center gap-1">
                        <Building className="h-4 w-4" />
                        {job.company.company_name}
                      </span>
                    )}
                    {job.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {job.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {getTimeAgo(job.created_at)}
                    </span>
                  </div>

                  {job.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {job.description}
                    </p>
                  )}

                  {job.salary_range && (
                    <p className="text-sm font-medium text-primary flex items-center gap-1">
                      <Euro className="h-4 w-4" />
                      {job.salary_range}
                    </p>
                  )}
                </div>

                <ChevronRight className="h-5 w-5 text-muted-foreground ml-4 flex-shrink-0 group-hover:text-primary transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
