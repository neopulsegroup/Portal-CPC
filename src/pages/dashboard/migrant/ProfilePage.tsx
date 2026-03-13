import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, BookOpen, Clock, User, FileText, Camera } from 'lucide-react';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatPhoneValueForDisplay } from '@/components/ui/phone-input';
import { fetchMigrantProfile, type MigrantProfileDoc, type MigrantProfileResponse } from '@/api/migrantProfile';
import { updateUserProfile } from '@/integrations/firebase/auth';
import { updateDocument } from '@/integrations/firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { storage } from '@/integrations/firebase/client';
import { getDownloadURL, ref as makeStorageRef, uploadBytes } from 'firebase/storage';

export default function ProfilePage() {
  const { user, refreshProfile } = useAuth();
  const { migrantId } = useParams<{ migrantId?: string }>();
  const { language, setLanguage, t } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MigrantProfileResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [editMode, setEditMode] = useState(false);
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
  }>({
    name: '',
    resumeUrl: '',
    professionalTitle: '',
    professionalExperience: '',
    skills: '',
    languagesList: '',
    mainNeeds: '',
    contactPreference: 'email',
  });

  const targetUserId = migrantId || user?.uid || null;
  const isViewingOtherUser = !!(migrantId && user?.uid && migrantId !== user.uid);
  const sessionsUrl = isViewingOtherUser ? '/dashboard/cpc/agenda' : '/dashboard/migrante/sessoes';
  const triageUrl = isViewingOtherUser ? '/dashboard/cpc/migrantes' : '/triagem';
  const trailsUrl = isViewingOtherUser ? '/dashboard/cpc/trilhas' : '/dashboard/migrante/trilhas';

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
        });
        setEditMode(false);
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

  async function save() {
    if (!user || !targetUserId) return;
    setSaving(true);
    try {
      await updateDocument('profiles', targetUserId, {
        name: edit.name,
        resumeUrl: edit.resumeUrl || null,
        professionalTitle: edit.professionalTitle || null,
        professionalExperience: edit.professionalExperience || null,
        skills: edit.skills || null,
        languagesList: edit.languagesList || null,
        mainNeeds: edit.mainNeeds || null,
        contactPreference: edit.contactPreference || null,
      });

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
                    setEdit({
                      name: profileDoc.name || data?.userProfile?.name || '',
                      resumeUrl: profileDoc.resumeUrl || '',
                      professionalTitle: profileDoc.professionalTitle || '',
                      professionalExperience: profileDoc.professionalExperience || '',
                      skills: profileDoc.skills || '',
                      languagesList: profileDoc.languagesList || '',
                      mainNeeds: profileDoc.mainNeeds || '',
                      contactPreference: (profileDoc.contactPreference as 'email' | 'phone') || 'email',
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
                <Button type="button" onClick={() => setEditMode(true)} disabled={uploadingPhoto}>
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

          <div className="mt-5 space-y-5">
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
