import { useState, useEffect } from 'react';
import { ShieldAlert, Plus, Edit, Trash2, Sparkles, Database, Layers, BookOpen, Users, Check, X, RefreshCw } from 'lucide-react';
import api from '../services/api';
import { locationLabel, rankLabel, timeAgo } from '../lib/format';
import { useAuth } from '../context/AuthContext';

const inputClass =
  'mt-1.5 w-full rounded-lg border border-line bg-background px-3 py-2 text-xs font-normal text-foreground outline-none transition-colors duration-150 placeholder:text-faint focus:border-line-strong';
const labelClass = 'block text-[11px] font-medium uppercase tracking-wider text-faint';

export default function Admin() {
  const { isAdmin } = useAuth();

  const [stats, setStats] = useState({ totalColleges: 0, totalReviews: 0, totalQueries: 0, topColleges: [] });
  const [colleges, setColleges] = useState([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCollege, setEditingCollege] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    shortName: '',
    location: { address: '', city: '', district: '', state: '', pincode: '', latitude: 12.97, longitude: 77.59 },
    nirfRanking: 100,
    instituteType: 'Autonomous',
    fees: { tuition: '', hostel: '', miscellaneous: '' },
    placements: { averagePackage: '', highestPackage: '', placementPercentage: '' },
    hostel: { available: true, boysHostel: true, girlsHostel: true, details: '' },
    coursesStr: '',
    facilitiesStr: '',
    campusArea: '',
    genderRatio: ''
  });

  const [uiError, setUiError] = useState('');
  const [uiSuccess, setUiSuccess] = useState('');
  const [syncingVectors, setSyncingVectors] = useState(false);
  const [dataset, setDataset] = useState(null);
  const [refreshingData, setRefreshingData] = useState(false);

  const loadDashboardData = async () => {
    try {
      const statsRes = await api.get('/colleges/stats');
      setStats(statsRes.data);

      const listRes = await api.get('/colleges');
      setColleges(listRes.data);
    } catch (err) {
      console.error('Failed to retrieve admin dashboard metrics:', err);
    }
  };

  const loadDatasetInfo = async () => {
    try {
      const res = await api.get('/colleges/dataset');
      setDataset(res.data);
    } catch (err) {
      console.error('Failed to load dataset info:', err);
    }
  };

  const handleRefreshData = async () => {
    setRefreshingData(true);
    setUiSuccess('');
    setUiError('');
    try {
      const res = await api.post('/colleges/refresh');
      setUiSuccess(`${res.data.message} Directory now holds ${res.data.total} colleges.`);
      await Promise.all([loadDatasetInfo(), loadDashboardData()]);
    } catch (err) {
      setUiError(err.response?.data?.message || 'Could not refresh from the open datasets.');
    } finally {
      setRefreshingData(false);
    }
  };

  useEffect(() => {
    let timeout;
    if (isAdmin) {
      timeout = setTimeout(() => {
        loadDashboardData();
        loadDatasetInfo();
      }, 0);
    }
    return () => clearTimeout(timeout);
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <div className="rounded-2xl border border-line bg-card p-8">
          <ShieldAlert className="mx-auto mb-4 text-faint" size={36} />
          <h3 className="text-lg font-semibold text-foreground">Admin privileges required</h3>
          <p className="mt-2 text-sm font-normal leading-relaxed text-muted">
            Please sign in with an administrator account to manage the college database.
          </p>
        </div>
      </div>
    );
  }

  const handleStartEdit = (college) => {
    setEditingCollege(college);
    setFormData({
      name: college.name,
      shortName: college.shortName || '',
      location: { ...college.location },
      nirfRanking: college.nirfRanking,
      instituteType: college.instituteType,
      fees: { ...college.fees },
      placements: { ...college.placements },
      hostel: { ...college.hostel },
      coursesStr: (college.courses || []).join(', '),
      facilitiesStr: (college.facilities || []).join(', '),
      campusArea: college.campusArea || '',
      genderRatio: college.genderRatio || ''
    });
    setIsModalOpen(true);
  };

  const handleStartCreate = () => {
    setEditingCollege(null);
    setFormData({
      name: '',
      shortName: '',
      location: { address: '', city: '', district: '', state: '', pincode: '', latitude: 12.97, longitude: 77.59 },
      nirfRanking: 100,
      instituteType: 'Autonomous',
      fees: { tuition: '3.5 Lakh / Year', hostel: '1.2 Lakh / Year', miscellaneous: '15,000 / Year' },
      placements: { averagePackage: '8.5 LPA', highestPackage: '32.0 LPA', placementPercentage: '92%' },
      hostel: { available: true, boysHostel: true, girlsHostel: true, details: 'Spacious triple sharing rooms.' },
      coursesStr: 'Computer Science Engineering, Information Science Engineering, Electronics Engineering',
      facilitiesStr: 'Library, Gym, Sports Complex, WiFi Campus',
      campusArea: '50 Acres',
      genderRatio: '65:35'
    });
    setIsModalOpen(true);
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setUiError('');
    setUiSuccess('');

    const formattedData = {
      ...formData,
      courses: formData.coursesStr.split(',').map(s => s.trim()).filter(Boolean),
      facilities: formData.facilitiesStr.split(',').map(s => s.trim()).filter(Boolean)
    };

    try {
      if (editingCollege) {
        await api.put(`/colleges/${editingCollege._id}`, formattedData);
        setUiSuccess('College updated successfully. Search index is syncing…');
      } else {
        await api.post('/colleges', formattedData);
        setUiSuccess('College created successfully. Search index is syncing…');
      }
      setIsModalOpen(false);
      loadDashboardData();
    } catch (err) {
      setUiError(err.response?.data?.message || 'Failed to submit college form');
    }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete ${name}? This will remove it from MongoDB, Algolia, and ChromaDB.`)) {
      try {
        await api.delete(`/colleges/${id}`);
        setUiSuccess('College deleted successfully.');
        loadDashboardData();
      } catch {
        setUiError('Failed to delete college.');
      }
    }
  };

  const handleGenerateSummary = async (id) => {
    setUiSuccess('');
    setUiError('');
    try {
      const res = await api.post(`/colleges/${id}/summary`);
      setUiSuccess(`AI summary generated: "${res.data.summary.substring(0, 50)}…"`);
      loadDashboardData();
    } catch (err) {
      setUiError('Summary generation failed: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleRebuildEmbeddings = async () => {
    setSyncingVectors(true);
    setUiSuccess('');
    setUiError('');
    try {
      const res = await api.post('/embeddings/generate');
      setUiSuccess(`Vector index completed. Synced to Chroma: ${res.data.syncedToChroma}, Search: ${res.data.syncedToSearch}`);
    } catch (err) {
      setUiError('Embedding compilation pipeline failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setSyncingVectors(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
      {}
      <div className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-[11px] font-medium uppercase tracking-wider text-faint">Control panel</span>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-foreground">Admin dashboard</h1>
          <p className="mt-1 text-sm font-normal text-muted">
            Manage database entries, trigger summaries, and synchronize vector embedding stores.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleRebuildEmbeddings}
            disabled={syncingVectors}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-4 py-2.5 text-xs font-medium text-muted transition-colors duration-150 hover:border-line-strong hover:text-foreground disabled:opacity-50"
          >
            <Database size={13} className={syncingVectors ? 'animate-spin' : ''} />
            {syncingVectors ? 'Syncing…' : 'Sync search & vectors'}
          </button>
          <button
            onClick={handleStartCreate}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-foreground px-4 py-2.5 text-xs font-medium text-background transition-all duration-200 hover:opacity-85 active:scale-[0.98]"
          >
            <Plus size={13} />
            Add college
          </button>
        </div>
      </div>

      {}
      {uiError && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-normal text-red-600">{uiError}</div>}
      {uiSuccess && <div className="rounded-xl border border-line bg-subtle p-4 text-sm font-normal text-foreground">{uiSuccess}</div>}

      {}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: Layers, label: 'Total colleges', value: stats.totalColleges },
          { icon: BookOpen, label: 'Verified reviews', value: stats.totalReviews },
          { icon: Users, label: 'Platform interactions', value: stats.totalQueries },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-2xl border border-line bg-card p-6">
            <div className="flex items-center gap-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-subtle text-foreground">
                <Icon size={17} />
              </span>
              <div>
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-faint">{label}</h3>
                <p className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {}
      <div className="rounded-2xl border border-line bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-faint">Open data source</h3>
            <p className="mt-1.5 text-sm font-normal text-muted">
              {dataset
                ? `${dataset.total.toLocaleString()} colleges in the directory · ${dataset.curated} curated profiles · last refresh ${timeAgo(dataset.lastSyncedAt) || 'not recorded'}`
                : 'Loading dataset information…'}
            </p>
          </div>
          <button
            onClick={handleRefreshData}
            disabled={refreshingData}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-4 py-2.5 text-xs font-medium text-muted transition-colors duration-150 hover:border-line-strong hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshingData ? 'animate-spin' : ''} />
            {refreshingData ? 'Re-downloading…' : 'Refresh open data'}
          </button>
        </div>

        {dataset?.sources?.length > 0 && (
          <ul className="mt-4 space-y-2.5 border-t border-line pt-4">
            {dataset.sources.map((source) => (
              <li key={source.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-normal text-muted underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:text-foreground"
                >
                  {source.label}
                </a>
                <span className="font-mono text-[11px] text-faint">
                  {source.count.toLocaleString()} records · {source.license}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {}
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <div className="border-b border-line p-4">
          <h3 className="text-[11px] font-medium uppercase tracking-wider text-faint">Indexed colleges</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-line text-faint">
                <th className="p-4 font-medium uppercase tracking-wider">Name</th>
                <th className="p-4 font-medium uppercase tracking-wider">NIRF</th>
                <th className="p-4 font-medium uppercase tracking-wider">Avg package</th>
                <th className="p-4 font-medium uppercase tracking-wider">AI summary</th>
                <th className="p-4 text-right font-medium uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {colleges.map((college) => (
                <tr key={college._id} className="transition-colors duration-150 hover:bg-subtle">
                  <td className="p-4">
                    <div className="font-medium text-foreground">{college.name}</div>
                    <div className="mt-0.5 font-normal text-faint">{locationLabel(college.location)}</div>
                  </td>
                  <td className="p-4 font-mono text-foreground">{rankLabel(college.nirfRanking)}</td>
                  <td className="p-4 font-mono text-muted">{college.placements?.averagePackage}</td>
                  <td className="p-4">
                    {college.aiSummary ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-line bg-subtle px-2 py-0.5 text-[10px] font-medium text-foreground">
                        <Check size={10} /> Ready
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md border border-dashed border-line px-2 py-0.5 text-[10px] font-medium text-faint">
                        Missing
                      </span>
                    )}
                  </td>
                  <td className="space-x-1 p-4 text-right">
                    <button
                      onClick={() => handleGenerateSummary(college._id)}
                      className="cursor-pointer rounded-lg border border-line p-1.5 text-muted transition-colors duration-150 hover:border-line-strong hover:text-foreground"
                      title="Trigger AI summary generation"
                    >
                      <Sparkles size={13} />
                    </button>
                    <button
                      onClick={() => handleStartEdit(college)}
                      className="cursor-pointer rounded-lg border border-line p-1.5 text-muted transition-colors duration-150 hover:border-line-strong hover:text-foreground"
                      title="Edit college"
                    >
                      <Edit size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(college._id, college.name)}
                      className="cursor-pointer rounded-lg border border-line p-1.5 text-faint transition-colors duration-150 hover:border-red-300 hover:text-red-500"
                      title="Delete college"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
          {}
          <div onClick={() => setIsModalOpen(false)} className="fixed inset-0 bg-foreground/40 backdrop-blur-sm" />

          {}
          <div className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-card-elevated p-8 shadow-[0_32px_80px_-24px_rgba(26,26,26,0.24)]">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-semibold tracking-[-0.01em] text-foreground">
                {editingCollege ? 'Edit college details' : 'Add new college'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                aria-label="Close"
                className="cursor-pointer text-faint transition-colors hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-5 text-xs">
              {}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className={labelClass}>College name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Abbreviation (e.g. RVCE)</label>
                  <input
                    type="text"
                    required
                    value={formData.shortName}
                    onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              {}
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className={labelClass}>NIRF ranking</label>
                  <input
                    type="number"
                    required
                    value={formData.nirfRanking}
                    onChange={(e) => setFormData({ ...formData, nirfRanking: parseInt(e.target.value, 10) })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Institute type</label>
                  <input
                    type="text"
                    required
                    value={formData.instituteType}
                    onChange={(e) => setFormData({ ...formData, instituteType: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Campus area</label>
                  <input
                    type="text"
                    required
                    value={formData.campusArea}
                    onChange={(e) => setFormData({ ...formData, campusArea: e.target.value })}
                    placeholder="e.g. 52 Acres"
                    className={inputClass}
                  />
                </div>
              </div>

              {}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-3">
                  <label className={labelClass}>Address</label>
                  <input
                    type="text"
                    required
                    value={formData.location.address}
                    onChange={(e) => setFormData({
                      ...formData,
                      location: { ...formData.location, address: e.target.value }
                    })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>City</label>
                  <input
                    type="text"
                    required
                    value={formData.location.city}
                    onChange={(e) => setFormData({
                      ...formData,
                      location: { ...formData.location, city: e.target.value }
                    })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>State</label>
                  <input
                    type="text"
                    required
                    value={formData.location.state}
                    onChange={(e) => setFormData({
                      ...formData,
                      location: { ...formData.location, state: e.target.value }
                    })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Pincode</label>
                  <input
                    type="text"
                    required
                    value={formData.location.pincode}
                    onChange={(e) => setFormData({
                      ...formData,
                      location: { ...formData.location, pincode: e.target.value }
                    })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formData.location.latitude}
                    onChange={(e) => setFormData({
                      ...formData,
                      location: { ...formData.location, latitude: parseFloat(e.target.value) }
                    })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formData.location.longitude}
                    onChange={(e) => setFormData({
                      ...formData,
                      location: { ...formData.location, longitude: parseFloat(e.target.value) }
                    })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Gender ratio</label>
                  <input
                    type="text"
                    required
                    value={formData.genderRatio}
                    onChange={(e) => setFormData({ ...formData, genderRatio: e.target.value })}
                    placeholder="e.g. 60:40"
                    className={inputClass}
                  />
                </div>
              </div>

              {}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-3 rounded-xl border border-line p-4">
                  <h4 className="text-[11px] font-medium uppercase tracking-wider text-faint">Fees schedule</h4>
                  <div>
                    <label className={labelClass}>Tuition fee</label>
                    <input
                      type="text"
                      required
                      value={formData.fees.tuition}
                      onChange={(e) => setFormData({
                        ...formData,
                        fees: { ...formData.fees, tuition: e.target.value }
                      })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Hostel fee</label>
                    <input
                      type="text"
                      required
                      value={formData.fees.hostel}
                      onChange={(e) => setFormData({
                        ...formData,
                        fees: { ...formData.fees, hostel: e.target.value }
                      })}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-line p-4">
                  <h4 className="text-[11px] font-medium uppercase tracking-wider text-faint">Placements summary</h4>
                  <div>
                    <label className={labelClass}>Average package</label>
                    <input
                      type="text"
                      required
                      value={formData.placements.averagePackage}
                      onChange={(e) => setFormData({
                        ...formData,
                        placements: { ...formData.placements, averagePackage: e.target.value }
                      })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Highest package</label>
                    <input
                      type="text"
                      required
                      value={formData.placements.highestPackage}
                      onChange={(e) => setFormData({
                        ...formData,
                        placements: { ...formData.placements, highestPackage: e.target.value }
                      })}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              {}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Courses offered (comma separated)</label>
                  <textarea
                    rows={2}
                    value={formData.coursesStr}
                    onChange={(e) => setFormData({ ...formData, coursesStr: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Campus facilities (comma separated)</label>
                  <textarea
                    rows={2}
                    value={formData.facilitiesStr}
                    onChange={(e) => setFormData({ ...formData, facilitiesStr: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-line pt-5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="cursor-pointer rounded-lg border border-line px-5 py-2.5 font-medium text-muted transition-colors duration-150 hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cursor-pointer rounded-lg bg-foreground px-5 py-2.5 font-medium text-background transition-all duration-200 hover:opacity-85 active:scale-[0.98]"
                >
                  {editingCollege ? 'Save changes' : 'Create college'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
