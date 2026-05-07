import {
  BrainCircuit,
  Cpu,
  Truck,
  Share2,
  Award,
  Zap,
  Star,
  ShieldCheck,
  ArrowRight,
  Loader,
  Search,
} from "lucide-react";
import { useState, useEffect } from "react";
import { advisoryAPI, sitesAPI, inventoryAPI } from "../../services/apiService";
import type { ProjectSite, Inventory } from "../../types";

export function Advisory() {
  const [sites, setSites] = useState<ProjectSite[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(false);

  // Selection States
  const [selectedSite, setSelectedSite] = useState<string>("");
  const [searchItem, setSearchItem] = useState("");
  const [aiResults, setAiResults] = useState<any[]>([]);

  useEffect(() => {
    sitesAPI.list().then(setSites);
    inventoryAPI.list().then(setInventory);
  }, []);

  const runAnalysis = async () => {
    if (!selectedSite || !searchItem)
      return alert("Please select a site and item.");
    setLoading(true);
    try {
      // Calls the real Neural Network logic from your FastAPI backend
      const results = await advisoryAPI.procure(
        Number(selectedSite),
        searchItem,
      );
      setAiResults(results);
    } catch (err) {
      alert("AI Engine Error. Check if backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            Smart Advisory Engine
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Multi-Criteria Procurement Optimization (SOP 1).
          </p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg border border-emerald-200">
          <BrainCircuit className="w-5 h-5" />
          <span className="text-sm font-semibold">Neural Net: Active</span>
        </div>
      </div>

      {/* Analysis Control Panel */}
      <div className="bg-slate-900 p-6 rounded-xl text-white shadow-lg grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
            Target Project Site
          </label>
          <select
            className="w-full bg-slate-800 border-slate-700 p-2 rounded-lg text-sm"
            onChange={(e) => setSelectedSite(e.target.value)}
          >
            <option value="">Select project...</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.site_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
            Required Material
          </label>
          <input
            className="w-full bg-slate-800 border-slate-700 p-2 rounded-lg text-sm"
            placeholder="e.g. Cement"
            onChange={(e) => setSearchItem(e.target.value)}
          />
        </div>
        <button
          onClick={runAnalysis}
          className="bg-emerald-500 hover:bg-emerald-600 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-all"
        >
          {loading ? (
            <Loader className="animate-spin" />
          ) : (
            <>
              <Cpu className="w-4 h-4" /> Run Neural Analysis
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Supplier Ranking (Real AI Scores) */}
        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
          <div className="p-5 border-b bg-indigo-50 text-indigo-900 font-bold flex items-center gap-2">
            <Award className="w-5 h-5" /> AI Sourcing Recommendations
          </div>
          <div className="p-5 space-y-4">
            {aiResults.length > 0 ? (
              aiResults.map((res, idx) => (
                <div
                  key={idx}
                  className={`p-4 border rounded-xl ${idx === 0 ? "bg-indigo-50 border-indigo-200" : ""}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-neutral-900">
                        {res.supplier}
                      </h3>
                      <p className="text-xs text-neutral-500">
                        Contact: {res.contact}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-indigo-600">
                        {res.score}
                      </div>
                      <div className="text-[10px] uppercase text-neutral-400">
                        Match Score
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs flex gap-4 text-neutral-600">
                    <span className="flex items-center gap-1">
                      <Truck className="w-3 h-3" /> {res.distance_km}km
                    </span>
                    <span className="flex items-center gap-1 font-bold text-emerald-600">
                      <Zap className="w-3 h-3" /> Predicted Best Value
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center py-10 text-neutral-400">
                Run analysis to see AI rankings.
              </p>
            )}
          </div>
        </div>

        {/* Surplus logic remains (you can keep your existing surplus mapping) */}
      </div>
    </div>
  );
}
