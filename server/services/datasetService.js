import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import '../config/env.js';

/**
 * Open-data ingestion for the college directory.
 *
 * Instead of shipping a hand-filled demo JSON file, the directory is built from
 * public datasets that are free to download and need no API key:
 *
 *   1. Hugging Face — DropTheHQ/global-universities (27k universities worldwide)
 *   2. GitHub — UGC Indian University Dataset (976 UGC-recognised universities)
 *
 * `syncDatasetsToDatabase()` re-downloads them and upserts the result, which is
 * what the admin "Refresh open data" button and `npm run data:sync` call. A
 * cached snapshot is written to server/data/colleges.open-data.json so seeding
 * still works offline.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SNAPSHOT_PATH = path.join(__dirname, '../data/colleges.open-data.json');

export const SOURCES = [
  {
    id: 'huggingface-global-universities',
    label: 'Hugging Face · DropTheHQ/global-universities',
    url: 'https://huggingface.co/datasets/DropTheHQ/global-universities/resolve/main/global-universities.csv',
    license: 'Open dataset published on Hugging Face',
    country: 'India'
  },
  {
    id: 'ugc-indian-universities',
    label: 'GitHub · UGC Indian University Dataset',
    url: 'https://raw.githubusercontent.com/Bluff-0/UGC_Indian-University-Dataset/master/UGC%20Universities.csv',
    license: 'UGC public university listing',
    country: 'India'
  }
];

// Every state and union territory, longest first so "Andhra Pradesh" wins over
// a bare "Pradesh" style fragment.
const INDIAN_STATES = [
  'Andaman and Nicobar Islands',
  'Arunachal Pradesh',
  'Himachal Pradesh',
  'Uttar Pradesh',
  'Uttarakhand',
  'Andhra Pradesh',
  'Madhya Pradesh',
  'Dadra and Nagar Haveli',
  'Jammu and Kashmir',
  'West Bengal',
  'Chhattisgarh',
  'Maharashtra',
  'Meghalaya',
  'Puducherry',
  'Rajasthan',
  'Tamil Nadu',
  'Telangana',
  'Lakshadweep',
  'Jharkhand',
  'Karnataka',
  'Chandigarh',
  'Punjab',
  'Manipur',
  'Mizoram',
  'Nagaland',
  'Sikkim',
  'Tripura',
  'Kerala',
  'Odisha',
  'Gujarat',
  'Haryana',
  'Assam',
  'Bihar',
  'Delhi',
  'Goa',
  'Ladakh'
].sort((a, b) => b.length - a.length);

// Words that show up in postal addresses but never name a city.
const ADDRESS_STOPWORDS = new Set([
  'po', 'p', 'post', 'pin', 'pincode', 'dist', 'district', 'campus', 'road',
  'rd', 'via', 'city', 'university', 'college', 'nagar', 'the', 'and', 'near',
  'opp', 'off', 'new', 'old', 'south', 'north', 'east', 'west', 'null', 'nil',
  'na', 'none', 'nit', 'iit', 'iim', 'iisc', 'iiser', 'village', 'vill', 'taluk',
  'state', 'po.', 'p.s', 'p.o'
]);

// "U.P", "H.P", "T.N" — state abbreviations that trail an address.
const STATE_ABBREVIATION = /^[A-Z](\.[A-Z])+\.?$/i;

const LICENSE_PREFIXES = /^(university|college|institute|school)\s+of\s+/i;

/** Minimal RFC-4180-ish CSV parser (handles quotes, escaped quotes, CRLF). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) return [];

  const header = rows[0].map((h) => h.trim().replace(/^\uFEFF/, ''));
  return rows
    .slice(1)
    .filter((cells) => cells.some((cell) => cell !== ''))
    .map((cells) => {
      const record = {};
      header.forEach((key, index) => {
        record[key] = (cells[index] ?? '').trim();
      });
      return record;
    });
}

/** Collapses a name to a comparable key: lowercase alphanumerics only. */
export function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Short, human-friendly identifier used for deduplication and Algolia keys. */
export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Builds an abbreviation such as "IITB" for "Indian Institute of Technology
 * Bombay" by dropping filler words before taking initials.
 */
