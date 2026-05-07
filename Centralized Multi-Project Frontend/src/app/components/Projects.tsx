import React, { useState, useEffect } from "react";
import { sitesAPI } from "../../services/apiService";
import { Building2, Plus, MapPin, Loader, RefreshCw } from "lucide-react";
import type { ProjectSite } from "../../types";

export function Projects() {
  const [sites, setSites] = useState<ProjectSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");

  const loadSites = async () => {
    try {
      setLoading(true);
      const data = await sitesAPI.list();
      setSites(data);
    } catch (err) {
      console.error("Failed to load sites", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSites();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Use sitesAPI.create directly with the simple keys: name, lat, lon
      await sitesAPI.create({
        name: name, // matches SiteCreate schema
        lat: parseFloat(lat), // ensures it is a number
        lon: parseFloat(lon), // ensures it is a number
      });

      // Clear form and refresh
      setName("");
      setLat("");
      setLon("");
      setShowForm(false);
      loadSites();

      alert("Project Site Saved Successfully!");
    } catch (err) {
      console.error("Save failed:", err);
      alert(
        "Save failed. Check if your backend terminal shows a '422 Unprocessable Content' error.",
      );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            Project Site Ledger
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Manage and monitor all active PENTABUILD construction sites.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-sm"
        >
          {showForm ? (
            "Cancel"
          ) : (
            <>
              <Plus className="w-4 h-4" /> Add New Site
            </>
          )}
        </button>
      </div>

      {/* Quick Add Form (Conditional) */}
      {showForm && (
        <div className="bg-white p-6 rounded-xl border border-emerald-200 shadow-sm animate-in slide-in-from-top-4">
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
          >
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">
                Site Name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 border rounded-lg text-sm"
                placeholder="e.g. Makati Central Hub"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">
                Lat
              </label>
              <input
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="w-full p-2 border rounded-lg text-sm"
                placeholder="14.5"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">
                Lon
              </label>
              <input
                value={lon}
                onChange={(e) => setLon(e.target.value)}
                className="w-full p-2 border rounded-lg text-sm"
                placeholder="121.0"
                required
              />
            </div>
            <button
              type="submit"
              className="md:col-span-4 bg-emerald-600 text-white py-2 rounded-lg font-bold hover:bg-emerald-700"
            >
              Confirm and Save to Database
            </button>
          </form>
        </div>
      )}

      {/* Projects Table */}
      <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-neutral-500">
            <Loader className="w-8 h-8 animate-spin mb-2" />
            <p>Fetching sites from PostgreSQL...</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-medium">
              <tr>
                <th className="px-6 py-4">Project Details</th>
                <th className="px-6 py-4">Coordinates</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {sites.length > 0 ? (
                sites.map((site) => (
                  <tr
                    key={site.id}
                    className="hover:bg-neutral-50/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-neutral-900">
                            {site.site_name}
                          </div>
                          <div className="text-xs text-neutral-400">
                            ID: SITE-{site.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-neutral-600">
                      {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase rounded">
                        Active
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-blue-600 hover:underline font-medium">
                        Manage Inventory
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-neutral-400">
                    No projects found. Add your first site above!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
