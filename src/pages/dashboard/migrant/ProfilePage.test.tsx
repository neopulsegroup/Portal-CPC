import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import ProfilePage from './ProfilePage';

const mockFetchMigrantProfile = vi.fn();
const mockUpdateDocument = vi.fn();
const mockUpdateUserProfile = vi.fn();
const mockRefreshProfile = vi.fn();
const mockToast = vi.fn();
const stableUser = { uid: 'u1' };

vi.mock('@/api/migrantProfile', () => ({
  fetchMigrantProfile: (...args: unknown[]) => mockFetchMigrantProfile(...args),
}));

vi.mock('@/integrations/firebase/firestore', () => ({
  updateDocument: (...args: unknown[]) => mockUpdateDocument(...args),
}));

vi.mock('@/integrations/firebase/auth', () => ({
  updateUserProfile: (...args: unknown[]) => mockUpdateUserProfile(...args),
}));

vi.mock('@/integrations/firebase/client', () => ({
  storage: {},
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: (...args: unknown[]) => mockToast(...args) }),
}));

const mockStorageRef = vi.fn();
const mockUploadBytes = vi.fn();
const mockGetDownloadURL = vi.fn();

vi.mock('firebase/storage', () => ({
  ref: (...args: unknown[]) => mockStorageRef(...args),
  uploadBytes: (...args: unknown[]) => mockUploadBytes(...args),
  getDownloadURL: (...args: unknown[]) => mockGetDownloadURL(...args),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: stableUser, refreshProfile: mockRefreshProfile }),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'pt', setLanguage: vi.fn(), t: { get: (path: string) => path } }),
}));

