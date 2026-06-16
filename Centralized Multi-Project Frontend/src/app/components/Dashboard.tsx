import {
  Building2,
  AlertTriangle,
  Truck,
  TrendingUp,
  BrainCircuit,
  Zap,
  Loader,
  X // <-- Added for the modal close button
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { sitesAPI, inventoryAPI } from "../../services/apiService";
import type { ProjectSite, Inventory } from "../../types";

export function Dashboard() {
  const [sites, setSites] = useState<ProjectSite[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // --- NEW: Modal State Variables ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [updateForm, setUpdateForm] = useState({ stage: "Pre-construction", progress: 0 });

  // 1. LIVE POLLING: Fetches data silently every 5 seconds
  useEffect(() => {
    const fetchData = async (isInitialLoad = false) => {
      try {
        if (isInitialLoad) setLoading(true);
        setError(null);
        const [sitesData, inventoryData] = await Promise.all([
          sitesAPI.list(),
          inventoryAPI.list(),
        ]);
        setSites(sitesData);
        setInventory(inventoryData);
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        if (isInitialLoad) setLoading(false);
      }
    };

    fetchData(true);

    const interval = setInterval(() => {
      fetchData(false);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // --- NEW: Save Progress Function ---
  const handleSaveProgress = async () => {
    if (!selectedSiteId) return;
    try {
      await sitesAPI.updateProgress(selectedSiteId, updateForm.stage, updateForm.progress);
      setIsModalOpen(false);
      
      // Force an immediate UI refresh without waiting for the 5-second polling
      const sitesData = await sitesAPI.list();
      setSites(sitesData);
    } catch (error) {
      alert("Failed to update progress. Check your connection.");
    }
  };

  // 2. REAL-TIME METRICS
  const criticalShortages = inventory.filter((i) => i.status === "Critical");
  const surplusItems = inventory.filter((i) => i.status === "Surplus");
  const inTransitCount = inventory.filter((i) => i.status === "In Transit").length;

  const metrics = [
    {
      label: "Active Project Sites",
      value: sites.length.toString(),
      icon: Building2,
      color: "text-blue-600",
      bg: "bg-blue-100",
    },
    {
      label: "Critical Material Shortages",
      value: criticalShortages.length.toString(),
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-100",
    },
    {
      label: "Pending Deliveries",
      value: inTransitCount.toString(),
      icon: Truck,
      color: "text-amber-600",
      bg: "bg-amber-100",
    },
    {
      label: "Available Surplus Items",
      value: surplusItems.length.toString(),
      icon: TrendingUp,
      color: "text-emerald-600",
      bg: "bg-emerald-100",
    },
  ];

  // 3. PROJECT MAPPING (UPDATED FOR REAL DB PROGRESS)
  const projects = sites.map((site) => ({
    raw_id: site.id,
    id: `SITE-${site.id}`,
    name: site.site_name,
    location: `${site.latitude.toFixed(2)}, ${site.longitude.toFixed(2)}`,
    status: inventory.some(
      (i) => i.site_id === site.id && i.status === "Critical",
    )
      ? "Critical"
      : "On Track",
    // Pulling the real data straight from FastAPI:
    progress: site.progress_percentage || 0, 
    stage_status: site.stage_status || "Pre-construction", 
    shortages: inventory.filter(
      (i) => i.site_id === site.id && i.status === "Critical",
    ).length,
  }));

  // 4. NEURAL NET ADVISORY LOGIC
  const aiAdvisories = [];

  if (surplusItems.length > 0) {
    aiAdvisories.push({
      id: 1,
      type: "Surplus Transfer",
      material: surplusItems[0].item_name,
      action: "Optimize allocation of internal surplus",
      reason: `Found ${surplusItems[0].quantity} ${surplusItems[0].unit} surplus at ${sites.find((s) => s.id === surplusItems[0].site_id)?.site_name || "Site"}.`,
      confidence: 92,
    });
  }

  if (criticalShortages.length > 0) {
    aiAdvisories.push({
      id: 2,
      type: "Procurement",
      material: criticalShortages[0].item_name,
      action: "Urgent Procurement Required",
      reason: `AI recommends nearest verified supplier to resolve shortage at ${sites.find((s) => s.id === criticalShortages[0].site_id)?.site_name || "Site"}.`,
      confidence: 88,
    });
  }

  if (error) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-xl">
        <p className="text-red-800 font-bold">Connection Error: {error}</p>
        <p className="text-sm text-red-700">
          Check if FastAPI is running on port 8000.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            Multi-Project Ledger
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Real-time material tracking and AI procurement advisory for{" "}
            {sites.length} active sites.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-white border border-neutral-200 text-neutral-700 font-medium rounded-lg text-sm hover:bg-neutral-50 transition-colors">
            Generate Report
          </button>
          <Link
            to="/advisory"
            className="px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg text-sm hover:bg-emerald-700 shadow-sm flex items-center gap-2 transition-colors"
          >
            <Zap className="w-4 h-4" /> Smart Procure
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-20">
          <Loader className="w-8 h-8 text-emerald-600 animate-spin mr-3" />
          <p className="text-neutral-600 font-medium">
            Syncing with MatTrack Engine...
          </p>
        </div>
      ) : (
        <>
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map((m, idx) => {
              const Icon = m.icon;
              return (
                <div
                  key={idx}
                  className="bg-white p-5 border border-neutral-200 rounded-xl shadow-sm transition-all hover:shadow-md"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${m.bg} ${m.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-neutral-500">
                        {m.label}
                      </p>
                      <p className="text-2xl font-bold text-neutral-900">
                        {m.value}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Table */}
            <div className="lg:col-span-2 bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b flex items-center justify-between">
                <h2 className="font-semibold text-neutral-900">
                  Project Health Overview
                </h2>
                <Link
                  to="/projects"
                  className="text-sm text-emerald-600 font-medium hover:underline"
                >
                  View Ledger
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-neutral-50 text-neutral-500 border-b">
                    <tr>
                      <th className="px-6 py-3 font-medium">Project</th>
                      <th className="px-6 py-3 font-medium">Progress</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium">Shortages</th>
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {projects.map((p) => (
                      <tr 
                        key={p.id} 
                        onClick={() => navigate(`/projects/${p.raw_id}`)}
                        className="hover:bg-emerald-50/50 cursor-pointer group transition-colors border-b border-neutral-100 last:border-0"
                      >
                        <td className="px-6 py-4">
                          <div className="font-bold text-neutral-900 group-hover:text-emerald-600 transition-colors">
                            {p.name}
                          </div>
                          <div className="text-xs text-neutral-400 font-mono mt-0.5">
                            {p.id}
                          </div>
                        </td>
                        
                        {/* THE NEW DYNAMIC PROGRESS BAR */}
                        <td className="px-6 py-4 min-w-[150px]">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-neutral-500 uppercase">{p.stage_status}</span>
                            <span className="text-[10px] font-bold text-neutral-900">{p.progress}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                p.progress < 30 ? "bg-red-500" : 
                                p.progress < 70 ? "bg-amber-500" : "bg-emerald-500"
                              }`}
                              style={{ width: `${p.progress}%` }}
                            />
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${p.status === "Critical" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className={`px-6 py-4 font-bold ${p.shortages > 0 ? "text-red-600" : "text-neutral-400"}`}>
                          {p.shortages > 0 ? `${p.shortages} items` : "-"}
                        </td>

                        {/* NEW UPDATE BUTTON */}
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // Prevents the row click from firing and navigating away
                              setSelectedSiteId(p.raw_id);
                              setUpdateForm({ stage: p.stage_status, progress: p.progress });
                              setIsModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-800 rounded-lg text-xs font-bold transition-colors"
                          >
                            Update
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* AI Advisory Panel */}
            <div className="lg:col-span-1 bg-slate-900 rounded-xl shadow-lg text-white overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-800 flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-emerald-400" />
                <h2 className="font-semibold">Neural Net Advisory</h2>
              </div>
              <div className="p-6 flex-1 space-y-4">
                {aiAdvisories.length > 0 ? (
                  aiAdvisories.map((adv) => (
                    <div
                      key={adv.id}
                      className="bg-slate-800 p-4 rounded-lg border border-slate-700"
                    >
                      <div className="flex justify-between mb-2">
                        <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30 uppercase">
                          {adv.type}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {adv.confidence}% Confidence
                        </span>
                      </div>
                      <h3 className="text-sm font-bold mb-1">{adv.material}</h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {adv.reason}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center py-10">
                    <Zap className="w-8 h-8 text-slate-700 mb-3" />
                    <p className="text-xs text-slate-500">
                      No urgent advisories. <br /> Add items with 'Critical' or
                      'Surplus' status to trigger AI logic.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* --- NEW: The Update Modal --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-neutral-100 flex justify-between items-center bg-neutral-50">
              <h2 className="text-lg font-bold text-neutral-900">Update Project Status</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-neutral-200 rounded-md text-neutral-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">
                  Construction Stage
                </label>
                <select
                  value={updateForm.stage}
                  onChange={(e) => setUpdateForm({ ...updateForm, stage: e.target.value })}
                  className="w-full p-3 border border-neutral-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="Pre-construction">Pre-construction</option>
                  <option value="Foundation">Foundation</option>
                  <option value="Framing">Framing</option>
                  <option value="MEP">MEP (Mechanical, Electrical, Plumbing)</option>
                  <option value="Finishing">Finishing</option>
                  <option value="Turnover">Turnover / Completed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-2 flex justify-between">
                  <span>Overall Progress</span>
                  <span className="text-emerald-600">{updateForm.progress}%</span>
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={updateForm.progress}
                    onChange={(e) => setUpdateForm({ ...updateForm, progress: parseInt(e.target.value) || 0 })}
                    className="w-full accent-emerald-600 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={updateForm.progress}
                    onChange={(e) => setUpdateForm({ ...updateForm, progress: parseInt(e.target.value) || 0 })}
                    className="w-20 p-2 border border-neutral-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-neutral-100 flex justify-end gap-3 bg-neutral-50">
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="px-5 py-2.5 text-sm font-bold text-neutral-600 hover:bg-neutral-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveProgress} 
                className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}