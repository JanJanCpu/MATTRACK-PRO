import { AlertTriangle, TrendingDown, TrendingUp, PackageSearch, Filter, ArrowUpDown, Loader } from "lucide-react";
import { useState, useEffect } from "react";
import { inventoryAPI, sitesAPI } from "../../services/apiService";
import type { Inventory as InventoryItem, ProjectSite } from "../../types";

interface InventoryWithCategory extends InventoryItem {
  category: "Fast-Moving" | "Slow-Moving" | "Non-Moving";
  siteName: string;
}

export function Inventory() {
  const [filter, setFilter] = useState("All");
  const [inventoryData, setInventoryData] = useState<InventoryWithCategory[]>([]);
  const [sites, setSites] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const [inventoryList, sitesList] = await Promise.all([
          inventoryAPI.list(),
          sitesAPI.list(),
        ]);

        // Create a map of site IDs to names
        const siteMap = new Map(sitesList.map(s => [s.id, s.site_name]));
        setSites(siteMap);

        // Categorize inventory items (FSN analysis)
        const categorized = inventoryList.map(item => {
          let category: "Fast-Moving" | "Slow-Moving" | "Non-Moving" = "Non-Moving";
          
          // Simple FSN categorization based on status
          if (item.status === "Critical" || item.status === "Warning") {
            category = "Fast-Moving";
          } else if (item.status === "Healthy") {
            category = "Slow-Moving";
          } else if (item.status === "Surplus") {
            category = "Non-Moving";
          }

          return {
            ...item,
            category,
            siteName: siteMap.get(item.site_id) || `Site ${item.site_id}`,
          };
        });

        setInventoryData(categorized);
      } catch (err) {
        console.error('Failed to fetch inventory:', err);
        setError(err instanceof Error ? err.message : 'Failed to load inventory');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredData = filter === "All" 
    ? inventoryData 
    : inventoryData.filter(i => i.category === filter || i.status === filter);

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Inventory & FSN Analysis</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Automated Fast, Slow, and Non-moving categorization with real-time stock-out alerts.
          </p>
        </div>
        <div className="flex gap-2">
          {["All", "Fast-Moving", "Slow-Moving", "Non-Moving", "Critical"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f ? 'bg-emerald-600 text-white' : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center p-8">
          <Loader className="w-6 h-6 text-emerald-600 animate-spin mr-2" />
          <p className="text-neutral-600">Loading inventory data...</p>
        </div>
      )}

      {!loading && (
        <>
          {/* Real-time Alerts */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-red-800">Critical Stock-Out Warnings</h3>
                <ul className="mt-2 space-y-2">
                  {inventoryData.filter(i => i.status === "Critical").length > 0 ? (
                    inventoryData.filter(i => i.status === "Critical").map(item => (
                      <li key={item.id} className="text-sm text-red-700 bg-red-100/50 p-2 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span>
                          <strong>{item.siteName}:</strong> {item.item_name} running critically low ({item.quantity} {item.unit} remaining).
                        </span>
                        <span className="text-xs font-semibold px-2 py-1 bg-white/60 rounded border border-red-200 shadow-sm">
                          Immediate Action Required
                        </span>
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-red-700 p-2">No critical items at this time.</li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* FSN Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-neutral-200 p-5 rounded-xl shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-neutral-800">Fast-Moving (F)</h3>
                <TrendingUp className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-sm text-neutral-500 mt-1">High turnover. Requires frequent restocking.</p>
              <div className="mt-4 text-3xl font-bold text-neutral-900">
                {inventoryData.filter(i => i.category === "Fast-Moving").length}
              </div>
            </div>
            <div className="bg-white border border-neutral-200 p-5 rounded-xl shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-neutral-800">Slow-Moving (S)</h3>
                <ArrowUpDown className="w-5 h-5 text-amber-500" />
              </div>
              <p className="text-sm text-neutral-500 mt-1">Moderate turnover. Check usage rates.</p>
              <div className="mt-4 text-3xl font-bold text-neutral-900">
                {inventoryData.filter(i => i.category === "Slow-Moving").length}
              </div>
            </div>
            <div className="bg-white border border-neutral-200 p-5 rounded-xl shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-neutral-800">Non-Moving (N)</h3>
                <TrendingDown className="w-5 h-5 text-purple-500" />
              </div>
              <p className="text-sm text-neutral-500 mt-1">Idle inventory. Prime for redistribution.</p>
              <div className="mt-4 text-3xl font-bold text-neutral-900">
                {inventoryData.filter(i => i.category === "Non-Moving").length}
              </div>
            </div>
          </div>

          {/* Inventory Table */}
          <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/50">
              <div className="flex items-center gap-2">
                <PackageSearch className="w-5 h-5 text-neutral-500" />
                <h2 className="font-semibold text-neutral-900">Network Inventory</h2>
              </div>
              <button className="flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-emerald-600 transition-colors">
                <Filter className="w-4 h-4" /> Filter
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-200">
                  <tr>
                    <th className="px-5 py-3 font-medium">Item Name</th>
                    <th className="px-5 py-3 font-medium">Location</th>
                    <th className="px-5 py-3 font-medium text-right">Current Stock</th>
                    <th className="px-5 py-3 font-medium text-center">FSN Category</th>
                    <th className="px-5 py-3 font-medium text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredData.length > 0 ? (
                    filteredData.map((item) => (
                      <tr key={item.id} className="hover:bg-neutral-50/50 transition-colors">
                        <td className="px-5 py-4 font-medium text-neutral-900">{item.item_name}</td>
                        <td className="px-5 py-4 text-neutral-600">{item.siteName}</td>
                        <td className="px-5 py-4 text-right font-medium">
                          {item.quantity} <span className="text-neutral-400 font-normal text-xs">{item.unit}</span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                            item.category === "Fast-Moving" ? "bg-blue-100 text-blue-700" :
                            item.category === "Slow-Moving" ? "bg-amber-100 text-amber-700" :
                            "bg-purple-100 text-purple-700"
                          }`}>
                            {item.category.charAt(0)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                            item.status === "Critical" ? "bg-red-100 text-red-700 border border-red-200" :
                            item.status === "Warning" ? "bg-amber-100 text-amber-700 border border-amber-200" :
                            item.status === "Surplus" ? "bg-indigo-100 text-indigo-700 border border-indigo-200" :
                            "bg-emerald-100 text-emerald-700 border border-emerald-200"
                          }`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-neutral-500">
                        No inventory items found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
