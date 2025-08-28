// Import the functions you need from the SDKs you need
// Fix: Use named import for `initializeApp` as required by Firebase v9+ modular SDK.
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// --- IMPORTANT ---
// REPLACE THE PLACEHOLDER VALUES BELOW WITH YOUR OWN FIREBASE PROJECT CONFIGURATION
// You can get this from your Firebase project settings:
// Project Settings > General > Your apps > Web app > Firebase SDK snippet > Config
const firebaseConfig = {
  apiKey: "AIzaSyC4iQrNjyEmlziJa7Sqgi5r6lDa98OyFak",
  authDomain: "yoyo-shop-7545c.firebaseapp.com",
  projectId: "yoyo-shop-7545c",
  storageBucket: "yoyo-shop-7545c.firebasestorage.app",
  messagingSenderId: "809013526444",
  appId: "1:809013526444:web:c40c62d9d62589bf02c409",
  measurementId: "G-3BN4ST78WM"
};

// Runtime check to ensure Firebase config is filled out
if (firebaseConfig.apiKey === "YOUR_API_KEY" || !firebaseConfig.projectId) {
  const errorMessage = "Firebase configuration is missing or incomplete. Please open services/firebase.ts and replace the placeholder values with your actual Firebase project credentials.";
  console.error(errorMessage);
  // Throw an error to halt execution and make it very obvious.
  throw new Error(errorMessage);
}


// Initialize Firebase
// Fix: Call initializeApp directly as it's a top-level function in the modular SDK.
const app = initializeApp(firebaseConfig);

// Get Firebase services
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };