import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { addDocument, queryDocuments, updateDocument } from '@/integrations/firebase/firestore';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarIcon, Clock, XCircle, PlusCircle, Star, Loader2, Check, Scale, Heart, Users, Video, ArrowRight, List } from 'lucide-react';
import { Calendar as UICalendar } from '@/components/ui/calendar';
import { isSameDay } from 'date-fns';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

type SessionItem = {
  id: string;
  session_type: 'mediador' | 'jurista' | 'psicologa' | 'coletiva';
  scheduled_date: string;
  scheduled_time: string;
  status: string | null;
  service_id?: string;
  service_label?: string;
  specialist_id?: string;
  specialist_name?: string;
  meeting_url?: string;
};

export type BookingServiceId = 'legal' | 'psychology' | 'mediation';
export type BookingSpecialistRole = 'jurista' | 'psicologa' | 'mediador';

export type BookingServiceOption = {
  id: BookingServiceId;
  title: string;
  description: string;
  priceLabel: string;
  specialistRoles: BookingSpecialistRole[];
};

export type BookingSpecialistOption = {
  id: string;
  name: string;
  role: BookingSpecialistRole;
  languages: Array<'PT' | 'EN' | 'ES'>;
  rating: number;
  reviewCount: number;
};

export type BookingWizardStep = 1 | 2 | 3 | 4;

const BOOKING_SERVICES: BookingServiceOption[] = [
  {
    id: 'legal',
    title: 'Aconselhamento jurídico',
    description: 'Apoio sobre documentação, regularização, direitos e reagrupamento familiar.',
    priceLabel: 'Gratuito',
    specialistRoles: ['jurista'],
  },
  {
    id: 'psychology',
    title: 'Apoio psicológico',
    description: 'Sessão individual com foco em bem-estar emocional e adaptação.',
    priceLabel: 'Gratuito',
    specialistRoles: ['psicologa'],
  },
  {
    id: 'mediation',
    title: 'Mediação & integração',
    description: 'Orientação prática sobre emprego, habitação e integração no território.',
    priceLabel: 'Gratuito',
    specialistRoles: ['mediador'],
  },
];

const BOOKING_SPECIALISTS: BookingSpecialistOption[] = [
  { id: 'spec-jur-1', name: 'Dra. Sarah Miller', role: 'jurista', languages: ['PT', 'EN'], rating: 4.9, reviewCount: 124 },
  { id: 'spec-jur-2', name: 'Dr. Amir Benali', role: 'jurista', languages: ['PT', 'ES'], rating: 4.7, reviewCount: 89 },
  { id: 'spec-psy-1', name: 'Dra. Sofia Costa', role: 'psicologa', languages: ['PT', 'EN'], rating: 4.8, reviewCount: 102 },
  { id: 'spec-psy-2', name: 'Dr. Luca Rossi', role: 'psicologa', languages: ['PT', 'ES'], rating: 4.6, reviewCount: 64 },
  { id: 'spec-med-1', name: 'Joana Pereira', role: 'mediador', languages: ['PT', 'EN', 'ES'], rating: 4.9, reviewCount: 211 },
  { id: 'spec-med-2', name: 'Miguel Santos', role: 'mediador', languages: ['PT', 'EN'], rating: 4.5, reviewCount: 57 },
];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0)).join('').toUpperCase();
}

