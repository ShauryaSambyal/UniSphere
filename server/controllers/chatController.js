import { searchVectorDb } from '../services/chromaService.js';
import { streamGeminiAboutColleges } from '../services/geminiService.js';
import NearbyPlace from '../models/NearbyPlace.js';
import College from '../models/College.js';
import { getNearbyPlacesForAllTypes } from '../services/placesService.js';

export async function askAssistant(req, res) {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }

    console.log(`RAG query received: "${message}"`);
    const relevantColleges = await searchVectorDb(message, 5);
    console.log(`Found ${relevantColleges.length} relevant colleges for context.`);

    if (relevantColleges.length > 0) {
      const topCollege = relevantColleges[0];
      if (!topCollege.nearbyPlaces || topCollege.nearbyPlaces.length === 0) {
        loadNearbyPlacesInBackground(topCollege);
      }
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.flushHeaders?.();

    const sources = relevantColleges.map(c => ({
      _id: c._id.toString(),
      name: c.name,
      shortName: c.shortName || '',

      city: c.location?.city || c.location?.state || 'India'
    }));

    res.write(JSON.stringify({ sources }) + '\n[CONTENT_START]\n');

    await streamGeminiAboutColleges(message, relevantColleges, (chunk) => {
      res.write(chunk);
    });

    res.end();
  } catch (error) {
    console.error('Error in chat controller:', error);

    if (!res.headersSent) {
      res.status(500).json({ message: 'Internal server error during chat query' });
    } else {
      res.end();
    }
  }
}

async function loadNearbyPlacesInBackground(college) {
  try {
    const allNearby = await getNearbyPlacesForAllTypes(college);
    if (allNearby.length === 0) return;

    const savedPlaces = await NearbyPlace.insertMany(
      allNearby.map(place => ({
        ...place,
        collegeId: college._id
      }))
    );

    await College.findByIdAndUpdate(college._id, {
      nearbyPlaces: savedPlaces.map(p => p._id)
    });
  } catch (err) {
    console.error(`Failed to batch lazy-load places for ${college.name}:`, err.message);
  }
}
