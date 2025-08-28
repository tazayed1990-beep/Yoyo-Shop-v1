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
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
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