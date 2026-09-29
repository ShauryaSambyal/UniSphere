import { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Building, ArrowRight, Sparkles, Loader2 } from 'lucide-react';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { dropdownVariants, dropdownItem } from '../lib/motion';

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
        const { data } = await api.get(`/colleges/search?q=${encodeURIComponent(query)}&limit=8`);
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
    <div ref={wrapperRef} className="relative z-50 mx-auto w-full max-w-2xl">
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
          <Search className="text-faint" size={17} />
        </div>
        <input
          type="text"
          className="w-full rounded-xl border border-line bg-card py-3.5 pl-11 pr-4 text-sm font-normal text-foreground outline-none transition-colors duration-150 placeholder:text-faint focus:border-line-strong"
          placeholder="Search for colleges, courses, or cities…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
        />
        {loading && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-4">
            <Loader2 className="animate-spin text-muted" size={15} />
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
            className="absolute left-0 top-full mt-2 w-full overflow-hidden rounded-2xl border border-line bg-card-elevated text-left shadow-[0_24px_56px_-24px_rgba(26,26,26,0.22)]"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-faint">
                <Sparkles size={11} />
                Suggestions
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-faint">Instant match</span>
            </div>
            <ul className="custom-scrollbar max-h-96 overflow-y-auto p-1.5">
              {results.map((college) => (
                <motion.li key={college._id} variants={dropdownItem}>
                  <button
                    onClick={() => handleSelect(college._id)}
                    className="group flex w-full cursor-pointer items-center justify-between rounded-xl px-3.5 py-3 text-left transition-colors duration-150 hover:bg-subtle"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">
                        {college.name} {college.shortName && `(${college.shortName})`}
                      </span>
                      <span className="mt-1 flex items-center gap-2 text-xs font-normal text-muted">
                        <MapPin size={11} />
                        {college.location?.city}, {college.location?.state}
                        <span className="text-line-strong">•</span>
                        <Building size={11} />
                        <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
                          {college.instituteType || 'Autonomous'}
                        </span>
                      </span>
                    </div>
                    <ArrowRight
                      size={14}
                      className="text-faint transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-foreground"
                    />
                  </button>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
