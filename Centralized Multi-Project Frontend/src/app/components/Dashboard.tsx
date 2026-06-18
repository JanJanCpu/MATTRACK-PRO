import {
  Building2,
  AlertTriangle,
  Truck,
  TrendingUp,
  BrainCircuit,
  Zap,
  Loader,
  X,
  Download,
  ArrowRight,
  BellRing // Added for the new Smart Alerts title
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
  const [isSyncing, setIsSyncing] = useState(false); 
  
  const navigate = useNavigate();

  // --- Modal State Variables ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [updateForm, setUpdateForm] = useState({ stage: "Pre-construction", progress: 0 });

  // 1. LIVE POLLING
  useEffect(() => {
    const fetchData = async (isInitialLoad = false) => {
      try {
        if (isInitialLoad) setLoading(true);
        else setIsSyncing(true); 
        
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
        setTimeout(() => setIsSyncing(false), 800); 
      }
    };

    fetchData(true);
    const interval = setInterval(() => fetchData(false), 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveProgress = async () => {
    if (!selectedSiteId) return;
    try {
      await sitesAPI.updateProgress(selectedSiteId, updateForm.stage, updateForm.progress);
      setIsModalOpen(false);
      const sitesData = await sitesAPI.list();
      setSites(sitesData);
    } catch (error) {
      alert("Failed to update progress. Check your connection.");
    }
  };

  const handleGenerateReport = () => {
    const headers = ["Project ID", "Project Name", "Construction Stage", "Progress %", "Overall Status", "Critical Shortages"];
    const rows = projects.map(p => [
      p.id, `"${p.name}"`, p.stage_status, `${p.progress}%`, p.status, p.shortages
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `MatTrack_Project_Health_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 2. REAL-TIME METRICS & ROUTING LOGIC
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
      // Action drops them into the Projects Ledger
      action: () => navigate("/projects") 
    },
    {
      label: "Critical Material Shortages",
      value: criticalShortages.length.toString(),
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-100",
      // Action drops them into Inventory WITH a hidden state filter
      action: () => navigate("/inventory", { state: { autoFilter: "Critical" } })
    },
    {
      label: "Pending Deliveries",
      value: inTransitCount.toString(),
      icon: Truck,
      color: "text-amber-600",
      bg: "bg-amber-100",
      // Action drops them into Inventory WITH a hidden state filter
      action: () => navigate("/inventory", { state: { autoFilter: "In Transit" } })
    },
    {
      label: "Available Surplus Items",
      value: surplusItems.length.toString(),
      icon: TrendingUp,
      color: "text-emerald-600",
      bg: "bg-emerald-100",
      // Action drops them into Inventory WITH a hidden state filter
      action: () => navigate("/inventory", { state: { autoFilter: "Surplus" } })
    },
  ];

  // 3. PROJECT MAPPING
  const projects = sites.map((site) => ({
    raw_id: site.id,
    id: `SITE-${site.id}`,
    name: site.site_name,
    location: `${site.latitude.toFixed(2)}, ${site.longitude.toFixed(2)}`,
    status: inventory.some((i) => i.site_id === site.id && i.status === "Critical") ? "Critical" : "On Track",
    progress: site.progress_percentage || 0, 
    stage_status: site.stage_status || "Pre-construction", 
    shortages: inventory.filter((i) => i.site_id === site.id && i.status === "Critical").length,
  }));

  // 4. SMART PROCUREMENT ALERTS (Formerly Neural Net)
  const aiAdvisories = [];

  if (surplusItems.length > 0) {
    aiAdvisories.push({
      id: 1,
      type: "Surplus Transfer",
      material: surplusItems[0].item_name,
      reason: `Found ${surplusItems[0].quantity} ${surplusItems[0].unit} surplus at ${sites.find((s) => s.id === surplusItems[0].site_id)?.site_name || "Site"}.`,
      confidence: 92,
      actionLabel: "View Routing Map",
      onAction: () => navigate("/logistics") 
    });
  }

  if (criticalShortages.length > 0) {
    aiAdvisories.push({
      id: 2,
      type: "Procurement",
      material: criticalShortages[0].item_name,
      reason: `System recommends nearest verified supplier to resolve shortage at ${sites.find((s) => s.id === criticalShortages[0].site_id)?.site_name || "Site"}.`,
      confidence: 88,
      actionLabel: "Find Suppliers",
      onAction: () => navigate("/suppliers") 
    });
  }

  if (error) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-xl">
        <p className="text-red-800 font-bold">Connection Error: {error}</p>
        <p className="text-sm text-red-700">Check if FastAPI is running on port 8000.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-3">
            Multi-Project Ledger
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black tracking-widest uppercase border border-emerald-200">
              <span className={`w-1.5 h-1.5 rounded-full bg-emerald-500 ${isSyncing ? 'animate-ping' : ''}`}></span>
              Live Sync
            </span>
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Real-time material tracking and procurement advisory for {sites.length} active sites.
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleGenerateReport}
            className="px-4 py-2 bg-white border border-neutral-200 text-neutral-700 font-medium rounded-lg text-sm hover:bg-neutral-50 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Export CSV
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
          <p className="text-neutral-600 font-medium">Syncing with MatTrack Engine...</p>
        </div>
      ) : (
        <>
          {/* UPDATED: Metrics Grid (Now Clickable) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map((m, idx) => {
              const Icon = m.icon;
              return (
                <div
                  key={idx}
                  onClick={m.action}
                  className="bg-white p-5 border border-neutral-200 rounded-xl shadow-sm transition-all hover:shadow-md hover:border-emerald-400 cursor-pointer active:scale-[0.98] group"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${m.bg} ${m.color} group-hover:scale-110 transition-transform`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-neutral-500 group-hover:text-emerald-700 transition-colors">
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
            <div className="lg:col-span-2 bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div className="px-6 py-5 border-b flex items-center justify-between">
                <h2 className="font-semibold text-neutral-900">
                  Project Health Overview
                </h2>
                <Link
                  to="/projects"
                  className="text-sm text-emerald-600 font-medium hover:underline flex items-center gap-1"
                >
                  View Full Ledger <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="overflow-x-auto flex-1">
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
                        onClick={() => navigate(`/projects`)} 
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

                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); 
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

            {/* UPDATED: Smart Procurement Alerts */}
            <div className="lg:col-span-1 bg-slate-900 rounded-xl shadow-lg text-white overflow-hidden flex flex-col border border-slate-800">
              <div className="p-6 border-b border-slate-800 flex items-center gap-2 bg-slate-900">
                <BellRing className="w-5 h-5 text-emerald-400" />
                <h2 className="font-semibold">Smart Procurement Alerts</h2>
              </div>
              <div className="p-6 flex-1 space-y-4 bg-slate-900/50">
                {aiAdvisories.length > 0 ? (
                  aiAdvisories.map((adv) => (
                    <div
                      key={adv.id}
                      className="bg-slate-800 p-4 rounded-lg border border-slate-700 hover:border-slate-500 transition-colors flex flex-col h-[180px]"
                    >
                      <div className="flex justify-between mb-2">
                        <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30 uppercase tracking-wider">
                          {adv.type}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold mb-1">{adv.material}</h3>
                      <p className="text-xs text-slate-400 leading-relaxed flex-1">
                        {adv.reason}
                      </p>
                      <button 
                        onClick={adv.onAction}
                        className="mt-3 w-full py-2 bg-slate-700 hover:bg-emerald-600 text-xs font-bold rounded flex items-center justify-center gap-2 transition-colors"
                      >
                        {adv.actionLabel} <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center py-10">
                    <Zap className="w-8 h-8 text-slate-700 mb-3" />
                    <p className="text-xs text-slate-500">
                      System optimization normal. <br /> No critical alerts detected across your network.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* The Update Modal */}
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