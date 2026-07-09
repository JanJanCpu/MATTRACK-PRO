import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  PackageOpen, Store, MapPin, Star, Plus, Phone, CheckCircle2,
  Trash2, Building2, Search, Loader, ShieldAlert, X, Key,
  Copy, Check, UserPlus, ClipboardList, Clock, Navigation, Map as MapIcon
} from "lucide-react";
import {
  MapContainer, TileLayer, Marker, useMapEvents, useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { suppliersAPI, geocodeAddress, sitesAPI } from "../../services/apiService";
import type { Supplier, ProjectSite } from "../../types";

const BASE_URL = `http://${window.location.hostname}:8000`;

const defaultIcon = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function MapPinPicker({ position, setPosition }: { position: [number, number]; setPosition: (pos: [number, number]) => void }) {
  useMapEvents({ click(e) { setPosition([e.latlng.lat, e.latlng.lng]); } });
  return <Marker position={position} icon={defaultIcon} />;
}

function MapUpdater({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.flyTo(position, 15, { animate: true, duration: 1.5 }); }, [position, map]);
  return null;
}

// Math helper to calculate exact distance between a Project Site and a Supplier
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; 
};

export function Suppliers() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [recentSuppliers, setRecentSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [ratingEditId, setRatingEditId] = useState<number | null>(null);
  const [userRole, setUserRole] = useState("pm");

  // --- FILTERS ---
  const [searchQuery, setSearchQuery] = useState("");
  const [sites, setSites] = useState<ProjectSite[]>([]);
  const [proximitySiteId, setProximitySiteId] = useState<string>("");

  // --- MODALS ---
  const [viewingCatalogFor, setViewingCatalogFor] = useState<Supplier | null>(null);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");

  const [draftingPOFor, setDraftingPOFor] = useState<any | null>(null);
  const [poForm, setPoForm] = useState({ site_id: "", quantity: 1 });

  const [managingCredsFor, setManagingCredsFor] = useState<Supplier | null>(null);
  const [credForm, setCredForm] = useState({ username: "", email: "", password: "Pentabuild2026!" });
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const [formData, setFormData] = useState({ name: "", contact: "", address: "", rating: 3 });
  const [position, setPosition] = useState<[number, number]>([14.5995, 121.0366]);
  const [isSearching, setIsSearching] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [suppData, recentData, siteData] = await Promise.all([
        suppliersAPI.list(),
        suppliersAPI.getRecent().catch(() => []), // Failsafe if endpoint is empty
        sitesAPI.list().catch(() => [])
      ]);
      setSuppliers(suppData);
      setRecentSuppliers(recentData);
      setSites(siteData);
    } catch (err) {
      console.error("Failed to load supplier data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setUserRole(payload.role ? payload.role.toLowerCase() : "pm");
      } catch (e) {}
    }
    loadData();
  }, []);

  const handleAddressSearch = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!formData.address.trim()) return;
    setIsSearching(true);
    const coords = await geocodeAddress(formData.address);
    if (coords) setPosition([coords.lat, coords.lon]);
    else alert("Address not found. Please add a city or drop the pin manually.");
    setIsSearching(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await suppliersAPI.create({
        name: formData.name, contact: formData.contact, lat: position[0], lon: position[1],
        address: formData.address || "Location Unspecified", rating: formData.rating,
      });
      setFormData({ name: "", contact: "", address: "", rating: 3 });
      setPosition([14.5995, 121.0366]);
      setShowForm(false);
      loadData();
    } catch (err) { alert("Failed to save supplier data."); }
  };

  const handleUpdateRating = async (id: number, newRating: number) => {
    try {
      await suppliersAPI.updateRating(id, newRating);
      setRatingEditId(null);
      loadData();
    } catch (err) { alert("Failed to update rating."); }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently remove "${name}" from the network?`)) return;
    try {
      await suppliersAPI.delete(id);
      loadData();
    } catch (err) { alert("Failed to delete supplier."); }
  };

  const handleOpenCredModal = (supplier: Supplier) => {
    const cleanSlug = supplier.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    setManagingCredsFor(supplier);
    setCredForm({ username: `${cleanSlug}_seller`, email: `${cleanSlug}@pentabuild.com`, password: "Pentabuild2026!" });
    setCopied(false);
  };

  const handleGenerateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingCredsFor) return;
    setIsGenerating(true);
    try {
      const response = await fetch(`${BASE_URL}/register`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: credForm.username.trim(), email: credForm.email.trim(), password: credForm.password, role: "seller", company_name: managingCredsFor.name, supplier_id: managingCredsFor.id })
      });
      if (response.ok) {
        alert(`✅ Portal Credentials Generated!\nVendor username: "${credForm.username}".`);
        setManagingCredsFor(null);
      } else { alert("Failed to create account. Username may be taken."); }
    } catch (err) { alert("Network Error."); } finally { setIsGenerating(false); }
  };

  const copyCredentials = () => {
    navigator.clipboard.writeText(`Pentabuild Seller Portal Login:\nUsername: ${credForm.username}\nPassword: ${credForm.password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleViewCatalog = async (supplier: Supplier) => {
    setViewingCatalogFor(supplier);
    setLoadingCatalog(true);
    setCatalogSearch("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${BASE_URL}/suppliers/${supplier.id}/catalog`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      setCatalogItems(res.ok ? await res.json() : []);
    } catch (err) { setCatalogItems([]); } finally { setLoadingCatalog(false); }
  };

  const handleConfirmPO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poForm.site_id) return alert("Please select a destination Project Site.");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${BASE_URL}/inventory/purchase-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ supplier_id: draftingPOFor.supplier_id, site_id: Number(poForm.site_id), material_name: draftingPOFor.material_name, quantity: Number(poForm.quantity), total_price: Number(poForm.quantity) * Number(draftingPOFor.price) }),
      });
      if (!res.ok) throw new Error("Failed");
      alert(`✅ Success! Order sent to supplier.`);
      setDraftingPOFor(null); 
      setPoForm(prev => ({ ...prev, quantity: 1 }));
      
      // ERP FIX: Instantly refresh the catalog to show the new deducted stock!
      if (viewingCatalogFor) {
        handleViewCatalog(viewingCatalogFor);
      }
    } catch (err) { alert("Failed to submit PO"); }
  };

  // --- FILTER & SORT LOGIC ---
  const activeSite = sites.find(s => s.id.toString() === proximitySiteId);
  
  let processedSuppliers = [...suppliers];

  // 1. Search Filter
  if (searchQuery) {
    processedSuppliers = processedSuppliers.filter(s => 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (s.address && s.address.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }

  // 2. Map distances if a site is selected
  const suppliersWithDistance = processedSuppliers.map(sup => {
    let dist = null;
    if (activeSite) {
      dist = calculateDistance(activeSite.latitude, activeSite.longitude, sup.latitude, sup.longitude);
    }
    return { ...sup, distance: dist };
  });

  // 3. Sort by Distance (if active) OR by Quality Rating
  suppliersWithDistance.sort((a, b) => {
    if (activeSite && a.distance !== null && b.distance !== null) {
      return a.distance - b.distance; // Closest first
    }
    const isAMother = a.name.toLowerCase().includes("pentabuild");
    const isBMother = b.name.toLowerCase().includes("pentabuild");
    if (isAMother && !isBMother) return -1;
    if (!isAMother && isBMother) return 1;
    return b.quality_rating - a.quality_rating;
  });

  const filteredCatalog = catalogItems.filter((item) => item.material_name.toLowerCase().includes(catalogSearch.toLowerCase()));

  // Suggested Hardware: Well-known + 4.5+ star rating
  const suggestedHardware = suppliers.filter(s => s.quality_rating >= 4.5 || s.name.toLowerCase().includes("wilcon") || s.name.toLowerCase().includes("depot"));

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto">
      
      {/* --- HEADER --- */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Supplier Network</h1>
          <p className="text-sm text-neutral-500 mt-1">Manage vendor catalogs, track transactions, and locate hardware stores near your project sites.</p>
        </div>
        {["admin", "owner"].includes(userRole) && (
          <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-slate-900 text-white rounded-lg font-medium flex items-center gap-2 hover:bg-slate-800 transition-all shadow-sm">
            {showForm ? "Cancel" : <><Plus className="w-4 h-4" /> Add Supplier</>}
          </button>
        )}
      </div>

      {/* --- ADD SUPPLIER FORM --- */}
      {showForm && ["admin", "owner"].includes(userRole) && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-in slide-in-from-top-4">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Store Name</label>
              <input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value }) } className="w-full p-2 border rounded-lg text-sm bg-neutral-50 focus:ring-2 focus:ring-slate-900 outline-none font-medium" placeholder="e.g. Wilcon Builder's Depot" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Contact Details</label>
              <input required value={formData.contact} onChange={(e) => setFormData({ ...formData, contact: e.target.value }) } className="w-full p-2 border rounded-lg text-sm bg-neutral-50 focus:ring-2 focus:ring-slate-900 outline-none font-medium" placeholder="e.g. 0917-123-4567" />
            </div>
            <div className="md:col-span-4">
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Store Address</label>
              <div className="flex gap-2">
                <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value }) } className="w-full p-2 border rounded-lg text-sm bg-neutral-50 focus:ring-2 focus:ring-slate-900 outline-none font-medium" placeholder="e.g. 123 Main St, Quezon City" />
                <button onClick={handleAddressSearch} disabled={isSearching} className="px-4 bg-slate-900 text-white font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-70 transition-colors shrink-0">
                  {isSearching ? <Loader className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Locate
                </button>
              </div>
            </div>
            <div className="md:col-span-4 mb-2 mt-2">
              <div className="h-[200px] w-full rounded-lg overflow-hidden border border-neutral-200 relative z-0">
                <MapContainer center={position} zoom={13} className="w-full h-full">
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <MapPinPicker position={position} setPosition={setPosition} />
                  <MapUpdater position={position} />
                </MapContainer>
              </div>
            </div>
            <button type="submit" className="md:col-span-4 bg-slate-900 text-white py-2.5 rounded-lg font-bold hover:bg-slate-800 mt-2">Confirm Location & Save Supplier</button>
          </form>
        </div>
      )}

      {/* --- DASHBOARD: TRANSACTED & SUGGESTED HARDWARE --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* RECENTLY TRANSACTED */}
        <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-blue-600" /> Recently Transacted Hardware
          </h2>
          <div className="space-y-3">
            {recentSuppliers.length > 0 ? recentSuppliers.slice(0, 3).map(sup => (
              <div key={`rec-${sup.id}`} className="flex items-center justify-between p-3 rounded-lg bg-blue-50/50 border border-blue-100 hover:bg-blue-50 transition-colors cursor-pointer" onClick={() => handleViewCatalog(sup)}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-md"><Store className="w-4 h-4" /></div>
                  <div>
                    <p className="font-bold text-neutral-900 text-sm">{sup.name}</p>
                    <p className="text-[10px] text-neutral-500 truncate max-w-[200px]">{sup.address}</p>
                  </div>
                </div>
                <div className="text-blue-600 font-bold text-xs flex items-center gap-1"><PackageOpen className="w-3 h-3" /> Reorder</div>
              </div>
            )) : (
              <p className="text-sm text-neutral-400 italic">No recent purchase orders found.</p>
            )}
          </div>
        </div>

        {/* SUGGESTED / WELL-KNOWN */}
        <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4">
            <Star className="w-4 h-4 text-amber-500" /> Suggested & Top-Rated
          </h2>
          <div className="space-y-3">
            {suggestedHardware.length > 0 ? suggestedHardware.slice(0, 3).map(sup => (
              <div key={`sug-${sup.id}`} className="flex items-center justify-between p-3 rounded-lg bg-amber-50/30 border border-amber-100 hover:bg-amber-50 transition-colors cursor-pointer" onClick={() => handleViewCatalog(sup)}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 text-amber-600 rounded-md"><Star className="w-4 h-4" fill="currentColor"/></div>
                  <div>
                    <p className="font-bold text-neutral-900 text-sm">{sup.name}</p>
                    <p className="text-[10px] text-neutral-500 truncate max-w-[200px]">{sup.address}</p>
                  </div>
                </div>
                <div className="text-amber-600 font-bold text-xs">{sup.quality_rating}.0 ★</div>
              </div>
            )) : (
              <p className="text-sm text-neutral-400 italic">Add suppliers and rate them to see suggestions.</p>
            )}
          </div>
        </div>
      </div>

      {/* --- GEOSPATIAL & SEARCH FILTERS --- */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3 rounded-xl border border-neutral-200 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
          <input type="text" placeholder="Search hardware store name or city..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:bg-white focus:border-slate-500 outline-none font-medium transition-all" />
        </div>
        
        <div className="relative flex-1 w-full border-l sm:border-t-0 sm:border-l border-neutral-200 sm:pl-3">
          <MapIcon className="w-4 h-4 absolute left-3 sm:left-6 top-2.5 text-emerald-600" />
          <select 
            value={proximitySiteId} 
            onChange={(e) => setProximitySiteId(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg focus:bg-emerald-100 focus:border-emerald-500 outline-none font-bold transition-all cursor-pointer"
          >
            <option value="">Filter by Project Area (Proximity)</option>
            {sites.map(site => (
              <option key={`site-${site.id}`} value={site.id}>{site.site_name} Area</option>
            ))}
          </select>
        </div>
      </div>

      {/* --- MAIN SUPPLIER TABLE --- */}
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
            {suppliersWithDistance.length > 0 ? (
              suppliersWithDistance.map((sup: any) => {
                const isMotherStore = sup.name.toLowerCase().includes("pentabuild");

                return (
                  <tr key={sup.id} className={`transition-colors ${isMotherStore ? "bg-blue-50/50 hover:bg-blue-50" : "hover:bg-neutral-50/50"}`}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isMotherStore ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-600"}`}>
                          {isMotherStore ? <Building2 className="w-4 h-4" /> : <Store className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="font-bold text-neutral-900 flex items-center gap-2">
                            {sup.name}
                            {isMotherStore && (<span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded uppercase tracking-wider font-bold">Internal</span>)}
                          </div>
                          <div className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5 font-medium"><Phone className="w-3 h-3" /> {sup.contact}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 font-medium text-neutral-600 text-xs">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[200px]">{sup.address || "Location Unspecified"}</span>
                      </div>
                      {sup.distance !== null && (
                        <div className="text-[10px] font-bold text-emerald-600 mt-1 ml-4 bg-emerald-50 w-fit px-1.5 py-0.5 rounded">
                          <Navigation className="w-2.5 h-2.5 inline mr-1" />
                          {sup.distance.toFixed(1)} km away from site
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {ratingEditId === sup.id && ["admin", "owner"].includes(userRole) ? (
                        <div className="flex items-center justify-center gap-1">
                          {[1, 2, 3, 4, 5].map((num) => (
                            <button key={num} onClick={() => handleUpdateRating(sup.id, num)} className="p-1 hover:bg-amber-100 text-amber-500 rounded transition-colors">
                              <Star className="w-4 h-4" fill={num <= sup.quality_rating ? "currentColor" : "none"} />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <button disabled={["pm", "staff"].includes(userRole)} onClick={() => setRatingEditId(sup.id)} className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full font-bold text-xs transition-colors ${["pm", "staff"].includes(userRole) ? "cursor-default" : "hover:opacity-80"} ${sup.quality_rating <= 3 ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700"}`}>
                          {sup.quality_rating > 3 && <CheckCircle2 className="w-3 h-3" />}
                          {sup.quality_rating}.0 <Star className="w-3 h-3" fill="currentColor" />
                        </button>
                      )}
                    </td>

                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleViewCatalog(sup)} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold">
                          <PackageOpen className="w-3.5 h-3.5" /> Catalog
                        </button>
                        {["admin", "owner"].includes(userRole) && !isMotherStore && (
                          <button onClick={() => handleOpenCredModal(sup)} className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold border border-indigo-200" title="Manage Seller Portal Credentials">
                            <Key className="w-3.5 h-3.5" /> Portal Access
                          </button>
                        )}
                        {["admin", "owner"].includes(userRole) && (
                          <button onClick={() => handleDelete(sup.id, sup.name)} className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr><td colSpan={4} className="p-12 text-center text-neutral-400 font-medium">No suppliers match your current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --- SUPPLIER CATALOG MODAL --- */}
      {viewingCatalogFor &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[80vh]">
              <div className="p-5 border-b bg-blue-50 border-blue-100 flex justify-between items-center text-blue-900 shrink-0">
                <h2 className="text-lg font-bold flex items-center gap-2"><Store className="w-5 h-5" /> {viewingCatalogFor.name} Catalog</h2>
                <button onClick={() => setViewingCatalogFor(null)} className="p-1 hover:bg-blue-200/50 rounded-md transition-colors"><X className="w-5 h-5" /></button>
              </div>

              {!loadingCatalog && catalogItems.length > 0 && (
                <div className="bg-white p-3 border-b border-neutral-200 shrink-0">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                    <input type="text" placeholder="Search catalog materials..." value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:bg-white focus:border-blue-500 outline-none font-medium transition-all" />
                  </div>
                </div>
              )}

              <div className="overflow-y-auto p-0 bg-neutral-50 flex-1">
                {loadingCatalog ? (
                  <div className="py-12 text-center text-blue-600 font-bold animate-pulse">Scanning supplier inventory...</div>
                ) : catalogItems.length > 0 ? (
                  <table className="w-full text-left text-sm whitespace-nowrap bg-white">
                    <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-200 sticky top-0 shadow-sm">
                      <tr>
                        <th className="px-6 py-4 font-medium">Material</th>
                        <th className="px-6 py-4 font-medium text-right">Price</th>
                        <th className="px-6 py-4 font-medium text-center">Available Stock</th>
                        <th className="px-6 py-4 font-medium text-center">Stock Level</th>
                        <th className="px-6 py-4 font-medium text-center">Delivery Rating</th>
                        <th className="px-6 py-4 font-medium text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {filteredCatalog.length > 0 ? (
                        filteredCatalog.map((item, i) => (
                          <tr key={i} className="hover:bg-neutral-50">
                            <td className="px-6 py-4 font-bold text-neutral-900">{item.material_name}</td>
                            <td className="px-6 py-4 text-right font-black text-emerald-700">₱{item.price.toFixed(2)}</td>
                            <td className="px-6 py-4 text-center font-bold text-slate-700">{item.quantity} {item.unit}</td>
                            <td className="px-6 py-4 text-center">
                              <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${item.stock_level === "High" ? "bg-emerald-100 text-emerald-700" : item.stock_level === "Medium" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>{item.stock_level}</span>
                            </td>
                            <td className="px-6 py-4 text-center text-amber-500 font-bold flex items-center justify-center gap-1">
                              {item.delivery_rating} <Star className="w-3 h-3" fill="currentColor" />
                            </td>
                            <td className="px-6 py-4 text-right">
                              {["admin", "owner"].includes(userRole) ? (
                                <button onClick={() => { setDraftingPOFor(item); setPoForm({ site_id: sites.length > 0 ? sites[0].id.toString() : "", quantity: 1 }); }} className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 text-xs font-bold">
                                  <Plus className="w-3.5 h-3.5" /> Draft PO
                                </button>
                              ) : (
                                <button onClick={() => navigate("/requests")} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 text-xs font-bold shadow-sm">
                                  <ClipboardList className="w-3.5 h-3.5" /> Request Item
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={6} className="py-12 text-center text-neutral-400 font-medium">No materials found matching "{catalogSearch}"</td></tr>
                      )}
                    </tbody>
                  </table>
                ) : (
                  <div className="py-12 text-center text-neutral-400 font-medium"><PackageOpen className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>No materials currently listed for this supplier.</p></div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* --- DRAFT PURCHASE ORDER MODAL (ADMIN ONLY) --- */}
      {draftingPOFor && ["admin", "owner"].includes(userRole) &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 z-[10000] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="p-4 border-b bg-slate-900 text-white"><h2 className="font-bold flex items-center gap-2"><PackageOpen className="w-4 h-4" /> Direct Purchase Order</h2></div>
              <form onSubmit={handleConfirmPO} className="p-5 space-y-4">
                <div>
                  <p className="text-xs text-neutral-500 font-bold uppercase">Material</p>
                  <p className="font-bold text-neutral-900">{draftingPOFor.material_name}</p>
                  <p className="text-sm text-emerald-600 font-bold">₱{draftingPOFor.price.toFixed(2)} / unit</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Quantity</label>
                  <input type="number" min="1" required value={poForm.quantity} onChange={(e) => setPoForm({ ...poForm, quantity: Number(e.target.value) }) } className="w-full p-2 border rounded-lg text-sm bg-neutral-50 focus:ring-2 focus:ring-slate-900 font-bold outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Deliver To Site</label>
                  <select required value={poForm.site_id} onChange={(e) => setPoForm({ ...poForm, site_id: e.target.value }) } className="w-full p-2 border rounded-lg text-sm bg-neutral-50 text-neutral-900 font-medium focus:ring-2 focus:ring-slate-900 outline-none">
                    <option value="" disabled>-- Select Destination Site --</option>
                    {sites.map((site) => (<option key={site.id} value={site.id}>{site.site_name}</option>))}
                  </select>
                </div>
                <div className="pt-2 flex gap-2">
                  <button type="button" onClick={() => setDraftingPOFor(null)} className="flex-1 py-2 text-neutral-600 font-bold hover:bg-neutral-100 rounded-lg transition-colors">Cancel</button>
                  <button type="submit" className="flex-1 py-2 bg-emerald-600 text-white font-bold hover:bg-emerald-700 rounded-lg transition-colors shadow-sm">Confirm Order</button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}

      {/* --- VENDOR CREDENTIAL GENERATOR MODAL (ADMIN ONLY) --- */}
      {managingCredsFor && ["admin", "owner"].includes(userRole) &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 z-[10000] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="p-5 border-b bg-indigo-50 border-indigo-100 flex justify-between items-center text-indigo-900">
                <h2 className="text-base font-bold flex items-center gap-2"><Key className="w-5 h-5 text-indigo-600" /> Portal Access: {managingCredsFor.name}</h2>
                <button onClick={() => setManagingCredsFor(null)} className="p-1 hover:bg-indigo-200/50 rounded-md transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleGenerateCredentials} className="p-6 space-y-4">
                <div className="bg-neutral-50 p-3.5 rounded-lg border border-neutral-200 text-xs text-neutral-600 space-y-1 font-medium">
                  <p><strong>Seller Role Linkage:</strong> Generating accounts below directly links the vendor to Supplier ID #{managingCredsFor.id}.</p>
                  <p>Vendors logging in with these credentials will gain exclusive access to the Seller Dashboard.</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Portal Username</label>
                  <input required value={credForm.username} onChange={(e) => setCredForm({ ...credForm, username: e.target.value })} className="w-full p-2.5 border rounded-lg text-sm bg-neutral-50 font-bold outline-none focus:ring-2 focus:ring-indigo-600" placeholder="e.g. kuyaboy_seller" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Notification Email</label>
                  <input type="email" required value={credForm.email} onChange={(e) => setCredForm({ ...credForm, email: e.target.value })} className="w-full p-2.5 border rounded-lg text-sm bg-neutral-50 font-medium outline-none focus:ring-2 focus:ring-indigo-600" placeholder="e.g. store@pentabuild-portal.com" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase mb-1 flex justify-between"><span>Initial Password</span><span className="text-[10px] text-indigo-600 font-normal">Min. 8 chars</span></label>
                  <div className="relative">
                    <input type="text" required value={credForm.password} onChange={(e) => setCredForm({ ...credForm, password: e.target.value })} className="w-full p-2.5 border rounded-lg text-sm font-mono font-bold bg-neutral-50 outline-none focus:ring-2 focus:ring-indigo-600 pr-24" />
                    <button type="button" onClick={copyCredentials} className="absolute right-1.5 top-1.5 px-2.5 py-1 bg-white hover:bg-neutral-100 border text-neutral-700 rounded text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs">
                      {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />} {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
                <div className="pt-3 flex gap-2">
                  <button type="button" onClick={() => setManagingCredsFor(null)} className="flex-1 py-2.5 text-neutral-600 font-bold hover:bg-neutral-100 rounded-lg text-sm transition-colors">Cancel</button>
                  <button type="submit" disabled={isGenerating} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm shadow-sm transition-colors flex items-center justify-center gap-2">
                    {isGenerating ? <Loader className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Create Portal Account
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