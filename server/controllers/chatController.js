import { searchVectorDb } from '../services/chromaService.js';
import { streamGeminiAboutColleges } from '../services/geminiService.js';
import NearbyPlace from '../models/NearbyPlace.js';
import College from '../models/College.js';
import { getNearbyPlacesForAllTypes } from '../services/placesService.js';

/**
 * Handle AI RAG chatbot query.
 * Expects { message } in body.
 * Streams the response chunk by chunk to the client.
 */
export async function askAssistant(req, res) {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }

    // 1. Vector Search ChromaDB (falls back to Mongoose search if ChromaDB is offline)
    console.log(`RAG query received: "${message}"`);
    const relevantColleges = await searchVectorDb(message, 5);
    console.log(`Found ${relevantColleges.length} relevant colleges for context.`);

    // Enrich nearby places for the top match in the background. Never await
    // this before streaming: generating places can call Gemini and would add
    // seconds of dead air before the first token.
    if (relevantColleges.length > 0) {
      const topCollege = relevantColleges[0];
      if (!topCollege.nearbyPlaces || topCollege.nearbyPlaces.length === 0) {
        loadNearbyPlacesInBackground(topCollege);
      }
    }

    // 2. Set headers for SSE / Streaming
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.flushHeaders?.();

    // 3. Format sources metadata and write first chunk as expected by Chat.jsx
    const sources = relevantColleges.map(c => ({
      _id: c._id.toString(),
      name: c.name,
      shortName: c.shortName || '',
      // Imported rows do not always carry a city; fall back to the state
      // rather than labelling every unlocated college as Bangalore.
      city: c.location?.city || c.location?.state || 'India'
    }));

    res.write(JSON.stringify({ sources }) + '\n[CONTENT_START]\n');

    // 4. Stream response from Gemini
    await streamGeminiAboutColleges(message, relevantColleges, (chunk) => {
      res.write(chunk);
    });

    res.end();
  } catch (error) {
    console.error('Error in chat controller:', error);
    // If headers are already sent, end the stream, otherwise send JSON error
    if (!res.headersSent) {
      res.status(500).json({ message: 'Internal server error during chat query' });
    } else {
      res.end();
    }
  }
}

/**
 * Fetches and stores nearby places for a college without blocking the chat
 * stream. Failures are logged and otherwise ignored.
 */
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

    // Save references back to the College document
    await College.findByIdAndUpdate(college._id, {
      nearbyPlaces: savedPlaces.map(p => p._id)
    });
  } catch (err) {
    console.error(`Failed to batch lazy-load places for ${college.name}:`, err.message);
  }
}

