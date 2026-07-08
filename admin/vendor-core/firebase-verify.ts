import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Verify a Firebase Auth ID token server-side without firebase-admin:
 * Google publishes the securetoken signing keys as a JWKS. We only trust
 * tokens for OUR project and only accept phone-verified identities.
 */
const FIREBASE_PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "opencollective-gate";

const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

export interface VerifiedPhone {
  phone: string; // E.164
  firebaseUid: string;
}

export async function verifyFirebasePhoneToken(idToken: string): Promise<VerifiedPhone | null> {
  try {
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });
    const phone = payload.phone_number as string | undefined;
    if (!phone || !payload.sub) return null;
    return { phone, firebaseUid: payload.sub };
  } catch (err) {
    console.error("[firebase-verify] rejected:", err instanceof Error ? err.message : err);
    return null;
  }
}
