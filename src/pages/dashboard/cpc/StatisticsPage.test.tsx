import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import StatisticsPage from './StatisticsPage';

const mockQueryDocuments = vi.fn();
const mockGetDocument = vi.fn();

vi.mock('@/integrations/firebase/firestore', () => ({
  queryDocuments: (...args: unknown[]) => mockQueryDocuments(...args),
  getDocument: (...args: unknown[]) => mockGetDocument(...args),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'pt' }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: unknown }) => <div>{children as never}</div>,
  LineChart: ({ children }: { children: unknown }) => <div>{children as never}</div>,
  Line: () => null,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  BarChart: ({ children }: { children: unknown }) => <div>{children as never}</div>,
  Bar: () => null,
}));

describe('StatisticsPage (dashboard/cpc/estatisticas)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('usa a região do perfil (profiles.region) no Detalhamento Regional', async () => {
    const createdAt = new Date().toISOString();

    mockQueryDocuments.mockImplementation(async (collectionName: string) => {
      if (collectionName === 'users') {
        return [
          { id: 'u1', role: 'migrant', createdAt },
          { id: 'u2', role: 'migrant', createdAt },
        ];
      }
      if (collectionName === 'user_trail_progress') return [];
      return [];
    });

    mockGetDocument.mockImplementation(async (collectionName: string, docId: string) => {
      if (collectionName === 'profiles') {
        if (docId === 'u1') return { region: 'Norte', currentLocation: 'Lisboa' };
        if (docId === 'u2') return { currentLocation: 'Lisboa' };
      }
      return null;
    });

    render(<StatisticsPage />);

    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row');

    const norteRow = rows.find((r) => within(r).queryByText('Norte'));
    expect(norteRow).toBeTruthy();
    expect(within(norteRow as HTMLElement).getByText('1')).toBeInTheDocument();

    const lisboaRow = rows.find((r) => within(r).queryByText('Lisboa'));
    expect(lisboaRow).toBeTruthy();
    expect(within(lisboaRow as HTMLElement).getByText('1')).toBeInTheDocument();
  });
});
