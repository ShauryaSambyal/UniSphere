import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import '../config/env.js';
import { normalizeName } from './datasetService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const NIRF_SITE = 'https://www.nirfindia.org';
export const NIRF_SNAPSHOT_PATH = path.join(__dirname, '../data/nirf.data.json');
export const NIRF_CACHE_DIR = path.join(__dirname, '../data/.nirf-cache');

const USER_AGENT =
  'UniSphere-OpenDataSync/1.0 (college directory; respects robots; contact via project repo)';

const CATEGORY_PRIORITY = [
  'engineering',
  'university',
  'college',
  'overall',
  'management',
  'pharmacy',
  'medical',
  'law',
  'architecture',
  'agriculture',
  'dental',
  'research',
  'innovation',
  'statepublicuniversity',
  'openuniversity',
  'skilluniversity',
  'sdg'
];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const decodeEntities = (value) =>
  String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

async function fetchText(url, { attempts = 2 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await axios.get(url, {
        timeout: 90000,
        responseType: 'text',
        transformResponse: [(data) => data],
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*' }
      });
      return String(response.data || '');
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await delay(750 * attempt);
    }
  }
  throw lastError;
}

async function fetchBinary(url, { attempts = 2 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await axios.get(url, {
        timeout: 90000,
        responseType: 'arraybuffer',
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/pdf,*/*' }
      });
      return Buffer.from(response.data);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await delay(750 * attempt);
    }
  }
  throw lastError;
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}

export async function detectLatestYear({ log = () => {} } = {}) {
  const start = new Date().getFullYear() + 1;
  for (let year = start; year >= start - 10; year -= 1) {
    try {
      const html = await fetchText(`${NIRF_SITE}/Rankings/${year}/Ranking.html`, { attempts: 1 });
      if (/Ranking\.html/i.test(html) && html.length > 2000) {
        log(`NIRF edition detected: ${year}`);
        return year;
      }
    } catch {

    }
    await delay(150);
  }
  throw new Error('Could not find any NIRF ranking edition on nirfindia.org');
}

export async function discoverCategories(year) {
  const html = await fetchText(`${NIRF_SITE}/Rankings/${year}/Ranking.html`);
  const labels = new Map();

  for (const match of html.matchAll(/href="([A-Za-z0-9]+Ranking)\.html"[^>]*>\s*<img[^>]*alt="([^"]*)"/g)) {
    const label = decodeEntities(match[2]);
    if (label && !labels.has(match[1])) labels.set(match[1], label);
  }

  const slugs = new Set();
  for (const match of html.matchAll(/href="([A-Za-z0-9]+Ranking)\.html"/g)) {
    slugs.add(match[1]);
  }

  return [...slugs].map((slug) => ({ slug, label: labels.get(slug) || slug }));
}

export function parseRankedPage(html, { category, pageUrl }) {
  const records = [];
  const idMatches = [...html.matchAll(/<td>(IR-[A-Z]-[A-Z]-\d+)<\/td>/g)];

  idMatches.forEach((match, index) => {
    const start = match.index;
    const end = index + 1 < idMatches.length ? idMatches[index + 1].index : html.length;
    const slice = html.slice(start, end);

    const name = decodeEntities(slice.match(/<\/td>\s*<td>([^<]+?)\s*<div/i)?.[1]);
    if (!name) return;

    const tail = slice.match(
      /<\/table>\s*<\/div>\s*<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td>([\d.]+)<\/td>\s*<td>([\d-]+)<\/td>/i
    );
    if (!tail) return;

    const parameterCells = slice.match(/<tbody>\s*<tr>((?:\s*<td>[\d.]+<\/td>){5})\s*<\/tr>/i)?.[1];
    const parameters = parameterCells
      ? (parameterCells.match(/[\d.]+/g) || []).map(Number)
      : [];

    records.push({
      nirfId: match[1],
      name,
      city: decodeEntities(tail[1]),
      state: decodeEntities(tail[2]),
      score: Number.parseFloat(tail[3]) || null,
      rank: Number.parseInt(tail[4], 10) || null,
      band: null,
      category,
      pageUrl,
      pdfUrl: slice.match(/href="(https?:\/\/[^"]+nirfpdfcdn[^"]+\.pdf)"/i)?.[1] || '',
      graphUrl: slice.match(/href="(https?:\/\/[^"]+nirfpdfcdn[^"]+\.jpg)"/i)?.[1] || '',
      parameters: {
        tlr: parameters[0],
        rpc: parameters[1],
        go: parameters[2],
        oi: parameters[3],
        perception: parameters[4]
      }
    });
  });

  return records;
}

export function parseBandPage(html, { category, band, pageUrl }) {
  const records = [];

  for (const match of html.matchAll(
    /<tr>\s*<td>([^<]+)<\/td>\s*<td>([^<]+)<\/td>\s*<td>([^<]+)<\/td>\s*<\/tr>/g
  )) {
    const name = decodeEntities(match[1]);
    if (!name || /^name$/i.test(name)) continue;
    records.push({
      nirfId: null,
      name,
      city: decodeEntities(match[2]),
      state: decodeEntities(match[3]),
      score: null,
      rank: null,
      band,
      category,
      pageUrl,
      pdfUrl: '',
      graphUrl: '',
      parameters: {}
    });
  }

  return records;
}

export async function fetchNirfRankings({ year, log = console.log, categories } = {}) {
  const edition = year || (await detectLatestYear({ log }));
  const cats = categories || (await discoverCategories(edition));
  log(`Scraping NIRF ${edition}: ${cats.length} category page(s)…`);

  const perCategory = await mapWithConcurrency(cats, 3, async (cat) => {
    const slug = String(cat.slug).endsWith('Ranking') ? cat.slug : `${cat.slug}Ranking`;
    const pageUrl = `${NIRF_SITE}/Rankings/${edition}/${slug}.html`;

    let html;
    try {
      html = await fetchText(pageUrl);
    } catch (error) {
      log(`  ! ${cat.label} page unavailable: ${error.message}`);
      return [];
    }

    const title = html.match(/India Rankings \d{4}:\s*([^<]+)</i)?.[1];
    const label = decodeEntities(title) || cat.label;

    const ranked = parseRankedPage(html, { category: label, pageUrl });

    const bandLinks = [
      ...html.matchAll(/href="([A-Za-z0-9]+Ranking\d+)\.html"[^>]*>\s*Rank-band:\s*([\d]+\s*-\s*[\d]+)/g)
    ].map((match) => ({ slug: match[1], band: match[2].replace(/\s+/g, '') }));

    const seen = new Set();
    const bands = [];
    for (const link of bandLinks) {
      if (seen.has(`${link.slug}|${link.band}`)) continue;
      seen.add(`${link.slug}|${link.band}`);

      const bandUrl = `${NIRF_SITE}/Rankings/${edition}/${link.slug}.html`;
      try {
        await delay(150);
        const bandHtml = await fetchText(bandUrl);
        bands.push(...parseBandPage(bandHtml, { category: label, band: link.band, pageUrl: bandUrl }));
      } catch (error) {
        log(`  ! ${label} band ${link.band} unavailable: ${error.message}`);
      }
    }

    log(`  · ${label}: ${ranked.length} ranked, ${bands.length} banded`);
    return [...ranked, ...bands];
  });

  const institutes = perCategory.flat();
  institutes.forEach((record) => { record.edition = edition; });

  const priority = (category) => {
    const index = CATEGORY_PRIORITY.findIndex((prefix) =>
      String(category).toLowerCase().replace(/[^a-z]/g, '').startsWith(prefix)
    );
    return index === -1 ? CATEGORY_PRIORITY.length : index;
  };

  institutes.sort(
    (a, b) =>
      priority(a.category) - priority(b.category) ||
      (a.rank ?? 9999) - (b.rank ?? 9999) ||
      a.name.localeCompare(b.name)
  );

  return { year: edition, institutes };
}

let pdfjsPromise = null;
const loadPdfjs = () => {
  pdfjsPromise ||= import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjsPromise;
};

export async function extractPdfLines(buffer) {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
    verbosity: 0
  }).promise;

  const lines = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    const items = content.items
      .filter((item) => item.str && item.str.trim())
      .map((item) => {
        const transform = pdfjs.Util.transform(viewport.transform, item.transform);
        return { text: item.str, x: transform[4], y: transform[5] };
      })
      .sort((a, b) => a.y - b.y || a.x - b.x);

    let current = null;
    for (const item of items) {
      if (current && Math.abs(current.y - item.y) <= 4) {
        current.parts.push(item);
      } else {
        current = { y: item.y, parts: [item] };
        lines.push(current);
      }
    }
  }

  return lines.map((line) =>
    line.parts
      .sort((a, b) => a.x - b.x)
      .map((part) => part.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

const PLACEMENT_HEADING = /^((?:UG|PG)\s*\[[^\]]+\])\s*:\s*Placement & higher studies/i;
const SECTION_BREAK = /^(Ph\.?D|Financial Resources|PCS Facilities|Faculty Details|Sponsored Research|Consultancy)/i;
const STRENGTH_HEADING = /^Total Actual Student Strength/i;

export function parsePlacementRow(line) {
  const open = line.indexOf('(');
  const head = open >= 0 ? line.slice(0, open) : line;
  const tail = open >= 0 ? line.slice(open + 1) : '';

  const headTokens = head.split(' ').filter(Boolean);
  if (!/^\d{4}-\d{2}$/.test(headTokens[0] || '')) return null;

  const years = [];
  const numbers = [];

  for (const token of headTokens) {
    if (/^\d{4}-\d{2}$/.test(token)) years.push(token);
    else if (/^[\d,]+$/.test(token)) numbers.push(Number(token.replace(/,/g, '')));
    else if (token === '-') numbers.push(null);
    else return null;
  }

  if (open < 0 || numbers.length < 4) return null;

  const medianSalary = numbers[numbers.length - 1];
  const rest = numbers.slice(0, -1);

  let intake;
  let admitted;
  let lateral = null;
  let graduating;
  let placed;

  if (years.length === 3 && rest.length === 5) {
    [intake, admitted, lateral, graduating, placed] = rest;
  } else if (years.length === 2 && rest.length === 4) {
    [intake, admitted, graduating, placed] = rest;
  } else {
    return null;
  }

  const higherStudies = (tail.match(/\d+/g) || []).pop();

  return {
    intakeYear: years[0],
    intake,
    admitted,
    lateral,
    graduatingYear: years[years.length - 1],
    graduating,
    placed,
    medianSalary,
    higherStudies: higherStudies === undefined ? null : Number(higherStudies)
  };
}

const STRENGTH_COLUMNS = [
  'male',
  'female',
  'total',
  'withinState',
  'outsideState',
  'outsideCountry',
  'economicallyBackward',
  'sociallyChallenged',
  'pcsStudents',
  'feeReimbursementState',
  'feeReimbursementInstitution',
  'feeReimbursementPrivate',
  'notReceivingReimbursement'
];

export async function parseDcsPdf(buffer) {
  const rawLines = await extractPdfLines(buffer);

  const lines = [];
  for (const line of rawLines) {
    if (/^Program\(s\)\]/i.test(line) && lines.length > 0) {
      lines[lines.length - 1] = `${lines[lines.length - 1]} ${line}`;
    } else {
      lines.push(line);
    }
  }

  const placements = [];
  const strengthLevels = [];
  let section = 'other';

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (/^Sanctioned \(Approved\) Intake/i.test(line)) {
      section = 'intake';
      continue;
    }
    if (STRENGTH_HEADING.test(line)) {
      section = 'strength';
      continue;
    }

    const heading = line.match(PLACEMENT_HEADING);
    if (heading) {
      section = 'placement';
      const rows = [];
      for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
        const next = lines[cursor];
        if (PLACEMENT_HEADING.test(next) || SECTION_BREAK.test(next)) break;
        const row = parsePlacementRow(next);
        if (row) rows.push(row);
      }
      if (rows.length > 0) placements.push({ level: heading[1], rows });
      continue;
    }

    if (SECTION_BREAK.test(line)) {
      section = 'other';
      continue;
    }

    if (section === 'strength') {
      const level = line.match(/^(UG|PG)\s*\[\s*(\d+)\s*Years?\s*(.*)$/i);
      if (level) {
        const rest = level[3].replace(/Program\(s\)\]/gi, ' ');
        const values = (rest.match(/[\d,]+|-/g) || []).map((token) =>
          token === '-' ? null : Number(token.replace(/,/g, ''))
        );

        if (values.length >= 3 && values[2] != null) {
          const named = {};
          STRENGTH_COLUMNS.forEach((column, columnIndex) => {
            if (values[columnIndex] !== undefined) named[column] = values[columnIndex];
          });
          strengthLevels.push({
            level: `${level[1]} [${level[2]} Years Program(s)]`,
            ...named
          });
        }
      }
    }
  }

  const facultyMatch = rawLines.join('\n').match(/Number of faculty members[^0-9]{0,60}?([\d,]+)/i);
  const facultyCount = facultyMatch ? Number(facultyMatch[1].replace(/,/g, '')) : null;

  const strength = strengthLevels.length
    ? {
        total: strengthLevels.reduce((sum, level) => sum + (level.total || 0), 0),
        male: strengthLevels.reduce((sum, level) => sum + (level.male || 0), 0),
        female: strengthLevels.reduce((sum, level) => sum + (level.female || 0), 0),
        levels: strengthLevels
      }
    : null;

  return { placements, strength, facultyCount };
}

const editionFromPdfUrl = (value) => {
  const match = String(value || '').match(/\/(\d{4})\/pdf\//);
  return match ? Number(match[1]) : null;
};

export const recordEdition = (record) =>
  Number(record?.edition) || editionFromPdfUrl(record?.pdfUrl) || null;

const dcsCachePath = (nirfId, cacheDir, year) =>
  year
    ? path.join(cacheDir, 'dcs', String(year), `${nirfId}.json`)
    : path.join(cacheDir, 'dcs', `${nirfId}.json`);

export async function fetchDcsData(record, { cacheDir = NIRF_CACHE_DIR, log = () => {} } = {}) {
  if (!record?.nirfId || !record?.pdfUrl) return null;
  const year = recordEdition(record);
  const cachePath = dcsCachePath(record.nirfId, cacheDir, year);
  const legacyPath = dcsCachePath(record.nirfId, cacheDir, null);

  for (const candidate of [cachePath, legacyPath]) {
    try {
      const cached = JSON.parse(await fs.readFile(candidate, 'utf8'));
      const cachedYear = Number(cached?.year) || editionFromPdfUrl(cached?.pdfUrl);
      if (cached?.parsed && (!year || !cachedYear || cachedYear === year)) return cached.parsed;
    } catch {

    }
  }

  const buffer = await fetchBinary(record.pdfUrl);
  const parsed = await parseDcsPdf(buffer);

  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(
    cachePath,
    JSON.stringify({
      nirfId: record.nirfId,
      name: record.name,
      category: record.category,
      pdfUrl: record.pdfUrl,
      year,
      fetchedAt: new Date().toISOString(),
      parsed
    }),
    'utf8'
  );

  log(`  · DCS ${record.nirfId} (${record.name}): ${parsed.placements.length} programme placement block(s)`);
  return parsed;
}

export async function readDcsCache({ cacheDir = NIRF_CACHE_DIR, year = null } = {}) {
  const dir = path.join(cacheDir, 'dcs');
  const byId = new Map();

  const readDir = async (target) => {
    let files;
    try {
      files = await fs.readdir(target);
    } catch {
      return;
    }

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const cached = JSON.parse(await fs.readFile(path.join(target, file), 'utf8'));
        if (!cached?.parsed) continue;
        const cachedYear = Number(cached?.year) || editionFromPdfUrl(cached?.pdfUrl);
        if (year && cachedYear && cachedYear !== year) continue;
        const existing = byId.get(cached.nirfId);
        if (existing && (Number(existing.year) || 0) > (cachedYear || 0)) continue;
        byId.set(cached.nirfId, { ...cached, year: cachedYear });
      } catch {

      }
    }
  };

  await readDir(dir);
  try {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) await readDir(path.join(dir, entry.name));
    }
  } catch {

  }

  return byId;
}

export const campusKey = (record) =>
  `${normalizeName(record.name)}|${normalizeName(record.state)}|${normalizeName(record.city)}`;

export function dcsFetchPlan(institutes) {
  const byCampus = new Map();

  for (const record of institutes) {
    if (!record.nirfId || !record.pdfUrl) continue;
    const key = `${foldName(record.name)}|${foldName(record.state)}`;
    const current = byCampus.get(key);

    const priorityOf = (category) => {
      const index = CATEGORY_PRIORITY.findIndex((prefix) =>
        String(category).toLowerCase().replace(/[^a-z]/g, '').startsWith(prefix)
      );
      return index === -1 ? CATEGORY_PRIORITY.length : index;
    };

    const better =
      !current ||
      priorityOf(record.category) < priorityOf(current.category) ||
      (priorityOf(record.category) === priorityOf(current.category) &&
        (record.rank ?? 9999) < (current.rank ?? 9999));

    if (better) byCampus.set(key, record);
  }

  return [...byCampus.values()];
}

const aggregateLevels = (placements) =>
  placements.map((block) => {
    const rows = [...block.rows].sort((a, b) =>
      String(a.graduatingYear).localeCompare(String(b.graduatingYear))
    );

    const latest = [...rows].reverse().find((row) => (row.graduating || 0) > 0) || rows[rows.length - 1] || null;
    return { level: block.level, latest };
  }).filter((entry) => entry.latest && (entry.latest.graduating || 0) > 0);

export function aggregatePlacements(dcs, { year, pdfUrl } = {}) {
  const levels = aggregateLevels(dcs.placements || []).filter((entry) => entry.latest);
  if (levels.length === 0) return null;

  const sum = (pick) =>
    levels.reduce((total, entry) => total + (pick(entry.latest) || 0), 0);

  const placed = sum((row) => row.placed);
  const graduates = sum((row) => row.graduating);
  const primary = levels.find((entry) => /UG/i.test(entry.level)) || levels[0];

  return {
    year,
    levels,
    placed,
    graduates,
    placementRate: graduates > 0 ? Math.round((placed / graduates) * 1000) / 10 : null,
    medianSalary: primary.latest.medianSalary || null,
    primaryLevel: primary.level,
    higherStudies: sum((row) => row.higherStudies),
    students: dcs.strength?.total ?? null,
    sourceUrl: pdfUrl || null
  };
}

export function buildNirfSnapshot({ year, institutes, dcsById, log = console.log }) {
  const dcs = {};
  const plan = dcsFetchPlan(institutes);

  for (const record of plan) {
    const cached = dcsById.get(record.nirfId);
    if (!cached?.parsed) continue;
    dcs[`${foldName(record.name)}|${foldName(record.state)}`] = {
      nirfId: record.nirfId,
      category: record.category,
      pdfUrl: record.pdfUrl,
      year: Number(cached?.year) || recordEdition(record) || year,
      fetchedAt: cached.fetchedAt,
      placements: cached.parsed.placements,
      strength: cached.parsed.strength,
      facultyCount: cached.parsed.facultyCount
    };
  }

  const dcsCount = Object.keys(dcs).length;
  log(`Snapshot: ${institutes.length} ranking records, ${dcsCount} campus DCS dossiers.`);

  return {
    meta: {
      year,
      generatedAt: new Date().toISOString(),
      sourceUrl: `${NIRF_SITE}/Rankings/${year}/Ranking.html`,
      site: NIRF_SITE,
      label: `MoE National Institute Ranking Framework ${year}`,
      license: 'Government of India, Ministry of Education — published for public use',
      counts: {
        records: institutes.length,
        ranked: institutes.filter((record) => record.rank).length,
        banded: institutes.filter((record) => record.band).length,
        dcs: dcsCount
      }
    },
    institutes,
    dcs
  };
}

export async function writeNirfSnapshot(snapshot) {
  await fs.mkdir(path.dirname(NIRF_SNAPSHOT_PATH), { recursive: true });
  await fs.writeFile(NIRF_SNAPSHOT_PATH, JSON.stringify(snapshot), 'utf8');
  return NIRF_SNAPSHOT_PATH;
}

export async function readNirfSnapshot() {
  try {
    const parsed = JSON.parse(await fs.readFile(NIRF_SNAPSHOT_PATH, 'utf8'));
    if (!Array.isArray(parsed?.institutes)) return null;
    return parsed;
  } catch {
    return null;
  }
}

const CITY_ALIASES = new Map([
  ['bangalore', 'bengaluru'],
  ['mysore', 'mysuru'],
  ['mangalore', 'mangaluru'],
  ['hubli', 'hubballi'],
  ['gulbarga', 'kalaburagi'],
  ['belgaum', 'belagavi'],
  ['bombay', 'mumbai'],
  ['madras', 'chennai'],
  ['calcutta', 'kolkata'],
  ['pondicherry', 'puducherry'],
  ['gurgaon', 'gurugram'],
  ['allahabad', 'prayagraj'],
  ['benaras', 'varanasi'],
  ['banaras', 'varanasi'],
  ['trivandrum', 'thiruvananthapuram'],
  ['cochin', 'kochi'],
  ['ernakulam', 'kochi'],
  ['vizag', 'visakhapatnam'],
  ['trichy', 'tiruchirappalli'],
  ['simla', 'shimla'],
  ['cawnpore', 'kanpur'],
  ['jullundur', 'jalandhar'],
  ['bangaloreurban', 'bengaluru'],
  ['sonepat', 'sonipat'],
  ['kanchipuram', 'kancheepuram'],
  ['calicut', 'kozhikode']
]);

export const foldName = (value) => {
  const normalized = normalizeName(value);
  if (!normalized) return '';

  const joined = normalized.replace(/(?:(?:\b[a-z]\b)\s*){2,}/g, (run) => `${run.trim().replace(/\s+/g, '')} `);

  return joined.trim();
};

const ACRONYM_EXPANSIONS = new Map([
  ['iit', 'indian institute of technology'],
  ['iits', 'indian institute of technology'],
  ['nit', 'national institute of technology'],
  ['nits', 'national institute of technology'],
  ['iiit', 'international institute of information technology'],
  ['iiits', 'international institute of information technology'],
  ['iim', 'indian institute of management'],
  ['iims', 'indian institute of management'],
  ['iisc', 'indian institute of science'],
  ['iiser', 'indian institute of science education and research'],
  ['nift', 'national institute of fashion technology'],
  ['iitr', 'indian institute of technology roorkee'],
  ['iitb', 'indian institute of technology bombay'],
  ['iitm', 'indian institute of technology madras'],
  ['iitd', 'indian institute of technology delhi'],
  ['iitk', 'indian institute of technology kanpur'],
  ['iitkgp', 'indian institute of technology kharagpur'],
  ['bhu', 'banaras hindu university'],
  ['ism', 'indian school of mines'],
  ['bits', 'birla institute of technology and science'],
  ['nsut', 'netaji subhas university of technology'],
  ['iiith', 'international institute of information technology hyderabad']
]);

export const expandAcronyms = (foldedName) => {
  const tokens = foldedName.split(' ').filter(Boolean);
  const expanded = tokens.map((token) => ACRONYM_EXPANSIONS.get(token) || token);
  return expanded.join(' ');
};

const cityKey = (value) => {
  const first = String(value || '').split(',')[0].trim().toLowerCase();
  const clean = first.replace(/[^a-z0-9]+/g, '');
  return CITY_ALIASES.get(clean) || clean;
};

const nameTokens = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean);

const tokensOverlap = (a, b) => {
  const left = nameTokens(a);
  const right = nameTokens(b);
  if (!left.length || !right.length) return false;
  const [short, long] = left.length <= right.length ? [left, right] : [right, left];
  if (short.join('').length < 3) return false;
  for (let index = 0; index + short.length <= long.length; index += 1) {
    if (short.every((token, offset) => token === long[index + offset])) return true;
  }
  return false;
};

export const cityAgrees = (a, b) => {
  const left = cityKey(a);
  const right = cityKey(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (nameSimilarity(left, right) >= 0.85) return true;
  return tokensOverlap(String(a || '').split(',')[0], String(b || '').split(',')[0]);
};

export const stateAgrees = (a, b) => {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return false;
  if (left === right) return true;
  return tokensOverlap(a, b);
};

const bandFloor = (band) => {
  const value = Number.parseInt(String(band).split('-')[0], 10);
  return Number.isFinite(value) ? value : null;
};

const STOP_TOKENS = new Set([
  'institute', 'college', 'university', 'of', 'and', 'the', 'for', 'at', 'deemed', 'autonomous',
  'affiliated', 'national', 'india', 'indian', 'government', 'govt', 'polytechnic', 'school',
  'department', 'faculty', 'campus', 'centre', 'center', 'society', 'trust', 'education',
  'higher', 'science', 'sciences', 'arts', 'art'
]);

const TOKEN_SIMILARITY_FLOOR = 0.7;
const A_SIDE_SKIP_SIMILARITY = 0.91;
const B_SIDE_SKIP_SIMILARITY = 0.85;
const HIGH_CONFIDENCE_SIMILARITY = 0.95;

const editDistanceWithin = (left, right, maxDistance) => {
  if (left === right) return true;
  if (Math.abs(left.length - right.length) > maxDistance) return false;
  const previous = new Array(right.length + 1);
  const current = new Array(right.length + 1);
  for (let index = 0; index <= right.length; index += 1) previous[index] = index;
  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    let rowMin = current[0];
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      if (current[j] < rowMin) rowMin = current[j];
    }
    if (rowMin > maxDistance) return false;
    for (let j = 0; j <= right.length; j += 1) previous[j] = current[j];
  }
  return previous[right.length] <= maxDistance;
};

const tokenMatches = (left, right) => {
  if (left === right) return true;
  const minLen = Math.min(left.length, right.length);
  const maxLen = Math.max(left.length, right.length);
  if (minLen <= 3 && (left.startsWith(right) || right.startsWith(left))) return true;
  if (minLen >= 4 && (left.includes(right) || right.includes(left))) return true;
  if (editDistanceWithin(left, right, maxLen >= 8 ? 2 : 1)) return true;
  return nameSimilarity(left, right) >= TOKEN_SIMILARITY_FLOOR;
};

const isSubsequence = (pattern, value) => {
  let index = 0;
  for (const char of value) {
    if (char === pattern[index]) index += 1;
    if (index === pattern.length) return true;
  }
  return false;
};

const INITIALISM_MAX = 8;

const markInitialisms = (sideTokens, otherTokens, covered) => {
  const targets = new Set([...sideTokens, ...otherTokens]);
  const maxWindow = Math.min(INITIALISM_MAX, sideTokens.length);
  for (let size = 2; size <= maxWindow; size += 1) {
    for (let start = 0; start + size <= sideTokens.length; start += 1) {
      let initials = '';
      for (let index = start; index < start + size; index += 1) initials += sideTokens[index][0];
      if (initials.length < 2 || !targets.has(initials)) continue;
      for (let index = start; index < start + size; index += 1) covered[index] = true;
      let targetIndex = sideTokens.indexOf(initials);
      while (targetIndex >= start && targetIndex < start + size && targetIndex >= 0) {
        targetIndex = sideTokens.indexOf(initials, targetIndex + 1);
      }
      if (targetIndex >= 0) covered[targetIndex] = true;
    }
  }
};

const requiredToken = (token, locSet) =>
  !STOP_TOKENS.has(token) && token.length > 3 && !locSet.has(token);

const sideCovered = (sideTokens, otherTokens, locSet) => {
  const covered = sideTokens.map(() => false);
  let pending = false;
  for (let index = 0; index < sideTokens.length; index += 1) {
    const token = sideTokens[index];
    if (!requiredToken(token, locSet)) {
      covered[index] = true;
      continue;
    }
    if (otherTokens.some((other) => tokenMatches(token, other))) {
      covered[index] = true;
      continue;
    }
    pending = true;
  }
  if (!pending) return true;

  const shortOther = otherTokens.filter((token) => token.length >= 2 && token.length <= 3);
  if (shortOther.length) {
    for (let index = 0; index < sideTokens.length; index += 1) {
      if (covered[index]) continue;
      if (shortOther.some((short) => isSubsequence(short, sideTokens[index]))) covered[index] = true;
    }
  }

  if (!covered.every(Boolean)) markInitialisms(sideTokens, otherTokens, covered);

  return covered.every(Boolean);
};

const bigramCache = new Map();

const bigramsOf = (value) => {
  let cached = bigramCache.get(value);
  if (!cached) {
    const set = new Set();
    for (let index = 0; index < value.length - 1; index += 1) set.add(value.slice(index, index + 2));
    cached = set;
    if (bigramCache.size < 20000) bigramCache.set(value, cached);
  }
  return cached;
};

export const nameSimilarity = (left, right) => {
  if (!left || !right) return 0;
  const shorter = Math.min(left.length, right.length);
  const longer = Math.max(left.length, right.length);
  if (shorter === 0) return 0;
  if (shorter / longer < 0.6) return 0;

  const leftGrams = bigramsOf(left);
  const rightGrams = bigramsOf(right);
  let shared = 0;
  for (const gram of leftGrams) if (rightGrams.has(gram)) shared += 1;
  return (2 * shared) / (leftGrams.size + rightGrams.size);
};

const foldedNames = new WeakMap();

const foldedRecordName = (record) => {
  let value = foldedNames.get(record);
  if (value === undefined) {
    value = foldName(record.name);
    foldedNames.set(record, value);
  }
  return value;
};

export function buildNirfIndex(snapshot) {
  const byName = new Map();
  const byFirstToken = new Map();
  const dcsById = new Map();

  for (const record of snapshot?.institutes || []) {
    const name = foldedRecordName(record);
    if (!name) continue;
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(record);

    const firstToken = name.split(' ')[0];
    if (firstToken) {
      if (!byFirstToken.has(firstToken)) byFirstToken.set(firstToken, []);
      byFirstToken.get(firstToken).push(record);
    }
  }

  const bestEdition = (dossier) => Number(dossier?.year) || 0;
  for (const dossier of Object.values(snapshot?.dcs || {})) {
    if (!dossier?.nirfId) continue;
    const current = dcsById.get(dossier.nirfId);
    if (!current || bestEdition(dossier) > bestEdition(current)) {
      dcsById.set(dossier.nirfId, dossier);
    }
  }

  return { byName, byFirstToken, dcsById, snapshot };
}

export const candidateMatchesCollege = (college, record, nameVariants) => {
  const recordName = foldedRecordName(record);
  if (!recordName) return 0;

  const city = cityAgrees(college.location?.city, record.city);
  const state = stateAgrees(college.location?.state, record.state);
  const hasLocation = Boolean(cityKey(college.location?.city) || normalizeName(college.location?.state));

  const collegeCity = nameTokens(college.location?.city);
  const recordCity = nameTokens(record.city);
  const collegeState = nameTokens(college.location?.state);
  const recordState = nameTokens(record.state);
  const collegeNameTokens = nameTokens(college.name);
  const recordNameTokens = nameTokens(recordName);
  const locationTokens = new Set([
    ...collegeCity,
    ...collegeState,
    ...recordCity,
    ...recordState
  ]);
  const conflictingCityMention = Boolean(
    !city &&
      collegeCity.length &&
      recordCity.length &&
      collegeCity.every((token) => collegeNameTokens.includes(token)) &&
      !recordCity.every((token) => collegeNameTokens.includes(token))
  );
  const bothCities = collegeCity.length > 0 && recordCity.length > 0;
  const nameCityLink = Boolean(
    (recordCity.length && recordCity.every((token) => collegeNameTokens.includes(token))) ||
      (collegeCity.length && collegeCity.every((token) => recordNameTokens.includes(token)))
  );

  let nameScore = 0;
  let exact = false;
  for (const variant of nameVariants) {
    if (!variant) continue;
    if (variant === recordName) {
      nameScore = Math.max(nameScore, 4);
      exact = true;
      continue;
    }

    if (conflictingCityMention) continue;

    const prefix =
      (variant.startsWith(recordName) || recordName.startsWith(variant)) &&
      Math.abs(variant.length - recordName.length) <= 20;
    if (prefix && (city || state)) {
      nameScore = Math.max(nameScore, 2);
      continue;
    }

    if (hasLocation) {
      const similarity = nameSimilarity(variant, recordName);
      const bandOk = similarity >= 0.85 || (similarity >= 0.75 && city);
      if (!bandOk) continue;
      if (bothCities && !city && !nameCityLink && similarity < HIGH_CONFIDENCE_SIMILARITY) continue;
      const collegeTokens = nameTokens(variant);
      if (similarity < A_SIDE_SKIP_SIMILARITY && !sideCovered(collegeTokens, recordNameTokens, locationTokens)) {
        continue;
      }
      if (similarity < B_SIDE_SKIP_SIMILARITY && !sideCovered(recordNameTokens, collegeTokens, locationTokens)) {
        continue;
      }
      nameScore = Math.max(nameScore, 2);
    }
  }

  if (nameScore === 0) return 0;
  if (hasLocation && !city && !state) return 0;
  if (!hasLocation && !exact) return 0;

  return nameScore + (city ? 4 : 0) + (state ? 2 : 0);
};

export function matchCollegeToNirf(college, index) {
  const folded = foldName(college.name);
  if (!folded) return null;

  const nameVariants = [...new Set([folded, expandAcronyms(folded)])];
  const seen = new Set();
  const extended = [];
  const collect = (records) => {
    for (const record of records || []) {
      if (seen.has(record)) continue;
      seen.add(record);
      extended.push(record);
    }
  };

  for (const name of nameVariants) {
    collect(index.byName.get(name));
    const firstToken = name.split(' ')[0];
    collect(index.byFirstToken?.get(firstToken));
  }

  const scored = extended
    .map((record) => ({ record, score: candidateMatchesCollege(college, record, nameVariants) }))
    .filter((entry) => entry.score > 0);

  if (scored.length === 0) return null;

  const byCampus = new Map();
  for (const entry of scored) {
    const key = `${foldedRecordName(entry.record)}|${foldName(entry.record.state)}`;
    const current = byCampus.get(key);
    if (!current || entry.score > current.score) {
      byCampus.set(key, { score: entry.score, records: [entry.record] });
    } else if (entry.score === current.score) {
      current.records.push(entry.record);
    }
  }

  const ranked = [...byCampus.entries()]
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => b.score - a.score);

  while (ranked.length > 1 && ranked[0].score === ranked[1].score) {
    const [leftName, leftState] = ranked[0].key.split('|');
    const [rightName, rightState] = ranked[1].key.split('|');
    const sameState = leftState === rightState;
    const sharedId = ranked[0].records.some(
      (record) =>
        record.nirfId && ranked[1].records.some((other) => other.nirfId === record.nirfId)
    );
    const sameCampus = sameState && (sharedId || nameSimilarity(leftName, rightName) >= 0.8);
    if (!sameCampus) return null;

    ranked[0].records.push(...ranked[1].records);
    ranked.splice(1, 1);
  }

  const winner = ranked[0];

  let dcs = null;
  for (const record of winner.records) {
    const key = `${foldedRecordName(record)}|${foldName(record.state)}`;
    const byKey = index.snapshot.dcs?.[key];
    if (byKey) { dcs = byKey; break; }
  }
  if (!dcs) {
    for (const record of winner.records) {
      const byId = record.nirfId ? index.dcsById?.get(record.nirfId) : null;
      if (byId) { dcs = byId; break; }
    }
  }

  return { records: winner.records, dcs };
}

export function computeNirfFields(college, campus, snapshot) {
  const recordYear = (record) => Number(record.edition) || Number(snapshot?.meta?.year) || 0;
  const years = campus.records.map(recordYear).filter((value) => value > 0);
  const year = (years.length ? Math.max(...years) : null) || snapshot?.meta?.year || null;
  const latestRecords = year ? campus.records.filter((record) => recordYear(record) === year) : campus.records;
  const sourceUrl = snapshot?.meta?.sourceUrl || NIRF_SITE;

  const ranksByCategory = new Map();
  const bandsByCategory = new Map();

  for (const record of latestRecords) {
    if (record.rank) {
      const current = ranksByCategory.get(record.category);
      if (!current || record.rank < current.rank) {
        ranksByCategory.set(record.category, {
          category: record.category,
          rank: record.rank,
          score: record.score ?? null
        });
      }
    }
    if (record.band && !bandsByCategory.has(record.category)) {
      bandsByCategory.set(record.category, { category: record.category, band: record.band });
    }
  }

  const ranks = [...ranksByCategory.values()].sort((a, b) => a.rank - b.rank);
  const bands = [...bandsByCategory.values()].sort(
    (a, b) => (bandFloor(a.band) ?? 9999) - (bandFloor(b.band) ?? 9999)
  );
  const best = ranks[0] || null;
  const bestBand = bands[0] || null;
  const derivedRank = best?.rank ?? bandFloor(bestBand?.band || '');
  const currentRank = Number(college.nirfRanking);

  const fields = {
    nirf: {
      year,
      ranks,
      bands,
      bestRank: best?.rank ?? null,
      bestCategory: best?.category ?? null,
      sourceUrl
    }
  };

  if (derivedRank && (!Number.isFinite(currentRank) || currentRank > derivedRank)) {
    fields.nirfRanking = derivedRank;
  }

  if (campus.dcs) {
    const dossierYear = Number(campus.dcs.year) || year;
    const aggregated = aggregatePlacements(campus.dcs, { year: dossierYear, pdfUrl: campus.dcs.pdfUrl });
    if (aggregated) fields.placementsNirf = aggregated;
    if (campus.dcs.strength) {
      fields.studentStrength = campus.dcs.strength;
      if (!college.studentCount && campus.dcs.strength.total) {
        fields.studentCount = campus.dcs.strength.total;
      }
    }
    if (campus.dcs.facultyCount) fields.facultyCount = campus.dcs.facultyCount;
  }

  return fields;
}

export function applyNirfToCollege(college, campus, snapshot) {
  const fields = computeNirfFields(college, campus, snapshot);
  if (fields.nirfRanking) college.nirfRanking = fields.nirfRanking;
  college.nirf = fields.nirf;
  if (fields.placementsNirf) {
    college.placements = { ...(college.placements || {}), nirf: fields.placementsNirf };
  }
  if (fields.studentStrength) college.studentStrength = fields.studentStrength;
  if (fields.studentCount) college.studentCount = fields.studentCount;
  if (fields.facultyCount) college.facultyCount = fields.facultyCount;
}

export function applyNirfSnapshot(colleges, snapshot) {
  if (!snapshot) return { matched: 0, total: colleges.length };

  const index = buildNirfIndex(snapshot);
  let matched = 0;

  for (const college of colleges) {
    const campus = matchCollegeToNirf(college, index);
    if (!campus) continue;
    applyNirfToCollege(college, campus, snapshot);
    matched += 1;
  }

  return { matched, total: colleges.length };
}

export default {
  detectLatestYear,
  discoverCategories,
  fetchNirfRankings,
  fetchDcsData,
  readDcsCache,
  dcsFetchPlan,
  buildNirfSnapshot,
  writeNirfSnapshot,
  readNirfSnapshot,
  buildNirfIndex,
  matchCollegeToNirf,
  computeNirfFields,
  applyNirfToCollege,
  applyNirfSnapshot,
  aggregatePlacements
};
