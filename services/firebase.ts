// Import Firebase services
// Fix: Use Firebase v9 compat libraries to support v8 syntax.
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC4iQrNjyEmlziJa7Sqgi5r6lDa98OyFak",
  authDomain: "yoyo-shop-7545c.firebaseapp.com",
  projectId: "yoyo-shop-7545c",
  storageBucket: "yoyo-shop-7545c.appspot.com",
  messagingSenderId: "809013526444",
  appId: "1:809013526444:web:c40c62d9d62589bf02c409",
  measurementId: "G-3BN4ST78WM"
};


// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const app = firebase.app();

// Get Firebase services
const auth = firebase.auth();
const db = firebase.firestore();
const analytics = firebase.analytics();

/**
 * Logs a user activity to the 'activityLog' collection in Firestore.
 * @param userEmail - The email of the user performing the action.
 * @param action - A short description of the action type (e.g., 'Create Product').
 * @param details - A more detailed description of the action (e.g., 'Created new product: Wooden Yoyo').
 */
export const logActivity = async (userEmail: string | null | undefined, action: string, details: string) => {
  if (!userEmail) {
    console.warn('Activity log attempted without a user. Logging as "system".');
    userEmail = 'system';
  }

  try {
    await db.collection('activityLog').add({
      user: userEmail,
      action: action,
      details: details,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("Error logging activity:", error);
    // Fail silently in the UI, but log the error.
  }
};

export { app, auth, db, analytics };