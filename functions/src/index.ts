import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

import { isAdminUser } from './permissions';
import { loadSmtpSettings } from './mailProcessor';
import { createTransport } from './smtp';
import { processMailDocument } from './mailProcessor';

export const onMailCreated = onDocumentCreated('mail/{mailId}', async (event) => {
  const mailId = event.params.mailId;
  await processMailDocument(mailId);
});

export const testSmtpConnection = onCall(async (request) => {
  const uid = request.auth?.uid ?? null;
  if (!uid) throw new HttpsError('unauthenticated', 'Sessão inválida.');
  const ok = await isAdminUser(uid);
  if (!ok) throw new HttpsError('permission-denied', 'Sem permissão.');

  try {
    const smtp = await loadSmtpSettings();
    const transport = createTransport(smtp);
    await transport.verify();
    return { ok: true };
  } catch (error: unknown) {
    if (error instanceof HttpsError) throw error;
    const raw = error instanceof Error ? error.message : 'Falha na ligação SMTP.';
    const message = raw.startsWith('SMTP ')
      ? 'Configuração SMTP incompleta. Guarde as definições SMTP antes de testar.'
      : raw;
    return { ok: false, message };
  }
});
