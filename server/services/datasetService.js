import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SNAPSHOT_PATH = path.join(__dirname, '../data/colleges.open-data.json');

export const SOURCES = [
  {
    id: 'ugc-indian-universities',
    label: 'GitHub · UGC Indian University Dataset',
    url: 'https://raw.githubusercontent.com/Bluff-0/UGC_Indian-University-Dataset/master/UGC%20Universities.csv',
    license: 'UGC public university listing',
    country: 'India'
  },
  {
    id: 'huggingface-global-universities',
    label: 'Hugging Face · DropTheHQ/global-universities',
    url: 'https://huggingface.co/datasets/DropTheHQ/global-universities/resolve/main/global-universities.csv',
    license: 'Open dataset published on Hugging Face',
    country: 'India'
  },
  {
    id: 'aicte-indian-colleges',
    label: 'GitHub · AICTE Indian Colleges Dataset',
    url: 'https://github.com/anburocky3/indian-colleges-data',
    license: 'AICTE approved-institution listing (public)',
    country: 'India',

    files: [
      'andaman-and-nicobar-islands', 'andhra-pradesh', 'arunachal-pradesh',
      'assam', 'bihar', 'chandigarh', 'chhattisgarh', 'dadra-and-nagar-haveli',
      'daman-and-diu', 'delhi', 'goa', 'gujarat', 'haryana', 'himachal-pradesh',
      'jammu-and-kashmir', 'jharkhand', 'karnataka', 'kerala', 'madhya-pradesh',
      'maharashtra', 'manipur', 'meghalaya', 'mizoram', 'nagaland', 'odisha',
      'puducherry', 'punjab', 'rajasthan', 'sikkim', 'tamil-nadu', 'telangana',
      'tripura', 'uttar-pradesh', 'uttarakhand', 'west-bengal'
    ].map(slug => `https://raw.githubusercontent.com/anburocky3/indian-colleges-data/main/data/states/${slug}.json`)
  }
];

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

const ADDRESS_STOPWORDS = new Set([
  'po', 'p', 'post', 'pin', 'pincode', 'dist', 'district', 'campus', 'road',
  'rd', 'via', 'city', 'university', 'college', 'nagar', 'the', 'and', 'near',
  'opp', 'off', 'new', 'old', 'south', 'north', 'east', 'west', 'null', 'nil',
  'na', 'none', 'nit', 'iit', 'iim', 'iisc', 'iiser', 'village', 'vill', 'taluk',
  'state', 'po.', 'p.s', 'p.o'
]);

const STATE_ABBREVIATION = /^[A-Z](\.[A-Z])+\.?$/i;

const LICENSE_PREFIXES = /^(university|college|institute|school)\s+of\s+/i;

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

export function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function buildShortName(name) {
  const filler = new Set(['of', 'and', 'the', 'for', 'in', 'at', 'to', 'a', 'an', '&']);
  const words = String(name || '')
    .replace(/[^A-Za-z0-9\s&]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const first = words[0] || '';
  const notAnAcronym = new Set(['THE', 'AND', 'OF', 'A', 'AN', 'SRI', 'SHRI', 'ST']);
  if (/^[A-Z][A-Z0-9&]{1,5}$/.test(first) && !notAnAcronym.has(first)) {
    return first;
  }

  const initials = words
    .filter((word) => !filler.has(word.toLowerCase()))
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  if (initials.length >= 2) return initials.slice(0, 8);
  return String(name || 'COLLEGE').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'COLLEGE';
}

export function extractState(address) {
  const haystack = String(address || '').toLowerCase();
  if (!haystack) return '';
  return INDIAN_STATES.find((state) => haystack.includes(state.toLowerCase())) || '';
}

const normalizeText = (value) =>
  String(value || '')
    .replace(/[\u00c2\u00a0\u200b]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const MINOR_WORDS = new Set(['and', 'of', 'in', 'for', 'to', 'the', 'a', 'an', 'at', 'on', 'by']);

const capitaliseToken = (word) => {
  const lower = word.toLowerCase();
  const letter = lower.match(/[a-z]/);
  if (!letter) return lower;

  const index = lower.indexOf(letter[0]);
  return lower.slice(0, index) + letter[0].toUpperCase() + lower.slice(index + 1);
};

const smartTitleCase = (value) =>
  normalizeText(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLowerCase();

      if (index > 0 && MINOR_WORDS.has(lower)) return lower;

      const vowels = (word.match(/[AEIOUYaeiouy]/g) || []).length;

      if (word.length <= 6 && vowels <= 1) return word.toUpperCase();

      return capitaliseToken(word);
    })
    .join(' ');

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}

