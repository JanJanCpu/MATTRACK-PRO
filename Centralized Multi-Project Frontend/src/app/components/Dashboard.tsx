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
  Loader
} from "lucide-react";
import { Link } from "react-router";
import { useState, useEffect } from "react";
import { sitesAPI, inventoryAPI, suppliersAPI } from "../../services/apiService";
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
        console.error('Failed to fetch dashboard data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Calculate metrics from API data
  const criticalShortages = inventory.filter(i => i.status === 'Critical').length;
  const surplusItems = inventory.filter(i => i.status === 'Surplus').length;
  
  const metrics = [
    { label: "Active Project Sites", value: sites.length.toString(), icon: Building2, color: "text-blue-600", bg: "bg-blue-100" },
    { label: "Critical Material Shortages", value: criticalShortages.toString(), icon: AlertTriangle, color: "text-red-600", bg: "bg-red-100" },
    { label: "Pending Deliveries", value: inventory.filter(i => i.status === 'In Transit').length.toString(), icon: Truck, color: "text-amber-600", bg: "bg-amber-100" },
    { label: "Available Surplus Items", value: surplusItems.toString(), icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-100" },
  ];

  // Mock project data based on sites
  const projects = sites.map((site, idx) => ({
    id: `P-${String(idx + 1).padStart(3, '0')}`,
    name: site.site_name,
    location: `${site.latitude.toFixed(2)}, ${site.longitude.toFixed(2)}`,
    status: idx % 3 === 0 ? "On Track" : idx % 3 === 1 ? "Warning" : "Critical",
    progress: 30 + (idx * 15) % 60,
    shortages: inventory.filter(i => i.site_id === site.id && i.status === 'Critical').length,
  }));

  // Mock deliveries based on in-transit inventory
  const recentDeliveries = inventory
    .filter(i => i.status === 'In Transit' || i.status === 'Completed' || i.status === 'Preparing')
    .slice(0, 3)
    .map((inv, idx) => ({
      id: `DLV-${String(idx + 1).padStart(3, '0')}`,
      material: inv.item_name,
      destination: sites.find(s => s.id === inv.site_id)?.site_name || 'Unknown Site',
      eta: idx === 0 ? 'Today, 14:00' : idx === 1 ? 'Delivered' : 'Tomorrow, 08:00',
      status: idx === 0 ? 'In Transit' : idx === 1 ? 'Completed' : 'Preparing',
    }));

  // Mock AI advisories
  const aiAdvisories = [
    {
      id: 1,
      type: "Surplus Transfer",
      material: surplusItems > 0 ? inventory.find(i => i.status === 'Surplus')?.item_name || "Materials" : "Pending Analysis",
      action: "Analyze surplus inventory for redistribution opportunities",
      reason: "System analyzing internal surplus items to optimize allocation across sites.",
      confidence: 85,
    },
    {
      id: 2,
      type: "Procurement",
      material: criticalShortages > 0 ? inventory.find(i => i.status === 'Critical')?.item_name || "Items" : "No Critical Items",
      action: "Review procurement options for critical items",
      reason: "AI evaluating supplier options and pricing for urgent material needs.",
      confidence: 78,
    }
  ];

  if (error) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-800">Error: {error}</p>
          <p className="text-sm text-red-700 mt-2">Make sure the backend API is running at http://localhost:8000</p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Multi-Project Ledger</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Real-time material tracking and AI procurement advisory for {sites.length} active sites.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-white border border-neutral-200 text-neutral-700 font-medium rounded-lg text-sm hover:bg-neutral-50 transition-colors">
            Generate Report
          </button>
          <button className="px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg text-sm hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-600/20 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Quick Procurement
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center p-8">
          <Loader className="w-6 h-6 text-emerald-600 animate-spin mr-2" />
          <p className="text-neutral-600">Loading dashboard data...</p>
        </div>
      )}

      {/* Metrics Grid */}
      {!loading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map((m, idx) => {
              const Icon = m.icon;
              return (
                <div key={idx} className="bg-white p-5 border border-neutral-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${m.bg} ${m.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-neutral-500">{m.label}</p>
                      <p className="text-2xl font-bold text-neutral-900 mt-0.5">{m.value}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Projects & Deliveries */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Active Projects Table */}
              <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-neutral-200 flex items-center justify-between">
                  <h2 className="font-semibold text-neutral-900">Project Health Overview</h2>
                  <Link to="/projects" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">
                    View All <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-200">
                      <tr>
                        <th className="px-6 py-3 font-medium">Project</th>
                        <th className="px-6 py-3 font-medium">Progress</th>
                        <th className="px-6 py-3 font-medium">Status</th>
                        <th className="px-6 py-3 font-medium">Shortages</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {projects.map((p) => (
                        <tr key={p.id} className="hover:bg-neutral-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-medium text-neutral-900">{p.name}</div>
                            <div className="text-neutral-500 text-xs mt-0.5">{p.id} &bull; {p.location}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-24 h-2 bg-neutral-100 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${p.progress > 70 ? 'bg-emerald-500' : p.progress > 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                                  style={{ width: `${p.progress}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium text-neutral-700">{p.progress}%</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              p.status === 'On Track' ? 'bg-emerald-100 text-emerald-800' :
                              p.status === 'Warning' ? 'bg-amber-100 text-amber-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {p.shortages > 0 ? (
                              <div className="flex items-center gap-1.5 text-red-600 font-medium">
                                <AlertTriangle className="w-4 h-4" />
                                {p.shortages} items
                              </div>
                            ) : (
                              <span className="text-neutral-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Logistics Preview */}
              <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-neutral-200">
                  <h2 className="font-semibold text-neutral-900">Recent Deliveries</h2>
                </div>
                <div className="divide-y divide-neutral-100">
                  {recentDeliveries.map((dlv) => (
                    <div key={dlv.id} className="p-4 px-6 flex items-center justify-between hover:bg-neutral-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${dlv.status === 'Completed' ? 'bg-emerald-100 text-emerald-600' : dlv.status === 'In Transit' ? 'bg-blue-100 text-blue-600' : 'bg-neutral-100 text-neutral-500'}`}>
                          {dlv.status === 'Completed' ? <CheckCircle2 className="w-5 h-5" /> : dlv.status === 'In Transit' ? <Truck className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="font-medium text-neutral-900">{dlv.material}</div>
                          <div className="text-xs text-neutral-500 mt-0.5">To: {dlv.destination}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-neutral-900">{dlv.status}</div>
                        <div className="text-xs text-neutral-500 mt-0.5">{dlv.eta}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-6 py-3 border-t border-neutral-200 bg-neutral-50 text-center">
                  <Link to="/logistics" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">View Full Logistics Map</Link>
                </div>
              </div>

            </div>

            {/* Right Column: AI Advisory */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-gradient-to-b from-slate-900 to-slate-800 rounded-xl shadow-lg border border-slate-700 overflow-hidden text-white">
                <div className="p-6 border-b border-slate-700/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BrainCircuit className="w-5 h-5 text-emerald-400" />
                    <h2 className="font-semibold text-white">Neural Net Advisory</h2>
                  </div>
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                </div>
                
                <div className="p-6 space-y-5">
                  {aiAdvisories.map((adv) => (
                    <div key={adv.id} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 hover:bg-slate-700/50 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          adv.type === 'Surplus Transfer' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 
                          'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {adv.type}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          {adv.confidence}% Match
                        </span>
                      </div>
                      
                      <h3 className="font-medium text-sm mb-1">{adv.material}</h3>
                      <p className="text-xs text-emerald-400 font-medium mb-2">{adv.action}</p>
                      <p className="text-xs text-slate-400 leading-relaxed border-t border-slate-700 pt-2">{adv.reason}</p>
                      
                      <button className="mt-3 w-full py-2 bg-slate-700 hover:bg-emerald-600 text-white text-xs font-medium rounded transition-colors">
                        Execute Suggestion
                      </button>
                    </div>
                  ))}
                </div>
                
                <div className="p-4 bg-slate-950/50 border-t border-slate-700/50 text-center">
                  <p className="text-xs text-slate-500">
                    Model updated using real-time inventory data.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
