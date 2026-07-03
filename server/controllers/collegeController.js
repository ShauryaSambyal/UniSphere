import College from '../models/College.js';
import Review from '../models/Review.js';
import NearbyPlace from '../models/NearbyPlace.js';
import { generateCollegeSummary } from '../services/geminiService.js';
import { getNearbyPlaces } from '../services/placesService.js';
import { syncCollegeToVectorDb, deleteCollegeFromVectorDb } from '../services/chromaService.js';
import { syncCollegeToSearch, deleteCollegeFromSearch, searchColleges } from '../services/searchService.js';

/**
 * Get all colleges with filters.
 */
export async function getAllColleges(req, res) {
  try {
    const { city, state, course, type, limit } = req.query;
    const filter = {};

    if (city) filter['location.city'] = new RegExp(city, 'i');
    if (state) filter['location.state'] = new RegExp(state, 'i');
    if (course) filter.courses = new RegExp(course, 'i');
    if (type) filter.instituteType = new RegExp(type, 'i');

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

/**
 * Autocomplete / Meilisearch search.
 */
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

/**
 * Get detailed college by ID (including nearby places from Google Places API).
 */
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

    // If nearby places are not populated or empty, fetch them using Places API and save
    if (!college.nearbyPlaces || college.nearbyPlaces.length === 0) {
      const allNearby = await getNearbyPlacesForAllTypes(college);

      if (allNearby.length > 0) {
        const savedPlaces = await NearbyPlace.insertMany(
          allNearby.map(place => ({
            ...place,
            collegeId: college._id
          }))
        );
        college.nearbyPlaces = savedPlaces.map(p => p._id);
        await college.save();
        college.nearbyPlaces = savedPlaces; // Return populated list to the frontend
      }
    }

    return res.json(college);
  } catch (error) {
    console.error('Error in getCollegeById:', error);
    return res.status(500).json({ message: 'Failed to retrieve college details' });
  }
}

/**
 * Add a new college.
 */
export async function createCollege(req, res) {
  try {
    const data = req.body;
    const college = new College(data);
    await college.save();

    // Sync to search index & ChromaDB asynchronously
    syncCollegeToSearch(college).catch(console.error);
    syncCollegeToVectorDb(college).catch(console.error);

    return res.status(201).json({ message: 'College created successfully', college });
  } catch (error) {
    console.error('Error in createCollege:', error);
    return res.status(500).json({ message: 'Failed to create college', error: error.message });
  }
}

/**
 * Edit a college.
 */
export async function updateCollege(req, res) {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const college = await College.findByIdAndUpdate(id, updateData, { new: true });
    if (!college) {
      return res.status(404).json({ message: 'College not found' });
    }

    // Re-sync to search index & ChromaDB asynchronously
    syncCollegeToSearch(college).catch(console.error);
    syncCollegeToVectorDb(college).catch(console.error);

    return res.json({ message: 'College updated successfully', college });
  } catch (error) {
    console.error('Error in updateCollege:', error);
    return res.status(500).json({ message: 'Failed to update college', error: error.message });
  }
}

/**
 * Delete college.
 */
export async function deleteCollege(req, res) {
  try {
    const { id } = req.params;
    const college = await College.findByIdAndDelete(id);

    if (!college) {
      return res.status(404).json({ message: 'College not found' });
    }

    // Delete from indexes asynchronously
    deleteCollegeFromSearch(id).catch(console.error);
    deleteCollegeFromVectorDb(id).catch(console.error);

    return res.json({ message: 'College deleted successfully' });
  } catch (error) {
    console.error('Error in deleteCollege:', error);
    return res.status(500).json({ message: 'Failed to delete college' });
  }
}

/**
 * Generate AI Summary for college.
 */
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

    // Re-sync vectors because the document content changed (has AI Summary now)
    syncCollegeToVectorDb(college).catch(console.error);

    return res.json({ message: 'Summary generated successfully', summary });
  } catch (error) {
    console.error('Error in triggerAiSummary:', error);
    return res.status(500).json({ message: 'AI Summary generation failed', error: error.message });
  }
}

/**
 * Bulk import colleges.
 * Accept: { "college_name": "", "address": "", "district": "" }
 */
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

      // Deduplicate by name
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
        
        // Sync to search index and Vector DB
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

/**
 * Recommendations Engine.
 * Input: { state, course, budget, preferredCity }
 */
export async function getRecommendations(req, res) {
  try {
    const { state, course, budget, preferredCity } = req.body;
    const query = {};

    if (state) query['location.state'] = new RegExp(state, 'i');
    if (course) query.courses = new RegExp(course, 'i');

    const colleges = await College.find(query);

    // Score and rank colleges
    const scoredColleges = colleges.map(college => {
      let score = 0;

      // 1. NIRF Ranking scoring (Lower is better, e.g. Rank 1 gets 100 points, Rank 200 gets 5 points)
      const rank = college.nirfRanking || 9999;
      if (rank < 50) score += 60;
      else if (rank < 100) score += 40;
      else if (rank < 200) score += 20;
      else score += 5;

      // 2. Average placement package scoring (Extract LPA numbers)
      const avgPkgStr = college.placements?.averagePackage || '';
      const pkgMatch = avgPkgStr.match(/([\d.]+)\s*LPA/i);
      if (pkgMatch) {
        const pkgVal = parseFloat(pkgMatch[1]);
        if (pkgVal > 15) score += 50;
        else if (pkgVal > 10) score += 40;
        else if (pkgVal > 6) score += 25;
        else score += 10;
      }

      // 3. Tuition Fee budget scoring
      if (budget) {
        const tuitionStr = college.fees?.tuition || '';
        // Convert tuition str like "3.5 Lakh" or "250000" to number
        let tuitionVal = 0;
        const lakhMatch = tuitionStr.match(/([\d.]+)\s*Lakh/i);
        if (lakhMatch) {
          tuitionVal = parseFloat(lakhMatch[1]) * 100000;
        } else {
          const numMatch = tuitionStr.replace(/,/g, '').match(/\d+/);
          if (numMatch) tuitionVal = parseInt(numMatch[0], 10);
        }

        // Convert budget filter to number
        let budgetVal = 0;
        const budgetLakhMatch = budget.match(/([\d.]+)\s*Lakh/i);
        if (budgetLakhMatch) {
          budgetVal = parseFloat(budgetLakhMatch[1]) * 100000;
        } else {
          const budgetNum = budget.replace(/,/g, '').match(/\d+/);
          if (budgetNum) budgetVal = parseInt(budgetNum[0], 10);
        }

        if (tuitionVal > 0 && budgetVal > 0) {
          if (tuitionVal <= budgetVal) {
            score += 30; // Fits within budget
          } else if (tuitionVal <= budgetVal * 1.25) {
            score += 15; // Slightly over budget
          }
        }
      }

      // 4. Preferred City scoring
      if (preferredCity && college.location?.city?.toLowerCase() === preferredCity.toLowerCase()) {
        score += 25;
      }

      return { college, score };
    });

    // Sort by descending score
    scoredColleges.sort((a, b) => b.score - a.score);

    return res.json(scoredColleges.slice(0, 10).map(sc => ({
      ...sc.college.toObject(),
      recommendationScore: sc.score
    })));
  } catch (error) {
    console.error('Error in getRecommendations:', error);
    return res.status(500).json({ message: 'Recommendation query failed' });
  }
}

/**
 * Fetch Stats for Admin Dashboard.
 */
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
      totalQueries: totalReviews * 3 + totalColleges, // proxy for interactions
      topColleges
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return res.status(500).json({ message: 'Failed to retrieve admin statistics' });
  }
}
