import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  sitesAPI, 
  geocodeAddress, 
  usersAPI, 
  suppliersAPI, 
  transferAPI 
} from "../../services/apiService";
import {
  Building2, Plus, Loader, MapPin, Search, ArrowRightLeft, Map as MapIcon, 
  Package, Send, CheckCircle
} from "lucide-react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ProjectSite, Supplier } from "../../types";

// --- Map Configuration ---
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
  const navigate = useNavigate();

  // --- Global State ---
  const [activeTab, setActiveTab] = useState<"ledger" | "operations">("ledger");
  const [sites, setSites] = useState<ProjectSite[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Ledger State ---
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [position, setPosition] = useState<[number, number]>([14.5995, 121.0366]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [selectedManager, setSelectedManager] = useState<number | "">("");
  const [globalSuppliers, setGlobalSuppliers] = useState<Supplier[]>([]);

  // --- Operations (Transfer) State ---
  const [sourceSiteId, setSourceSiteId] = useState<number | "">("");
  const [destSiteId, setDestSiteId] = useState<number | "">("");
  const [transferItem, setTransferItem] = useState("");
  const [transferBrand, setTransferBrand] = useState(""); 
  const [transferQty, setTransferQty] = useState<number | "">("");
  const [transferUnit, setTransferUnit] = useState(""); 
  const [incomingTransfers, setIncomingTransfers] = useState<any[]>([]);
  const [isTransferring, setIsTransferring] = useState(false);

  // --- Data Loading ---
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

  // --- FIXED: Dynamic Network Transfer Polling ---
  const loadIncomingTransfers = async () => {
    if (activeTab !== "operations" || sites.length === 0) return;
    try {
      let allTransfers: any[] = [];
      // Loop through ALL real sites to check for incoming trucks
      for (const site of sites) {
        if (transferAPI.getIncoming) {
          const siteTransfers = await transferAPI.getIncoming(site.id);
          allTransfers = [...allTransfers, ...siteTransfers];
        }
      }
      setIncomingTransfers(allTransfers);
    } catch (error) {
      console.error("Failed to load transfers", error);
    }
  };

  useEffect(() => {
    loadSites();
    loadBackgroundData();
  }, []);

  // Update dependencies so it fires once sites are loaded
  useEffect(() => {
    if (activeTab === "operations" && sites.length > 0) {
      loadIncomingTransfers();
    }
  }, [activeTab, sites]);

  // --- Ledger Functions ---
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

  // --- Operations Functions (SOP 2 Execution) ---
  const handleInitiateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceSiteId === "" || destSiteId === "" || !transferItem || transferQty === "" || !transferUnit || !transferBrand) {
      alert("Please fill in all transfer fields.");
      return;
    }
    if (sourceSiteId === destSiteId) {
      alert("Source and destination sites cannot be the same.");
      return;
    }

    setIsTransferring(true);
    try {
      await transferAPI.initiate({
        source_site_id: Number(sourceSiteId),
        destination_site_id: Number(destSiteId),
        item_name: transferItem,
        brand: transferBrand,
        quantity: Number(transferQty),
        unit: transferUnit
      });
      
      alert("Transfer Initiated Successfully! Check Logistics map for routing.");
      
      setSourceSiteId(""); setDestSiteId(""); setTransferItem(""); 
      setTransferBrand(""); setTransferQty(""); setTransferUnit("");
      
      loadIncomingTransfers();
    } catch (error) {
      alert("Failed to initiate transfer. Ensure enough stock exists at the source site.");
    } finally {
      setIsTransferring(false);
    }
  };

  const handleReceiveTransfer = async (transferId: number) => {
    try {
      await transferAPI.receive(transferId);
      alert("Materials received and inventory updated!");
      loadIncomingTransfers();
    } catch (error) {
      alert("Failed to confirm receipt.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header & Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Project Operations Hub</h1>
          <p className="text-sm text-neutral-500 mt-1">Manage sites and execute inter-site logistics transfers.</p>
        </div>
        
        <div className="flex bg-neutral-100 p-1 rounded-lg border border-neutral-200">
          <button 
            onClick={() => setActiveTab("ledger")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === "ledger" ? "bg-white text-emerald-700 shadow-sm" : "text-neutral-500 hover:text-neutral-900"}`}
          >
            Site Ledger
          </button>
          <button 
            onClick={() => setActiveTab("operations")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === "operations" ? "bg-white text-emerald-700 shadow-sm" : "text-neutral-500 hover:text-neutral-900"}`}
          >
            Logistics Transfers
          </button>
        </div>
      </div>

      {/* --- TAB 1: SITE LEDGER --- */}
      {activeTab === "ledger" && (
        <div className="space-y-6 animate-in fade-in">
          <div className="flex justify-end">
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
                  <select required value={selectedManager} onChange={(e) => setSelectedManager(Number(e.target.value))} className="w-full p-3 border rounded-lg text-sm bg-neutral-50 focus:ring-2 focus:ring-emerald-500 outline-none">
                    <option value="" disabled>Select a Staff Member...</option>
                    {staffList.map((staff) => (
                      <option key={staff.id} value={staff.id}>{staff.username} ({staff.email})</option>
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
      )}

      {/* --- TAB 2: LOGISTICS OPERATIONS (Transfer Hub) --- */}
      {activeTab === "operations" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in">
          
          {/* Left Column: Incoming Transfers */}
          <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4 border-b border-neutral-100 pb-4">
              <Package className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-neutral-900">Incoming Deliveries</h2>
            </div>
            
            <div className="space-y-4">
              {incomingTransfers.length === 0 ? (
                <div className="text-center p-8 text-neutral-400 border-2 border-dashed border-neutral-100 rounded-lg">
                  No materials currently in transit.
                </div>
              ) : (
                incomingTransfers.map((transfer) => {
                  const srcSite = sites.find(s => s.id === transfer.source_site_id)?.site_name || transfer.source_site_id;
                  const destSite = sites.find(s => s.id === transfer.destination_site_id)?.site_name || transfer.destination_site_id;
                  return (
                    <div key={transfer.id} className="p-4 border border-indigo-100 bg-indigo-50/30 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="font-bold text-neutral-900">{transfer.item_name}</div>
                        <div className="text-sm text-neutral-600">Qty: {transfer.quantity} {transfer.unit}</div>
                        <div className="text-xs text-neutral-500 mt-1 font-medium text-indigo-700">From: {srcSite} &rarr; To: {destSite}</div>
                      </div>
                      <button 
                        onClick={() => handleReceiveTransfer(transfer.id)}
                        className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 flex items-center gap-2 justify-center"
                      >
                        <CheckCircle className="w-4 h-4" /> Confirm Receipt
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Initiate Transfer Form */}
          <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4 border-b border-neutral-100 pb-4">
              <Send className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-bold text-neutral-900">Dispatch Surplus</h2>
            </div>
            
            <form onSubmit={handleInitiateTransfer} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Source Site (Surplus)</label>
                  <select required value={sourceSiteId} onChange={(e) => setSourceSiteId(Number(e.target.value))} className="w-full p-3 border rounded-lg text-sm bg-neutral-50 focus:ring-2 focus:ring-emerald-500 outline-none">
                    <option value="" disabled>Select Site...</option>
                    {sites.map(site => <option key={site.id} value={site.id}>{site.site_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Destination Site (Critical)</label>
                  <select required value={destSiteId} onChange={(e) => setDestSiteId(Number(e.target.value))} className="w-full p-3 border rounded-lg text-sm bg-neutral-50 focus:ring-2 focus:ring-emerald-500 outline-none">
                    <option value="" disabled>Select Site...</option>
                    {sites.map(site => <option key={site.id} value={site.id}>{site.site_name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Material Name</label>
                  <input 
                    required 
                    value={transferItem} 
                    onChange={(e) => setTransferItem(e.target.value)} 
                    className="w-full p-3 border rounded-lg text-sm bg-neutral-50 focus:ring-2 focus:ring-emerald-500 outline-none" 
                    placeholder="e.g. Portland Cement" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Brand</label>
                  <input 
                    required 
                    value={transferBrand} 
                    onChange={(e) => setTransferBrand(e.target.value)} 
                    className="w-full p-3 border rounded-lg text-sm bg-neutral-50 focus:ring-2 focus:ring-emerald-500 outline-none" 
                    placeholder="e.g. Republic" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Quantity</label>
                  <input 
                    required 
                    type="number" 
                    min="1"
                    value={transferQty} 
                    onChange={(e) => setTransferQty(Number(e.target.value))} 
                    className="w-full p-3 border rounded-lg text-sm bg-neutral-50 focus:ring-2 focus:ring-emerald-500 outline-none" 
                    placeholder="e.g. 50" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Unit</label>
                  <input 
                    required 
                    value={transferUnit} 
                    onChange={(e) => setTransferUnit(e.target.value)} 
                    className="w-full p-3 border rounded-lg text-sm bg-neutral-50 focus:ring-2 focus:ring-emerald-500 outline-none" 
                    placeholder="e.g. Bags" 
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isTransferring}
                className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-slate-800 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {isTransferring ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Initiate Logistics Transfer
              </button>
            </form>
          </div>

        </div>
      )}

    </div>
  );
}