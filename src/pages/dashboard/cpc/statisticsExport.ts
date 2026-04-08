import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export type StatisticsPeriod = 'year' | 'q1' | 'q2' | 'q3' | 'q4';

export type StatisticsRegionFilter = 'all' | 'Lisboa' | 'Norte' | 'Centro' | 'Alentejo' | 'Algarve' | 'Desconhecida';

export type StatisticsKpis = {
  total: number;
  started: number;
  completed: number;
  startedPct: number;
  completedPct: number;
  successRate: number;
};

export type StatisticsMonthlyRow = { month: string; registrations: number };
export type StatisticsTrailRow = { trailId: string; trail: string; completed: number };
export type StatisticsRegionRow = { region: string; total: number; started: number; completed: number; completionRate: number };

export type StatisticsRawUserRow = {
  userId: string;
  createdAtISO: string;
  region: string;
  startedPlan: boolean;
  completedPlan: boolean;
  trailsCompleted: number;
};

export type StatisticsReport = {
  generatedAtISO: string;
  year: number;
  period: StatisticsPeriod;
  regionFilter: StatisticsRegionFilter;
  dateRange: { startISO: string; endISO: string };
  totals: { totalMigrants: number; filteredMigrants: number };
  kpis: StatisticsKpis;
  regionStats: StatisticsRegionRow[];
  monthly: StatisticsMonthlyRow[];
  trailPerf: StatisticsTrailRow[];
  rawUsers: StatisticsRawUserRow[];
};

export function buildStatisticsReport(input: {
  year: number;
  period: StatisticsPeriod;
  regionFilter: StatisticsRegionFilter;
  dateRange: { start: Date; end: Date };
  users: { id: string; createdAt?: unknown }[];
  filteredUsers: { id: string; createdAt?: unknown }[];
  regionByUser: Map<string, string>;
  progressByUser: Map<
    string,
    {
      trail_id?: string | null;
      progress_percent?: number | null;
      modules_completed?: number | null;
      completed_at?: unknown | null;
      started_at?: unknown | null;
    }[]
  >;
  kpis: StatisticsKpis;
  regionStats: StatisticsRegionRow[];
  monthly: StatisticsMonthlyRow[];
  trailPerf: StatisticsTrailRow[];
  parseUnknownDate: (value: unknown) => Date | null;
}): StatisticsReport {
  const inRange = (value: unknown): boolean => {
    const d = input.parseUnknownDate(value);
    if (!d) return false;
    return d >= input.dateRange.start && d <= input.dateRange.end;
  };

  const rawUsers: StatisticsRawUserRow[] = input.filteredUsers.map((u) => {
    const created = input.parseUnknownDate(u.createdAt);
    const createdAtISO = created ? created.toISOString() : '';
    const progress = input.progressByUser.get(u.id) ?? [];
    const userCreatedInRange = !!created && created >= input.dateRange.start && created <= input.dateRange.end;
    const startedPlan = progress.some(
      (p) =>
        (p.started_at && inRange(p.started_at)) ||
        (!p.started_at && ((p.progress_percent ?? 0) > 0 || (p.modules_completed ?? 0) > 0) && userCreatedInRange)
    );
    const completedPlan = progress.some((p) => !!p.completed_at && inRange(p.completed_at));
    const trailsCompleted = progress.filter((p) => !!p.completed_at && inRange(p.completed_at) && typeof p.trail_id === 'string' && p.trail_id.length > 0)
      .reduce((acc, p) => {
        if (!p.trail_id) return acc;
        return acc.add(p.trail_id);
      }, new Set<string>()).size;

    return {
      userId: u.id,
      createdAtISO,
      region: input.regionByUser.get(u.id) ?? 'Desconhecida',
      startedPlan,
      completedPlan,
      trailsCompleted,
    };
  });

  return {
    generatedAtISO: new Date().toISOString(),
    year: input.year,
    period: input.period,
    regionFilter: input.regionFilter,
    dateRange: { startISO: input.dateRange.start.toISOString(), endISO: input.dateRange.end.toISOString() },
    totals: { totalMigrants: input.users.length, filteredMigrants: input.filteredUsers.length },
    kpis: input.kpis,
    regionStats: input.regionStats,
    monthly: input.monthly,
    trailPerf: input.trailPerf,
    rawUsers,
  };
}

function wrapText(text: string, maxWidth: number, font: { widthOfTextAtSize: (t: string, s: number) => number }, size: number): string[] {
  const words = text.split(/\s+/g).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i += 1) {
    const next = `${current} ${words[i]}`;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) current = next;
    else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

