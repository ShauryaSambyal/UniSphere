import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../services/api';
import { Check, X, Search, Plus, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { fadeUp } from '../lib/motion';

export default function Compare() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedColleges, setSelectedColleges] = useState([]);
  const [searchError, setSearchError] = useState('');

  // Home's "Compare now" button links here with ?a=<id>&b=<id>: preload those
  // colleges so the comparison is ready immediately instead of empty.
  useEffect(() => {
    const ids = ['a', 'b']
      .map((key) => searchParams.get(key))
      .filter(Boolean);

    if (ids.length === 0) return undefined;

    let cancelled = false;
    api.get(`/colleges/batch?ids=${ids.join(',')}`)
      .then(({ data }) => {
        if (!cancelled) setSelectedColleges(data.slice(0, 3));
      })
      .catch((err) => {
        console.error('Failed to preload comparison colleges:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    const fetchResults = async () => {
      if (query.trim().length < 2) {
        setSearchResults([]);
        setSearchError('');
        return;
      }
      try {
        const { data } = await api.get(`/colleges/search?q=${encodeURIComponent(query)}&limit=5`);
        setSearchResults(data);
        setSearchError('');
      } catch (err) {
        console.error(err);
        setSearchResults([]);
        setSearchError('Could not search colleges. Make sure the backend server is running.');
      }
    };
    const debounce = setTimeout(fetchResults, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  const addCollege = (college) => {
    if (selectedColleges.length < 3 && !selectedColleges.find(c => c._id === college._id)) {
      setSelectedColleges([...selectedColleges, college]);
    }
    setQuery('');
    setSearchResults([]);
  };

  const removeCollege = (id) => {
    setSelectedColleges(selectedColleges.filter(c => c._id !== id));
  };

  const chartData = selectedColleges.map(c => ({
    name: c.shortName || c.name.split(' ')[0],
    'Avg Package (LPA)': parseFloat(c.placements?.averagePackage) || 0,
    'Highest Package (LPA)': parseFloat(c.placements?.highestPackage) || 0,
  }));

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
      className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"
    >
      <motion.div {...fadeUp(0)} className="mb-10 text-center">
        <span className="text-[11px] font-medium uppercase tracking-wider text-faint">Side by side</span>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-foreground md:text-4xl">
          Compare colleges
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm font-normal text-muted">
          Select up to 3 colleges to compare fees, packages and rankings.
        </p>

        <div className="relative mx-auto mt-7 max-w-xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint" size={16} />
          <input
            type="text"
            className="w-full rounded-xl border border-line bg-card py-3 pl-11 pr-4 text-sm font-normal text-foreground outline-none transition-colors duration-150 placeholder:text-faint focus:border-line-strong"
            placeholder="Search college to add…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query.trim().length >= 2 && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <Loader2 size={14} className="animate-spin text-faint" />
            </div>
          )}
          {searchResults.length > 0 && (
            <ul className="absolute left-0 top-full z-50 mt-2 w-full overflow-hidden rounded-2xl border border-line bg-card-elevated p-1.5 text-left shadow-[0_24px_56px_-24px_rgba(26,26,26,0.22)]">
              {searchResults.map(c => (
                <li
                  key={c._id}
                  onClick={() => addCollege(c)}
                  className="group flex cursor-pointer items-center justify-between rounded-xl px-4 py-2.5 text-sm font-normal text-foreground transition-colors duration-150 hover:bg-subtle"
                >
                  {c.name}
                  <Plus size={13} className="text-faint transition-colors group-hover:text-foreground" />
                </li>
              ))}
            </ul>
          )}
          {searchError && (
            <p className="mt-3 text-xs font-normal text-red-500">{searchError}</p>
          )}
        </div>

        {/* Selected chips */}
        {selectedColleges.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {selectedColleges.map(c => (
              <button
                key={c._id}
                onClick={() => removeCollege(c._id)}
                className="group flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-card px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors duration-150 hover:border-red-300 hover:text-red-600"
                title="Remove"
              >
                {c.shortName || c.name.split(' ')[0]}
                <X size={12} className="text-faint group-hover:text-red-500" />
              </button>
            ))}
          </div>
        )}
      </motion.div>

      {selectedColleges.length > 0 ? (
        <div className="space-y-10">
          {/* Comparison Table */}
          <motion.div {...fadeUp(0.05)} className="overflow-hidden rounded-2xl border border-line bg-card">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-line bg-subtle">
                    <th className="p-4 text-[11px] font-medium uppercase tracking-wider text-faint">Feature</th>
                    {selectedColleges.map(c => (
                      <th key={c._id} className="relative min-w-[200px] p-4 text-base font-semibold tracking-[-0.01em] text-foreground">
                        {c.shortName || c.name}
                        <button
                          onClick={() => removeCollege(c._id)}
                          aria-label={`Remove ${c.shortName || c.name}`}
                          className="absolute right-4 top-4 cursor-pointer text-faint transition-colors duration-150 hover:text-foreground"
                        >
                          <X size={14} />
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-sm">
                  <tr>
                    <td className="p-4 font-normal text-muted">NIRF ranking</td>
                    {selectedColleges.map(c => <td key={c._id} className="p-4 font-mono text-xs text-foreground">{c.ranking?.nirf || c.nirfRanking || 'N/A'}</td>)}
                  </tr>
                  <tr>
                    <td className="p-4 font-normal text-muted">Institute type</td>
                    {selectedColleges.map(c => (
                      <td key={c._id} className="p-4">
                        <span className="rounded-md border border-line bg-subtle px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted">{c.instituteType || 'Autonomous'}</span>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-4 font-normal text-muted">Location</td>
                    {selectedColleges.map(c => <td key={c._id} className="p-4 font-normal text-foreground">{c.location?.city}, {c.location?.state}</td>)}
                  </tr>
                  <tr>
                    <td className="p-4 font-normal text-muted">Tuition fee</td>
                    {selectedColleges.map(c => <td key={c._id} className="p-4 font-medium text-foreground">{c.fees?.tuitionFee || c.fees?.tuition || 'N/A'}</td>)}
                  </tr>
                  <tr>
                    <td className="p-4 font-normal text-muted">Average package</td>
                    {selectedColleges.map(c => <td key={c._id} className="p-4 font-medium text-foreground">{c.placements?.averagePackage || 'N/A'}</td>)}
                  </tr>
                  <tr>
                    <td className="p-4 font-normal text-muted">Hostel available</td>
                    {selectedColleges.map(c => (
                      <td key={c._id} className="p-4">
                        {c.hostel?.available !== false
                          ? <Check size={16} className="text-foreground" />
                          : <X size={16} className="text-faint" />}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Placements Chart */}
          <motion.div {...fadeUp(0.1)} className="rounded-2xl border border-line bg-card p-6 md:p-7">
            <h2 className="mb-6 text-lg font-semibold tracking-[-0.01em] text-foreground">Placements comparison</h2>
            <div className="h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 8, left: -16, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="2 6" stroke="var(--color-line-strong)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
                  />
                  <YAxis
                    tickFormatter={(val) => `${val}L`}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--color-subtle)' }}
                    contentStyle={{
                      backgroundColor: 'var(--color-card-elevated)',
                      border: '1px solid var(--color-line-strong)',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: 'var(--color-foreground)',
                    }}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', color: 'var(--color-muted)' }} />
                  <Bar dataKey="Avg Package (LPA)" fill="var(--color-foreground)" radius={[6, 6, 0, 0]} maxBarSize={56} />
                  <Bar dataKey="Highest Package (LPA)" fill="var(--color-faint)" radius={[6, 6, 0, 0]} maxBarSize={56} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>
      ) : (
        <motion.div {...fadeUp(0.05)} className="rounded-2xl border border-dashed border-line-strong py-24 text-center">
          <p className="text-lg font-medium text-muted">Search and add colleges to start comparing.</p>
          <p className="mt-1 text-sm font-normal text-faint">Up to 3 institutions side by side.</p>
        </motion.div>
      )}
    </motion.div>
  );
}
