import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    Timestamp,
    WhereFilterOp,
} from 'firebase/firestore';
import { db } from './client';

/**
 * Generic function to get a document from Firestore
 */
export async function getDocument<T>(collectionName: string, documentId: string): Promise<T | null> {
    try {
        const docRef = doc(db, collectionName, documentId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as T;
        }
        return null;
    } catch (error) {
        console.error(`Error getting document from ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Generic function to set/create a document in Firestore
 */
export async function setDocument<T>(
    collectionName: string,
    documentId: string,
    data: T,
    merge: boolean = false
) {
    try {
        const docRef = doc(db, collectionName, documentId);
        await setDoc(docRef, data, { merge });
    } catch (error) {
        console.error(`Error setting document in ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Generic function to update a document in Firestore
 */
export async function updateDocument(
    collectionName: string,
    documentId: string,
    data: Record<string, unknown>
) {
    try {
        const docRef = doc(db, collectionName, documentId);
        await updateDoc(docRef, {
            ...data,
            updatedAt: serverTimestamp(),
        });
    } catch (error) {
        console.error(`Error updating document in ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Generic function to delete a document from Firestore
 */
export async function deleteDocument(collectionName: string, documentId: string) {
    try {
        const docRef = doc(db, collectionName, documentId);
        await deleteDoc(docRef);
    } catch (error) {
        console.error(`Error deleting document from ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Generic function to get all documents from a collection
 */
export async function getCollection<T>(collectionName: string): Promise<T[]> {
    try {
        const querySnapshot = await getDocs(collection(db, collectionName));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
    } catch (error) {
        console.error(`Error getting collection ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Query documents with filters
 */
export async function queryDocuments<T>(
    collectionName: string,
    filters: { field: string; operator: WhereFilterOp; value: unknown }[],
    orderByField?: string,
    limitCount?: number
): Promise<T[]> {
    try {
        let q = query(collection(db, collectionName));

        // Apply filters
        filters.forEach(filter => {
            q = query(q, where(filter.field, filter.operator, filter.value));
        });

        // Apply ordering
        if (orderByField) {
            q = query(q, orderBy(orderByField));
        }

        // Apply limit
        if (limitCount) {
            q = query(q, limit(limitCount));
        }

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
    } catch (error) {
        console.error(`Error querying ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Helper to convert Firestore Timestamp to Date
 */
export function timestampToDate(timestamp: Timestamp | null): Date | null {
    if (!timestamp) return null;
    return timestamp.toDate();
}

/**
 * Helper to get server timestamp
 */
export { serverTimestamp };
