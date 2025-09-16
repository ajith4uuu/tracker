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
  const q = query(
    collection(FirebaseDB, path),
    ...constraints
  )

  const snapshot = await getDocs(q)

  return snapshot.docs
};

// Fetch questions from the "questions" collection
export const fetchQuestionsFromFirestore = async (userId: any, page: number) => {
  const docs = await fetchFirestoreDocs(questionsCollectionID(userId), where('page', '==', page), orderBy('sequence', 'asc'))

  return docs.map(doc => doc.data())
};

export const fetchAllQuestionsFromFirestore = async (userId: any) => {
  const docs = await fetchFirestoreDocs(questionsCollectionID(userId), orderBy('page', 'asc'), orderBy('sequence', 'asc'))

  return docs.map(doc => doc.data())
};

const fetchFirestoreDocWithId = async (path: string, ...segments: string[]) => {
  const q = collection(FirebaseDB, path, ...segments)

  const snapshot = await getDocs(q)

  let docData: any = null

  if (snapshot.docs.length > 0) {
    docData = snapshot.docs[0].data()
  }

  return docData
}

const storeFirestoreDoc = async (path: string, data: any, ...pathSegments: string[]) => {
  return await setDoc(doc(FirebaseDB, path, ...pathSegments), data)
}

export const fetchFileFromGLS = async (path: string) => {
  const storageRef = ref(FirebaseStorage, path)

  const blob = await getBlob(storageRef)

  return {
    'path': storageRef.fullPath,
    'name': storageRef.name,
    'blob': blob,
  }
}

export const fetchFileDownloadURLFromGCS = async (path: string) => {
  const storageRef = ref(FirebaseStorage, path)

  return await getDownloadURL(storageRef)
}

export const uploadFileToGLS = async (path: string, blob: Blob) => {
  const storageRef = ref(FirebaseStorage, path)

  const snapshot = await uploadBytes(storageRef, blob)

  return snapshot.ref.fullPath
}

export const fetchAllUserResponsesFromFirestore = async (userId: string) => {
  const docs = await fetchFirestoreDocs(responsesCollectionID(userId));

  let responses: any = {};

  docs.forEach(doc => {
    responses[doc.id] = doc.data()
  })

  // consoleLog('fetchAllUserResponsesFromFirestore() -> responses', responses)

  return responses;
}

export const storeAllUserResponsesToFirestore = async (userId: string, responses: any) => {
  const batch = getFirestoreBatch();

  // consoleLog('storeAllUserResponsesToFirestore() -> responses', responses)

  for (let rId in responses) {
    batch.set(getFirestoreDoc(responsesCollectionID(userId), rId), responses[rId])
  }

  await batch.commit()
}

export const fetchUserResponseFromFirestore = async (userId: string) => {
  return await fetchFirestoreDocs(responsesCollectionID(userId))
}

export const storeUserResponseToFirestore = async (userId: string, questionID: any, response: any) => {
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
  return await storeFirestoreDoc(settingsCollectionID(userId), settings, 'values')
}

export const getFirestoreBatch = () => {
  return writeBatch(FirebaseDB);
};

export const getFirestoreDoc = (path: string, ...segments: string[]) => {
  return doc(FirebaseDB, path, ...segments);
};

export const getFirestoreCollection = (path: string, ...segments: string[]) => {
  return collection(FirebaseDB, path, ...segments);
};

export const sanitizeObj = (obj: any) => {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, v === undefined ? null : v])
  );
}
