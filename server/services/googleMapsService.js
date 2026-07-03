import axios from 'axios';
import dotenv from 'dotenv';
import NearbyPlace from '../models/NearbyPlace.js';

dotenv.config();

const MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

export const fetchNearbyPlaces = async (collegeId, latitude, longitude, radius = 5000) => {
  if (!MAPS_API_KEY) {
    console.warn("No GOOGLE_MAPS_API_KEY provided. Skipping nearby places fetch.");
    return [];
  }

  const types = ['restaurant', 'shopping_mall', 'hospital', 'subway_station', 'bus_station', 'train_station'];
  const places = [];

  try {
    for (const type of types) {
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radius}&type=${type}&key=${MAPS_API_KEY}`;
      
      const response = await axios.get(url);
      if (response.data.results) {
        // Take top 3 for each category to avoid cluttering
        const topResults = response.data.results.slice(0, 3);
        
        for (const res of topResults) {
          const place = new NearbyPlace({
            collegeId,
            name: res.name,
            address: res.vicinity,
            type: type,
            rating: res.rating,
            latitude: res.geometry?.location?.lat,
            longitude: res.geometry?.location?.lng
          });
          await place.save();
          places.push(place._id);
        }
      }
    }
  } catch (error) {
    console.error("Google Maps API Error:", error.message);
  }
  
  return places;
};
