// Firebase initialization — client-side (browser) SDK.
// Used for both Auth and Firestore directly from the browser, which removes
// the need for server-side API routes / Cloudflare Workers. The app deploys
// as a static site on Cloudflare Pages.
import { initializeApp, getApps, getApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyCTMx6EP7bsffX8JeoR01v9WwKsswUq89w',
  authDomain: 'etsy-229e5.firebaseapp.com',
  projectId: 'etsy-229e5',
  storageBucket: 'etsy-229e5.firebasestorage.app',
  messagingSenderId: '183867097387',
  appId: '1:183867097387:web:c92b6f85d7697dfd98456e',
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

export const db = getFirestore(app)
export const auth = getAuth(app)
export { app }
