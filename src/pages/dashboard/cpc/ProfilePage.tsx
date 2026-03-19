import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { updateUserProfile } from '@/integrations/firebase/auth';
import { getDocument, updateDocument } from '@/integrations/firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { storage } from '@/integrations/firebase/client';
import { getDownloadURL, ref as makeStorageRef, uploadBytes } from 'firebase/storage';
import { Camera, Loader2, Save, UserCog } from 'lucide-react';

type ProfileDoc = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  photoUrl?: string | null;
};

function normalizePhone(value: string): string {
  return value.replace(/[^\d+]/g, '');
}

function isValidPhone(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  const normalized = normalizePhone(trimmed);
  if (normalized.startsWith('+')) return normalized.length >= 8 && normalized.length <= 16;
  return normalized.length >= 7 && normalized.length <= 15;
}

export default function CPCProfilePage() {
  const { user, profile, profileData, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
  const PHOTO_ALLOWED_MIME = useMemo(() => new Set(['image/jpeg', 'image/png', 'image/gif']), []);

  const [doc, setDoc] = useState<ProfileDoc | null>(null);
  const [edit, setEdit] = useState<{ name: string; phone: string }>({ name: '', phone: '' });

  const displayEmail = profile?.email || user?.email || '';
  const displayRole = profile?.role ? String(profile.role).toUpperCase() : '—';

  const avatarFallback = useMemo(() => {
    const name = edit.name || profile?.name || '';
    const parts = name.trim().split(/\s+/g).filter(Boolean);
    const letters = parts.slice(0, 2).map((p) => p.slice(0, 1).toUpperCase()).join('');
    return letters || 'U';
  }, [edit.name, profile?.name]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user?.uid) return;
      setLoading(true);
      setError(null);
      try {
        const res = await getDocument<ProfileDoc>('profiles', user.uid);
        if (cancelled) return;
        const merged = res ?? ({ id: user.uid } as ProfileDoc);
        setDoc(merged);
        setEdit({
          name: profile?.name || merged.name || '',
          phone: merged.phone || profileData?.phone || '',
        });
        setEditMode(false);
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : '';
        if (msg === 'permission-denied' || msg === 'PERMISSION_DENIED') {
          setError('Sem permissões para carregar o seu perfil.');
        } else {
          setError('Não foi possível carregar o seu perfil.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [profile?.name, profileData?.phone, user?.uid]);

  async function handlePhotoPick(file: File) {
    if (!user?.uid) return;
    if (!PHOTO_ALLOWED_MIME.has(file.type)) {
      toast({ title: 'Formato inválido', description: 'Use JPG, PNG ou GIF.', variant: 'destructive' });
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      toast({ title: 'Ficheiro demasiado grande', description: 'O limite é 5MB.', variant: 'destructive' });
      return;
    }

    setUploadingPhoto(true);
    try {
      const path = `profile_photos/${user.uid}`;
      const ref = makeStorageRef(storage, path);
      await uploadBytes(ref, file, { contentType: file.type });
      const url = await getDownloadURL(ref);
      await updateDocument('profiles', user.uid, { photoUrl: url });
      await refreshProfile();
      setDoc((prev) => (prev ? { ...prev, photoUrl: url } : ({ id: user.uid, photoUrl: url } as ProfileDoc)));
      toast({ title: 'Foto atualizada', description: 'A sua foto de perfil foi atualizada.' });
    } catch (err: unknown) {
      toast({ title: 'Erro', description: 'Não foi possível atualizar a foto.', variant: 'destructive' });
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function save() {
    if (!user?.uid) return;
    const name = edit.name.trim();
    const phone = edit.phone.trim();

    if (!name) {
      toast({ title: 'Validação', description: 'O nome é obrigatório.', variant: 'destructive' });
      return;
    }
    if (!isValidPhone(phone)) {
      toast({ title: 'Validação', description: 'O telefone não é válido.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      await updateUserProfile(user.uid, { name });
      await updateDocument('profiles', user.uid, { name, phone: phone || null });
      await refreshProfile();
      setEditMode(false);
      toast({ title: 'Perfil atualizado', description: 'As alterações foram guardadas com sucesso.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'permission-denied' || msg === 'PERMISSION_DENIED') {
        toast({ title: 'Sem permissões', description: 'Não foi possível guardar as alterações.', variant: 'destructive' });
        return;
      }
      toast({ title: 'Erro', description: 'Não foi possível guardar as alterações.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setEdit({
      name: profile?.name || doc?.name || '',
      phone: doc?.phone || profileData?.phone || '',
    });
    setEditMode(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="cpc-card p-8 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Perfil</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie os dados da sua conta e preferências de contacto.</p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {editMode ? (
            <>
              <Button variant="outline" onClick={cancel} disabled={saving || uploadingPhoto}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={saving || uploadingPhoto}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Guardar
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setEditMode(true)}>
              <UserCog className="h-4 w-4 mr-2" />
              Editar
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="cpc-card p-6">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground">FOTO</p>
          <div className="mt-6 flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarImage src={doc?.photoUrl || profileData?.photoUrl || undefined} alt={edit.name || 'Utilizador'} />
                <AvatarFallback>{avatarFallback}</AvatarFallback>
              </Avatar>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handlePhotoPick(f);
                  e.currentTarget.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute -bottom-2 -right-2 h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow hover:opacity-95 disabled:opacity-60"
                aria-label="Alterar foto"
              >
                {uploadingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </button>
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate">{profile?.name || edit.name || 'Utilizador'}</p>
              <p className="text-sm text-muted-foreground truncate">{displayEmail}</p>
              <p className="text-xs font-semibold tracking-widest text-muted-foreground mt-2">{displayRole}</p>
            </div>
          </div>
        </div>

        <div className="cpc-card p-6">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground">INFORMAÇÕES</p>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="cpc-profile-name">Nome</Label>
              <Input
                id="cpc-profile-name"
                value={edit.name}
                onChange={(e) => setEdit((p) => ({ ...p, name: e.target.value }))}
                disabled={!editMode}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpc-profile-email">Email</Label>
              <Input id="cpc-profile-email" value={displayEmail} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpc-profile-role">Função</Label>
              <Input id="cpc-profile-role" value={displayRole} disabled />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="cpc-profile-phone">Telefone</Label>
              <Input
                id="cpc-profile-phone"
                value={edit.phone}
                onChange={(e) => setEdit((p) => ({ ...p, phone: e.target.value }))}
                disabled={!editMode}
                placeholder="Ex.: +351 910 000 000"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
