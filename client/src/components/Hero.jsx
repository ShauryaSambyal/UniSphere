import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, Award, Sparkles, ArrowRight, ChevronRight, Loader2 } from 'lucide-react';
import api from '../services/api';
import Dropdown from './Dropdown';
import useCollegeFilters from '../lib/useCollegeFilters';
import { locationLabel, prettyLabel, rankLabel } from '../lib/format';
import { EASE, fadeUp, dropdownVariants, dropdownItem } from '../lib/motion';

/* `mark: true` paints the word with the mint highlighter swash. */
const HEADLINE_LINE_1 = [
  { text: 'Find' },
  { text: 'the' },
  { text: 'right' },
  { text: 'college,', mark: true },
];
const HEADLINE_LINE_2 = [
  { text: 'decided' },
  { text: 'by' },
  { text: 'data.' },
];

/* Only used until the live count arrives, so the hero never shows a blank. */
const FALLBACK_STATS = [
  { value: '2,000+', label: 'Indexed colleges' },
  { value: 'Open data', label: 'Provenance tracked' },
  { value: '6', label: 'Data dimensions compared' },
];

/* Quiet pill used by the three hero filters. */
const PILL_TRIGGER =
  'flex w-full cursor-pointer items-center justify-between gap-1.5 rounded-full border border-line bg-card px-4 py-2.5 text-xs font-medium text-foreground transition-colors duration-150 hover:border-line-strong';

/**
 * Reveals a headline one word at a time, rising out of a blur. Line two is
 * delayed past the end of line one so the sentence reads in order.
 */