describe('ProfilePage (dashboard/migrante)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stableUser.uid = 'u1';
  });

  it('mostra loading e depois renderiza dados vindos da base de dados', async () => {
    localStorage.clear();
    mockFetchMigrantProfile.mockResolvedValueOnce({
      userProfile: { email: 'ana@exemplo.com', name: 'Ana', role: 'migrant', createdAt: null, updatedAt: null },
      profile: { id: 'u1', name: 'Ana', email: 'ana@exemplo.com', phone: '+351900000000', birthDate: '1990-02-03', nationality: 'Brasil' },
      triage: { id: 'u1', userId: 'u1', legal_status: 'regularized', work_status: 'employed', language_level: 'basic', urgencies: ['legal'], interests: ['it'], answers: { phone: '+351900000000', birth_date: '1990-02-03', nationality: 'Brasil' } },
      sessions: [{ id: 's1', migrant_id: 'u1', session_type: 'mediador', scheduled_date: '2026-01-01', scheduled_time: '10:00', status: 'pending' }],
      progress: [{ id: 'p1', user_id: 'u1', trail_id: 't1', progress_percent: 50, modules_completed: 1, completed_at: null }],
      trails: { t1: { id: 't1', title: 'Trilha 1', modules_count: 3 } },
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    expect(document.querySelector('.animate-spin')).not.toBeNull();

    expect(await screen.findByText('Informação Pessoal')).toBeInTheDocument();
    expect(screen.getByText('Editar Perfil')).toBeInTheDocument();
    expect(screen.queryByLabelText('Telefone')).toBeNull();
    expect(screen.queryByLabelText('Data de nascimento')).toBeNull();
    expect(screen.queryByLabelText('Nacionalidade')).toBeNull();
    expect(screen.getByText('+351 900 000 000')).toBeInTheDocument();
    expect(screen.getByText('03/02/1990')).toBeInTheDocument();
    expect(screen.getAllByText('Brasil').length).toBeGreaterThan(0);
    expect(screen.getByText('Status Migratório & Integração')).toBeInTheDocument();
    expect(screen.getByText('Marcações')).toBeInTheDocument();
    expect(screen.getByText('Trilhas de Sucesso')).toBeInTheDocument();
  });

  it('mostra estado de não encontrado quando o perfil não existe', async () => {
    localStorage.clear();
    mockFetchMigrantProfile.mockResolvedValueOnce({
      userProfile: { email: 'ana@exemplo.com', name: 'Ana', role: 'migrant', createdAt: null, updatedAt: null },
      profile: null,
      triage: null,
      sessions: [],
      progress: [],
      trails: {},
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );
    expect(await screen.findByText('Perfil não encontrado.')).toBeInTheDocument();
  });

  it('mantém campos vazios quando não há dados', async () => {
    localStorage.clear();
    mockFetchMigrantProfile.mockResolvedValueOnce({
      userProfile: { email: 'ana@exemplo.com', name: 'Ana', role: 'migrant', createdAt: null, updatedAt: null },
      profile: { id: 'u1', name: 'Ana', email: 'ana@exemplo.com', phone: null, birthDate: null, nationality: null },
      triage: null,
      sessions: [],
      progress: [],
      trails: {},
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    await screen.findByText('Informação Pessoal');
    expect(screen.queryByLabelText('Telefone')).toBeNull();
    expect(screen.queryByLabelText('Data de nascimento')).toBeNull();
    expect(screen.queryByLabelText('Nacionalidade')).toBeNull();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('mostra erro quando a API falha', async () => {
    localStorage.clear();
    mockFetchMigrantProfile.mockRejectedValueOnce(new Error('boom'));
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );
    expect(await screen.findByText('Não foi possível carregar os dados do perfil.')).toBeInTheDocument();
  });

  it('guarda alterações no Firestore', async () => {
    localStorage.clear();
    const user = userEvent.setup();
    mockFetchMigrantProfile.mockResolvedValueOnce({
      userProfile: { email: 'ana@exemplo.com', name: 'Ana', role: 'migrant', createdAt: null, updatedAt: null },
      profile: { id: 'u1', name: 'Ana', email: 'ana@exemplo.com', phone: null },
      triage: null,
      sessions: [],
      progress: [],
      trails: {},
    });

    mockUpdateDocument.mockResolvedValueOnce(undefined);
    mockUpdateUserProfile.mockResolvedValueOnce(undefined);
    mockRefreshProfile.mockResolvedValueOnce(undefined);
    mockFetchMigrantProfile.mockResolvedValueOnce({
      userProfile: { email: 'ana@exemplo.com', name: 'Ana Maria', role: 'migrant', createdAt: null, updatedAt: null },
      profile: { id: 'u1', name: 'Ana Maria', email: 'ana@exemplo.com', phone: null },
      triage: null,
      sessions: [],
      progress: [],
      trails: {},
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );
    await screen.findByText('Informação Pessoal');

    await user.click(screen.getByRole('button', { name: 'Editar Perfil' }));
    await user.clear(screen.getByLabelText('Nome'));
    await user.type(screen.getByLabelText('Nome'), 'Ana Maria');
    await user.click(screen.getByRole('button', { name: 'Guardar alterações' }));

    await waitFor(() => {
      expect(mockUpdateDocument).toHaveBeenCalledWith('profiles', 'u1', expect.objectContaining({ name: 'Ana Maria' }));
      expect(mockUpdateUserProfile).toHaveBeenCalledWith('u1', expect.objectContaining({ name: 'Ana Maria' }));
    });
  });

  it('usa o migrantId da rota CPC e não tenta atualizar o perfil Auth do utilizador atual', async () => {
    localStorage.clear();
    const user = userEvent.setup();
    stableUser.uid = 'cpc1';

    mockFetchMigrantProfile.mockResolvedValueOnce({
      userProfile: { email: 'm1@exemplo.com', name: 'Migrante 1', role: 'migrant', createdAt: null, updatedAt: null },
      profile: { id: 'm1', name: 'Migrante 1', email: 'm1@exemplo.com', phone: null },
      triage: null,
      sessions: [],
      progress: [],
      trails: {},
    });

    mockUpdateDocument.mockResolvedValueOnce(undefined);
    mockFetchMigrantProfile.mockResolvedValueOnce({
      userProfile: { email: 'm1@exemplo.com', name: 'Migrante 1', role: 'migrant', createdAt: null, updatedAt: null },
      profile: { id: 'm1', name: 'Migrante 1 Atualizado', email: 'm1@exemplo.com', phone: null },
      triage: null,
      sessions: [],
      progress: [],
      trails: {},
    });

    render(
      <MemoryRouter initialEntries={['/dashboard/cpc/migrantes/m1/perfil']}>
        <Routes>
          <Route path="/dashboard/cpc/migrantes/:migrantId/perfil" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Informação Pessoal');
    expect(mockFetchMigrantProfile).toHaveBeenCalledWith('m1');

    await user.click(screen.getByRole('button', { name: 'Editar Perfil' }));
    await user.clear(screen.getByLabelText('Nome'));
    await user.type(screen.getByLabelText('Nome'), 'Migrante 1 Atualizado');
    await user.click(screen.getByRole('button', { name: 'Guardar alterações' }));

    await waitFor(() => {
      expect(mockUpdateDocument).toHaveBeenCalledWith('profiles', 'm1', expect.objectContaining({ name: 'Migrante 1 Atualizado' }));
      expect(mockUpdateUserProfile).not.toHaveBeenCalled();
      expect(mockRefreshProfile).not.toHaveBeenCalled();
    });
  });

  it('permite upload de foto e grava photoUrl no perfil', async () => {
    localStorage.clear();
    const user = userEvent.setup();

    mockStorageRef.mockReturnValueOnce({ key: 'ref1' });
    mockUploadBytes.mockResolvedValueOnce(undefined);
    mockGetDownloadURL.mockResolvedValueOnce('https://exemplo.com/foto.png');

    mockFetchMigrantProfile.mockResolvedValueOnce({
      userProfile: { email: 'ana@exemplo.com', name: 'Ana', role: 'migrant', createdAt: null, updatedAt: null },
      profile: { id: 'u1', name: 'Ana', email: 'ana@exemplo.com', phone: null, photoUrl: null },
      triage: null,
      sessions: [],
      progress: [],
      trails: {},
    });

    mockUpdateDocument.mockResolvedValueOnce(undefined);
    mockRefreshProfile.mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );
    await screen.findByText('Informação Pessoal');

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();

    const file = new File(['abc'], 'foto.png', { type: 'image/png' });
    await user.upload(fileInput as HTMLInputElement, file);

    await waitFor(() => {
      expect(mockUploadBytes).toHaveBeenCalled();
      expect(mockGetDownloadURL).toHaveBeenCalled();
      expect(mockUpdateDocument).toHaveBeenCalledWith('profiles', 'u1', expect.objectContaining({ photoUrl: 'https://exemplo.com/foto.png' }));
    });
  });

  it('rejeita ficheiros com formato inválido', async () => {
    localStorage.clear();

    mockFetchMigrantProfile.mockResolvedValueOnce({
      userProfile: { email: 'ana@exemplo.com', name: 'Ana', role: 'migrant', createdAt: null, updatedAt: null },
      profile: { id: 'u1', name: 'Ana', email: 'ana@exemplo.com', phone: null, photoUrl: null },
      triage: null,
      sessions: [],
      progress: [],
      trails: {},
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );
    await screen.findByText('Informação Pessoal');

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();

    const file = new File(['abc'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } });

    expect(mockUploadBytes).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Formato não suportado', variant: 'destructive' }));
  });

  it('rejeita ficheiros maiores que 5MB', async () => {
    localStorage.clear();
    const user = userEvent.setup();

    mockFetchMigrantProfile.mockResolvedValueOnce({
      userProfile: { email: 'ana@exemplo.com', name: 'Ana', role: 'migrant', createdAt: null, updatedAt: null },
      profile: { id: 'u1', name: 'Ana', email: 'ana@exemplo.com', phone: null, photoUrl: null },
      triage: null,
      sessions: [],
      progress: [],
      trails: {},
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );
    await screen.findByText('Informação Pessoal');

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();

    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    const file = new File([big], 'foto.png', { type: 'image/png' });
    await user.upload(fileInput as HTMLInputElement, file);

    expect(mockUploadBytes).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Imagem muito grande', variant: 'destructive' }));
  });

  it('mostra loading state durante o upload', async () => {
    localStorage.clear();
    const user = userEvent.setup();

    mockStorageRef.mockReturnValueOnce({ key: 'ref1' });
    let resolveUpload: (() => void) | null = null;
    mockUploadBytes.mockImplementationOnce(() => new Promise<void>((res) => { resolveUpload = res; }));
    mockGetDownloadURL.mockResolvedValueOnce('https://exemplo.com/foto.png');
    mockUpdateDocument.mockResolvedValueOnce(undefined);
    mockRefreshProfile.mockResolvedValueOnce(undefined);

    mockFetchMigrantProfile.mockResolvedValueOnce({
      userProfile: { email: 'ana@exemplo.com', name: 'Ana', role: 'migrant', createdAt: null, updatedAt: null },
      profile: { id: 'u1', name: 'Ana', email: 'ana@exemplo.com', phone: null, photoUrl: null },
      triage: null,
      sessions: [],
      progress: [],
      trails: {},
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );
    await screen.findByText('Informação Pessoal');

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    const file = new File(['abc'], 'foto.png', { type: 'image/png' });
    await user.upload(fileInput as HTMLInputElement, file);

    expect(await screen.findByText('A enviar…')).toBeInTheDocument();
    resolveUpload?.();

    await waitFor(() => {
      expect(screen.queryByText('A enviar…')).toBeNull();
      expect(mockUpdateDocument).toHaveBeenCalledWith('profiles', 'u1', expect.objectContaining({ photoUrl: 'https://exemplo.com/foto.png' }));
    });
  });

  it('mostra erro específico quando o upload falha por permissão', async () => {
    localStorage.clear();
    const user = userEvent.setup();

    mockStorageRef.mockReturnValueOnce({ key: 'ref1' });
    mockUploadBytes.mockRejectedValueOnce({ code: 'storage/unauthorized' });

    mockFetchMigrantProfile.mockResolvedValueOnce({
      userProfile: { email: 'ana@exemplo.com', name: 'Ana', role: 'migrant', createdAt: null, updatedAt: null },
      profile: { id: 'u1', name: 'Ana', email: 'ana@exemplo.com', phone: null, photoUrl: null },
      triage: null,
      sessions: [],
      progress: [],
      trails: {},
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );
    await screen.findByText('Informação Pessoal');

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    const file = new File(['abc'], 'foto.png', { type: 'image/png' });
    await user.upload(fileInput as HTMLInputElement, file);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Sem permissão', variant: 'destructive' }));
      expect(mockUpdateDocument).not.toHaveBeenCalled();
    });
  });

  it('mostra erro específico quando guardar photoUrl falha por permissão', async () => {
    localStorage.clear();
    const user = userEvent.setup();

    mockStorageRef.mockReturnValueOnce({ key: 'ref1' });
    mockUploadBytes.mockResolvedValueOnce(undefined);
    mockGetDownloadURL.mockResolvedValueOnce('https://exemplo.com/foto.png');
    mockUpdateDocument.mockRejectedValueOnce({ code: 'permission-denied' });

    mockFetchMigrantProfile.mockResolvedValueOnce({
      userProfile: { email: 'ana@exemplo.com', name: 'Ana', role: 'migrant', createdAt: null, updatedAt: null },
      profile: { id: 'u1', name: 'Ana', email: 'ana@exemplo.com', phone: null, photoUrl: null },
      triage: null,
      sessions: [],
      progress: [],
      trails: {},
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );
    await screen.findByText('Informação Pessoal');

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    const file = new File(['abc'], 'foto.png', { type: 'image/png' });
    await user.upload(fileInput as HTMLInputElement, file);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Sem permissão', variant: 'destructive' }));
    });
  });
});
