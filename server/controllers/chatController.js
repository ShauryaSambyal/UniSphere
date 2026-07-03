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

    // Lazy-load nearby places ONLY for the top matched college to avoid rate-limiting
    if (relevantColleges.length > 0) {
      const topCollege = relevantColleges[0];
      if (!topCollege.nearbyPlaces || topCollege.nearbyPlaces.length === 0) {
        try {
          const allNearby = await getNearbyPlacesForAllTypes(topCollege);
          if (allNearby.length > 0) {
            const savedPlaces = await NearbyPlace.insertMany(
              allNearby.map(place => ({
                ...place,
                collegeId: topCollege._id
              }))
            );
            topCollege.nearbyPlaces = savedPlaces;
            
            // Save references back to the College document
            await College.findByIdAndUpdate(topCollege._id, {
              nearbyPlaces: savedPlaces.map(p => p._id)
            });
          }
        } catch (saveErr) {
          console.error(`Failed to batch lazy-load places for ${topCollege.name}:`, saveErr.message);
        }
      }
    }

    // 2. Set headers for SSE / Streaming
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    // 3. Format sources metadata and write first chunk as expected by Chat.jsx
    const sources = relevantColleges.map(c => ({
      _id: c._id.toString(),
      name: c.name,
      shortName: c.shortName || '',
      city: c.location?.city || 'Bangalore'
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