function WordLine({ words, delay = 0, className = '' }) {
  return (
    <span className={className}>
      {words.map((word, index) => (
        <motion.span
          key={`${word.text}-${index}`}
          initial={{ opacity: 0, y: '0.4em', filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.85, ease: EASE, delay: delay + index * 0.075 }}
          className="inline-block"
        >
          {word.mark ? <span className="mark">{word.text}</span> : word.text}
          {index < words.length - 1 ? '\u00A0' : ''}
        </motion.span>
      ))}
    </span>
  );
}

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

  // Every state / city / course present in the database (with an offline fallback).
  const { states, cities, courses } = useCollegeFilters();

  // Live directory size — the headline numbers must never outpace the data.
  const [collegeCount, setCollegeCount] = useState(null);

  useEffect(() => {
    let cancelled = false;

    api.get('/colleges/stats')
      .then(({ data }) => {
        if (!cancelled && data?.totalColleges) setCollegeCount(data.totalColleges);
      })
      .catch((error) => console.error('Directory stats unavailable:', error));

    return () => {
      cancelled = true;
    };
  }, []);

  const countLabel = collegeCount ? `${collegeCount.toLocaleString()}+` : null;
  const STATS = collegeCount
    ? [{ value: countLabel, label: 'Indexed colleges' }, ...FALLBACK_STATS.slice(1)]
    : FALLBACK_STATS;
  const MARQUEE_ITEMS = [
    `${countLabel || '2,000+'} institutes indexed`,
    'Sourced from open datasets',
    'Provenance on every record',
    'Fees compared side by side',
    'AI answers with sources',
    'Refreshed from public data',
  ];

  // Handle outside clicks to close the autocomplete dropdown
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

  // Submitting the search goes straight to the best match when we have one,
  // otherwise it drops the visitor into the full directory.
  const handleSearchSubmit = (event) => {
    event.preventDefault();
    if (suggestions.length > 0) {
      navigate(`/college/${suggestions[0]._id}`);
      setIsOpen(false);
      return;
    }
    document.getElementById('listings-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleFilterSearch = (event) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (selectedState) params.append('state', selectedState);
    if (selectedCity) params.append('city', selectedCity);
    if (selectedCourse) params.append('course', selectedCourse);

    navigate(`/?${params.toString()}`);
    document.getElementById('listings-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative overflow-hidden">
      {/* Barely-there warm light behind the headline — the only ornament */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[460px]"
        style={{
          background:
            'radial-gradient(900px 340px at 50% -140px, color-mix(in oklab, var(--foreground) 5%, transparent), transparent 72%)',
        }}
      />

      <div className="mx-auto max-w-5xl px-5 pb-16 pt-16 text-center sm:px-6 sm:pt-20 lg:pb-20 lg:pt-24">
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mb-8 inline-flex"
        >
          <span className="inline-flex items-center gap-2.5 rounded-full border border-line bg-card px-4 py-1.5 text-xs font-medium tracking-[0.01em] text-muted">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
            </span>
            Grounded in verified campus data
          </span>
        </motion.div>

        {/* Display headline — the marked word carries the mint accent */}
        <h1 className="mx-auto max-w-3xl text-[2.5rem] font-semibold leading-[1.12] tracking-[-0.035em] text-foreground sm:text-6xl lg:text-[4.1rem]">
          <WordLine words={HEADLINE_LINE_1} delay={0.12} className="block" />
          <WordLine
            words={HEADLINE_LINE_2}
            delay={0.12 + HEADLINE_LINE_1.length * 0.075}
            className="block"
          />
        </h1>

        {/* Subline */}
        <motion.p
          {...fadeUp(0.6)}
          className="mx-auto mt-7 max-w-xl text-[17px] font-normal leading-relaxed text-muted"
        >
          Search institutes, compare fees and placements, and ask the AI assistant
          anything — every answer grounded in verified campus data.
        </motion.p>

        {/* Search */}
        <motion.div
          {...fadeUp(0.68, 22)}
          className="relative mx-auto mt-10 max-w-xl"
          ref={containerRef}
        >
          <form
            onSubmit={handleSearchSubmit}
            className="flex items-center gap-2 rounded-full border border-line bg-card py-1.5 pl-5 pr-1.5 shadow-[0_2px_4px_rgba(26,26,26,0.03),0_18px_44px_-24px_rgba(26,26,26,0.22)] transition-colors duration-200 focus-within:border-line-strong"
          >
            <Search size={17} strokeWidth={2} className="shrink-0 text-faint" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              placeholder="Search by college, city, or course…"
              className="w-full bg-transparent py-3 text-sm font-normal text-foreground outline-none placeholder:text-faint"
            />
            {loading && <Loader2 size={15} className="shrink-0 animate-spin text-faint" />}
            <button
              type="submit"
              className="shrink-0 cursor-pointer rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-all duration-200 hover:opacity-85 active:scale-[0.98]"
            >
              Search
            </button>
          </form>

          {/* Autocomplete */}
          <AnimatePresence>
            {isOpen && suggestions.length > 0 && (
              <motion.div
                variants={dropdownVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="absolute inset-x-0 top-full z-30 mt-3 overflow-hidden rounded-2xl border border-line bg-card text-left shadow-[0_24px_56px_-24px_rgba(26,26,26,0.28)]"
              >
                <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                  <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-faint">
                    <Sparkles size={11} />
                    Suggestions
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-faint">Instant match</span>
                </div>
                <ul className="custom-scrollbar max-h-64 overflow-y-auto p-1.5">
                  {suggestions.map((college) => (
                    <motion.li key={college._id} variants={dropdownItem}>
                      <button
                        type="button"
                        onClick={() => {
                          navigate(`/college/${college._id}`);
                          setIsOpen(false);
                          setQuery('');
                        }}
                        className="group flex w-full cursor-pointer items-center justify-between rounded-xl px-3.5 py-3 text-left transition-colors duration-150 hover:bg-subtle"
                      >
                        <div>
                          <div className="text-sm font-medium text-foreground">{college.name}</div>
                          <div className="mt-0.5 flex items-center gap-3 text-xs text-muted">
                            <span className="flex items-center gap-1">
                              <MapPin size={11} />
                              {locationLabel(college.location)}
                            </span>
                            {college.nirfRanking > 0 && college.nirfRanking < 999 && (
                              <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-faint">
                                <Award size={10} />
                                NIRF {rankLabel(college.nirfRanking)}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight
                          size={15}
                          className="text-faint transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-foreground"
                        />
                      </button>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Secondary action */}
        <motion.div {...fadeUp(0.76)} className="mt-4 flex items-center justify-center">
          <Link
            to="/chat"
            className="group inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors duration-200 hover:bg-subtle"
          >
            or ask the AI assistant
            <ArrowRight
              size={14}
              className="transition-transform duration-200 group-hover:translate-x-0.5"
            />
          </Link>
        </motion.div>

        {/* Filters */}
        <motion.form
          {...fadeUp(0.84)}
          onSubmit={handleFilterSearch}
          className="mx-auto mt-8 flex flex-wrap items-center justify-center gap-2"
        >
          <div className="w-[9.5rem]">
            <Dropdown
              value={selectedState}
              onChange={setSelectedState}
              options={states.map((value) => ({ value, label: value }))}
              placeholder="Any state"
              triggerClassName={PILL_TRIGGER}
            />
          </div>
          <div className="w-[8.5rem]">
            <Dropdown
              value={selectedCity}
              onChange={setSelectedCity}
              options={cities.map((value) => ({ value, label: prettyLabel(value) }))}
              placeholder="Any city"
              triggerClassName={PILL_TRIGGER}
            />
          </div>
          <div className="w-[13rem]">
            <Dropdown
              value={selectedCourse}
              onChange={setSelectedCourse}
              options={courses.map((value) => ({ value, label: value }))}
              placeholder="Any course"
              triggerClassName={PILL_TRIGGER}
            />
          </div>
          <button
            type="submit"
            className="cursor-pointer rounded-full border border-foreground bg-foreground px-5 py-2.5 text-xs font-medium text-background transition-all duration-200 hover:opacity-85 active:scale-[0.98]"
          >
            Apply filters
          </button>
        </motion.form>

        {/* Proof */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1, delayChildren: 1.05 } } }}
          className="mx-auto mt-16 grid max-w-2xl grid-cols-3 divide-x divide-line"
        >
          {STATS.map((stat) => (
            <motion.div
              key={stat.label}
              variants={{
                hidden: { opacity: 0, y: 14 },
                show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
              }}
              className="px-4 py-2"
            >
              <div className="text-[1.9rem] font-semibold leading-none tracking-[-0.03em] text-foreground">
                {stat.value}
              </div>
              <div className="mt-2 text-xs font-normal text-muted">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Signature marquee */}
      <div className="marquee border-t border-line py-6">
        <div className="marquee-track">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0 items-center" aria-hidden={copy === 1}>
              {MARQUEE_ITEMS.map((item) => (
                <span key={item} className="flex items-center whitespace-nowrap">
                  <span className="px-7 text-xl font-medium text-muted sm:text-2xl">{item}</span>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
