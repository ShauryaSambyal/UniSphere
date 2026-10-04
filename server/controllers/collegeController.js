import College from '../models/College.js';
import Review from '../models/Review.js';
import NearbyPlace from '../models/NearbyPlace.js';
import { generateCollegeSummary } from '../services/geminiService.js';
import { getNearbyPlacesForAllTypes } from '../services/placesService.js';
import { syncCollegeToVectorDb, deleteCollegeFromVectorDb } from '../services/chromaService.js';
import { syncCollegeToSearch, deleteCollegeFromSearch, searchColleges } from '../services/searchService.js';
import {
  fetchOpenDatasetRecords,
  readSnapshot,
  upsertColleges,
  writeSnapshot
} from '../services/datasetService.js';
import { readNirfSnapshot, applyNirfSnapshot } from '../services/nirfService.js';

export async function getAllColleges(req, res) {
  try {
    const { city, state, course, type, limit, q } = req.query;
    const filter = {};

    if (city) filter['location.city'] = new RegExp(escapeRegex(city), 'i');
    if (state) filter['location.state'] = new RegExp(escapeRegex(state), 'i');
    if (course) filter.courses = new RegExp(escapeRegex(course), 'i');
    if (type) filter.instituteType = new RegExp(escapeRegex(type), 'i');

    const term = String(q || '').trim();
    if (term) {
      const regex = new RegExp(escapeRegex(term), 'i');
      filter.$or = [
        { name: regex },
        { shortName: regex },
        { 'location.city': regex },
        { 'location.state': regex },
        { courses: regex }
      ];
    }

    const listLimit = parseInt(limit, 10) || 50;
    const colleges = await College.find(filter)
      .sort({ nirfRanking: 1 })
      .limit(listLimit);

    return res.json(colleges);
  } catch (error) {
    console.error('Error in getAllColleges:', error);
    return res.status(500).json({ message: 'Failed to fetch colleges' });
  }
}

export async function searchAutocomplete(req, res) {
  try {
    const { q, limit } = req.query;
    const listLimit = parseInt(limit, 10) || 10;
    const results = await searchColleges(q, listLimit);
    return res.json(results);
  } catch (error) {
    console.error('Error in searchAutocomplete:', error);
    return res.status(500).json({ message: 'Search failed' });
  }
}

export async function getFilterOptions(req, res) {
  try {
    const [states, cities, courses] = await Promise.all([
      College.distinct('location.state'),
      College.distinct('location.city'),
      College.distinct('courses')
    ]);

    const clean = (values) =>
      [...new Set(
        values
          .filter(v => typeof v === 'string' && v.trim())
          .map(v => v.trim())
      )].sort((a, b) => a.localeCompare(b));

    return res.json({
      states: clean(states),
      cities: clean(cities),
      courses: clean(courses)
    });
  } catch (error) {
    console.error('Error in getFilterOptions:', error);
    return res.status(500).json({ message: 'Failed to fetch filter options' });
  }
}

export async function getCollegesByIds(req, res) {
  try {
    const ids = String(req.query.ids || '')
      .split(',')
      .map(id => id.trim())
      .filter(id => /^[a-f0-9]{24}$/i.test(id))
      .slice(0, 10);

    if (ids.length === 0) return res.json([]);

    const colleges = await College.find({ _id: { $in: ids } }).populate('nearbyPlaces');

    const order = new Map(ids.map((id, index) => [id, index]));
    colleges.sort((a, b) => order.get(a._id.toString()) - order.get(b._id.toString()));

    return res.json(colleges);
  } catch (error) {
    console.error('Error in getCollegesByIds:', error);
    return res.status(500).json({ message: 'Failed to fetch colleges' });
  }
}

const hasCoordinates = (college) =>
  Number.isFinite(college?.location?.latitude) && Number.isFinite(college?.location?.longitude);

async function loadNearbyPlacesInBackground(college) {
  try {
    const allNearby = await getNearbyPlacesForAllTypes(college);
    if (allNearby.length === 0) return;

    const savedPlaces = await NearbyPlace.insertMany(
      allNearby.map(place => ({ ...place, collegeId: college._id }))
    );

    await College.findByIdAndUpdate(college._id, {
      nearbyPlaces: savedPlaces.map(p => p._id)
    });
  } catch (error) {
    console.error(`Nearby places failed for ${college.name}:`, error.message);
  }
}

