import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { countDocuments, getDocument, queryDocuments, setDocument, updateDocument } from '@/integrations/firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  MapPin,
  ArrowLeft,
  Search,
  Eye,
  Pencil,
  Pause,
  Play,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface JobOffer {
  id: string;
  title: string;
  description?: string | null;
  location: string | null;
  status: string;
  applications_count: number | null;
  created_at: string;
}

type StatusFilter = 'all' | 'active' | 'in_review' | 'paused' | 'closed';

const PAGE_SIZE = 8;

type OfferFilterOp = '==' | 'in' | '>=' | '<=';

export default function MyJobsPage() {
  const { user, profile, profileData } = useAuth();
  const { language, t } = useLanguage();
  const { toast } = useToast();
  const [companyId, setCompanyId] = useState<string | null>(null);
  /** IDs usados em job_offers.company_id (uid canónico + doc legado, se existir). */
  const [jobOfferCompanyIds, setJobOfferCompanyIds] = useState<string[]>([]);
  const [jobs, setJobs] = useState<JobOffer[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingList, setLoadingList] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [stats, setStats] = useState({ total: 0, active: 0, paused: 0, closed: 0 });
  const [filteredCount, setFilteredCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCursors, setPageCursors] = useState<(string | null)[]>([null]);
  const [hasNextPage, setHasNextPage] = useState(false);

  useEffect(() => {
    fetchCompanyAndBootstrap();
  }, [user]);

  useEffect(() => {
    if (!companyId || jobOfferCompanyIds.length === 0) return;
    setPageIndex(0);
    setPageCursors([null]);
    void fetchStats(jobOfferCompanyIds);
    void fetchPage({ companyIds: jobOfferCompanyIds, cursor: null, nextPageIndex: 0 });
  }, [companyId, jobOfferCompanyIds, statusFilter, sortDir, dateFrom, dateTo]);

  async function fetchCompanyAndBootstrap() {
    if (!user) return;
    setLoadingInitial(true);

    const uid = user.uid;

    try {
      const direct = await getDocument<{
        id: string;
        user_id?: string;
        userId?: string;
        company_name?: string;
        verified?: boolean;
      }>('companies', uid);

      if (direct) {
        const patch: Record<string, unknown> = {};
        if (direct.user_id !== uid && direct.userId !== uid) patch.user_id = uid;
        if (typeof direct.company_name !== 'string' || !direct.company_name.trim()) {
          patch.company_name =
            (profileData?.name && profileData.name.trim() ? profileData.name.trim() : null) ??
            (profile?.name && profile.name.trim() ? profile.name.trim() : null) ??
            (user.displayName && user.displayName.trim() ? user.displayName.trim() : null) ??
            user.email ??
            'Empresa';
        }
        if (typeof direct.verified !== 'boolean') patch.verified = false;
        if (Object.keys(patch).length > 0) await setDocument('companies', uid, patch, true);
        setCompanyId(uid);
        setJobOfferCompanyIds([uid]);
        return;
      }

      const legacyRows = await queryDocuments<{ id: string; company_name?: string; verified?: boolean }>(
        'companies',
        [{ field: 'user_id', operator: '==', value: uid }],
        undefined,
        1
      );
      const legacy = legacyRows[0];
      if (legacy) {
        const baseName =
          (typeof legacy.company_name === 'string' && legacy.company_name.trim()
            ? legacy.company_name.trim()
            : null) ??
          (profileData?.name && profileData.name.trim() ? profileData.name.trim() : null) ??
          (profile?.name && profile.name.trim() ? profile.name.trim() : null) ??
          (user.displayName && user.displayName.trim() ? user.displayName.trim() : null) ??
          user.email ??
          'Empresa';

        await setDocument(
          'companies',
          uid,
          {
            user_id: uid,
            company_name: baseName,
            verified: typeof legacy.verified === 'boolean' ? legacy.verified : false,
            createdAt: new Date().toISOString(),
          },
          true
        );
        setCompanyId(uid);
        setJobOfferCompanyIds(legacy.id !== uid ? [uid, legacy.id] : [uid]);
        return;
      }

      if (profile?.role === 'company') {
        const baseName =
          (profileData?.name && profileData.name.trim() ? profileData.name.trim() : null) ??
          (profile?.name && profile.name.trim() ? profile.name.trim() : null) ??
          (user.displayName && user.displayName.trim() ? user.displayName.trim() : null) ??
          user.email ??
          'Empresa';
        await setDocument(
          'companies',
          uid,
          { user_id: uid, company_name: baseName, verified: false, createdAt: new Date().toISOString() },
          true
        );
        setCompanyId(uid);
        setJobOfferCompanyIds([uid]);
        return;
      }

      setCompanyId(null);
      setJobOfferCompanyIds([]);
    } catch (error) {
      console.error('Error fetching company:', error);
      setCompanyId(null);
      setJobOfferCompanyIds([]);
    } finally {
      setLoadingInitial(false);
    }
  }

  function normalizeStatus(status: string): 'active' | 'in_review' | 'paused' | 'closed' | 'other' {
    if (status === 'active') return 'active';
    if (status === 'pending_review') return 'in_review';
    if (status === 'paused') return 'paused';
    if (status === 'closed' || status === 'rejected') return 'closed';
    return 'other';
  }

  const statusFilters = useMemo(
    () => [
      { key: 'all' as const, label: t.get('company.offers.filters.all') },
      { key: 'active' as const, label: t.get('company.offers.filters.active') },
      { key: 'in_review' as const, label: t.get('company.offers.filters.in_review') },
      { key: 'paused' as const, label: t.get('company.offers.filters.paused') },
      { key: 'closed' as const, label: t.get('company.offers.filters.closed') },
    ],
    [t]
  );

  function toIsoDateStart(value: string): string {
    const [y, m, d] = value.split('-').map((p) => Number(p));
    const date = new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
    return date.toISOString();
  }

  function toIsoDateEnd(value: string): string {
    const [y, m, d] = value.split('-').map((p) => Number(p));
    const date = new Date(y, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999);
    return date.toISOString();
  }

  function companyScopeFilters(companyIds: string[]): { field: string; operator: OfferFilterOp; value: unknown }[] {
    const ids = Array.from(new Set(companyIds.filter(Boolean)));
    if (ids.length === 0) return [];
    if (ids.length === 1) return [{ field: 'company_id', operator: '==', value: ids[0] }];
    return [{ field: 'company_id', operator: 'in', value: ids }];
  }

  function buildOfferFilters(args: {
    companyIds: string[];
    statusFilter: StatusFilter;
    dateFrom: string;
    dateTo: string;
  }) {
    const filters: { field: string; operator: OfferFilterOp; value: unknown }[] = [...companyScopeFilters(args.companyIds)];

    if (args.statusFilter === 'active') {
      filters.push({ field: 'status', operator: '==', value: 'active' });
    } else if (args.statusFilter === 'in_review') {
      filters.push({ field: 'status', operator: '==', value: 'pending_review' });
    } else if (args.statusFilter === 'paused') {
      filters.push({ field: 'status', operator: '==', value: 'paused' });
    } else if (args.statusFilter === 'closed') {
      filters.push({ field: 'status', operator: 'in', value: ['closed', 'rejected'] });
    }

    if (args.dateFrom) {
      filters.push({ field: 'created_at', operator: '>=', value: toIsoDateStart(args.dateFrom) });
    }

    if (args.dateTo) {
      filters.push({ field: 'created_at', operator: '<=', value: toIsoDateEnd(args.dateTo) });
    }

    return filters;
  }

  async function fetchStats(companyIds: string[]) {
    const scope = companyScopeFilters(companyIds);
    if (scope.length === 0) return;
    try {
      const [total, active, paused, closed] = await Promise.all([
        countDocuments('job_offers', scope),
        countDocuments('job_offers', [...scope, { field: 'status', operator: '==', value: 'active' }]),
        countDocuments('job_offers', [...scope, { field: 'status', operator: '==', value: 'paused' }]),
        countDocuments('job_offers', [...scope, { field: 'status', operator: 'in', value: ['closed', 'rejected'] }]),
      ]);
      setStats({ total, active, paused, closed });
    } catch (error) {
      console.error('Error fetching offers stats:', error);
    }
  }

  async function fetchPage(args: { companyIds: string[]; cursor: string | null; nextPageIndex: number }) {
    if (args.companyIds.length === 0) {
      setJobs([]);
      setFilteredCount(0);
      setHasNextPage(false);
      return;
    }
    setLoadingList(true);
    try {
      const filters = buildOfferFilters({ companyIds: args.companyIds, statusFilter, dateFrom, dateTo });
      const total = await countDocuments('job_offers', filters);
      setFilteredCount(total);

      const data = await queryDocuments<JobOffer>(
        'job_offers',
        filters,
        { field: 'created_at', direction: sortDir },
        PAGE_SIZE + 1,
        args.cursor ? [args.cursor] : undefined
      );

      const hasNext = data.length > PAGE_SIZE;
      const pageJobs = data.slice(0, PAGE_SIZE);

      const counts = await Promise.all(
        pageJobs.map((job) => countDocuments('job_applications', [{ field: 'job_id', operator: '==', value: job.id }]))
      );
      const withCounts = pageJobs.map((job, idx) => ({ ...job, applications_count: counts[idx] }));
      setJobs(withCounts);
      setHasNextPage(hasNext);

      const lastCreatedAt = pageJobs[pageJobs.length - 1]?.created_at ?? null;
      setPageCursors((prev) => {
        const next = prev.slice(0, args.nextPageIndex + 1);
        if (lastCreatedAt && next.length === args.nextPageIndex + 1) {
          next.push(lastCreatedAt);
        }
        return next;
      });
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setJobs([]);
      setHasNextPage(false);
    } finally {
      setLoadingList(false);
    }
  }

  const getStatusConfig = (status: string) => {
    const normalized = normalizeStatus(status);
    if (normalized === 'active') return { label: t.get('company.offers.status.active'), color: 'bg-emerald-100 text-emerald-700' };
    if (normalized === 'in_review') return { label: t.get('company.offers.status.pending_review'), color: 'bg-sky-100 text-sky-700' };
    if (normalized === 'paused') return { label: t.get('company.offers.status.paused'), color: 'bg-amber-100 text-amber-700' };
    if (normalized === 'closed') return { label: t.get('company.offers.status.closed'), color: 'bg-slate-100 text-slate-700' };
    return { label: t.get('company.offers.status.other'), color: 'bg-muted text-muted-foreground' };
  };

  const locale = language === 'en' ? 'en-GB' : language === 'es' ? 'es-ES' : 'pt-PT';
  const numberFormatter = new Intl.NumberFormat(locale);
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    [locale]
  );

  function formatDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
  }

  const visibleJobs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return jobs;
    return jobs.filter((job) => {
      const title = (job.title ?? '').toLowerCase();
      const location = (job.location ?? '').toLowerCase();
      return title.includes(query) || location.includes(query);
    });
  }, [jobs, searchQuery]);

  const shownFrom = filteredCount === 0 ? 0 : pageIndex * PAGE_SIZE + 1;
  const shownTo = Math.min(pageIndex * PAGE_SIZE + visibleJobs.length, filteredCount);

  async function goToPrevPage() {
    if (!companyId || jobOfferCompanyIds.length === 0 || pageIndex === 0) return;
    const prevIndex = pageIndex - 1;
    const cursor = pageCursors[prevIndex] ?? null;
    setPageIndex(prevIndex);
    await fetchPage({ companyIds: jobOfferCompanyIds, cursor, nextPageIndex: prevIndex });
  }

  async function updateOfferStatus(job: JobOffer, nextStatus: 'active' | 'paused' | 'closed') {
    try {
      await updateDocument('job_offers', job.id, { status: nextStatus });
      toast({ title: t.get('company.offers.toast.updatedTitle'), description: t.get('company.offers.toast.updatedDesc') });
      if (companyId && jobOfferCompanyIds.length > 0) {
        void fetchStats(jobOfferCompanyIds);
        const cursor = pageCursors[pageIndex] ?? null;
        void fetchPage({ companyIds: jobOfferCompanyIds, cursor, nextPageIndex: pageIndex });
      }
    } catch (error) {
      console.error('Error updating offer status:', error);
      toast({
        title: t.get('company.offers.toast.updateErrorTitle'),
        description: t.get('company.offers.toast.updateErrorDesc'),
        variant: 'destructive',
      });
    }
  }

  if (loadingInitial) {
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
        {t.get('company.offers.backToDashboard')}
      </Link>

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t.get('company.offers.manageTitle')}</h1>
          <p className="text-muted-foreground mt-1">{t.get('company.offers.manageSubtitle')}</p>
        </div>
        <Link to="/dashboard/empresa/nova-oferta" className="shrink-0">
          <Button className="w-full md:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            {t.get('company.offers.actions.publishNew')}
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="cpc-card p-5 border-l-4 border-l-slate-400">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('company.offers.kpis.total')}</p>
          <p className="text-3xl font-bold mt-2">{numberFormatter.format(stats.total)}</p>
        </div>
        <div className="cpc-card p-5 border-l-4 border-l-emerald-500">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('company.offers.kpis.active')}</p>
          <p className="text-3xl font-bold mt-2">{numberFormatter.format(stats.active)}</p>
        </div>
        <div className="cpc-card p-5 border-l-4 border-l-amber-500">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('company.offers.kpis.paused')}</p>
          <p className="text-3xl font-bold mt-2">{numberFormatter.format(stats.paused)}</p>
        </div>
        <div className="cpc-card p-5 border-l-4 border-l-slate-500">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('company.offers.kpis.closed')}</p>
          <p className="text-3xl font-bold mt-2">{numberFormatter.format(stats.closed)}</p>
        </div>
      </div>

      <div className="cpc-card overflow-hidden">
        <div className="p-4 md:p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {statusFilters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  statusFilter === f.key ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                }`}
                aria-pressed={statusFilter === f.key}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="w-full md:w-[320px] relative">
            <Search className="h-4 w-4 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2" />
            <Input
              id="offers-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.get('company.offers.searchPlaceholder')}
              className="pl-11 rounded-full bg-muted/30 border-muted"
              aria-label={t.get('company.offers.searchAria')}
            />
          </div>
        </div>

        <div className="px-4 md:px-6 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2">
              <label
                htmlFor="offers-date-from"
                className="text-xs font-semibold tracking-widest text-muted-foreground"
              >
                {t.get('company.offers.filters.dateFrom')}
              </label>
              <Input
                id="offers-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-10 w-full sm:w-[170px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <label
                htmlFor="offers-date-to"
                className="text-xs font-semibold tracking-widest text-muted-foreground"
              >
                {t.get('company.offers.filters.dateTo')}
              </label>
              <Input
                id="offers-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-10 w-full sm:w-[170px]"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-widest text-muted-foreground">{t.get('company.offers.filters.sort')}</span>
            <select
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')}
              className="h-10 px-3 rounded-lg border border-input bg-background"
              aria-label={t.get('company.offers.filters.sortAria')}
            >
              <option value="desc">{t.get('company.offers.filters.sortNewest')}</option>
              <option value="asc">{t.get('company.offers.filters.sortOldest')}</option>
            </select>
          </div>
        </div>

        <div className="p-4 md:p-6">
          {loadingList ? (
            <div className="py-12 text-center text-sm text-muted-foreground">{t.get('company.offers.loading')}</div>
          ) : filteredCount === 0 && statusFilter === 'all' && !dateFrom && !dateTo ? (
            <div className="py-14 text-center">
              <p className="text-lg font-semibold">{t.get('company.offers.empty.title')}</p>
              <p className="text-sm text-muted-foreground mt-2">{t.get('company.offers.empty.subtitle')}</p>
              <Link to="/dashboard/empresa/nova-oferta" className="inline-block mt-6">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  {t.get('company.offers.empty.cta')}
                </Button>
              </Link>
            </div>
          ) : visibleJobs.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">{t.get('company.offers.empty.filtered')}</div>
          ) : (
            <div className="space-y-4">
              {visibleJobs.map((job) => {
                const statusConfig = getStatusConfig(job.status);
                const normalized = normalizeStatus(job.status);
                const isClosed = normalized === 'closed';
                const isActive = normalized === 'active';
                const isInReview = normalized === 'in_review';
                const applicants = job.applications_count || 0;
                return (
                  <div key={job.id} className="rounded-2xl border bg-background p-4 md:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{job.title}</h3>
                        {job.description ? (
                          <p className="text-xs text-muted-foreground mt-1 truncate">{job.description}</p>
                        ) : null}
                      </div>
                      <span
                        className={`shrink-0 inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${statusConfig.color}`}
                      >
                        {statusConfig.label}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-muted-foreground">
                      <div className="flex flex-wrap items-center gap-3">
                        {job.location ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {job.location}
                          </span>
                        ) : null}
                        <span>{formatDate(job.created_at)}</span>
                        <span>
                          <span className="font-semibold text-foreground">{numberFormatter.format(applicants)}</span>{' '}
                          {t.get('company.offers.table.candidatesLabel')}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Link
                        to={`/dashboard/empresa/ofertas/${job.id}/candidaturas`}
                        className="h-10 px-3 rounded-xl border bg-background hover:bg-muted inline-flex items-center gap-2"
                        aria-label={t.get('company.offers.actions.viewCandidates')}
                      >
                        <Eye className="h-4 w-4 text-primary" />
                        <span className="hidden sm:inline">{t.get('company.offers.actions.viewCandidates')}</span>
                      </Link>

                      <Link
                        to={`/dashboard/empresa/nova-oferta?edit=${job.id}`}
                        className="h-10 px-3 rounded-xl border bg-background hover:bg-muted inline-flex items-center gap-2"
                        aria-label={t.get('company.offers.actions.edit')}
                      >
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                        <span className="hidden sm:inline">{t.get('company.offers.actions.edit')}</span>
                      </Link>

                      <button
                        type="button"
                        onClick={() => updateOfferStatus(job, isActive ? 'paused' : 'active')}
                        className="h-10 px-3 rounded-xl border bg-background hover:bg-muted inline-flex items-center gap-2 disabled:opacity-50"
                        aria-label={isActive ? t.get('company.offers.actions.pause') : t.get('company.offers.actions.resume')}
                        disabled={isClosed || isInReview}
                      >
                        {isActive ? <Pause className="h-4 w-4 text-muted-foreground" /> : <Play className="h-4 w-4 text-emerald-600" />}
                        <span className="hidden sm:inline">
                          {isActive ? t.get('company.offers.actions.pause') : t.get('company.offers.actions.resume')}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => updateOfferStatus(job, 'closed')}
                        className="h-10 px-3 rounded-xl border bg-background hover:bg-muted inline-flex items-center gap-2 disabled:opacity-50"
                        aria-label={t.get('company.offers.actions.close')}
                        disabled={isClosed}
                      >
                        <XCircle className="h-4 w-4 text-red-600" />
                        <span className="hidden sm:inline">{t.get('company.offers.actions.close')}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t p-4 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {t.get('company.offers.pagination.summary', { from: shownFrom, to: shownTo, total: filteredCount })}
          </p>
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={goToPrevPage}
              className="h-10 w-10 rounded-xl border bg-background hover:bg-muted flex items-center justify-center disabled:opacity-50"
              aria-label={t.get('company.offers.pagination.prev')}
              disabled={pageIndex === 0 || loadingList}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!companyId || jobOfferCompanyIds.length === 0 || !hasNextPage) return;
                const nextIndex = pageIndex + 1;
                const cursor = pageCursors[nextIndex] ?? jobs[jobs.length - 1]?.created_at ?? null;
                setPageIndex(nextIndex);
                await fetchPage({ companyIds: jobOfferCompanyIds, cursor, nextPageIndex: nextIndex });
              }}
              className="h-10 w-10 rounded-xl border bg-background hover:bg-muted flex items-center justify-center disabled:opacity-50"
              aria-label={t.get('company.offers.pagination.next')}
              disabled={!hasNextPage || loadingList}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
