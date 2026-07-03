import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
let ai = null;

if (apiKey) {
  try {
    ai = new GoogleGenerativeAI(apiKey);
  } catch (error) {
    console.error('Error initializing GoogleGenerativeAI in placesService:', error);
  }
}

// Mock descriptions for realistic facilities based on college location and facility type
const mockPlacesData = {
  restaurant: [
    { name: 'University Dine & Cafe', rating: 4.5, address: '100m from Main Gate' },
    { name: 'The Food Junction', rating: 4.2, address: 'Campus Food Court' },
    { name: 'Spicy Bistro', rating: 4.0, address: 'College Road' }
  ],
  cafe: [
    { name: 'Coffee Day Express', rating: 4.6, address: 'Library Block Ground Floor' },
    { name: 'The Brew House', rating: 4.4, address: 'Opposite Admin Block' },
    { name: 'Student Lounge Cafe', rating: 4.3, address: 'Academic Block-1' }
  ],
  hospital: [
    { name: 'City Care Hospital', rating: 4.1, address: 'Main Highway Road, 1.2km' },
    { name: 'Campus Health Center', rating: 4.8, address: 'Block D, Inside Campus' },
    { name: 'LifeLine General Clinic', rating: 3.9, address: 'Market Road, 800m' }
  ],
  shopping_mall: [
    { name: 'Apex Central Mall', rating: 4.3, address: 'Sector-5, 3km' },
    { name: 'Galaxy Arcade', rating: 4.0, address: 'Metro Road, 1.5km' }
  ],
  subway_station: [
    { name: 'College Metro Station', rating: 4.7, address: 'Blue Line, 500m' },
    { name: 'City Center Station', rating: 4.5, address: 'Interchange Station, 2.5km' }
  ]
};

/**
 * Fetch nearby places for a given college and place type.
 * Queries Gemini to generate highly realistic, location-specific places if API key is active.
 * @param {Object} college 
 * @param {string} type - restaurant, cafe, hospital, shopping_mall, subway_station
 */
export async function getNearbyPlaces(college, type) {
  const latitude = college.location?.latitude || 12.9716;
  const longitude = college.location?.longitude || 77.5946;
  const normalizedType = type === 'metro_station' || type === 'subway_station' ? 'subway_station' : type;

  if (ai && apiKey && college.name) {
    try {
      const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const prompt = `Generate a list of 3 real or highly realistic nearby locations of type "${normalizedType}" (e.g. restaurants, cafes, transit/metro stations, malls, or hospitals depending on the type) close to "${college.name}" in "${college.location?.city || ''}, ${college.location?.state || ''}".
      
Return ONLY a valid JSON array of objects with the exact keys:
- name: (string) The name of the place
- address: (string) A realistic descriptive address/distance (e.g., "500m from Main Gate", "Mysore Road")
- rating: (number) Between 3.8 and 4.9

Do not include markdown code block formatting (no \`\`\`json or \`\`\`), just the raw JSON text.`;

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const cleanText = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      const parsed = JSON.parse(cleanText);

      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(item => ({
          name: item.name || 'Nearby Facility',
          address: item.address || 'Near campus',
          type: normalizedType,
          rating: Number(item.rating) || 4.2,
          latitude: latitude + (Math.random() - 0.5) * 0.01,
          longitude: longitude + (Math.random() - 0.5) * 0.01
        }));
      }
    } catch (err) {
      console.warn(`Gemini failed to generate realistic places for ${college.name}, using mock fallback:`, err.message);
    }
  }

  // Fallback to static mock data
  const list = mockPlacesData[normalizedType] || mockPlacesData.restaurant;
  return list.map((item) => ({
    name: item.name,
    address: item.address,
    type: normalizedType,
    rating: item.rating,
    latitude: latitude + (Math.random() - 0.5) * 0.01,
    longitude: longitude + (Math.random() - 0.5) * 0.01
  }));
}

/**
 * Generates all 5 types of nearby places for a given college in a single Gemini call to prevent performance bottlenecks.
 * @param {Object} college 
 * @returns {Promise<Array<Object>>}
 */
export async function getNearbyPlacesForAllTypes(college) {
  const latitude = college.location?.latitude || 12.9716;
  const longitude = college.location?.longitude || 77.5946;
  const placeTypes = ['restaurant', 'cafe', 'hospital', 'shopping_mall', 'subway_station'];

  if (ai && apiKey && college.name) {
    try {
      const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const prompt = `Generate a lists of real or highly realistic nearby locations of these 5 types: "restaurant", "cafe", "hospital", "shopping_mall", "subway_station" close to "${college.name}" in "${college.location?.city || ''}, ${college.location?.state || ''}".
      
Provide exactly 2-3 realistic locations per type.
Return ONLY a valid JSON object mapping each type key to an array of objects. Example structure:
{
  "restaurant": [
    { "name": "MTR Mysore Road", "address": "1.5km away on Mysore Road", "rating": 4.4 }
  ],
  "cafe": [...],
  "hospital": [...],
  "shopping_mall": [...],
  "subway_station": [...]
}

Do not include markdown code block formatting (no \`\`\`json or \`\`\`), just the raw JSON text.`;

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const cleanText = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      const parsed = JSON.parse(cleanText);

      const allPlaces = [];
      for (const type of placeTypes) {
        const list = parsed[type];
        if (Array.isArray(list)) {
          list.forEach(item => {
            allPlaces.push({
              name: item.name || `${type} Facility`,
              address: item.address || 'Near campus',
              type: type,
              rating: Number(item.rating) || 4.2,
              latitude: latitude + (Math.random() - 0.5) * 0.01,
              longitude: longitude + (Math.random() - 0.5) * 0.01
            });
          });
        }
      }

      if (allPlaces.length > 0) {
        return allPlaces;
      }
    } catch (err) {
      console.warn(`Gemini failed to generate all places for ${college.name} in batch:`, err.message);
    }
  }

  // Fallback to static mock data compiled across all types
  console.log(`Using mock fallback for nearby places of college: ${college.name}`);
  const allPlaces = [];
  for (const type of placeTypes) {
    const list = mockPlacesData[type] || [];
    list.forEach(item => {
      allPlaces.push({
        name: item.name,
        address: item.address,
        type: type,
        rating: item.rating,
        latitude: latitude + (Math.random() - 0.5) * 0.01,
        longitude: longitude + (Math.random() - 0.5) * 0.01
      });
    });
  }
  return allPlaces;
}

