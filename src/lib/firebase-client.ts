"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type Auth,
  type ConfirmationResult,
} from "firebase/auth";

/**
 * Firebase is used for exactly one thing: proving a member controls a phone
 * number (SMS OTP). Sessions stay NextAuth. Public web config — safe defaults,
 * overridable by env. Feature-gated by NEXT_PUBLIC_PHONE_LOGIN=1 so the tab
 * stays dark until the provider is enabled in the Firebase console.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCRe5ji8PrOVXSMrkCUhs4HTl8OhQgA2ug",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "opencollective-gate.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "opencollective-gate",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:412881804850:web:e06d4e26a985c2cdbbe62b",
};

export const phoneLoginEnabled = process.env.NEXT_PUBLIC_PHONE_LOGIN === "1";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let recaptcha: RecaptchaVerifier | null = null;

function getFirebaseAuth(): Auth {
  if (!app) app = getApps()[0] || initializeApp(firebaseConfig);
  if (!auth) {
    auth = getAuth(app);
    auth.useDeviceLanguage();
  }
  return auth;
}

/** containerId must be an empty div that stays mounted (invisible reCAPTCHA). */
export async function sendPhoneCode(phone: string, containerId: string): Promise<ConfirmationResult> {
  const a = getFirebaseAuth();
  if (!recaptcha) {
    recaptcha = new RecaptchaVerifier(a, containerId, { size: "invisible" });
  }
  try {
    return await signInWithPhoneNumber(a, phone, recaptcha);
  } catch (err) {
    // A consumed/expired widget must be rebuilt before retrying.
    try {
      recaptcha.clear();
    } catch {}
    recaptcha = null;
    throw err;
  }
}

/** Returns the Firebase ID token (proof-of-phone) after the user enters the SMS code. */
export async function confirmPhoneCode(
  confirmation: ConfirmationResult,
  code: string
): Promise<string> {
  const cred = await confirmation.confirm(code);
  return cred.user.getIdToken();
}
