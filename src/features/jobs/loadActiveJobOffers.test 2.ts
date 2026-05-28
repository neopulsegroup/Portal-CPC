import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JOB_OFFER_ACTIVE_STATUS, loadActiveJobOfferRows } from './loadActiveJobOffers';

const queryDocuments = vi.fn();

vi.mock('@/integrations/firebase/firestore', () => ({
  queryDocuments: (...args: unknown[]) => queryDocuments(...args),
}));

describe('loadActiveJobOfferRows', () => {
  beforeEach(() => {
    queryDocuments.mockReset();
  });

  it('consulta apenas job_offers com status active', async () => {
    queryDocuments.mockResolvedValue([]);
    await loadActiveJobOfferRows();
    expect(queryDocuments).toHaveBeenCalledWith(
      'job_offers',
      [{ field: 'status', operator: '==', value: JOB_OFFER_ACTIVE_STATUS }],
    );
  });

  it('devolve todas as ofertas ativas ordenadas por created_at desc', async () => {
    queryDocuments.mockResolvedValue([
      { id: 'old', created_at: '2024-01-01T00:00:00.000Z' },
      { id: 'new', created_at: '2025-06-01T00:00:00.000Z' },
      { id: 'no-date' },
    ]);
    const rows = await loadActiveJobOfferRows<{ id: string; created_at?: string }>();
    expect(rows.map((r) => r.id)).toEqual(['new', 'old', 'no-date']);
  });
});
