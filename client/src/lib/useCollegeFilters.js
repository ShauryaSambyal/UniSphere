import { useEffect, useState } from 'react';
import api from '../services/api';

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
