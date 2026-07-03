import { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Building, ArrowRight, Sparkles } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

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

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchResults = async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const apiBase = import.meta.env.VITE_API_URL || '';
        const { data } = await axios.get(`${apiBase}/api/colleges/search?q=${encodeURIComponent(query)}&limit=8`);
        setResults(data);
      } catch (err) {
        console.error('Search error', err);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchResults, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  const handleSelect = (id) => {
    setIsOpen(false);
    navigate(`/college/${id}`);
    setQuery('');
  };

  return (
    <div ref={wrapperRef} className="relative w-full max-w-2xl mx-auto z-50">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400 group-focus-within:text-brand-light" />
        </div>
        <input
          type="text"
          className="block w-full pl-12 pr-4 py-4 glass-card text-foreground placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-light/50 focus:border-transparent transition-all duration-200 dark:bg-darkbg-card/45 dark:border-white/10"
          placeholder="Search for colleges, courses, or cities (e.g., Engineering in Bangalore)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
        />
        {loading && (
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-light"></div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isOpen && query.length >= 2 && results.length > 0 && (
          <motion.div
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute top-full left-0 w-full mt-2 rounded-2xl overflow-hidden shadow-2xl bg-white/95 dark:bg-darkbg-card/90 backdrop-blur-[20px] border border-gray-200/80 dark:border-white/10 dark:shadow-[0_12px_40px_rgba(0,0,0,0.5),0_0_20px_rgba(0,245,255,0.08)]"
          >
            <div className="p-2 text-left text-xs font-semibold text-gray-400 border-b border-gray-100 dark:border-white/10 dark:text-gray-400 px-4 py-2.5 flex items-center justify-between bg-gray-50/50 dark:bg-black/20">
              <span className="flex items-center gap-1.5">
                <Sparkles size={12} className="text-brand-light animate-pulse" />
                Search Suggestions
              </span>
              <span className="text-[10px] text-brand-light/75 font-mono uppercase tracking-wider">Instant Match</span>
            </div>
            <ul className="max-h-96 overflow-y-auto py-2 px-1.5 custom-scrollbar">
              {results.map((college) => (
                <motion.li
                  key={college._id}
                  variants={itemVariants}
                  onClick={() => handleSelect(college._id)}
                  className="group px-4 py-3 hover:bg-gradient-to-r hover:from-brand-light/10 hover:to-brand-purple/5 border border-transparent hover:border-brand-light/20 cursor-pointer flex items-center justify-between transition-all duration-200 rounded-xl hover:translate-x-1"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground group-hover:text-brand-light transition-colors text-sm">
                      {college.name} {college.shortName && `(${college.shortName})`}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1 font-medium">
                      <MapPin className="h-3 w-3 text-brand-light" />
                      {college.location?.city}, {college.location?.state}
                      <span className="mx-2 text-gray-300 dark:text-gray-700">•</span>
                      <Building className="h-3 w-3 text-brand-accent" />
                      <span className="font-mono text-[10px] uppercase tracking-wider">{college.instituteType || 'Autonomous'}</span>
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-brand-light group-hover:translate-x-0.5 transition-all duration-200" />
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
