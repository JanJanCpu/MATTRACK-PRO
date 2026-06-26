import { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  Tooltip,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Search, MapPin } from "lucide-react";

// --- Leaflet Icon Fixes ---
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const createIcon = (color: string) =>
  new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

const icons = {
  project: createIcon("blue"),
  supplier: createIcon("green"),
  crowdsource: createIcon("orange"),
  surplus: createIcon("violet"),
  shortage: createIcon("red"),
};

interface MapLocation {
  id: number;
  type: "project" | "supplier" | "crowdsource" | "surplus" | "shortage";
  name: string;
  address: string;
  lat: number;
  lng: number;
  details: string;
}

export function LogisticsMap() {
  const [locations, setLocations] = useState<MapLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showProjects, setShowProjects] = useState(true);
  const [showSuppliers, setShowSuppliers] = useState(true);
  const [showCrowdsourced, setShowCrowdsourced] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Array to hold multiple active transfer routes!
  const [transferRoutes, setTransferRoutes] = useState<[number, number][][]>([]);

  const fetchDynamicMapData = async () => {
    try {
      setLoading(true);
      const BASE_URL = `http://${window.location.hostname}:8000`;
      const token = localStorage.getItem("token") || localStorage.getItem("access_token");
      
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${BASE_URL}/logistics/map-data`, { headers });
      if (!response.ok) throw new Error("Failed to fetch map data");
      
      const data = await response.json();
      const mapLocs: MapLocation[] = [];

      // 1. Plot Project Sites (Checking dynamically for Shortages or Surpluses)
      data.sites.forEach((site: any) => {
        const isShortage = data.shortages.some((s: any) => s.site_id === site.id);
        const isSurplus = data.surpluses.some((s: any) => s.site_id === site.id);

        let type: MapLocation["type"] = "project";
        let details = "Active Project Site (Inventory Stable)";

        if (isShortage) {
            type = "shortage";
            const shortItems = data.shortages.filter((s: any) => s.site_id === site.id).map((s: any) => `${s.item_name} (${s.quantity} ${s.unit})`);
            details = `CRITICAL SHORTAGE: ${shortItems.join(', ')}`;
        } else if (isSurplus) {
            type = "surplus";
            const surpItems = data.surpluses.filter((s: any) => s.site_id === site.id).map((s: any) => `${s.item_name} (${s.quantity} ${s.unit})`);
            details = `SURPLUS AVAILABLE: ${surpItems.join(', ')}`;
        }

        mapLocs.push({
            id: site.id,
            type,
            name: site.site_name,
            address: site.address || "Address not provided",
            lat: site.latitude,
            lng: site.longitude,
            details
        });
      });

      // 2. Plot Official Suppliers & Crowdsourced Stores
      data.suppliers.forEach((sup: any) => {
        mapLocs.push({
            id: sup.id + 1000, 
            type: sup.quality_rating >= 4.0 ? "supplier" : "crowdsource",
            name: sup.name,
            address: sup.address || "Address not provided",
            lat: sup.latitude,
            lng: sup.longitude,
            details: `Quality Rating: ${sup.quality_rating.toFixed(1)}/5 - Contact: ${sup.contact}`
        });
      });

      setLocations(mapLocs);

      // 3. Process the Suggested Transfer Routes via OSRM
      const newRoutes: [number, number][][] = [];
      for (const t of data.transfers) {
          try {
              const url = `https://router.project-osrm.org/route/v1/driving/${t.source_lon},${t.source_lat};${t.dest_lon},${t.dest_lat}?overview=full&geometries=geojson`;
              const routeRes = await fetch(url);
              const routeData = await routeRes.json();
              
              if (routeData.routes && routeData.routes.length > 0) {
                  // GeoJSON provides [lon, lat], Leaflet polyline needs [lat, lon]
                  const coords = routeData.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]]);
                  newRoutes.push(coords);
              }
          } catch (e) {
              console.warn("OSRM Failed, falling back to straight line");
              newRoutes.push([[t.source_lat, t.source_lon], [t.dest_lat, t.dest_lon]]);
          }
      }
      setTransferRoutes(newRoutes);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load locations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDynamicMapData();
    // Auto-refresh map data every 30 seconds to catch new shortages
    const interval = setInterval(fetchDynamicMapData, 30000); 
    return () => clearInterval(interval);
  }, []);

  const totalProjects = locations.filter((l) => ["project", "surplus", "shortage"].includes(l.type)).length;
  const totalSuppliers = locations.filter((l) => l.type === "supplier").length;
  const totalCrowdsource = locations.filter((l) => l.type === "crowdsource").length;

  const visibleLocations = locations.filter((loc) => {
    if (["project", "surplus", "shortage"].includes(loc.type) && !showProjects) return false;
    if (loc.type === "supplier" && !showSuppliers) return false;
    if (loc.type === "crowdsource" && !showCrowdsourced) return false;
    
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      const matchName = loc.name.toLowerCase().includes(query);
      const matchDetails = loc.details.toLowerCase().includes(query);
      const matchAddress = loc.address.toLowerCase().includes(query);
      
      if (!matchName && !matchDetails && !matchAddress) return false;
    }

    return true;
  });

  return (
    <div className="h-full flex flex-col space-y-4 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            Geospatial Logistics Dashboard
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Live interactive map visualizing active project sites, verified suppliers, crowdsourced stores, and optimal internal material transfers.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1 min-h-[500px]">
        {/* SIDEBAR LEGEND */}
        <div className="bg-white border border-neutral-200 rounded-xl shadow-sm p-4 flex flex-col gap-4 overflow-y-auto">
          
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Search locations or materials..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-neutral-100 border-transparent rounded-lg focus:bg-white focus:border-emerald-500 outline-none transition-all"
            />
          </div>

          <div>
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">Interactive Filters</h3>
            <div className="space-y-2 select-none">
              <div 
                onClick={() => setShowProjects(!showProjects)}
                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${showProjects ? 'bg-blue-50/50 hover:bg-blue-50' : 'opacity-40 grayscale hover:bg-neutral-50'}`}
              >
                <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png" className="w-3 h-5" alt="blue" />
                <span className="text-sm text-neutral-700 font-bold">Project Sites <span className="text-neutral-400 font-normal">({totalProjects})</span></span>
              </div>
              
              <div 
                onClick={() => setShowSuppliers(!showSuppliers)}
                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${showSuppliers ? 'bg-green-50/50 hover:bg-green-50' : 'opacity-40 grayscale hover:bg-neutral-50'}`}
              >
                <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png" className="w-3 h-5" alt="green" />
                <span className="text-sm text-neutral-700 font-bold">Official Suppliers <span className="text-neutral-400 font-normal">({totalSuppliers})</span></span>
              </div>

              <div 
                onClick={() => setShowCrowdsourced(!showCrowdsourced)}
                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${showCrowdsourced ? 'bg-orange-50/50 hover:bg-orange-50' : 'opacity-40 grayscale hover:bg-neutral-50'}`}
              >
                <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png" className="w-3 h-5" alt="orange" />
                <span className="text-sm text-neutral-700 font-bold">Crowdsourced Stores <span className="text-neutral-400 font-normal">({totalCrowdsource})</span></span>
              </div>
            </div>
            <p className="text-[10px] text-neutral-400 mt-2 px-2">Click items above to filter map visibility.</p>
          </div>

          <div className="pt-4 border-t border-neutral-200">
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">Active Logistics</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2 opacity-80">
                <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-violet.png" className="w-3 h-5" alt="violet" />
                <span className="text-sm text-neutral-700 font-medium">Surplus Material</span>
              </div>
              <div className="flex items-center gap-2 p-2 opacity-80">
                <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png" className="w-3 h-5" alt="red" />
                <span className="text-sm text-neutral-700 font-medium">Critical Shortage</span>
              </div>
              <div className="flex items-center gap-2 p-2 opacity-80">
                <div className="w-6 h-1 border-t-2 border-dashed border-indigo-600"></div>
                <span className="text-sm text-neutral-700 font-medium">Suggested Transfer (Road Network)</span>
              </div>
            </div>
          </div>
        </div>

        {/* MAP */}
        <div className="lg:col-span-3 bg-neutral-100 border border-neutral-200 rounded-xl overflow-hidden relative shadow-inner z-0">
          {!loading && (
            <MapContainer center={[14.57, 121.01]} zoom={13} className="w-full h-full z-0">
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              
              {visibleLocations.map((loc, i) => (
                <Marker key={i} position={[loc.lat, loc.lng]} icon={icons[loc.type]}>
                  <Tooltip direction="top" offset={[0, -35]} opacity={1}>
                    <span className="font-bold">{loc.name}</span>
                  </Tooltip>
                  <Popup>
                    <div className="p-1">
                      <strong className="text-base mb-1 block">{loc.name}</strong>
                      
                      <div className="flex items-start gap-1 text-[10px] text-neutral-500 mb-2">
                        <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                        <span>{loc.address}</span>
                      </div>
                      
                      {loc.type === 'surplus' && <span className="inline-block px-2 py-1 bg-violet-100 text-violet-800 text-[10px] font-bold rounded mb-1">SURPLUS DETECTED</span>}
                      {loc.type === 'shortage' && <span className="inline-block px-2 py-1 bg-red-100 text-red-800 text-[10px] font-bold rounded mb-1">CRITICAL SHORTAGE</span>}
                      
                      <div className="text-xs text-neutral-600 border-t pt-2 mt-1">{loc.details}</div>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* DYNAMIC ROAD ROUTING LINES */}
              {showProjects && transferRoutes.map((route, idx) => (
                <Polyline
                  key={idx}
                  positions={route}
                  pathOptions={{ color: '#4F46E5', dashArray: '10, 10', weight: 4, opacity: 0.9 }}
                />
              ))}
            </MapContainer>
          )}
        </div>
      </div>
    </div>
  );
}