export async function getCollegeById(req, res) {
  try {
    const { id } = req.params;
    const college = await College.findById(id)
      .populate({
        path: 'reviews',
        populate: { path: 'userId', select: 'name' }
      })
      .populate('nearbyPlaces');

    if (!college) {
      return res.status(404).json({ message: 'College not found' });
    }

    if ((!college.nearbyPlaces || college.nearbyPlaces.length === 0) && hasCoordinates(college)) {
      loadNearbyPlacesInBackground(college);
    }

    return res.json(college);
  } catch (error) {
    console.error('Error in getCollegeById:', error);
    return res.status(500).json({ message: 'Failed to retrieve college details' });
  }
}

export async function createCollege(req, res) {
  try {
    const data = req.body;
    const college = new College(data);
    await college.save();

    syncCollegeToSearch(college).catch(console.error);
    syncCollegeToVectorDb(college).catch(console.error);

    return res.status(201).json({ message: 'College created successfully', college });
  } catch (error) {
    console.error('Error in createCollege:', error);
    return res.status(500).json({ message: 'Failed to create college', error: error.message });
  }
}

export async function updateCollege(req, res) {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const college = await College.findByIdAndUpdate(id, updateData, { new: true });
    if (!college) {
      return res.status(404).json({ message: 'College not found' });
    }

    syncCollegeToSearch(college).catch(console.error);
    syncCollegeToVectorDb(college).catch(console.error);

    return res.json({ message: 'College updated successfully', college });
  } catch (error) {
    console.error('Error in updateCollege:', error);
    return res.status(500).json({ message: 'Failed to update college', error: error.message });
  }
}

export async function deleteCollege(req, res) {
  try {
    const { id } = req.params;
    const college = await College.findByIdAndDelete(id);

    if (!college) {
      return res.status(404).json({ message: 'College not found' });
    }

    deleteCollegeFromSearch(id).catch(console.error);
    deleteCollegeFromVectorDb(id).catch(console.error);

    return res.json({ message: 'College deleted successfully' });
  } catch (error) {
    console.error('Error in deleteCollege:', error);
    return res.status(500).json({ message: 'Failed to delete college' });
  }
}

export async function triggerAiSummary(req, res) {
  try {
    const { id } = req.params;
    const college = await College.findById(id).populate('nearbyPlaces');

    if (!college) {
      return res.status(404).json({ message: 'College not found' });
    }

    const summary = await generateCollegeSummary(college);
    college.aiSummary = summary;
    await college.save();

    syncCollegeToVectorDb(college).catch(console.error);

    return res.json({ message: 'Summary generated successfully', summary });
  } catch (error) {
    console.error('Error in triggerAiSummary:', error);
    return res.status(500).json({ message: 'AI Summary generation failed', error: error.message });
  }
}

export async function importColleges(req, res) {
  try {
    const items = Array.isArray(req.body) ? req.body : [req.body];
    const createdColleges = [];

    for (const item of items) {
      const name = item.college_name || item.name;
      const address = item.address || 'Campus Address';
      const district = item.district || 'City Center';
      const city = item.city || district || 'Bangalore';
      const state = item.state || 'Karnataka';

      if (!name) continue;

      let college = await College.findOne({ name });
      if (!college) {
        college = new College({
          name,
          shortName: name.split(' ').map(w => w[0]).join('').toUpperCase(),
          location: {
            address,
            city,
            district,
            state,
            pincode: item.pincode || '560001',
            latitude: item.latitude || 12.9716 + (Math.random() - 0.5) * 0.05,
            longitude: item.longitude || 77.5946 + (Math.random() - 0.5) * 0.05
          },
          nirfRanking: item.nirfRanking || Math.floor(Math.random() * 150) + 1,
          instituteType: item.instituteType || 'Autonomous',
          fees: {
            tuition: item.tuition || '3.5 Lakh / Year',
            hostel: item.hostel_fee || '1.2 Lakh / Year',
            miscellaneous: '20,000 / Year'
          },
          placements: {
            averagePackage: item.averagePackage || '8.5 LPA',
            highestPackage: item.highestPackage || '32.0 LPA',
            placementPercentage: item.placementPercentage || '92%'
          },
          hostel: {
            available: true,
            boysHostel: true,
            girlsHostel: true,
            details: 'Spacious triple-sharing rooms with Wi-Fi and mess facilities.'
          },
          courses: item.courses || ['Computer Science Engineering', 'Information Science Engineering', 'Electronics Engineering'],
          facilities: item.facilities || ['Library', 'Gym', 'Sports Complex', 'WiFi Campus', 'Smart Classrooms'],
          campusArea: item.campusArea || '50 Acres',
          genderRatio: '65:35',
          images: item.images || ['https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=800&q=80']
        });

        await college.save();

        syncCollegeToSearch(college).catch(console.error);
        syncCollegeToVectorDb(college).catch(console.error);

        createdColleges.push(college);
      }
    }

    return res.status(201).json({
      message: `Successfully processed ${items.length} items. Imported ${createdColleges.length} new colleges.`,
      importedCount: createdColleges.length
    });
  } catch (error) {
    console.error('Error in importColleges:', error);
    return res.status(500).json({ message: 'Import failed', error: error.message });
  }
}

