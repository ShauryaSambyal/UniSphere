import { useState, useEffect } from 'react';
import { ShieldAlert, Plus, Edit, Trash2, Sparkles, Database, Users, BookOpen, Layers, Check } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Admin() {
  const { isAdmin } = useAuth();
  
  // Dashboard stats
  const [stats, setStats] = useState({ totalColleges: 0, totalReviews: 0, totalQueries: 0, topColleges: [] });
  const [colleges, setColleges] = useState([]);

  // Form controls
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCollege, setEditingCollege] = useState(null);

  // Form inputs state
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

  // Fetch admin dashboard info
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

  useEffect(() => {
    let timeout;
    if (isAdmin) {
      timeout = setTimeout(() => {
        loadDashboardData();
      }, 0);
    }
    return () => clearTimeout(timeout);
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-8 backdrop-blur-md">
          <ShieldAlert className="mx-auto text-red-500 mb-4" size={48} />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Admin Privileges Required</h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            This workspace contains administration filters. Please sign in with an administrator account (e.g. email: <code className="text-brand-light">admin@college.com</code>) to continue.
          </p>
        </div>
      </div>
    );
  }

  // Populate edit fields
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

  // Submit college form (Create / Edit)
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
        setUiSuccess('College updated successfully. Search index is syncing...');
      } else {
        await api.post('/colleges', formattedData);
        setUiSuccess('College created successfully. Search index is syncing...');
      }
      setIsModalOpen(false);
      loadDashboardData();
    } catch (err) {
      setUiError(err.response?.data?.message || 'Failed to submit college form');
    }
  };

  // Delete college handler
  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete ${name}? This will remove it from MongoDB, Meilisearch, and ChromaDB.`)) {
      try {
        await api.delete(`/colleges/${id}`);
        setUiSuccess('College deleted successfully.');
        loadDashboardData();
      } catch {
        setUiError('Failed to delete college.');
      }
    }
  };

  // Trigger AI summary generation
  const handleGenerateSummary = async (id) => {
    setUiSuccess('');
    setUiError('');
    try {
      const res = await api.post(`/colleges/${id}/summary`);
      setUiSuccess(`AI summary generated: "${res.data.summary.substring(0, 50)}..."`);
      loadDashboardData();
    } catch (err) {
      setUiError('Summary generation failed: ' + (err.response?.data?.message || err.message));
    }
  };

  // Rebuild ChromaDB embeddings
  const handleRebuildEmbeddings = async () => {
    setSyncingVectors(true);
    setUiSuccess('');
    setUiError('');
    try {
      const res = await api.post('/embeddings/generate');
      setUiSuccess(`Vector Index completed. Synced to Chroma: ${res.data.syncedToChroma}, Meili: ${res.data.syncedToMeili}`);
    } catch (err) {
      setUiError('Embedding compilation pipeline failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setSyncingVectors(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 space-y-10">
      {/* Page Title & actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200/50 pb-6 dark:border-white/5">
        <div>
          <h1 className="font-sans text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <span>Admin Dashboard</span>
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage database entries, trigger summaries, and synchronize vector embedding stores.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleRebuildEmbeddings}
            disabled={syncingVectors}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5 disabled:opacity-50 transition-all"
          >
            <Database size={14} className={syncingVectors ? 'animate-spin' : ''} />
            {syncingVectors ? 'Syncing...' : 'Sync Search & Vectors'}
          </button>
          <button
            onClick={handleStartCreate}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-light to-brand-accent px-4 py-2.5 text-xs font-semibold text-white shadow hover:brightness-110 active:scale-[0.98] transition-all"
          >
            <Plus size={14} />
            Add College
          </button>
        </div>
      </div>

      {/* Toast logs */}
      {uiError && <div className="rounded-xl bg-red-500/10 p-4 text-sm text-red-500 border border-red-500/20">{uiError}</div>}
      {uiSuccess && <div className="rounded-xl bg-green-500/10 p-4 text-sm text-green-500 border border-green-500/20">{uiSuccess}</div>}

      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/5 dark:bg-darkbg-card">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-brand-light/10 p-3 text-brand-light"><Layers size={22} /></div>
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider dark:text-gray-400">Total Colleges</h3>
              <p className="text-3xl font-black text-gray-900 dark:text-white mt-1">{stats.totalColleges}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/5 dark:bg-darkbg-card">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-brand-accent/10 p-3 text-brand-accent"><BookOpen size={22} /></div>
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider dark:text-gray-400">Verified Reviews</h3>
              <p className="text-3xl font-black text-gray-900 dark:text-white mt-1">{stats.totalReviews}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/5 dark:bg-darkbg-card">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-green-500/10 p-3 text-green-500"><Users size={22} /></div>
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider dark:text-gray-400">Platform Interactions</h3>
              <p className="text-3xl font-black text-gray-900 dark:text-white mt-1">{stats.totalQueries}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Colleges Management List */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm dark:border-white/5 dark:bg-darkbg-card">
        <div className="bg-gray-50 border-b border-gray-100 p-4 dark:bg-white/5 dark:border-white/5">
          <h3 className="font-sans text-sm font-extrabold text-gray-900 dark:text-white uppercase tracking-wider">Indexed Colleges</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/5 text-gray-400 dark:text-gray-500">
                <th className="p-4 font-bold uppercase tracking-wider">Name</th>
                <th className="p-4 font-bold uppercase tracking-wider">NIRF Rank</th>
                <th className="p-4 font-bold uppercase tracking-wider">Average Package</th>
                <th className="p-4 font-bold uppercase tracking-wider">AI Summary</th>
                <th className="p-4 font-bold uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700 dark:divide-white/5 dark:text-gray-300">
              {colleges.map((college) => (
                <tr key={college._id} className="hover:bg-gray-50/50 dark:hover:bg-white/5">
                  <td className="p-4">
                    <div className="font-bold text-gray-950 dark:text-white">{college.name}</div>
                    <div className="text-gray-400 mt-0.5">{college.location.city}, {college.location.state}</div>
                  </td>
                  <td className="p-4 font-semibold text-yellow-500">#{college.nirfRanking}</td>
                  <td className="p-4 font-semibold">{college.placements?.averagePackage}</td>
                  <td className="p-4">
                    {college.aiSummary ? (
                      <span className="inline-flex items-center gap-1 rounded bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold text-green-500">
                        <Check size={10} /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-yellow-500/10 px-2 py-0.5 text-[10px] font-semibold text-yellow-600">
                        Missing
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button
                      onClick={() => handleGenerateSummary(college._id)}
                      className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:text-brand-light dark:border-white/10 dark:text-gray-400"
                      title="Trigger AI Summary Generation"
                    >
                      <Sparkles size={14} />
                    </button>
                    <button
                      onClick={() => handleStartEdit(college)}
                      className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:text-green-500 dark:border-white/10 dark:text-gray-400"
                      title="Edit College"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(college._id, college.name)}
                      className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:text-red-500 dark:border-white/10"
                      title="Delete College"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dynamic Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          {/* Backdrop */}
          <div onClick={() => setIsModalOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Form Card */}
          <div className="relative w-full max-w-2xl overflow-y-auto max-h-[85vh] rounded-2xl border border-white/20 bg-white p-8 shadow-2xl dark:border-white/5 dark:bg-darkbg-card">
            <h3 className="font-sans text-xl font-bold text-gray-900 dark:text-white mb-6">
              {editingCollege ? 'Edit College Details' : 'Add New College'}
            </h3>

            <form onSubmit={handleSubmitForm} className="space-y-4 text-xs">
              {/* Row 1: Name & Short Name */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-gray-500 dark:text-gray-400">College Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-gray-200 py-2.5 px-3 dark:border-white/10 dark:bg-darkbg-base dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-500 dark:text-gray-400">Abbreviation (e.g. RVCE)</label>
                  <input
                    type="text"
                    required
                    value={formData.shortName}
                    onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-gray-200 py-2.5 px-3 dark:border-white/10 dark:bg-darkbg-base dark:text-white"
                  />
                </div>
              </div>

              {/* Row 2: Type, Ranking, Campus size */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block font-semibold text-gray-500 dark:text-gray-400">NIRF Ranking</label>
                  <input
                    type="number"
                    required
                    value={formData.nirfRanking}
                    onChange={(e) => setFormData({ ...formData, nirfRanking: parseInt(e.target.value, 10) })}
                    className="mt-1 w-full rounded-xl border border-gray-200 py-2.5 px-3 dark:border-white/10 dark:bg-darkbg-base dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-500 dark:text-gray-400">Institute Type</label>
                  <input
                    type="text"
                    required
                    value={formData.instituteType}
                    onChange={(e) => setFormData({ ...formData, instituteType: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-gray-200 py-2.5 px-3 dark:border-white/10 dark:bg-darkbg-base dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-500 dark:text-gray-400">Campus Area</label>
                  <input
                    type="text"
                    required
                    value={formData.campusArea}
                    onChange={(e) => setFormData({ ...formData, campusArea: e.target.value })}
                    placeholder="e.g. 52 Acres"
                    className="mt-1 w-full rounded-xl border border-gray-200 py-2.5 px-3 dark:border-white/10 dark:bg-darkbg-base dark:text-white"
                  />
                </div>
              </div>

              {/* Row 3: Location */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-3">
                  <label className="block font-semibold text-gray-500 dark:text-gray-400">Address</label>
                  <input
                    type="text"
                    required
                    value={formData.location.address}
                    onChange={(e) => setFormData({
                      ...formData,
                      location: { ...formData.location, address: e.target.value }
                    })}
                    className="mt-1 w-full rounded-xl border border-gray-200 py-2.5 px-3 dark:border-white/10 dark:bg-darkbg-base dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-500 dark:text-gray-400">City</label>
                  <input
                    type="text"
                    required
                    value={formData.location.city}
                    onChange={(e) => setFormData({
                      ...formData,
                      location: { ...formData.location, city: e.target.value }
                    })}
                    className="mt-1 w-full rounded-xl border border-gray-200 py-2.5 px-3 dark:border-white/10 dark:bg-darkbg-base dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-500 dark:text-gray-400">State</label>
                  <input
                    type="text"
                    required
                    value={formData.location.state}
                    onChange={(e) => setFormData({
                      ...formData,
                      location: { ...formData.location, state: e.target.value }
                    })}
                    className="mt-1 w-full rounded-xl border border-gray-200 py-2.5 px-3 dark:border-white/10 dark:bg-darkbg-base dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-500 dark:text-gray-400">Pincode</label>
                  <input
                    type="text"
                    required
                    value={formData.location.pincode}
                    onChange={(e) => setFormData({
                      ...formData,
                      location: { ...formData.location, pincode: e.target.value }
                    })}
                    className="mt-1 w-full rounded-xl border border-gray-200 py-2.5 px-3 dark:border-white/10 dark:bg-darkbg-base dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-500 dark:text-gray-400">Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formData.location.latitude}
                    onChange={(e) => setFormData({
                      ...formData,
                      location: { ...formData.location, latitude: parseFloat(e.target.value) }
                    })}
                    className="mt-1 w-full rounded-xl border border-gray-200 py-2.5 px-3 dark:border-white/10 dark:bg-darkbg-base dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-500 dark:text-gray-400">Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formData.location.longitude}
                    onChange={(e) => setFormData({
                      ...formData,
                      location: { ...formData.location, longitude: parseFloat(e.target.value) }
                    })}
                    className="mt-1 w-full rounded-xl border border-gray-200 py-2.5 px-3 dark:border-white/10 dark:bg-darkbg-base dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-500 dark:text-gray-400">Gender Ratio</label>
                  <input
                    type="text"
                    required
                    value={formData.genderRatio}
                    onChange={(e) => setFormData({ ...formData, genderRatio: e.target.value })}
                    placeholder="e.g. 60:40"
                    className="mt-1 w-full rounded-xl border border-gray-200 py-2.5 px-3 dark:border-white/10 dark:bg-darkbg-base dark:text-white"
                  />
                </div>
              </div>

              {/* Row 4: Fees & Placements */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="border border-gray-200/50 p-3 rounded-xl dark:border-white/5 space-y-2">
                  <h4 className="font-bold text-gray-400 uppercase tracking-wider">Fees Schedule</h4>
                  <div>
                    <label className="block">Tuition Fee</label>
                    <input
                      type="text"
                      required
                      value={formData.fees.tuition}
                      onChange={(e) => setFormData({
                        ...formData,
                        fees: { ...formData.fees, tuition: e.target.value }
                      })}
                      className="mt-1 w-full rounded-lg border border-gray-200 py-1.5 px-3.5 dark:border-white/10 dark:bg-darkbg-base"
                    />
                  </div>
                  <div>
                    <label className="block">Hostel Fee</label>
                    <input
                      type="text"
                      required
                      value={formData.fees.hostel}
                      onChange={(e) => setFormData({
                        ...formData,
                        fees: { ...formData.fees, hostel: e.target.value }
                      })}
                      className="mt-1 w-full rounded-lg border border-gray-200 py-1.5 px-3.5 dark:border-white/10 dark:bg-darkbg-base"
                    />
                  </div>
                </div>

                <div className="border border-gray-200/50 p-3 rounded-xl dark:border-white/5 space-y-2">
                  <h4 className="font-bold text-gray-400 uppercase tracking-wider">Placements Summary</h4>
                  <div>
                    <label className="block">Average Package</label>
                    <input
                      type="text"
                      required
                      value={formData.placements.averagePackage}
                      onChange={(e) => setFormData({
                        ...formData,
                        placements: { ...formData.placements, averagePackage: e.target.value }
                      })}
                      className="mt-1 w-full rounded-lg border border-gray-200 py-1.5 px-3.5 dark:border-white/10 dark:bg-darkbg-base"
                    />
                  </div>
                  <div>
                    <label className="block">Highest Package</label>
                    <input
                      type="text"
                      required
                      value={formData.placements.highestPackage}
                      onChange={(e) => setFormData({
                        ...formData,
                        placements: { ...formData.placements, highestPackage: e.target.value }
                      })}
                      className="mt-1 w-full rounded-lg border border-gray-200 py-1.5 px-3.5 dark:border-white/10 dark:bg-darkbg-base"
                    />
                  </div>
                </div>
              </div>

              {/* Row 5: Lists (Courses, Facilities) */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block font-semibold text-gray-500 dark:text-gray-400">Courses offered (comma separated)</label>
                  <textarea
                    rows={2}
                    value={formData.coursesStr}
                    onChange={(e) => setFormData({ ...formData, coursesStr: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-gray-200 py-2 px-3 dark:border-white/10 dark:bg-darkbg-base dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-500 dark:text-gray-400">Campus Facilities (comma separated)</label>
                  <textarea
                    rows={2}
                    value={formData.facilitiesStr}
                    onChange={(e) => setFormData({ ...formData, facilitiesStr: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-gray-200 py-2 px-3 dark:border-white/10 dark:bg-darkbg-base dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-gray-200 px-5 py-2.5 font-semibold text-gray-500 hover:bg-gray-50 dark:border-white/10 dark:text-gray-400 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-gradient-to-r from-brand-light to-brand-accent px-5 py-2.5 font-semibold text-white shadow hover:brightness-110 active:scale-[0.98] transition-all"
                >
                  {editingCollege ? 'Save Changes' : 'Create College'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
