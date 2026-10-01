import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Award, BookOpen, IndianRupee, Briefcase, Plus, Check, ArrowRight, Sparkles, RefreshCw, Database } from 'lucide-react';
import Hero from '../components/Hero';
import api from '../services/api';
import { locationLabel, nirfLabel, formatRupees, timeAgo } from '../lib/format';
import { EASE } from '../lib/motion';

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [compareList, setCompareList] = useState([]);
  const [dataset, setDataset] = useState(null);

  // Provenance banner: which open datasets the directory was built from, and
  // how fresh that data is.
  useEffect(() => {
    let cancelled = false;

    api.get('/colleges/dataset')
      .then(({ data }) => {
        if (!cancelled) setDataset(data);
      })
      .catch((err) => console.error('Dataset info unavailable:', err));

    return () => {
      cancelled = true;
    };
  }, []);

  // Free-text search handed over by the hero search box ("?q="): shown in the
  // heading and sent to the API.
  const searchTerm = new URLSearchParams(location.search).get('q') || '';

  // Parse filters from URL query parameters
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const state = searchParams.get('state') || '';
    const city = searchParams.get('city') || '';
    const course = searchParams.get('course') || '';
    const q = searchParams.get('q') || '';

    async function fetchColleges() {
      setLoading(true);
      try {
        const res = await api.get(
          `/colleges?state=${encodeURIComponent(state)}&city=${encodeURIComponent(city)}&course=${encodeURIComponent(course)}&q=${encodeURIComponent(q)}`
        );
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
      <div id="listings-section" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-faint">Directory</span>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-foreground">
              Explore colleges
            </h2>
            <p className="mt-1 text-sm font-normal text-muted">
              {searchTerm
                ? `Results for “${searchTerm}”`
                : location.search
                  ? 'Showing filtered results'
                  : 'Browse institutes across India'}
            </p>
            {dataset && (
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-normal text-faint">
                <Database size={12} className="shrink-0" />
                <span>{dataset.total.toLocaleString()} colleges indexed from open datasets</span>
                {dataset.lastSyncedAt && <span>· refreshed {timeAgo(dataset.lastSyncedAt)}</span>}
              </p>
            )}
          </div>

          {location.search && (
            <button
              onClick={clearFilters}
              className="flex cursor-pointer items-center gap-1.5 self-start rounded-lg border border-line px-3.5 py-2 text-xs font-medium text-muted transition-colors duration-150 hover:border-line-strong hover:text-foreground"
            >
              <RefreshCw size={12} />
              Clear filters
            </button>
          )}
        </div>

        {/* Skeleton Loader Grid */}
        {loading ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="skeleton h-72 w-full rounded-2xl" />
            ))}
          </div>
        ) : colleges.length === 0 ? (
          /* Empty State */
          <div className="mt-16 text-center">
            <BookOpen className="mx-auto mb-4 text-faint" size={40} />
            <h3 className="text-lg font-semibold text-foreground">No colleges found</h3>
            <p className="mx-auto mt-1 max-w-md text-sm font-normal text-muted">
              {searchTerm
                ? `Nothing in the directory matches “${searchTerm}”. Check the spelling, try a shorter term, or add the college from the admin dashboard.`
                : "We couldn't find colleges matching your criteria. Try loosening your filters or importing colleges via the admin dashboard."}
            </p>
          </div>
        ) : (
          /* Listings Grid */
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
            className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {colleges.map((college) => {
              const isSelectedForCompare = compareList.some(c => c._id === college._id);
              return (
                <motion.article
                  key={college._id}
                  variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } } }}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-line bg-card p-6 transition-shadow duration-300 hover:shadow-[0_20px_48px_-20px_rgba(26,26,26,0.12)]"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="inline-block rounded-md border border-line bg-subtle px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted">
                          {college.instituteType}
                        </span>
                        <h3 className="mt-2.5 text-lg font-semibold leading-snug tracking-[-0.01em] text-foreground">
                          <Link to={`/college/${college._id}`} className="transition-opacity duration-150 hover:opacity-70">
                            {college.name}
                          </Link>
                        </h3>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 font-mono text-xs font-medium text-foreground">
                        <Award size={13} className="text-faint" />
                        <span>{nirfLabel(college)}</span>
                      </div>
                    </div>

                    {/* Meta info */}
                    <div className="mt-4 space-y-2.5">
                      <div className="flex items-center gap-2 text-xs font-normal text-muted">
                        <MapPin size={13} className="shrink-0 text-faint" />
                        <span>{locationLabel(college.location)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-normal text-muted">
                        <IndianRupee size={13} className="shrink-0 text-faint" />
                        <span>{college.fees?.tuition || college.fees?.tuitionFee || 'Fees not reported'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-normal text-muted">
                        <Briefcase size={13} className="shrink-0 text-faint" />
                        <span>
                          {college.placements?.nirf?.medianSalary
                            ? `Median salary ${formatRupees(college.placements.nirf.medianSalary)} (NIRF)`
                            : `Avg package ${college.placements?.averagePackage || 'not reported'}`}
                        </span>
                      </div>
                    </div>

                    {/* Courses Tags */}
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {college.courses?.slice(0, 2).map((course, idx) => (
                        <span key={idx} className="rounded-md bg-subtle px-2 py-0.5 text-[10px] font-medium text-muted">
                          {course.replace('Engineering', 'Engg')}
                        </span>
                      ))}
                      {college.courses?.length > 2 && (
                        <span className="rounded-md bg-subtle px-2 py-0.5 text-[10px] font-medium text-faint">
                          +{college.courses.length - 2} more
                        </span>
                      )}
                      {!college.courses?.length && (
                        <span className="rounded-md bg-subtle px-2 py-0.5 text-[10px] font-medium text-faint">
                          {college.website ? 'Course list on the official site' : 'Courses not reported'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4">
                    <Link
                      to={`/college/${college._id}`}
                      className="flex items-center gap-1 text-xs font-medium text-muted transition-colors duration-150 hover:text-foreground"
                    >
                      View details
                      <ArrowRight size={12} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                    </Link>

                    <button
                      onClick={() => toggleCompare(college)}
                      className={`flex cursor-pointer items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150 active:scale-[0.97] ${
                        isSelectedForCompare
                          ? 'bg-foreground text-background'
                          : 'border border-line bg-transparent text-muted hover:border-line-strong hover:text-foreground'
                      }`}
                    >
                      {isSelectedForCompare ? <Check size={12} /> : <Plus size={12} />}
                      Compare
                    </button>
                  </div>
                </motion.article>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* Floating Compare Panel */}
      <AnimatePresence>
        {compareList.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="fixed bottom-6 left-1/2 z-40 w-full max-w-xl -translate-x-1/2 px-4"
          >
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-card-elevated p-4 shadow-[0_24px_56px_-22px_rgba(26,26,26,0.2)]">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground text-background">
                  <Sparkles size={15} />
                </span>
                <div>
                  <div className="text-sm font-medium text-foreground">
                    Compare colleges ({compareList.length}/2)
                  </div>
                  <div className="text-xs font-normal text-muted">
                    {compareList.map(c => c.shortName || c.name.split(' ')[0]).join(' vs ')}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCompareList([])}
                  className="cursor-pointer rounded-lg px-3 py-2 text-xs font-medium text-muted transition-colors duration-150 hover:text-foreground"
                >
                  Clear
                </button>
                <button
                  onClick={startComparison}
                  disabled={compareList.length < 2}
                  className="flex cursor-pointer items-center gap-1 rounded-lg bg-foreground px-4 py-2.5 text-xs font-medium text-background transition-all duration-200 hover:opacity-85 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
                >
                  Compare now
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* RAG Assistant Promo Section */}
      <section className="border-t border-line py-20">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-8 px-4 sm:px-6 md:flex-row md:items-center lg:px-8">
          <div className="max-w-md">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1 text-xs font-medium text-muted">
              <Sparkles size={11} className="text-foreground" />
              Instant AI chat
            </span>
            <h3 className="mt-4 text-2xl font-semibold tracking-[-0.02em] text-foreground">
              Confused about details? Ask the assistant.
            </h3>
            <p className="mt-2 text-sm font-normal leading-relaxed text-muted">
              Query specific fees, hostel rules, packages, or facilities. The assistant performs RAG search over real, verified campus data.
            </p>
          </div>
          <Link
            to="/chat"
            className="group flex items-center gap-2 rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-all duration-200 hover:opacity-85 active:scale-[0.98]"
          >
            Start chatting
            <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