const COURSE_STOPWORDS = new Set([
  'engineering', 'engineer', 'bachelor', 'bachelors', 'master', 'masters',
  'btech', 'mtech', 'integrated', 'degree', 'honours', 'honors', 'science',
  'in', 'of', 'and', 'the', 'sc', 'tech', 'b', 'm'
]);

const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const courseTokens = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(token => token.length >= 2 && !COURSE_STOPWORDS.has(token));

const parseMoney = (value) => {
  if (value == null) return 0;
  if (typeof value === 'number') return value;

  const str = String(value).replace(/,/g, '');
  const cr = str.match(/([\d.]+)\s*cr/i);
  if (cr) return parseFloat(cr[1]) * 10000000;

  const lakh = str.match(/([\d.]+)\s*lakh/i);
  if (lakh) return parseFloat(lakh[1]) * 100000;

  const num = str.match(/\d+/);
  return num ? parseInt(num[0], 10) : 0;
};

const collegeRank = (college) =>
  college.nirfRanking || college.ranking?.nirf || 9999;

const scoreCollege = (college, { budget, preferredCity, wantedTokens }) => {
  let score = 0;

  const rank = collegeRank(college);
  if (rank < 50) score += 60;
  else if (rank < 100) score += 40;
  else if (rank < 200) score += 20;
  else score += 5;

  const pkgMatch = String(college.placements?.averagePackage || '').match(/([\d.]+)\s*LPA/i);
  if (pkgMatch) {
    const pkgVal = parseFloat(pkgMatch[1]);
    if (pkgVal > 15) score += 50;
    else if (pkgVal > 10) score += 40;
    else if (pkgVal > 6) score += 25;
    else score += 10;
  } else {
    const nirfMedian = Number(college.placements?.nirf?.medianSalary);
    if (Number.isFinite(nirfMedian) && nirfMedian > 0) {
      const pkgVal = nirfMedian / 100000;
      if (pkgVal > 15) score += 50;
      else if (pkgVal > 10) score += 40;
      else if (pkgVal > 6) score += 25;
      else score += 10;
    }
  }

  if (budget) {
    const tuitionVal = parseMoney(college.fees?.tuition || college.fees?.tuitionFee);
    const budgetVal = parseMoney(budget);
    if (tuitionVal > 0 && budgetVal > 0) {
      if (tuitionVal <= budgetVal) score += 30;
      else if (tuitionVal <= budgetVal * 1.25) score += 15;
    }
  }

  if (preferredCity && college.location?.city?.toLowerCase() === preferredCity.toLowerCase()) {
    score += 25;
  }

  let courseRatio = 0;
  if (wantedTokens.length > 0) {
    const offered = new Set(
      courseTokens([...(college.courses || []), ...(college.programmes || [])].join(' '))
    );
    const matched = wantedTokens.filter(token => offered.has(token)).length;
    courseRatio = matched / wantedTokens.length;
    score += Math.round(courseRatio * 80);
  }

  return { college, score, courseRatio };
};

