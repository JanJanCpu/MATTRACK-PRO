import React, { useState, useEffect } from "react";
import { sitesAPI, inventoryAPI, transferAPI, geocodeAddress } from "../../services/apiService";
import { 
  Building2, Plus, Loader, MapPin, Search, ArrowLeft, 
  Package, ArrowRightLeft, Map, X, ArrowDownToLine, ArrowUpFromLine, Send, Truck, CheckCircle2
} from "lucide-react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ProjectSite, Inventory } from "../../types";

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
  const [sites, setSites] = useState<ProjectSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  // --- Drill-Down State ---
  const [activeSite, setActiveSite] = useState<ProjectSite | null>(null);
  const [siteInventory, setSiteInventory] = useState<Inventory[]>([]);
  const [incomingTransfers, setIncomingTransfers] = useState<any[]>([]); // NEW: Tracks trucks on the way

  // --- Modal States ---
  const [modalType, setModalType] = useState<"IN" | "OUT" | "TRANSFER" | null>(null);
  const [transactionForm, setTransactionForm] = useState({
    item_name: "",
    brand: "Generic/No Brand",
    quantity: 0,
    unit: "Bags",
    destination_site_id: "" // NEW: For Transfers
  });

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [position, setPosition] = useState<[number, number]>([14.5995, 121.0366]);

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

  const loadSiteInventory = async (siteId: number) => {
    try {
      // Fetch local inventory
      const allInventory = await inventoryAPI.list();
      const localStock = allInventory.filter(item => item.site_id === siteId);
      setSiteInventory(localStock);

      // Fetch items currently IN TRANSIT to this site
      const incoming = await transferAPI.getIncoming(siteId);
      setIncomingTransfers(incoming);
    } catch (err) {
      console.error("Failed to load inventory/transfers for site", err);
    }
  };

  useEffect(() => { loadSites(); }, []);

  useEffect(() => {
    if (activeSite) loadSiteInventory(activeSite.id);
  }, [activeSite]);

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
    try {
      await sitesAPI.create({ name, address, lat: position[0], lon: position[1] });
      setName(""); setAddress(""); setPosition([14.5995, 121.0366]);
      setShowForm(false);
      loadSites();
      alert("Project Site Saved Successfully!");
    } catch (err) {
      alert("Save failed. Please check your connection.");
    }
  };

  // --- NEW: THE RECEIPT CONFIRMATION ---
  const handleReceiveTransfer = async (transferId: number) => {
    if (!activeSite) return;
    try {
      await transferAPI.receive(transferId);
      alert("Delivery Confirmed! Items added to your inventory.");
      loadSiteInventory(activeSite.id); // Refresh tables
    } catch (err) {
      alert("Failed to confirm receipt.");
    }
  };

  // --- BODEGERO TRANSACTION LOGIC ---
  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSite || !modalType) return;
    if (transactionForm.quantity <= 0) return alert("Quantity must be greater than 0");

    const existingItem = siteInventory.find(i => 
      i.item_name.toLowerCase() === transactionForm.item_name.toLowerCase() && 
      i.brand.toLowerCase() === transactionForm.brand.toLowerCase()
    );

    // --- NEW: TRANSFER LOGIC (3-STEP HANDSHAKE) ---
    if (modalType === "TRANSFER") {
        if (!transactionForm.destination_site_id) return alert("Select a destination site.");
        if (!existingItem || existingItem.quantity < transactionForm.quantity) {
            return alert("Not enough stock to transfer.");
        }
        
        try {
            await transferAPI.initiate({
                source_site_id: activeSite.id,
                destination_site_id: Number(transactionForm.destination_site_id),
                item_name: transactionForm.item_name,
                brand: transactionForm.brand || existingItem.brand,
                quantity: transactionForm.quantity,
                unit: existingItem.unit
            });
            setModalType(null);
            setTransactionForm({ item_name: "", brand: "Generic/No Brand", quantity: 0, unit: "Bags", destination_site_id: "" });
            loadSiteInventory(activeSite.id); 
            alert("Transfer dispatched successfully! It is now IN TRANSIT.");
        } catch (err) {
            alert("Failed to initiate transfer.");
        }
        return; // Exit out, don't run the standard IN/OUT logic
    }

    // --- STANDARD IN/OUT LOGIC ---
    let finalQuantity = transactionForm.quantity;
    let finalStatus = "Healthy";

    const isAsset = existingItem 
        ? (existingItem.unit === "Unit" || existingItem.unit === "Set")
        : (transactionForm.unit === "Unit" || transactionForm.unit === "Set");

    if (modalType === "OUT") {
      if (!existingItem) return alert("Cannot deduct an item that does not exist in this site's inventory.");
      if (existingItem.quantity < transactionForm.quantity) return alert(`Not enough stock! You only have ${existingItem.quantity} ${existingItem.unit}.`);
      
      finalQuantity = -Math.abs(transactionForm.quantity);
      const stockAfterDeduction = existingItem.quantity - transactionForm.quantity;
      
      if (isAsset) {
          finalStatus = stockAfterDeduction === 0 ? "In Use" : "Available";
      } else {
          if (stockAfterDeduction === 0) finalStatus = "Critical";
          else if (stockAfterDeduction <= 10) finalStatus = "Low Stock";
          else finalStatus = "Healthy";
      }
    } else {
      finalStatus = isAsset ? "Available" : "Healthy";
    }

    try {
      await inventoryAPI.logTransaction({
        item_name: transactionForm.item_name,
        brand: transactionForm.brand || "Generic/No Brand",
        quantity: finalQuantity,
        unit: transactionForm.unit || (existingItem ? existingItem.unit : "Bags"),
        status: finalStatus,
        fsn_status: "FAST", 
        site_id: activeSite.id,
      });

      setModalType(null);
      setTransactionForm({ item_name: "", brand: "Generic/No Brand", quantity: 0, unit: "Bags", destination_site_id: "" });
      loadSiteInventory(activeSite.id); 
    } catch (err) {
      alert("Transaction failed. Check connection.");
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case "Critical": return "bg-red-100 text-red-700 border-red-200";
      case "Low Stock": return "bg-amber-100 text-amber-700 border-amber-200";
      case "Surplus": return "bg-blue-100 text-blue-700 border-blue-200";
      case "In Use": return "bg-emerald-100 text-emerald-700 border-emerald-200";
      default: return "bg-emerald-100 text-emerald-700 border-emerald-200"; 
    }
  };

  if (activeSite) {
    return (
      <div className="space-y-6 animate-in slide-in-from-right-8 duration-500 relative">
        <button 
          onClick={() => setActiveSite(null)} 
          className="text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Central Ledger
        </button>

        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900">{activeSite.site_name}</h1>
            <div className="flex flex-col mt-2 space-y-1 text-sm text-neutral-500">
              <span className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600" /> 
                {(activeSite as any).address || "Address pending database sync"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 md:gap-3">
             <button 
               onClick={() => setModalType("TRANSFER")}
               className="px-4 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 font-bold rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-2"
             >
               <Send className="w-4 h-4" /> Transfer to Site
             </button>
             <button 
               onClick={() => setModalType("IN")}
               className="px-4 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-2"
             >
               <ArrowDownToLine className="w-4 h-4" /> Log Delivery (In)
             </button>
             <button 
               onClick={() => setModalType("OUT")}
               className="px-4 py-2.5 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2 shadow-sm"
             >
               <ArrowUpFromLine className="w-4 h-4" /> Log Usage (Out)
             </button>
          </div>
        </div>

        {/* --- NEW: INCOMING DELIVERIES PANEL --- */}
        {incomingTransfers.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl shadow-sm overflow-hidden animate-in fade-in">
            <div className="p-4 border-b border-amber-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-amber-600" />
                <h2 className="font-bold text-amber-900">Incoming Deliveries (In Transit)</h2>
              </div>
              <span className="text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1 rounded-full border border-amber-300 animate-pulse">
                {incomingTransfers.length} Trucks on the way
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-amber-100/50 text-amber-800 font-medium">
                  <tr>
                    <th className="px-6 py-3">Item & Brand</th>
                    <th className="px-6 py-3">Origin Site</th>
                    <th className="px-6 py-3 font-bold text-right">Quantity Expected</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-200/50">
                  {incomingTransfers.map(t => {
                    const sourceSite = sites.find(s => s.id === t.source_site_id);
                    return (
                      <tr key={t.id} className="hover:bg-amber-100/30 transition-colors">
                        <td className="px-6 py-4 font-bold text-neutral-900">
                          {t.item_name} <span className="text-xs text-neutral-500 font-normal block">{t.brand}</span>
                        </td>
                        <td className="px-6 py-4 text-neutral-600">{sourceSite?.site_name || `Site ID ${t.source_site_id}`}</td>
                        <td className="px-6 py-4 font-mono font-bold text-right text-lg text-amber-700">
                          {t.quantity} <span className="text-xs font-normal text-amber-600">{t.unit}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => handleReceiveTransfer(t.id)}
                            className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold rounded flex items-center gap-2 ml-auto shadow-sm transition-colors"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Confirm Receipt
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- SITE INVENTORY --- */}
        <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-neutral-500" />
              <h2 className="font-bold text-neutral-700">Site Inventory (Bodegero View)</h2>
            </div>
            <span className="text-xs font-bold text-neutral-400 bg-white px-3 py-1 rounded border">Viewing {siteInventory.length} items</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-white border-b border-neutral-200 text-neutral-500 font-medium">
                <tr>
                  <th className="px-6 py-4">Item Name</th>
                  <th className="px-6 py-4">Specs / Brand</th>
                  <th className="px-6 py-4 font-bold text-right">Quantity</th>
                  <th className="px-6 py-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {siteInventory.length > 0 ? (
                  siteInventory.map(item => (
                    <tr key={item.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-neutral-900">{item.item_name}</td>
                      <td className="px-6 py-4 text-neutral-500">{item.brand}</td>
                      <td className="px-6 py-4 font-mono font-bold text-right text-lg">
                        {item.quantity} <span className="text-xs font-normal text-neutral-400">{item.unit}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2.5 py-1 text-[10px] border font-bold uppercase rounded ${getStatusBadge(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-12 text-center text-neutral-400">
                      No materials found at this site. Log a delivery to begin tracking.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* --- TRANSACTION & TRANSFER MODALS --- */}
        {modalType && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className={`p-4 border-b flex justify-between items-center 
                ${modalType === "IN" ? "bg-emerald-50 border-emerald-100 text-emerald-900" : 
                  modalType === "OUT" ? "bg-slate-900 border-slate-800 text-white" : 
                  "bg-blue-50 border-blue-100 text-blue-900"}`
              }>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  {modalType === "IN" && <><ArrowDownToLine className="w-5 h-5"/> Log Material Delivery</>}
                  {modalType === "OUT" && <><ArrowUpFromLine className="w-5 h-5"/> Log Material Usage</>}
                  {modalType === "TRANSFER" && <><Send className="w-5 h-5"/> Dispatch Material Transfer</>}
                </h2>
                <button onClick={() => setModalType(null)} className="p-1 hover:bg-black/10 rounded-md transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleTransactionSubmit} className="p-6 space-y-5">
                
                {/* NEW: Destination Site Dropdown (Only for transfers) */}
                {modalType === "TRANSFER" && (
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase mb-2 text-blue-600">Destination Project Site</label>
                    <select 
                      required
                      value={transactionForm.destination_site_id}
                      onChange={(e) => setTransactionForm({ ...transactionForm, destination_site_id: e.target.value })}
                      className="w-full p-3 border border-blue-200 bg-blue-50 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">Select Receiving Site...</option>
                      {sites.filter(s => s.id !== activeSite.id).map(site => (
                        <option key={site.id} value={site.id}>{site.site_name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Item Name</label>
                  {modalType === "OUT" || modalType === "TRANSFER" ? (
                    <select 
                      required
                      value={transactionForm.item_name}
                      onChange={(e) => {
                        const selected = siteInventory.find(i => i.item_name === e.target.value);
                        setTransactionForm({ ...transactionForm, item_name: e.target.value, brand: selected?.brand || "", unit: selected?.unit || "Bags" });
                      }}
                      className="w-full p-3 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="">Select Local Item...</option>
                      {Array.from(new Set(siteInventory.map(i => i.item_name))).map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  ) : (
                    <input 
                      type="text" required placeholder="e.g. Portland Cement"
                      value={transactionForm.item_name}
                      onChange={(e) => setTransactionForm({ ...transactionForm, item_name: e.target.value })}
                      className="w-full p-3 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Quantity {modalType === "IN" ? "Received" : modalType === "TRANSFER" ? "To Transfer" : "Used"}</label>
                    <input 
                      type="number" required min="1"
                      value={transactionForm.quantity || ""}
                      onChange={(e) => setTransactionForm({ ...transactionForm, quantity: Number(e.target.value) })}
                      className="w-full p-3 border border-neutral-300 rounded-lg text-lg font-bold text-center focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Unit</label>
                    <select 
                      disabled={modalType === "OUT" || modalType === "TRANSFER"} 
                      value={transactionForm.unit}
                      onChange={(e) => setTransactionForm({ ...transactionForm, unit: e.target.value })}
                      className="w-full p-3 border border-neutral-300 rounded-lg text-sm bg-neutral-50 focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="Bags">Bags</option>
                      <option value="Pcs">Pcs</option>
                      <option value="Kilos">Kilos</option>
                      <option value="Unit">Unit</option>
                      <option value="Set">Set</option>
                    </select>
                  </div>
                </div>

                {modalType === "IN" && (
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Brand / Specs (Optional)</label>
                    <input 
                      type="text" placeholder="e.g. Republic"
                      value={transactionForm.brand}
                      onChange={(e) => setTransactionForm({ ...transactionForm, brand: e.target.value })}
                      className="w-full p-3 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                )}

                <div className="pt-2">
                  <button type="submit" className={`w-full py-3 rounded-lg text-sm font-bold transition-colors text-white 
                    ${modalType === "IN" ? "bg-emerald-600 hover:bg-emerald-700" : 
                      modalType === "OUT" ? "bg-slate-900 hover:bg-slate-800" : 
                      "bg-blue-600 hover:bg-blue-700"}`
                  }>
                    {modalType === "TRANSFER" ? "Dispatch Truck" : `Confirm ${modalType === "IN" ? "Delivery" : "Usage"}`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

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
                          <Map className="w-3 h-3" />
                          {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 text-center">
                      <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase rounded">Active</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setActiveSite(site)} 
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