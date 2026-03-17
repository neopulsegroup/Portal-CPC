import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import MigrantsAdminPage from './MigrantsAdminPage';

const mockQueryDocuments = vi.fn();
const mockGetDocument = vi.fn();
const mockToast = vi.fn();

vi.mock('@/integrations/firebase/firestore', () => ({
  queryDocuments: (...args: unknown[]) => mockQueryDocuments(...args),
  getDocument: (...args: unknown[]) => mockGetDocument(...args),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ profile: { role: 'admin', email: 'admin@test.com', name: 'Admin' } }),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: {
      get: (path: string, params?: Record<string, string | number>) => {
        const dict: Record<string, string> = {
          'cpc.migrantsAdmin.title': 'Migrantes',
          'cpc.migrantsAdmin.subtitle': 'Lista completa com filtros e acesso ao perfil',
          'cpc.migrantsAdmin.export.button': 'Exportar Lista',
          'cpc.migrantsAdmin.export.formats.csv': 'CSV',
          'cpc.migrantsAdmin.export.formats.xlsx': 'XLSX',
          'cpc.migrantsAdmin.export.columns.name': 'Nome',
          'cpc.migrantsAdmin.export.columns.email': 'Email',
          'cpc.migrantsAdmin.export.columns.birth_date': 'Data de nascimento',
          'cpc.migrantsAdmin.export.columns.nationality': 'Nacionalidade',
          'cpc.migrantsAdmin.export.columns.legal_status': 'Status migratório',
          'cpc.migrantsAdmin.export.columns.arrival_date': 'Data de entrada',
          'cpc.migrantsAdmin.fallback_migrant': 'Migrante',
          'common.yes': 'Sim',
          'common.no': 'Não',
        };
        const template = dict[path] ?? path;
        if (!params) return template;
        return template.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`));
      },
    },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

function setupFirestoreMocks(users: Array<{ id: string; name: string; email: string }>, profiles: Record<string, unknown> = {}) {
  mockQueryDocuments.mockImplementation(async (collection: string) => {
    if (collection === 'users') {
      return users.map((u) => ({ ...u, role: 'migrant' }));
    }
    if (collection === 'sessions') return [];
    if (collection === 'user_trail_progress') return [];
    return [];
  });

  mockGetDocument.mockImplementation(async (collection: string, docId: string) => {
    if (collection === 'profiles') return (profiles[docId] as unknown) ?? { name: null, email: null };
    if (collection === 'triage') return { legal_status: 'regular', answers: {} };
    return null;
  });
}

describe('MigrantsAdminPage - exportação (Email)', () => {
  beforeEach(() => {
    mockQueryDocuments.mockReset();
    mockGetDocument.mockReset();
    mockToast.mockReset();
  });

  it('exporta CSV com header Email e emails normalizados', async () => {
    setupFirestoreMocks(
      [
        { id: 'u1', name: 'Pessoa 1', email: 'Pessoa1@Email.Com ' },
        { id: 'u2', name: 'Pessoa 2', email: 'invalido' },
      ],
      {
        u1: { name: 'Pessoa 1', email: 'Pessoa1@Email.Com ' },
        u2: { name: 'Pessoa 2', email: 'invalido' },
      }
    );

    const OriginalBlob = globalThis.Blob;
    class MockBlob {
      private readonly _text: string;
      readonly size: number;
      readonly type: string;
      constructor(parts: unknown[] = [], options?: { type?: string }) {
        this._text = parts.map((p) => String(p)).join('');
        this.size = this._text.length;
        this.type = options?.type ?? '';
      }
      text() {
        return Promise.resolve(this._text);
      }
    }
    (globalThis as unknown as { Blob: unknown }).Blob = MockBlob as unknown as typeof Blob;

    let capturedBlob: Blob | null = null;
    if (!('createObjectURL' in URL)) {
      (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () => 'blob:test';
    }
    if (!('revokeObjectURL' in URL)) {
      (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {};
    }
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob) => {
      capturedBlob = blob;
      return 'blob:test';
    });
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(
      <MemoryRouter>
        <MigrantsAdminPage />
      </MemoryRouter>
    );

    await screen.findByText('Migrantes');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Exportar Lista' }));
    await user.click(await screen.findByText('CSV'));

    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(capturedBlob).not.toBeNull();

    const csvText = await (capturedBlob as unknown as { text: () => Promise<string> }).text();
    expect(csvText).toContain('Nome,Email,Data de nascimento,Nacionalidade,Status migratório,Data de entrada');
    expect(csvText).toContain('Pessoa 1,pessoa1@email.com');
    expect(csvText).toContain('Pessoa 2,—');

    createObjectURLSpy.mockRestore();
    revokeSpy.mockRestore();
    clickSpy.mockRestore();
    (globalThis as unknown as { Blob: typeof Blob }).Blob = OriginalBlob;
  });

  it('exporta CSV usando email do perfil quando o user não tem email e trata email vazio como ausente', async () => {
    setupFirestoreMocks(
      [
        { id: 'u1', name: 'Pessoa 1', email: '' },
        { id: 'u2', name: 'Pessoa 2', email: '' },
      ],
      {
        u1: { name: 'Pessoa 1', email: '  TESTE@EXEMPLO.COM ' },
        u2: { name: 'Pessoa 2', email: '' },
      }
    );

    const OriginalBlob = globalThis.Blob;
    class MockBlob {
      private readonly _text: string;
      readonly size: number;
      readonly type: string;
      constructor(parts: unknown[] = [], options?: { type?: string }) {
        this._text = parts.map((p) => String(p)).join('');
        this.size = this._text.length;
        this.type = options?.type ?? '';
      }
      text() {
        return Promise.resolve(this._text);
      }
    }
    (globalThis as unknown as { Blob: unknown }).Blob = MockBlob as unknown as typeof Blob;

    let capturedBlob: Blob | null = null;
    if (!('createObjectURL' in URL)) {
      (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () => 'blob:test';
    }
    if (!('revokeObjectURL' in URL)) {
      (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {};
    }
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob) => {
      capturedBlob = blob;
      return 'blob:test';
    });
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(
      <MemoryRouter>
        <MigrantsAdminPage />
      </MemoryRouter>
    );

    await screen.findByText('Migrantes');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Exportar Lista' }));
    await user.click(await screen.findByText('CSV'));

    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(capturedBlob).not.toBeNull();

    const csvText = await (capturedBlob as unknown as { text: () => Promise<string> }).text();
    expect(csvText).toContain('Pessoa 1,teste@exemplo.com');
    expect(csvText).toContain('Pessoa 2,—');

    createObjectURLSpy.mockRestore();
    revokeSpy.mockRestore();
    clickSpy.mockRestore();
    (globalThis as unknown as { Blob: typeof Blob }).Blob = OriginalBlob;
  });
});
