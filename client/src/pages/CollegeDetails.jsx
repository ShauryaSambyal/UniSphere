import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Building2, Award, Star, Activity, BookOpen, DollarSign, BedDouble, Coffee, Loader2, Database, Users, GraduationCap, ExternalLink } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../services/api';
import { locationLabel, nirfLabel, formatRupees, timeAgo } from '../lib/format';
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

  const nirfPlacements = college.placements?.nirf || null;
  const nirfYear = college.nirf?.year || nirfPlacements?.year;
  const nirfCategory = college.nirf?.bestCategory || college.nirf?.bands?.[0]?.category;

  const hasFeeData = Boolean(
    college.fees?.tuition || college.fees?.tuitionFee || college.fees?.totalFee ||
      college.fees?.hostel || college.fees?.hostelFee
  );
  const hasHostelData = Boolean(
    college.hostel?.boysHostel || college.hostel?.girlsHostel || college.hostel?.details
  );
  const hasLegacyPlacements = Boolean(
    college.placements?.averagePackage || college.placements?.medianPackage ||
      college.placements?.highestPackage || college.placements?.placementPercentage
  );

  const prettyLevel = (level) =>
    String(level || '').replace(/\s*\[(\d+)\s*Years?\s*Program\(s\)\]/i, ' · $1-year').trim();

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
            NIRF {nirfLabel(college)}
            {nirfCategory ? ` · ${nirfCategory}` : ''}
            {nirfYear ? ` · ${nirfYear}` : ''}
          </span>
          {college.affiliatedTo && (
            <span className="flex items-center gap-1.5 text-xs">
              <Building2 size={14} className="text-faint" />
              Affiliated to {college.affiliatedTo}
            </span>
          )}
          {college.studentCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs">
              <Users size={14} className="text-faint" />
              {Number(college.studentCount).toLocaleString('en-IN')} students
            </span>
          )}
          {college.facultyCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs">
              <GraduationCap size={14} className="text-faint" />
              {Number(college.facultyCount).toLocaleString('en-IN')} faculty
            </span>
          )}
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
          {
            label: nirfPlacements?.medianSalary ? 'Median package (NIRF)' : 'Avg package',
            value: nirfPlacements?.medianSalary
              ? formatRupees(nirfPlacements.medianSalary)
              : college.placements?.averagePackage || '—',
          },
          { label: 'Highest', value: college.placements?.highestPackage || '—' },
          {
            label: nirfPlacements?.placementRate != null ? 'Placement rate (NIRF)' : 'Placement rate',
            value:
              nirfPlacements?.placementRate != null
                ? `${nirfPlacements.placementRate}%`
                : college.placements?.placementPercentage || '—',
          },
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

          {/* Placements — official NIRF dossier when available, curated chart otherwise */}
          <motion.section {...fadeUp(0.15)} className="rounded-2xl border border-line bg-card p-6 md:p-7">
            <h2 className="mb-6 flex items-center gap-2.5 text-lg font-semibold tracking-[-0.01em] text-foreground">
              <Activity size={16} className="text-faint" />
              Placements
              {nirfPlacements && (
                <span className="font-mono text-[10px] font-normal uppercase tracking-wider text-faint">
                  NIRF {nirfPlacements.year}
                </span>
              )}
            </h2>

            {nirfPlacements?.levels?.length > 0 ? (
              <>
                <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: 'Placed', value: nirfPlacements.placed?.toLocaleString('en-IN') ?? '—' },
                    { label: 'Graduates', value: nirfPlacements.graduates?.toLocaleString('en-IN') ?? '—' },
                    {
                      label: 'Placement rate',
                      value: nirfPlacements.placementRate != null ? `${nirfPlacements.placementRate}%` : '—',
                    },
                    { label: 'Higher studies', value: nirfPlacements.higherStudies?.toLocaleString('en-IN') ?? '—' },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-xl border border-line bg-subtle p-4">
                      <div className="text-xl font-semibold tracking-tight text-foreground">{stat.value}</div>
                      <div className="mt-1 text-[11px] font-normal text-muted">{stat.label}</div>
                    </div>
                  ))}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-line text-[11px] uppercase tracking-wider text-faint">
                        <th className="py-2 pr-4 font-medium">Programme</th>
                        <th className="py-2 pr-4 font-medium">Year</th>
                        <th className="py-2 pr-4 font-medium">Graduating</th>
                        <th className="py-2 pr-4 font-medium">Placed</th>
                        <th className="py-2 pr-4 font-medium">Median salary</th>
                        <th className="py-2 font-medium">Higher studies</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nirfPlacements.levels.map((entry, index) => (
                        <tr key={index} className="border-b border-line last:border-0">
                          <td className="py-3 pr-4 font-medium text-foreground">{prettyLevel(entry.level)}</td>
                          <td className="py-3 pr-4 font-mono text-xs text-muted">{entry.latest?.graduatingYear || '—'}</td>
                          <td className="py-3 pr-4 text-muted">{entry.latest?.graduating ?? '—'}</td>
                          <td className="py-3 pr-4 text-muted">{entry.latest?.placed ?? '—'}</td>
                          <td className="py-3 pr-4 font-medium text-foreground">{formatRupees(entry.latest?.medianSalary) || '—'}</td>
                          <td className="py-3 text-muted">{entry.latest?.higherStudies ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs font-normal text-muted">
                  <span>Official data submitted by the institution — median salary of placed graduates.</span>
                  {nirfPlacements.sourceUrl && (
                    <a
                      href={nirfPlacements.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:text-foreground"
                    >
                      View NIRF dossier <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              </>
            ) : hasLegacyPlacements ? (
              <>
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
              </>
            ) : (
              <p className="text-sm font-normal leading-relaxed text-muted">
                Neither the NIRF dossier nor the open datasets report placement figures for this
                institution{college.website ? ' — check the official website.' : '.'}
              </p>
            )}
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
              {!college.courses?.length && !college.programmes?.length && (
                <p className="text-sm font-normal text-faint">
                  The open dataset does not list courses for this institution
                  {college.website ? ' — check the official website for the current list.' : '.'}
                </p>
              )}
            </div>

            {college.programmes?.length > 0 && (
              <div className="mt-5 border-t border-line pt-4">
                <h3 className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-faint">
                  Specialisations ({college.programmes.length})
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {college.programmes.map((programme, i) => (
                    <span
                      key={i}
                      className="rounded-md border border-line px-2.5 py-1 text-[11px] font-normal text-muted"
                    >
                      {programme}
                    </span>
                  ))}
                </div>
              </div>
            )}
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
            {hasFeeData ? (
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
            ) : (
              <div className="text-sm font-normal leading-relaxed text-muted">
                Tuition and hostel fees are not published in the government open datasets this
                directory is built from (NIRF, AICTE, UGC).
                {college.website && (
                  <a
                    href={college.website}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-foreground underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:opacity-70"
                  >
                    Check the official website <ExternalLink size={11} />
                  </a>
                )}
              </div>
            )}
            <div className="mt-5 border-t border-line pt-4">
              <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-faint">
                Hostel availability
              </h3>
              {hasHostelData ? (
                <div className="flex gap-2">
                  <span className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${college.hostel?.boysHostel ? 'border-line bg-subtle text-foreground' : 'border-line bg-transparent text-faint line-through'}`}>
                    <BedDouble size={12} /> Boys
                  </span>
                  <span className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${college.hostel?.girlsHostel ? 'border-line bg-subtle text-foreground' : 'border-line bg-transparent text-faint line-through'}`}>
                    <BedDouble size={12} /> Girls
                  </span>
                </div>
              ) : (
                <p className="text-sm font-normal text-muted">
                  Not recorded in the government open datasets — check the official website.
                </p>
              )}
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
