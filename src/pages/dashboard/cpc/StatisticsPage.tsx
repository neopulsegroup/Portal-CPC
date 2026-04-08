import { useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { queryDocuments, getDocument } from '@/integrations/firebase/firestore';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Loader2, BarChart3, PieChart, Download, FileText, FileSpreadsheet, Users, CheckCircle } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart as RBarChart,
  Bar,
} from 'recharts';

import { buildStatisticsReport, exportStatisticsDocx, exportStatisticsPdf, exportStatisticsXlsx } from './statisticsExport';

type UserDoc = { id: string; role?: string | null; createdAt?: unknown };
type ProgressDoc = { id: string; user_id?: string | null; trail_id?: string | null; progress_percent?: number | null; modules_completed?: number | null; completed_at?: unknown | null; started_at?: unknown | null };
type ProfileDoc = {
  currentLocation?: string | null;
  region?: 'Lisboa' | 'Norte' | 'Centro' | 'Alentejo' | 'Algarve' | 'Outra' | null;
  regionOther?: string | null;
};
type TrailDoc = { title?: string | null };

function parseUnknownDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object') {
    if ('toDate' in (value as Record<string, unknown>) && typeof (value as { toDate?: unknown }).toDate === 'function') {
      const d = (value as { toDate: () => Date }).toDate();
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if ('seconds' in (value as Record<string, unknown>) && typeof (value as { seconds?: unknown }).seconds === 'number') {
      const d = new Date(((value as { seconds: number }).seconds) * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

function normalizeText(value?: string | null): string {
  if (!value) return '';
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function mapLocationToRegion(value?: string | null): 'Lisboa' | 'Norte' | 'Centro' | 'Alentejo' | 'Algarve' | 'Desconhecida' {
  const v = normalizeText(value);
  if (!v) return 'Desconhecida';
  const match = (tokens: string[]) => tokens.some((t) => v.includes(t));
  if (match(['lisboa', 'lx', 'amadora', 'sintra', 'odivelas', 'loures', 'oeiras', 'cascais', 'mafra', 'vila franca'])) return 'Lisboa';
  if (match(['porto', 'braga', 'vila real', 'braganca', 'viana do castelo', 'ave', 'minho', 'douro'])) return 'Norte';
  if (match(['aveiro', 'coimbra', 'leiria', 'viseu', 'castelo branco', 'guarda', 'regiao centro', 'centro'])) return 'Centro';
  if (match(['portalegre', 'evora', 'beja', 'alentejo'])) return 'Alentejo';
  if (match(['faro', 'albufeira', 'portimao', 'lagos', 'algarve'])) return 'Algarve';
  return 'Desconhecida';
}

function mapProfileToRegion(profile?: ProfileDoc | null): 'Lisboa' | 'Norte' | 'Centro' | 'Alentejo' | 'Algarve' | 'Desconhecida' {
  const region = profile?.region ?? null;
  if (region === 'Lisboa' || region === 'Norte' || region === 'Centro' || region === 'Alentejo' || region === 'Algarve') return region;
  if (region === 'Outra') {
    const fromOther = mapLocationToRegion(profile?.regionOther ?? null);
    if (fromOther !== 'Desconhecida') return fromOther;
  }
  const fromLocation = mapLocationToRegion(profile?.currentLocation ?? null);
  return fromLocation;
}

function startEndForPeriod(year: number, period: 'year' | 'q1' | 'q2' | 'q3' | 'q4'): { start: Date; end: Date } {
  if (period === 'q1') return { start: new Date(year, 0, 1, 0, 0, 0), end: new Date(year, 2, 31, 23, 59, 59, 999) };
  if (period === 'q2') return { start: new Date(year, 3, 1, 0, 0, 0), end: new Date(year, 5, 30, 23, 59, 59, 999) };
  if (period === 'q3') return { start: new Date(year, 6, 1, 0, 0, 0), end: new Date(year, 8, 30, 23, 59, 59, 999) };
  if (period === 'q4') return { start: new Date(year, 9, 1, 0, 0, 0), end: new Date(year, 11, 31, 23, 59, 59, 999) };
  return { start: new Date(year, 0, 1, 0, 0, 0), end: new Date(year, 11, 31, 23, 59, 59, 999) };
}

export default function StatisticsPage() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [period, setPeriod] = useState<'year' | 'q1' | 'q2' | 'q3' | 'q4'>('year');
  const [regionFilter, setRegionFilter] = useState<'all' | 'Lisboa' | 'Norte' | 'Centro' | 'Alentejo' | 'Algarve' | 'Desconhecida'>('all');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [progressByUser, setProgressByUser] = useState<Map<string, ProgressDoc[]>>(new Map());
  const [regionByUser, setRegionByUser] = useState<Map<string, 'Lisboa' | 'Norte' | 'Centro' | 'Alentejo' | 'Algarve' | 'Desconhecida'>>(new Map());
  const [trailTitleById, setTrailTitleById] = useState<Map<string, string>>(new Map());
  const [exporting, setExporting] = useState<{ format: 'xlsx' | 'pdf' | 'docx'; progress: number; message: string } | null>(null);
  const xlsxModuleRef = useRef<typeof import('xlsx') | null>(null);
  const xlsxLoaderRef = useRef<Promise<typeof import('xlsx')> | null>(null);

  const locale = useMemo(() => {
    if (language === 'en') return 'en-GB';
    if (language === 'es') return 'es-ES';
    return 'pt-PT';
  }, [language]);
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const monthLabels = useMemo(() => {
    const d = new Date(2026, 0, 1);
    const labels: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      d.setMonth(i);
      labels.push(d.toLocaleString(locale, { month: 'short' }));
    }
    return labels;
  }, [locale]);

  const dateRange = useMemo(() => startEndForPeriod(year, period), [year, period]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const d = parseUnknownDate(u.createdAt);
      if (!d) return false;
      if (d < dateRange.start || d > dateRange.end) return false;
      if (regionFilter !== 'all' && regionByUser.get(u.id) !== regionFilter) return false;
      return true;
    });
  }, [dateRange.end, dateRange.start, regionByUser, regionFilter, users]);

  const kpis = useMemo(() => {
    const total = filteredUsers.length;
    let started = 0;
    let completed = 0;
    filteredUsers.forEach((u) => {
      const arr = progressByUser.get(u.id) ?? [];
      const inRange = (value: unknown): boolean => {
        const d = parseUnknownDate(value);
        if (!d) return false;
        return d >= dateRange.start && d <= dateRange.end;
      };
      const userCreatedAt = parseUnknownDate(u.createdAt);
      const userCreatedInRange = !!userCreatedAt && userCreatedAt >= dateRange.start && userCreatedAt <= dateRange.end;
      const s = arr.some((p) =>
        (p.started_at && inRange(p.started_at)) ||
        (!p.started_at && ((p.progress_percent ?? 0) > 0 || (p.modules_completed ?? 0) > 0) && userCreatedInRange)
      );
      const c = arr.some((p) => !!p.completed_at && inRange(p.completed_at));
      if (s) started += 1;
      if (c) completed += 1;
    });
    const startedPct = total > 0 ? Math.round((started / total) * 100) : 0;
    const completedPct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const successRate = started > 0 ? Math.round((completed / started) * 100) : 0;
    return { total, started, completed, startedPct, completedPct, successRate };
  }, [dateRange.end, dateRange.start, filteredUsers, progressByUser]);

  const monthly = useMemo(() => {
    const buckets = new Array(12).fill(0);
    filteredUsers.forEach((u) => {
      const d = parseUnknownDate(u.createdAt);
      if (!d) return;
      if (d < dateRange.start || d > dateRange.end) return;
      buckets[d.getMonth()] += 1;
    });
    return buckets.map((count, idx) => ({ month: monthLabels[idx], registrations: count }));
  }, [dateRange.end, dateRange.start, filteredUsers, monthLabels]);

  const trailPerf = useMemo(() => {
    const inRange = (value: unknown): boolean => {
      const d = parseUnknownDate(value);
      if (!d) return false;
      return d >= dateRange.start && d <= dateRange.end;
    };
    const completedByTrail = new Map<string, number>();
    filteredUsers.forEach((u) => {
      const arr = progressByUser.get(u.id) ?? [];
      arr.forEach((p) => {
        const trailId = p.trail_id ?? '';
        if (!trailId) return;
        if (!p.completed_at) return;
        if (!inRange(p.completed_at)) return;
        completedByTrail.set(trailId, (completedByTrail.get(trailId) ?? 0) + 1);
      });
    });
    return Array.from(completedByTrail.entries())
      .map(([trailId, completed]) => ({ trailId, trail: trailTitleById.get(trailId) ?? trailId, completed }))
      .sort((a, b) => b.completed - a.completed);
  }, [dateRange.end, dateRange.start, filteredUsers, progressByUser, trailTitleById]);

  const regionStats = useMemo(() => {
    const agg = new Map<string, { total: number; started: number; completed: number }>();
    filteredUsers.forEach((u) => {
      const region = regionByUser.get(u.id) ?? 'Desconhecida';
      const arr = progressByUser.get(u.id) ?? [];
      const inRange = (value: unknown): boolean => {
        const d = parseUnknownDate(value);
        if (!d) return false;
        return d >= dateRange.start && d <= dateRange.end;
      };
      const userCreatedAt = parseUnknownDate(u.createdAt);
      const userCreatedInRange = !!userCreatedAt && userCreatedAt >= dateRange.start && userCreatedAt <= dateRange.end;
      const s = arr.some((p) =>
        (p.started_at && inRange(p.started_at)) ||
        (!p.started_at && ((p.progress_percent ?? 0) > 0 || (p.modules_completed ?? 0) > 0) && userCreatedInRange)
      );
      const c = arr.some((p) => !!p.completed_at);
      const prev = agg.get(region) ?? { total: 0, started: 0, completed: 0 };
      agg.set(region, { total: prev.total + 1, started: prev.started + (s ? 1 : 0), completed: prev.completed + (c ? 1 : 0) });
    });
    return Array.from(agg.entries())
      .map(([region, v]) => ({
        region,
        total: v.total,
        started: v.started,
        completed: v.completed,
        completionRate: v.started > 0 ? Math.round((v.completed / v.started) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredUsers, progressByUser, regionByUser]);

  useEffect(() => {
    if (!xlsxLoaderRef.current) {
      xlsxLoaderRef.current = import('xlsx');
      xlsxLoaderRef.current.then((m) => {
        xlsxModuleRef.current = m;
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      try {
        const migrants = await queryDocuments<UserDoc>('users', [
          { field: 'role', operator: 'in', value: ['migrant', 'Migrant', 'MIGRANT'] },
        ]);
        if (ignore) return;
        setUsers(migrants);
        const ids = migrants.map((m) => m.id);
        const chunks: string[][] = [];
        for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
        const progressAll: ProgressDoc[] = [];
        for (const ch of chunks) {
          const part = await queryDocuments<ProgressDoc>('user_trail_progress', [{ field: 'user_id', operator: 'in', value: ch }]);
          progressAll.push(...part);
        }
        if (ignore) return;
        const byUser = new Map<string, ProgressDoc[]>();
        progressAll.forEach((p) => {
          const uid = p.user_id ?? '';
          if (!uid) return;
          const arr = byUser.get(uid) ?? [];
          arr.push(p);
          byUser.set(uid, arr);
        });
        setProgressByUser(byUser);
        const trailIds = Array.from(new Set(progressAll.map((p) => p.trail_id).filter((v): v is string => typeof v === 'string' && v.length > 0)));
        const trailDocs = await Promise.all(trailIds.map(async (trailId) => {
          try {
            const doc = await getDocument<TrailDoc>('trails', trailId);
            const title = typeof doc?.title === 'string' ? doc.title.trim() : '';
            return { trailId, title: title || trailId };
          } catch {
            return { trailId, title: trailId };
          }
        }));
        if (ignore) return;
        setTrailTitleById(new Map(trailDocs.map((d) => [d.trailId, d.title])));
        const profiles = await Promise.all(ids.map(async (uid) => {
          try {
            const doc = await getDocument<ProfileDoc>('profiles', uid);
            return { uid, profile: doc ?? null };
          } catch {
            return { uid, profile: null };
          }
        }));
        if (ignore) return;
        const regionMap = new Map<string, 'Lisboa' | 'Norte' | 'Centro' | 'Alentejo' | 'Algarve' | 'Desconhecida'>();
        profiles.forEach((p) => {
          regionMap.set(p.uid, mapProfileToRegion(p.profile));
        });
        setRegionByUser(regionMap);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => { ignore = true; };
  }, [period, year]);

  function getExportTimestamp(now = new Date()): string {
    const y = String(now.getFullYear());
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${y}${m}${d}_${hh}${mm}${ss}`;
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const report = useMemo(() => {
    return buildStatisticsReport({
      year,
      period,
      regionFilter,
      dateRange,
      users,
      filteredUsers,
      regionByUser,
      progressByUser,
      kpis,
      regionStats,
      monthly,
      trailPerf,
      parseUnknownDate,
    });
  }, [dateRange, filteredUsers, kpis, monthly, period, progressByUser, regionByUser, regionFilter, regionStats, trailPerf, users, year]);

  function yieldToUi(): Promise<void> {
    return new Promise((resolve) => {
      window.setTimeout(() => resolve(), 0);
    });
  }

  async function handleExportXlsx() {
    setExporting({ format: 'xlsx', progress: 5, message: 'A preparar exportação...' });
    try {
      await yieldToUi();
      if (!xlsxModuleRef.current) {
        setExporting({ format: 'xlsx', progress: 15, message: 'A carregar módulo XLSX...' });
        await yieldToUi();
        if (!xlsxLoaderRef.current) xlsxLoaderRef.current = import('xlsx');
        xlsxModuleRef.current = await xlsxLoaderRef.current;
      }
      const XLSX = xlsxModuleRef.current;
      if (!XLSX) throw new Error('Módulo XLSX indisponível.');
      setExporting({ format: 'xlsx', progress: 35, message: 'A gerar planilhas...' });
      await yieldToUi();
      const out = await exportStatisticsXlsx(report, XLSX);
      setExporting({ format: 'xlsx', progress: 85, message: 'A finalizar ficheiro...' });
      await yieldToUi();
      const ts = getExportTimestamp();
      downloadBlob(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `estatisticas_${year}_${ts}.xlsx`);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Não foi possível exportar o relatório.';
      toast({ title: 'Exportação XLSX', description: message, variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  }

  async function handleExportPdf() {
    setExporting({ format: 'pdf', progress: 5, message: 'A preparar exportação...' });
    try {
      await yieldToUi();
      setExporting({ format: 'pdf', progress: 40, message: 'A compor relatório...' });
      await yieldToUi();
      const bytes = await exportStatisticsPdf(report);
      setExporting({ format: 'pdf', progress: 85, message: 'A finalizar ficheiro...' });
      await yieldToUi();
      const ts = getExportTimestamp();
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `relatorio_estatisticas_${year}_${ts}.pdf`);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Não foi possível exportar o relatório.';
      toast({ title: 'Exportação PDF', description: message, variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  }

  async function handleExportDocx() {
    setExporting({ format: 'docx', progress: 5, message: 'A preparar exportação...' });
    try {
      await yieldToUi();
      setExporting({ format: 'docx', progress: 30, message: 'A carregar gerador DOCX...' });
      await yieldToUi();
      const docx = await import('docx');
      setExporting({ format: 'docx', progress: 60, message: 'A compor relatório...' });
      await yieldToUi();
      const blob = await exportStatisticsDocx(report, docx);
      setExporting({ format: 'docx', progress: 85, message: 'A finalizar ficheiro...' });
      await yieldToUi();
      const ts = getExportTimestamp();
      downloadBlob(blob, `relatorio_estatisticas_${year}_${ts}.docx`);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Não foi possível exportar o relatório.';
      toast({ title: 'Exportação DOCX', description: message, variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  }

  const kpiCards = [
    { key: 'total', title: 'Migrantes Inscritos', value: numberFormatter.format(kpis.total), icon: Users },
    { key: 'started', title: 'Inícios de Plano', value: numberFormatter.format(kpis.started), icon: PieChart },
    { key: 'completed', title: 'Conclusões Totais', value: numberFormatter.format(kpis.completed), icon: CheckCircle },
    { key: 'successRate', title: 'Taxa de Sucesso', value: `${kpis.successRate}%`, icon: BarChart3 },
    { key: 'startedPct', title: '% Inícios', value: `${kpis.startedPct}%`, icon: BarChart3 },
    { key: 'completedPct', title: '% Conclusões', value: `${kpis.completedPct}%`, icon: BarChart3 },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Estatísticas</h1>
          <p className="text-sm text-muted-foreground">Indicadores e relatórios com filtros temporais</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 6 }).map((_, i) => {
                const y = new Date().getFullYear() + 1 - i;
                return <SelectItem key={y} value={String(y)}>{y}</SelectItem>;
              })}
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={(v) => setPeriod(v as 'year' | 'q1' | 'q2' | 'q3' | 'q4')}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="year">Ano completo</SelectItem>
              <SelectItem value="q1">1º trimestre</SelectItem>
              <SelectItem value="q2">2º trimestre</SelectItem>
              <SelectItem value="q3">3º trimestre</SelectItem>
              <SelectItem value="q4">4º trimestre</SelectItem>
            </SelectContent>
          </Select>
          <Select value={regionFilter} onValueChange={(v) => setRegionFilter(v as typeof regionFilter)}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Região" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as regiões</SelectItem>
              <SelectItem value="Lisboa">Lisboa</SelectItem>
              <SelectItem value="Norte">Norte</SelectItem>
              <SelectItem value="Centro">Centro</SelectItem>
              <SelectItem value="Alentejo">Alentejo</SelectItem>
              <SelectItem value="Algarve">Algarve</SelectItem>
              <SelectItem value="Desconhecida">Desconhecida</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExportPdf} disabled={exporting !== null}>
            {exporting?.format === 'pdf' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />} PDF
          </Button>
          <Button variant="outline" onClick={handleExportDocx} disabled={exporting !== null}>
            {exporting?.format === 'docx' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />} DOCX
          </Button>
          <Button onClick={handleExportXlsx} disabled={exporting !== null}>
            {exporting?.format === 'xlsx' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />} XLSX
          </Button>
        </div>
      </div>

      <Dialog open={exporting !== null}>
        <DialogContent hideClose>
          <DialogHeader>
            <DialogTitle>Exportação em progresso</DialogTitle>
            <DialogDescription>{exporting?.message ?? ''}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Progress value={exporting?.progress ?? 0} className="h-2" />
            <div className="text-xs text-muted-foreground">{exporting ? `${exporting.progress}%` : ''}</div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        {kpiCards.map((k) => (
          <Card key={k.key} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">{k.title}</div>
                <div className="text-2xl font-bold mt-1">{k.value}</div>
              </div>
              <k.icon className="h-6 w-6 text-primary" />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Inscrições por mês em {year}</h2>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="registrations" stroke="#2563eb" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Conclusões por percurso</h2>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RBarChart data={trailPerf.slice(0, 12)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="trail" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="completed" fill="#16a34a" />
              </RBarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Detalhamento Regional</h2>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">Região</th>
                <th className="py-2 pr-4">Total</th>
                <th className="py-2 pr-4">Inícios</th>
                <th className="py-2 pr-4">Conclusões</th>
                <th className="py-2 pr-4">% Conclusão</th>
              </tr>
            </thead>
            <tbody>
              {regionStats.map((r) => (
                <tr key={r.region} className="border-t">
                  <td className="py-2 pr-4">{r.region}</td>
                  <td className="py-2 pr-4">{numberFormatter.format(r.total)}</td>
                  <td className="py-2 pr-4">{numberFormatter.format(r.started)}</td>
                  <td className="py-2 pr-4">{numberFormatter.format(r.completed)}</td>
                  <td className="py-2 pr-4">{r.completionRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>A carregar dados…</span>
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
