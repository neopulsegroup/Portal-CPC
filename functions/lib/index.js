"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testSmtpConnection = exports.onMailCreated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const permissions_1 = require("./permissions");
const mailProcessor_1 = require("./mailProcessor");
const smtp_1 = require("./smtp");
const mailProcessor_2 = require("./mailProcessor");
exports.onMailCreated = (0, firestore_1.onDocumentCreated)('mail/{mailId}', async (event) => {
    const mailId = event.params.mailId;
    await (0, mailProcessor_2.processMailDocument)(mailId);
});
exports.testSmtpConnection = (0, https_1.onCall)(async (request) => {
    const uid = request.auth?.uid ?? null;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Sessão inválida.');
    const ok = await (0, permissions_1.isAdminUser)(uid);
    if (!ok)
        throw new https_1.HttpsError('permission-denied', 'Sem permissão.');
    try {
        const smtp = await (0, mailProcessor_1.loadSmtpSettings)();
        const transport = (0, smtp_1.createTransport)(smtp);
        await transport.verify();
        return { ok: true };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        const raw = error instanceof Error ? error.message : 'Falha na ligação SMTP.';
        const message = raw.startsWith('SMTP ')
            ? 'Configuração SMTP incompleta. Guarde as definições SMTP antes de testar.'
            : raw;
        return { ok: false, message };
    }
});