function cleanAddressToken(token) {
  return String(token || '')
    .replace(/^[.\-()]+|[.\-()]+$/g, '')
    .replace(/^(dist|dt|po|post|vill|village|via)\.?[\s.-]*/i, '')
    .trim();
}

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

    .filter((token) => /[aeiou]/i.test(token));

  if (tokens.length === 0) return '';

  return smartTitleCase(tokens[tokens.length - 1]);
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

function tidyName(name) {
  return normalizeText(name)
    .replace(/["']/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/^[\s,;.-]+|[\s,;.-]+$/g, '')
    .trim();
}

function isUsableName(name) {
  const clean = String(name || '').trim();
  if (clean.length < 4) return false;
  if (/^(name|unnamed|n\/a|na|null)$/i.test(clean)) return false;
  return /[A-Za-z]{3}/.test(clean);
}

export function buildCollegeRecords({ hfRows = [], ugcRows = [], aicteRows = [] } = {}) {
  const byKey = new Map();

  const upsert = (record) => {
    const key = `${normalizeName(record.name)}|${normalizeName(record.location?.state || '')}`;
    if (!normalizeName(record.name)) return;

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, record);
      return;
    }

    const merged = { ...existing };
    merged.location = {
      ...existing.location,
      state: existing.location.state || record.location.state,
      city: existing.location.city || record.location.city,
      district: existing.location.district || record.location.district,
      address: existing.location.address || record.location.address,
      pincode: existing.location.pincode || record.location.pincode
    };
    merged.website = existing.website || record.website;
    merged.foundedYear = existing.foundedYear ?? record.foundedYear;
    merged.studentCount = existing.studentCount ?? record.studentCount;
    merged.affiliatedTo = existing.affiliatedTo || record.affiliatedTo;
    merged.aicteId = existing.aicteId || record.aicteId;
    merged.womenOnly = Boolean(existing.womenOnly || record.womenOnly);
    merged.courses = [...new Set([...(existing.courses || []), ...(record.courses || [])])].slice(0, 12);
    merged.programmes = [...new Set([...(existing.programmes || []), ...(record.programmes || [])])].slice(0, 25);
    merged.sources = [...new Set([...(existing.sources || []), ...(record.sources || [])])];
    merged.sourceKey = existing.sourceKey || record.sourceKey;
    byKey.set(key, merged);
  };

  for (const row of ugcRows) {
    const name = tidyName(row.Name);
    if (!isUsableName(name)) continue;

    const address = String(row.Address || '').replace(/\s+/g, ' ').trim();
    const state = extractState(address);
    if (!state) continue;

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
      courses: [],
      programmes: [],
      affiliatedTo: '',
      sourceKey: `ugc:${slugify(name)}`,
      sources: ['ugc-indian-universities']
    });
  }

  for (const row of hfRows) {
    const country = String(row.country || '').trim().toLowerCase();
    if (country !== 'india') continue;

    const name = tidyName(row.name);
    if (!isUsableName(name)) continue;

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
      courses: [],
      programmes: [],
      affiliatedTo: '',
      sourceKey: `hf:${slugify(row.slug || name)}`,
      sources: ['huggingface-global-universities']
    });
  }

  for (const row of aicteRows) {
    const name = tidyName(row.institute_name);
    if (!isUsableName(name)) continue;

    const programmes = Array.isArray(row.programmes) ? row.programmes : [];

    const grantsDegrees =
      programmes.length === 0 || programmes.some((p) => /GRADUATE/i.test(p.level || ''));
    if (!grantsDegrees) continue;

    const district = smartTitleCase(row.district || '');
    const address = String(row.address || '').replace(/\s+/g, ' ').trim();
    const state = tidyName(row.state) || extractState(address);

    upsert({
      name: smartTitleCase(name),
      shortName: buildShortName(name),
      instituteType: tidyName(row.institution_type) || inferInstituteType(name),
      womenOnly: String(row.women || '').trim().toUpperCase() === 'Y',
      hostelAvailable: false,
      location: {
        address,
        district,

        city: district || extractCity(address, state),
        state,
        pincode: extractPincode(address)
      },
      website: '',
      foundedYear: null,
      studentCount: null,
      courses: aicteStreams(programmes),
      programmes: aicteBranches(programmes),
      affiliatedTo: smartTitleCase(row.university || ''),
      aicteId: row.aicte_id || undefined,
      sourceKey: `aicte:${slugify(row.aicte_id || name)}`,
      sources: ['aicte-indian-colleges']
    });
  }

  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

