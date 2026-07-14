import { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Tooltip,
  Polyline
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Search, MapPin, Loader2, Lock } from "lucide-react";
import { sitesAPI, suppliersAPI, inventoryAPI, requestsAPI, purchaseOrdersAPI, transferAPI } from "../../services/apiService";
import type { ProjectSite, Supplier, Inventory as InventoryItem } from "../../types";

import { RestockSidebar } from "./RestockSidebar"; 

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const createIcon = (color: string) =>
  new L.Icon({
    iconUrl: `https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-2x-${color}.png`,
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
  manager_id?: number;
  type: "project" | "supplier" | "crowdsource" | "surplus" | "shortage";
  name: string;
  address: string;
  lat: number;
  lng: number;
  details: string;
  criticalItem?: string;
  criticalQty?: number;
}


function LocationMarker({ loc, hoveredRoute, onFindRoutes, loadingRoutes, userRole, currentUserId }: any) {
  const isHovered = hoveredRoute ? (
    (hoveredRoute.from[0] === loc.lat && hoveredRoute.from[1] === loc.lng) || 
    (hoveredRoute.to[0] === loc.lat && hoveredRoute.to[1] === loc.lng)
  ) : true;

  const isAdmin = ["admin", "owner"].includes(userRole);
  const isSiteManager = currentUserId === loc.manager_id;
  const canManageSite = isAdmin || isSiteManager;

  return (
    <Marker 
      position={[loc.lat, loc.lng]} 
      icon={icons[loc.type as keyof typeof icons]} 
      opacity={isHovered ? 1 : 0.4}
    >
      <Tooltip direction="top" offset={[0, -35]} opacity={1}>
        <span className="font-bold">{loc.name}</span>
      </Tooltip>
      <Popup>
        <div className="p-1 w-48">
          <strong className="text-base mb-1 block leading-tight">{loc.name}</strong>
          <div className="flex items-start gap-1 text-[10px] text-neutral-500 mb-2">
            <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
            <span>{loc.address}</span>
          </div>
          
          {loc.type === 'surplus' && <span className="inline-block px-2 py-1 bg-violet-100 text-violet-800 text-[10px] font-bold rounded mb-1 w-full text-center">SURPLUS DETECTED</span>}
          {loc.type === 'shortage' && <span className="inline-block px-2 py-1 bg-red-100 text-red-800 text-[10px] font-bold rounded mb-1 w-full text-center animate-pulse">CRITICAL SHORTAGE</span>}
          
          <div className="text-xs text-neutral-600 border-t pt-2 mt-1">{loc.details}</div>

          {loc.type === 'shortage' && loc.criticalItem && (
            <div className="mt-3">
              {canManageSite ? (
                <button 
                  onClick={() => onFindRoutes(loc.id, loc.criticalItem, loc.criticalQty)}
                  disabled={loadingRoutes === loc.id}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 rounded-lg text-xs transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  {loadingRoutes === loc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  {loadingRoutes === loc.id ? "Analyzing..." : "Find Best Routes"}
                </button>
              ) : (
                <div className="w-full bg-slate-100 text-slate-400 font-bold py-1.5 rounded-lg text-[10px] text-center border border-slate-200 flex items-center justify-center gap-1">
                  <Lock className="w-3 h-3" /> Managed by another PM
                </div>
              )}
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  );
}


export function LogisticsMap() {
  const [locations, setLocations] = useState<MapLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [userRole, setUserRole] = useState("pm");
  const [currentUserId, setCurrentUserId] = useState<number | null>(null); 
  
  const activeReqRef = useRef<{siteId: number | null, itemName: string, qty: number}>({ 
    siteId: null, itemName: "", qty: 0 
  });

  const [showProjects, setShowProjects] = useState(true);
  const [showSuppliers, setShowSuppliers] = useState(true);
  const [showCrowdsourced, setShowCrowdsourced] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [isRoutingMode, setIsRoutingMode] = useState(false); 
  const [restockOptions, setRestockOptions] = useState<any[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState<number | null>(null);

  const [hoveredRoute, setHoveredRoute] = useState<{from: [number, number], to: [number, number], type: string} | null>(null);
  const [osrmRoute, setOsrmRoute] = useState<[number, number][] | null>(null);
  const routeCache = useRef<Record<string, [number, number][]>>({});

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setUserRole(payload.role ? payload.role.toLowerCase() : "pm");
        setCurrentUserId(payload.id); 
      } catch (e) {}
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [sitesList, suppliersList, inventoryList] = await Promise.all([ sitesAPI.list(), suppliersAPI.list(), inventoryAPI.list() ]);

      const mapLocations: MapLocation[] = [
        ...sitesList.map((site: any) => {
          let type: MapLocation["type"] = "project";
          let details = `Standard Operations`;
          let address = site.address || "Address not provided";
          let criticalItemName = undefined;
          let criticalQty = 0;

          const siteInventory = inventoryList.filter((item: any) => item.site_id === site.id);
          const criticalItems = siteInventory.filter((item: any) => item.status === "Critical" || item.status === "Low Stock" || item.quantity <= 0);
          const surplusItems = siteInventory.filter((item: any) => item.status === "Surplus");

          if (criticalItems.length > 0) {
            type = "shortage";
            const firstItem = criticalItems[0];
            if (firstItem) {
                details = `CRITICAL NEEDS: ${criticalItems.map((i: any) => i.item_name).join(", ")}`;
                criticalItemName = firstItem.item_name;
                const baseline = firstItem.baseline_quantity || 0;
                const currentQty = firstItem.quantity || 0;
                criticalQty = Math.max(100, baseline - currentQty);
            }
          } else if (surplusItems.length > 0) {
            type = "surplus";
            details = `SURPLUS AVAILABLE: ${surplusItems.map((i: any) => i.item_name).join(", ")}`;
          }

          return {
            id: site.id,
            manager_id: site.manager_id, 
            type, name: site.site_name, address, lat: site.latitude, lng: site.longitude, details, criticalItem: criticalItemName, criticalQty: criticalQty,
          };
        }),
        ...suppliersList.map((supplier: any) => {
          return {
            id: supplier.id + 1000, 
            type: supplier.quality_rating >= 4 ? ("supplier" as const) : ("crowdsource" as const),
            name: supplier.name, address: supplier.address || "Address not provided",
            lat: supplier.latitude, lng: supplier.longitude,
            details: `Quality Rating: ${supplier.quality_rating.toFixed(1)}/5 Stars - Contact: ${supplier.contact}`,
          };
        }),
      ];
      setLocations(mapLocations);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to load locations"); } finally { setLoading(false); }
  };

  const handleFindRoutes = async (siteId: number, itemName: string, qty: number) => {
    try {
      setLoadingRoutes(siteId);
      
      activeReqRef.current = { siteId, itemName, qty };
      
      const baseUrl = import.meta.env.VITE_API_URL || "https://mattrack-personal.onrender.com";
      const response = await fetch(`${baseUrl}/advisory/auto-restock/${siteId}?item_name=${encodeURIComponent(itemName)}&quantity_needed=${qty}`);
      
      if (!response.ok) throw new Error("Failed to fetch routes");
      const data = await response.json();
      setRestockOptions(data);
      setIsRoutingMode(true); 
    } catch (error) { alert("Failed to calculate routes. Check backend connection."); } finally { setLoadingRoutes(null); }
  };

  const executeOrder = async (opt: any) => {
    try {
      const currentReq = activeReqRef.current;
      
      if (!currentReq.siteId) {
        throw new Error("CRITICAL ERROR: Lost tracking of the Project Site ID. Please refresh and try again.");
      }

      if (["admin", "owner"].includes(userRole)) {
        if (opt.type === "EXTERNAL_PURCHASE") {
          await purchaseOrdersAPI.create({ 
            supplier_id: opt.source_id, 
            site_id: currentReq.siteId, 
            material_name: currentReq.itemName, 
            quantity: currentReq.qty, 
            total_price: opt.estimated_total_cost 
          });
          alert(`Purchase Order directly dispatched to ${opt.source_name}!`);
        } else if (opt.type === "INTERNAL_TRANSFER") {
          await transferAPI.initiate({ 
            source_site_id: opt.source_id, 
            destination_site_id: currentReq.siteId, 
            item_name: currentReq.itemName, 
            brand: "Generic/No Brand", 
            quantity: currentReq.qty, 
            unit: opt.unit || "Pcs" 
          });
          alert(`Internal Transfer successfully initiated from ${opt.source_name}.`);
        }
      } else {
        await requestsAPI.create({ 
          item_name: currentReq.itemName, 
          brand: "Generic/No Brand", 
          quantity_needed: currentReq.qty, 
          unit: opt.unit || "Pcs", 
          site_id: currentReq.siteId, 
          status: "Pending Approval" 
        });
        alert(`Request safely submitted to the Secretary's queue for approval!`);
      }
      
      setIsRoutingMode(false); 
      setHoveredRoute(null);
      setOsrmRoute(null);
      fetchData();
    } catch (error: any) { alert(error.message || "Failed to process transaction."); }
  };

  const handleHoverOption = async (opt: any) => {
    const currentSiteId = activeReqRef.current.siteId;
    if (!currentSiteId) return;

    const targetLoc = locations.find(l => l.id === currentSiteId);
    const sourceLocId = opt.type === "INTERNAL_TRANSFER" ? opt.source_id : (opt.source_id + 1000);
    const sourceLoc = locations.find(l => l.id === sourceLocId);

    if (targetLoc && sourceLoc) {
      setHoveredRoute({ from: [sourceLoc.lat, sourceLoc.lng], to: [targetLoc.lat, targetLoc.lng], type: opt.type });

      const cacheKey = `${sourceLoc.id}-${targetLoc.id}`;
      if (routeCache.current[cacheKey]) {
        setOsrmRoute(routeCache.current[cacheKey]);
        return;
      }

      try {
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${sourceLoc.lng},${sourceLoc.lat};${targetLoc.lng},${targetLoc.lat}?overview=full&geometries=geojson`);
        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
          const exactRoadCoords = data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]] as [number, number]);
          routeCache.current[cacheKey] = exactRoadCoords;
          setOsrmRoute(exactRoadCoords);
        }
      } catch (e) { console.warn("OSRM routing failed."); }
    }
  };

  const handleLeaveOption = () => {
    setHoveredRoute(null);
    setOsrmRoute(null);
  }

  const visibleLocations = locations.filter((loc) => {
    if (["project", "surplus", "shortage"].includes(loc.type) && !showProjects) return false;
    if (loc.type === "supplier" && !showSuppliers) return false;
    if (loc.type === "crowdsource" && !showCrowdsourced) return false;
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      if (!loc.name.toLowerCase().includes(query) && !loc.details.toLowerCase().includes(query) && !loc.address.toLowerCase().includes(query)) return false;
    }
    return true;
  });

  return (
    <div className="h-full flex flex-col space-y-4 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Geospatial Logistics Dashboard</h1>
          <p className="text-sm text-neutral-500 mt-1">Live interactive map visualizing active project sites, verified suppliers, and optimal transfer routes.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1 min-h-[500px]">
        
        <div className="bg-white border border-neutral-200 rounded-xl shadow-sm flex flex-col overflow-hidden h-full">
          {isRoutingMode ? (
            <RestockSidebar 
              options={restockOptions} 
              userRole={userRole} 
              onClose={() => { setIsRoutingMode(false); setHoveredRoute(null); setOsrmRoute(null); }} 
              onExecute={executeOrder} 
              onHoverOption={handleHoverOption}
              onLeaveOption={handleLeaveOption}
            />
          ) : (
            <div className="p-4 flex flex-col gap-4 overflow-y-auto w-full h-full animate-in slide-in-from-left-4 duration-300">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                <input type="text" placeholder="Search locations or materials..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm bg-neutral-100 border-transparent rounded-lg focus:bg-white focus:border-emerald-500 outline-none transition-all" />
              </div>

              <div>
                <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">Interactive Filters</h3>
                <div className="space-y-2 select-none">
                  <div onClick={() => setShowProjects(!showProjects)} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${showProjects ? 'bg-blue-50/50 hover:bg-blue-50' : 'opacity-40 grayscale hover:bg-neutral-50'}`}>
                    <img src="https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-blue.png" className="w-3 h-5" alt="blue" />
                    <span className="text-sm text-neutral-700 font-bold">Project Sites</span>
                  </div>
                  <div onClick={() => setShowSuppliers(!showSuppliers)} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${showSuppliers ? 'bg-green-50/50 hover:bg-green-50' : 'opacity-40 grayscale hover:bg-neutral-50'}`}>
                    <img src="https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-green.png" className="w-3 h-5" alt="green" />
                    <span className="text-sm text-neutral-700 font-bold">Official Suppliers</span>
                  </div>
                  <div onClick={() => setShowCrowdsourced(!showCrowdsourced)} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${showCrowdsourced ? 'bg-orange-50/50 hover:bg-orange-50' : 'opacity-40 grayscale hover:bg-neutral-50'}`}>
                    <img src="https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-orange.png" className="w-3 h-5" alt="orange" />
                    <span className="text-sm text-neutral-700 font-bold">Crowdsourced Stores</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-3 bg-neutral-100 border border-neutral-200 rounded-xl overflow-hidden relative shadow-inner z-0 min-h-[500px]">
          {!loading && (
            <MapContainer center={[14.57, 121.01]} zoom={13} className="w-full h-full absolute inset-0">
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              
              {hoveredRoute && (
                <Polyline 
                  positions={osrmRoute || [hoveredRoute.from, hoveredRoute.to]} 
                  color={hoveredRoute.type === "INTERNAL_TRANSFER" ? "#8b5cf6" : "#3b82f6"} 
                  weight={5}
                  opacity={0.8}
                  dashArray={osrmRoute ? undefined : "10, 10"} 
                  className="animate-pulse"
                />
              )}

              {visibleLocations.map((loc) => (
                <LocationMarker 
                  key={`isolated-marker-${loc.type}-${loc.id}`}
                  loc={loc}
                  hoveredRoute={hoveredRoute}
                  onFindRoutes={handleFindRoutes}
                  loadingRoutes={loadingRoutes}
                  userRole={userRole}
                  currentUserId={currentUserId}
                />
              ))}
            </MapContainer>
          )}
        </div>
      </div>
    </div>
  );
}