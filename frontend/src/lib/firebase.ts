import { initializeApp, getApps, type FirebaseApp } from "firebase/app"
import { getDatabase, ref, set, push, onValue, off, get, child, query, orderByChild, equalTo, limitToLast, update, remove, onChildAdded } from "firebase/database"
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  signInWithCredential,
  getRedirectResult,
  linkWithPopup,
  linkWithRedirect,
  GoogleAuthProvider,
  signInAnonymously,
  onAuthStateChanged,
  signOut,
} from "firebase/auth"
import { getFunctions, httpsCallable, type Functions } from "firebase/functions"
import { initAppCheckIfConfigured } from "@/lib/app-check"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
}

const hasConfig = firebaseConfig.apiKey.length > 0 && firebaseConfig.projectId.length > 0
/** Firebase app instance (null when env config is incomplete). */
let app: FirebaseApp | null = null
let db: ReturnType<typeof getDatabase> | null = null
let auth: ReturnType<typeof getAuth> | null = null
let functions: Functions | null = null

if (hasConfig) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
  // Eager App Check on client module load — before Auth/RTDB consumers' effects.
  // No-op on SSR and when NEXT_PUBLIC_APPCHECK_SITE_KEY is unset.
  initAppCheckIfConfigured(app)
  db = getDatabase(app)
  auth = getAuth(app)
  // Match Cloud Functions region (us-central1)
  functions = getFunctions(app, "us-central1")
}

const googleProvider = new GoogleAuthProvider()

export {
  app, db, auth, functions, googleProvider, GoogleAuthProvider, httpsCallable,
  ref, set, push, onValue, off, get, child, query, orderByChild, equalTo, limitToLast, update, remove, onChildAdded,
  signInWithPopup, signInWithRedirect, signInWithCredential, getRedirectResult, linkWithPopup, linkWithRedirect,
  signInAnonymously, onAuthStateChanged, signOut,
}
