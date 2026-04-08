import { describe, expect, it } from 'vitest';

import * as XLSX from 'xlsx';
import * as docx from 'docx';

import { buildStatisticsReport, exportStatisticsDocx, exportStatisticsPdf, exportStatisticsXlsx } from './statisticsExport';

describe('statisticsExport', () => {
  const parseUnknownDate = (value: unknown): Date | null => {
    if (!value) return null;
    if (typeof value === 'string') {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  };

  it('gera PDF estruturado (não vazio)', async () => {
    const report = buildStatisticsReport({
      year: 2026,
      period: 'year',
      regionFilter: 'all',
      dateRange: { start: new Date('2026-01-01T00:00:00.000Z'), end: new Date('2026-12-31T23:59:59.999Z') },
      users: [{ id: 'u1', createdAt: '2026-01-02T00:00:00.000Z' }],
      filteredUsers: [{ id: 'u1', createdAt: '2026-01-02T00:00:00.000Z' }],
      regionByUser: new Map([['u1', 'Lisboa']]),
      progressByUser: new Map(),
      kpis: { total: 1, started: 0, completed: 0, startedPct: 0, completedPct: 0, successRate: 0 },
      regionStats: [{ region: 'Lisboa', total: 1, started: 0, completed: 0, completionRate: 0 }],
      monthly: [{ month: 'jan', registrations: 1 }],
      trailPerf: [],
      parseUnknownDate,
    });

    const bytes = await exportStatisticsPdf(report, { maxTrailRows: 10, maxRawUsers: 10 });
    const header = new TextDecoder().decode(bytes.slice(0, 5));
    expect(header).toBe('%PDF-');
  });

  it('gera XLSX com sheets esperadas', async () => {
    const report = buildStatisticsReport({
      year: 2026,
      period: 'q1',
      regionFilter: 'Lisboa',
      dateRange: { start: new Date('2026-01-01T00:00:00.000Z'), end: new Date('2026-03-31T23:59:59.999Z') },
      users: [{ id: 'u1', createdAt: '2026-01-02T00:00:00.000Z' }],
      filteredUsers: [{ id: 'u1', createdAt: '2026-01-02T00:00:00.000Z' }],
      regionByUser: new Map([['u1', 'Lisboa']]),
      progressByUser: new Map(),
      kpis: { total: 1, started: 0, completed: 0, startedPct: 0, completedPct: 0, successRate: 0 },
      regionStats: [{ region: 'Lisboa', total: 1, started: 0, completed: 0, completionRate: 0 }],
      monthly: [{ month: 'jan', registrations: 1 }],
      trailPerf: [{ trailId: 't1', trail: 'Percurso 1', completed: 0 }],
      parseUnknownDate,
    });

    const buf = await exportStatisticsXlsx(report, XLSX);
    const wb = XLSX.read(buf, { type: 'array' });
    expect(wb.SheetNames).toEqual(['Resumo', 'Regiões', 'Mensal', 'Percursos', 'Base']);
  });

  it('gera DOCX (zip) com conteúdo não vazio', async () => {
    const report = buildStatisticsReport({
      year: 2026,
      period: 'year',
      regionFilter: 'all',
      dateRange: { start: new Date('2026-01-01T00:00:00.000Z'), end: new Date('2026-12-31T23:59:59.999Z') },
      users: [{ id: 'u1', createdAt: '2026-01-02T00:00:00.000Z' }],
      filteredUsers: [{ id: 'u1', createdAt: '2026-01-02T00:00:00.000Z' }],
      regionByUser: new Map([['u1', 'Lisboa']]),
      progressByUser: new Map(),
      kpis: { total: 1, started: 0, completed: 0, startedPct: 0, completedPct: 0, successRate: 0 },
      regionStats: [{ region: 'Lisboa', total: 1, started: 0, completed: 0, completionRate: 0 }],
      monthly: [{ month: 'jan', registrations: 1 }],
      trailPerf: [],
      parseUnknownDate,
    });

    const blob = await exportStatisticsDocx(report, docx, { maxTrailRows: 10, maxRawUsers: 10 });
    const ab = await new Response(blob).arrayBuffer();
    const u8 = new Uint8Array(ab);
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(u8.length).toBeGreaterThan(0);
  });
});
