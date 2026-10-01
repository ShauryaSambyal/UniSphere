import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import '../config/env.js';
import { normalizeName } from './datasetService.js';

/**
 * NIRF (National Institutional Ranking Framework, Ministry of Education)
 * ingestion.
 *
 * NIRF publishes, for every ranking edition:
 *
 *   1. Ranking pages — https://www.nirfindia.org/Rankings/<year>/<Category>Ranking.html
 *      Top 100 per category carry Institute ID, name, city, state, score, rank
 *      and parameter scores. Ranks 101-300 are published as alphabetical
 *      "rank-band" lists (101-150, 151-200, 201-300) with no IDs.
 *
 *   2. Data Submitted by Institution (DCS) PDFs —
 *      https://www.nirfindia.org/nirfpdfcdn/<year>/pdf/<Category>/<ID>.pdf
 *      Each contains, per programme level, sanctioned intake, student strength,
 *      placement & higher-studies tables (graduates, placed, median salary of
 *      placed graduates, higher studies) and faculty counts.
 *
 * The ministry publishes both for public consumption (no robots restrictions,
 * no key/token required). This service fetches them politely, caches raw DCS
 * parses under server/data/.nirf-cache, and writes a compact snapshot to
 * server/data/nirf.data.json that seeding and the admin refresh re-use.
 *
 * IMPORTANT — what NIRF does NOT contain: tuition fees, hostel fees or hostel
 * availability. Those are not part of any bulk government open dataset we could
 * find, so the UI states that honestly instead of inventing numbers.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const NIRF_SITE = 'https://www.nirfindia.org';
export const NIRF_SNAPSHOT_PATH = path.join(__dirname, '../data/nirf.data.json');
export const NIRF_CACHE_DIR = path.join(__dirname, '../data/.nirf-cache');

const USER_AGENT =
  'UniSphere-OpenDataSync/1.0 (college directory; respects robots; contact via project repo)';

// When an institute appears in several categories we only need one DCS PDF for
// it. These categories, most student-relevant first, decide which one we fetch.
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

/** Highest NIRF edition available on the site (probes backwards from next year). */
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
      // 404 or unreachable — try the previous year.
    }
    await delay(150);
  }
  throw new Error('Could not find any NIRF ranking edition on nirfindia.org');
}

/**
 * Category pages linked from the edition index (Engineering, Overall, …). The
 * index links are images, so the alt text is the fallback label; the category's
 * own page carries the authoritative title ("Agriculture and Allied Sectors").
 */
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

/** Parses one top-100 page: ID, name, city, state, score, rank, DCS links. */
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

/** Parses one rank-band page ("Institution list in alphabetical order"). */
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

/**
 * Downloads every category's ranked page plus its rank-band pages for one
 * edition and returns flat institute records (one per category appearance).
 */
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

    // The page title is the precise category label ("India Rankings 2025: X").
    const title = html.match(/India Rankings \d{4}:\s*([^<]+)</i)?.[1];
    const label = decodeEntities(title) || cat.label;

    const ranked = parseRankedPage(html, { category: label, pageUrl });

    // Follow the "Rank-band: 101-150" links the top-100 page carries.
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

  // Stable ordering: category priority, then exact rank, then name.
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

// ── DCS PDF parsing ────────────────────────────────────────────────────────

let pdfjsPromise = null;
const loadPdfjs = () => {
  pdfjsPromise ||= import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjsPromise;
};

/**
 * Extracts visual text lines from a PDF. NIRF DCS PDFs are rotated landscape
 * pages, so the viewport transform is applied before clustering items into
 * lines by their y coordinate.
 */
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

/**
 * Parses a placement row such as
 *   2020-21 877 929 2021-22 0 2023-24 714 549 1750000(Seventeen 153
 * The median salary token carries a parenthetical spelled-out amount; the
 * number after "(" on the same line is the higher-studies count.
 */
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

/** Column names, in order, of the "Total Actual Student Strength" table. */
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

