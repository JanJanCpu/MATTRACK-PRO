import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, Package, AlertTriangle, CheckCircle2 } from "lucide-react";
import { sitesAPI, inventoryAPI } from "../../services/apiService";
import type { ProjectSite, Inventory } from "../../types";

export function ProjectDetails() {
  const { id } = useParams(); // Grabs the site ID from the URL
  const navigate = useNavigate();
  
  const [site, setSite] = useState<ProjectSite | null>(null);
  const [localInventory, setLocalInventory] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSiteData = async () => {
      setLoading(true);
      try {
        // Fetch all data and filter client-side for this specific site
        const [allSites, allInventory] = await Promise.all([
          sitesAPI.list(),
          inventoryAPI.list()
        ]);

        const targetSite = allSites.find(s => s.id === Number(id));
        if (!targetSite) {
          alert("Project site not found.");
          navigate("/projects");
          return;
        }

        setSite(targetSite);
        setLocalInventory(allInventory.filter(item => item.site_id === Number(id)));
      } catch (err) {
        console.error("Failed to load project details.");
      } finally {
        setLoading(false);
      }
    };

    fetchSiteData();
  }, [id, navigate]);

  if (loading || !site) {
    return <div className="p-12 text-center text-neutral-500">Loading site matrix...</div>;
  }

  const criticalCount = localInventory.filter(i => i.status === "Critical").length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Link to="/projects" className="p-2 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors">
          <ArrowLeft className="w-5 h-5 text-neutral-600" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-neutral-900">{site.site_name}</h1>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase rounded">Active Site</span>
          </div>
          <p className="text-sm text-neutral-500 mt-1 font-mono">
            ID: SITE-{site.id} | Coordinates: {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}
          </p>
        </div>
      </div>

      {/* Mini Dashboard for this specific site */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 border border-neutral-200 rounded-xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Package className="w-6 h-6" /></div>
          <div>
            <p className="text-sm text-neutral-500 font-medium">Total Local Items</p>
            <p className="text-2xl font-bold text-neutral-900">{localInventory.length}</p>
          </div>
        </div>
        <div className="bg-white p-5 border border-neutral-200 rounded-xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-red-50 text-red-600 rounded-lg"><AlertTriangle className="w-6 h-6" /></div>
          <div>
            <p className="text-sm text-neutral-500 font-medium">Critical Shortages</p>
            <p className="text-2xl font-bold text-neutral-900">{criticalCount}</p>
          </div>
        </div>
        <div className="bg-white p-5 border border-neutral-200 rounded-xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg"><CheckCircle2 className="w-6 h-6" /></div>
          <div>
            <p className="text-sm text-neutral-500 font-medium">Site Status</p>
            <p className={`text-lg font-bold ${criticalCount > 0 ? "text-red-600" : "text-emerald-600"}`}>
              {criticalCount > 0 ? "Requires Action" : "Healthy"}
            </p>
          </div>
        </div>
      </div>

      {/* Local Inventory Table */}
      <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50/50">
          <h2 className="font-bold text-neutral-900">Local Material Ledger</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-medium">
            <tr>
              <th className="px-6 py-4">Item & Brand</th>
              <th className="px-6 py-4 text-right">Quantity</th>
              <th className="px-6 py-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {localInventory.length > 0 ? (
              localInventory.map((item) => (
                <tr key={item.id} className="hover:bg-neutral-50/50">
                  <td className="px-6 py-4">
                    <div className="font-bold text-neutral-900">{item.item_name}</div>
                    <div className="text-xs text-neutral-500">{item.brand || "Generic"}</div>
                  </td>
                  <td className="px-6 py-4 text-right font-medium">
                    {item.quantity} <span className="text-neutral-400 font-normal text-xs">{item.unit}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full ${
                      item.status === "Critical" ? "bg-red-100 text-red-700"
                      : item.status === "Warning" ? "bg-amber-100 text-amber-700"
                      : "bg-emerald-100 text-emerald-700"
                    }`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="p-12 text-center text-neutral-400">
                  No materials logged for this specific site yet. Add some via the main Inventory page.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}