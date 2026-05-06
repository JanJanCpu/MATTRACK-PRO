import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapPin, Navigation, Store, Plus, Search, Building2, HardHat, TrendingDown, Share2, Loader } from "lucide-react";
import { sitesAPI, suppliersAPI } from "../../services/apiService";
import type { ProjectSite, Supplier } from "../../types";

// Fix Leaflet's default icon path issues in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Custom Icons
const createIcon = (color: string) => {
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};

const icons = {
  project: createIcon('blue'),
  supplier: createIcon('green'),
  crowdsource: createIcon('orange')
};

interface MapLocation {
  id: number;
  type: "project" | "supplier" | "crowdsource";
  name: string;
  lat: number;
  lng: number;
  details: string;
}

export function LogisticsMap() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [locations, setLocations] = useState<MapLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const [sitesList, suppliersList] = await Promise.all([
          sitesAPI.list(),
          suppliersAPI.list(),
        ]);

        // Combine project sites and suppliers
        const mapLocations: MapLocation[] = [
          ...sitesList.map((site, idx) => ({
            id: site.id,
            type: "project" as const,
            name: site.site_name,
            lat: site.latitude,
            lng: site.longitude,
            details: `Project Site ${idx + 1} - Active`
          })),
          ...suppliersList.map((supplier) => ({
            id: supplier.id + 1000,
            type: supplier.quality_rating >= 4 ? ("supplier" as const) : ("crowdsource" as const),
            name: supplier.name,
            lat: supplier.latitude,
            lng: supplier.longitude,
            details: `Quality Rating: ${supplier.quality_rating.toFixed(1)} - ${supplier.contact}`
          }))
        ];

        setLocations(mapLocations);
      } catch (err) {
        console.error('Failed to fetch locations:', err);
        setError(err instanceof Error ? err.message : 'Failed to load locations');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const projectSites = locations.filter(l => l.type === 'project');
  const suppliers = locations.filter(l => l.type === 'supplier');
  const crowdsource = locations.filter(l => l.type === 'crowdsource');

  // Default center for Manila area, or calculate from first location
  const centerLat = locations.length > 0 ? locations[0].lat : 14.5995;
  const centerLng = locations.length > 0 ? locations[0].lng : 121.0366;

  return (
    <div className="h-full flex flex-col space-y-4 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Geospatial Logistics & Crowdsourcing</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Live interactive map mapping project sites, official suppliers, and crowdsourced hardware stores.
          </p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white font-medium rounded-lg text-sm hover:bg-orange-600 transition-colors shadow-sm shadow-orange-500/20"
        >
          <MapPin className="w-4 h-4" />
          Pin Local Store
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-800">Error: {error}</p>
          <p className="text-sm text-red-700 mt-2">Make sure the backend API is running at http://localhost:8000</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1 min-h-[500px]">
        {/* Sidebar Controls */}
        <div className="bg-white border border-neutral-200 rounded-xl shadow-sm p-4 flex flex-col gap-4 overflow-y-auto">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
            <input 
              type="text" 
              placeholder="Search locations..." 
              className="w-full pl-9 pr-4 py-2 text-sm bg-neutral-100 border-transparent rounded-lg focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none"
            />
          </div>

          <div>
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">Map Legend</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2 p-2 hover:bg-neutral-50 rounded cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500" />
                <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png" alt="Project" className="w-4 h-6 object-contain" />
                <span className="text-sm text-neutral-700 font-medium flex-1">Project Sites ({projectSites.length})</span>
              </label>
              <label className="flex items-center gap-2 p-2 hover:bg-neutral-50 rounded cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded border-neutral-300 text-green-600 focus:ring-green-500" />
                <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png" alt="Supplier" className="w-4 h-6 object-contain" />
                <span className="text-sm text-neutral-700 font-medium flex-1">Official Suppliers ({suppliers.length})</span>
              </label>
              <label className="flex items-center gap-2 p-2 hover:bg-neutral-50 rounded cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded border-neutral-300 text-orange-600 focus:ring-orange-500" />
                <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png" alt="Crowdsourced" className="w-4 h-6 object-contain" />
                <span className="text-sm text-neutral-700 font-medium flex-1">Verified Stores ({crowdsource.length})</span>
              </label>
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-neutral-200">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Share2 className="w-4 h-4 text-orange-600" />
                <h4 className="text-sm font-bold text-orange-800">Crowdsourcing Active</h4>
              </div>
              <p className="text-xs text-orange-700 leading-relaxed">
                Site engineers can "pin" and share real-time price and availability data from local, walk-in hardware stores to help lower procurement costs and minimize logistics travel time.
              </p>
            </div>
          </div>
        </div>

        {/* Map Container */}
        <div className="lg:col-span-3 bg-neutral-100 border border-neutral-200 rounded-xl overflow-hidden relative shadow-inner z-0">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <Loader className="w-6 h-6 text-emerald-600 animate-spin mr-2" />
              <p className="text-neutral-600">Loading map data...</p>
            </div>
          )}
          
          {!loading && (
            <MapContainer 
              center={[centerLat, centerLng]} 
              zoom={12} 
              className="w-full h-full min-h-[400px]"
              zoomControl={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {locations.map((loc) => (
                <Marker 
                  key={`${loc.type}-${loc.id}`}
                  position={[loc.lat, loc.lng]} 
                  icon={icons[loc.type as keyof typeof icons]}
                >
                  <Popup className="rounded-lg shadow-lg border-none overflow-hidden">
                    <div className="-m-3 min-w-[200px]">
                      <div className={`p-3 text-white font-semibold ${
                        loc.type === 'project' ? 'bg-blue-600' : 
                        loc.type === 'supplier' ? 'bg-green-600' : 'bg-orange-600'
                      }`}>
                        {loc.name}
                      </div>
                      <div className="p-3 bg-white">
                        <p className="text-sm text-neutral-600 mb-2">{loc.details}</p>
                        <button className="text-xs font-semibold text-blue-600 flex items-center gap-1 hover:underline">
                          <Navigation className="w-3 h-3" /> Get Directions
                        </button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}
        </div>
      </div>

      {/* Add Pin Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-orange-600">
                <MapPin className="w-5 h-5" />
                <h2 className="font-bold text-neutral-900">Pin Local Hardware Store</h2>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-neutral-400 hover:text-neutral-600">
                &times;
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-sm text-neutral-500">
                Crowdsource a new non-supplier store to share immediate availability and cheaper prices with the network.
              </p>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Store Name</label>
                  <input type="text" className="w-full p-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none" placeholder="e.g. Mang Jose Hardware" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Available Material</label>
                  <input type="text" className="w-full p-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none" placeholder="e.g. 10mm Rebar" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Price</label>
                    <input type="text" className="w-full p-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none" placeholder="₱" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Stock Level</label>
                    <select className="w-full p-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-white">
                      <option>High</option>
                      <option>Medium</option>
                      <option>Low</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Location / Coordinates</label>
                  <div className="flex gap-2">
                    <input type="text" className="w-full p-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none" placeholder="Auto-detecting..." readOnly value="14.5630, 121.0315" />
                    <button className="px-3 bg-neutral-100 border border-neutral-300 rounded-lg hover:bg-neutral-200 transition-colors">
                      <Navigation className="w-4 h-4 text-neutral-600" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex justify-end gap-3">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-800 transition-colors">
                Cancel
              </button>
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-orange-500 text-white font-medium rounded-lg text-sm hover:bg-orange-600 transition-colors shadow-sm">
                Share Pin to Network
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
