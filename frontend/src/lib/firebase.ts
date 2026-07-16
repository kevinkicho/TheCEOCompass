import { initializeApp, getApps, type FirebaseApp } from "firebase/app"
import { getDatabase, ref, set, push, onValue, off, get, child, query, orderByChild, equalTo, limitToLast, update, remove, onChildAdded } from "firebase/database"
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  linkWithPopup,
  linkWithRedirect,
  GoogleAuthProvider,
  signInAnonymously,
  onAuthStateChanged,
  signOut,
} from "firebase/auth"

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

if (hasConfig) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
  db = getDatabase(app)
  auth = getAuth(app)
}

const googleProvider = new GoogleAuthProvider()

export {
  app, db, auth, googleProvider,
  ref, set, push, onValue, off, get, child, query, orderByChild, equalTo, limitToLast, update, remove, onChildAdded,
  signInWithPopup, signInWithRedirect, getRedirectResult, linkWithPopup, linkWithRedirect,
  signInAnonymously, onAuthStateChanged, signOut,
}
