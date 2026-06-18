import { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapPin, Navigation, Search, Share2, Loader, X } from "lucide-react";
import { sitesAPI, suppliersAPI } from "../../services/apiService";
import type { ProjectSite, Supplier } from "../../types";

// --- Leaflet Icon Fixes ---
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const createIcon = (color: string) =>
  new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

const icons = {
  project: createIcon("blue"),
  supplier: createIcon("green"),
  crowdsource: createIcon("orange"),
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

  // Form State with editable Lat/Lon
  const [pinForm, setPinForm] = useState({
    name: "",
    contact: "",
    lat: 14.5995,
    lon: 121.0366,
    material: "",
    price: "",
    stockLevel: "High",
    rating: 3.5,
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [sitesList, suppliersList] = await Promise.all([
        sitesAPI.list(),
        suppliersAPI.list(),
      ]);

      const mapLocations: MapLocation[] = [
        ...sitesList.map((site, idx) => ({
          id: site.id,
          type: "project" as const,
          name: site.site_name,
          lat: site.latitude,
          lng: site.longitude,
          details: `Project Site ${idx + 1} - Active`,
        })),
        ...suppliersList.map((supplier) => ({
          id: supplier.id + 1000,
          type:
            supplier.quality_rating >= 4
              ? ("supplier" as const)
              : ("crowdsource" as const),
          name: supplier.name,
          lat: supplier.latitude,
          lng: supplier.longitude,
          details: `Quality Rating: ${supplier.quality_rating.toFixed(1)} - ${supplier.contact}`,
        })),
      ];
      setLocations(mapLocations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load locations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Map Click Listener
  function MapClickHandler() {
    useMapEvents({
      click(e) {
        setPinForm((prev) => ({
          ...prev,
          lat: e.latlng.lat,
          lon: e.latlng.lng,
        }));
        setShowAddModal(true);
      },
    });
    return null;
  }

  const handleSavePin = async () => {
    if (!pinForm.name) return alert("Please enter store name");
    try {
      // Backend expects 'rating', 'lat', and 'lon'
      await suppliersAPI.create(pinForm);
      setShowAddModal(false);
      setPinForm({
        name: "",
        contact: "",
        lat: 14.5995,
        lon: 121.0366,
        material: "",
        price: "",
        stockLevel: "High",
        rating: 3.5,
      });
      fetchData();
      alert("Store pinned successfully!");
    } catch (err) {
      alert("Failed to save store pin.");
    }
  };

  const projectSites = locations.filter((l) => l.type === "project");
  const suppliers = locations.filter((l) => l.type === "supplier");
  const crowdsource = locations.filter((l) => l.type === "crowdsource");

  return (
    <div className="h-full flex flex-col space-y-4 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            Geospatial Logistics & Crowdsourcing
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Live interactive map mapping project sites, official suppliers, and
            crowdsourced hardware stores.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white font-medium rounded-lg text-sm hover:bg-orange-600 transition-colors shadow-sm shadow-orange-500/20"
        >
          <MapPin className="w-4 h-4" /> Pin Local Store
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1 min-h-[500px]">
        {/* SIDEBAR LEGEND (STAYING REMOVED NO LONGER - IT IS HERE) */}
        <div className="bg-white border border-neutral-200 rounded-xl shadow-sm p-4 flex flex-col gap-4 overflow-y-auto">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Search locations..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-neutral-100 border-transparent rounded-lg focus:bg-white focus:border-emerald-500 outline-none transition-all"
            />
          </div>

          <div>
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">
              Map Legend
            </h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2 p-2 hover:bg-neutral-50 rounded cursor-pointer">
                <img
                  src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png"
                  className="w-3 h-5"
                  alt="blue"
                />
                <span className="text-sm text-neutral-700 font-medium">
                  Project Sites ({projectSites.length})
                </span>
              </label>
              <label className="flex items-center gap-2 p-2 hover:bg-neutral-50 rounded cursor-pointer">
                <img
                  src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png"
                  className="w-3 h-5"
                  alt="green"
                />
                <span className="text-sm text-neutral-700 font-medium">
                  Official Suppliers ({suppliers.length})
                </span>
              </label>
              <label className="flex items-center gap-2 p-2 hover:bg-neutral-50 rounded cursor-pointer">
                <img
                  src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png"
                  className="w-3 h-5"
                  alt="orange"
                />
                <span className="text-sm text-neutral-700 font-medium">
                  Verified Stores ({crowdsource.length})
                </span>
              </label>
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-neutral-200">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2 text-orange-600">
                <Share2 className="w-4 h-4" />
                <h4 className="text-sm font-bold">Crowdsourcing Active</h4>
              </div>
              <p className="text-[10px] text-orange-700 leading-relaxed">
                Site engineers can "pin" and share real-time price and
                availability data from local hardware stores.
              </p>
            </div>
          </div>
        </div>

        {/* MAP */}
        <div className="lg:col-span-3 bg-neutral-100 border border-neutral-200 rounded-xl overflow-hidden relative shadow-inner z-0">
          {!loading && (
            <MapContainer
              center={[14.5995, 121.0366]}
              zoom={12}
              className="w-full h-full"
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapClickHandler />
              {locations.map((loc, i) => (
                <Marker
                  key={i}
                  position={[loc.lat, loc.lng]}
                  icon={icons[loc.type]}
                >
                  <Popup>
                    <div className="font-bold">{loc.name}</div>
                    <div className="text-xs text-neutral-500">
                      {loc.details}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}
        </div>
      </div>

      {/* INPUT MODAL (Matched to your screenshot) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-orange-600">
                <MapPin className="w-5 h-5" />
                <h2 className="font-bold text-neutral-900">
                  Pin Local Hardware Store
                </h2>
              </div>
              <button onClick={() => setShowAddModal(false)}>
                <X className="text-neutral-400 w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-neutral-500">
                Crowdsource a new non-supplier store to share immediate
                availability and cheaper prices with the network.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                    Store Name
                  </label>
                  <input
                    className="w-full p-2.5 bg-neutral-50 border rounded-lg text-sm"
                    placeholder="e.g. Mang Jose Hardware"
                    value={pinForm.name}
                    onChange={(e) =>
                      setPinForm({ ...pinForm, name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                    Available Material
                  </label>
                  <input
                    className="w-full p-2.5 bg-neutral-50 border rounded-lg text-sm"
                    placeholder="e.g. 10mm Rebar"
                    value={pinForm.material}
                    onChange={(e) =>
                      setPinForm({ ...pinForm, material: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                      Price
                    </label>
                    <input
                      className="w-full p-2.5 bg-neutral-50 border rounded-lg text-sm"
                      placeholder="₱"
                      value={pinForm.price}
                      onChange={(e) =>
                        setPinForm({ ...pinForm, price: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                      Stock Level
                    </label>
                    <select
                      className="w-full p-2.5 bg-neutral-50 border rounded-lg text-sm"
                      value={pinForm.stockLevel}
                      onChange={(e) =>
                        setPinForm({ ...pinForm, stockLevel: e.target.value })
                      }
                    >
                      <option>High</option>
                      <option>Medium</option>
                      <option>Low</option>
                    </select>
                  </div>
                </div>

                {/* EDITABLE COORDINATES */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                    Location / Coordinates
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      step="any"
                      className="w-full p-2.5 bg-white border border-neutral-200 rounded-lg text-[11px] font-mono"
                      placeholder="Latitude"
                      value={pinForm.lat}
                      onChange={(e) =>
                        setPinForm({
                          ...pinForm,
                          lat: parseFloat(e.target.value),
                        })
                      }
                    />
                    <input
                      type="number"
                      step="any"
                      className="w-full p-2.5 bg-white border border-neutral-200 rounded-lg text-[11px] font-mono"
                      placeholder="Longitude"
                      value={pinForm.lon}
                      onChange={(e) =>
                        setPinForm({
                          ...pinForm,
                          lon: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-neutral-50 border-t flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="text-sm font-medium text-neutral-500"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePin}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-orange-200"
              >
                Share Pin to Network
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