const NOT_A_COURSE = /^(1st|2nd|3rd|first|second|third)\s+shift$|^shift$|^n\/?a$|^\d+$|^-+$/i;

function aicteStreams(programmes) {
  const names = new Set();

  for (const programme of programmes || []) {
    const stream = tidyName(programme.programme);
    if (!stream || stream.length < 3 || NOT_A_COURSE.test(stream)) continue;
    names.add(smartTitleCase(stream));
  }

  return [...names].sort().slice(0, 8);
}

function aicteBranches(programmes) {
  const byKey = new Map();

  for (const programme of programmes || []) {
    const branch = tidyName(programme.course);
    if (!branch || branch.length < 3 || NOT_A_COURSE.test(branch)) continue;

    const key = branch.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, smartTitleCase(key));
  }

  return [...byKey.values()].sort().slice(0, 25);
}

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

    nirfRanking: 999,
    ranking: { nirf: null, stateRank: null },

    location: record.location,
    fees: {},
    placements: {},
    hostel: { boysHostel: false, girlsHostel: false, details: '' },
    courses: record.courses || [],
    programmes: record.programmes || [],
    facilities: [],
    aicteId: record.aicteId || undefined,
    affiliatedTo: record.affiliatedTo || '',
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
      Accept: 'text/csv,text/plain,application/json,*/*'
    }
  });
  return String(response.data || '');
}

export async function fetchOpenDatasetRecords({ log = console.log } = {}) {
  const sourceById = new Map(SOURCES.map((source) => [source.id, source]));
  const raw = {};
  const failures = [];

  const loadSource = async (source) => {
    log(`Fetching ${source.label}…`);

    if (!source.files) {
      const rows = parseCsv(await fetchText(source.url));
      if (rows.length === 0) throw new Error('dataset returned no rows');
      log(`  → ${rows.length} rows`);
      return rows;
    }

    let failed = 0;
    const perFile = await mapWithConcurrency(source.files, 5, async (url) => {
      try {
        const parsed = JSON.parse(await fetchText(url));
        return Array.isArray(parsed) ? parsed : parsed?.institutions || [];
      } catch {
        failed += 1;
        return [];
      }
    });

    const rows = perFile.flat();
    if (rows.length === 0) throw new Error('dataset returned no rows');
    log(`  → ${rows.length} rows from ${source.files.length - failed}/${source.files.length} files`);
    return rows;
  };

  for (const source of SOURCES) {
    try {
      raw[source.id] = await loadSource(source);
    } catch (error) {
      failures.push({ source: source.id, message: error.message });
      log(`  ! ${source.label} unavailable: ${error.message}`);
    }
  }

  const hfRows = raw['huggingface-global-universities'] || [];
  const ugcRows = raw['ugc-indian-universities'] || [];
  const aicteRows = raw['aicte-indian-colleges'] || [];

  if (hfRows.length === 0 && ugcRows.length === 0 && aicteRows.length === 0) {
    throw new Error(
      `Could not reach any open dataset. ${failures.map((f) => `${f.source}: ${f.message}`).join('; ')}`
    );
  }

  const syncedAt = new Date();
  const records = buildCollegeRecords({ hfRows, ugcRows, aicteRows });
  const maxRecords = Number.parseInt(process.env.DATASET_MAX_RECORDS, 10) || 15000;
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

export async function writeSnapshot(payload) {
  await fs.mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
  await fs.writeFile(SNAPSHOT_PATH, JSON.stringify(payload), 'utf8');
  return SNAPSHOT_PATH;
}

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