export function buildShortName(name) {
  const filler = new Set(['of', 'and', 'the', 'for', 'in', 'at', 'to', 'a', 'an', '&']);
  const words = String(name || '')
    .replace(/[^A-Za-z0-9\s&]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const initials = words
    .filter((word) => !filler.has(word.toLowerCase()))
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  if (initials.length >= 2) return initials.slice(0, 8);
  return String(name || 'COLLEGE').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'COLLEGE';
}

/** Finds the state/UT named inside a free-text postal address. */
export function extractState(address) {
  const haystack = String(address || '').toLowerCase();
  if (!haystack) return '';
  return INDIAN_STATES.find((state) => haystack.includes(state.toLowerCase())) || '';
}

const titleCase = (value) =>
  String(value || '').replace(/[A-Za-z]+/g, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase());

/** Strips postal prefixes such as "Dist.", "P.O" and stray punctuation. */
function cleanAddressToken(token) {
  return String(token || '')
    .replace(/^[.\-()]+|[.\-()]+$/g, '')
    .replace(/^(dist|dt|po|post|vill|village|via)\.?[\s.-]*/i, '')
    .trim();
}

/** Best-effort city extraction from a postal address, given its state. */
export function extractCity(address, state) {
  const raw = String(address || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';

  const stateIndex = state ? raw.toLowerCase().indexOf(state.toLowerCase()) : -1;
  const head = stateIndex > 0 ? raw.slice(0, stateIndex) : raw;

  const tokens = head
    .replace(/\d{6}/g, ' ')
    .split(/[\s,]+/)
    .map(cleanAddressToken)
    .filter((token) => /^[A-Za-z][A-Za-z.'-]*$/.test(token))
    .filter((token) => token.length >= 3)
    .filter((token) => !STATE_ABBREVIATION.test(token))
    .filter((token) => !ADDRESS_STOPWORDS.has(token.toLowerCase()))
    // A place name always carries a vowel — this drops parse noise.
    .filter((token) => /[aeiou]/i.test(token));

  if (tokens.length === 0) return '';

  return titleCase(tokens[tokens.length - 1]);
}

function extractPincode(address) {
  const match = String(address || '').match(/\b(\d{6})\b/);
  return match ? match[1] : '';
}

function looksWomenOnly(name) {
  return /women|girls/i.test(String(name || ''));
}

function inferInstituteType(name, declaredType) {
  const clean = String(declaredType || '').trim();
  if (clean && clean.toLowerCase() !== 'nan') return clean;

  const value = String(name || '').toLowerCase();
  if (value.includes('indian institute of technology')) return 'Government (IIT)';
  if (value.includes('national institute of technology')) return 'Government (NIT)';
  if (value.includes('indian institute of science')) return 'Government (IISc)';
  if (value.includes('indian institute of information technology')) return 'Government (IIIT)';
  if (value.includes('indian institute of management')) return 'Government (IIM)';
  if (value.includes('deemed')) return 'Deemed University';
  if (value.includes('university')) return 'University';
  if (value.includes('college')) return 'College';
  return 'Institute';
}

/** Names like "University of Hyderabad" keep their subject in the middle. */
function tidyName(name) {
  return String(name || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .trim();
}

function isUsableName(name) {
  const clean = String(name || '').trim();
  if (clean.length < 4) return false;
  if (/^(name|unnamed|n\/a|na|null)$/i.test(clean)) return false;
  return /[A-Za-z]{3}/.test(clean);
}

/**
 * Turns the raw rows of every source into College-shaped documents.
 * Records are deduplicated by normalised name, keeping the richer row.
 */
export function buildCollegeRecords({ hfRows = [], ugcRows = [] } = {}) {
  const byName = new Map();

  const upsert = (record) => {
    const key = normalizeName(record.name);
    if (!key) return;

    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, record);
      return;
    }

    // Merge: keep whichever source knows more about the institution.
    const richer = { ...existing };
    richer.location = {
      ...existing.location,
      state: existing.location.state || record.location.state,
      city: existing.location.city || record.location.city,
      address: existing.location.address || record.location.address,
      pincode: existing.location.pincode || record.location.pincode
    };
    richer.website = existing.website || record.website;
    richer.foundedYear = existing.foundedYear ?? record.foundedYear;
    richer.studentCount = existing.studentCount ?? record.studentCount;
    richer.sources = [...new Set([...(existing.sources || []), ...(record.sources || [])])];
    richer.sourceKey = existing.sourceKey || record.sourceKey;
    byName.set(key, richer);
  };

  // ── UGC Indian University Dataset ─────────────────────────────────────────
  for (const row of ugcRows) {
    const name = tidyName(row.Name);
    if (!isUsableName(name)) continue;

    const address = String(row.Address || '').replace(/\s+/g, ' ').trim();
    const state = extractState(address);
    if (!state) continue; // outside India / unparseable

    upsert({
      name,
      shortName: buildShortName(name).replace(LICENSE_PREFIXES, ''),
      instituteType: inferInstituteType(name),
      womenOnly: looksWomenOnly(name),
      hostelAvailable: false,
      location: {
        address: address.replace(/\s*-\s*$/, ''),
        district: '',
        city: extractCity(address, state),
        state,
        pincode: extractPincode(address)
      },
      website: String(row.Website || '').trim(),
      foundedYear: null,
      studentCount: null,
      sourceKey: `ugc:${slugify(name)}`,
      sources: ['ugc-indian-universities']
    });
  }

  // ── Hugging Face global-universities (India slice) ────────────────────────
  for (const row of hfRows) {
    const country = String(row.country || '').trim().toLowerCase();
    if (country !== 'india') continue;

    const name = tidyName(row.name);
    if (!isUsableName(name)) continue;

    // No location in the global dataset? Leave it blank instead of inventing
    // one — the UI renders an "India" fallback for display only.
    const state = extractState(row.city || '') || extractState(name) || '';
    const founded = Number.parseInt(row.founded, 10);

    upsert({
      name,
      shortName: buildShortName(name),
      instituteType: inferInstituteType(name, row.type),
      womenOnly: looksWomenOnly(name),
      hostelAvailable: false,
      location: {
        address: '',
        district: '',
        city: tidyName(row.city),
        state,
        pincode: ''
      },
      website: String(row.website || '').trim(),
      foundedYear: Number.isFinite(founded) ? founded : null,
      studentCount: Number.parseInt(row.students, 10) || null,
      sourceKey: `hf:${slugify(row.slug || name)}`,
      sources: ['huggingface-global-universities']
    });
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Shapes a record into a document that matches the College schema. */
export function toCollegeDocument(record, sourceById, syncedAt = new Date()) {
  const primarySourceId = record.sources?.[0] || null;
  const source = primarySourceId ? sourceById.get(primarySourceId) : null;

  return {
    sourceKey: record.sourceKey,
    source: source
      ? {
          id: source.id,
          label: source.label,
          url: source.url,
          license: source.license
        }
      : undefined,
    syncedAt,

    name: record.name,
    shortName: record.shortName,
    instituteType: record.instituteType,
    womenOnly: record.womenOnly,
    hostelAvailable: record.hostelAvailable,

    // Real institutions are not NIRF-ranked in the source data, so they are
    // stored as "unranked" (999) rather than given an invented rank.
    nirfRanking: 999,
    ranking: { nirf: null, stateRank: null },

    location: record.location,
    fees: {},
    placements: {},
    hostel: { boysHostel: false, girlsHostel: false, details: '' },
    courses: [],
    facilities: [],
    aiSummary: '',
    nearbyPlaces: [],
    reviews: [],

    website: record.website || '',
    foundedYear: record.foundedYear ?? undefined,
    studentCount: record.studentCount ?? undefined
  };
}

async function fetchText(url) {
  const response = await axios.get(url, {
    timeout: 60000,
    responseType: 'text',
    transformResponse: [(data) => data],
    headers: {
      'User-Agent': 'UniSphere-OpenDataSync/1.0 (+https://github.com/UniSphere)',
      Accept: 'text/csv,text/plain,*/*'
    }
  });
  return String(response.data || '');
}

/**
 * Downloads every open source and returns normalized college documents.
 * Individual source failures are tolerated as long as one source succeeds.
 */
export async function fetchOpenDatasetRecords({ log = console.log } = {}) {
  const sourceById = new Map(SOURCES.map((source) => [source.id, source]));
  const raw = {};
  const failures = [];

  for (const source of SOURCES) {
    try {
      log(`Fetching ${source.label}…`);
      const text = await fetchText(source.url);
      const rows = parseCsv(text);
      if (rows.length === 0) throw new Error('dataset returned no rows');
      raw[source.id] = rows;
      log(`  → ${rows.length} rows`);
    } catch (error) {
      failures.push({ source: source.id, message: error.message });
      log(`  ! ${source.label} unavailable: ${error.message}`);
    }
  }

  const hfRows = raw['huggingface-global-universities'] || [];
  const ugcRows = raw['ugc-indian-universities'] || [];

  if (hfRows.length === 0 && ugcRows.length === 0) {
    throw new Error(
      `Could not reach any open dataset. ${failures.map((f) => `${f.source}: ${f.message}`).join('; ')}`
    );
  }

  const syncedAt = new Date();
  const records = buildCollegeRecords({ hfRows, ugcRows });
  const maxRecords = Number.parseInt(process.env.DATASET_MAX_RECORDS, 10) || 2500;
  const limited = records.slice(0, maxRecords);

  return {
    colleges: limited.map((record) => toCollegeDocument(record, sourceById, syncedAt)),
    meta: {
      generatedAt: syncedAt.toISOString(),
      sources: SOURCES.map((source) => ({
        id: source.id,
        label: source.label,
        url: source.url,
        license: source.license,
        rows: (raw[source.id] || []).length,
        ok: Boolean(raw[source.id])
      })),
      failures,
      totalRecords: limited.length
    }
  };
}

/** Writes the fetched dataset to disk so seeding can run without network. */
export async function writeSnapshot(payload) {
  await fs.mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
  await fs.writeFile(SNAPSHOT_PATH, JSON.stringify(payload, null, 2), 'utf8');
  return SNAPSHOT_PATH;
}

/** Reads the cached snapshot, or null when it has not been generated yet. */
export async function readSnapshot() {
  try {
    const raw = await fs.readFile(SNAPSHOT_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.colleges)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Uprets the open-data records into MongoDB, keyed by sourceKey so repeat
 * refreshes update instead of duplicating.
 */
export async function upsertColleges(College, colleges, { log = console.log } = {}) {
  if (!Array.isArray(colleges) || colleges.length === 0) {
    return { inserted: 0, updated: 0, total: 0 };
  }

  const operations = colleges.map((doc) => ({
    updateOne: {
      filter: { sourceKey: doc.sourceKey },
      update: { $set: doc, $setOnInsert: { createdAt: new Date() } },
      upsert: true
    }
  }));

  const result = await College.bulkWrite(operations, { ordered: false });
  const inserted = result.upsertedCount || 0;
  const total = result.matchedCount + inserted;
  log(`Upserted ${total} open-data colleges (${inserted} new).`);

  return { inserted, updated: total - inserted, total };
}
