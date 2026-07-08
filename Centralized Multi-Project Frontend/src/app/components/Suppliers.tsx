import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  PackageOpen,
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
  ShieldAlert,
  X,
  Key,
  Copy,
  Check,
  UserPlus
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
import {
  suppliersAPI,
  geocodeAddress,
  sitesAPI,
} from "../../services/apiService";
import type { Supplier } from "../../types";

const BASE_URL = `http://${window.location.hostname}:8000`;

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
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [ratingEditId, setRatingEditId] = useState<number | null>(null);

  const [userRole, setUserRole] = useState("staff");

  // --- CATALOG MODAL STATE ---
  const [viewingCatalogFor, setViewingCatalogFor] = useState<Supplier | null>(null);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");

  // --- PURCHASE ORDER STATE ---
  const [draftingPOFor, setDraftingPOFor] = useState<any | null>(null);
  const [sites, setSites] = useState<any[]>([]);
  const [poForm, setPoForm] = useState({ site_id: "", quantity: 1 });
  const [userSiteId, setUserSiteId] = useState<string | null>(null);

  // --- VENDOR CREDENTIAL GENERATOR STATE ---
  const [managingCredsFor, setManagingCredsFor] = useState<Supplier | null>(null);
  const [credForm, setCredForm] = useState({ username: "", email: "", password: "Pentabuild2026!" });
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleOpenCredModal = (supplier: Supplier) => {
    const cleanSlug = supplier.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    setManagingCredsFor(supplier);
    setCredForm({
      username: `${cleanSlug}_seller`,
      email: `${cleanSlug}@pentabuild-portal.com`,
      password: "Pentabuild2026!"
    });
    setCopied(false);
  };

  const handleGenerateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingCredsFor) return;
    setIsGenerating(true);

    try {
      const response = await fetch(`${BASE_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: credForm.username.trim(),
          email: credForm.email.trim(),
          password: credForm.password,
          role: "seller",
          company_name: managingCredsFor.name,
          supplier_id: managingCredsFor.id
        })
      });

      if (response.ok) {
        alert(`✅ Portal Credentials Generated Successfully!\n\nVendor can now log into the Seller Dashboard using username: "${credForm.username}".`);
        setManagingCredsFor(null);
      } else {
        const errData = await response.json();
        alert(`Failed to create account: ${errData.detail || "Username may already be registered."}`);
      }
    } catch (err) {
      alert("Network Error: Could not connect to authentication server.");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyCredentials = () => {
    const text = `Pentabuild Seller Portal Login:\nURL: http://${window.location.host}/login\nUsername: ${credForm.username}\nPassword: ${credForm.password}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleConfirmPO = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const finalSiteId =
        userRole === "pm" || userRole === "staff" ? userSiteId : poForm.site_id;

      if (!finalSiteId) {
        alert("Error: No Project Site selected or assigned.");
        return;
      }

      const token = localStorage.getItem("token");
      
      const payload = {
        supplier_id: draftingPOFor.supplier_id,
        site_id: Number(finalSiteId),
        material_name: draftingPOFor.material_name,
        quantity: Number(poForm.quantity),
        total_price: Number(poForm.quantity) * Number(draftingPOFor.price)
      };

      const response = await fetch(`${BASE_URL}/inventory/purchase-orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to submit Purchase Order");
      }

      alert(
        `✅ Success! Order for ${poForm.quantity}x ${draftingPOFor.material_name} has been sent to the supplier.`
      );
      setDraftingPOFor(null);
      setPoForm(prev => ({ ...prev, quantity: 1 }));
    } catch (err: any) {
      console.error("API call failed:", err);
      alert(`Failed to submit Purchase Order: ${err.message}`);
    }
  };

  const handleViewCatalog = async (supplier: Supplier) => {
    setViewingCatalogFor(supplier);
    setLoadingCatalog(true);
    setCatalogSearch("");
    try {
      const token = localStorage.getItem("token");
      const headers: any = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(
        `${BASE_URL}/suppliers/${supplier.id}/catalog`,
        { headers },
      );

      if (response.ok) {
        const data = await response.json();
        setCatalogItems(data);
      } else {
        setCatalogItems([]);
      }
    } catch (err) {
      console.error("Failed to load catalog", err);
      setCatalogItems([]);
    } finally {
      setLoadingCatalog(false);
    }
  };

  const filteredCatalog = catalogItems.filter((item) =>
    item.material_name.toLowerCase().includes(catalogSearch.toLowerCase()),
  );

  const [formData, setFormData] = useState({
    name: "",
    contact: "",
    address: "",
    rating: 3,
  });
  const [position, setPosition] = useState<[number, number]>([14.5995, 121.0366]);
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
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const role = payload.role ? payload.role.toLowerCase() : "staff";
        setUserRole(role);

        if (payload.site_id) setUserSiteId(payload.site_id.toString());

        if (["admin", "owner"].includes(role)) {
          sitesAPI
            .list()
            .then((data) => {
              if (data && data.length > 0) {
                setSites(data);
              } else {
                const fallbackSite = [
                  { id: 999, name: "PENTABUILD Main HQ (Demo Site)" },
                ];
                setSites(fallbackSite);
              }
            })
            .catch(() => {
              const fallbackSite = [
                { id: 999, name: "PENTABUILD Main HQ (Demo Site)" },
              ];
              setSites(fallbackSite);
            });
        }
      } catch (e) {
        console.error("Token parse error", e);
      }
    }

    loadSuppliers();
  }, []);

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
        lat: position[0],
        lon: position[1],
        address: formData.address || "Location Unspecified",
        rating: formData.rating,
      });

      setFormData({ name: "", contact: "", address: "", rating: 3 });
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
      alert("Failed to delete supplier.");
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
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto">
      
      {/* --- SUPPLIER DIRECTORY HEADER --- */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            Crowdsourced Suppliers
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Manage unlisted local hardware stores and material catalogs.
          </p>
        </div>
        {["admin", "owner"].includes(userRole) && (
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
        )}
      </div>

      {/* --- ADD SUPPLIER FORM --- */}
      {showForm && ["admin", "owner"].includes(userRole) && (
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
                className="w-full p-2 border rounded-lg text-sm bg-neutral-50 focus:ring-2 focus:ring-slate-900 outline-none font-medium"
                placeholder="e.g. Kuya Boy Hardware"
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
                className="w-full p-2 border rounded-lg text-sm bg-neutral-50 focus:ring-2 focus:ring-slate-900 outline-none font-medium"
                placeholder="e.g. 0917-123-4567"
              />
            </div>

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
                  className="w-full p-2 border rounded-lg text-sm bg-neutral-50 focus:ring-2 focus:ring-slate-900 outline-none font-medium"
                  placeholder="e.g. 123 Main St, Caloocan"
                />
                <button
                  onClick={handleAddressSearch}
                  disabled={isSearching}
                  className="px-4 bg-slate-900 text-white font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-70 transition-colors shrink-0"
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
              <p className="text-xs text-neutral-400 mt-2 flex items-center gap-1 font-medium">
                <MapPin className="w-3 h-3" /> Tip: You can click the map to manually adjust the exact pin location.
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

      {userRole === "staff" && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl flex items-center gap-3 text-sm">
          <ShieldAlert className="w-5 h-5 text-blue-600 shrink-0" />
          <p>
            <strong>Procurement View Only:</strong> You are viewing the authorized supplier network. Contact a Pentabuild Administrator to register a new vendor or manage portal access credentials.
          </p>
        </div>
      )}

      {/* --- SUPPLIER TABLE --- */}
      <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-200">
            <tr>
              <th className="px-5 py-4 font-medium">Store & Contact</th>
              <th className="px-5 py-4 font-medium">Location</th>
              <th className="px-5 py-4 font-medium text-center">Quality Rating</th>
              <th className="px-5 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {sortedSuppliers.length > 0 ? (
              sortedSuppliers.map((sup: any) => {
                const isMotherStore = sup.name.toLowerCase().includes("pentabuild");

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
                                Internal
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5 font-medium">
                            <Phone className="w-3 h-3" /> {sup.contact}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-neutral-600 text-xs">
                      <div className="flex items-center gap-1 font-medium">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[200px]">
                          {sup.address || "Location Unspecified"}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {ratingEditId === sup.id &&
                      ["admin", "owner"].includes(userRole) ? (
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
                          disabled={userRole === "staff"}
                          onClick={() => setRatingEditId(sup.id)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full font-bold text-xs transition-colors ${userRole === "staff" ? "cursor-default" : "hover:opacity-80"} ${sup.quality_rating === 3 ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700"}`}
                        >
                          {sup.quality_rating > 3 && (
                            <CheckCircle2 className="w-3 h-3" />
                          )}
                          {sup.quality_rating}.0{" "}
                          <Star className="w-3 h-3" fill="currentColor" />
                        </button>
                      )}
                    </td>

                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleViewCatalog(sup)}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold"
                        >
                          <PackageOpen className="w-3.5 h-3.5" /> Catalog
                        </button>

                        {/* --- VENDOR CREDENTIAL BUTTON --- */}
                        {["admin", "owner"].includes(userRole) && !isMotherStore && (
                          <button
                            onClick={() => handleOpenCredModal(sup)}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold border border-indigo-200"
                            title="Generate/Manage Seller Portal Credentials"
                          >
                            <Key className="w-3.5 h-3.5" /> Portal Access
                          </button>
                        )}

                        {["admin", "owner"].includes(userRole) && (
                          <button
                            onClick={() => handleDelete(sup.id, sup.name)}
                            className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={4} className="p-12 text-center text-neutral-400 font-medium">
                  No crowdsourced suppliers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --- SUPPLIER CATALOG MODAL --- */}
      {viewingCatalogFor &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[80vh]">
              <div className="p-5 border-b bg-blue-50 border-blue-100 flex justify-between items-center text-blue-900 shrink-0">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Store className="w-5 h-5" /> {viewingCatalogFor.name} Catalog
                </h2>
                <button
                  onClick={() => setViewingCatalogFor(null)}
                  className="p-1 hover:bg-blue-200/50 rounded-md transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {!loadingCatalog && catalogItems.length > 0 && (
                <div className="bg-white p-3 border-b border-neutral-200 shrink-0">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Search catalog materials..."
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:bg-white focus:border-blue-500 outline-none font-medium transition-all"
                    />
                  </div>
                </div>
              )}

              <div className="overflow-y-auto p-0 bg-neutral-50 flex-1">
                {loadingCatalog ? (
                  <div className="py-12 text-center text-blue-600 font-bold animate-pulse">
                    Scanning supplier inventory...
                  </div>
                ) : catalogItems.length > 0 ? (
                  <table className="w-full text-left text-sm whitespace-nowrap bg-white">
                    <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-200 sticky top-0 shadow-sm">
                      <tr>
                        <th className="px-6 py-4 font-medium">Material</th>
                        <th className="px-6 py-4 font-medium text-right">Price</th>
                        <th className="px-6 py-4 font-medium text-center">Stock Level</th>
                        <th className="px-6 py-4 font-medium text-center">Delivery Rating</th>
                        <th className="px-6 py-4 font-medium text-right">Order</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {filteredCatalog.length > 0 ? (
                        filteredCatalog.map((item, i) => (
                          <tr key={i} className="hover:bg-neutral-50">
                            <td className="px-6 py-4 font-bold text-neutral-900">
                              {item.material_name}
                            </td>
                            <td className="px-6 py-4 text-right font-black text-emerald-700">
                              ₱{item.price.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span
                                className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  item.stock_level === "High"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : item.stock_level === "Medium"
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-red-100 text-red-700"
                                }`}
                              >
                                {item.stock_level}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center text-amber-500 font-bold flex items-center justify-center gap-1">
                              {item.delivery_rating}{" "}
                              <Star className="w-3 h-3" fill="currentColor" />
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => {
                                  setDraftingPOFor(item);
                                  // FIX: Auto-select the first available site to prevent the blank dropdown box
                                  setPoForm({
                                    site_id: sites.length > 0 ? sites[0].id.toString() : "",
                                    quantity: 1,
                                  });
                                }}
                                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 text-xs font-bold"
                              >
                                <Plus className="w-3.5 h-3.5" /> Draft PO
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-neutral-400 font-medium">
                            No materials found matching "{catalogSearch}"
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                ) : (
                  <div className="py-12 text-center text-neutral-400 font-medium">
                    <PackageOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No materials currently listed for this supplier.</p>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* --- DRAFT PURCHASE ORDER MODAL --- */}
      {draftingPOFor &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 z-[10000] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="p-4 border-b bg-slate-900 text-white">
                <h2 className="font-bold flex items-center gap-2">
                  <PackageOpen className="w-4 h-4" /> Direct Purchase Order
                </h2>
              </div>

              <form onSubmit={handleConfirmPO} className="p-5 space-y-4">
                <div>
                  <p className="text-xs text-neutral-500 font-bold uppercase">Material</p>
                  <p className="font-bold text-neutral-900">{draftingPOFor.material_name}</p>
                  <p className="text-sm text-emerald-600 font-bold">
                    ₱{draftingPOFor.price.toFixed(2)} / unit
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={poForm.quantity}
                    onChange={(e) =>
                      setPoForm({ ...poForm, quantity: Number(e.target.value) })
                    }
                    className="w-full p-2 border rounded-lg text-sm bg-neutral-50 focus:ring-2 focus:ring-slate-900 font-bold outline-none"
                  />
                </div>

                {["admin", "owner"].includes(userRole) ? (
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">
                      Deliver To Site
                    </label>
                    <select
                      required
                      value={poForm.site_id}
                      onChange={(e) =>
                        setPoForm({ ...poForm, site_id: e.target.value })
                      }
                      className="w-full p-2 border rounded-lg text-sm bg-neutral-50 text-neutral-900 font-medium focus:ring-2 focus:ring-slate-900 outline-none"
                    >
                      {/* FIX: Added a disabled placeholder option */}
                      <option value="" disabled>-- Select Destination Site --</option>
                      {sites.map((site) => (
                        <option key={site.id} value={site.id}>
                          {site.site_name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-xs flex gap-2 items-center font-medium">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <p>Order will be automatically routed to your assigned Project Site.</p>
                  </div>
                )}

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDraftingPOFor(null)}
                    className="flex-1 py-2 text-neutral-600 font-bold hover:bg-neutral-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-emerald-600 text-white font-bold hover:bg-emerald-700 rounded-lg transition-colors shadow-sm"
                  >
                    Confirm Order
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}

      {/* --- VENDOR CREDENTIAL GENERATOR MODAL --- */}
      {managingCredsFor &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 z-[10000] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="p-5 border-b bg-indigo-50 border-indigo-100 flex justify-between items-center text-indigo-900">
                <h2 className="text-base font-bold flex items-center gap-2">
                  <Key className="w-5 h-5 text-indigo-600" /> Portal Access: {managingCredsFor.name}
                </h2>
                <button
                  onClick={() => setManagingCredsFor(null)}
                  className="p-1 hover:bg-indigo-200/50 rounded-md transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleGenerateCredentials} className="p-6 space-y-4">
                <div className="bg-neutral-50 p-3.5 rounded-lg border border-neutral-200 text-xs text-neutral-600 space-y-1 font-medium">
                  <p><strong>Seller Role Linkage:</strong> Generating accounts below directly links the vendor to Supplier ID #{managingCredsFor.id}.</p>
                  <p>Vendors logging in with these credentials will gain exclusive access to the Seller Dashboard (`/seller/orders` & `/seller/materials`).</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">
                    Portal Username
                  </label>
                  <input
                    required
                    value={credForm.username}
                    onChange={(e) => setCredForm({ ...credForm, username: e.target.value })}
                    className="w-full p-2.5 border rounded-lg text-sm bg-neutral-50 font-bold outline-none focus:ring-2 focus:ring-indigo-600"
                    placeholder="e.g. kuyaboy_seller"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">
                    Notification Email
                  </label>
                  <input
                    type="email"
                    required
                    value={credForm.email}
                    onChange={(e) => setCredForm({ ...credForm, email: e.target.value })}
                    className="w-full p-2.5 border rounded-lg text-sm bg-neutral-50 font-medium outline-none focus:ring-2 focus:ring-indigo-600"
                    placeholder="e.g. store@pentabuild-portal.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase mb-1 flex justify-between">
                    <span>Initial Password</span>
                    <span className="text-[10px] text-indigo-600 font-normal">Min. 8 chars</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={credForm.password}
                      onChange={(e) => setCredForm({ ...credForm, password: e.target.value })}
                      className="w-full p-2.5 border rounded-lg text-sm font-mono font-bold bg-neutral-50 outline-none focus:ring-2 focus:ring-indigo-600 pr-24"
                    />
                    <button
                      type="button"
                      onClick={copyCredentials}
                      className="absolute right-1.5 top-1.5 px-2.5 py-1 bg-white hover:bg-neutral-100 border text-neutral-700 rounded text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className="pt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setManagingCredsFor(null)}
                    className="flex-1 py-2.5 text-neutral-600 font-bold hover:bg-neutral-100 rounded-lg text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isGenerating}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm shadow-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {isGenerating ? <Loader className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    Create Portal Account
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}