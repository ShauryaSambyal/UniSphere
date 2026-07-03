import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, MapPin, Award, IndianRupee, Briefcase, ChevronRight, Settings } from 'lucide-react';
import api from '../services/api';

export default function Recommendations() {
  // Input states
  const [state, setState] = useState('');
  const [course, setCourse] = useState('');
  const [budget, setBudget] = useState('');
  const [preferredCity, setPreferredCity] = useState('');
  
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const states = ['Karnataka', 'Maharashtra'];
  const cities = ['Bangalore', 'Mumbai'];
  const courses = [
    { value: 'Computer Science Engineering', label: 'Computer Science Engineering' },
    { value: 'Information Science Engineering', label: 'Information Science Engineering' },
    { value: 'Electronics & Communication Engineering', label: 'Electronics & Communication Engineering' },
    { value: 'Bachelor of Business Administration', label: 'BBA / MBA Management' }
  ];

  const budgets = [
    { value: '2.5 Lakh / Year', label: 'Under 2.5 Lakh / Year' },
    { value: '3.5 Lakh / Year', label: 'Under 3.5 Lakh / Year' },
    { value: '4.5 Lakh / Year', label: 'Under 4.5 Lakh / Year' }
  ];

  const handleMatch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSearched(true);
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 space-y-10">
      {/* Header */}
      <div className="border-b border-gray-200/50 pb-6 dark:border-white/10">
        <h1 className="font-sans text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
          <Sparkles size={28} className="text-brand-light dark:text-brand-light animate-pulse" />
          <span>Match Maker Recommendations</span>
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Discover personalized college suggestions matching your course, budget, and location preferences</p>
      </div>

      {/* Input Form card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-darkbg-card/45 backdrop-blur-md">
        <form onSubmit={handleMatch} className="grid gap-6 md:grid-cols-2">
          {/* State */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider dark:text-gray-400">State Preference</label>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white py-3 px-4 text-xs text-gray-950 outline-none focus:border-brand-light focus:ring-2 focus:ring-brand-light/20 dark:border-white/10 dark:bg-[#131313] dark:text-white transition-all duration-200"
            >
              <option value="">Any State</option>
              {states.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Preferred City */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider dark:text-gray-400">Preferred City</label>
            <select
              value={preferredCity}
              onChange={(e) => setPreferredCity(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white py-3 px-4 text-xs text-gray-950 outline-none focus:border-brand-light focus:ring-2 focus:ring-brand-light/20 dark:border-white/10 dark:bg-[#131313] dark:text-white transition-all duration-200"
            >
              <option value="">Any City</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Preferred Course */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider dark:text-gray-400">Desired Stream / Course</label>
            <select
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white py-3 px-4 text-xs text-gray-950 outline-none focus:border-brand-light focus:ring-2 focus:ring-brand-light/20 dark:border-white/10 dark:bg-[#131313] dark:text-white transition-all duration-200"
            >
              <option value="">Any Course</option>
              {courses.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          {/* Budget */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider dark:text-gray-400">Tuition Budget Limit</label>
            <select
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white py-3 px-4 text-xs text-gray-950 outline-none focus:border-brand-light focus:ring-2 focus:ring-brand-light/20 dark:border-white/10 dark:bg-[#131313] dark:text-white transition-all duration-200"
            >
              <option value="">Any Budget</option>
              {budgets.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </div>

          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-light via-brand-accent to-brand-purple px-8 py-3.5 text-xs font-bold text-gray-950 shadow-lg shadow-brand-light/10 hover:brightness-110 active:scale-[0.98] transition-all duration-200 cursor-pointer"
            >
              {loading ? 'Finding matches...' : 'Generate AI Matches'}
              <Sparkles size={14} />
            </button>
          </div>
        </form>
      </div>

      {/* Results Section */}
      <div className="space-y-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map(n => (
              <div key={n} className="h-40 w-full animate-pulse rounded-3xl bg-gray-200/50 dark:bg-white/5" />
            ))}
          </div>
        ) : searched && results.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-gray-200 rounded-3xl dark:border-white/10">
            <Settings className="mx-auto text-gray-400 mb-4 animate-spin" style={{ animationDuration: '6s' }} size={48} />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">No Matching Colleges</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Try widening your budget or selecting a different course option.</p>
          </div>
        ) : (
          <AnimatePresence>
            {results.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                <h3 className="font-sans text-xs font-bold text-gray-400 uppercase tracking-wider">Top matching colleges ranked for you</h3>
                
                {results.map((item, idx) => (
                  <motion.div
                    key={item._id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 rounded-3xl border border-gray-200/80 bg-white p-6 dark:border-white/10 dark:bg-darkbg-card/45 backdrop-blur-sm hover:border-brand-light/35 transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-full bg-brand-light/10 border border-brand-light/20 px-3 py-0.5 text-[10px] font-bold text-brand-light">
                          Match Score: {item.recommendationScore} pts
                        </span>
                        <span className="inline-flex items-center gap-0.5 text-yellow-500 font-mono text-[10px] bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20">
                          <Award size={10} />
                          NIRF Rank: #{item.nirfRanking}
                        </span>
                      </div>
                      <h4 className="mt-2 text-lg font-extrabold text-gray-950 dark:text-white">{item.name}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 flex items-center gap-1 font-medium">
                        <MapPin size={12} className="text-brand-light" />
                        {item.location.city}, {item.location.state}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-6 text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1.5 bg-gray-50 p-3 rounded-xl dark:bg-white/5 min-w-[120px] border border-gray-100 dark:border-white/5">
                        <Briefcase size={16} className="text-brand-light" />
                        <div>
                          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Average pkg</div>
                          <div className="font-mono text-gray-950 dark:text-white text-xs font-extrabold mt-0.5">{item.placements?.averagePackage}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 bg-gray-50 p-3 rounded-xl dark:bg-white/5 min-w-[120px] border border-gray-100 dark:border-white/5">
                        <IndianRupee size={16} className="text-brand-accent" />
                        <div>
                          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Tuition Fee</div>
                          <div className="font-mono text-gray-950 dark:text-white text-xs font-extrabold mt-0.5">{item.fees?.tuition.split('/')[0]}</div>
                        </div>
                      </div>

                      <Link
                        to={`/college/${item._id}`}
                        className="rounded-xl bg-gray-100 p-3 text-gray-700 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 transition-all border border-transparent dark:border-white/5 cursor-pointer"
                      >
                        <ChevronRight size={18} />
                      </Link>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
