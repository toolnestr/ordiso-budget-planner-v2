// Firebase initialization — uses the provided web config + Firestore.
import { initializeApp, getApps, getApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyCTMx6EP7bsffX8JeoR01v9WwKsswUq89w',
  authDomain: 'etsy-229e5.firebaseapp.com',
  projectId: 'etsy-229e5',
  storageBucket: 'etsy-229e5.firebasestorage.app',
  messagingSenderId: '183867097387',
  appId: '1:183867097387:web:c92b6f85d7697dfd98456e',
}

// Reuse the app across hot reloads
const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

// Server-side Firestore (memory-only, no persistence needed on the server)
export const firestore = getFirestore(app)
export { app }
