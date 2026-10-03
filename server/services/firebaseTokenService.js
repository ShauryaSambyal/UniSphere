import axios from 'axios';
import jwt from 'jsonwebtoken';
import '../config/env.js';

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

export async function verifyFirebaseIdToken(idToken, projectId) {
  const decoded = jwt.decode(idToken, { complete: true });

  if (!decoded?.header?.kid) {
    throw new Error('Firebase token is malformed (missing key id)');
  }

  const certs = await getFirebasePublicCerts();
  const publicKey = certs[decoded.header.kid];

  if (!publicKey) {

    cachedUntil = 0;
    throw new Error('Firebase token signed with an unknown key');
  }

  return jwt.verify(idToken, publicKey, {
    algorithms: ['RS256'],
    audience: projectId,
    issuer: `https://securetoken.google.com/${projectId}`
  });
}