function formatPtDate(date: Date) {
  return date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatPtWeekdayShort(date: Date) {
  return date.toLocaleDateString('pt-PT', { weekday: 'short' });
}

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function specialistRoleLabel(role: BookingSpecialistRole) {
  if (role === 'jurista') return 'Jurista';
  if (role === 'psicologa') return 'Psicóloga';
  return 'Mediador';
}

function getAvailableTimesFor(specialistId: string, date: Date) {
  const base = ['09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00'];
  const seed = specialistId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const day = date.getDate();
  return base.map((time, index) => {
    const available = ((seed + day + index) % 4) !== 0;
    return { time, available };
  });
}

function sessionStatusUi(status: SessionItem['status']) {
  const raw = (status ?? '').toString().trim();
  const normalized = raw.toLowerCase();

  if (!normalized) {
    return { label: 'Confirmado', className: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
  }

  if (normalized.includes('cancel') || normalized === 'canceled' || normalized === 'cancelled') {
    return { label: 'Cancelado', className: 'bg-slate-100 text-slate-600 border-slate-200' };
  }

  if (normalized.includes('concl') || normalized.includes('completed') || normalized.includes('done')) {
    return { label: 'Concluída', className: 'bg-blue-50 text-blue-700 border-blue-100' };
  }

  if (normalized.includes('pend') || normalized.includes('approval') || normalized.includes('aprov')) {
    return { label: 'Em aprovação', className: 'bg-orange-50 text-orange-700 border-orange-100' };
  }

  return { label: 'Confirmado', className: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
}

function serviceIcon(serviceId: BookingServiceId | null) {
  if (serviceId === 'legal') return <Scale className="h-7 w-7 text-blue-600" />;
  if (serviceId === 'psychology') return <Heart className="h-7 w-7 text-violet-600" />;
  return <Users className="h-7 w-7 text-cyan-600" />;
}

function resolveServiceIdFromSession(session: SessionItem): BookingServiceId | null {
  if (session.service_id === 'legal' || session.service_id === 'psychology' || session.service_id === 'mediation') return session.service_id;
  if (session.session_type === 'jurista') return 'legal';
  if (session.session_type === 'psicologa') return 'psychology';
  if (session.session_type === 'mediador') return 'mediation';
  return null;
}

function serviceDescription(serviceId: BookingServiceId | null) {
  if (!serviceId) return '';
  return BOOKING_SERVICES.find((s) => s.id === serviceId)?.description ?? '';
}

export function BookingServiceStep({
  services,
  value,
  onChange,
  loading,
}: {
  services: BookingServiceOption[];
  value: BookingServiceId | null;
  onChange: (next: BookingServiceId) => void;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <RadioGroup value={value ?? ''} onValueChange={(v) => onChange(v as BookingServiceId)} className="grid gap-3 sm:grid-cols-2">
      {services.map((service) => (
        <Label
          key={service.id}
          htmlFor={`service-${service.id}`}
          className={cn(
            'flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-4 transition-colors hover:bg-slate-50',
            value === service.id ? 'border-primary ring-1 ring-primary' : 'border-slate-200',
          )}
        >
          <RadioGroupItem id={`service-${service.id}`} value={service.id} className="mt-1" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">{service.title}</p>
              <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{service.priceLabel}</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{service.description}</p>
          </div>
        </Label>
      ))}
    </RadioGroup>
  );
}

export function BookingSpecialistStep({
  specialists,
  value,
  onChange,
  loading,
}: {
  specialists: BookingSpecialistOption[];
  value: string | null;
  onChange: (next: string) => void;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    );
  }

  if (specialists.length === 0) {
    return <div className="text-sm text-slate-500">Sem especialistas disponíveis para este serviço.</div>;
  }

  return (
    <RadioGroup value={value ?? ''} onValueChange={onChange} className="grid gap-3 sm:grid-cols-2">
      {specialists.map((spec) => (
        <Label
          key={spec.id}
          htmlFor={`spec-${spec.id}`}
          className={cn(
            'flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-4 transition-colors hover:bg-slate-50',
            value === spec.id ? 'border-primary ring-1 ring-primary' : 'border-slate-200',
          )}
        >
          <RadioGroupItem id={`spec-${spec.id}`} value={spec.id} className="mt-1" />
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-slate-100 text-xs font-semibold text-slate-700">{getInitials(spec.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{spec.name}</p>
                  <p className="text-xs text-slate-600">{specialistRoleLabel(spec.role)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="flex items-center justify-end gap-1 text-slate-700">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span className="text-sm font-semibold">{spec.rating.toFixed(1)}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">{spec.reviewCount} avaliações</div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {spec.languages.map((lang) => (
                  <Badge key={lang} variant="secondary" className="bg-slate-100 text-slate-600">
                    {lang}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Label>
      ))}
    </RadioGroup>
  );
}

export function BookingDateTimeStep({
  selectedDate,
  onDateChange,
  timeValue,
  onTimeChange,
  specialistId,
  loading,
}: {
  selectedDate: Date | null;
  onDateChange: (next: Date) => void;
  timeValue: string | null;
  onTimeChange: (next: string) => void;
  specialistId: string;
  loading?: boolean;
}) {
  const times = selectedDate ? getAvailableTimesFor(specialistId, selectedDate) : [];
  const chosenDayLabel = selectedDate ? `${formatPtWeekdayShort(selectedDate)}, ${formatPtDate(selectedDate)}` : '';

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="rounded-xl border bg-white">
        <UICalendar mode="single" selected={selectedDate ?? undefined} onSelect={(d) => d && onDateChange(d)} />
      </div>
      <div className="rounded-xl border bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">Horários disponíveis</p>
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
        </div>
        {selectedDate ? (
          <p className="mt-1 text-xs text-slate-500">{chosenDayLabel}</p>
        ) : (
          <p className="mt-1 text-xs text-slate-500">Selecione uma data para ver os horários.</p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          {selectedDate
            ? times.map((slot) => (
                <button
                  key={slot.time}
                  type="button"
                  disabled={!slot.available}
                  onClick={() => onTimeChange(slot.time)}
                  className={cn(
                    'inline-flex h-10 items-center justify-center rounded-lg border px-3 text-sm font-semibold transition-colors',
                    slot.available ? 'border-slate-200 text-slate-700 hover:bg-slate-50' : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300',
                    timeValue === slot.time && slot.available ? 'border-primary bg-primary text-white hover:bg-primary' : '',
                  )}
                >
                  {slot.time}
                  {timeValue === slot.time && slot.available ? <Check className="ml-2 h-4 w-4" /> : null}
                </button>
              ))
            : null}
        </div>
      </div>
    </div>
  );
}

export function BookingConfirmationStep({
  service,
  specialist,
  date,
  time,
}: {
  service: BookingServiceOption;
  specialist: BookingSpecialistOption;
  date: Date;
  time: string;
}) {
  return (
    <div className="grid gap-4 rounded-xl border bg-white p-4 sm:p-5">
      <div className="grid gap-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Serviço</p>
        <p className="text-sm font-semibold text-slate-900">{service.title}</p>
        <p className="text-xs text-slate-600">{service.description}</p>
      </div>
      <div className="grid gap-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Especialista</p>
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-slate-100 text-xs font-semibold text-slate-700">{getInitials(specialist.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{specialist.name}</p>
            <p className="text-xs text-slate-600">{specialistRoleLabel(specialist.role)}</p>
          </div>
        </div>
      </div>
      <div className="grid gap-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Data e hora</p>
        <p className="text-sm font-semibold text-slate-900">
          {formatPtDate(date)} • {time}
        </p>
      </div>
    </div>
  );
}

export default function SessionsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Array<SessionItem>>([]);
  const [bookOpen, setBookOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<BookingWizardStep>(1);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [wizardTransitionLoading, setWizardTransitionLoading] = useState(false);
  const [wizardConfirmLoading, setWizardConfirmLoading] = useState(false);
  const [serviceId, setServiceId] = useState<BookingServiceId | null>(null);
  const [specialistId, setSpecialistId] = useState<string | null>(null);
  const [slotDate, setSlotDate] = useState<Date | null>(null);
  const [slotTime, setSlotTime] = useState<string | null>(null);
  const [specialistsLoading, setSpecialistsLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [rescheduleFromSessionId, setRescheduleFromSessionId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const historyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function fetchSessions() {
      if (!user) return;
      setLoading(true);
      try {
        const typed = await queryDocuments<SessionItem>(
          'sessions',
          [{ field: 'migrant_id', operator: '==', value: user.uid }],
          { field: 'scheduled_date', direction: 'asc' }
        );
        setSessions(typed);
      } finally {
        setLoading(false);
      }
    }
    fetchSessions();
  }, [user]);

  const filtered = sessions;

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

  const selectedDaySessions = useMemo(() => {
    return filtered.filter((s) => isSameDay(new Date(s.scheduled_date), selectedDate));
  }, [filtered, selectedDate]);

  const upcomingSessions = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return filtered.filter(s => s.scheduled_date >= today);
  }, [filtered]);

  const pastSessions = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return filtered.filter(s => s.scheduled_date < today).reverse();
  }, [filtered]);

  const selectedService = useMemo(() => (serviceId ? BOOKING_SERVICES.find((s) => s.id === serviceId) ?? null : null), [serviceId]);
  const availableSpecialists = useMemo(() => {
    if (!selectedService) return [];
    return BOOKING_SPECIALISTS.filter((s) => selectedService.specialistRoles.includes(s.role));
  }, [selectedService]);
  const selectedSpecialist = useMemo(() => (specialistId ? BOOKING_SPECIALISTS.find((s) => s.id === specialistId) ?? null : null), [specialistId]);

  useEffect(() => {
    if (!bookOpen) return;
    setWizardError(null);
  }, [wizardStep, bookOpen]);

  useEffect(() => {
    if (!bookOpen) return;
    if (wizardStep !== 2) return;
    setSpecialistsLoading(true);
    Promise.resolve().then(() => setSpecialistsLoading(false));
  }, [bookOpen, wizardStep, serviceId]);

  useEffect(() => {
    if (!bookOpen) return;
    if (wizardStep !== 3) return;
    if (!specialistId) return;
    setSlotsLoading(true);
    Promise.resolve().then(() => setSlotsLoading(false));
  }, [bookOpen, wizardStep, specialistId]);

  function resetWizard() {
    setWizardStep(1);
    setWizardError(null);
    setWizardTransitionLoading(false);
    setWizardConfirmLoading(false);
    setServiceId(null);
    setSpecialistId(null);
    setSlotDate(null);
    setSlotTime(null);
    setSpecialistsLoading(false);
    setSlotsLoading(false);
    setRescheduleFromSessionId(null);
  }

  async function confirmBooking() {
    if (!user || !selectedService || !selectedSpecialist || !slotDate || !slotTime) return;
    setWizardConfirmLoading(true);
    setWizardError(null);
    try {
      if (rescheduleFromSessionId) {
        await updateDocument('sessions', rescheduleFromSessionId, { status: 'Cancelada' });
      }
      await addDocument('sessions', {
        migrant_id: user.uid,
        session_type: selectedSpecialist.role,
        scheduled_date: toISODate(slotDate),
        scheduled_time: slotTime,
        status: 'Agendada',
        service_id: selectedService.id,
        service_label: selectedService.title,
        specialist_id: selectedSpecialist.id,
        specialist_name: selectedSpecialist.name,
      });

      const typed = await queryDocuments<SessionItem>(
        'sessions',
        [{ field: 'migrant_id', operator: '==', value: user.uid }],
        { field: 'scheduled_date', direction: 'asc' }
      );
      setSessions(typed);
      toast({ title: 'Sessão marcada', description: 'A sua marcação foi confirmada com sucesso.' });
      setBookOpen(false);
      resetWizard();
    } catch {
      setWizardError('Não foi possível confirmar a marcação. Tente novamente.');
    } finally {
      setWizardConfirmLoading(false);
    }
  }

  function validateStep(step: BookingWizardStep) {
    if (step === 1 && !serviceId) return 'Selecione um serviço para continuar.';
    if (step === 2 && !specialistId) return 'Selecione um especialista para continuar.';
    if (step === 3 && (!slotDate || !slotTime)) return 'Selecione a data e um horário disponível.';
    return null;
  }

  async function goNext() {
    const error = validateStep(wizardStep);
    if (error) {
      setWizardError(error);
      return;
    }

    if (wizardStep === 4) return;
    setWizardTransitionLoading(true);
    await Promise.resolve();
    setWizardTransitionLoading(false);
    setWizardStep((wizardStep + 1) as BookingWizardStep);
  }

  function goBack() {
    if (wizardStep === 1) return;
    setWizardStep((wizardStep - 1) as BookingWizardStep);
  }

  async function updateStatus(id: string, status: 'Concluída' | 'Cancelada') {
    await updateDocument('sessions', id, { status });
    const next = sessions.map(s => (s.id === id ? { ...s, status } : s));
    setSessions(next);
  }

  function openBookingWizard(opts?: { serviceId?: BookingServiceId; specialistId?: string; step?: BookingWizardStep; rescheduleFromId?: string | null }) {
    const nextServiceId = opts?.serviceId ?? null;
    const nextSpecialistId = opts?.specialistId ?? null;

    setRescheduleFromSessionId(opts?.rescheduleFromId ?? null);
    setWizardError(null);
    setWizardTransitionLoading(false);
    setWizardConfirmLoading(false);
    setServiceId(nextServiceId);
    setSpecialistId(nextSpecialistId);
    setSlotDate(null);
    setSlotTime(null);
    setWizardStep(opts?.step ?? 1);
    setBookOpen(true);
  }

  if (loading) {
    return (
      <div className="py-12 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Minhas Sessões</h1>
          <p className="mt-2 text-sm text-slate-600">Gerencie suas próximas marcações e histórico.</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="inline-flex w-full items-center rounded-xl border bg-white p-1 shadow-sm sm:w-auto">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-pressed={viewMode === 'list'}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors sm:flex-none',
                viewMode === 'list' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50',
              )}
            >
              <List className="h-4 w-4" />
              Lista
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              aria-pressed={viewMode === 'calendar'}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors sm:flex-none',
                viewMode === 'calendar' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50',
              )}
            >
              <CalendarIcon className="h-4 w-4" />
              Calendário
            </button>
          </div>

          <Button onClick={() => openBookingWizard({ step: 1 })} className="h-11 rounded-xl px-5 text-sm font-semibold">
            <PlusCircle className="mr-2 h-4 w-4" />
            Marcar sessão
          </Button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <>
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Minhas próximas sessões</h2>
              <button
                type="button"
                onClick={() => historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                Ver histórico <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4">
              {upcomingSessions.length > 0 ? (
                upcomingSessions.map((s) => {
                  const svcId = resolveServiceIdFromSession(s);
                  const statusUi = sessionStatusUi(s.status);
                  const canJoin = !!s.meeting_url && (s.status ?? 'Agendada') === 'Agendada';
                  const canReschedule = (s.status ?? 'Agendada') === 'Agendada';
                  const canCancel = (s.status ?? 'Agendada') === 'Agendada';
                  const title = s.service_label ?? (svcId ? (BOOKING_SERVICES.find((x) => x.id === svcId)?.title ?? s.session_type) : s.session_type);

                  return (
                    <div key={s.id} className="rounded-2xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-start gap-4">
                          <div className={cn('flex h-16 w-16 items-center justify-center rounded-2xl', svcId === 'legal' ? 'bg-blue-50' : svcId === 'psychology' ? 'bg-violet-50' : 'bg-cyan-50')}>
                            {serviceIcon(svcId)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-lg font-semibold text-slate-900">{title}</p>
                              <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold', statusUi.className)}>
                                {statusUi.label}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-slate-600">{serviceDescription(svcId)}</p>
                            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-600">
                              <span className="inline-flex items-center gap-2">
                                <CalendarIcon className="h-4 w-4 text-slate-400" />
                                {new Date(s.scheduled_date).toLocaleDateString('pt-PT', { year: 'numeric', month: 'short', day: '2-digit' })}
                              </span>
                              <span className="inline-flex items-center gap-2">
                                <Clock className="h-4 w-4 text-slate-400" />
                                {s.scheduled_time}
                              </span>
                              {s.specialist_name ? (
                                <span className="inline-flex items-center gap-2">
                                  <Users className="h-4 w-4 text-slate-400" />
                                  {s.specialist_name}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          {canReschedule ? (
                            <Button
                              variant="outline"
                              className="h-10 rounded-xl px-5 text-sm font-semibold"
                              onClick={() => openBookingWizard({ step: 3, serviceId: svcId ?? undefined, specialistId: s.specialist_id, rescheduleFromId: s.id })}
                            >
                              Reagendar
                            </Button>
                          ) : null}

                          {canJoin ? (
                            <Button
                              className="h-10 rounded-xl px-5 text-sm font-semibold"
                              onClick={() => window.open(s.meeting_url as string, '_blank', 'noopener,noreferrer')}
                            >
                              <Video className="mr-2 h-4 w-4" />
                              Entrar em vídeo
                            </Button>
                          ) : canCancel ? (
                            <Button
                              variant="outline"
                              className="h-10 rounded-xl px-5 text-sm font-semibold"
                              onClick={() => updateStatus(s.id, 'Cancelada')}
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Cancelar
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border bg-white p-6 text-sm text-slate-600">Sem sessões futuras.</div>
              )}
            </div>
          </section>

          <section className="space-y-4" ref={historyRef}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Histórico</h2>
            </div>

            <div className="grid gap-3">
              {pastSessions.length > 0 ? (
                pastSessions.map((s) => {
                  const svcId = resolveServiceIdFromSession(s);
                  const statusUi = sessionStatusUi(s.status);
                  const title = s.service_label ?? (svcId ? (BOOKING_SERVICES.find((x) => x.id === svcId)?.title ?? s.session_type) : s.session_type);
                  return (
                    <div key={s.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{title}</p>
                          <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold', statusUi.className)}>
                            {statusUi.label}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                          <span className="inline-flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4 text-slate-400" />
                            {new Date(s.scheduled_date).toLocaleDateString('pt-PT', { year: 'numeric', month: 'short', day: '2-digit' })}
                          </span>
                          <span className="inline-flex items-center gap-2">
                            <Clock className="h-4 w-4 text-slate-400" />
                            {s.scheduled_time}
                          </span>
                          {s.specialist_name ? (
                            <span className="inline-flex items-center gap-2">
                              <Users className="h-4 w-4 text-slate-400" />
                              {s.specialist_name}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border bg-white p-6 text-sm text-slate-600">Sem histórico.</div>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900">Especialistas disponíveis</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {BOOKING_SERVICES.map((svc) => {
                const topBg =
                  svc.id === 'mediation' ? 'bg-gradient-to-r from-blue-400 to-cyan-300' :
                  svc.id === 'legal' ? 'bg-gradient-to-r from-slate-700 to-slate-500' :
                  'bg-gradient-to-r from-violet-400 to-pink-300';

                const roleLabel = svc.id === 'mediation' ? 'Mediador social' : svc.id === 'legal' ? 'Consultor jurídico' : 'Psicólogo';
                const categoryLabel = svc.id === 'mediation' ? 'Apoio à integração' : svc.id === 'legal' ? 'Apoio legal' : 'Saúde mental';

                return (
                  <div key={svc.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md">
                    <div className={cn('h-24', topBg)} />
                    <div className="px-5 pb-5">
                      <div className="-mt-9 flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-white shadow-sm">
                        {serviceIcon(svc.id)}
                      </div>
                      <h3 className="mt-4 text-xl font-bold text-slate-900">{roleLabel}</h3>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-blue-600">{categoryLabel}</p>
                      <p className="mt-4 text-sm leading-relaxed text-slate-600">{svc.description}</p>
                      <Button
                        className="mt-6 h-11 w-full rounded-xl text-sm font-semibold"
                        onClick={() => openBookingWizard({ serviceId: svc.id, step: 2 })}
                      >
                        Marcar sessão
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      ) : (
        <section className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Calendário</h2>
            <p className="mt-1 text-sm text-slate-600">Selecione um dia para ver as sessões.</p>
            <div className="mt-4 rounded-xl border">
              <UICalendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => setSelectedDate(d || selectedDate)}
                modifiers={{ hasSession: daysWithSessions }}
                modifiersClassNames={{ hasSession: 'ring-1 ring-primary' }}
              />
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Sessões do dia</h2>
              <span className="text-xs font-semibold text-slate-500">{selectedDaySessions.length} sessões</span>
            </div>
            <div className="mt-4 grid gap-3">
              {selectedDaySessions.length > 0 ? (
                selectedDaySessions.map((s) => {
                  const svcId = resolveServiceIdFromSession(s);
                  const statusUi = sessionStatusUi(s.status);
                  const title = s.service_label ?? (svcId ? (BOOKING_SERVICES.find((x) => x.id === svcId)?.title ?? s.session_type) : s.session_type);
                  return (
                    <div key={s.id} className="rounded-2xl border bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">{title}</p>
                            <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold', statusUi.className)}>
                              {statusUi.label}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                            <span className="inline-flex items-center gap-2">
                              <Clock className="h-4 w-4 text-slate-400" />
                              {s.scheduled_time}
                            </span>
                            {s.specialist_name ? (
                              <span className="inline-flex items-center gap-2">
                                <Users className="h-4 w-4 text-slate-400" />
                                {s.specialist_name}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', svcId === 'legal' ? 'bg-blue-50' : svcId === 'psychology' ? 'bg-violet-50' : 'bg-cyan-50')}>
                          {serviceIcon(svcId)}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border bg-white p-6 text-sm text-slate-600">Sem sessões neste dia.</div>
              )}
            </div>
          </div>
        </section>
      )}

      <Dialog
        open={bookOpen}
        onOpenChange={(open) => {
          setBookOpen(open);
          if (!open) resetWizard();
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-5xl p-0">
          <div className="grid min-h-[560px] grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="hidden border-r bg-slate-50 p-6 lg:block">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Marcar Sessão</p>
                  <p className="text-xs text-slate-500">Apoio socio-profissional</p>
                </div>
                <DialogClose aria-label="Cancelar" className="rounded-md p-2 text-slate-500 hover:bg-slate-100">
                  ✕
                </DialogClose>
              </div>

              <div className="mt-6 space-y-4">
                {[
                  { step: 1 as const, title: 'Seleção de Serviço', subtitle: selectedService?.title ?? 'Escolha um serviço' },
                  { step: 2 as const, title: 'Seleção de Especialista', subtitle: selectedSpecialist?.name ?? 'Escolha um profissional' },
                  { step: 3 as const, title: 'Data e Hora', subtitle: slotDate && slotTime ? `${formatPtDate(slotDate)} • ${slotTime}` : 'Escolha um horário' },
                  { step: 4 as const, title: 'Confirmação', subtitle: 'Reveja os detalhes' },
                ].map((item) => {
                  const active = wizardStep === item.step;
                  const completed =
                    item.step === 1 ? !!serviceId :
                    item.step === 2 ? !!specialistId :
                    item.step === 3 ? !!slotDate && !!slotTime :
                    false;
                  return (
                    <div key={item.step} className={cn('flex items-start gap-3 rounded-xl p-3', active ? 'bg-white ring-1 ring-primary' : '')}>
                      <div
                        className={cn(
                          'mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold',
                          completed ? 'border-primary bg-primary text-white' : active ? 'border-primary text-primary' : 'border-slate-200 text-slate-400',
                        )}
                      >
                        {completed ? <Check className="h-4 w-4" /> : item.step}
                      </div>
                      <div className="min-w-0">
                        <p className={cn('text-sm font-semibold', active ? 'text-slate-900' : 'text-slate-700')}>{item.title}</p>
                        <p className="truncate text-xs text-slate-500">{item.subtitle}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex min-w-0 flex-col">
              <div className="flex items-center justify-between border-b px-5 py-4 lg:px-8">
                <DialogHeader className="space-y-0 text-left">
                  <DialogTitle className="text-lg font-semibold text-slate-900">Marcar sessão</DialogTitle>
                  <DialogDescription className="sr-only">Wizard de marcação de sessão em quatro etapas.</DialogDescription>
                  <p className="text-xs text-slate-500">
                    Etapa {wizardStep} de 4
                  </p>
                </DialogHeader>
                <div className="flex items-center gap-2">
                  <DialogClose asChild>
                    <Button variant="outline" className="h-9">Cancelar</Button>
                  </DialogClose>
                </div>
              </div>

              <div className="px-5 py-4 lg:px-8">
                <Progress value={(wizardStep / 4) * 100} className="h-2" />
                {wizardError ? <p role="alert" className="mt-3 text-sm font-semibold text-red-600">{wizardError}</p> : null}
              </div>

              <div className="flex-1 overflow-y-auto px-5 pb-6 lg:px-8">
                {wizardTransitionLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      A carregar…
                    </div>
                  </div>
                ) : (
                  <>
                    {wizardStep === 1 ? (
                      <div>
                        <h2 className="text-xl font-semibold text-slate-900">Selecione o serviço</h2>
                        <p className="mt-1 text-sm text-slate-600">Escolha o tipo de apoio que precisa.</p>
                        <div className="mt-5">
                          <BookingServiceStep
                            services={BOOKING_SERVICES}
                            value={serviceId}
                            onChange={(next) => {
                              setServiceId(next);
                              setSpecialistId(null);
                              setSlotDate(null);
                              setSlotTime(null);
                            }}
                          />
                        </div>
                      </div>
                    ) : null}

                    {wizardStep === 2 ? (
                      <div>
                        <h2 className="text-xl font-semibold text-slate-900">Selecione o especialista</h2>
                        <p className="mt-1 text-sm text-slate-600">Profissionais disponíveis para o serviço escolhido.</p>
                        <div className="mt-5">
                          <BookingSpecialistStep
                            specialists={availableSpecialists}
                            value={specialistId}
                            onChange={(next) => {
                              setSpecialistId(next);
                              setSlotDate(null);
                              setSlotTime(null);
                            }}
                            loading={specialistsLoading}
                          />
                        </div>
                      </div>
                    ) : null}

                    {wizardStep === 3 ? (
                      <div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                          <div>
                            <h2 className="text-xl font-semibold text-slate-900">Selecione data e hora</h2>
                            <p className="mt-1 text-sm text-slate-600">Escolha um horário disponível.</p>
                          </div>
                          <div className="flex gap-2">
                            {selectedService ? (
                              <div className="rounded-xl border bg-white px-3 py-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Serviço</p>
                                <p className="text-sm font-semibold text-slate-900">{selectedService.title}</p>
                              </div>
                            ) : null}
                            {selectedSpecialist ? (
                              <div className="rounded-xl border bg-white px-3 py-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Especialista</p>
                                <p className="text-sm font-semibold text-slate-900">{selectedSpecialist.name}</p>
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-5">
                          {selectedSpecialist ? (
                            <BookingDateTimeStep
                              selectedDate={slotDate}
                              onDateChange={(d) => {
                                setSlotDate(d);
                                setSlotTime(null);
                              }}
                              timeValue={slotTime}
                              onTimeChange={setSlotTime}
                              specialistId={selectedSpecialist.id}
                              loading={slotsLoading}
                            />
                          ) : (
                            <div className="text-sm text-slate-500">Selecione um especialista para ver os horários.</div>
                          )}
                        </div>
                      </div>
                    ) : null}

                    {wizardStep === 4 && selectedService && selectedSpecialist && slotDate && slotTime ? (
                      <div>
                        <h2 className="text-xl font-semibold text-slate-900">Confirmação</h2>
                        <p className="mt-1 text-sm text-slate-600">Revise os detalhes antes de confirmar.</p>
                        <div className="mt-5">
                          <BookingConfirmationStep service={selectedService} specialist={selectedSpecialist} date={slotDate} time={slotTime} />
                        </div>
                        {wizardConfirmLoading ? (
                          <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-600">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            A confirmar…
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                )}
              </div>

              <div className="border-t px-5 py-4 lg:px-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Button variant="outline" className="h-10" onClick={goBack} disabled={wizardStep === 1 || wizardTransitionLoading || wizardConfirmLoading}>
                    Voltar
                  </Button>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="text-xs text-slate-500 sm:mr-3">
                      {selectedService ? (
                        <span className="font-semibold text-slate-700">{selectedService.title}</span>
                      ) : (
                        <span>Selecione um serviço</span>
                      )}
                      {slotDate && slotTime ? <span className="text-slate-400"> • </span> : null}
                      {slotDate && slotTime ? <span className="font-semibold text-slate-700">{formatPtDate(slotDate)} {slotTime}</span> : null}
                    </div>

                    {wizardStep < 4 ? (
                      <Button className="h-10" onClick={goNext} disabled={wizardTransitionLoading || wizardConfirmLoading}>
                        Próximo
                      </Button>
                    ) : (
                      <Button className="h-10" onClick={confirmBooking} disabled={wizardTransitionLoading || wizardConfirmLoading}>
                        {wizardConfirmLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Confirmar marcação
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
