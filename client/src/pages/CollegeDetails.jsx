import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Building2, Award, Star, Activity, BookOpen, DollarSign, BedDouble, Coffee, Loader2, Database } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../services/api';
import { locationLabel, rankLabel, timeAgo } from '../lib/format';
import { fadeUp } from '../lib/motion';

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

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-faint" /></div>;
  if (!college) return <div className="py-20 text-center text-lg text-muted">College not found</div>;

  const placementData = [
    { name: 'Average', value: parseFloat(college.placements?.averagePackage) || 0 },
    { name: 'Median', value: parseFloat(college.placements?.medianPackage) || 0 },
    { name: 'Highest', value: parseFloat(college.placements?.highestPackage) || 0 },
  ];

  return (
    <motion.div
      key={id}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
      className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"
    >
      {/* Header Section */}
      <motion.header
        {...fadeUp(0)}
        className="relative mb-10 overflow-hidden rounded-2xl border border-line bg-card p-8 md:p-10"
      >
        <h1 className="max-w-3xl text-3xl font-semibold leading-[1.1] tracking-[-0.02em] text-foreground md:text-5xl">
          {college.name}
        </h1>
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-normal text-muted">
          <span className="flex items-center gap-1.5">
            <MapPin size={14} className="text-faint" />
            {locationLabel(college.location)}
          </span>
          <span className="flex items-center gap-1.5">
            <Building2 size={14} className="text-faint" />
            {college.instituteType || 'Unknown type'}
          </span>
          <span className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider">
            <Award size={14} className="text-faint" />
            NIRF {rankLabel(college.ranking?.nirf || college.nirfRanking)}
          </span>
          {college.source?.label && (
            <span className="flex flex-wrap items-center gap-1.5 text-xs">
              <Database size={14} className="text-faint" />
              {college.website ? (
                <a
                  href={college.website}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:text-foreground"
                >
                  {college.source.label}
                </a>
              ) : (
                <span>{college.source.label}</span>
              )}
              {college.syncedAt && <span className="text-faint">· refreshed {timeAgo(college.syncedAt)}</span>}
            </span>
          )}
        </div>
      </motion.header>

      {/* Key metrics strip */}
      <motion.div {...fadeUp(0.05)} className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: 'Avg package', value: college.placements?.averagePackage || '—' },
          { label: 'Highest', value: college.placements?.highestPackage || '—' },
          { label: 'Placement rate', value: college.placements?.placementPercentage || '—' },
          { label: 'Tuition', value: college.fees?.tuition || college.fees?.tuitionFee || '—' },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-line bg-card p-5">
            <div className="text-2xl font-semibold tracking-tight text-foreground">{m.value}</div>
            <div className="mt-1 text-xs font-normal text-muted">{m.label}</div>
          </div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column */}
        <div className="space-y-8 lg:col-span-2">
          {/* AI Summary */}
          <motion.section {...fadeUp(0.1)} className="rounded-2xl border border-line bg-card p-6 md:p-7">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="flex items-center gap-2.5 text-lg font-semibold tracking-[-0.01em] text-foreground">
                <Star size={16} className="text-faint" />
                AI summary
              </h2>
              {!college.aiSummary && (
                <button
                  onClick={generateSummary}
                  disabled={summaryLoading}
                  className="flex cursor-pointer items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-xs font-medium text-background transition-all duration-200 hover:opacity-85 active:scale-[0.98] disabled:opacity-50"
                >
                  {summaryLoading && <Loader2 size={12} className="animate-spin" />}
                  {summaryLoading ? 'Generating…' : 'Generate summary'}
                </button>
              )}
            </div>
            {college.aiSummary ? (
              <div className="chat-markdown max-w-none text-sm leading-relaxed text-muted">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{college.aiSummary}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm font-normal italic text-faint">
                No summary yet. Generate one — the answer is grounded in this college's verified data.
              </p>
            )}
          </motion.section>

          {/* Placements Chart */}
          <motion.section {...fadeUp(0.15)} className="rounded-2xl border border-line bg-card p-6 md:p-7">
            <h2 className="mb-6 flex items-center gap-2.5 text-lg font-semibold tracking-[-0.01em] text-foreground">
              <Activity size={16} className="text-faint" />
              Placements overview
            </h2>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={placementData} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 6" stroke="var(--color-line-strong)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="var(--color-faint)"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
                  />
                  <YAxis
                    tickFormatter={(val) => `${val}L`}
                    stroke="var(--color-faint)"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
                  />
                  <RechartsTooltip
                    cursor={{ fill: 'var(--color-subtle)' }}
                    contentStyle={{
                      backgroundColor: 'var(--color-card-elevated)',
                      border: '1px solid var(--color-line-strong)',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: 'var(--color-foreground)',
                      boxShadow: '0 12px 32px -12px rgba(0,0,0,0.25)',
                    }}
                  />
                  <Bar dataKey="value" fill="var(--color-foreground)" radius={[6, 6, 0, 0]} maxBarSize={64} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 border-t border-line pt-3 text-center text-xs font-normal text-muted">
              Placement rate: {college.placements?.placementPercentage || 'N/A'}
            </div>
          </motion.section>

          {/* Courses */}
          <motion.section {...fadeUp(0.2)} className="rounded-2xl border border-line bg-card p-6 md:p-7">
            <h2 className="mb-4 flex items-center gap-2.5 text-lg font-semibold tracking-[-0.01em] text-foreground">
              <BookOpen size={16} className="text-faint" />
              Courses offered
            </h2>
            <div className="flex flex-wrap gap-2">
              {college.courses?.map((c, i) => (
                <span
                  key={i}
                  className="rounded-lg border border-line bg-subtle px-3 py-1.5 text-xs font-medium text-foreground"
                >
                  {c}
                </span>
              ))}
              {!college.courses?.length && (
                <p className="text-sm font-normal text-faint">
                  The open dataset does not list courses for this institution
                  {college.website ? ' — check the official website for the current list.' : '.'}
                </p>
              )}
            </div>
          </motion.section>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          {/* Fees & Hostel */}
          <motion.section {...fadeUp(0.12)} className="rounded-2xl border border-line bg-card p-6 md:p-7">
            <h2 className="mb-5 flex items-center gap-2.5 text-lg font-semibold tracking-[-0.01em] text-foreground">
              <DollarSign size={16} className="text-faint" />
              Fees &amp; hostel
            </h2>
            <ul>
              {[
                ['Tuition fee', college.fees?.tuitionFee || college.fees?.tuition],
                ['Hostel fee', college.fees?.hostelFee || college.fees?.hostel],
                ['Total fee', college.fees?.totalFee],
              ].map(([label, value], i, arr) => (
                <li
                  key={label}
                  className={`flex items-center justify-between py-2.5 text-sm ${i < arr.length - 1 ? 'border-b border-line' : ''}`}
                >
                  <span className="font-normal text-muted">{label}</span>
                  <span className="font-medium text-foreground">{value || 'N/A'}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 border-t border-line pt-4">
              <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-faint">
                Hostel availability
              </h3>
              <div className="flex gap-2">
                <span className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${college.hostel?.boysHostel ? 'border-line bg-subtle text-foreground' : 'border-line bg-transparent text-faint line-through'}`}>
                  <BedDouble size={12} /> Boys
                </span>
                <span className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${college.hostel?.girlsHostel ? 'border-line bg-subtle text-foreground' : 'border-line bg-transparent text-faint line-through'}`}>
                  <BedDouble size={12} /> Girls
                </span>
              </div>
            </div>
          </motion.section>

          {/* Nearby Places */}
          <motion.section {...fadeUp(0.17)} className="rounded-2xl border border-line bg-card p-6 md:p-7">
            <h2 className="mb-5 flex items-center gap-2.5 text-lg font-semibold tracking-[-0.01em] text-foreground">
              <Coffee size={16} className="text-faint" />
              Nearby places
            </h2>
            {college.nearbyPlaces && college.nearbyPlaces.length > 0 ? (
              <ul>
                {college.nearbyPlaces.map((place, i) => (
                  <li
                    key={i}
                    className={`flex items-center justify-between py-2.5 text-sm ${i < college.nearbyPlaces.length - 1 ? 'border-b border-line' : ''}`}
                  >
                    <div>
                      <span className="font-medium text-foreground">{place.name}</span>
                      <span className="ml-2 text-xs capitalize text-faint">{place.type?.replace('_', ' ')}</span>
                    </div>
                    <span className="font-mono text-xs text-muted">★ {place.rating || '—'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm font-normal text-faint">
                No nearby places fetched yet (requires Google Maps API integration).
              </p>
            )}
          </motion.section>
        </div>
      </div>
    </motion.div>
  );
}
