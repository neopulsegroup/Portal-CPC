"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadCvSecure = void 0;
const node_crypto_1 = require("node:crypto");
const https_1 = require("firebase-functions/v2/https");
const firebase_functions_1 = require("firebase-functions");
const admin_1 = require("./admin");
const CV_CORS_ORIGINS = [
    'https://www.portalcpc.com',
    'https://portalcpc.com',
    'https://cpc-projeto-app.web.app',
    'https://cpc-projeto-app.firebaseapp.com',
    'https://saas-cpc.vercel.app',
    /^https:\/\/[\w-]+\.portalcpc\.com$/,
    /^https:\/\/[\w-]+\.vercel\.app$/,
    'http://localhost:5173',
    'http://localhost:8080',
    'http://localhost:8090',
    'http://localhost:4173',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:8090',
];
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
function normalize(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function sanitizeFileName(name) {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}
function inferMimeType(fileName, mimeType) {
    if (mimeType && ALLOWED_TYPES.has(mimeType))
        return mimeType;
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.pdf'))
        return 'application/pdf';
    if (lower.endsWith('.doc'))
        return 'application/msword';
    if (lower.endsWith('.docx')) {
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
    return '';
}
function inferCvFileExtension(fileName) {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.pdf'))
        return '.pdf';
    if (lower.endsWith('.docx'))
        return '.docx';
    if (lower.endsWith('.doc'))
        return '.doc';
    return '.pdf';
}
function buildMigrantCvStoragePath(uploaderUid, fileName) {
    return `cv_uploads/migrant/${uploaderUid}/curriculo${inferCvFileExtension(fileName)}`;
}
function buildProfileExternalCvStoragePath(uploaderUid, fileName) {
    return `cv_uploads/profile/${uploaderUid}/external_curriculo${inferCvFileExtension(fileName)}`;
}
function parseStoragePathFromDownloadUrl(url) {
    try {
        const parsed = new URL(url);
        const encoded = parsed.pathname.split('/o/')[1];
        if (!encoded)
            return null;
        return decodeURIComponent(encoded.split('?')[0] ?? encoded);
    }
    catch {
        return null;
    }
}
function formatUnknownError(err) {
    if (err instanceof Error)
        return err.message;
    return String(err);
}
async function deleteStoragePathIfExists(bucketName, storagePath) {
    try {
        await (0, admin_1.getStorageBucket)(bucketName).file(storagePath).delete({ ignoreNotFound: true });
    }
    catch (err) {
        firebase_functions_1.logger.warn('uploadCvSecure_delete_path_failed', {
            bucketName,
            storagePath,
            error: formatUnknownError(err),
        });
    }
}
async function deleteMigrantCvFilesServer(uploaderUid, previousUrl) {
    const paths = new Set(['.pdf', '.doc', '.docx'].map((ext) => buildMigrantCvStoragePath(uploaderUid, `x${ext}`)));
    if (previousUrl) {
        const parsed = parseStoragePathFromDownloadUrl(previousUrl);
        if (parsed)
            paths.add(parsed);
    }
    for (const bucketName of [admin_1.FIREBASE_STORAGE_BUCKET, admin_1.LEGACY_STORAGE_BUCKET]) {
        await Promise.all(Array.from(paths).map((path) => deleteStoragePathIfExists(bucketName, path)));
    }
}
async function deleteProfileExternalCvFilesServer(uploaderUid, previousUrl) {
    const paths = new Set(['.pdf', '.doc', '.docx'].map((ext) => buildProfileExternalCvStoragePath(uploaderUid, `x${ext}`)));
    if (previousUrl) {
        const parsed = parseStoragePathFromDownloadUrl(previousUrl);
        if (parsed)
            paths.add(parsed);
    }
    for (const bucketName of [admin_1.FIREBASE_STORAGE_BUCKET, admin_1.LEGACY_STORAGE_BUCKET]) {
        await Promise.all(Array.from(paths).map((path) => deleteStoragePathIfExists(bucketName, path)));
    }
}
async function assertCanUploadCv(_uid, _contextType, _contextId) {
    throw new https_1.HttpsError('failed-precondition', 'O carregamento de currículo externo foi desativado. Use o currículo CPC do candidato.');
}
function buildDownloadUrl(bucketName, storagePath, token) {
    return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
}
async function saveCvToStorage(storagePath, buffer, mimeType) {
    const bucketCandidates = [admin_1.FIREBASE_STORAGE_BUCKET, admin_1.LEGACY_STORAGE_BUCKET];
    let lastError = null;
    for (const bucketName of bucketCandidates) {
        try {
            const file = (0, admin_1.getStorageBucket)(bucketName).file(storagePath);
            await file.save(buffer, {
                resumable: false,
                validation: false,
                contentType: mimeType,
                metadata: {
                    contentType: mimeType,
                },
            });
            return { bucketName, file };
        }
        catch (err) {
            lastError = err;
            firebase_functions_1.logger.warn('uploadCvSecure_bucket_try_failed', {
                bucketName,
                storagePath,
                error: formatUnknownError(err),
            });
        }
    }
    throw lastError instanceof Error ? lastError : new Error(formatUnknownError(lastError));
}
async function resolveDownloadUrl(bucketName, file, storagePath) {
    const downloadToken = (0, node_crypto_1.randomUUID)();
    try {
        await file.setMetadata({
            metadata: {
                firebaseStorageDownloadTokens: downloadToken,
            },
        });
        return buildDownloadUrl(bucketName, storagePath, downloadToken);
    }
    catch (tokenErr) {
        firebase_functions_1.logger.warn('uploadCvSecure_token_metadata_failed', {
            bucketName,
            storagePath,
            error: formatUnknownError(tokenErr),
        });
    }
    try {
        const [signedUrl] = await file.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
        });
        return signedUrl;
    }
    catch (signedErr) {
        firebase_functions_1.logger.error('uploadCvSecure_signed_url_failed', {
            bucketName,
            storagePath,
            error: formatUnknownError(signedErr),
        });
        throw signedErr;
    }
}
exports.uploadCvSecure = (0, https_1.onCall)({
    region: 'us-central1',
    invoker: 'public',
    cors: CV_CORS_ORIGINS,
    memory: '512MiB',
    timeoutSeconds: 60,
}, async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Sessão inválida.');
    try {
        const payload = (request.data || {});
        const fileName = normalize(payload.fileName);
        const contextId = normalize(payload.contextId);
        const contextType = normalize(payload.contextType);
        const mimeType = inferMimeType(fileName, normalize(payload.mimeType));
        const fileBase64 = typeof payload.fileBase64 === 'string' ? payload.fileBase64 : '';
        if (!fileName || !contextId || !contextType || !fileBase64) {
            throw new https_1.HttpsError('invalid-argument', 'Dados de upload incompletos.');
        }
        if (!mimeType || !ALLOWED_TYPES.has(mimeType)) {
            throw new https_1.HttpsError('invalid-argument', 'Tipo de ficheiro não suportado. Use PDF, DOC ou DOCX.');
        }
        let buffer;
        try {
            buffer = Buffer.from(fileBase64, 'base64');
        }
        catch {
            throw new https_1.HttpsError('invalid-argument', 'Conteúdo do ficheiro inválido.');
        }
        if (!buffer.length) {
            throw new https_1.HttpsError('invalid-argument', 'O ficheiro está vazio.');
        }
        if (buffer.length > MAX_BYTES) {
            throw new https_1.HttpsError('invalid-argument', 'O ficheiro deve ter no máximo 5 MB.');
        }
        await assertCanUploadCv(uid, contextType, contextId);
        const sanitizedName = sanitizeFileName(fileName);
        const timestamp = Date.now();
        const previousUrl = typeof payload.previousUrl === 'string' ? payload.previousUrl : '';
        let storagePath;
        if (contextType === 'migrant') {
            await deleteMigrantCvFilesServer(contextId, previousUrl || undefined);
            storagePath = buildMigrantCvStoragePath(contextId, fileName);
        }
        else if (contextType === 'profile') {
            await deleteProfileExternalCvFilesServer(contextId, previousUrl || undefined);
            storagePath = buildProfileExternalCvStoragePath(contextId, fileName);
        }
        else {
            if (previousUrl) {
                const parsed = parseStoragePathFromDownloadUrl(previousUrl);
                if (parsed) {
                    await deleteStoragePathIfExists(admin_1.FIREBASE_STORAGE_BUCKET, parsed);
                    await deleteStoragePathIfExists(admin_1.LEGACY_STORAGE_BUCKET, parsed);
                }
            }
            storagePath = `cv_uploads/${contextType}/${contextId}/${timestamp}_${sanitizedName}`;
        }
        const { bucketName, file } = await saveCvToStorage(storagePath, buffer, mimeType);
        const url = await resolveDownloadUrl(bucketName, file, storagePath);
        const auditId = `${contextType}_${contextId}_${timestamp}`;
        try {
            await (0, admin_1.getFirestore)()
                .collection('cv_uploads_audit')
                .doc(auditId)
                .set({
                contextType,
                contextId,
                uploaderUid: uid,
                fileName: sanitizedName,
                storagePath,
                downloadUrl: url,
                uploadedAt: new Date().toISOString(),
                fileSize: buffer.length,
                fileType: mimeType,
            });
        }
        catch (err) {
            firebase_functions_1.logger.error('uploadCvSecure_audit_failed', { auditId, contextId, error: String(err) });
        }
        return {
            url,
            fileName: sanitizedName,
            storagePath,
        };
    }
    catch (err) {
        if (err instanceof https_1.HttpsError)
            throw err;
        const detail = formatUnknownError(err);
        firebase_functions_1.logger.error('uploadCvSecure_failed', {
            uid,
            error: detail,
        });
        throw new https_1.HttpsError('internal', detail.includes('storage')
            ? `Não foi possível guardar o CV no Storage (${detail}).`
            : `Não foi possível guardar o CV (${detail}).`);
    }
});
