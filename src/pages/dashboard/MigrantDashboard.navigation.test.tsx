import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import MigrantDashboard from './MigrantDashboard';

let authState: { profile?: { name?: string; role?: string } } = { profile: { name: 'Ana', role: 'migrant' } };

vi.mock('@/components/layout/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'pt',
    t: { dashboard: { book_session_action: '', start_trail_action: '', complete_cv_action: '', submit: '', description: '' }, get: (k: string) => k },
  }),
}));

vi.mock('@/integrations/firebase/firestore', () => ({
  addDocument: vi.fn(),
  getDocument: vi.fn(),
  queryDocuments: vi.fn().mockResolvedValue([]),
}));

vi.mock('./migrant/TrailsPage', () => ({ default: () => <div>Trails</div> }));
vi.mock('./migrant/TrailDetailPage', () => ({ default: () => <div>TrailDetail</div> }));
vi.mock('./migrant/ModuleViewerPage', () => ({ default: () => <div>ModuleViewer</div> }));
vi.mock('./migrant/JobsPage', () => ({ default: () => <div>Jobs</div> }));
vi.mock('./migrant/JobDetailPage', () => ({ default: () => <div>JobDetail</div> }));
vi.mock('./migrant/ProfilePage', () => ({ default: () => <div>Profile</div> }));
vi.mock('./migrant/SessionsPage', () => ({ default: () => <div>Sessions</div> }));
vi.mock('./migrant/MessagesPage', () => ({ default: () => <div>Messages</div> }));

describe('MigrantDashboard - navegação', () => {
  beforeEach(() => {
    authState = { profile: { name: 'Ana', role: 'migrant' } };
  });

  it('mostra "Perfil" e "Mensagens" para utilizadores migrantes (mesmo padrão visual de secções)', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/migrante/perfil']}>
        <Routes>
          <Route path="/dashboard/migrante/*" element={<MigrantDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Definições')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Perfil' })).toBeInTheDocument();
    expect(screen.getByText('Mensagens', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mensagens' })).toBeInTheDocument();
  });

  it('não mostra item "Mensagens" para utilizadores não migrantes', async () => {
    authState = { profile: { name: 'Empresa', role: 'company' } };

    render(
      <MemoryRouter initialEntries={['/dashboard/migrante/perfil']}>
        <Routes>
          <Route path="/dashboard/migrante/*" element={<MigrantDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByRole('link', { name: 'Mensagens' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Perfil' })).not.toBeInTheDocument();
  });

  it('regressão visual (estrutura + active/hover): classNames do menu em /mensagens', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/migrante/mensagens']}>
        <Routes>
          <Route path="/dashboard/migrante/*" element={<MigrantDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    const nav = screen.getByRole('navigation');
    const links = Array.from(nav.querySelectorAll('a')).map((a) => ({ label: a.textContent?.trim() ?? '', className: a.className }));

    expect(links).toMatchInlineSnapshot(`
      [
        {
          "className": "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted",
          "label": "Visão geral",
        },
        {
          "className": "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted",
          "label": "Sessões",
        },
        {
          "className": "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted",
          "label": "Emprego",
        },
        {
          "className": "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted",
          "label": "Trilhas",
        },
        {
          "className": "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted",
          "label": "Perfil",
        },
        {
          "className": "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors bg-primary text-primary-foreground",
          "label": "Mensagens",
        },
      ]
    `);
  });
});
