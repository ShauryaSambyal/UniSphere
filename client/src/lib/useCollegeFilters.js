import { useEffect, useState } from 'react';
import api from '../services/api';

// Shown until the API answers (and as an offline fallback) so the dropdowns
// are never empty on first paint.
const FALLBACK_OPTIONS = {
  states: ['Karnataka', 'Maharashtra', 'Uttar Pradesh'],
  cities: ['Bangalore', 'Mumbai'],
  courses: [
    'Computer Science',
    'Information Science',
    'Electronics',
    'AI & ML',
    'Mechanical',
    'Civil',
    'Computer Science Engineering',
    'Information Science Engineering',
    'Electronics & Communication Engineering',
    'Bachelor of Business Administration'
  ]
};

/**
 * Loads every state / city / course that actually exists in the college
 * database, so the dropdowns offer more than the handful of hardcoded options
 * (and grow automatically as colleges are imported).
 */
export default function useCollegeFilters() {
  const [options, setOptions] = useState(FALLBACK_OPTIONS);

  useEffect(() => {
    let cancelled = false;

    api.get('/colleges/filters')
      .then(({ data }) => {
        if (cancelled) return;
        setOptions({
          states: data.states?.length ? data.states : FALLBACK_OPTIONS.states,
          cities: data.cities?.length ? data.cities : FALLBACK_OPTIONS.cities,
          courses: data.courses?.length ? data.courses : FALLBACK_OPTIONS.courses
        });
      })
      .catch((error) => {
        console.error('Could not load college filter options, using fallback list:', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return options;
}
