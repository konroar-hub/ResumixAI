import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  User
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { MasterProfile, ResumeItem, JobRecord, ResumeStyle } from './types';

export interface DebugLogEntry {
  time: string;
  type: 'info' | 'warn' | 'error' | 'success';
  message: string;
  data?: any;
}

export const debugLogs: DebugLogEntry[] = [];

export function addDebugLog(type: 'info' | 'warn' | 'error' | 'success', message: string, data?: any) {
  const entry: DebugLogEntry = {
    time: new Date().toLocaleTimeString(),
    type,
    message,
    data: data ? (typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data)) : undefined
  };
  debugLogs.unshift(entry);
  console.log(`[DEBUG ${type.toUpperCase()}] ${message}`, data || '');
}

const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-app';
const defaultAuthDomain = projectId !== 'demo-app' ? `${projectId}.firebaseapp.com` : 'demo-app.firebaseapp.com';

// Enable same-origin auth domain on Vercel deployments to bypass 3rd-party cookie blocking
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || (
  currentHostname && currentHostname.includes('vercel.app') 
    ? currentHostname 
    : defaultAuthDomain
);

const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || (projectId !== 'demo-app' ? `${projectId}.appspot.com` : 'demo-app.appspot.com');

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:123456789:web:abcdef'
};

export const isFirebaseConfigured = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY && 
  import.meta.env.VITE_FIREBASE_API_KEY !== 'demo-api-key' && 
  import.meta.env.VITE_FIREBASE_PROJECT_ID
);

addDebugLog('info', `Firebase Init: host="${currentHostname}", authDomain="${authDomain}", projectId="${projectId}", isConfigured=${isFirebaseConfigured}`);

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

// Enforce persistent auth session across page reloads & browser restarts
if (isFirebaseConfigured) {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.error('Firebase persistence setup error:', err);
  });
}

const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export interface UserStoreData {
  profile?: MasterProfile;
  resumes?: ResumeItem[];
  jobsList?: JobRecord[];
  resumeStyles?: ResumeStyle[];
}

export async function saveUserDataToFirestore(userId: string, data: UserStoreData): Promise<void> {
  if (!isFirebaseConfigured || !userId) return;
  try {
    const userDocRef = doc(db, 'users', userId);
    await setDoc(userDocRef, {
      ...data,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    console.error('Firestore write error:', error);
  }
}

export async function loadUserDataFromFirestore(userId: string): Promise<UserStoreData | null> {
  if (!isFirebaseConfigured || !userId) return null;
  try {
    const userDocRef = doc(db, 'users', userId);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      return snap.data() as UserStoreData;
    }
  } catch (error) {
    console.error('Firestore read error:', error);
  }
  return null;
}

export {
  auth,
  db,
  googleProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc
};
export type { User };