/** Parses a DCS PDF into placements, student strength and faculty count. */
export async function parseDcsPdf(buffer) {
  const rawLines = await extractPdfLines(buffer);

  // "UG [4 Years" and "Program(s)]" often land on separate extracted lines.
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

    // Only the student-strength table follows a "UG/PG [n Years ...]" row with
    // 6+ numbers; the intake table above has a different column set and is
    // ignored entirely.
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

const dcsCachePath = (nirfId, cacheDir) => path.join(cacheDir, 'dcs', `${nirfId}.json`);

/**
 * Fetches and parses one DCS PDF, caching the result by NIRF institute ID so
 * repeat sync runs are cheap and resumable.
 */
export async function fetchDcsData(record, { cacheDir = NIRF_CACHE_DIR, log = () => {} } = {}) {
  if (!record?.nirfId || !record?.pdfUrl) return null;
  const cachePath = dcsCachePath(record.nirfId, cacheDir);

  try {
    const cached = JSON.parse(await fs.readFile(cachePath, 'utf8'));
    if (cached?.parsed) return cached.parsed;
  } catch {
    // not cached yet
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
      fetchedAt: new Date().toISOString(),
      parsed
    }),
    'utf8'
  );

  log(`  · DCS ${record.nirfId} (${record.name}): ${parsed.placements.length} programme placement block(s)`);
  return parsed;
}

/** All cached DCS parses, keyed by NIRF ID. */
export async function readDcsCache({ cacheDir = NIRF_CACHE_DIR } = {}) {
  const dir = path.join(cacheDir, 'dcs');
  const byId = new Map();

  try {
    const files = await fs.readdir(dir);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const cached = JSON.parse(await fs.readFile(path.join(dir, file), 'utf8'));
        if (cached?.parsed) byId.set(cached.nirfId, cached);
      } catch {
        // ignore corrupt cache entries
      }
    }
  } catch {
    // no cache yet
  }

  return byId;
}

/** Campus key: normalized institute name + state (city as last resort). */
export const campusKey = (record) =>
  `${normalizeName(record.name)}|${normalizeName(record.state)}|${normalizeName(record.city)}`;

/**
 * Picks one DCS PDF per physical institute: records that share a name are
 * assumed to be the same campus when their state matches. Preference is given
 * to the most student-relevant category, then to the best rank.
 */
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

// ── Snapshot ───────────────────────────────────────────────────────────────

const aggregateLevels = (placements) =>
  placements.map((block) => {
    const rows = [...block.rows].sort((a, b) =>
      String(a.graduatingYear).localeCompare(String(b.graduatingYear))
    );
    // Prefer the most recent year that actually had graduates: brand-new
    // programmes report 0/0 until their first cohort passes out.
    const latest = [...rows].reverse().find((row) => (row.graduating || 0) > 0) || rows[rows.length - 1] || null;
    return { level: block.level, latest };
  }).filter((entry) => entry.latest && (entry.latest.graduating || 0) > 0);

/**
 * Shapes the raw DCS parse into what the UI needs: the latest year per
 * programme level plus aggregates across levels.
 */
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

/**
 * Builds the committed snapshot from ranking records + cached DCS parses.
 * DCS blocks are stored once per campus (name+state) rather than once per
 * category appearance.
 */
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

// ── Matching + enrichment ──────────────────────────────────────────────────

// NIRF city names vs the spellings that appear in directory addresses.
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
  ['jullundur', 'jalandhar']
]);

/**
 * Locality/name folding for matching:
 *   "R.V. College"       → "rv college"
 *   "B.M.S College"      → "bms college"
 *   "IIT Bombay"         → "indian institute of technology bombay"
 * Directory sources spell initials as "R.V.", "RV" or "R V"; NIRF mixes them
 * freely, so both sides are folded before comparison.
 */
export const foldName = (value) => {
  const normalized = normalizeName(value);
  if (!normalized) return '';

  // Join runs of single-letter tokens: "r v college" → "rv college".
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
  ['iitkgp', 'indian institute of technology kharagpur']
]);

/** Expands well-known institute acronyms so "IIT Bombay" can meet NIRF's full name. */
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

const cityAgrees = (a, b) => {
  const left = cityKey(a);
  const right = cityKey(b);
  if (!left || !right) return false;
  if (left === right) return true;
  // "Bengaluru Urban" (district) should agree with "Bengaluru".
  const [short, long] = [left, right].sort((x, y) => x.length - y.length);
  return short.length >= 5 && long.includes(short);
};

