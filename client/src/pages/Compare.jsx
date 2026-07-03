import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Check, X, Search } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function Compare() {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedColleges, setSelectedColleges] = useState([]);

  useEffect(() => {
    const fetchResults = async () => {
      if (query.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      try {
        const { data } = await axios.get(`http://localhost:5000/api/colleges/search?q=${encodeURIComponent(query)}&limit=5`);
        setSearchResults(data);
      } catch (err) {
        console.error(err);
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
    "Avg Package (LPA)": parseFloat(c.placements?.averagePackage) || 0,
    "Highest Package (LPA)": parseFloat(c.placements?.highestPackage) || 0,
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fade-in">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold mb-4 text-gradient">Compare Colleges</h1>
        <p className="text-gray-500 dark:text-gray-400">Select up to 3 colleges to compare side-by-side.</p>
        
        <div className="relative max-w-xl mx-auto mt-6">
          <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-400 focus-within:text-brand-light" />
          <input
            type="text"
            className="w-full pl-12 pr-4 py-3.5 glass-card focus:outline-none focus:ring-2 focus:ring-brand-light/50 focus:border-transparent text-foreground placeholder-gray-400 text-sm dark:bg-darkbg-card/45 dark:border-white/10"
            placeholder="Search college to add..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {searchResults.length > 0 && (
            <ul className="absolute top-full left-0 w-full mt-2 rounded-2xl overflow-hidden shadow-2xl bg-white/95 dark:bg-darkbg-card/90 backdrop-blur-[20px] border border-gray-200/80 dark:border-white/10 dark:shadow-[0_12px_40px_rgba(0,0,0,0.5),0_0_20px_rgba(0,245,255,0.08)] z-50 text-left p-1.5">
              {searchResults.map(c => (
                <li
                  key={c._id}
                  onClick={() => addCollege(c)}
                  className="px-4 py-2.5 hover:bg-gradient-to-r hover:from-brand-light/10 hover:to-brand-purple/5 hover:text-brand-light transition-all duration-200 rounded-xl cursor-pointer text-foreground text-sm font-medium"
                >
                  {c.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {selectedColleges.length > 0 ? (
        <div className="space-y-12">
          {/* Comparison Table */}
          <div className="rounded-3xl border border-gray-200/80 dark:border-white/10 bg-white dark:bg-darkbg-card/45 backdrop-blur-sm overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200/80 dark:border-white/10 bg-gray-50/50 dark:bg-black/25">
                    <th className="p-4 font-bold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Feature</th>
                    {selectedColleges.map(c => (
                      <th key={c._id} className="p-4 font-extrabold text-base text-foreground relative min-w-[200px]">
                        {c.shortName || c.name}
                        <button onClick={() => removeCollege(c._id)} className="absolute top-4 right-4 text-gray-400 hover:text-brand-accent transition-colors cursor-pointer"><X className="h-4 w-4"/></button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200/50 dark:divide-white/5 text-foreground text-sm font-medium">
                  <tr>
                    <td className="p-4 text-gray-500 dark:text-gray-400">NIRF Ranking</td>
                    {selectedColleges.map(c => <td key={c._id} className="p-4 font-mono text-xs">{c.ranking?.nirf || c.nirfRanking || 'N/A'}</td>)}
                  </tr>
                  <tr>
                    <td className="p-4 text-gray-500 dark:text-gray-400">Institute Type</td>
                    {selectedColleges.map(c => <td key={c._id} className="p-4"><span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-brand-purple/10 text-brand-purple dark:text-brand-light dark:bg-brand-light/5 px-2 py-0.5 rounded border border-brand-purple/10 dark:border-brand-light/10">{c.instituteType || 'Autonomous'}</span></td>)}
                  </tr>
                  <tr>
                    <td className="p-4 text-gray-500 dark:text-gray-400">Location</td>
                    {selectedColleges.map(c => <td key={c._id} className="p-4">{c.location?.city}, {c.location?.state}</td>)}
                  </tr>
                  <tr>
                    <td className="p-4 text-gray-500 dark:text-gray-400">Tuition Fee</td>
                    {selectedColleges.map(c => <td key={c._id} className="p-4 text-brand-light font-mono text-xs">{c.fees?.tuitionFee || c.fees?.tuition || 'N/A'}</td>)}
                  </tr>
                  <tr>
                    <td className="p-4 text-gray-500 dark:text-gray-400">Average Package</td>
                    {selectedColleges.map(c => <td key={c._id} className="p-4 text-brand-accent font-mono text-xs">{c.placements?.averagePackage || 'N/A'}</td>)}
                  </tr>
                  <tr>
                    <td className="p-4 text-gray-500 dark:text-gray-400">Hostel Available</td>
                    {selectedColleges.map(c => (
                      <td key={c._id} className="p-4">
                        {c.hostel?.available !== false ? <Check className="text-brand-light h-5 w-5"/> : <X className="text-brand-accent h-5 w-5"/>}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Placements Chart */}
          <div className="rounded-3xl border border-gray-200/80 dark:border-white/10 bg-white dark:bg-darkbg-card/45 backdrop-blur-sm p-6 shadow-sm">
            <h2 className="text-2xl font-bold mb-6">Placements Comparison</h2>
            <div className="h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" opacity={0.15} />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis tickFormatter={(val) => `${val}L`} stroke="#94a3b8" />
                  <Tooltip cursor={{fill: 'rgba(255,255,255,0.03)'}} contentStyle={{backgroundColor: '#0a0c10', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff'}} />
                  <Legend />
                  <Bar dataKey="Avg Package (LPA)" fill="var(--color-brand-light)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Highest Package (LPA)" fill="var(--color-brand-purple)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 rounded-3xl border border-gray-200/80 dark:border-white/10 bg-white dark:bg-darkbg-card/45 backdrop-blur-sm shadow-sm">
          <p className="text-xl text-gray-400 font-semibold">Search and add colleges to start comparing.</p>
        </div>
      )}
    </div>
  );
}
