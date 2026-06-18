import React, { useState, useEffect } from "react";
import {
  Store,
  MapPin,
  Star,
  Plus,
  Phone,
  CheckCircle2,
  Trash2,
  Building2,
  Search,
  Loader,
} from "lucide-react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { suppliersAPI, geocodeAddress } from "../../services/apiService";
import type { Supplier } from "../../types";

// Leaflet Icon Fix
const defaultIcon = new L.Icon({
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function MapPinPicker({
  position,
  setPosition,
}: {
  position: [number, number];
  setPosition: (pos: [number, number]) => void;
}) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });
  return <Marker position={position} icon={defaultIcon} />;
}

function MapUpdater({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(position, 15, { animate: true, duration: 1.5 });
  }, [position, map]);
  return null;
}

export function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [ratingEditId, setRatingEditId] = useState<number | null>(null);

  // ---> PASTE THIS LINE HERE <---
  const [userRole, setUserRole] = useState<string>("staff");

  // Map & Form State
  const [formData, setFormData] = useState({
    name: "",
    contact: "",
    address: "",
    rating: "3",
  });
  const [position, setPosition] = useState<[number, number]>([
    14.5995, 121.0366,
  ]); // Default Manila
  const [isSearching, setIsSearching] = useState(false);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const data = await suppliersAPI.list();
      setSuppliers(data);
    } catch (err) {
      console.error("Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  useEffect(() => {
    loadSuppliers();

    // ---> PASTE THIS JWT DECODER INSIDE THE EFFECT <---
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setUserRole(payload.role?.toLowerCase() || "staff");
      } catch (e) {
        console.error("Failed to parse supplier role context", e);
      }
    }
  }, []);

  // NEW: Smart Address Geocoding
  const handleAddressSearch = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!formData.address.trim()) return;

    setIsSearching(true);
    const coords = await geocodeAddress(formData.address);
    if (coords) {
      setPosition([coords.lat, coords.lon]);
    } else {
      alert(
        "Address not found. Please add a city or drop the pin manually on the map.",
      );
    }
    setIsSearching(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await suppliersAPI.create({
        name: formData.name,
        contact: formData.contact,
        lat: position[0], // Saved from the visual map!
        lon: position[1],
        address: formData.address || undefined,
        rating: parseInt(formData.rating),
      });
      setFormData({ name: "", contact: "", address: "", rating: "3" });
      setPosition([14.5995, 121.0366]);
      setShowForm(false);
      loadSuppliers();
    } catch (err) {
      alert("Failed to save supplier data.");
    }
  };

  const handleUpdateRating = async (id: number, newRating: number) => {
    try {
      await suppliersAPI.updateRating(id, newRating);
      setRatingEditId(null);
      loadSuppliers();
    } catch (err) {
      alert("Failed to update rating.");
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (
      !window.confirm(
        `Are you sure you want to permanently remove "${name}" from the supplier network?`,
      )
    )
      return;
    try {
      await suppliersAPI.delete(id);
      loadSuppliers();
    } catch (err) {
      alert("Failed to delete supplier. Please check the console.");
    }
  };

  const sortedSuppliers = [...suppliers].sort((a, b) => {
    const isAMotherStore = a.name.toLowerCase().includes("pentabuild");
    const isBMotherStore = b.name.toLowerCase().includes("pentabuild");
    if (isAMotherStore && !isBMotherStore) return -1;
    if (!isAMotherStore && isBMotherStore) return 1;
    return b.quality_rating - a.quality_rating;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            Crowdsourced Suppliers
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Manage unlisted local hardware stores and material catalogs.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg font-medium flex items-center gap-2 hover:bg-slate-800 transition-all shadow-sm"
        >
          {showForm ? (
            "Cancel"
          ) : (
            <>
              <Plus className="w-4 h-4" /> Add Supplier
            </>
          )}
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-in slide-in-from-top-4">
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
          >
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">
                Store Name
              </label>
              <input
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full p-2 border rounded-lg text-sm bg-neutral-50 focus:ring-2 focus:ring-slate-900 outline-none"
                placeholder="e.g. Kuya Boy Hardware (or Pentabuild Internal)"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">
                Contact Details
              </label>
              <input
                required
                value={formData.contact}
                onChange={(e) =>
                  setFormData({ ...formData, contact: e.target.value })
                }
                className="w-full p-2 border rounded-lg text-sm bg-neutral-50 focus:ring-2 focus:ring-slate-900 outline-none"
                placeholder="e.g. 0917-123-4567"
              />
            </div>

            {/* The Smart Geocoding Input */}
            <div className="md:col-span-4">
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">
                Store Address
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  className="w-full p-2 border rounded-lg text-sm bg-neutral-50 focus:ring-2 focus:ring-slate-900 outline-none"
                  placeholder="e.g. 123 Main St, Caloocan"
                />
                <button
                  onClick={handleAddressSearch}
                  disabled={isSearching}
                  className="px-4 bg-slate-900 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-70 transition-colors shrink-0"
                >
                  {isSearching ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}{" "}
                  Locate
                </button>
              </div>
            </div>

            {/* The Interactive Leaflet Map */}
            <div className="md:col-span-4 mb-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-neutral-500 uppercase">
                  Location Preview
                </label>
                <span className="text-[10px] text-neutral-400 font-mono">
                  {position[0].toFixed(4)}, {position[1].toFixed(4)}
                </span>
              </div>
              <div className="h-[200px] w-full rounded-lg overflow-hidden border border-neutral-200 relative z-0">
                <MapContainer
                  center={position}
                  zoom={13}
                  className="w-full h-full"
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <MapPinPicker position={position} setPosition={setPosition} />
                  <MapUpdater position={position} />
                </MapContainer>
              </div>
              <p className="text-xs text-neutral-400 mt-2 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Tip: You can click the map to
                manually adjust the exact pin location if the address search is
                slightly off.
              </p>
            </div>

            <button
              type="submit"
              className="md:col-span-4 bg-slate-900 text-white py-2.5 rounded-lg font-bold hover:bg-slate-800 mt-2"
            >
              Confirm Location & Save Supplier
            </button>
          </form>
        </div>
      )}

      <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-200">
            <tr>
              <th className="px-5 py-4 font-medium">Store & Contact</th>
              <th className="px-5 py-4 font-medium">Location</th>
              <th className="px-5 py-4 font-medium text-center">
                Quality Rating
              </th>
              <th className="px-5 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {sortedSuppliers.length > 0 ? (
              sortedSuppliers.map((sup: any) => {
                const isMotherStore = sup.name
                  .toLowerCase()
                  .includes("pentabuild");

                return (
                  <tr
                    key={sup.id}
                    className={`transition-colors ${isMotherStore ? "bg-blue-50/50 hover:bg-blue-50" : "hover:bg-neutral-50/50"}`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg ${isMotherStore ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-600"}`}
                        >
                          {isMotherStore ? (
                            <Building2 className="w-4 h-4" />
                          ) : (
                            <Store className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-neutral-900 flex items-center gap-2">
                            {sup.name}
                            {isMotherStore && (
                              <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded uppercase tracking-wider font-bold">
                                Internal Primary
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3" /> {sup.contact}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-neutral-600 text-xs">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[200px]">
                          {sup.address ? sup.address : "Location Unspecified"}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {ratingEditId === sup.id ? (
                        <div className="flex items-center justify-center gap-1">
                          {[1, 2, 3, 4, 5].map((num) => (
                            <button
                              key={num}
                              onClick={() => handleUpdateRating(sup.id, num)}
                              className="p-1 hover:bg-amber-100 text-amber-500 rounded transition-colors"
                            >
                              <Star
                                className="w-4 h-4"
                                fill={
                                  num <= sup.quality_rating
                                    ? "currentColor"
                                    : "none"
                                }
                              />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <button
                          onClick={() => setRatingEditId(sup.id)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full font-bold text-xs transition-colors hover:opacity-80 ${sup.quality_rating === 3 ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700"}`}
                        >
                          {sup.quality_rating === 3 && (
                            <span className="mr-1">Unverified</span>
                          )}
                          {sup.quality_rating > 3 && (
                            <CheckCircle2 className="w-3 h-3" />
                          )}
                          {sup.quality_rating}.0{" "}
                          <Star className="w-3 h-3" fill="currentColor" />
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {/* ---> INJECT THIS GUARD WRAPPER CONDITION HERE <--- */}
                      {["admin", "owner"].includes(userRole) && (
                        <button
                          onClick={() => handleDelete(sup.id, sup.name)}
                          className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={4} className="p-12 text-center text-neutral-400">
                  No crowdsourced suppliers found. Add one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
