import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarIcon, Clock, CheckCircle, XCircle, PlusCircle } from 'lucide-react';
import { Calendar as UICalendar } from '@/components/ui/calendar';
import { addDays, startOfWeek, endOfWeek, isSameDay, isWithinInterval } from 'date-fns';

type SessionItem = { id: string; session_type: 'mediador' | 'jurista' | 'psicologa' | 'coletiva'; scheduled_date: string; scheduled_time: string; status: 'Agendada' | 'Concluída' | 'Cancelada' | null };

export default function SessionsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Array<SessionItem>>([]);
  const [bookOpen, setBookOpen] = useState(false);
  const [bookType, setBookType] = useState<'mediador' | 'jurista' | 'psicologa'>('mediador');
  const [bookDate, setBookDate] = useState('');
  const [bookTime, setBookTime] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Agendada' | 'Concluída' | 'Cancelada'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'mediador' | 'jurista' | 'psicologa'>('all');
  const [calendarView, setCalendarView] = useState<'day' | 'week' | 'month'>('month');
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  useEffect(() => {
    async function fetchSessions() {
      if (!user) return;
      setLoading(true);
      try {
        const { data } = await supabase
          .from('sessions')
          .select('id, session_type, scheduled_date, scheduled_time, status')
          .eq('migrant_id', user.id)
          .order('scheduled_date', { ascending: true });
        const typed = (data || []) as Array<SessionItem>;
        setSessions(typed);
      } finally {
        setLoading(false);
      }
    }
    fetchSessions();
  }, [user]);

  const filtered = useMemo(() => {
    return sessions.filter(s => (statusFilter === 'all' ? true : (s.status || 'Agendada') === statusFilter) && (typeFilter === 'all' ? true : s.session_type === typeFilter));
  }, [sessions, statusFilter, typeFilter]);

  const daysWithSessions = useMemo(() => {
    const set = new Map<string, Date>();
    filtered.forEach(s => {
      try {
        const d = new Date(s.scheduled_date);
        const key = d.toISOString().slice(0,10);
        if (!set.has(key)) set.set(key, d);
      } catch { /* ignore */ }
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

  const upcomingSessions = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return filtered.filter(s => s.scheduled_date >= today);
  }, [filtered]);

  const pastSessions = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return filtered.filter(s => s.scheduled_date < today).reverse();
  }, [filtered]);

  async function bookSession() {
    if (!user || !bookDate || !bookTime) return;
    await supabase.from('sessions').insert({ migrant_id: user.id, session_type: bookType, scheduled_date: bookDate, scheduled_time: bookTime, status: 'Agendada' });
    setBookOpen(false);
    const { data } = await supabase
      .from('sessions')
      .select('id, session_type, scheduled_date, scheduled_time, status')
      .eq('migrant_id', user.id)
      .order('scheduled_date', { ascending: true });
    const typed = (data || []) as Array<SessionItem>;
    setSessions(typed);
  }

  async function updateStatus(id: string, status: 'Concluída' | 'Cancelada') {
    await supabase.from('sessions').update({ status }).eq('id', id);
    const next = sessions.map(s => (s.id === id ? { ...s, status } : s));
    setSessions(next);
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
        <h1 className="text-2xl md:text-3xl font-bold">Sessões</h1>
        <Button onClick={() => setBookOpen(true)} className="inline-flex items-center gap-2"><PlusCircle className="h-4 w-4" />Marcar sessão</Button>
      </div>

      <div className="cpc-card p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="Agendada">Agendada</SelectItem>
                <SelectItem value="Concluída">Concluída</SelectItem>
                <SelectItem value="Cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="mediador">Mediador</SelectItem>
                <SelectItem value="jurista">Jurista</SelectItem>
                <SelectItem value="psicologa">Psicóloga</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="cpc-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2"><CalendarIcon className="h-5 w-5 text-primary" /> Próximas sessões</h2>
          </div>
          {upcomingSessions.length > 0 ? (
            <div className="space-y-3">
              {upcomingSessions.map(s => (
                <div key={s.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Clock className="h-5 w-5" /></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{s.session_type}</p>
                    <p className="text-xs text-muted-foreground">{new Date(s.scheduled_date).toLocaleDateString()} • {s.scheduled_time}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => updateStatus(s.id, 'Concluída')} className="inline-flex items-center gap-1"><CheckCircle className="h-4 w-4" />Concluir</Button>
                    <Button variant="outline" size="sm" onClick={() => updateStatus(s.id, 'Cancelada')} className="inline-flex items-center gap-1"><XCircle className="h-4 w-4" />Cancelar</Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Sem sessões futuras</div>
          )}
        </div>

        <div className="cpc-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Histórico</h2>
          </div>
          {pastSessions.length > 0 ? (
            <div className="space-y-3">
              {pastSessions.map(s => (
                <div key={s.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Clock className="h-5 w-5" /></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{s.session_type}</p>
                    <p className="text-xs text-muted-foreground">{new Date(s.scheduled_date).toLocaleDateString()} • {s.scheduled_time}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{s.status || 'Agendada'}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Sem histórico</div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="cpc-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2"><CalendarIcon className="h-5 w-5 text-primary" /> Calendário de sessões</h2>
            <div className="flex items-center gap-2">
              <Select value={calendarView} onValueChange={(v) => setCalendarView(v as typeof calendarView)}>
                <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Dia</SelectItem>
                  <SelectItem value="week">Semana</SelectItem>
                  <SelectItem value="month">Mês</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
            <h2 className="font-semibold">Sessões no período selecionado</h2>
            <span className="text-xs text-muted-foreground">{calendarPeriodSessions.length} sessões</span>
          </div>
          {calendarPeriodSessions.length > 0 ? (
            <div className="space-y-3">
              {calendarPeriodSessions.map(s => (
                <div key={s.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Clock className="h-5 w-5" /></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{s.session_type}</p>
                    <p className="text-xs text-muted-foreground">{new Date(s.scheduled_date).toLocaleDateString()} • {s.scheduled_time}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{s.status || 'Agendada'}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Sem sessões no período</div>
          )}
        </div>
      </div>

      <Dialog open={bookOpen} onOpenChange={setBookOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Marcar sessão</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={bookType} onValueChange={(v) => setBookType(v as typeof bookType)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mediador">Mediador</SelectItem>
                  <SelectItem value="jurista">Jurista</SelectItem>
                  <SelectItem value="psicologa">Psicóloga</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={bookDate} onChange={(e) => setBookDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Hora</Label>
              <Input type="time" value={bookTime} onChange={(e) => setBookTime(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter><Button onClick={bookSession}>Confirmar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
