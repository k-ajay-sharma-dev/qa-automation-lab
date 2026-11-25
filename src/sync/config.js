// Firebase project for cloud sync (saving progress to your Google account).
// The project belongs to QA Automation Lab alone (set-up steps: DEPLOY.md, rules: firestore.rules).
// These values are not secrets: access is protected by Google sign-in and the Firestore rules.
// Set it to null to run without cloud sync — progress then stays in this browser only.
export const firebaseConfig = {
  apiKey: 'AIzaSyCr4P_nMxN329getj63k_MpoMEGTemS9w8',
  authDomain: 'mule-practice-lab-ee64b.firebaseapp.com',
  projectId: 'mule-practice-lab-ee64b',
  storageBucket: 'mule-practice-lab-ee64b.firebasestorage.app',
  messagingSenderId: '920147160590',
  appId: '1:920147160590:web:7d99c964c80c4c79ab165f',
}

export const COLLECTIONS = { progress: 'qaProgress', state: 'qaState' }