export async function exportStatisticsPdf(report: StatisticsReport, opts?: { maxTrailRows?: number; maxRawUsers?: number }): Promise<Uint8Array> {
  const maxTrailRows = opts?.maxTrailRows ?? 200;
  const maxRawUsers = opts?.maxRawUsers ?? 500;

  if (report.trailPerf.length > maxTrailRows || report.rawUsers.length > maxRawUsers) {
    throw new Error('O relatório é muito grande para exportação em PDF. Use XLSX para exportação completa.');
  }

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageSize = { width: 595.28, height: 841.89 };
  const margin = 48;
  const lineHeight = 14;

  let page = pdf.addPage([pageSize.width, pageSize.height]);
  let cursorY = pageSize.height - margin;

  const drawLine = (y: number) => {
    page.drawLine({ start: { x: margin, y }, end: { x: pageSize.width - margin, y }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });
  };

  const ensureSpace = (needed: number) => {
    if (cursorY - needed < margin) {
      page = pdf.addPage([pageSize.width, pageSize.height]);
      cursorY = pageSize.height - margin;
    }
  };

  const drawText = (text: string, size = 11, bold = false, color = rgb(0.1, 0.1, 0.1)) => {
    ensureSpace(lineHeight);
    page.drawText(text, { x: margin, y: cursorY - size, size, font: bold ? fontBold : font, color });
    cursorY -= lineHeight;
  };

  const drawHeading = (text: string) => {
    cursorY -= 6;
    drawText(text, 14, true);
    drawLine(cursorY - 6);
    cursorY -= 10;
  };

  const drawKeyValue = (key: string, value: string) => {
    ensureSpace(lineHeight);
    page.drawText(key, { x: margin, y: cursorY - 11, size: 10, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(value, { x: margin + 150, y: cursorY - 11, size: 10, font, color: rgb(0.2, 0.2, 0.2) });
    cursorY -= lineHeight;
  };

  const drawTable = (headers: string[], rows: (string | number)[][]) => {
    const colCount = headers.length;
    const tableWidth = pageSize.width - margin * 2;
    const colWidth = tableWidth / colCount;
    const cellPaddingY = 4;
    const headerHeight = 18;

    const drawRow = (cells: (string | number)[], isHeader = false) => {
      const yTop = cursorY;
      const maxLines = cells
        .map((c, idx) => wrapText(String(c ?? ''), colWidth - 10, isHeader ? fontBold : font, 9).length + (isHeader ? 0 : 0))
        .reduce((a, b) => Math.max(a, b), 1);
      const rowHeight = Math.max(headerHeight, maxLines * 11 + cellPaddingY * 2);
      ensureSpace(rowHeight + 8);
      const y = cursorY - rowHeight;
      for (let i = 0; i < colCount; i += 1) {
        const x = margin + i * colWidth;
        page.drawRectangle({
          x,
          y,
          width: colWidth,
          height: rowHeight,
          borderColor: rgb(0.85, 0.85, 0.85),
          borderWidth: 1,
          color: isHeader ? rgb(0.96, 0.96, 0.96) : undefined,
        });
        const lines = wrapText(String(cells[i] ?? ''), colWidth - 10, isHeader ? fontBold : font, 9);
        for (let li = 0; li < lines.length; li += 1) {
          const yy = y + rowHeight - cellPaddingY - 10 - li * 11;
          page.drawText(lines[li], { x: x + 5, y: yy, size: 9, font: isHeader ? fontBold : font, color: rgb(0.15, 0.15, 0.15) });
        }
      }
      cursorY = y - 8;
      return yTop;
    };

    drawRow(headers, true);
    rows.forEach((r) => drawRow(r, false));
  };

  drawText('Relatório de Estatísticas — CPC', 18, true);
  drawText(`Gerado em: ${new Date(report.generatedAtISO).toLocaleString('pt-PT')}`, 10, false, rgb(0.35, 0.35, 0.35));
  cursorY -= 6;
  drawLine(cursorY);
  cursorY -= 10;

  drawHeading('Filtros e parâmetros');
  drawKeyValue('Ano', String(report.year));
  drawKeyValue('Período', report.period.toUpperCase());
  drawKeyValue('Intervalo', `${report.dateRange.startISO.slice(0, 10)} a ${report.dateRange.endISO.slice(0, 10)}`);
  drawKeyValue('Região', report.regionFilter === 'all' ? 'Todas' : report.regionFilter);
  drawKeyValue('Migrantes (total)', String(report.totals.totalMigrants));
  drawKeyValue('Migrantes (filtrados)', String(report.totals.filteredMigrants));

  drawHeading('KPIs');
  drawTable(
    ['Indicador', 'Valor'],
    [
      ['Migrantes Inscritos', report.kpis.total],
      ['Inícios de Plano', report.kpis.started],
      ['Conclusões Totais', report.kpis.completed],
      ['Taxa de Sucesso', `${report.kpis.successRate}%`],
      ['% Inícios', `${report.kpis.startedPct}%`],
      ['% Conclusões', `${report.kpis.completedPct}%`],
    ]
  );

  drawHeading('Detalhamento Regional');
  drawTable(
    ['Região', 'Total', 'Inícios', 'Conclusões', 'Taxa'],
    report.regionStats.map((r) => [r.region, r.total, r.started, r.completed, `${r.completionRate}%`])
  );

  drawHeading('Inscrições (mensal)');
  drawTable(
    ['Mês', 'Inscrições'],
    report.monthly.map((m) => [m.month, m.registrations])
  );

  drawHeading('Conclusões por percurso');
  drawTable(
    ['Percurso', 'Conclusões'],
    report.trailPerf.map((t) => [t.trail, t.completed])
  );

  return pdf.save();
}

export async function exportStatisticsXlsx(
  report: StatisticsReport,
  XLSX: typeof import('xlsx'),
  opts?: { maxRawUsers?: number }
): Promise<ArrayBuffer> {
  const maxRawUsers = opts?.maxRawUsers ?? 50000;
  if (report.rawUsers.length > maxRawUsers) {
    throw new Error('O relatório é muito grande para exportação em XLSX com os dados detalhados.');
  }

  const summaryRows: (string | number)[][] = [
    ['Relatório de Estatísticas — CPC'],
    ['Gerado em', new Date(report.generatedAtISO).toLocaleString('pt-PT')],
    ['Ano', report.year],
    ['Período', report.period.toUpperCase()],
    ['Intervalo', `${report.dateRange.startISO.slice(0, 10)} a ${report.dateRange.endISO.slice(0, 10)}`],
    ['Região', report.regionFilter === 'all' ? 'Todas' : report.regionFilter],
    ['Migrantes (total)', report.totals.totalMigrants],
    ['Migrantes (filtrados)', report.totals.filteredMigrants],
    [],
    ['Indicador', 'Valor'],
    ['Migrantes Inscritos', report.kpis.total],
    ['Inícios de Plano', report.kpis.started],
    ['Conclusões Totais', report.kpis.completed],
    ['Taxa de Sucesso', `${report.kpis.successRate}%`],
    ['% Inícios', `${report.kpis.startedPct}%`],
    ['% Conclusões', `${report.kpis.completedPct}%`],
  ];

  const wb = XLSX.utils.book_new();

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet['!cols'] = [{ wch: 28 }, { wch: 36 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Resumo');

  const regionalSheet = XLSX.utils.aoa_to_sheet([
    ['Região', 'Total', 'Inícios', 'Conclusões', 'Taxa de Conclusão'],
    ...report.regionStats.map((r) => [r.region, r.total, r.started, r.completed, r.completionRate / 100]),
  ]);
  regionalSheet['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, regionalSheet, 'Regiões');

  const monthlySheet = XLSX.utils.aoa_to_sheet([
    ['Mês', 'Inscrições'],
    ...report.monthly.map((m) => [m.month, m.registrations]),
  ]);
  monthlySheet['!cols'] = [{ wch: 14 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, monthlySheet, 'Mensal');

  const trailSheet = XLSX.utils.aoa_to_sheet([
    ['Percurso', 'Conclusões'],
    ...report.trailPerf.map((t) => [t.trail, t.completed]),
  ]);
  trailSheet['!cols'] = [{ wch: 40 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, trailSheet, 'Percursos');

  const rawSheet = XLSX.utils.aoa_to_sheet([
    ['User ID', 'Data de registo', 'Região', 'Iniciou plano', 'Concluiu plano', 'Percursos concluídos'],
    ...report.rawUsers.map((r) => [r.userId, r.createdAtISO, r.region, r.startedPlan ? 'Sim' : 'Não', r.completedPlan ? 'Sim' : 'Não', r.trailsCompleted]),
  ]);
  rawSheet['!cols'] = [{ wch: 26 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, rawSheet, 'Base');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return out as ArrayBuffer;
}

export async function exportStatisticsDocx(
  report: StatisticsReport,
  docx: typeof import('docx'),
  opts?: { maxTrailRows?: number; maxRawUsers?: number }
): Promise<Blob> {
  const maxTrailRows = opts?.maxTrailRows ?? 500;
  const maxRawUsers = opts?.maxRawUsers ?? 2000;

  if (report.trailPerf.length > maxTrailRows || report.rawUsers.length > maxRawUsers) {
    throw new Error('O relatório é muito grande para exportação em DOCX. Use XLSX para exportação completa.');
  }

  const { AlignmentType, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } = docx;

  const title = new Paragraph({
    text: 'Relatório de Estatísticas — CPC',
    heading: HeadingLevel.HEADING_1,
  });

  const meta = [
    ['Gerado em', new Date(report.generatedAtISO).toLocaleString('pt-PT')],
    ['Ano', String(report.year)],
    ['Período', report.period.toUpperCase()],
    ['Intervalo', `${report.dateRange.startISO.slice(0, 10)} a ${report.dateRange.endISO.slice(0, 10)}`],
    ['Região', report.regionFilter === 'all' ? 'Todas' : report.regionFilter],
    ['Migrantes (total)', String(report.totals.totalMigrants)],
    ['Migrantes (filtrados)', String(report.totals.filteredMigrants)],
  ].map(
    ([k, v]) =>
      new Paragraph({
        children: [new TextRun({ text: `${k}: `, bold: true }), new TextRun({ text: v })],
      })
  );

  const mkTable = (headers: string[], rows: (string | number)[][]) =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: headers.map((h) =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
            })
          ),
        }),
        ...rows.map(
          (r) =>
            new TableRow({
              children: r.map((c) =>
                new TableCell({
                  children: [new Paragraph(String(c ?? ''))],
                })
              ),
            })
        ),
      ],
    });

  const kpiTable = mkTable(
    ['Indicador', 'Valor'],
    [
      ['Migrantes Inscritos', report.kpis.total],
      ['Inícios de Plano', report.kpis.started],
      ['Conclusões Totais', report.kpis.completed],
      ['Taxa de Sucesso', `${report.kpis.successRate}%`],
      ['% Inícios', `${report.kpis.startedPct}%`],
      ['% Conclusões', `${report.kpis.completedPct}%`],
    ]
  );

  const regionTable = mkTable(
    ['Região', 'Total', 'Inícios', 'Conclusões', 'Taxa'],
    report.regionStats.map((r) => [r.region, r.total, r.started, r.completed, `${r.completionRate}%`])
  );

  const monthlyTable = mkTable(
    ['Mês', 'Inscrições'],
    report.monthly.map((m) => [m.month, m.registrations])
  );

  const trailsTable = mkTable(
    ['Percurso', 'Conclusões'],
    report.trailPerf.map((t) => [t.trail, t.completed])
  );

  const rawTable = mkTable(
    ['User ID', 'Data de registo', 'Região', 'Iniciou', 'Concluiu', 'Percursos concluídos'],
    report.rawUsers.map((r) => [r.userId, r.createdAtISO, r.region, r.startedPlan ? 'Sim' : 'Não', r.completedPlan ? 'Sim' : 'Não', r.trailsCompleted])
  );

  const doc = new Document({
    sections: [
      {
        children: [
          title,
          ...meta,
          new Paragraph({ text: '' }),
          new Paragraph({ text: 'KPIs', heading: HeadingLevel.HEADING_2 }),
          kpiTable,
          new Paragraph({ text: '' }),
          new Paragraph({ text: 'Detalhamento Regional', heading: HeadingLevel.HEADING_2 }),
          regionTable,
          new Paragraph({ text: '' }),
          new Paragraph({ text: 'Inscrições (mensal)', heading: HeadingLevel.HEADING_2 }),
          monthlyTable,
          new Paragraph({ text: '' }),
          new Paragraph({ text: 'Conclusões por percurso', heading: HeadingLevel.HEADING_2 }),
          trailsTable,
          new Paragraph({ text: '' }),
          new Paragraph({ text: 'Base (migrantes filtrados)', heading: HeadingLevel.HEADING_2 }),
          rawTable,
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: 'CPC', bold: true })],
          }),
        ],
      },
    ],
  });

  const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const packer = Packer as unknown as {
    toBlob?: (doc: unknown) => Promise<Blob>;
    toArrayBuffer?: (doc: unknown) => Promise<ArrayBuffer>;
    toBuffer?: (doc: unknown) => Promise<Uint8Array>;
    toBase64String?: (doc: unknown) => Promise<string>;
  };

  if (typeof packer.toBlob === 'function') {
    const blob = await packer.toBlob(doc);
    return blob.type ? blob : new Blob([await new Response(blob).arrayBuffer()], { type: mime });
  }

  if (typeof packer.toArrayBuffer === 'function') {
    const ab = await packer.toArrayBuffer(doc);
    return new Blob([ab], { type: mime });
  }

  if (typeof packer.toBuffer === 'function') {
    const buf = await packer.toBuffer(doc);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    return new Blob([ab], { type: mime });
  }

  if (typeof packer.toBase64String === 'function') {
    const b64 = await packer.toBase64String(doc);
    const atobFn = typeof globalThis.atob === 'function' ? globalThis.atob.bind(globalThis) : null;
    if (atobFn) {
      const bin = atobFn(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
      return new Blob([arr.buffer], { type: mime });
    }
    throw new Error('Exportação DOCX indisponível neste ambiente.');
  }

  throw new Error('Exportação DOCX indisponível.');
}
