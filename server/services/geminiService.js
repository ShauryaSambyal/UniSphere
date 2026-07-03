import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
let ai = null;

if (apiKey) {
  try {
    ai = new GoogleGenerativeAI(apiKey);
  } catch (error) {
    console.error('Error initializing GoogleGenerativeAI:', error);
  }
} else {
  console.warn('WARNING: GEMINI_API_KEY environment variable is not defined. AI functionality will use mock answers.');
}

/**
 * Generates an AI summary of a college based on its data.
 * @param {Object} collegeData 
 * @returns {Promise<string>}
 */
export async function generateCollegeSummary(collegeData) {
  if (!apiKey || !ai) {
    return `Mock AI Summary for ${collegeData.name || 'this college'}: A premier institute located in ${collegeData.location?.city || 'India'}. Known for its high-quality academic environment and placement package averages of around ${collegeData.placements?.averagePackage || 'N/A'}. Offers top courses including ${collegeData.courses?.join(', ') || 'multiple engineering disciplines'}.`;
  }

  try {
    // We use gemini-2.5-flash as default stable text model
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = `Summarize this college for prospective students in 2-3 detailed paragraphs. Highlighting fees, placements, courses, and unique highlights.
    
Context:
${JSON.stringify(collegeData, null, 2)}`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Error in generateCollegeSummary:', error);
    throw error;
  }
}

/**
 * RAG Chat assistant answer.
 * @param {string} question - The user's query.
 * @param {Array<Object>} retrievedColleges - Context documents from vector search.
 * @returns {Promise<string>}
 */
export async function askGeminiAboutColleges(question, retrievedColleges) {
  if (!apiKey || !ai) {
    return `[Mock AI Assistant]: To answer your question: "${question}", I looked through the college data. ${retrievedColleges.length > 0 ? `I found matches like ${retrievedColleges.map(c => c.name).join(', ')}.` : 'No relevant colleges were found.'} Since GEMINI_API_KEY is not set, this is a mock answer. Please configure GEMINI_API_KEY in the .env file.`;
  }

  try {
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const contextText = retrievedColleges
      .map(c => `College Name: ${c.name}\nShort Name: ${c.shortName || 'N/A'}\nLocation: ${c.location.city}, ${c.location.state}\nNIRF Ranking: ${c.nirfRanking}\nInstitute Type: ${c.instituteType}\nFees: Tuition: ${c.fees.tuition}, Hostel: ${c.fees.hostel}\nPlacements: Average: ${c.placements.averagePackage}, Highest: ${c.placements.highestPackage}, Placed: ${c.placements.placementPercentage}\nHostel Details: ${c.hostel.details || 'N/A'}\nCourses: ${c.courses.join(', ')}\nFacilities: ${c.facilities.join(', ')}\nCampus Area: ${c.campusArea || 'N/A'}\nAI Summary: ${c.aiSummary || 'N/A'}\nNearby Places: ${c.nearbyPlaces && c.nearbyPlaces.length > 0 ? c.nearbyPlaces.map(p => `${p.name} (${p.type?.replace('_', ' ')} - Rating: ${p.rating || 'N/A'})`).join(', ') : 'None'}`)
      .join('\n\n---\n\n');

    const prompt = `You are an educational college assistant.
Answer the user's question using the provided College Context if it is relevant.
If the information is not available in the College Context, or if the question is general or about other topics, use your own intelligence and general knowledge to answer the question accurately.
Always prioritize the provided College Context for details about the colleges listed in it. Do not state "Information is unavailable" if you can answer it using your own intelligence.

Provided College Context:
${contextText}

User Question: ${question}

Answer:`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Error in askGeminiAboutColleges:', error);
    throw error;
  }
}

/**
 * Streams RAG Chat response.
 * @param {string} question 
 * @param {Array<Object>} retrievedColleges 
 * @param {Function} onChunk - callback for incoming text chunks
 */
export async function streamGeminiAboutColleges(question, retrievedColleges, onChunk) {
  if (!apiKey || !ai) {
    const mockMsg = `[Mock Streaming AI Assistant]: Here is the mock info for: "${question}".\n\n` +
      `Context contains: ${retrievedColleges.map(c => c.name).join(', ') || 'No colleges found'}.\n\n` +
      `Configure the GEMINI_API_KEY in the .env file to enable live streaming answers.`;
    
    // Simulate streaming
    const words = mockMsg.split(' ');
    for (const word of words) {
      onChunk(word + ' ');
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return;
  }

  try {
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const contextText = retrievedColleges
      .map(c => `College Name: ${c.name}\nShort Name: ${c.shortName || 'N/A'}\nLocation: ${c.location.city}, ${c.location.state}\nNIRF Ranking: ${c.nirfRanking}\nInstitute Type: ${c.instituteType}\nFees: Tuition: ${c.fees.tuition}, Hostel: ${c.fees.hostel}\nPlacements: Average: ${c.placements.averagePackage}, Highest: ${c.placements.highestPackage}, Placed: ${c.placements.placementPercentage}\nHostel Details: ${c.hostel.details || 'N/A'}\nCourses: ${c.courses.join(', ')}\nFacilities: ${c.facilities.join(', ')}\nCampus Area: ${c.campusArea || 'N/A'}\nAI Summary: ${c.aiSummary || 'N/A'}\nNearby Places: ${c.nearbyPlaces && c.nearbyPlaces.length > 0 ? c.nearbyPlaces.map(p => `${p.name} (${p.type?.replace('_', ' ')} - Rating: ${p.rating || 'N/A'})`).join(', ') : 'None'}`)
      .join('\n\n---\n\n');

    const prompt = `You are an educational college assistant.
Answer the user's question using the provided College Context if it is relevant.
If the information is not available in the College Context, or if the question is general or about other topics, use your own intelligence and general knowledge to answer the question accurately.
Always prioritize the provided College Context for details about the colleges listed in it. Do not state "Information is unavailable" if you can answer it using your own intelligence.

Provided College Context:
${contextText}

User Question: ${question}

Answer:`;

    const result = await model.generateContentStream(prompt);
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      onChunk(chunkText);
    }
  } catch (error) {
    console.error('Error in streamGeminiAboutColleges:', error);
    onChunk(`Error communicating with Gemini API: ${error.message}`);
  }
}
