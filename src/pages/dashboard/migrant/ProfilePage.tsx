import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Calendar, BookOpen, Clock, CheckCircle, Star, Upload, Edit, Bell, FileText } from 'lucide-react';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';

interface SessionItem {
  id: string;
  session_type: string;
  scheduled_date: string;
  scheduled_time: string;
  professional_id: string | null;
  status: string | null;
}

interface TrailProgressItem {
  trail_id: string;
  progress_percent: number | null;
  modules_completed: number | null;
  completed_at: string | null;
}

interface TrailInfo {
  id: string;
  title: string;
  modules_count: number | null;
}

export default function ProfilePage() {
  const { user, profile } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [progress, setProgress] = useState<TrailProgressItem[]>([]);
  const [trails, setTrails] = useState<Record<string, TrailInfo>>({});
  const [favoriteTrails, setFavoriteTrails] = useState<Set<string>>(new Set());
  const [selectedStatus, setSelectedStatus] = useState<string>('Todos');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [cvOpen, setCvOpen] = useState(false);
  const [cvTitle, setCvTitle] = useState('Currículo');
  const [cvSummary, setCvSummary] = useState('');
  const [cvSkills, setCvSkills] = useState('');
  const [cvExperience, setCvExperience] = useState('');
  const [cvEducation, setCvEducation] = useState('');
  const [notif, setNotif] = useState<Array<{ id: string; title: string; body: string; read: boolean; date: string }>>([]);
  const [triageDetail, setTriageDetail] = useState<{
    legal_status?: string | null;
    work_status?: string | null;
    language_level?: string | null;
    interests?: string[] | null;
    urgencies?: string[] | null;
  } | null>(null);
  const [nationality, setNationality] = useState('');
  const [originCountry, setOriginCountry] = useState('');
  const [arrivalDate, setArrivalDate] = useState('');
  const [skills, setSkills] = useState('');
  const [languagesList, setLanguagesList] = useState('');
  const [mainNeeds, setMainNeeds] = useState('');
  const [professionalExperience, setProfessionalExperience] = useState('');
  const [professionalTitle, setProfessionalTitle] = useState('');
  const [contactPreference, setContactPreference] = useState<'email' | 'phone'>('email');

  const upcomingSessions = useMemo(() => {
    const now = new Date().toISOString().slice(0, 10);
    return sessions
      .filter(s => s.scheduled_date >= now)
      .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
  }, [sessions]);

  useEffect(() => {
    async function fetchAll() {
      if (!user) return;
      setLoading(true);
      try {
        const [sessionsRes, progressRes] = await Promise.all([
          supabase
            .from('sessions')
            .select('id, session_type, scheduled_date, scheduled_time, professional_id, status')
            .eq('migrant_id', user.id),
          supabase
            .from('user_trail_progress')
            .select('trail_id, progress_percent, modules_completed, completed_at')
            .eq('user_id', user.id),
        ]);

        setSessions(sessionsRes.data || []);
        const progressList = (progressRes.data || []) as TrailProgressItem[];
        setProgress(progressList);

        const trailIds = Array.from(new Set(progressList.map(p => p.trail_id).filter(Boolean)));
        if (trailIds.length > 0) {
          const { data: trailsRes } = await supabase
            .from('trails')
            .select('id, title, modules_count')
            .in('id', trailIds);
          const map: Record<string, TrailInfo> = {};
          (trailsRes || []).forEach(t => { map[t.id] = t as TrailInfo; });
          setTrails(map);
        } else {
          setTrails({});
        }
        try {
          const raw = localStorage.getItem(`favoriteTrails:${user.id}`);
          if (raw) {
            const arr = JSON.parse(raw) as string[];
            setFavoriteTrails(new Set(arr));
          } else {
            setFavoriteTrails(new Set());
          }
        } catch {
          setFavoriteTrails(new Set());
        }
        setEditName(profile?.name || '');
        setEditPhone(profile?.phone || '');
        try {
          const r = localStorage.getItem(`resume:${user.id}`);
          setResumeUrl(r || null);
        } catch {
          setResumeUrl(null);
        }
        try {
          const rawNotif = localStorage.getItem(`notifications:${user.id}`);
          if (rawNotif) {
            setNotif(JSON.parse(rawNotif));
          } else {
            setNotif([]);
          }
        } catch {
          setNotif([]);
        }
        try {
          const extras = localStorage.getItem(`profileExtras:${user.id}`);
          if (extras) {
            const parsed = JSON.parse(extras) as {
              nationality?: string;
              originCountry?: string;
              arrivalDate?: string;
              skills?: string;
              languagesList?: string;
              mainNeeds?: string;
              professionalExperience?: string;
              professionalTitle?: string;
              contactPreference?: 'email' | 'phone';
            };
            setNationality(parsed.nationality || '');
            setOriginCountry(parsed.originCountry || '');
            setArrivalDate(parsed.arrivalDate || '');
            setSkills(parsed.skills || '');
            setLanguagesList(parsed.languagesList || '');
            setMainNeeds(parsed.mainNeeds || '');
            setProfessionalExperience(parsed.professionalExperience || '');
            setProfessionalTitle(parsed.professionalTitle || '');
            setContactPreference(parsed.contactPreference || 'email');
          }
        } catch { void 0; }
        const { data: tri } = await supabase
          .from('triage')
          .select('legal_status, work_status, language_level, interests, urgencies')
          .eq('user_id', user.id)
          .maybeSingle();
        if (tri) setTriageDetail(tri as typeof triageDetail);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, [user]);

  useEffect(() => {
    setPage(1);
  }, [selectedStatus, pageSize, sessions]);

  useEffect(() => {
    setEditName(profile?.name || '');
    setEditPhone(profile?.phone || '');
  }, [profile]);

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach(s => set.add(s.status || 'Agendada'));
    return ['Todos', ...Array.from(set)];
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    let list = sessions.slice();
    if (selectedStatus !== 'Todos') {
      list = list.filter(s => (s.status || 'Agendada') === selectedStatus);
    }
    list.sort((a, b) => sortOrder === 'asc' ? a.scheduled_date.localeCompare(b.scheduled_date) : b.scheduled_date.localeCompare(a.scheduled_date));
    return list;
  }, [sessions, selectedStatus, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / pageSize));
  const paginatedSessions = filteredSessions.slice((page - 1) * pageSize, page * pageSize);

  const inProgress = useMemo(() => progress.filter(p => p.completed_at === null && ((p.modules_completed || 0) > 0 || (p.progress_percent || 0) > 0)), [progress]);
  const favoriteList = useMemo(() => progress.filter(p => favoriteTrails.has(p.trail_id)), [progress, favoriteTrails]);

  function toggleFavorite(trailId: string) {
    const next = new Set(favoriteTrails);
    if (next.has(trailId)) next.delete(trailId); else next.add(trailId);
    setFavoriteTrails(next);
    if (user) localStorage.setItem(`favoriteTrails:${user.id}`, JSON.stringify(Array.from(next)));
  }

  async function saveProfile() {
    if (!user) return;
    setSavingProfile(true);
    try {
      await supabase.from('profiles').update({ name: editName, phone: editPhone }).eq('user_id', user.id);
      localStorage.setItem(
        `profileExtras:${user.id}`,
        JSON.stringify({
          nationality,
          originCountry,
          arrivalDate,
          skills,
          languagesList,
          mainNeeds,
          professionalExperience,
          professionalTitle,
          contactPreference,
        })
      );
    } finally {
      setSavingProfile(false);
    }
  }

  function triggerAvatarInput() {
    avatarInputRef.current?.click();
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!user || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setAvatarUploading(true);
    try {
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (!error && data) {
        const pub = supabase.storage.from('avatars').getPublicUrl(data.path);
        const url = pub.data.publicUrl;
        await supabase.from('profiles').update({ avatar_url: url }).eq('user_id', user.id);
      } else {
        const objectUrl = URL.createObjectURL(file);
        await supabase.from('profiles').update({ avatar_url: objectUrl }).eq('user_id', user.id);
      }
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleResumeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!user || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setResumeUploading(true);
    try {
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage.from('resumes').upload(path, file, { upsert: true });
      if (!error && data) {
        const pub = supabase.storage.from('resumes').getPublicUrl(data.path);
        const url = pub.data.publicUrl;
        setResumeUrl(url);
        localStorage.setItem(`resume:${user.id}`, url);
      } else {
        const objectUrl = URL.createObjectURL(file);
        setResumeUrl(objectUrl);
        localStorage.setItem(`resume:${user.id}`, objectUrl);
      }
    } finally {
      setResumeUploading(false);
    }
  }

  function generateResumeHtml() {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${cvTitle}</title><style>body{font-family:system-ui;padding:24px;max-width:800px;margin:auto}h1{font-size:24px;margin-bottom:8px}h2{font-size:18px;margin-top:16px;margin-bottom:8px}p{line-height:1.6}ul{margin:0;padding-left:18px}</style></head><body><h1>${profile?.name || ''}</h1><p>${profile?.email || ''}${profile?.phone ? ' • ' + profile.phone : ''}</p><h2>Resumo</h2><p>${cvSummary}</p><h2>Competências</h2><p>${cvSkills}</p><h2>Experiência</h2><p>${cvExperience}</p><h2>Formação</h2><p>${cvEducation}</p></body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }

  async function saveGeneratedResume() {
    const blob = new Blob([`Nome: ${profile?.name}\nEmail: ${profile?.email}\nTelefone: ${profile?.phone || ''}\n\nResumo:\n${cvSummary}\n\nCompetências:\n${cvSkills}\n\nExperiência:\n${cvExperience}\n\nFormação:\n${cvEducation}`], { type: 'text/plain' });
    if (!user) return;
    const path = `${user.id}/${Date.now()}-curriculo.txt`;
    const { data, error } = await supabase.storage.from('resumes').upload(path, blob, { upsert: true });
    if (!error && data) {
      const pub = supabase.storage.from('resumes').getPublicUrl(data.path);
      const url = pub.data.publicUrl;
      setResumeUrl(url);
      localStorage.setItem(`resume:${user.id}`, url);
    }
    setCvOpen(false);
  }

  function markNotification(id: string) {
    const updated = notif.map(n => n.id === id ? { ...n, read: true } : n);
    setNotif(updated);
    if (user) localStorage.setItem(`notifications:${user.id}`, JSON.stringify(updated));
  }

  function clearNotifications() {
    setNotif([]);
    if (user) localStorage.setItem(`notifications:${user.id}`, JSON.stringify([]));
  }

  function getLastModule(trailId: string): { module_id: string; title: string } | null {
    if (!user) return null;
    try {
      const raw = localStorage.getItem(`lastModuleViewed:${trailId}:${user.id}`);
      if (!raw) return null;
      return JSON.parse(raw) as { module_id: string; title: string };
    } catch {
      return null;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8 grid lg:grid-cols-3 gap-6">
        <div className="cpc-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Edit className="h-5 w-5 text-primary" />
              Perfil
            </h2>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <Avatar className="h-14 w-14">
              {profile?.avatar_url ? (
                <AvatarImage src={profile.avatar_url} alt={profile?.name || 'Utilizador'} />
              ) : (
                <AvatarFallback>{(profile?.name || 'A').slice(0, 1)}</AvatarFallback>
              )}
            </Avatar>
            <div className="flex items-center gap-2">
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              <Button variant="outline" size="sm" onClick={triggerAvatarInput} disabled={avatarUploading}>
                <Upload className="h-4 w-4 mr-2" />
                {avatarUploading ? 'Enviando...' : 'Trocar foto'}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Nome</Label>
              <Input id="name" value={editName} onChange={(e) => setEditName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={profile?.email || ''} disabled className="mt-1" />
            </div>
            <div>
              <Label htmlFor="nationality">Nacionalidade</Label>
              <Input id="nationality" value={nationality} onChange={(e) => setNationality(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="originCountry">País de origem</Label>
              <Input id="originCountry" value={originCountry} onChange={(e) => setOriginCountry(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">{profile?.email}</div>
            <Button onClick={saveProfile} disabled={savingProfile}>{savingProfile ? 'Salvando...' : 'Salvar alterações'}</Button>
          </div>
        </div>
        <div className="cpc-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Currículo
            </h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input type="file" accept="application/pdf,text/plain" className="hidden" id="resume-input" onChange={handleResumeUpload} />
              <Label htmlFor="resume-input">
                <Button variant="outline" size="sm" asChild>
                  <span className="inline-flex items-center"><Upload className="h-4 w-4 mr-2" />{resumeUploading ? 'Enviando...' : 'Enviar currículo'}</span>
                </Button>
              </Label>
              <Dialog open={cvOpen} onOpenChange={setCvOpen}>
                <Button variant="default" size="sm" onClick={() => setCvOpen(true)}>Criar currículo</Button>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar currículo</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="cv-title">Título</Label>
                      <Input id="cv-title" value={cvTitle} onChange={(e) => setCvTitle(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="cv-summary">Resumo</Label>
                      <Textarea id="cv-summary" value={cvSummary} onChange={(e) => setCvSummary(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="cv-skills">Competências</Label>
                      <Textarea id="cv-skills" value={cvSkills} onChange={(e) => setCvSkills(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="cv-experience">Experiência</Label>
                      <Textarea id="cv-experience" value={cvExperience} onChange={(e) => setCvExperience(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="cv-education">Formação</Label>
                      <Textarea id="cv-education" value={cvEducation} onChange={(e) => setCvEducation(e.target.value)} className="mt-1" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={generateResumeHtml}>Pré-visualizar</Button>
                    <Button onClick={saveGeneratedResume}>Salvar</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            {resumeUrl ? (
              <div className="text-sm">
                <a href={resumeUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">Abrir currículo</a>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Nenhum currículo enviado</div>
            )}
          </div>
        </div>
        <div className="cpc-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Notificações
            </h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={clearNotifications}>Limpar</Button>
            </div>
          </div>
          {notif.length > 0 ? (
            <div className="space-y-3">
              {notif.map(n => (
                <div key={n.id} className="p-3 rounded-lg bg-muted/50 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{n.title}</p>
                    <p className="text-xs text-muted-foreground">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.date).toLocaleString()}</p>
                  </div>
                  {!n.read ? (
                    <Button variant="outline" size="sm" onClick={() => markNotification(n.id)}>Marcar como lida</Button>
                  ) : (
                    <span className="text-xs text-green-600">Lida</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Sem notificações</div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="cpc-card p-6">
          <h2 className="font-semibold mb-4">Situação Legal</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="legalStatus">Situação legal</Label>
              <Input id="legalStatus" value={triageDetail?.legal_status || ''} onChange={(e) => setTriageDetail({ ...(triageDetail || {}), legal_status: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="arrivalDate">Data de chegada</Label>
              <Input id="arrivalDate" type="date" value={arrivalDate} onChange={(e) => setArrivalDate(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div className="mt-3">
            <Label>Urgência legal/psicológica</Label>
            <div className="flex items-center gap-4 mt-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={(triageDetail?.urgencies || []).includes('legal')}
                  onCheckedChange={(checked) => {
                    const list = new Set(triageDetail?.urgencies || []);
                    if (checked) list.add('legal'); else list.delete('legal');
                    setTriageDetail({ ...(triageDetail || {}), urgencies: Array.from(list) });
                  }}
                />
                Legal
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={(triageDetail?.urgencies || []).includes('psychological')}
                  onCheckedChange={(checked) => {
                    const list = new Set(triageDetail?.urgencies || []);
                    if (checked) list.add('psychological'); else list.delete('psychological');
                    setTriageDetail({ ...(triageDetail || {}), urgencies: Array.from(list) });
                  }}
                />
                Psicológica
              </label>
            </div>
          </div>
          <div className="mt-4">
            <Button
              onClick={async () => {
                if (!user || !triageDetail) return;
                await supabase
                  .from('triage')
                  .update({ legal_status: triageDetail.legal_status || null, urgencies: triageDetail.urgencies || [] })
                  .eq('user_id', user.id);
                localStorage.setItem(
                  `profileExtras:${user.id}`,
                  JSON.stringify({ nationality, originCountry, arrivalDate, skills, languagesList, mainNeeds, professionalExperience, professionalTitle, contactPreference })
                );
              }}
            >Salvar situação legal</Button>
          </div>
        </div>

        <div className="cpc-card p-6">
          <h2 className="font-semibold mb-4">Situação Laboral</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="workStatus">Situação laboral</Label>
              <Input id="workStatus" value={triageDetail?.work_status || ''} onChange={(e) => setTriageDetail({ ...(triageDetail || {}), work_status: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="interests">Áreas de interesse</Label>
              <Input id="interests" value={(triageDetail?.interests || []).join(', ')} onChange={(e) => setTriageDetail({ ...(triageDetail || {}), interests: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} className="mt-1" />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="skills">Competências</Label>
              <Textarea id="skills" value={skills} onChange={(e) => setSkills(e.target.value)} className="mt-1" />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="languagesList">Idiomas</Label>
              <Input id="languagesList" value={languagesList} onChange={(e) => setLanguagesList(e.target.value)} className="mt-1" placeholder="Ex.: Português, Inglês" />
            </div>
          </div>
          <div className="mt-4">
            <Button
              onClick={async () => {
                if (!user || !triageDetail) return;
                await supabase
                  .from('triage')
                  .update({ work_status: triageDetail.work_status || null, interests: triageDetail.interests || [] })
                  .eq('user_id', user.id);
                localStorage.setItem(
                  `profileExtras:${user.id}`,
                  JSON.stringify({ nationality, originCountry, arrivalDate, skills, languagesList, mainNeeds, professionalExperience, professionalTitle, contactPreference })
                );
              }}
            >Salvar situação laboral</Button>
          </div>
        </div>

        <div className="cpc-card p-6">
          <h2 className="font-semibold mb-4">Triagem Rápida</h2>
          <div>
            <Label>Urgências</Label>
            <div className="flex flex-wrap gap-4 mt-2">
              {['legal', 'psychological', 'housing', 'food', 'health', 'documents', 'none'].map((u) => (
                <label key={u} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={(triageDetail?.urgencies || []).includes(u)}
                    onCheckedChange={(checked) => {
                      const list = new Set(triageDetail?.urgencies || []);
                      if (checked) list.add(u); else list.delete(u);
                      setTriageDetail({ ...(triageDetail || {}), urgencies: Array.from(list) });
                    }}
                  />
                  {u}
                </label>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <Label htmlFor="mainNeeds">Necessidades principais</Label>
            <Textarea id="mainNeeds" value={mainNeeds} onChange={(e) => setMainNeeds(e.target.value)} className="mt-1" />
          </div>
          <div className="mt-4">
            <Button
              onClick={async () => {
                if (!user || !triageDetail) return;
                await supabase
                  .from('triage')
                  .update({ urgencies: triageDetail.urgencies || [] })
                  .eq('user_id', user.id);
                localStorage.setItem(
                  `profileExtras:${user.id}`,
                  JSON.stringify({ nationality, originCountry, arrivalDate, skills, languagesList, mainNeeds, professionalExperience, professionalTitle, contactPreference })
                );
              }}
            >Salvar triagem</Button>
          </div>
        </div>

        <div className="cpc-card p-6">
          <h2 className="font-semibold mb-4">Perfil Profissional</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="professionalTitle">Título profissional</Label>
              <Input id="professionalTitle" value={professionalTitle} onChange={(e) => setProfessionalTitle(e.target.value)} className="mt-1" />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="professionalExperience">Experiência</Label>
              <Textarea id="professionalExperience" value={professionalExperience} onChange={(e) => setProfessionalExperience(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div className="mt-4">
            <Button
              onClick={() => {
                if (!user) return;
                localStorage.setItem(
                  `profileExtras:${user.id}`,
                  JSON.stringify({ nationality, originCountry, arrivalDate, skills, languagesList, mainNeeds, professionalExperience, professionalTitle, contactPreference })
                );
              }}
            >Salvar perfil profissional</Button>
          </div>
        </div>

        <div className="cpc-card p-6">
          <h2 className="font-semibold mb-4">Configurações Básicas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="language">Idioma</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as typeof language)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt">Português</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="contactPreference">Preferência de contato</Label>
              <Select value={contactPreference} onValueChange={(v) => setContactPreference(v as 'email' | 'phone')}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Telefone</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4">
            <Button
              onClick={() => {
                if (!user) return;
                localStorage.setItem(
                  `profileExtras:${user.id}`,
                  JSON.stringify({ nationality, originCountry, arrivalDate, skills, languagesList, mainNeeds, professionalExperience, professionalTitle, contactPreference })
                );
              }}
            >Salvar configurações</Button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="cpc-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Minhas Marcações
            </h2>
            <Link to="/dashboard/migrante/sessoes" className="text-sm text-primary hover:underline">
              Ver todas
            </Link>
          </div>

          {paginatedSessions.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Estado</label>
                    <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Ordenação</label>
                    <div className="mt-1 flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                        {sortOrder === 'asc' ? 'Data ↑' : 'Data ↓'}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Itens por página</label>
                    <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[5,10,20].map(n => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              {paginatedSessions.map((s) => (
                <div key={s.id} className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <Clock className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{s.session_type}</p>
                    <p className="text-sm text-muted-foreground">Status: {s.status || 'Agendada'}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-medium">{new Date(s.scheduled_date).toLocaleDateString()}</p>
                    <p className="text-muted-foreground">{s.scheduled_time}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-muted-foreground">Página {page} de {totalPages}</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Anterior</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Próxima</Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">Sem marcações futuras</p>
              <Button size="sm">Agendar Sessão</Button>
            </div>
          )}
        </div>

        <div className="cpc-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Trilhas Assistidas
            </h2>
            <Link to="/dashboard/migrante/trilhas" className="text-sm text-primary hover:underline">
              Ver todas
            </Link>
          </div>

          {inProgress.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Em Curso</h3>
              {inProgress.map((p) => {
                const t = trails[p.trail_id];
                const isCompleted = p.completed_at !== null;
                const percent = p.progress_percent || 0;
                const total = t?.modules_count || 0;
                const completed = p.modules_completed || 0;
                const last = getLastModule(p.trail_id);
                return (
                  <Link
                    key={`${p.trail_id}`}
                    to={`/dashboard/migrante/trilhas/${p.trail_id}`}
                    className="block p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-sm">{t?.title || p.trail_id}</p>
                      <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); toggleFavorite(p.trail_id); }}>
                        <Star className={favoriteTrails.has(p.trail_id) ? 'h-4 w-4 text-yellow-500 fill-yellow-500' : 'h-4 w-4'} />
                      </Button>
                      {isCompleted ? (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle className="h-4 w-4" /> Completa
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {completed}/{total} módulos
                        </span>
                      )}
                    </div>
                    <Progress value={percent} className="h-2" />
                    {last && (
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">Último módulo: {last.title}</span>
                        <Link to={`/dashboard/migrante/trilhas/${p.trail_id}/modulo/${last.module_id}`} className="text-xs text-primary hover:underline">Retomar</Link>
                      </div>
                    )}
                  </Link>
                );
              })}
              <h3 className="text-sm font-semibold mt-6">Favoritas</h3>
              {favoriteList.length > 0 ? (
                favoriteList.map((p) => {
                  const t = trails[p.trail_id];
                  const percent = p.progress_percent || 0;
                  const total = t?.modules_count || 0;
                  const completed = p.modules_completed || 0;
                  const last = getLastModule(p.trail_id);
                  return (
                    <Link
                      key={`fav-${p.trail_id}`}
                      to={`/dashboard/migrante/trilhas/${p.trail_id}`}
                      className="block p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-sm">{t?.title || p.trail_id}</p>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); toggleFavorite(p.trail_id); }}>
                          <Star className={favoriteTrails.has(p.trail_id) ? 'h-4 w-4 text-yellow-500 fill-yellow-500' : 'h-4 w-4'} />
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          {completed}/{total} módulos
                        </span>
                      </div>
                      <Progress value={percent} className="h-2" />
                      {last && (
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-muted-foreground">Último módulo: {last.title}</span>
                          <Link to={`/dashboard/migrante/trilhas/${p.trail_id}/modulo/${last.module_id}`} className="text-xs text-primary hover:underline">Retomar</Link>
                        </div>
                      )}
                    </Link>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">Sem trilhas favoritas</p>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Ainda não iniciou nenhuma trilha</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
