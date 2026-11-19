// Firebase project for cloud sync (saving progress to your Google account).
// This shares the Mule Practice Lab project: same Google sign-in and authorized domains. The QA app keeps its data in
// its own collections (qaProgress, qaState), so the two apps never touch each other's progress. See firestore.rules.
// These values are not secrets: access is protected by Google sign-in and the Firestore rules.
// Set it to null to run without cloud sync — progress then stays in this browser only.
export const firebaseConfig = {
  apiKey: 'AIzaSyA8cjyzgOoPzALU7GxcrTsiXHV7WSbmqX4',
  authDomain: 'mule-practice-lab.firebaseapp.com',
  projectId: 'mule-practice-lab',
  storageBucket: 'mule-practice-lab.firebasestorage.app',
  messagingSenderId: '782905846179',
  appId: '1:782905846179:web:e449bd70315866b0261216',
}

export const COLLECTIONS = { progress: 'qaProgress', state: 'qaState' }
