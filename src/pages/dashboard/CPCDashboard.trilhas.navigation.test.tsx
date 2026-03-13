import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import CPCDashboard from './CPCDashboard';

const mockQueryDocuments = vi.fn();
const mockCountDocuments = vi.fn();
const mockGetDocument = vi.fn();
const mockUpdateDocument = vi.fn();

vi.mock('@/components/layout/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ profile: { name: 'Ana', role: 'admin' } }),
}));

vi.mock('@/integrations/firebase/auth', () => ({
  registerUser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/integrations/firebase/firestore', () => ({
  queryDocuments: (...args: unknown[]) => mockQueryDocuments(...args),
  countDocuments: (...args: unknown[]) => mockCountDocuments(...args),
  getDocument: (...args: unknown[]) => mockGetDocument(...args),
  updateDocument: (...args: unknown[]) => mockUpdateDocument(...args),
}));

describe('CPCDashboard - navegação (inclui Trilhas)', () => {
  beforeEach(() => {
    mockQueryDocuments.mockReset().mockResolvedValue([]);
    mockCountDocuments.mockReset().mockResolvedValue(0);
    mockGetDocument.mockReset().mockResolvedValue(null);
    mockUpdateDocument.mockReset().mockResolvedValue(undefined);
    localStorage.clear();
  });

  it('marca "Trilhas" como ativo e permite navegar para "Equipa"', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/cpc/trilhas']}>
        <Routes>
          <Route path="/dashboard/cpc/*" element={<CPCDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Gerir Trilhas Formativas')).toBeInTheDocument();
    const trilhasLink = screen.getByRole('link', { name: 'Trilhas' });
    expect(trilhasLink.className).toContain('bg-primary');

    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: 'Equipa' }));

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Equipa' }).className).toContain('bg-primary');
    });
    expect(screen.getByRole('link', { name: 'Trilhas' }).className).not.toContain('bg-primary');
  });

  it('mantém "Trilhas" como ativo ao abrir o editor /trilhas/:trailId', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/cpc/trilhas/t1']}>
        <Routes>
          <Route path="/dashboard/cpc/*" element={<CPCDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Trilha não encontrada')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Trilhas' }).className).toContain('bg-primary');
  });
});

