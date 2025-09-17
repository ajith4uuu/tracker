import { getBlob, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { FirebaseDB, FirebaseStorage } from "../firebaseConfig";
import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  writeBatch,
  orderBy,
  QueryConstraint,
} from "firebase/firestore";
import { consoleLog } from "./utils";

const isFirebaseReady = !!FirebaseDB;

// Simple in-memory fallback store when Firebase isn't configured
const memDB: Record<string, any> = { USERS: {} };
const memStorage: Record<string, Blob> = {};

function ensureUser(userId: string) {
  if (!memDB.USERS[userId]) {
    memDB.USERS[userId] = { QUESTIONS: {}, RESPONSES: {}, SETTINGS: { values: {} } };
  }
  return memDB.USERS[userId];
}

const PARTIAL_RESPONSE_COLLECTION_ID = "survey_resume_state";

const BASE_COLLECTION_ID = 'USERS';

export function userCollectionID(userId: any) {
  return `${BASE_COLLECTION_ID}/${userId}`;
}

export function deletedUserCollectionID(userId: any) {
  return `DELETED_${BASE_COLLECTION_ID}/${userId}`;
}

export function questionsCollectionID(userId: any) {
  return `${userCollectionID(userId)}/QUESTIONS`;
}

export function settingsCollectionID(userId: any) {
  return `${userCollectionID(userId)}/SETTINGS`;
}

export function settingsDocID(userId: any) {
  return [
    ...userCollectionID(userId).split('/'),
    'SETTINGS'
  ]
}

export function responsesCollectionID(userId: any) {
  return `${userCollectionID(userId)}/RESPONSES`;
}

export function singleResponseCollectionID(userId: any, questionId: any) {
  return responsesCollectionID(userId) + '/' + questionId;
}

// Save partial response
export const savePartialResponse = async (
  token: string,
  data: {
    current_page: number;
    last_saved_ts: number;
    partial_answers: Record<string, any>;
  }
) => {
  await setDoc(doc(FirebaseDB, PARTIAL_RESPONSE_COLLECTION_ID, token), data);
};

// Load saved response
export const loadPartialResponse = async (token: string) => {
  const docSnap = await getDoc(doc(FirebaseDB, PARTIAL_RESPONSE_COLLECTION_ID, token));
  return docSnap.exists() ? docSnap.data() : null;
};

// Delete old/incomplete responses
export const deletePartialResponse = async (token: string) => {
  await deleteDoc(doc(FirebaseDB, PARTIAL_RESPONSE_COLLECTION_ID, token));
};

export const fetchFirestoreDocs = async (path: string, ...constraints: QueryConstraint[]) => {
  if (!isFirebaseReady) {
    // Fallback: return docs from memDB matching path
    // Supported paths: USERS/{uid}/QUESTIONS, USERS/{uid}/RESPONSES, USERS/{uid}/SETTINGS
    const parts = path.split('/');
    const userId = parts[1];
    const col = parts[2];
    const u = ensureUser(userId);
    let items: any[] = [];
    if (col === 'QUESTIONS') items = Object.values(u.QUESTIONS);
    else if (col === 'RESPONSES') items = Object.values(u.RESPONSES);
    else if (col === 'SETTINGS') items = [u.SETTINGS.values];

    // Lightweight filtering/sorting for common queries
    const wherePage = (constraints as any[]).find((c) => c?.type === 'where' || c?._methodName === 'where');
    const orderBy1 = (constraints as any[]).find((c) => c?.type === 'orderBy' || c?._methodName === 'orderBy');

    if (wherePage && (wherePage.fieldPath === 'page' || wherePage._fieldPath?._internalPath?.toString?.() === 'page')) {
      const expected = wherePage.value ?? wherePage._value;
      items = items.filter((it: any) => it.page === expected);
    }

    if (orderBy1) {
      const field = orderBy1.field || orderBy1._field?._internalPath?.toString?.() || orderBy1.fieldPath || 'sequence';
      const dir = (orderBy1.directionStr || 'asc').toLowerCase();
      items.sort((a: any, b: any) => {
        const av = a[field];
        const bv = b[field];
        return dir === 'desc' ? (bv - av) : (av - bv);
      });
    }

    return items.map((v: any) => ({ id: String(v.id ?? v.FieldId ?? v.name ?? Math.random()), data: () => v }));
  }

  const q = query(
    collection(FirebaseDB, path),
    ...constraints
  )

  const snapshot = await getDocs(q)

  return snapshot.docs
};

