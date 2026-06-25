// Firebase initialization — uses the provided web config + Realtime Database URL.
import { initializeApp, getApps, getApp } from 'firebase/app'

const firebaseConfig = {
  apiKey: 'AIzaSyCTMx6EP7bsffX8JeoR01v9WwKsswUq89w',
  authDomain: 'etsy-229e5.firebaseapp.com',
  projectId: 'etsy-229e5',
  storageBucket: 'etsy-229e5.firebasestorage.app',
  messagingSenderId: '183867097387',
  appId: '1:183867097387:web:c92b6f85d7697dfd98456e',
  // Realtime Database URL (provided by user)
  databaseURL: 'https://etsy-229e5-default-rtdb.firebaseio.com/',
}

// Reuse the app across hot reloads
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
