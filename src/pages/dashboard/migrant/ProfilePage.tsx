import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, BookOpen, Clock, User, FileText, Camera, Download, Loader2, ClipboardList } from 'lucide-react';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatPhoneValueForDisplay } from '@/components/ui/phone-input';
import { fetchMigrantProfile, type MigrantProfileDoc, type MigrantProfileResponse } from '@/api/migrantProfile';
import { updateUserProfile } from '@/integrations/firebase/auth';
import { queryDocuments, updateDocument } from '@/integrations/firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { storage } from '@/integrations/firebase/client';
import { getDownloadURL, ref as makeStorageRef, uploadBytes } from 'firebase/storage';
import logo from '@/assets/logo.png';

export default function ProfilePage() {
  const { user, profile: authProfile, refreshProfile } = useAuth();
  const { migrantId } = useParams<{ migrantId?: string }>();
  const { language, setLanguage, t } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MigrantProfileResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [exportingFicha, setExportingFicha] = useState(false);
  const [exportingTriagem, setExportingTriagem] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
  const PHOTO_ALLOWED_MIME = useMemo(() => new Set(['image/jpeg', 'image/png', 'image/gif']), []);

  const [edit, setEdit] = useState<{
    name: string;
    resumeUrl: string;
    professionalTitle: string;
    professionalExperience: string;
    skills: string;
    languagesList: string;
    mainNeeds: string;
    contactPreference: 'email' | 'phone';
    address: string;
    identificationNumber: string;
    region: '' | 'Lisboa' | 'Norte' | 'Centro' | 'Alentejo' | 'Algarve' | 'Outra';
    regionOther: string;
  }>({
    name: '',
    resumeUrl: '',
    professionalTitle: '',
    professionalExperience: '',
    skills: '',
    languagesList: '',
    mainNeeds: '',
    contactPreference: 'email',
    address: '',
    identificationNumber: '',
    region: '',
    regionOther: '',
  });

  const [personalInfoErrors, setPersonalInfoErrors] = useState<Partial<Record<'address' | 'identificationNumber' | 'region' | 'regionOther', string>>>({});

  const targetUserId = migrantId || user?.uid || null;
  const isViewingOtherUser = !!(migrantId && user?.uid && migrantId !== user.uid);
  const sessionsUrl = isViewingOtherUser ? '/dashboard/cpc/agenda' : '/dashboard/migrante/sessoes';
  const triageUrl = isViewingOtherUser ? '/dashboard/cpc/migrantes' : '/triagem';
  const trailsUrl = isViewingOtherUser ? '/dashboard/cpc/trilhas' : '/dashboard/migrante/trilhas';
  const canExportCpcData = useMemo(() => {
    const role = authProfile?.role;
    return (
      isViewingOtherUser &&
      typeof role === 'string' &&
      ['admin', 'manager', 'coordinator', 'mediator', 'lawyer', 'psychologist', 'trainer'].includes(role)
    );
  }, [authProfile?.role, isViewingOtherUser]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!targetUserId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetchMigrantProfile(targetUserId);
        if (cancelled) return;
        const userKey = targetUserId;
        const extrasRaw =
          localStorage.getItem(`profileExtras:${userKey}`) ||
          localStorage.getItem(`profileExtras:${String(userKey)}`);
        const extras = (() => {
          if (!extrasRaw) return null;
          try {
            return JSON.parse(extrasRaw) as Partial<MigrantProfileDoc>;
          } catch {
            return null;
          }
        })();

        setData(res);
        const p = res.profile;
        const merged: MigrantProfileDoc | null = p
          ? {
              ...p,
              birthDate: p.birthDate || extras?.birthDate || null,
              nationality: p.nationality || extras?.nationality || null,
              address: p.address || extras?.address || null,
              identificationNumber: p.identificationNumber || extras?.identificationNumber || null,
              region: p.region || extras?.region || null,
              regionOther: p.regionOther || extras?.regionOther || null,
              resumeUrl: p.resumeUrl || extras?.resumeUrl || null,
              professionalTitle: p.professionalTitle || extras?.professionalTitle || null,
              professionalExperience: p.professionalExperience || extras?.professionalExperience || null,
              skills: p.skills || extras?.skills || null,
              languagesList: p.languagesList || extras?.languagesList || null,
              mainNeeds: p.mainNeeds || extras?.mainNeeds || null,
              contactPreference: p.contactPreference || extras?.contactPreference || null,
            }
          : null;

        if (p && extras) {
          const shouldMigrate =
            (!p.birthDate && extras.birthDate) ||
            (!p.nationality && extras.nationality) ||
            (!p.address && extras.address) ||
            (!p.identificationNumber && extras.identificationNumber) ||
            (!p.region && extras.region) ||
            (!p.regionOther && extras.regionOther) ||
            (!p.resumeUrl && extras.resumeUrl) ||
            (!p.professionalTitle && extras.professionalTitle) ||
            (!p.professionalExperience && extras.professionalExperience) ||
            (!p.skills && extras.skills) ||
            (!p.languagesList && extras.languagesList) ||
            (!p.mainNeeds && extras.mainNeeds) ||
            (!p.contactPreference && extras.contactPreference);

          if (shouldMigrate) {
            void updateDocument('profiles', targetUserId, {
              birthDate: merged?.birthDate || null,
              nationality: merged?.nationality || null,
              address: merged?.address || null,
              identificationNumber: merged?.identificationNumber || null,
              region: merged?.region || null,
              regionOther: merged?.regionOther || null,
              resumeUrl: merged?.resumeUrl || null,
              professionalTitle: merged?.professionalTitle || null,
              professionalExperience: merged?.professionalExperience || null,
              skills: merged?.skills || null,
              languagesList: merged?.languagesList || null,
              mainNeeds: merged?.mainNeeds || null,
              contactPreference: merged?.contactPreference || null,
            });
          }
        }

        setEdit({
          name: merged?.name || res.userProfile?.name || '',
          resumeUrl: merged?.resumeUrl || '',
          professionalTitle: merged?.professionalTitle || '',
          professionalExperience: merged?.professionalExperience || '',
          skills: merged?.skills || '',
          languagesList: merged?.languagesList || '',
          mainNeeds: merged?.mainNeeds || '',
          contactPreference: (merged?.contactPreference as 'email' | 'phone') || 'email',
          address: merged?.address || '',
          identificationNumber: merged?.identificationNumber || '',
          region: (merged?.region as typeof edit.region) || '',
          regionOther: merged?.regionOther || '',
        });
        setEditMode(false);
        setPersonalInfoErrors({});
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : '';
        if (msg === 'PERMISSION_DENIED') {
          setError('Sem permissões para carregar o perfil. Termine a sessão e volte a iniciar.');
          return;
        }
        if (msg === 'PROFILE_READ_FAILED') {
          setError('Não foi possível carregar os dados do perfil.');
          return;
        }
        setError('Não foi possível carregar os dados do perfil.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [targetUserId]);

  const sessionsSorted = useMemo(() => {
    return (data?.sessions || []).slice().sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));
  }, [data?.sessions]);

  const progressSorted = useMemo(() => {
    return (data?.progress || []).slice().sort((a, b) => (b.progress_percent || 0) - (a.progress_percent || 0));
  }, [data?.progress]);

  const profileDoc: MigrantProfileDoc | null = data?.profile || null;
  const triage = data?.triage || null;
  const triageAnswers = useMemo(() => {
    const a = triage?.answers;
    return a && typeof a === 'object' ? (a as Record<string, unknown>) : {};
  }, [triage?.answers]);

  const profileReadOnlyFields = useMemo(() => {
    const triagePhone = typeof triageAnswers.phone === 'string' ? triageAnswers.phone : null;
    const triageBirthDate = typeof triageAnswers.birth_date === 'string' ? triageAnswers.birth_date : null;
    const triageNationality = typeof triageAnswers.nationality === 'string' ? triageAnswers.nationality : null;

    const rawPhone = triagePhone || profileDoc?.phone || '';
    const phone = rawPhone ? formatPhoneValueForDisplay(rawPhone) : '';

    const rawBirth = triageBirthDate || profileDoc?.birthDate || '';
    const birth = (() => {
      if (!rawBirth) return '';
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawBirth);
      if (!m) return rawBirth;
      return `${m[3]}/${m[2]}/${m[1]}`;
    })();

    const nationality = triageNationality || profileDoc?.nationality || '';

    return { phone, birth, nationality };
  }, [profileDoc?.birthDate, profileDoc?.nationality, profileDoc?.phone, triageAnswers]);

  const translateOption = useCallback((questionId: string, value: string) => {
    const key = `triage.options.${questionId}.${value}`;
    const label = t.get(key);
    return label === key ? value : label;
  }, [t]);

  const legalStatusLabel = useMemo(() => {
    const raw = triage?.legal_status || (typeof triageAnswers.legal_status === 'string' ? triageAnswers.legal_status : null);
    if (!raw) return null;
    return translateOption('legal_status', raw);
  }, [triage?.legal_status, triageAnswers.legal_status, translateOption]);

  const arrivedSinceLabel = useMemo(() => {
    const raw =
      (typeof triageAnswers.arrival_date_pt === 'string' ? triageAnswers.arrival_date_pt : null) ||
      (typeof triageAnswers.arrival_date === 'string' ? triageAnswers.arrival_date : null) ||
      null;
    if (!raw) return null;
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)?.[0] || null;
    if (!iso) return raw;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return raw;
    const label = d.toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' });
    return label ? label.replace(/\.$/, '') : raw;
  }, [triageAnswers]);

  const integrationScales = useMemo(() => {
    const scale = (id: string) => {
      const v = triageAnswers[id];
      const str = typeof v === 'string' ? v : typeof v === 'number' ? String(v) : null;
      const n = str ? Number(str) : NaN;
      const normalized = Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : null;
      const percent = normalized ? normalized * 20 : 0;
      const label = normalized ? translateOption(id, String(normalized)) : '—';
      return { value: normalized, percent, label };
    };
    return {
      dailyAutonomy: scale('daily_autonomy'),
      communicationComfort: scale('communication_comfort'),
      socialNorms: scale('social_norms'),
    };
  }, [triageAnswers, translateOption]);

  const identifiedNeeds = useMemo(() => {
    const raw = (triage?.urgencies || []) as unknown;
    const values = Array.isArray(raw) ? (raw.filter((v) => typeof v === 'string' && v.trim().length > 0) as string[]) : [];
    return values.map((v) => ({ value: v, label: translateOption('identified_needs', v) }));
  }, [triage?.urgencies, translateOption]);

  const educationLabel = useMemo(() => {
    const raw = triageAnswers.education_level;
    if (typeof raw !== 'string' || !raw) return '—';
    return translateOption('education_level', raw);
  }, [triageAnswers.education_level, translateOption]);

  const interestAreaLabel = useMemo(() => {
    const raw = triageAnswers.professional_interests;
    const arr = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
    const first = (arr.find((v) => typeof v === 'string' && v.trim().length > 0) as string | undefined) || null;
    if (!first) return null;
    return translateOption('professional_interests', first);
  }, [triageAnswers.professional_interests, translateOption]);

  const skillsTokens = useMemo(() => {
    const tokens = (edit.skills || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return Array.from(new Set(tokens)).slice(0, 6);
  }, [edit.skills]);

  const interfaceLanguageLabel = useMemo(() => {
    if (language === 'pt') return 'Português';
    if (language === 'en') return 'English';
    return language;
  }, [language]);

  const contactPreferenceLabel = useMemo(() => {
    return edit.contactPreference === 'phone' ? 'Telefone' : 'E-mail';
  }, [edit.contactPreference]);

  const upcomingSessions = useMemo(() => {
    const now = new Date().toISOString().slice(0, 10);
    return sessionsSorted.filter((s) => s.scheduled_date >= now).slice(0, 3);
  }, [sessionsSorted]);

  const featuredTrail = useMemo(() => {
    return progressSorted.length ? progressSorted[0] : null;
  }, [progressSorted]);

  const selectedDocumentType = useMemo(() => {
    const raw =
      (typeof triageAnswers.document_type === 'string' ? triageAnswers.document_type : null) ||
      (typeof triageAnswers.id_document_type === 'string' ? triageAnswers.id_document_type : null) ||
      (typeof triageAnswers.documentType === 'string' ? triageAnswers.documentType : null) ||
      null;
    return raw ? raw.toLowerCase() : null;
  }, [triageAnswers]);

  const REGIONS = useMemo(() => ['Lisboa', 'Norte', 'Centro', 'Alentejo', 'Algarve', 'Outra'] as const, []);

  const normalizeIdentificationInput = useCallback((raw: string) => {
    return raw
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 20);
  }, []);

  const validateIdentificationNumber = useCallback((value: string) => {
    const v = normalizeIdentificationInput(value);
    if (!v) return 'O Nº Identificação é obrigatório.';
    if (v.length > 20) return 'O Nº Identificação deve ter no máximo 20 caracteres.';
    if (!/^[A-Z0-9]+$/.test(v)) return 'Use apenas letras maiúsculas e números.';
    const dt = selectedDocumentType || '';
    if (dt.includes('nif')) {
      if (!/^\d{9}$/.test(v)) return 'Para NIF, introduza exatamente 9 dígitos.';
    } else if (dt.includes('pass')) {
      if (v.length < 6) return 'Para Passaporte, introduza pelo menos 6 caracteres.';
    } else if (dt.includes('resid') || dt.includes('cart') || dt.includes('cc')) {
      if (v.length < 6) return 'O Nº Identificação é inválido para o tipo de documento selecionado.';
    }
    return null;
  }, [normalizeIdentificationInput, selectedDocumentType]);

  async function save() {
    if (!user || !targetUserId) return;
    if (isViewingOtherUser) {
      const nextErrors: Partial<Record<'address' | 'identificationNumber' | 'region' | 'regionOther', string>> = {};
      const addressTrim = edit.address.trim();
      if (!addressTrim) nextErrors.address = 'A Morada é obrigatória.';
      else if (addressTrim.length < 10) nextErrors.address = 'A Morada deve ter pelo menos 10 caracteres.';

      const idErr = validateIdentificationNumber(edit.identificationNumber);
      if (idErr) nextErrors.identificationNumber = idErr;

      if (!edit.region) nextErrors.region = 'A Região é obrigatória.';
      else if (!(REGIONS as readonly string[]).includes(edit.region)) nextErrors.region = 'A Região selecionada é inválida.';

      if (edit.region === 'Outra') {
        const regionOtherTrim = edit.regionOther.trim();
        if (!regionOtherTrim) nextErrors.regionOther = 'Indique a Região.';
        else if (regionOtherTrim.length < 2) nextErrors.regionOther = 'Indique uma Região válida.';
      }

      setPersonalInfoErrors(nextErrors);
      if (Object.keys(nextErrors).length) return;
    }

    setPersonalInfoErrors({});
    setSaving(true);
    try {

      const payload: Record<string, unknown> = {
        name: edit.name,
        resumeUrl: edit.resumeUrl || null,
        professionalTitle: edit.professionalTitle || null,
        professionalExperience: edit.professionalExperience || null,
        skills: edit.skills || null,
        languagesList: edit.languagesList || null,
        mainNeeds: edit.mainNeeds || null,
        contactPreference: edit.contactPreference || null,
      };

      if (isViewingOtherUser) {
        payload.address = edit.address.trim();
        payload.identificationNumber = normalizeIdentificationInput(edit.identificationNumber);
        payload.region = edit.region;
        payload.regionOther = edit.region === 'Outra' ? edit.regionOther.trim() : null;
      }

      await updateDocument('profiles', targetUserId, payload);

      if (targetUserId === user.uid) {
        await updateUserProfile(user.uid, { name: edit.name });
        await refreshProfile();
      }

      const res = await fetchMigrantProfile(targetUserId);
      setData(res);
    } catch {
      setError('Não foi possível guardar as alterações do perfil.');
    } finally {
      setSaving(false);
    }
  }

  async function handleExportFicha() {
    if (!targetUserId || exportingFicha) return;
    const profile = data?.profile || null;
    if (!profile || (!profile.name && !profile.email)) {
      toast({ title: 'Dados insuficientes', description: 'Não existem dados suficientes para gerar a ficha.', variant: 'destructive' });
      return;
    }

    // Prossiga mesmo sem dados de progresso; as secções serão apresentadas vazias.

    setExportingFicha(true);
    try {
      const [{ PDFDocument, StandardFonts, rgb }, activities] = await Promise.all([
        import('pdf-lib'),
        queryDocuments<{
          id: string;
          title?: string;
          date?: string;
          startTime?: string;
          status?: string | null;
          topics?: string[] | null;
        }>(
          'activities',
          [{ field: 'participantMigrantIds', operator: 'array-contains', value: targetUserId }],
          { field: 'date', direction: 'desc' },
          200
        ).catch(() => []),
      ]);

      const now = new Date();
      const nowIso = now.toISOString().slice(0, 10);
      const fileDate = nowIso;
      const safeName = (profile.name || profile.email || 'Migrante')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]+/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .slice(0, 60) || 'Migrante';
      const fileName = `Ficha_Migrante_${safeName}_${fileDate}.pdf`;

      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const logoBytes = await fetch(logo).then((r) => r.arrayBuffer());
      const logoImage = await pdfDoc.embedPng(logoBytes);

      const pageSize: [number, number] = [595.28, 841.89];
      const marginX = 48;
      const marginTop = 72;
      const marginBottom = 56;
      const lineGap = 4;
      const headerHeight = 56;

      const newPage = () => {
        const page = pdfDoc.addPage(pageSize);
        const { width, height } = page.getSize();
        const logoMaxH = 28;
        const logoScale = logoMaxH / logoImage.height;
        const logoW = logoImage.width * logoScale;
        const logoH = logoImage.height * logoScale;
        page.drawImage(logoImage, { x: marginX, y: height - 40 - logoH, width: logoW, height: logoH });
        page.drawText('Ficha do Migrante', { x: marginX + logoW + 12, y: height - 44, size: 14, font: fontBold, color: rgb(0.07, 0.07, 0.07) });
        return page;
      };

      const wrapText = (text: string, maxWidth: number, size: number, useBold: boolean) => {
        const f = useBold ? fontBold : font;
        const words = String(text || '').split(/\s+/g).filter(Boolean);
        if (words.length === 0) return ['—'];
        const lines: string[] = [];
        let current = '';
        words.forEach((w) => {
          const next = current ? `${current} ${w}` : w;
          const width = f.widthOfTextAtSize(next, size);
          if (width <= maxWidth) {
            current = next;
            return;
          }
          if (current) lines.push(current);
          current = w;
        });
        if (current) lines.push(current);
        return lines.length ? lines : ['—'];
      };

      let page = newPage();
      let cursorY = page.getSize().height - marginTop - headerHeight;
      const maxTextWidth = page.getSize().width - marginX * 2;

      const ensureSpace = (neededHeight: number) => {
        if (cursorY - neededHeight >= marginBottom) return;
        page = newPage();
        cursorY = page.getSize().height - marginTop - headerHeight;
      };

      const drawTitle = (text: string) => {
        const size = 12;
        ensureSpace(size + 10);
        page.drawText(text, { x: marginX, y: cursorY, size, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
        cursorY -= size + 10;
      };

      const drawKeyValue = (label: string, value: string) => {
        const labelSize = 10;
        const valueSize = 10;
        const labelWidth = 170;
        const valueX = marginX + labelWidth;
        const lines = wrapText(value || '—', maxTextWidth - labelWidth, valueSize, false);
        const blockHeight = lines.length * (valueSize + lineGap) + 2;
        ensureSpace(blockHeight + 6);
        page.drawText(label, { x: marginX, y: cursorY, size: labelSize, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
        lines.forEach((line, idx) => {
          page.drawText(line, { x: valueX, y: cursorY - idx * (valueSize + lineGap), size: valueSize, font, color: rgb(0.1, 0.1, 0.1) });
        });
        cursorY -= blockHeight + 6;
      };

      const drawBullets = (items: Array<{ title: string; meta?: string | null }>, emptyLabel: string = 'Sem registos') => {
        const size = 10;
        const bullet = '•';
        if (items.length === 0) {
          ensureSpace(size + 8);
          page.drawText(emptyLabel, { x: marginX, y: cursorY, size, font, color: rgb(0.35, 0.35, 0.35) });
          cursorY -= size + 8;
          return;
        }
        items.forEach((it) => {
          const text = it.meta ? `${it.title} (${it.meta})` : it.title;
          const lines = wrapText(text, maxTextWidth - 14, size, false);
          const blockHeight = lines.length * (size + lineGap) + 6;
          ensureSpace(blockHeight);
          page.drawText(bullet, { x: marginX, y: cursorY, size, font, color: rgb(0.1, 0.1, 0.1) });
          lines.forEach((line, idx) => {
            page.drawText(line, { x: marginX + 14, y: cursorY - idx * (size + lineGap), size, font, color: rgb(0.1, 0.1, 0.1) });
          });
          cursorY -= blockHeight;
        });
      };

      const birthDate = profileReadOnlyFields.birth || '—';
      const nationality = profileReadOnlyFields.nationality || '—';
      const phone = profileReadOnlyFields.phone || '—';
      const addressValue = (profile.address || '').trim() || '—';
      const idDocNumber =
        (typeof profile.identificationNumber === 'string' && profile.identificationNumber.trim().length > 0)
          ? profile.identificationNumber
          : (typeof triageAnswers.document_number === 'string' && triageAnswers.document_number.trim().length > 0)
            ? triageAnswers.document_number
            : '—';
      const regionValue = (() => {
        const r = typeof profile.region === 'string' ? profile.region : '';
        if (!r) return '—';
        if (r === 'Outra') return (profile.regionOther || '—');
        return r;
      })();

      drawTitle('Ficha de Inscrição');
      drawKeyValue('Nome completo', profile.name || '—');
      drawKeyValue('Morada', addressValue);
      drawKeyValue('Região', regionValue);
      drawKeyValue('Telefone', phone);
      drawKeyValue('E-mail', profile.email || '—');
      drawKeyValue('Data de nascimento', birthDate);
      drawKeyValue('Nacionalidade', nationality);
      drawKeyValue('Nº documento de identificação', idDocNumber);

      const progress = (data?.progress || []).map((p) => ({
        ...p,
        progress_percent: typeof p.progress_percent === 'number' ? p.progress_percent : 0,
      }));
      const pdiPercent = progress.length ? Math.round(progress.reduce((acc, p) => acc + (p.progress_percent || 0), 0) / progress.length) : 0;
      const trails = data?.trails || {};

      const completedTrails = progress
        .filter((p) => (p.progress_percent || 0) >= 100 || !!p.completed_at)
        .map((p) => {
          const trail = trails[p.trail_id] || null;
          const title = trail?.title || p.trail_id || 'Trilha';
          const date = p.completed_at ? new Date(p.completed_at).toLocaleDateString('pt-PT') : null;
          return { title, meta: [date, 'Avaliação: —'].filter(Boolean).join(' · ') };
        });

      const inProgressTrails = progress
        .filter((p) => (p.progress_percent || 0) > 0 && (p.progress_percent || 0) < 100 && !p.completed_at)
        .map((p) => {
          const trail = trails[p.trail_id] || null;
          const title = trail?.title || p.trail_id || 'Trilha';
          const pct = `${Math.round(p.progress_percent || 0)}%`;
          const modules = (() => {
            const done = typeof p.modules_completed === 'number' ? p.modules_completed : null;
            const total = typeof trail?.modules_count === 'number' ? trail.modules_count : null;
            if (done === null || total === null) return null;
            return `${done}/${total} módulos`;
          })();
          return { title, meta: [pct, modules].filter(Boolean).join(' · ') };
        });

      const sessionsDone = (data?.sessions || []).filter((s) => (s.status || '').toLowerCase() === 'completed' || (s.status || '').toLowerCase() === 'concluida');
      const sessionsMissed = (data?.sessions || []).filter((s) => (s.status || '').toLowerCase() === 'missed' || (s.status || '').toLowerCase() === 'faltou');

      const sessionsItems = sessionsDone.map((s) => {
        const date = s.scheduled_date ? new Date(s.scheduled_date).toLocaleDateString('pt-PT') : '—';
        const meta = [`${date} ${s.scheduled_time || ''}`.trim(), 'Observações: —'].filter(Boolean).join(' · ');
        const title = s.session_type ? `Sessão (${s.session_type})` : 'Sessão';
        return { title, meta };
      });

      const activityItems = activities.map((a) => {
        const date = a.date ? new Date(a.date).toLocaleDateString('pt-PT') : '—';
        const meta = [date, a.status ? `Estado: ${a.status}` : null].filter(Boolean).join(' · ');
        return { title: a.title || 'Atividade', meta };
      });

      drawTitle('Relatório de Progresso');
      drawKeyValue('Conclusão do Plano de Desenvolvimento Individual', `${pdiPercent}%`);

      drawTitle('Trilhas formativas concluídas');
      drawBullets(completedTrails);

      drawTitle('Trilhas em curso');
      drawBullets(inProgressTrails);

      drawTitle('Sessões individuais realizadas');
      drawBullets(sessionsItems);

      drawTitle('Atividades participadas');
      drawBullets(activityItems);

      drawTitle('Histórico de presenças e faltas');
      drawKeyValue('Presenças (sessões concluídas)', String(sessionsDone.length));
      drawKeyValue('Faltas (sessões marcadas como falta)', String(sessionsMissed.length));

      drawTitle('Observações gerais');
      drawKeyValue('Desempenho', (profile.mainNeeds || '').trim() || '—');

      const pages = pdfDoc.getPages();
      const totalPages = pages.length;
      pages.forEach((p, idx) => {
        const { width } = p.getSize();
        const label = `Gerado em ${now.toLocaleDateString('pt-PT')} · Página ${idx + 1} de ${totalPages}`;
        p.drawText(label, { x: marginX, y: 28, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
        p.drawText('CPC', { x: width - marginX - font.widthOfTextAtSize('CPC', 9), y: 28, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
      });

      const bytes = await pdfDoc.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      try {
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch {
        void 0;
      }

      toast({ title: 'Ficha exportada', description: 'O PDF foi gerado e o download foi iniciado.' });
    } catch (err) {
      console.error('Erro ao exportar ficha:', err);
      toast({ title: 'Erro ao exportar', description: 'Não foi possível gerar o PDF da ficha do migrante.', variant: 'destructive' });
    } finally {
      setExportingFicha(false);
    }
  }

  async function handleExportTriagem() {
    if (!targetUserId || exportingTriagem) return;
    if (!canExportCpcData) {
      toast({ title: 'Sem permissão', description: 'A sua conta não tem permissões para exportar a triagem deste perfil.', variant: 'destructive' });
      return;
    }

    const profile = data?.profile || null;
    const triageDoc = data?.triage || null;
    const answersRaw = triageDoc?.answers && typeof triageDoc.answers === 'object' ? (triageDoc.answers as Record<string, unknown>) : null;
    const hasAnyAnswer = !!answersRaw && Object.values(answersRaw).some((v) => {
      if (v === null || v === undefined) return false;
      if (typeof v === 'string') return v.trim().length > 0;
      if (typeof v === 'number') return true;
      if (typeof v === 'boolean') return true;
      if (Array.isArray(v)) return v.some((x) => typeof x === 'string' ? x.trim().length > 0 : x !== null && x !== undefined);
      return true;
    });

    if (!profile || (!profile.name && !profile.email)) {
      toast({ title: 'Dados insuficientes', description: 'Não existem dados suficientes do perfil para exportar a triagem.', variant: 'destructive' });
      return;
    }

    if (!triageDoc || !hasAnyAnswer) {
      toast({ title: 'Sem dados de triagem', description: 'Não existem respostas de triagem associadas a este perfil.', variant: 'destructive' });
      return;
    }

    setExportingTriagem(true);
    try {
      const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

      const now = new Date();
      const nowIso = now.toISOString().slice(0, 10);
      const fileDate = nowIso;
      const safeName = (profile.name || profile.email || 'Migrante')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]+/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .slice(0, 60) || 'Migrante';
      const fileName = `Triagem_Migrante_${safeName}_${fileDate}.pdf`;

      const completedAt = typeof triageDoc.completedAt === 'string' ? triageDoc.completedAt : null;
      const completedAtLabel = (() => {
        if (!completedAt) return null;
        const d = new Date(completedAt);
        if (Number.isNaN(d.getTime())) return completedAt;
        return d.toLocaleString('pt-PT');
      })();

      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const logoBytes = await fetch(logo).then((r) => r.arrayBuffer());
      const logoImage = await pdfDoc.embedPng(logoBytes);

      const pageSize: [number, number] = [595.28, 841.89];
      const marginX = 48;
      const marginTop = 72;
      const marginBottom = 56;
      const lineGap = 4;
      const headerHeight = 56;

      const newPage = () => {
        const page = pdfDoc.addPage(pageSize);
        const { width, height } = page.getSize();
        const logoMaxH = 28;
        const logoScale = logoMaxH / logoImage.height;
        const logoW = logoImage.width * logoScale;
        const logoH = logoImage.height * logoScale;
        page.drawImage(logoImage, { x: marginX, y: height - 40 - logoH, width: logoW, height: logoH });
        page.drawText('Triagem do Migrante', { x: marginX + logoW + 12, y: height - 44, size: 14, font: fontBold, color: rgb(0.07, 0.07, 0.07) });
        return page;
      };

      const wrapText = (text: string, maxWidth: number, size: number, useBold: boolean) => {
        const f = useBold ? fontBold : font;
        const words = String(text || '').split(/\s+/g).filter(Boolean);
        if (words.length === 0) return ['—'];
        const lines: string[] = [];
        let current = '';
        words.forEach((w) => {
          const next = current ? `${current} ${w}` : w;
          const width = f.widthOfTextAtSize(next, size);
          if (width <= maxWidth) {
            current = next;
            return;
          }
          if (current) lines.push(current);
          current = w;
        });
        if (current) lines.push(current);
        return lines.length ? lines : ['—'];
      };

      let page = newPage();
      let cursorY = page.getSize().height - marginTop - headerHeight;
      const maxTextWidth = page.getSize().width - marginX * 2;

      const ensureSpace = (neededHeight: number) => {
        if (cursorY - neededHeight >= marginBottom) return;
        page = newPage();
        cursorY = page.getSize().height - marginTop - headerHeight;
      };

      const drawTitle = (text: string) => {
        const size = 12;
        ensureSpace(size + 10);
        page.drawText(text, { x: marginX, y: cursorY, size, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
        cursorY -= size + 10;
      };

      const drawKeyValue = (label: string, value: string) => {
        const labelSize = 10;
        const valueSize = 10;
        const labelWidth = 170;
        const valueX = marginX + labelWidth;
        const lines = wrapText(value || '—', maxTextWidth - labelWidth, valueSize, false);
        const blockHeight = lines.length * (valueSize + lineGap) + 2;
        ensureSpace(blockHeight + 6);
        page.drawText(label, { x: marginX, y: cursorY, size: labelSize, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
        lines.forEach((line, idx) => {
          page.drawText(line, { x: valueX, y: cursorY - idx * (valueSize + lineGap), size: valueSize, font, color: rgb(0.1, 0.1, 0.1) });
        });
        cursorY -= blockHeight + 6;
      };

      const drawQuestionAnswer = (question: string, answer: string, meta?: string | null) => {
        const qSize = 10;
        const aSize = 10;
        const metaSize = 9;
        const qLines = wrapText(question || '—', maxTextWidth, qSize, true);
        const aLines = wrapText(answer || '—', maxTextWidth, aSize, false);
        const metaLines = meta ? wrapText(meta, maxTextWidth, metaSize, false) : [];
        const blockHeight =
          qLines.length * (qSize + lineGap) +
          2 +
          aLines.length * (aSize + lineGap) +
          2 +
          (metaLines.length ? metaLines.length * (metaSize + lineGap) + 4 : 0) +
          8;
        ensureSpace(blockHeight);

        qLines.forEach((line, idx) => {
          page.drawText(line, { x: marginX, y: cursorY - idx * (qSize + lineGap), size: qSize, font: fontBold, color: rgb(0.12, 0.12, 0.12) });
        });
        cursorY -= qLines.length * (qSize + lineGap) + 2;

        aLines.forEach((line, idx) => {
          page.drawText(line, { x: marginX, y: cursorY - idx * (aSize + lineGap), size: aSize, font, color: rgb(0.08, 0.08, 0.08) });
        });
        cursorY -= aLines.length * (aSize + lineGap) + 2;

        if (metaLines.length) {
          metaLines.forEach((line, idx) => {
            page.drawText(line, { x: marginX, y: cursorY - idx * (metaSize + lineGap), size: metaSize, font, color: rgb(0.4, 0.4, 0.4) });
          });
          cursorY -= metaLines.length * (metaSize + lineGap) + 2;
        }

        cursorY -= 6;
      };

      const makeQuestionLabel = (id: string) => {
        const key = `triage.questions.${id}`;
        const label = t.get(key);
        return label === key ? id : label;
      };

      const translateOptionForQuestion = (questionId: string, value: string) => {
        const key = `triage.options.${questionId}.${value}`;
        const label = t.get(key);
        return label === key ? value : label;
      };

      const formatAnswer = (questionId: string, value: unknown) => {
        if (value === null || value === undefined) return '—';
        if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
        if (typeof value === 'number') return String(value);
        if (typeof value === 'string') {
          const v = value.trim();
          if (!v) return '—';
          return translateOptionForQuestion(questionId, v);
        }
        if (Array.isArray(value)) {
          const items = value
            .map((v) => typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : typeof v === 'boolean' ? (v ? 'Sim' : 'Não') : '')
            .filter((v) => v.length > 0)
            .map((v) => translateOptionForQuestion(questionId, v));
          return items.length ? items.join(', ') : '—';
        }
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
      };

      drawTitle('Identificação');
      drawKeyValue('Nome completo', profile.name || '—');
      drawKeyValue('E-mail', profile.email || '—');
      drawKeyValue('ID do perfil', targetUserId);
      drawKeyValue('Estado da triagem', triageDoc.completed ? 'Concluída' : 'Em curso');
      if (completedAtLabel) drawKeyValue('Data/hora de submissão', completedAtLabel);

      drawTitle('Respostas');
      const meta = completedAtLabel ? `Respondido em ${completedAtLabel}` : null;
      const entries = Object.entries(answersRaw)
        .map(([id, v]) => ({ id, question: makeQuestionLabel(id), value: v }))
        .sort((a, b) => a.question.localeCompare(b.question, 'pt'));

      entries.forEach((it) => {
        drawQuestionAnswer(it.question, formatAnswer(it.id, it.value), meta);
      });

      const pages = pdfDoc.getPages();
      const totalPages = pages.length;
      pages.forEach((p, idx) => {
        const { width } = p.getSize();
        const label = `Gerado em ${now.toLocaleDateString('pt-PT')} · Página ${idx + 1} de ${totalPages}`;
        p.drawText(label, { x: marginX, y: 28, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
        p.drawText('CPC', { x: width - marginX - font.widthOfTextAtSize('CPC', 9), y: 28, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
      });

      const bytes = await pdfDoc.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      try {
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch {
        void 0;
      }

      toast({ title: 'Triagem exportada', description: 'O PDF foi gerado e o download foi iniciado.' });
    } catch (err) {
      console.error('Erro ao exportar triagem:', err);
      toast({ title: 'Erro ao exportar', description: 'Não foi possível gerar o PDF da triagem do migrante.', variant: 'destructive' });
    } finally {
      setExportingTriagem(false);
    }
  }

  async function uploadProfilePhoto(file: File) {
    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
    const isAllowedByExt = ['jpg', 'jpeg', 'png', 'gif'].includes(fileExt);
    const isAllowedByMime = file.type ? PHOTO_ALLOWED_MIME.has(file.type) : false;

    if (!user || !targetUserId) {
      toast({ title: 'Sessão expirada', description: 'Inicie sessão novamente e tente outra vez.', variant: 'destructive' });
      return;
    }

    if (!isAllowedByMime && !isAllowedByExt) {
      toast({
        title: 'Formato não suportado',
        description: 'Envie uma imagem JPG, PNG ou GIF (máx. 5MB).',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > PHOTO_MAX_BYTES) {
      toast({ title: 'Imagem muito grande', description: 'O limite é 5MB.', variant: 'destructive' });
      return;
    }

    setUploadingPhoto(true);
    let stage: 'upload' | 'url' | 'db' = 'upload';
    try {
      const safeName = file.name.replace(/[^\w.+-]+/g, '-').slice(0, 80) || 'foto';
      const path = `profile_photos/${targetUserId}/${Date.now()}-${safeName}`;
      const ref = makeStorageRef(storage, path);

      stage = 'upload';
      await uploadBytes(ref, file, { contentType: file.type || undefined });

      stage = 'url';
      const url = await getDownloadURL(ref);

      stage = 'db';
      await updateDocument('profiles', targetUserId, { photoUrl: url });

      setData((prev) => {
        if (!prev) return prev;
        if (!prev.profile) return prev;
        return { ...prev, profile: { ...prev.profile, photoUrl: url } };
      });
      if (targetUserId === user.uid) await refreshProfile();
      toast({ title: 'Foto atualizada', description: 'A sua foto de perfil foi atualizada com sucesso.' });
    } catch (err: unknown) {
      const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code?: unknown }).code) : '';

      if (stage === 'upload') {
        if (code === 'storage/unauthorized') {
          toast({ title: 'Sem permissão', description: 'Não tem permissão para enviar imagens. Verifique as permissões da conta.', variant: 'destructive' });
          return;
        }
        if (code === 'storage/canceled') {
          toast({ title: 'Upload cancelado', description: 'O envio foi cancelado.', variant: 'destructive' });
          return;
        }
        if (code === 'storage/retry-limit-exceeded' || code === 'storage/network-request-failed') {
          toast({ title: 'Falha de conexão', description: 'Não foi possível enviar a imagem. Verifique a sua ligação e tente novamente.', variant: 'destructive' });
          return;
        }
        if (code === 'storage/quota-exceeded') {
          toast({ title: 'Limite excedido', description: 'O serviço de armazenamento atingiu o limite. Tente novamente mais tarde.', variant: 'destructive' });
          return;
        }
        toast({ title: 'Erro no upload', description: 'Não foi possível enviar a imagem. Tente novamente.', variant: 'destructive' });
        return;
      }

      if (stage === 'url') {
        if (code === 'storage/unauthorized') {
          toast({ title: 'Sem permissão', description: 'Não tem permissão para aceder ao ficheiro enviado.', variant: 'destructive' });
          return;
        }
        if (code === 'storage/retry-limit-exceeded' || code === 'storage/network-request-failed') {
          toast({ title: 'Falha de conexão', description: 'Não foi possível obter a URL da imagem. Tente novamente.', variant: 'destructive' });
          return;
        }
        toast({ title: 'Erro ao obter URL', description: 'A imagem foi enviada, mas não foi possível obter o link para exibição.', variant: 'destructive' });
        return;
      }

      if (stage === 'db') {
        if (code === 'permission-denied') {
          toast({ title: 'Sem permissão', description: 'Não foi possível atualizar o perfil com a nova foto. Verifique permissões.', variant: 'destructive' });
          return;
        }
        if (code === 'unavailable' || code === 'deadline-exceeded') {
          toast({ title: 'Servidor indisponível', description: 'Não foi possível guardar o link da imagem no perfil. Tente novamente.', variant: 'destructive' });
          return;
        }
        toast({ title: 'Erro ao guardar', description: 'A imagem foi enviada, mas não foi possível associá-la ao perfil.', variant: 'destructive' });
        return;
      }
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function removeProfilePhoto() {
    if (!user || !targetUserId) return;
    setUploadingPhoto(true);
    try {
      await updateDocument('profiles', targetUserId, { photoUrl: null });
      setData((prev) => {
        if (!prev) return prev;
        if (!prev.profile) return prev;
        return { ...prev, profile: { ...prev.profile, photoUrl: null } };
      });
      if (targetUserId === user.uid) await refreshProfile();
      toast({ title: 'Foto removida' });
    } catch (err: unknown) {
      const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code?: unknown }).code) : '';
      if (code === 'permission-denied') {
        toast({ title: 'Sem permissão', description: 'Não foi possível remover a foto do perfil. Verifique permissões.', variant: 'destructive' });
        return;
      }
      if (code === 'unavailable' || code === 'deadline-exceeded') {
        toast({ title: 'Falha de conexão', description: 'Não foi possível remover a foto. Verifique a ligação e tente novamente.', variant: 'destructive' });
        return;
      }
      toast({ title: 'Erro', description: 'Não foi possível remover a foto. Tente novamente.', variant: 'destructive' });
    } finally {
      setUploadingPhoto(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <div className="py-12 text-center text-muted-foreground">Precisa de iniciar sessão.</div>;
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!profileDoc) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Perfil não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="cpc-card p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-20 w-20 rounded-2xl">
                <AvatarImage src={profileDoc.photoUrl || undefined} alt={edit.name || profileDoc.email || 'Foto de perfil'} />
                <AvatarFallback className="rounded-2xl bg-primary text-primary-foreground text-2xl font-semibold">
                  {(edit.name || profileDoc.email || 'U').slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  e.currentTarget.value = '';
                  if (file) void uploadProfilePhoto(file);
                }}
                disabled={uploadingPhoto}
              />

              {uploadingPhoto ? (
                <div className="absolute inset-0 rounded-2xl bg-background/70 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary"></div>
                  <span className="text-xs font-medium text-muted-foreground">A enviar…</span>
                </div>
              ) : null}

              <button
                type="button"
                className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full border bg-background shadow-sm flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-50"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
                aria-label="Alterar foto"
              >
                <Camera className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {editMode ? (
                  <div className="w-full max-w-sm">
                    <Label htmlFor="profile-name" className="sr-only">
                      Nome
                    </Label>
                    <Input
                      id="profile-name"
                      value={edit.name}
                      onChange={(e) => setEdit((s) => ({ ...s, name: e.target.value }))}
                      className="h-10 text-base md:text-lg font-semibold"
                    />
                  </div>
                ) : (
                  <h1 className="text-xl md:text-2xl font-bold truncate">{edit.name || '—'}</h1>
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate">{profileDoc.email || '—'}</p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {legalStatusLabel ? (
                  <span className="text-xs font-medium px-3 py-1 rounded-full bg-green-100 text-green-700">
                    Situação: {legalStatusLabel}
                  </span>
                ) : null}
                {arrivedSinceLabel ? (
                  <span className="text-xs font-medium px-3 py-1 rounded-full bg-primary/10 text-primary">
                    Portugal desde: {arrivedSinceLabel}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 md:justify-end">
            {editMode ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditMode(false);
                    setPersonalInfoErrors({});
                    setEdit({
                      name: profileDoc.name || data?.userProfile?.name || '',
                      resumeUrl: profileDoc.resumeUrl || '',
                      professionalTitle: profileDoc.professionalTitle || '',
                      professionalExperience: profileDoc.professionalExperience || '',
                      skills: profileDoc.skills || '',
                      languagesList: profileDoc.languagesList || '',
                      mainNeeds: profileDoc.mainNeeds || '',
                      contactPreference: (profileDoc.contactPreference as 'email' | 'phone') || 'email',
                      address: profileDoc.address || '',
                      identificationNumber: profileDoc.identificationNumber || '',
                      region: (profileDoc.region as typeof edit.region) || '',
                      regionOther: profileDoc.regionOther || '',
                    });
                  }}
                  disabled={saving || uploadingPhoto}
                >
                  Cancelar
                </Button>
                <Button type="button" onClick={save} disabled={saving || uploadingPhoto}>
                  {saving ? 'A guardar…' : 'Guardar alterações'}
                </Button>
              </>
            ) : (
              <>
                {isViewingOtherUser ? (
                  <>
                    <Button type="button" variant="outline" onClick={handleExportFicha} disabled={uploadingPhoto || exportingFicha}>
                      {exportingFicha ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                      {exportingFicha ? 'A gerar…' : 'Exportar Ficha'}
                    </Button>
                    {canExportCpcData ? (
                      <Button type="button" variant="outline" onClick={handleExportTriagem} disabled={uploadingPhoto || exportingTriagem}>
                        {exportingTriagem ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardList className="mr-2 h-4 w-4" />}
                        {exportingTriagem ? 'A gerar…' : 'Exportar Triagem'}
                      </Button>
                    ) : null}
                  </>
                ) : null}
                <Button type="button" onClick={() => { setPersonalInfoErrors({}); setEditMode(true); }} disabled={uploadingPhoto}>
                  Editar Perfil
                </Button>
                <Button type="button" variant="outline" onClick={() => window.print()} disabled={uploadingPhoto}>
                  Exportar PDF
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="cpc-card p-6">
          <div className="flex items-start justify-between">
            <h2 className="text-lg font-semibold">Informação Pessoal</h2>
            <User className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Telefone</p>
              <p className="mt-1 font-medium">{profileReadOnlyFields.phone || '—'}</p>
            </div>
            <div>
              <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Nacionalidade</p>
              <p className="mt-1 font-medium">{profileReadOnlyFields.nationality || '—'}</p>
            </div>
            <div>
              <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Data de nascimento</p>
              <p className="mt-1 font-medium">{profileReadOnlyFields.birth || '—'}</p>
            </div>

            <div className="sm:col-span-2">
              <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Morada</p>
              {editMode && isViewingOtherUser ? (
                <>
                  <Label htmlFor="profile-address" className="sr-only">Morada</Label>
                  <Input
                    id="profile-address"
                    aria-label="Morada"
                    value={edit.address}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEdit((s) => ({ ...s, address: v }));
                      if (personalInfoErrors.address) setPersonalInfoErrors((prev) => ({ ...prev, address: undefined }));
                    }}
                    className="mt-2"
                    placeholder="Endereço completo"
                  />
                  {personalInfoErrors.address ? (
                    <p className="text-sm font-medium text-destructive mt-2">{personalInfoErrors.address}</p>
                  ) : null}
                </>
              ) : (
                <p className="mt-1 font-medium">{profileDoc.address || profileDoc.currentLocation || '—'}</p>
              )}
            </div>

            <div>
              <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Nº Identificação</p>
              {editMode && isViewingOtherUser ? (
                <>
                  <Label htmlFor="profile-identification" className="sr-only">Nº Identificação</Label>
                  <Input
                    id="profile-identification"
                    aria-label="Nº Identificação"
                    value={edit.identificationNumber}
                    onChange={(e) => {
                      const v = normalizeIdentificationInput(e.target.value);
                      setEdit((s) => ({ ...s, identificationNumber: v }));
                      if (personalInfoErrors.identificationNumber) setPersonalInfoErrors((prev) => ({ ...prev, identificationNumber: undefined }));
                    }}
                    className="mt-2"
                    placeholder="Ex.: AB123456"
                    inputMode="text"
                    maxLength={20}
                  />
                  {personalInfoErrors.identificationNumber ? (
                    <p className="text-sm font-medium text-destructive mt-2">{personalInfoErrors.identificationNumber}</p>
                  ) : null}
                </>
              ) : (
                <p className="mt-1 font-medium">
                  {profileDoc.identificationNumber || (typeof triageAnswers.document_number === 'string' ? triageAnswers.document_number : '') || '—'}
                </p>
              )}
            </div>

            <div>
              <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Região</p>
              {editMode && isViewingOtherUser ? (
                <>
                  <Select
                    value={edit.region}
                    onValueChange={(v) => {
                      setEdit((s) => ({ ...s, region: v as typeof edit.region, regionOther: v === 'Outra' ? s.regionOther : '' }));
                      setPersonalInfoErrors((prev) => ({ ...prev, region: undefined }));
                    }}
                  >
                    <SelectTrigger className="mt-2" aria-label="Região">
                      <SelectValue placeholder="Selecionar…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Lisboa">Lisboa</SelectItem>
                      <SelectItem value="Norte">Norte</SelectItem>
                      <SelectItem value="Centro">Centro</SelectItem>
                      <SelectItem value="Alentejo">Alentejo</SelectItem>
                      <SelectItem value="Algarve">Algarve</SelectItem>
                      <SelectItem value="Outra">Outra</SelectItem>
                    </SelectContent>
                  </Select>
                  {personalInfoErrors.region ? (
                    <p className="text-sm font-medium text-destructive mt-2">{personalInfoErrors.region}</p>
                  ) : null}
                  {edit.region === 'Outra' ? (
                    <>
                      <Label htmlFor="profile-region-other" className="sr-only">Outra Região</Label>
                      <Input
                        id="profile-region-other"
                        aria-label="Outra Região"
                        value={edit.regionOther}
                        onChange={(e) => {
                          const v = e.target.value;
                          setEdit((s) => ({ ...s, regionOther: v }));
                          if (personalInfoErrors.regionOther) setPersonalInfoErrors((prev) => ({ ...prev, regionOther: undefined }));
                        }}
                        className="mt-3"
                        placeholder="Indique a região"
                      />
                      {personalInfoErrors.regionOther ? (
                        <p className="text-sm font-medium text-destructive mt-2">{personalInfoErrors.regionOther}</p>
                      ) : null}
                    </>
                  ) : null}
                </>
              ) : (
                <p className="mt-1 font-medium">
                  {profileDoc.region === 'Outra' ? profileDoc.regionOther || '—' : profileDoc.region || '—'}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="cpc-card p-6">
          <div className="flex items-start justify-between">
            <h2 className="text-lg font-semibold">Documentos &amp; Configurações</h2>
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="mt-5 space-y-5">
            <div>
              <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Currículo (URL)</p>
              {editMode ? (
                <Input
                  value={edit.resumeUrl}
                  onChange={(e) => setEdit((s) => ({ ...s, resumeUrl: e.target.value }))}
                  className="mt-2"
                  placeholder="https://..."
                />
              ) : edit.resumeUrl ? (
                <a href={edit.resumeUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex text-sm text-primary hover:underline">
                  Visualizar documento anexado
                </a>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">—</p>
              )}
            </div>

            <div>
              <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Idioma de interface</p>
              {editMode ? (
                <Select value={language} onValueChange={(v) => setLanguage(v as typeof language)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt">Português</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="mt-1 font-medium">{interfaceLanguageLabel}</p>
              )}
            </div>

            <div>
              <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Preferência de contacto</p>
              {editMode ? (
                <Select value={edit.contactPreference} onValueChange={(v) => setEdit((s) => ({ ...s, contactPreference: v as 'email' | 'phone' }))}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Telefone</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="mt-1 font-medium">{contactPreferenceLabel}</p>
              )}
            </div>

            {profileDoc.photoUrl ? (
              <div className="pt-1">
                <Button type="button" variant="ghost" size="sm" className="px-0" disabled={uploadingPhoto} onClick={removeProfilePhoto}>
                  Remover foto
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="cpc-card p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Marcações</h2>
            </div>
            <Link to={sessionsUrl} className="text-sm text-primary hover:underline">
              Ver todas
            </Link>
          </div>

          <div className="mt-5 rounded-xl border bg-muted/30 p-6 min-h-[160px] flex items-center justify-center">
            {upcomingSessions.length ? (
              <div className="w-full space-y-3">
                {upcomingSessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg bg-background/70 border px-4 py-3">
                    <div>
                      <p className="font-medium text-sm">{s.session_type}</p>
                      <p className="text-xs text-muted-foreground">Status: {s.status || '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{new Date(s.scheduled_date).toLocaleDateString('pt-PT')}</p>
                      <p className="text-xs text-muted-foreground">{s.scheduled_time}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center">
                <div className="mx-auto h-12 w-12 rounded-full bg-background border flex items-center justify-center text-muted-foreground">
                  <Clock className="h-5 w-5" />
                </div>
                <p className="mt-4 text-sm text-muted-foreground">Sem marcações agendadas no momento.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="cpc-card p-6 lg:col-span-2">
          <div className="flex items-start justify-between">
            <h2 className="text-lg font-semibold">Status Migratório &amp; Integração</h2>
            <Link to={triageUrl} className="text-sm text-primary hover:underline">
              Atualizar
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl bg-muted/30 p-4">
              <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Autonomia diária</p>
              <div className="mt-3 flex items-center gap-3">
                <Progress value={integrationScales.dailyAutonomy.percent} className="h-2 flex-1" />
                <span className="text-xs font-medium">{integrationScales.dailyAutonomy.label}</span>
              </div>
            </div>

            <div className="rounded-xl bg-muted/30 p-4">
              <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Conforto na comunicação</p>
              <div className="mt-3 flex items-center gap-3">
                <Progress value={integrationScales.communicationComfort.percent} className="h-2 flex-1" />
                <span className="text-xs font-medium">{integrationScales.communicationComfort.label}</span>
              </div>
            </div>

            <div className="rounded-xl bg-muted/30 p-4">
              <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Normas sociais</p>
              <div className="mt-3 flex items-center gap-3">
                <Progress value={integrationScales.socialNorms.percent} className="h-2 flex-1" />
                <span className="text-xs font-medium">{integrationScales.socialNorms.label}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t">
            <p className="font-semibold">Necessidades Identificadas</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {identifiedNeeds.length ? (
                identifiedNeeds.map((n) => {
                  const tone =
                    n.value === 'psychological'
                      ? 'bg-indigo-100 text-indigo-700'
                      : n.value === 'employment'
                        ? 'bg-green-100 text-green-700'
                        : n.value === 'housing'
                          ? 'bg-orange-100 text-orange-700'
                          : n.value === 'health'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-muted text-muted-foreground';
                  return (
                    <span key={n.value} className={`text-xs font-medium px-3 py-1 rounded-full ${tone}`}>
                      {n.label}
                    </span>
                  );
                })
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>
          </div>
        </div>

        <div className="cpc-card p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Trilhas de Sucesso</h2>
            </div>
            <Link to={trailsUrl} className="text-sm text-primary hover:underline">
              Ver todas
            </Link>
          </div>

          <div className="mt-5 space-y-4">
            {featuredTrail ? (
              <Link
                to={isViewingOtherUser ? trailsUrl : `/dashboard/migrante/trilhas/${featuredTrail.trail_id}`}
                className="block rounded-xl border bg-muted/20 px-4 py-4 hover:bg-muted/30 transition-colors"
              >
                <p className="text-[11px] tracking-wider text-primary uppercase font-semibold">Em curso</p>
                <p className="mt-1 font-semibold text-sm">
                  {data?.trails?.[featuredTrail.trail_id]?.title || featuredTrail.trail_id}
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <Progress value={featuredTrail.progress_percent || 0} className="h-2 flex-1" />
                  <span className="text-xs font-semibold text-muted-foreground">{featuredTrail.progress_percent || 0}%</span>
                </div>
              </Link>
            ) : (
              <div className="rounded-xl border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                Ainda não iniciou nenhuma trilha.
              </div>
            )}

            <Link
              to={trailsUrl}
              className="block rounded-xl border border-dashed px-4 py-3 text-center text-sm text-muted-foreground hover:bg-muted/30 transition-colors"
            >
              + Iniciar nova trilha
            </Link>
          </div>
        </div>
      </div>

      <div className="cpc-card p-6">
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold">Perfil Profissional</h2>
          {edit.resumeUrl ? (
            <a href={edit.resumeUrl} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
              Ver currículo completo
            </a>
          ) : (
            <span className="text-sm text-muted-foreground"> </span>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Escolaridade</p>
            <p className="mt-2 font-medium">{educationLabel}</p>
          </div>

          <div>
            <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Área de interesse</p>
            {interestAreaLabel ? (
              <span className="mt-2 inline-flex text-xs font-semibold px-3 py-1 rounded-full bg-muted">
                {interestAreaLabel.toUpperCase()}
              </span>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">—</p>
            )}
          </div>

          <div className="md:col-span-3">
            <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Experiência profissional</p>
            {editMode ? (
              <Textarea
                value={edit.professionalExperience}
                onChange={(e) => setEdit((s) => ({ ...s, professionalExperience: e.target.value }))}
                className="mt-2"
              />
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                {edit.professionalExperience?.trim() ? edit.professionalExperience : '—'}
              </p>
            )}
          </div>

          <div className="md:col-span-3">
            <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Competências</p>
            {editMode ? (
              <Textarea value={edit.skills} onChange={(e) => setEdit((s) => ({ ...s, skills: e.target.value }))} className="mt-2" />
            ) : skillsTokens.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {skillsTokens.map((s) => (
                  <span key={s} className="text-xs font-medium px-3 py-1 rounded-full bg-primary/10 text-primary">
                    {s}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">—</p>
            )}
          </div>

          <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Título profissional</p>
              {editMode ? (
                <Input value={edit.professionalTitle} onChange={(e) => setEdit((s) => ({ ...s, professionalTitle: e.target.value }))} className="mt-2" />
              ) : (
                <p className="mt-2 font-medium">{edit.professionalTitle?.trim() ? edit.professionalTitle : '—'}</p>
              )}
            </div>

            <div>
              <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Idiomas</p>
              {editMode ? (
                <Input value={edit.languagesList} onChange={(e) => setEdit((s) => ({ ...s, languagesList: e.target.value }))} className="mt-2" />
              ) : (
                <p className="mt-2 font-medium">{edit.languagesList?.trim() ? edit.languagesList : '—'}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <p className="text-[11px] tracking-wider text-muted-foreground uppercase">Necessidades principais</p>
              {editMode ? (
                <Textarea value={edit.mainNeeds} onChange={(e) => setEdit((s) => ({ ...s, mainNeeds: e.target.value }))} className="mt-2" />
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">{edit.mainNeeds?.trim() ? edit.mainNeeds : '—'}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
