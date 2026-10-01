import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, MapPin, Award, IndianRupee, ChevronRight, SearchX, Loader2 } from 'lucide-react';
import api from '../services/api';
import Dropdown from '../components/Dropdown';
import useCollegeFilters from '../lib/useCollegeFilters';
import { locationLabel, prettyLabel, rankLabel } from '../lib/format';
import { EASE, fadeUp } from '../lib/motion';

export default function Recommendations() {
  // Input states
  const [state, setState] = useState('');
  const [course, setCourse] = useState('');
  const [budget, setBudget] = useState('');
  const [preferredCity, setPreferredCity] = useState('');

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  // Every state / city / course present in the database (with an offline fallback).
  const { states, cities, courses } = useCollegeFilters();

  const budgets = [
    { value: '2.5 Lakh / Year', label: 'Under 2.5 Lakh / Year' },
    { value: '3.5 Lakh / Year', label: 'Under 3.5 Lakh / Year' },
    { value: '4.5 Lakh / Year', label: 'Under 4.5 Lakh / Year' }
  ];

  const handleMatch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSearched(true);
    setError('');
    try {
      const res = await api.post('/colleges/recommendations', {
        state,
        course,
        budget,
        preferredCity
      });
      setResults(res.data);
    } catch (err) {
      console.error('Recommendations match query failed:', err);
      setResults([]);
      setError('Could not reach the recommendation service. Make sure the backend server is running and try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectTrigger =
    'mt-2 flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-line bg-background px-3.5 py-2.5 text-left text-sm font-normal text-foreground transition-colors duration-150 hover:border-line-strong';

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
      className="mx-auto max-w-5xl space-y-10 px-4 py-10 sm:px-6 lg:px-8"
    >
      {/* Header */}
      <motion.div {...fadeUp(0)} className="border-b border-line pb-8">
        <span className="text-[11px] font-medium uppercase tracking-wider text-faint">Match maker</span>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-foreground">
          Personalized recommendations
        </h1>
        <p className="mt-2 max-w-lg text-sm font-normal leading-relaxed text-muted">
          Set your course, budget and location preferences — we rank every indexed college against them.
        </p>
      </motion.div>

      {/* Input Form card */}
      <motion.div {...fadeUp(0.05)} className="rounded-2xl border border-line bg-card p-6 md:p-7">
        <form onSubmit={handleMatch} className="grid gap-6 md:grid-cols-2">
          {/* State */}
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-faint">State preference</label>
            <Dropdown
              value={state}
              onChange={setState}
              options={states.map((value) => ({ value, label: value }))}
              placeholder="Any state"
              triggerClassName={selectTrigger}
            />
          </div>

          {/* Preferred City */}
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-faint">Preferred city</label>
            <Dropdown
              value={preferredCity}
              onChange={setPreferredCity}
              options={cities.map((value) => ({ value, label: prettyLabel(value) }))}
              placeholder="Any city"
              triggerClassName={selectTrigger}
            />
          </div>

          {/* Preferred Course */}
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-faint">Desired stream / course</label>
            <Dropdown
              value={course}
              onChange={setCourse}
              options={courses.map((value) => ({ value, label: value }))}
              placeholder="Any course"
              triggerClassName={selectTrigger}
            />
          </div>

          {/* Budget */}
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-faint">Tuition budget limit</label>
            <Dropdown
              value={budget}
              onChange={setBudget}
              options={budgets}
              placeholder="Any budget"
              triggerClassName={selectTrigger}
            />
          </div>

          <div className="flex justify-end md:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-all duration-200 hover:opacity-85 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Finding matches…
                </>
              ) : (
                <>
                  Generate matches
                  <Sparkles size={14} />
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>

      {/* Results Section */}
      <div className="space-y-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map(n => (
              <div key={n} className="skeleton h-36 w-full rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-dashed border-line-strong py-16 text-center">
            <SearchX className="mx-auto mb-4 text-faint" size={36} />
            <h3 className="text-lg font-medium text-foreground">Couldn't load recommendations</h3>
            <p className="mt-1 text-sm font-normal text-muted">{error}</p>
          </div>
        ) : searched && results.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong py-16 text-center">
            <SearchX className="mx-auto mb-4 text-faint" size={36} />
            <h3 className="text-lg font-medium text-foreground">No matching colleges</h3>
            <p className="mt-1 text-sm font-normal text-muted">
              Try widening your budget or selecting a different course option.
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {results.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-faint">
                  Top matches, ranked for you
                </h3>

                {results.map((item, idx) => (
                  <motion.div
                    key={item._id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.08, duration: 0.45, ease: EASE }}
                    className="group flex flex-col items-start justify-between gap-6 rounded-2xl border border-line bg-card p-6 transition-all duration-200 hover:border-line-strong hover:shadow-[0_16px_40px_-20px_rgba(0,0,0,0.2)] sm:flex-row sm:items-center"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-line bg-subtle px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-foreground">
                          Match score {item.recommendationScore} pts
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted">
                          <Award size={11} className="text-faint" />
                          NIRF {rankLabel(item.nirfRanking || item.ranking?.nirf)}
                        </span>
                      </div>
                      <h4 className="mt-2.5 text-lg font-semibold tracking-[-0.01em] text-foreground">{item.name}</h4>
                      <p className="mt-1 flex items-center gap-1 text-xs font-normal text-muted">
                        <MapPin size={12} className="text-faint" />
                        {locationLabel(item.location)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      <div className="min-w-[110px] rounded-xl border border-line bg-subtle p-3">
                        <div className="text-[10px] font-medium uppercase tracking-wider text-faint">Avg pkg</div>
                        <div className="mt-0.5 font-mono text-xs font-medium text-foreground">{item.placements?.averagePackage || 'N/A'}</div>
                      </div>

                      <div className="min-w-[110px] rounded-xl border border-line bg-subtle p-3">
                        <div className="text-[10px] font-medium uppercase tracking-wider text-faint">Tuition</div>
                        <div className="mt-0.5 flex items-center gap-1 font-mono text-xs font-medium text-foreground">
                          <IndianRupee size={11} className="text-faint" />
                          {item.fees?.tuition?.split('/')[0] || item.fees?.tuitionFee || 'N/A'}
                        </div>
                      </div>

                      <Link
                        to={`/college/${item._id}`}
                        aria-label={`View ${item.name}`}
                        className="rounded-xl border border-line p-3 text-muted transition-all duration-150 hover:border-line-strong hover:text-foreground"
                      >
                        <ChevronRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                      </Link>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}