// Fetch questions from the "questions" collection
export const fetchQuestionsFromFirestore = async (userId: any, page: number) => {
  if (!isFirebaseReady) {
    const u = ensureUser(String(userId));
    return Object.values(u.QUESTIONS).filter((q: any) => q.page === page).sort((a: any, b: any) => (a.sequence - b.sequence));
  }
  const docs = await fetchFirestoreDocs(questionsCollectionID(userId), where('page', '==', page), orderBy('sequence', 'asc'))
  return docs.map(doc => doc.data())
};

export const fetchAllQuestionsFromFirestore = async (userId: any) => {
  if (!isFirebaseReady) {
    const u = ensureUser(String(userId));
    return Object.values(u.QUESTIONS).sort((a: any, b: any) => (a.page - b.page) || (a.sequence - b.sequence));
  }
  const docs = await fetchFirestoreDocs(questionsCollectionID(userId), orderBy('page', 'asc'), orderBy('sequence', 'asc'))
  return docs.map(doc => doc.data())
};

const fetchFirestoreDocWithId = async (path: string, ...segments: string[]) => {
  if (!isFirebaseReady) {
    const parts = path.split('/');
    const userId = parts[1];
    const col = parts[2];
    const u = ensureUser(userId);
    if (col === 'SETTINGS') return u.SETTINGS.values;
    return null;
  }
  const qCol = collection(FirebaseDB, path, ...segments)
  const snapshot = await getDocs(qCol)
  let docData: any = null
  if (snapshot.docs.length > 0) {
    docData = snapshot.docs[0].data()
  }
  return docData
}

const storeFirestoreDoc = async (path: string, data: any, ...pathSegments: string[]) => {
  if (!isFirebaseReady) {
    const parts = path.split('/');
    const userId = parts[1];
    const col = parts[2];
    const u = ensureUser(userId);
    if (col === 'SETTINGS') {
      u.SETTINGS.values = { ...(u.SETTINGS.values || {}), ...(data || {}) };
    } else if (col === 'RESPONSES') {
      const id = pathSegments[0];
      u.RESPONSES[id] = { ...(u.RESPONSES[id] || {}), ...(data || {}) };
    } else if (col === 'QUESTIONS') {
      const id = pathSegments[0];
      u.QUESTIONS[id] = { ...(u.QUESTIONS[id] || {}), ...(data || {}) };
    }
    return;
  }
  return await setDoc(doc(FirebaseDB, path, ...pathSegments), data)
}

export const fetchFileFromGLS = async (path: string) => {
  if (!FirebaseStorage) {
    const blob = memStorage[path];
    return { path, name: path.split('/').pop() || 'file', blob };
  }
  const storageRef = ref(FirebaseStorage, path)
  const blob = await getBlob(storageRef)
  return {
    'path': storageRef.fullPath,
    'name': storageRef.name,
    'blob': blob,
  }
}

export const fetchFileDownloadURLFromGCS = async (path: string) => {
  if (!FirebaseStorage) {
    const blob = memStorage[path];
    if (blob) return URL.createObjectURL(blob);
    return '#';
  }
  const storageRef = ref(FirebaseStorage, path)
  return await getDownloadURL(storageRef)
}

export const uploadFileToGLS = async (path: string, blob: Blob) => {
  if (!FirebaseStorage) {
    memStorage[path] = blob;
    return path;
  }
  const storageRef = ref(FirebaseStorage, path)
  const snapshot = await uploadBytes(storageRef, blob)
  return snapshot.ref.fullPath
}

