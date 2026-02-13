import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar as UICalendar } from '@/components/ui/calendar';
import { addDays, startOfWeek, endOfWeek, isSameDay, isWithinInterval } from 'date-fns';
import { Calendar, Users, User, CheckCircle, XCircle, Clock, ArrowRight } from 'lucide-react';

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
  const [moveOpen, setMoveOpen] = useState<null | SessionItem>(null);
  const [createMigrantId, setCreateMigrantId] = useState<string>('');
  const [createArea, setCreateArea] = useState<AreaType>('mediador');
  const [createDate, setCreateDate] = useState('');
  const [createTime, setCreateTime] = useState('');
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
        const [{ data: sess }, { data: migs }, { data: profs }] = await Promise.all([
          supabase.from('sessions').select('id, session_type, scheduled_date, scheduled_time, status, migrant_id').order('scheduled_date', { ascending: true }),
          supabase.from('profiles').select('user_id, name').eq('role', 'migrant').order('created_at', { ascending: false }),
          supabase.from('profiles').select('user_id, name, role').in('role', ['mediator', 'lawyer', 'psychologist', 'manager', 'coordinator'])
        ]);
        setSessions(((sess || []) as Array<SessionItem>));
        setMigrants(((migs || []) as Array<ProfileItem>));
        setProfessionals(((profs || []) as Array<{ user_id: string; name: string; role: ProfessionalRole }>));
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

  const filtered = useMemo(() => {
    return sessions.filter(s => (areaFilter === 'all' ? true : s.session_type === areaFilter) && (profFilter === 'all' ? true : assignments[s.id] === profFilter));
  }, [sessions, areaFilter, profFilter, assignments]);

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

  async function createSession() {
    if (!createMigrantId || !createDate || !createTime) return;
    await supabase.from('sessions').insert({ migrant_id: createMigrantId, session_type: createArea, scheduled_date: createDate, scheduled_time: createTime, status: 'Agendada' });
    setCreateOpen(false);
    const { data } = await supabase.from('sessions').select('id, session_type, scheduled_date, scheduled_time, status, migrant_id').order('scheduled_date', { ascending: true });
    setSessions((data || []) as Array<SessionItem>);
  }

  async function cancelSession(id: string) {
    await supabase.from('sessions').update({ status: 'Cancelada' }).eq('id', id);
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
    await supabase.from('sessions').update({ scheduled_date: nextDate, scheduled_time: nextTime }).eq('id', moveOpen.id);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Agenda da Equipa</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-2"><ArrowRight className="h-4 w-4" />Nova sessão</Button>
        </div>
      </div>

      <div className="cpc-card p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label>Área</Label>
            <Select value={areaFilter} onValueChange={(v) => setAreaFilter(v as typeof areaFilter)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="mediador">Mediação</SelectItem>
                <SelectItem value="jurista">Jurídico</SelectItem>
                <SelectItem value="psicologa">Psicológico</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Profissional</Label>
            <Select value={profFilter} onValueChange={(v) => setProfFilter(v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {professionals.map(p => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Visualização</Label>
            <Select value={calendarView} onValueChange={(v) => setCalendarView(v as typeof calendarView)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Dia</SelectItem>
                <SelectItem value="week">Semana</SelectItem>
                <SelectItem value="month">Mês</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Regras</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input type="number" value={String(rules.limitPerProfessionalPerDay)} onChange={(e) => { const v = Number(e.target.value) || 0; const next = { limitPerProfessionalPerDay: v }; setRules(next); localStorage.setItem('cpc-agenda-rules', JSON.stringify(next)); }} />
              <span className="text-xs text-muted-foreground">Limite por dia</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="cpc-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2"><Calendar className="h-5 w-5 text-primary" /> Calendário</h2>
          </div>
          <UICalendar
            mode="single"
            selected={selectedDate}
            onSelect={(d) => setSelectedDate(d || selectedDate)}
            modifiers={{ hasSession: daysWithSessions }}
            modifiersClassNames={{ hasSession: 'ring-1 ring-primary' }}
          />
        </div>
        <div className="cpc-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Sessões no período</h2>
            <span className="text-xs text-muted-foreground">{calendarPeriodSessions.length} sessões</span>
          </div>
          {calendarPeriodSessions.length > 0 ? (
            <div className="space-y-3">
              {calendarPeriodSessions.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Clock className="h-5 w-5" /></div>
                    <div>
                      <p className="text-sm font-medium">{s.session_type}</p>
                      <p className="text-xs text-muted-foreground">{new Date(s.scheduled_date).toLocaleDateString()} • {s.scheduled_time}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={assignments[s.id] || ''} onValueChange={(v) => setAssignment(s.id, v)}>
                      <SelectTrigger className="h-8 w-[160px]"><SelectValue placeholder="Atribuir" /></SelectTrigger>
                      <SelectContent>
                        {professionals.map(p => (
                          <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={() => setMoveOpen(s)} className="inline-flex items-center gap-1"><Users className="h-4 w-4" />Mover</Button>
                    <Button variant="outline" size="sm" onClick={() => cancelSession(s.id)} className="inline-flex items-center gap-1"><XCircle className="h-4 w-4" />Cancelar</Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Sem sessões no período</div>
          )}
        </div>
      </div>

      <div className="cpc-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold flex items-center gap-2"><User className="h-5 w-5 text-primary" /> Sessões em atraso</h2>
          <span className="text-xs text-muted-foreground">{overdueSessions.length}</span>
        </div>
        {overdueSessions.length > 0 ? (
          <div className="space-y-3">
            {overdueSessions.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Clock className="h-5 w-5" /></div>
                  <div>
                    <p className="text-sm font-medium">{s.session_type}</p>
                    <p className="text-xs text-muted-foreground">{new Date(s.scheduled_date).toLocaleDateString()} • {s.scheduled_time}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setMoveOpen(s)} className="inline-flex items-center gap-1"><Users className="h-4 w-4" />Remarcar</Button>
                  <Button variant="outline" size="sm" onClick={() => cancelSession(s.id)} className="inline-flex items-center gap-1"><XCircle className="h-4 w-4" />Cancelar</Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Sem sessões em atraso</div>
        )}
      </div>

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

