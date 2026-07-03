import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, Award, BookOpen, GraduationCap, ChevronRight, Loader2 } from 'lucide-react';
import api from '../services/api';

// Framer Motion variants for cascading suggestion dropdown
const dropdownVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
      staggerChildren: 0.04,
      delayChildren: 0.02
    }
  },
  exit: {
    opacity: 0,
    y: 8,
    scale: 0.98,
    transition: {
      duration: 0.15,
      ease: 'easeOut'
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 20
    }
  }
};

export default function Hero() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Quick search filter states
  const [selectedState, setSelectedState] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedRank, setSelectedRank] = useState('');

  // Options for selectors (could be fetched or hardcoded for seed data)
  const states = ['Karnataka', 'Maharashtra'];
  const cities = ['Bangalore', 'Mumbai'];
  const courses = ['Computer Science Engineering', 'Electronics & Communication Engineering', 'Bachelor of Business Administration'];
  const ranks = [
    { label: 'Top 10', max: 10 },
    { label: 'Top 100', max: 100 },
    { label: 'Top 200', max: 200 }
  ];

  // Handle outside clicks to close autocomplete dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch suggestions with a simple debounce effect
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (query.trim().length < 2) {
        setSuggestions([]);
        return;
      }

      setLoading(true);
      try {
        const response = await api.get(`/colleges/search?q=${encodeURIComponent(query)}&limit=6`);
        setSuggestions(response.data);
        setIsOpen(true);
      } catch (error) {
        console.error('Autocomplete query failed:', error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [query]);

  const handleFilterSearch = (e) => {
    e.preventDefault();
    // Redirect with filters as query params
    const params = new URLSearchParams();
    if (selectedState) params.append('state', selectedState);
    if (selectedCity) params.append('city', selectedCity);
    if (selectedCourse) params.append('course', selectedCourse);
    
    navigate(`/?${params.toString()}`);
    // Smooth scroll down to listings
    const target = document.getElementById('listings-section');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="relative overflow-hidden bg-linear-to-b from-blue-50/40 via-white to-gray-50 dark:from-darkbg-base/30 dark:via-darkbg-base dark:to-darkbg-base py-20 lg:py-28">
      {/* Visual Background Accents */}
      <div className="absolute right-0 top-0 -z-10 h-[500px] w-[500px] rounded-full bg-brand-light/5 blur-3xl" />
      <div className="absolute left-0 bottom-0 -z-10 h-[400px] w-[400px] rounded-full bg-brand-accent/5 blur-3xl" />

      <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
        {/* Animated Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-light/10 border border-brand-light/20 px-4 py-1.5 text-xs font-semibold text-brand-light dark:text-brand-accent mb-6"
        >
          <GraduationCap size={14} />
          <span>RAG AI-Powered Decision Platform</span>
        </motion.div>

        {/* Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="font-sans text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl dark:text-white"
        >
          Find Your Perfect College <br />
          With <span className="bg-linear-to-r from-brand-light via-brand-accent to-purple-600 bg-clip-text text-transparent">AI Guidance</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mx-auto mt-6 max-w-2xl text-base text-gray-500 sm:text-lg dark:text-gray-400"
        >
          Search colleges, compare placements & fees, discover nearby facilities, and ask our ChatGPT-like assistant anything based on verified campus data.
        </motion.p>

        {/* Search bar & Autocomplete */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="relative mx-auto mt-10 max-w-xl"
          ref={containerRef}
        >
          <div className="relative flex items-center rounded-2xl border border-gray-200 bg-white shadow-xl focus-within:border-brand-light dark:border-white/10 dark:bg-darkbg-card/45 backdrop-blur-md dark:focus-within:border-brand-light focus-within:ring-2 focus-within:ring-brand-light/20 transition-all duration-200">
            <Search className="ml-4 text-gray-400 focus-within:text-brand-light" size={20} />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              placeholder="Search by college name, city, state, or course..."
              className="w-full rounded-2xl bg-transparent py-4 pl-3 pr-10 text-sm text-gray-900 outline-none dark:text-white"
            />
            {loading && (
              <Loader2 className="absolute right-4 animate-spin text-brand-light" size={18} />
            )}
          </div>

          {/* Autocomplete Dropdown */}
          <AnimatePresence>
            {isOpen && suggestions.length > 0 && (
              <motion.div
                variants={dropdownVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-2xl border border-gray-200/80 bg-white/95 dark:bg-darkbg-card/90 shadow-2xl backdrop-blur-[20px] dark:border-white/10 dark:shadow-[0_12px_40px_rgba(0,0,0,0.5),0_0_20px_rgba(0,245,255,0.08)]"
              >
                <div className="p-2 text-left text-xs font-semibold text-gray-400 border-b border-gray-100 dark:border-white/10 dark:text-gray-400 px-4 py-2.5 flex items-center justify-between bg-gray-50/50 dark:bg-black/20">
                  <span className="flex items-center gap-1.5">
                    <Sparkles size={12} className="text-brand-light animate-pulse" />
                    Search Suggestions
                  </span>
                  <span className="text-[10px] text-brand-light/75 font-mono uppercase tracking-wider">Instant Match</span>
                </div>
                <ul className="max-h-64 overflow-y-auto p-1.5 custom-scrollbar">
                  {suggestions.map((college) => (
                    <motion.li key={college._id} variants={itemVariants}>
                      <button
                        onClick={() => {
                          navigate(`/college/${college._id}`);
                          setIsOpen(false);
                          setQuery('');
                        }}
                        className="group flex w-full items-center justify-between rounded-xl px-4 py-3 text-left border border-transparent hover:border-brand-light/20 hover:bg-gradient-to-r hover:from-brand-light/10 hover:to-brand-purple/5 hover:translate-x-1 transition-all duration-200 cursor-pointer"
                      >
                        <div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-brand-light transition-colors">
                            {college.name}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                            <span className="flex items-center gap-1 group-hover:text-gray-300 transition-colors">
                              <MapPin size={12} className="text-brand-light" />
                              {college.location.city}, {college.location.state}
                            </span>
                            <span className="flex items-center gap-1 font-mono text-[10px] bg-brand-purple/10 text-brand-purple dark:text-brand-light dark:bg-brand-light/5 px-1.5 py-0.5 rounded border border-brand-purple/10 dark:border-brand-light/10">
                              <Award size={10} className="text-brand-accent animate-pulse" />
                              NIRF: #{college.nirfRanking}
                            </span>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-gray-400 group-hover:text-brand-light transition-all duration-200 group-hover:translate-x-0.5" />
                      </button>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Quick Filter Section */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          onSubmit={handleFilterSearch}
          className="mx-auto mt-8 max-w-4xl rounded-2xl border border-gray-200/60 bg-white/40 p-4 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-darkbg-card/45 grid grid-cols-2 md:grid-cols-4 gap-3 text-left"
        >
          {/* State filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400 px-1">State</label>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white py-2.5 px-3 text-xs text-gray-900 outline-none focus:border-brand-light dark:border-white/10 dark:bg-darkbg-card dark:text-white transition-all duration-200"
            >
              <option value="">All States</option>
              {states.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* City filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400 px-1">City</label>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white py-2.5 px-3 text-xs text-gray-900 outline-none focus:border-brand-light dark:border-white/10 dark:bg-darkbg-card dark:text-white transition-all duration-200"
            >
              <option value="">All Cities</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Course filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400 px-1">Course</label>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white py-2.5 px-3 text-xs text-gray-900 outline-none focus:border-brand-light dark:border-white/10 dark:bg-darkbg-card dark:text-white transition-all duration-200"
            >
              <option value="">All Courses</option>
              {courses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Apply button */}
          <div className="col-span-2 md:col-span-1 flex items-end">
            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-brand-light via-brand-accent to-brand-purple py-2.5 text-xs font-bold text-gray-950 shadow-lg shadow-brand-light/10 hover:brightness-110 active:scale-[0.98] transition-all duration-200 h-[38px] flex items-center justify-center gap-1"
            >
              Apply Filters
            </button>
          </div>
        </motion.form>
      </div>
    </div>
  );
}
