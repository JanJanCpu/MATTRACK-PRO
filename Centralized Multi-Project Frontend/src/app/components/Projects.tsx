import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; // NEW: For the Parametric Pivot
import { sitesAPI, geocodeAddress, usersAPI, suppliersAPI } from "../../services/apiService"; 
import { 
  Building2, Plus, Loader, MapPin, Search, ArrowRightLeft, Map as MapIcon
} from "lucide-react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ProjectSite, Supplier } from "../../types";

const defaultIcon = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function MapPinPicker({ position, setPosition }: { position: [number, number], setPosition: (pos: [number, number]) => void }) {
  useMapEvents({ click(e) { setPosition([e.latlng.lat, e.latlng.lng]); } });
  return <Marker position={position} icon={defaultIcon} />;
}

function MapUpdater({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.flyTo(position, 15, { animate: true, duration: 1.5 }); }, [position, map]);
  return null;
}

export function Projects() {
  const navigate = useNavigate(); // NEW

  const [sites, setSites] = useState<ProjectSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  // Form States for New Site
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [position, setPosition] = useState<[number, number]>([14.5995, 121.0366]);
  
  const [staffList, setStaffList] = useState<any[]>([]);
  const [selectedManager, setSelectedManager] = useState<number | "">("");
  const [globalSuppliers, setGlobalSuppliers] = useState<Supplier[]>([]);

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
    
    const loadBackgroundData = async () => {
      try {
        const staff = await usersAPI.getStaff();
        setStaffList(staff);
        
        const suppliers = await suppliersAPI.list();
        setGlobalSuppliers(suppliers);
      } catch (err) {
        console.error("Failed to load background data", err);
      }
    };
    loadBackgroundData();
  }, []);

  const handleAddressSearch = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!address.trim()) return;
    
    setIsSearching(true);
    const coords = await geocodeAddress(address);
    if (coords) {
      setPosition([coords.lat, coords.lon]);
    } else {
      alert("Address not found. Please try adding a city or drop the pin manually on the map.");
    }
    setIsSearching(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedManager === "") {
      alert("Please assign a Project Manager / Staff member to this site.");
      return;
    }

    try {
      await sitesAPI.create({ 
        name, 
        address, 
        lat: position[0], 
        lon: position[1],
        manager_id: Number(selectedManager) 
      });
      
      setName(""); setAddress(""); setPosition([14.5995, 121.0366]); setSelectedManager("");
      setShowForm(false);
      loadSites();
      alert("Project Site Saved Successfully!");
    } catch (err) {
      alert("Save failed. Please check your connection.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Project Site Ledger</h1>
          <p className="text-sm text-neutral-500 mt-1">Manage and monitor all active PENTABUILD construction sites.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-sm">
          {showForm ? "Cancel" : <><Plus className="w-4 h-4" /> Add New Site</>}
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-xl border border-emerald-200 shadow-sm animate-in slide-in-from-top-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Project Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full p-3 border rounded-lg text-sm bg-neutral-50 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="e.g. Makati Central Hub" required />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Assign Project Manager</label>
              <select
                required
                value={selectedManager}
                onChange={(e) => setSelectedManager(Number(e.target.value))}
                className="w-full p-3 border rounded-lg text-sm bg-neutral-50 focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="" disabled>Select a Staff Member...</option>
                {staffList.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.username} ({staff.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Site Address</label>
              <div className="flex gap-2">
                <input value={address} onChange={(e) => setAddress(e.target.value)} className="flex-1 p-3 border rounded-lg text-sm bg-neutral-50 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="e.g. Intramuros, Manila" />
                <button onClick={handleAddressSearch} disabled={isSearching} className="px-4 bg-slate-900 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-70 transition-colors shrink-0">
                  {isSearching ? <Loader className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Locate
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-neutral-500 uppercase">Location Preview</label>
                <span className="text-[10px] text-neutral-400 font-mono">{position[0].toFixed(4)}, {position[1].toFixed(4)}</span>
              </div>
              <div className="h-[250px] w-full rounded-lg overflow-hidden border border-neutral-200 relative z-0">
                <MapContainer center={position} zoom={12} className="w-full h-full">
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <MapPinPicker position={position} setPosition={setPosition} />
                  <MapUpdater position={position} />
                </MapContainer>
              </div>
              <p className="text-xs text-neutral-400 mt-2 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Tip: You can still click the map to manually adjust the exact pin location.
              </p>
            </div>

            <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 transition-colors">
              Confirm Location & Save Project
            </button>
          </form>
        </div>
      )}

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
                <th className="px-6 py-4">Location & Coordinates</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {sites.length > 0 ? (
                sites.map((site) => (
                  <tr key={site.id} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Building2 className="w-5 h-5" /></div>
                        <div>
                          <div className="font-bold text-neutral-900">{site.site_name}</div>
                          <div className="text-xs text-neutral-400">ID: SITE-{site.id}</div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className="flex flex-col space-y-1">
                        <div className="flex items-center gap-1 font-medium text-neutral-700 text-xs">
                          <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span className="truncate max-w-[200px]">{(site as any).address || "Address pending database sync"}</span>
                        </div>
                        <div className="flex items-center gap-1 font-mono text-[10px] text-neutral-400">
                          <MapIcon className="w-3 h-3" />
                          {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 text-center">
                      <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase rounded">Active</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {/* --- THE MASTERSTROKE: PARAMETRIC PIVOT --- */}
                      <button 
                        onClick={() => navigate('/inventory', { state: { autoPivotSiteId: site.id, siteName: site.site_name } })} 
                        className="px-3 py-1.5 bg-neutral-100 text-neutral-700 hover:bg-neutral-200 hover:text-neutral-900 rounded-lg font-bold transition-colors text-xs flex items-center gap-1 ml-auto"
                      >
                        Manage Inventory <ArrowRightLeft className="w-3 h-3" />
                      </button>
                    </td>   
                  </tr>
                ))
              ) : (
                <tr><td colSpan={4} className="p-12 text-center text-neutral-400">No projects found. Add your first site above!</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}