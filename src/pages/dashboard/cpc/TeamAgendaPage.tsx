import { useEffect, useMemo, useState } from 'react';
import { addDocument, queryDocuments, updateDocument } from '@/integrations/firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar as UICalendar } from '@/components/ui/calendar';
import { startOfWeek, endOfWeek, isSameDay, isWithinInterval } from 'date-fns';
import { Calendar, User, XCircle, Clock, Plus, SlidersHorizontal, Printer, Download } from 'lucide-react';

type ProfessionalRole = 'mediator' | 'lawyer' | 'psychologist' | 'manager' | 'coordinator';
type AreaType = 'mediador' | 'jurista' | 'psicologa';
type SessionItem = { id: string; session_type: AreaType; scheduled_date: string; scheduled_time: string; status: 'Agendada' | 'Concluída' | 'Cancelada' | null; migrant_id: string };
type ProfileItem = { user_id: string; name: string };

export default function TeamAgendaPage() {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Array<SessionItem>>([]);
  const [migrants, setMigrants] = useState<Array<ProfileItem>>([]);
  const [professionals, setProfessionals] = useState<Array<{ user_id: string; name: string; role: ProfessionalRole }>>([]);
  const [areaFilter, setAreaFilter] = useState<'all' | AreaType>('all');
  const [profFilter, setProfFilter] = useState<string>('all');
  const [calendarView, setCalendarView] = useState<'day' | 'week' | 'month'>('week');
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [createOpen, setCreateOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState<null | SessionItem>(null);
  const [createMigrantId, setCreateMigrantId] = useState<string>('');
  const [createArea, setCreateArea] = useState<AreaType>('mediador');
  const [createDate, setCreateDate] = useState('');
  const [createTime, setCreateTime] = useState('');
  const [listMode, setListMode] = useState<'day' | 'period'>('day');
  const [assignments, setAssignments] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem('sessionAssignments');
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });
  const [rules, setRules] = useState<{ limitPerProfessionalPerDay: number }>(() => {
    try {
      const raw = localStorage.getItem('cpc-agenda-rules');
      return raw ? JSON.parse(raw) : { limitPerProfessionalPerDay: 8 };
    } catch { return { limitPerProfessionalPerDay: 8 }; }
  });

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      try {
        const [sess, migs, profs] = await Promise.all([
          queryDocuments<SessionItem>('sessions', [], { field: 'scheduled_date', direction: 'asc' }),
          queryDocuments<{ id: string; name?: string | null }>('profiles', [{ field: 'role', operator: '==', value: 'migrant' }]),
          queryDocuments<{ id: string; name?: string | null; role?: string | null }>(
            'profiles',
            [{ field: 'role', operator: 'in', value: ['mediator', 'lawyer', 'psychologist', 'manager', 'coordinator'] }]
          ),
        ]);
        setSessions(sess || []);
        setMigrants((migs || []).map(m => ({ user_id: m.id, name: m.name || 'Migrante' })));
        setProfessionals(
          (profs || []).map(p => ({ user_id: p.id, name: p.name || 'Profissional', role: (p.role || 'mediator') as ProfessionalRole }))
        );
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  function setAssignment(sessionId: string, profId: string) {
    const next = { ...assignments, [sessionId]: profId };
    setAssignments(next);
    localStorage.setItem('sessionAssignments', JSON.stringify(next));
  }

  const migrantNameById = useMemo(() => {
    const map: Record<string, string> = {};
    migrants.forEach((m) => { map[m.user_id] = m.name; });
    return map;
  }, [migrants]);

  const professionalNameById = useMemo(() => {
    const map: Record<string, string> = {};
    professionals.forEach((p) => { map[p.user_id] = p.name; });
    return map;
  }, [professionals]);

  const selectedDateKey = useMemo(() => selectedDate.toISOString().slice(0, 10), [selectedDate]);

  const filtered = useMemo(() => {
    return sessions.filter(s => (areaFilter === 'all' ? true : s.session_type === areaFilter) && (profFilter === 'all' ? true : assignments[s.id] === profFilter));
  }, [sessions, areaFilter, profFilter, assignments]);

  const selectedDaySessions = useMemo(() => {
    return filtered
      .filter((s) => isSameDay(new Date(s.scheduled_date), selectedDate))
      .sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time));
  }, [filtered, selectedDate]);

  const daysWithSessions = useMemo(() => {
    const set = new Map<string, Date>();
    filtered.forEach(s => {
      const d = new Date(s.scheduled_date);
      const key = d.toISOString().slice(0,10);
      if (!set.has(key)) set.set(key, d);
    });
    return Array.from(set.values());
  }, [filtered]);

  const calendarPeriodSessions = useMemo(() => {
    const today = selectedDate;
    if (calendarView === 'day') {
      return filtered.filter(s => isSameDay(new Date(s.scheduled_date), today));
    }
    if (calendarView === 'week') {
      const start = startOfWeek(today, { weekStartsOn: 1 });
      const end = endOfWeek(today, { weekStartsOn: 1 });
      return filtered.filter(s => isWithinInterval(new Date(s.scheduled_date), { start, end }));
    }
    const month = today.getMonth();
    const year = today.getFullYear();
    return filtered.filter(s => {
      const d = new Date(s.scheduled_date);
      return d.getMonth() === month && d.getFullYear() === year;
    });
  }, [filtered, calendarView, selectedDate]);

  const overdueSessions = useMemo(() => {
    const today = new Date().toISOString().slice(0,10);
    return sessions.filter(s => s.scheduled_date < today && (s.status || 'Agendada') !== 'Concluída');
  }, [sessions]);

  const capacity = useMemo(() => {
    const totalSlots = Math.max(0, professionals.length * (rules.limitPerProfessionalPerDay || 0));
    const filledSlots = sessions.filter((s) => s.scheduled_date === selectedDateKey && (s.status || 'Agendada') === 'Agendada').length;
    const percent = totalSlots ? Math.min(100, Math.round((filledSlots / totalSlots) * 100)) : 0;
    return { totalSlots, filledSlots, percent };
  }, [professionals.length, rules.limitPerProfessionalPerDay, selectedDateKey, sessions]);

  function areaLabel(area: AreaType) {
    if (area === 'jurista') return 'APOIO JURÍDICO';
    if (area === 'psicologa') return 'APOIO PSICOLÓGICO';
    return 'MEDIAÇÃO';
  }

  function estimateDurationMinutes(area: AreaType) {
    if (area === 'psicologa') return 45;
    return 60;
  }

  function statusChip(session: SessionItem) {
    const todayKey = new Date().toISOString().slice(0, 10);
    const raw = session.status || 'Agendada';
    if (raw === 'Cancelada') return { label: 'CANCELADA', className: 'bg-red-100 text-red-700 border-red-200' };
    if (raw === 'Concluída') return { label: 'CONCLUÍDA', className: 'bg-slate-100 text-slate-700 border-slate-200' };
    if (session.scheduled_date < todayKey) return { label: 'PENDENTE', className: 'bg-amber-100 text-amber-800 border-amber-200' };
    return { label: 'CONFIRMADA', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
  }

  function formatSelectedDayTitle(date: Date) {
    const day = date.toLocaleDateString('pt-PT', { day: '2-digit' });
    const month = date.toLocaleDateString('pt-PT', { month: 'short' }).replace('.', '');
    return `${day} ${month.charAt(0).toUpperCase()}${month.slice(1)}`;
  }

  function downloadCsv() {
    const rows = (listMode === 'day' ? selectedDaySessions : calendarPeriodSessions).map((s) => ({
      data: s.scheduled_date,
      hora: s.scheduled_time,
      area: s.session_type,
      migrante: migrantNameById[s.migrant_id] || s.migrant_id,
      profissional: professionalNameById[assignments[s.id]] || '',
      status: s.status || 'Agendada',
    }));
    const header = ['data', 'hora', 'area', 'migrante', 'profissional', 'status'];
    const csv = [header.join(','), ...rows.map((r) => header.map((k) => `"${String((r as Record<string, string>)[k] || '').replaceAll('"', '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agenda-${selectedDateKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function createSession() {
    if (!createMigrantId || !createDate || !createTime) return;
    await addDocument('sessions', { migrant_id: createMigrantId, session_type: createArea, scheduled_date: createDate, scheduled_time: createTime, status: 'Agendada' });
    setCreateOpen(false);
    const data = await queryDocuments<SessionItem>('sessions', [], { field: 'scheduled_date', direction: 'asc' });
    setSessions((data || []) as Array<SessionItem>);
  }

  async function cancelSession(id: string) {
    await updateDocument('sessions', id, { status: 'Cancelada' });
    setSessions(prev => prev.map(s => (s.id === id ? { ...s, status: 'Cancelada' } : s)));
  }

  async function moveSessionConfirm() {
    if (!moveOpen) return;
    const nextDate = createDate || moveOpen.scheduled_date;
    const nextTime = createTime || moveOpen.scheduled_time;
    const assigned = assignments[moveOpen.id];
    if (assigned) {
      const countForDay = sessions.filter(s => assignments[s.id] === assigned && s.scheduled_date === nextDate && (s.status || 'Agendada') === 'Agendada').length;
      if (countForDay >= rules.limitPerProfessionalPerDay) return;
    }
    await updateDocument('sessions', moveOpen.id, { scheduled_date: nextDate, scheduled_time: nextTime });
    setSessions(prev => prev.map(s => (s.id === moveOpen.id ? { ...s, scheduled_date: nextDate, scheduled_time: nextTime } : s)));
    setMoveOpen(null);
    setCreateDate('');
    setCreateTime('');
  }

  if (loading) {
    return (
      <div className="py-12 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Refactor visual: header com hierarquia tipográfica + CTA primário */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Agenda da Equipa</h1>
          <p className="mt-1 text-sm md:text-base text-muted-foreground">
            Gestão e monitorização centralizada de sessões de acompanhamento.
          </p>
        </div>

        <Button
          onClick={() => setCreateOpen(true)}
          className="h-12 px-5 rounded-2xl shadow-md hover:shadow-lg transition-shadow inline-flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Nova Sessão
        </Button>
      </div>

      {/* Refactor visual: barra de filtros em layout compacto (pills) + ações globais */}
      <div className="cpc-card p-4 md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <div>
              <Select value={areaFilter} onValueChange={(v) => setAreaFilter(v as typeof areaFilter)}>
                <SelectTrigger className="h-14 rounded-2xl bg-background border shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex w-full items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] tracking-wider text-muted-foreground uppercase shrink-0">Área:</span>
                      <span className="text-sm font-semibold truncate"><SelectValue /></span>
                    </div>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="mediador">Mediação</SelectItem>
                  <SelectItem value="jurista">Jurídico</SelectItem>
                  <SelectItem value="psicologa">Psicológico</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={profFilter} onValueChange={(v) => setProfFilter(v)}>
                <SelectTrigger className="h-14 rounded-2xl bg-background border shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex w-full items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] tracking-wider text-muted-foreground uppercase shrink-0">Profissional:</span>
                      <span className="text-sm font-semibold truncate"><SelectValue /></span>
                    </div>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {professionals.map(p => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={calendarView} onValueChange={(v) => setCalendarView(v as typeof calendarView)}>
                <SelectTrigger className="h-14 rounded-2xl bg-background border shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex w-full items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] tracking-wider text-muted-foreground uppercase shrink-0">Vista:</span>
                      <span className="text-sm font-semibold truncate"><SelectValue /></span>
                    </div>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Diária</SelectItem>
                  <SelectItem value="week">Semanal</SelectItem>
                  <SelectItem value="month">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRulesOpen(true)}
                className="h-14 w-full rounded-2xl shadow-sm hover:shadow-md transition-shadow inline-flex items-center justify-center gap-2"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Regras &amp; Limites
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => window.print()}
              className="h-11 w-11 rounded-2xl hover:bg-muted transition-colors"
              aria-label="Imprimir"
            >
              <Printer className="h-5 w-5 text-muted-foreground" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={downloadCsv}
              className="h-11 w-11 rounded-2xl hover:bg-muted transition-colors"
              aria-label="Exportar CSV"
            >
              <Download className="h-5 w-5 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </div>

      {/* Refactor visual: grid responsivo com calendário + KPI de capacidade + lista de sessões */}
      <div className="grid lg:grid-cols-[380px_minmax(0,1fr)] gap-6">
        <div className="space-y-6">
          <div className="cpc-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Calendário</h2>
              </div>
              <span className="text-xs text-muted-foreground">Selecione um dia</span>
            </div>
            <div className="rounded-2xl border bg-background">
              <UICalendar
                className="p-0"
                classNames={{
                  caption: 'flex items-center justify-between px-4 pt-4',
                  caption_label: 'text-base font-semibold',
                  nav: 'space-x-2 flex items-center',
                  nav_button: 'h-9 w-9 rounded-xl border bg-background hover:bg-muted transition-colors',
                  nav_button_previous: 'static',
                  nav_button_next: 'static',
                  table: 'w-full border-collapse space-y-1 px-3 pb-3',
                  head_row: 'flex px-2',
                  head_cell: 'text-muted-foreground rounded-md w-9 font-medium text-[0.72rem] tracking-wider uppercase',
                  row: 'flex w-full mt-2 px-2',
                }}
                mode="single"
                selected={selectedDate}
                onSelect={(d) => { setSelectedDate(d || selectedDate); setListMode('day'); }}
                modifiers={{ hasSession: daysWithSessions }}
                modifiersClassNames={{ hasSession: 'ring-1 ring-primary/60' }}
              />
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-indigo-700 text-primary-foreground shadow-lg">
            {/* Refactor visual: cartão KPI com alto contraste e progress bar */}
            <div className="p-6">
              <p className="text-lg font-semibold">Capacidade do Dia</p>
              <p className="mt-1 text-sm/6 text-primary-foreground/85">
                A equipa está com {capacity.percent}% de ocupação.
              </p>

              <div className="mt-5">
                <div className="h-2.5 rounded-full bg-white/20 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-white/90 transition-[width] duration-500"
                    style={{ width: `${capacity.percent}%` }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] tracking-wider uppercase text-primary-foreground/85">
                  <span>{capacity.filledSlots} de {capacity.totalSlots} slots preenchidos</span>
                  <span>{formatSelectedDayTitle(selectedDate)}</span>
                </div>
              </div>
            </div>
            <div className="absolute bottom-0 right-0 h-24 w-24 opacity-20">
              <div className="absolute bottom-4 right-6 h-16 w-2 rounded-full bg-white/50" />
              <div className="absolute bottom-4 right-2 h-10 w-2 rounded-full bg-white/50" />
              <div className="absolute bottom-4 right-10 h-12 w-2 rounded-full bg-white/50" />
            </div>
          </div>
        </div>

        <div className="cpc-card p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <Clock className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold truncate">
                    {listMode === 'day' ? `Sessões do dia, ${formatSelectedDayTitle(selectedDate)}` : 'Sessões no período'}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {(listMode === 'day' ? selectedDaySessions : calendarPeriodSessions).length} sessões
                  </p>
                </div>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              onClick={() => setListMode((m) => (m === 'day' ? 'period' : 'day'))}
              className="text-primary hover:text-primary/90 hover:bg-primary/10 rounded-xl"
            >
              {listMode === 'day' ? 'Ver todas' : 'Ver do dia'}
            </Button>
          </div>

          <div className="mt-6 space-y-3">
            {(listMode === 'day' ? selectedDaySessions : calendarPeriodSessions).length > 0 ? (
              (listMode === 'day' ? selectedDaySessions : calendarPeriodSessions)
                .slice(0, listMode === 'day' ? 12 : 30)
                .map((s) => {
                  const duration = estimateDurationMinutes(s.session_type);
                  const profName = professionalNameById[assignments[s.id]] || '—';
                  const migrantName = migrantNameById[s.migrant_id] || 'Migrante';
                  const chip = statusChip(s);
                  return (
                    <div key={s.id} className="group rounded-2xl border bg-background hover:bg-muted/10 transition-colors">
                      <div className="p-4 md:p-5">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-20 shrink-0">
                              <p className="text-base font-semibold">{s.scheduled_time}</p>
                              <p className="text-xs text-muted-foreground">{duration} min</p>
                            </div>
                            <div className="hidden md:block w-px h-12 bg-border" />
                            <div className="min-w-0">
                              <p className="text-[11px] tracking-wider text-muted-foreground uppercase font-semibold">
                                {areaLabel(s.session_type)}
                              </p>
                              <p className="mt-1 text-base font-semibold truncate">{migrantName}</p>
                              <p className="mt-1 text-sm text-muted-foreground truncate">
                                <span className="inline-flex items-center gap-2">
                                  <User className="h-4 w-4" />
                                  Técnico: {profName}
                                </span>
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col items-start md:items-end gap-3">
                            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${chip.className}`}>
                              {chip.label}
                            </span>

                            <div className="flex flex-wrap items-center gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                              <Select value={assignments[s.id] || ''} onValueChange={(v) => setAssignment(s.id, v)}>
                                <SelectTrigger className="h-9 w-[180px] rounded-xl">
                                  <SelectValue placeholder="Atribuir técnico" />
                                </SelectTrigger>
                                <SelectContent>
                                  {professionals.map(p => (
                                    <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setMoveOpen(s)}
                                className="rounded-xl"
                              >
                                Mover
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => cancelSession(s.id)}
                                className="rounded-xl"
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
            ) : (
              <div className="rounded-2xl border bg-muted/20 p-10 text-center">
                <p className="text-sm text-muted-foreground">Sem sessões encontradas para esta seleção.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Refactor visual: tabela de atrasos com colunas e ação primária */}
      <div className="cpc-card p-5 md:p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">Sessões em atraso</h2>
            {overdueSessions.length ? (
              <span className="inline-flex items-center justify-center h-6 min-w-6 px-2 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                {overdueSessions.length}
              </span>
            ) : null}
          </div>
          <span className="text-sm text-muted-foreground hidden md:block">Reagende para manter o acompanhamento em dia</span>
        </div>

        <div className="mt-5 rounded-2xl border overflow-x-auto">
          {overdueSessions.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-muted/20 text-muted-foreground">
                <tr className="text-[11px] tracking-wider uppercase">
                  <th className="text-left font-semibold px-5 py-3">Data original</th>
                  <th className="text-left font-semibold px-5 py-3">Utente</th>
                  <th className="text-left font-semibold px-5 py-3">Profissional</th>
                  <th className="text-right font-semibold px-5 py-3">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {overdueSessions.map((s) => {
                  const migrantName = migrantNameById[s.migrant_id] || 'Migrante';
                  const profName = professionalNameById[assignments[s.id]] || '—';
                  const dateLabel = new Date(s.scheduled_date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }).replace('.', '');
                  return (
                    <tr key={s.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-5 py-4 font-semibold text-red-600">
                        {dateLabel}, {s.scheduled_time}
                      </td>
                      <td className="px-5 py-4 font-semibold">{migrantName}</td>
                      <td className="px-5 py-4 text-muted-foreground">{profName}</td>
                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => setMoveOpen(s)} className="rounded-xl">
                            Reagendar
                          </Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => cancelSession(s.id)} className="rounded-xl" aria-label="Cancelar">
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-10 text-center text-sm text-muted-foreground">Sem sessões em atraso</div>
          )}
        </div>
      </div>

      <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Regras &amp; Limites</DialogTitle></DialogHeader>
          {/* Alteração visual: regras movidas para modal para reduzir ruído no topo e manter foco no calendário */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Limite por profissional/dia</Label>
              <Input
                type="number"
                value={String(rules.limitPerProfessionalPerDay)}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0;
                  const next = { limitPerProfessionalPerDay: v };
                  setRules(next);
                  localStorage.setItem('cpc-agenda-rules', JSON.stringify(next));
                }}
              />
              <p className="text-sm text-muted-foreground">
                Usado para validar reagendamentos e calcular a capacidade do dia.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRulesOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova sessão</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Migrante</Label>
              <Select value={createMigrantId} onValueChange={(v) => setCreateMigrantId(v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {migrants.map(m => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Área</Label>
              <Select value={createArea} onValueChange={(v) => setCreateArea(v as AreaType)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mediador">Mediação</SelectItem>
                  <SelectItem value="jurista">Jurídico</SelectItem>
                  <SelectItem value="psicologa">Psicológico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={createDate} onChange={(e) => setCreateDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Hora</Label>
              <Input type="time" value={createTime} onChange={(e) => setCreateTime(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter><Button onClick={createSession}>Confirmar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!moveOpen} onOpenChange={() => setMoveOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mover sessão</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Data</Label>
              <Input type="date" value={createDate} onChange={(e) => setCreateDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Hora</Label>
              <Input type="time" value={createTime} onChange={(e) => setCreateTime(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setMoveOpen(null); setCreateDate(''); setCreateTime(''); }}>Fechar</Button>
            <Button onClick={moveSessionConfirm}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
