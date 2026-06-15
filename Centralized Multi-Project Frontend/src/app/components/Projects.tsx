import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; // <-- ADD THIS
import { sitesAPI } from "../../services/apiService";
import { Building2, Plus, Loader, MapPin, Search } from "lucide-react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ProjectSite } from "../../types";

// Leaflet Icon Fix
const defaultIcon = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Component to handle manual map clicks
function MapPinPicker({ position, setPosition }: { position: [number, number], setPosition: (pos: [number, number]) => void }) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });
  return <Marker position={position} icon={defaultIcon} />;
}

// Component to make the map "fly" to the new searched location
function MapUpdater({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(position, 15, { animate: true, duration: 1.5 });
  }, [position, map]);
  return null;
}

export function Projects() {
  const [sites, setSites] = useState<ProjectSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const navigate = useNavigate(); // <-- ADD THIS LINE HERE

  // Form State
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [position, setPosition] = useState<[number, number]>([14.5995, 121.0366]); // Default Manila

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

  // The Free Geocoding Function
  const handleAddressSearch = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!address.trim()) return;
    
    setIsSearching(true);
    try {
      // Calls OpenStreetMap's free geocoding API
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        const newLat = parseFloat(data[0].lat);
        const newLon = parseFloat(data[0].lon);
        setPosition([newLat, newLon]); // This updates the state, triggering the map to fly!
      } else {
        alert("Address not found. Please try adding a city or be more specific.");
      }
    } catch (err) {
      alert("Failed to connect to the geocoding service.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await sitesAPI.create({
        name: name,
        lat: position[0],
        lon: position[1],
      });

      setName("");
      setAddress("");
      setPosition([14.5995, 121.0366]);
      setShowForm(false);
      loadSites();

      alert("Project Site Saved Successfully!");
    } catch (err) {
      console.error("Save failed:", err);
      alert("Save failed. Please check your connection.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Project Site Ledger</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Manage and monitor all active PENTABUILD construction sites.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-sm"
        >
          {showForm ? "Cancel" : <><Plus className="w-4 h-4" /> Add New Site</>}
        </button>
      </div>

      {/* Geocoding Add Form */}
      {showForm && (
        <div className="bg-white p-6 rounded-xl border border-emerald-200 shadow-sm animate-in slide-in-from-top-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">
                Project Name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-3 border rounded-lg text-sm bg-neutral-50 focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="e.g. Makati Central Hub"
                required
              />
            </div>

            {/* NEW: Smart Address Search Bar */}
            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">
                Site Address
              </label>
              <div className="flex gap-2">
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="flex-1 p-3 border rounded-lg text-sm bg-neutral-50 focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="e.g. Intramuros, Manila"
                />
                <button
                  onClick={handleAddressSearch}
                  disabled={isSearching}
                  className="px-4 bg-slate-900 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-70 transition-colors shrink-0"
                >
                  {isSearching ? <Loader className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Locate
                </button>
              </div>
            </div>

            {/* The Visual Map Picker */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-neutral-500 uppercase">
                  Location Preview
                </label>
                <span className="text-[10px] text-neutral-400 font-mono">
                  {position[0].toFixed(4)}, {position[1].toFixed(4)}
                </span>
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

            <button
              type="submit"
              className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 transition-colors"
            >
              Confirm Location & Save Project
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
                  <tr key={site.id} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-neutral-900">{site.site_name}</div>
                          <div className="text-xs text-neutral-400">ID: SITE-{site.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-neutral-600">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-neutral-400" />
                        {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase rounded">
                        Active
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => navigate(`/projects/${site.id}`)} 
                        className="text-emerald-600 hover:text-emerald-700 hover:underline font-bold transition-colors"
                      >
                        Manage Inventory &rarr;
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