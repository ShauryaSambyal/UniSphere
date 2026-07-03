import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import { MapPin, Trophy, DollarSign, Building2, BookOpen, Star, Activity, Coffee } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function CollegeDetails() {
  const { id } = useParams();
  const [college, setCollege] = useState(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    const fetchCollege = async () => {
      try {
        const { data } = await api.get(`/colleges/${id}`);
        setCollege(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCollege();
  }, [id]);

  const generateSummary = async () => {
    setSummaryLoading(true);
    try {
      const { data } = await api.post(`/generate-summary/${id}`);
      setCollege(prev => ({ ...prev, aiSummary: data.summary }));
    } catch (err) {
      console.error(err);
    } finally {
      setSummaryLoading(false);
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  if (!college) return <div className="text-center py-20 text-xl">College not found</div>;

  const placementData = [
    { name: 'Average', value: parseFloat(college.placements?.averagePackage) || 0 },
    { name: 'Median', value: parseFloat(college.placements?.medianPackage) || 0 },
    { name: 'Highest', value: parseFloat(college.placements?.highestPackage) || 0 },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fade-in">
      {/* Header Section */}
      <div className="glass-card p-8 mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px] rounded-full pointer-events-none"></div>
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gradient">{college.name}</h1>
        <div className="flex flex-wrap items-center gap-4 text-gray-600 dark:text-gray-300">
          <span className="flex items-center gap-1"><MapPin className="h-5 w-5 text-primary" /> {college.location?.city}, {college.location?.state}</span>
          <span className="flex items-center gap-1"><Building2 className="h-5 w-5 text-primary" /> {college.instituteType || 'Unknown Type'}</span>
          <span className="flex items-center gap-1"><Trophy className="h-5 w-5 text-primary" /> NIRF Rank: {college.ranking?.nirf || college.nirfRanking || 'N/A'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* AI Summary */}
          <div className="glass-card p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold flex items-center gap-2"><Star className="h-6 w-6 text-primary" /> AI Summary</h2>
              {!college.aiSummary && (
                <button onClick={generateSummary} disabled={summaryLoading} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2">
                  {summaryLoading && <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />}
                  Generate Summary
                </button>
              )}
            </div>
            {college.aiSummary ? (
              <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{college.aiSummary}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-gray-500 italic">No summary available. Click generate to create one using Llama API.</p>
            )}
          </div>

          {/* Placements Chart */}
          <div className="glass-card p-6">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2"><Activity className="h-6 w-6 text-primary" /> Placements Overview</h2>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={placementData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" opacity={0.2} />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis tickFormatter={(val) => `${val}L`} stroke="#94a3b8" />
                  <RechartsTooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{backgroundColor: '#151d30', borderColor: '#334155', color: '#fff'}} />
                  <Bar dataKey="value" fill="var(--color-brand-light)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 text-center text-sm text-gray-500">Placement Rate: {college.placements?.placementPercentage || 'N/A'}</div>
          </div>
          
          {/* Courses */}
          <div className="glass-card p-6">
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2"><BookOpen className="h-6 w-6 text-primary" /> Courses Offered</h2>
            <div className="flex flex-wrap gap-2">
              {college.courses?.map((c, i) => (
                <span key={i} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium border border-primary/20">{c}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          {/* Fees & Hostel */}
          <div className="glass-card p-6">
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2"><DollarSign className="h-6 w-6 text-primary" /> Fees & Hostel</h2>
            <ul className="space-y-4">
              <li className="flex justify-between items-center border-b border-border pb-2">
                <span className="text-gray-500">Tuition Fee</span>
                <span className="font-medium">{college.fees?.tuitionFee || college.fees?.tuition || 'N/A'}</span>
              </li>
              <li className="flex justify-between items-center border-b border-border pb-2">
                <span className="text-gray-500">Hostel Fee</span>
                <span className="font-medium">{college.fees?.hostelFee || college.fees?.hostel || 'N/A'}</span>
              </li>
              <li className="flex justify-between items-center pb-2">
                <span className="text-gray-500">Total Fee</span>
                <span className="font-medium">{college.fees?.totalFee || 'N/A'}</span>
              </li>
            </ul>
            <div className="mt-4 pt-4 border-t border-border">
              <h3 className="font-medium mb-2">Hostel Availability:</h3>
              <div className="flex gap-4 text-sm">
                <span className={`px-2 py-1 rounded ${college.hostel?.boysHostel ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>Boys</span>
                <span className={`px-2 py-1 rounded ${college.hostel?.girlsHostel ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>Girls</span>
              </div>
            </div>
          </div>

          {/* Nearby Places */}
          <div className="glass-card p-6">
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2"><Coffee className="h-6 w-6 text-primary" /> Nearby Places</h2>
            {college.nearbyPlaces && college.nearbyPlaces.length > 0 ? (
              <ul className="space-y-4">
                {college.nearbyPlaces.map((place, i) => (
                  <li key={i} className="flex flex-col border-b border-border pb-2 last:border-0">
                    <span className="font-medium text-foreground">{place.name}</span>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span className="capitalize">{place.type?.replace('_', ' ')}</span>
                      <span>⭐ {place.rating || 'N/A'}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">No nearby places fetched. (Requires Google Maps API integration)</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