export async function getRecommendations(req, res) {
  try {
    const { state, course, budget, preferredCity } = req.body || {};
    const wantedTokens = courseTokens(course);
    const prefs = { budget, preferredCity, wantedTokens };

    let colleges = state
      ? await College.find({ 'location.state': new RegExp(escapeRegex(state), 'i') })
      : await College.find({});

    if (colleges.length === 0) {
      colleges = await College.find({});
    }

    let scored = colleges.map(college => scoreCollege(college, prefs));

    if (state && wantedTokens.length > 0 && !scored.some(s => s.courseRatio > 0)) {
      colleges = await College.find({});
      scored = colleges.map(college => scoreCollege(college, prefs));
    }

    const courseMatches = scored.filter(s => s.courseRatio > 0);
    const pool = courseMatches.length > 0 ? courseMatches : scored;

    pool.sort((a, b) => b.score - a.score || collegeRank(a.college) - collegeRank(b.college));

    return res.json(pool.slice(0, 10).map(sc => ({
      ...sc.college.toObject(),
      recommendationScore: sc.score
    })));
  } catch (error) {
    console.error('Error in getRecommendations:', error);
    return res.status(500).json({ message: 'Recommendation query failed' });
  }
}

export async function getDatasetInfo(req, res) {
  try {
    const [total, curated, lastSynced, sources, snapshot, nirfSnapshot] = await Promise.all([
      College.countDocuments({}),
      College.countDocuments({ 'source.id': 'curated' }),
      College.findOne({ sourceKey: { $exists: true } })
        .sort({ syncedAt: -1 })
        .select('syncedAt')
        .lean(),
      College.aggregate([
        { $match: { 'source.id': { $exists: true, $ne: null } } },
        {
          $group: {
            _id: '$source.id',
            label: { $first: '$source.label' },
            url: { $first: '$source.url' },
            license: { $first: '$source.license' },
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]),
      readSnapshot(),
      readNirfSnapshot()
    ]);

    return res.json({
      total,
      curated,
      lastSyncedAt: lastSynced?.syncedAt || null,
      sources: sources.map((source) => ({
        id: source._id,
        label: source.label,
        url: source.url,
        license: source.license,
        count: source.count
      })),
      snapshot: snapshot
        ? { generatedAt: snapshot.meta?.generatedAt || null, records: snapshot.colleges.length }
        : null,
      nirf: nirfSnapshot
        ? {
            year: nirfSnapshot.meta?.year || null,
            generatedAt: nirfSnapshot.meta?.generatedAt || null,
            records: nirfSnapshot.institutes.length,
            dossiers: Object.keys(nirfSnapshot.dcs || {}).length,
            sourceUrl: nirfSnapshot.meta?.sourceUrl || null
          }
        : null
    });
  } catch (error) {
    console.error('Error in getDatasetInfo:', error);
    return res.status(500).json({ message: 'Failed to read dataset information' });
  }
}

export async function refreshDataset(req, res) {
  try {
    const payload = await fetchOpenDatasetRecords();
    await writeSnapshot(payload);

    const nirfSnapshot = await readNirfSnapshot();
    const nirfMatched = nirfSnapshot ? applyNirfSnapshot(payload.colleges, nirfSnapshot).matched : 0;

    const result = await upsertColleges(College, payload.colleges);
    const total = await College.countDocuments({});

    return res.json({
      message: `Refreshed ${result.total} colleges from open datasets (${result.inserted} new${nirfMatched ? `, NIRF data on ${nirfMatched}` : ''}).`,
      ...result,
      total,
      nirfMatched,
      meta: payload.meta
    });
  } catch (error) {
    console.error('Error in refreshDataset:', error);
    return res.status(503).json({
      message: `Could not refresh from the open datasets: ${error.message}`
    });
  }
}

export async function getDashboardStats(req, res) {
  try {
    const totalColleges = await College.countDocuments({});
    const totalReviews = await Review.countDocuments({});
    const topColleges = await College.find({})
      .sort({ nirfRanking: 1 })
      .limit(5)
      .select('name nirfRanking placements.averagePackage location.city');

    return res.json({
      totalColleges,
      totalReviews,
      totalQueries: totalReviews * 3 + totalColleges,
      topColleges
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return res.status(500).json({ message: 'Failed to retrieve admin statistics' });
  }
}
