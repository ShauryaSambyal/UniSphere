import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Award, BookOpen, IndianRupee, Briefcase, Plus, Check, ArrowRight, Sparkles, LayoutList, RefreshCw } from 'lucide-react';
import Hero from '../components/Hero';
import api from '../services/api';

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [compareList, setCompareList] = useState([]);

  // Parse filters from URL query parameters
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const state = searchParams.get('state') || '';
    const city = searchParams.get('city') || '';
    const course = searchParams.get('course') || '';

    async function fetchColleges() {
      setLoading(true);
      try {
        const res = await api.get(`/colleges?state=${state}&city=${city}&course=${course}`);
        setColleges(res.data);
      } catch (err) {
        console.error('Error fetching colleges:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchColleges();
  }, [location.search]);

  // Toggle college selection for compare
  const toggleCompare = (college) => {
    setCompareList(prev => {
      const exists = prev.find(c => c._id === college._id);
      if (exists) {
        return prev.filter(c => c._id !== college._id);
      }
      if (prev.length >= 2) {
        // Swap or alert (max 2 colleges)
        return [prev[1], college];
      }
      return [...prev, college];
    });
  };

  const startComparison = () => {
    if (compareList.length === 2) {
      navigate(`/compare?a=${compareList[0]._id}&b=${compareList[1]._id}`);
    }
  };

  // Clear filters helper
  const clearFilters = () => {
    navigate('/');
  };

  return (
    <div className="relative min-h-screen pb-20">
      {/* Hero Banner with Autocomplete */}
      <Hero />

      {/* Main Listings and Filters Section */}
      <div id="listings-section" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200/50 pb-6 dark:border-white/5">
          <div>
            <h2 className="font-sans text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <LayoutList size={22} className="text-brand-light dark:text-brand-accent" />
              <span>Explore Colleges</span>
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {location.search ? 'Showing filtered results' : 'Browse highly ranked institutes across India'}
            </p>
          </div>

          {location.search && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 self-start rounded-xl border border-gray-200 px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
            >
              <RefreshCw size={12} />
              Clear Filters
            </button>
          )}
        </div>

        {/* Skeleton Loader Grid */}
        {loading ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-80 w-full animate-pulse rounded-2xl bg-gray-200/50 dark:bg-white/5" />
            ))}
          </div>
        ) : colleges.length === 0 ? (
          /* Empty State */
          <div className="mt-16 text-center">
            <BookOpen className="mx-auto text-gray-400 dark:text-gray-600 mb-4" size={48} />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">No Colleges Found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              We couldn't find colleges matching your criteria. Try loosening your filters or importing colleges via the admin dashboard.
            </p>
          </div>
        ) : (
          /* Listings Grid */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {colleges.map((college) => {
              const isSelectedForCompare = compareList.some(c => c._id === college._id);
              return (
                <motion.div
                  key={college._id}
                  whileHover={{ y: -4 }}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-white/5 dark:bg-darkbg-card transition-all duration-200"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="inline-block rounded-lg bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600 dark:bg-white/5 dark:text-gray-400">
                          {college.instituteType}
                        </span>
                        <h3 className="mt-2 font-sans text-lg font-bold text-gray-900 group-hover:text-brand-light dark:text-white dark:group-hover:text-brand-accent transition-colors duration-150">
                          <Link to={`/college/${college._id}`}>
                            {college.name}
                          </Link>
                        </h3>
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1 text-yellow-500 font-bold text-sm">
                          <Award size={16} />
                          <span>NIRF #{college.nirfRanking}</span>
                        </div>
                      </div>
                    </div>

                    {/* Meta info */}
                    <div className="mt-4 space-y-2.5">
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <MapPin size={14} className="shrink-0 text-gray-400" />
                        <span>{college.location.city}, {college.location.state}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <IndianRupee size={14} className="shrink-0 text-gray-400" />
                        <span>{college.fees?.tuition} (Tuition)</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <Briefcase size={14} className="shrink-0 text-gray-400" />
                        <span>Avg Package: {college.placements?.averagePackage}</span>
                      </div>
                    </div>

                    {/* Courses Tags */}
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {college.courses?.slice(0, 2).map((course, idx) => (
                        <span key={idx} className="rounded-md bg-brand-light/5 px-2 py-0.5 text-[10px] font-semibold text-brand-light dark:bg-brand-accent/5 dark:text-brand-accent">
                          {course.replace('Engineering', 'Engg')}
                        </span>
                      ))}
                      {college.courses?.length > 2 && (
                        <span className="rounded-md bg-gray-50 px-2 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-white/5 dark:text-gray-400">
                          +{college.courses.length - 2} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="mt-6 flex items-center justify-between gap-3 border-t border-gray-100 pt-4 dark:border-white/5">
                    <Link
                      to={`/college/${college._id}`}
                      className="text-xs font-bold text-gray-600 hover:text-brand-light dark:text-gray-400 dark:hover:text-brand-accent flex items-center gap-1 transition-colors duration-150"
                    >
                      View Details
                      <ArrowRight size={12} />
                    </Link>

                    <button
                      onClick={() => toggleCompare(college)}
                      className={`flex items-center gap-1 rounded-xl px-3.5 py-1.5 text-xs font-semibold active:scale-[0.97] transition-all duration-150
                        ${isSelectedForCompare
                          ? 'bg-green-500 text-white shadow shadow-green-500/20'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10'
                        }
                      `}
                    >
                      {isSelectedForCompare ? <Check size={12} /> : <Plus size={12} />}
                      Compare
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* Floating Compare Panel */}
      <AnimatePresence>
        {compareList.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 z-40 w-full max-w-xl -translate-x-1/2 px-4"
          >
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/20 bg-white/90 p-4 shadow-2xl backdrop-blur-md dark:border-white/5 dark:bg-darkbg-card/90">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-brand-light/10 p-2 text-brand-light dark:bg-brand-accent/10 dark:text-brand-accent">
                  <LayoutList size={20} />
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white">
                    Compare Colleges ({compareList.length}/2)
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {compareList.map(c => c.shortName || c.name.split(' ')[0]).join(' vs ')}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCompareList([])}
                  className="rounded-xl px-3 py-2 text-xs font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                >
                  Clear
                </button>
                <button
                  onClick={startComparison}
                  disabled={compareList.length < 2}
                  className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-brand-light to-brand-accent px-4 py-2.5 text-xs font-semibold text-white shadow-lg disabled:opacity-50 disabled:pointer-events-none hover:brightness-110 active:scale-[0.98] transition-all duration-200"
                >
                  Compare Now
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* RAG Assistant Promo Section */}
      <div className="bg-gradient-to-r from-brand-light/5 via-brand-accent/5 to-transparent border-y border-gray-200/50 py-16 dark:border-white/5">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-md">
            <div className="inline-flex items-center gap-1 rounded-full bg-brand-light/10 px-3 py-1 text-xs font-semibold text-brand-light dark:text-brand-accent">
              <Sparkles size={12} />
              <span>Instant AI Chat</span>
            </div>
            <h3 className="mt-3 font-sans text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Confused about details? Ask our assistant.
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Query specific fees, hostel rules, packages, or facilities. Our assistant performs RAG searching over real verified data.
            </p>
          </div>
          <Link
            to="/chat"
            className="flex items-center gap-2 rounded-xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 transition-all duration-200"
          >
            Start Chatting
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
