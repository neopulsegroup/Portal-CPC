import { queryDocuments } from '@/integrations/firebase/firestore';
import { createdAtToMs } from '@/lib/firestoreTimestamps';

export const JOB_OFFER_ACTIVE_STATUS = 'active' as const;

const ACTIVE_STATUS_FILTER = [{ field: 'status', operator: '==' as const, value: JOB_OFFER_ACTIVE_STATUS }];

/**
 * Todas as ofertas com `status === 'active'`, ordenadas por `created_at` descendente.
 * Query só por `status` (sem orderBy no servidor) para não excluir documentos sem `created_at`.
 */
export async function loadActiveJobOfferRows<T extends { id: string; created_at?: unknown }>(): Promise<T[]> {
  const docs = await queryDocuments<T>('job_offers', ACTIVE_STATUS_FILTER);
  return [...docs].sort((a, b) => createdAtToMs(b.created_at) - createdAtToMs(a.created_at));
}