const stateAgrees = (a, b) => {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
};

const bandFloor = (band) => {
  const value = Number.parseInt(String(band).split('-')[0], 10);
  return Number.isFinite(value) ? value : null;
};

/**
 * Groups NIRF appearances into candidate campuses (same normalized name) and
 * indexes them by name for matching against directory records.
 */
export function buildNirfIndex(snapshot) {
  const byName = new Map();

  for (const record of snapshot?.institutes || []) {
    const name = foldName(record.name);
    if (!name) continue;
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(record);
  }

  return { byName, snapshot };
}

const candidateMatchesCollege = (college, record, nameVariants) => {
  const recordName = foldName(record.name);
  if (!recordName) return 0;

  let nameScore = 0;
  for (const variant of nameVariants) {
    if (!variant) continue;
    if (variant === recordName) {
      nameScore = Math.max(nameScore, 4);
    } else if (
      (variant.startsWith(recordName) || recordName.startsWith(variant)) &&
      Math.abs(variant.length - recordName.length) <= 20 &&
      cityAgrees(college.location?.city, record.city)
    ) {
      // Prefix containment only when the locality also agrees — otherwise
      // "Indian Institute of Technology" could swallow "…Madras".
      nameScore = Math.max(nameScore, 2);
    }
  }

  if (nameScore === 0) return 0;

  const city = cityAgrees(college.location?.city, record.city);
  const state = stateAgrees(college.location?.state, record.state);
  if (!city && !state) return 0;

  return nameScore + (city ? 4 : 0) + (state ? 2 : 0);
};

/**
 * Finds the NIRF campus (with all its category appearances + DCS dossier) that
 * belongs to a directory college. Ambiguous matches are dropped rather than
 * risking attaching the wrong institute's numbers.
 */
export function matchCollegeToNirf(college, index) {
  const folded = foldName(college.name);
  if (!folded) return null;

  // "IIT Bombay" also registers as "indian institute of technology bombay".
  const nameVariants = [...new Set([folded, expandAcronyms(folded)])];
  const extended = [];

  for (const name of nameVariants) {
    extended.push(...(index.byName.get(name) || []));
  }

  // Containment candidates ("Amity University" vs "Amity University, Noida") —
  // only scanned when the shorter name is long enough to be meaningful.
  for (const name of nameVariants) {
    if (name.length < 12) continue;
    for (const [candidateName, records] of index.byName) {
      if (candidateName.startsWith(name) && Math.abs(candidateName.length - name.length) <= 20) {
        extended.push(...records);
      }
    }
  }

  const scored = extended
    .map((record) => ({ record, score: candidateMatchesCollege(college, record, nameVariants) }))
    .filter((entry) => entry.score > 0);

  if (scored.length === 0) return null;

  const byCampus = new Map();
  for (const entry of scored) {
    const key = `${foldName(entry.record.name)}|${foldName(entry.record.state)}`;
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

  // More than one campus at the top score = ambiguous, skip.
  if (ranked.length > 1 && ranked[0].score === ranked[1].score) return null;

  const winner = ranked[0];
  const nameKey = foldName(winner.records[0].name);
  const stateKey = foldName(winner.records[0].state);

  return {
    records: winner.records,
    dcs: index.snapshot.dcs?.[`${nameKey}|${stateKey}`] || null
  };
}

/**
 * Computes the fields to store on a college from its NIRF campus. Returned as a
 * plain object so the same code serves object documents (seed) and $set
 * patches (database updates).
 */
export function computeNirfFields(college, campus, snapshot) {
  const year = snapshot?.meta?.year || null;
  const sourceUrl = snapshot?.meta?.sourceUrl || NIRF_SITE;

  const ranksByCategory = new Map();
  const bandsByCategory = new Map();

  for (const record of campus.records) {
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
    const aggregated = aggregatePlacements(campus.dcs, { year, pdfUrl: campus.dcs.pdfUrl });
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

/** Applies NIRF fields in place to a plain college document (seed path). */
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

/**
 * Enriches a batch of college documents from the NIRF snapshot. Used by the
 * seed, the dataset sync and the admin refresh; returns how many matched.
 */
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
