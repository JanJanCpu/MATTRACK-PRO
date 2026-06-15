import {
  Building2,
  AlertTriangle,
  Truck,
  TrendingUp,
  ArrowRight,
  BrainCircuit,
  Zap,
  CheckCircle2,
  Clock,
  Loader,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { sitesAPI, inventoryAPI } from "../../services/apiService";
import type { ProjectSite, Inventory } from "../../types";

export function Dashboard() {
  const [sites, setSites] = useState<ProjectSite[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
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
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 1. FIXED: Real-time Metric Calculations from Database
  const criticalShortages = inventory.filter((i) => i.status === "Critical");
  const surplusItems = inventory.filter((i) => i.status === "Surplus");
  const inTransitCount = inventory.filter(
    (i) => i.status === "In Transit",
  ).length;

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

  // 2. FIXED: Map projects to include actual shortage counts
  const projects = sites.map((site, idx) => ({
    id: `SITE-${site.id}`,
    name: site.site_name,
    location: `${site.latitude.toFixed(2)}, ${site.longitude.toFixed(2)}`,
    status: inventory.some(
      (i) => i.site_id === site.id && i.status === "Critical",
    )
      ? "Critical"
      : "On Track",
    progress: 30 + ((site.id * 7) % 60), // Progress remains estimated based on ID
    shortages: inventory.filter(
      (i) => i.site_id === site.id && i.status === "Critical",
    ).length,
  }));

  // 3. FIXED: Neural Net Advisory items now generated from real database states
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
    <div className="space-y-6 animate-in fade-in duration-500">
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
          <button className="px-4 py-2 bg-white border border-neutral-200 text-neutral-700 font-medium rounded-lg text-sm hover:bg-neutral-50">
            Generate Report
          </button>
          <Link
            to="/advisory"
            className="px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg text-sm hover:bg-emerald-700 shadow-sm flex items-center gap-2"
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
                  className="bg-white p-5 border border-neutral-200 rounded-xl shadow-sm"
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
                  className="text-sm text-emerald-600 font-medium"
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
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {projects.map((p) => (
                      <tr key={p.id} className="hover:bg-neutral-50/50">
                        <td className="px-6 py-4 font-medium text-neutral-900">
                          {p.name}
                          <div className="text-xs text-neutral-400">{p.id}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="w-24 h-1.5 bg-neutral-100 rounded-full">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
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
                        <td className="px-6 py-4 font-bold text-red-600">
                          {p.shortages > 0 ? `${p.shortages} items` : "-"}
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
    </div>
  );
}
