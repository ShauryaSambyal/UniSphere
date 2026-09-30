import axios from 'axios';
import jwt from 'jsonwebtoken';
import '../config/env.js';

// Google publishes the Firebase ID token signing keys at this well-known URL.
// They rotate roughly every few hours, so the response is cached using the
// max-age from Google's Cache-Control header.
const FIREBASE_CERT_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let cachedCerts = null;
let cachedUntil = 0;

async function getFirebasePublicCerts() {
  if (cachedCerts && Date.now() < cachedUntil) {
    return cachedCerts;
  }

  const response = await axios.get(FIREBASE_CERT_URL, { timeout: 5000 });
  cachedCerts = response.data;

  const maxAgeMatch = /max-age=(\d+)/.exec(response.headers?.['cache-control'] || '');
  const maxAgeMs = (maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600) * 1000;
  cachedUntil = Date.now() + maxAgeMs;

  return cachedCerts;
}

/**
 * Verifies a Firebase ID token using Google's rotating public certificates —
 * the same checks the Firebase Admin SDK performs (signature, audience,
 * issuer, expiry) but without requiring a service-account key.
 *
 * @param {string} idToken - Token from the Firebase client SDK.
 * @param {string} projectId - Firebase project ID (token audience).
 * @returns {Promise<Object>} Decoded token payload (email, sub, name, ...).
 */
export async function verifyFirebaseIdToken(idToken, projectId) {
  const decoded = jwt.decode(idToken, { complete: true });

  if (!decoded?.header?.kid) {
    throw new Error('Firebase token is malformed (missing key id)');
  }

  const certs = await getFirebasePublicCerts();
  const publicKey = certs[decoded.header.kid];

  if (!publicKey) {
    // Force a refresh next call in case Google rotated its keys mid-cache.
    cachedUntil = 0;
    throw new Error('Firebase token signed with an unknown key');
  }

  return jwt.verify(idToken, publicKey, {
    algorithms: ['RS256'],
    audience: projectId,
    issuer: `https://securetoken.google.com/${projectId}`
  });
}
