import { initializeApp } from "firebase/app"
import { getDatabase, ref, set, push, onValue, off, get, child, query, orderByChild, equalTo, limitToLast, update } from "firebase/database"

const firebaseConfig = {
  apiKey: "AIzaSyCbdFM2hcJYu9xoE8DEfLwKR01l4GQN6yg",
  authDomain: "theceocompass.firebaseapp.com",
  databaseURL: "https://theceocompass-default-rtdb.firebaseio.com",
  projectId: "theceocompass",
  storageBucket: "theceocompass.firebasestorage.app",
  messagingSenderId: "651793599177",
  appId: "1:651793599177:web:f97febea0c8f40bf689b18",
}

const app = initializeApp(firebaseConfig)
const db = getDatabase(app)

export { db, ref, set, push, onValue, off, get, child, query, orderByChild, equalTo, limitToLast, update }