export const fetchAllUserResponsesFromFirestore = async (userId: string) => {
  if (!isFirebaseReady) {
    const u = ensureUser(String(userId));
    return { ...u.RESPONSES };
  }
  const docs = await fetchFirestoreDocs(responsesCollectionID(userId));
  let responses: any = {};
  docs.forEach(doc => {
    responses[doc.id] = doc.data()
  })
  return responses;
}

export const storeAllUserResponsesToFirestore = async (userId: string, responses: any) => {
  if (!isFirebaseReady) {
    const u = ensureUser(String(userId));
    for (let rId in responses) {
      u.RESPONSES[rId] = responses[rId];
    }
    return;
  }
  const batch = getFirestoreBatch();
  for (let rId in responses) {
    batch.set(getFirestoreDoc(responsesCollectionID(userId), rId), responses[rId])
  }
  await batch.commit()
}

export const fetchUserResponseFromFirestore = async (userId: string) => {
  if (!isFirebaseReady) {
    const u = ensureUser(String(userId));
    return Object.keys(u.RESPONSES).map((id) => ({ id, data: () => u.RESPONSES[id] }));
  }
  return await fetchFirestoreDocs(responsesCollectionID(userId))
}

export const storeUserResponseToFirestore = async (userId: string, questionID: any, response: any) => {
  if (!isFirebaseReady) {
    const u = ensureUser(String(userId));
    u.RESPONSES[String(questionID)] = response;
    return;
  }
  return await storeFirestoreDoc(singleResponseCollectionID(userId, questionID), response)
}

export const fetchUserSettingsFromFirestore = async (userId: string) => {
  consoleLog('fetching settings',await fetchFirestoreDocWithId(settingsCollectionID(userId)));

  return {
    language: 'en',
    totalPages: 1,
    resumePage: 1,
    surveyCompleted: false,
    ...(await fetchFirestoreDocWithId(settingsCollectionID(userId)) ?? {})
  } as USER_SETTINGS_TYPE;
}

export const storeUserSettingsToFirestore = async (userId: string, settings: USER_SETTINGS_TYPE) => {
  if (!isFirebaseReady) {
    const u = ensureUser(String(userId));
    u.SETTINGS.values = { ...(u.SETTINGS.values || {}), ...(settings || {}) };
    return;
  }
  return await storeFirestoreDoc(settingsCollectionID(userId), settings, 'values')
}

export const getFirestoreBatch = () => {
  if (!isFirebaseReady) {
    const ops: Array<{ path: string; id: string; data: any }> = [];
    return {
      set(ref: any, data: any) {
        ops.push({ path: ref._path, id: ref._id, data });
      },
      async commit() {
        ops.forEach(({ path, id, data }) => {
          const parts = path.split('/');
          const userId = parts[1];
          const col = parts[2];
          const u = ensureUser(userId);
          if (col === 'RESPONSES') u.RESPONSES[id] = data;
          else if (col === 'QUESTIONS') u.QUESTIONS[id] = data;
          else if (col === 'SETTINGS') u.SETTINGS.values = { ...(u.SETTINGS.values || {}), ...(data || {}) };
        });
      }
    } as any;
  }
  return writeBatch(FirebaseDB);
};

export const getFirestoreDoc = (path: string, ...segments: string[]) => {
  if (!isFirebaseReady) {
    const id = segments[0] || '';
    return { _path: path, _id: id } as any;
  }
  return doc(FirebaseDB, path, ...segments);
};

export const getFirestoreCollection = (path: string, ...segments: string[]) => {
  if (!isFirebaseReady) {
    return { _path: [path, ...segments].join('/') } as any;
  }
  return collection(FirebaseDB, path, ...segments);
};

export const sanitizeObj = (obj: any) => {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, v === undefined ? null : v])
  );
}
