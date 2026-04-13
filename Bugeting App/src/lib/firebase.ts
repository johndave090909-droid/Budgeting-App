import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD8CadhUR1Mp-1bc7YBWE5wO5KzyqFXVh4",
  authDomain: "game-dave.firebaseapp.com",
  databaseURL: "https://game-dave-default-rtdb.firebaseio.com",
  projectId: "game-dave",
  storageBucket: "game-dave.firebasestorage.app",
  messagingSenderId: "1093948242108",
  appId: "1:1093948242108:web:5a03f546e173a233a9b8b9"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
