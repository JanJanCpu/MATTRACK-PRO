import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  ClipboardList, Plus, Clock, CheckCircle, XCircle, Truck, Building2,
  Sparkles, Loader, PackageOpen, Navigation, X, AlertTriangle, Send, Lock, Trash2, Info
} from "lucide-react";
import { requestsAPI, sitesAPI, purchaseOrdersAPI, transferAPI, procurementAPI } from "../../services/apiService";
import type { MaterialRequest, ProjectSite } from "../../types";
import { useNavigate, useLocation } from "react-router-dom";

export function Requests() {
  const navigate = useNavigate();
  const location = useLocation();
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [sites, setSites] = useState<ProjectSite[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [userRole, setUserRole] = useState("pm");
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    item_name: "", brand: "Generic/No Brand", quantity_needed: "", unit: "Pcs", site_id: "",
  });

  // --- NEW ERP SOURCING STATE ---
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const [showAdvisorModal, setShowAdvisorModal] = useState(false);
  const [activeRequest, setActiveRequest] = useState<MaterialRequest | null>(null);
  const [advisorOptions, setAdvisorOptions] = useState<any[]>([]);
  const [isAdvisorLoading, setIsAdvisorLoading] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reqData, sitesData] = await Promise.all([ requestsAPI.list(), sitesAPI.list() ]);
      setRequests(reqData);
      setSites(sitesData);
    } catch (error) {
      console.error("Failed to load requests", error);
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
        setCurrentUserId(payload.id);
      } catch (e) {}
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (location.state?.autoFillItem) {
      const item = location.state.autoFillItem;
      const suggestedQty = Math.max(1, item.baseline_quantity - item.quantity);
      setFormData(prev => ({
        ...prev, item_name: item.item_name, brand: item.brand || "Generic/No Brand",
        unit: item.unit || "Pcs", quantity_needed: suggestedQty.toString(), site_id: item.site_id.toString()
      }));
      setSearchQuery(item.item_name);
      setShowForm(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  // --- GLOBAL SOURCING DISCOVERY ENGINE ---
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2 || !formData.site_id) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await procurementAPI.discover(Number(formData.site_id), searchQuery);
        setSearchResults(res);
        setShowDropdown(true);
      } catch (e) {
        console.error("Sourcing engine error", e);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery, formData.site_id]);

  const handleSelectResult = (res: any) => {
    setFormData({
      ...formData,
      item_name: res.material_name,
      brand: res.brand,
      unit: res.unit
    });
    setSearchQuery(res.material_name);
    setShowDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.site_id || !formData.item_name || !formData.quantity_needed) return;
    setIsSubmitting(true);
    try {
      await requestsAPI.create({
        item_name: formData.item_name, brand: formData.brand, quantity_needed: Number(formData.quantity_needed),
        unit: formData.unit, site_id: Number(formData.site_id), status: "Pending Approval"
      });
      alert("Material Request submitted to the Main Office.");
      setShowForm(false);
      setFormData({ item_name: "", brand: "Generic/No Brand", quantity_needed: "", unit: "Pcs", site_id: formData.site_id });
      setSearchQuery("");
      fetchData();
    } catch (error) { alert("Failed to submit request."); } finally { setIsSubmitting(false); }
  };

  const handleStatusUpdate = async (reqId: number, newStatus: string) => {
    try {
      await requestsAPI.updateStatus(reqId, newStatus);
      fetchData();
    } catch (error) { alert("Failed to update status."); }
  };

  const handleDeleteRequest = async (reqId: number) => {
    if (!window.confirm("SECURITY WARNING:\n\nAre you sure you want to permanently delete this request from the queue?")) return;
    try {
      await requestsAPI.delete(reqId);
      fetchData();
    } catch (error) { alert("Failed to delete request."); }
  };

  const runAdvisor = async (req: MaterialRequest) => {
    setActiveRequest(req);
    setShowAdvisorModal(true);
    setIsAdvisorLoading(true);
    setHasScanned(true);
    setAdvisorOptions([]);

    try {
      const url = `http://${window.location.hostname}:8000/advisory/auto-restock/${req.site_id}?item_name=${encodeURIComponent(req.item_name)}&quantity_needed=${req.quantity_needed}`;
      const res = await fetch(url);
      if (res.ok) setAdvisorOptions(await res.json());
      else alert("Failed to fetch routing options.");
    } catch (e) { alert("Network error: Could not reach the advisory engine."); } finally { setIsAdvisorLoading(false); }
  };

  const handleExecuteFulfillment = async (opt: any) => {
    if (!activeRequest) return;
    try {
      if (opt.type === "EXTERNAL_PURCHASE") {
        await purchaseOrdersAPI.create({
          supplier_id: opt.source_id, site_id: activeRequest.site_id, material_name: activeRequest.item_name,
          quantity: activeRequest.quantity_needed, total_price: opt.estimated_total_cost, linked_request_id: activeRequest.id
        });
        alert(`Purchase Order dispatched to ${opt.source_name}!`);
      } else if (opt.type === "INTERNAL_TRANSFER") {
        await transferAPI.initiate({
          source_site_id: opt.source_id, destination_site_id: activeRequest.site_id, item_name: activeRequest.item_name,
          brand: activeRequest.brand || "Generic/No Brand", quantity: activeRequest.quantity_needed, unit: activeRequest.unit,
          linked_request_id: activeRequest.id 
        });
        alert(`Internal Transfer initiated from ${opt.source_name}.`);
      }
      setShowAdvisorModal(false);
      fetchData();
    } catch (error: any) { alert(error.message || "Failed to execute fulfillment."); }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Pending": case "Pending Approval": return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-bold uppercase tracking-wider"><Clock className="w-3 h-3" /> Pending</span>;
      case "Processing": case "Approved & Routing": return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-bold uppercase tracking-wider animate-pulse"><Truck className="w-3 h-3" /> Routing</span>;
      case "Fulfilled": return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider"><CheckCircle className="w-3 h-3" /> Fulfilled</span>;
      case "Rejected": return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-red-100 text-red-700 border border-red-200 text-[10px] font-bold uppercase tracking-wider"><XCircle className="w-3 h-3" /> Rejected</span>;
      default: return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold uppercase tracking-wider">{status}</span>;
    }
  };

  const editableSites = sites.filter((s) => ["admin", "owner"].includes(userRole) || s.manager_id === currentUserId);

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-neutral-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-indigo-600" /> Material Requests
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            {["admin", "owner"].includes(userRole) ? "Central consolidated queue for all project site material needs." : "Submit material requirements to the main office for fulfillment."}
          </p>
        </div>
        {userRole === "staff" && (
          <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-sm">
            {showForm ? "Cancel Request" : <><Plus className="w-4 h-4" /> Manual Request</>}
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-xl border border-indigo-100 shadow-sm animate-in slide-in-from-top-4">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Target Project Site</label>
              <select required value={formData.site_id} onChange={(e) => setFormData({ ...formData, site_id: e.target.value })} className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium bg-neutral-50">
                <option value="">Select your site...</option>
                {editableSites.map(site => ( <option key={site.id} value={site.id}>{site.site_name}</option> ))}
              </select>
            </div>
            
            {/* --- NEW B2B SOURCING DISCOVERY ENGINE UI --- */}
            <div className="md:col-span-2 relative">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                Material Search (Global Sourcing) {isSearching && <Loader className="w-3 h-3 animate-spin text-emerald-500"/>}
              </label>
              <input 
                type="text" 
                required 
                disabled={!formData.site_id}
                placeholder={formData.site_id ? "Search supplier network..." : "Select project site first..."} 
                value={searchQuery || formData.item_name} 
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setFormData({ ...formData, item_name: e.target.value });
                  setShowDropdown(true);
                }} 
                onFocus={() => { if(searchResults.length > 0) setShowDropdown(true); }}
                className={`w-full p-2 border rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-slate-900 outline-none ${!formData.site_id && "cursor-not-allowed opacity-70"}`} 
              />
              
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-64 overflow-y-auto top-full left-0">
                  <div className="sticky top-0 bg-slate-100 px-3 py-2 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex justify-between">
                    <span>Sourcing Engine Matches</span>
                    <button type="button" onClick={() => setShowDropdown(false)}><X className="w-3.5 h-3.5 hover:text-red-500" /></button>
                  </div>
                  {searchResults.map((res, i) => (
                    <div key={i} onClick={() => handleSelectResult(res)} className="p-3 border-b border-slate-100 hover:bg-emerald-50 cursor-pointer transition-colors group">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-bold text-slate-900 group-hover:text-emerald-700">{res.material_name}</p>
                          <p className="text-xs text-slate-500 mt-0.5 font-medium">
                            {res.brand} • <span className={res.is_internal ? "text-indigo-600 font-bold" : "text-amber-600 font-bold"}>{res.supplier_name}</span> {res.is_internal && "(Internal)"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-emerald-600">{res.available_qty} <span className="text-[10px]">{res.unit}</span></p>
                          <p className="text-[10px] text-slate-400 mt-0.5 font-bold">{res.distance_km} km away</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Brand/Specs</label>
              <input type="text" placeholder="e.g. Republic" value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} className="w-full p-2 border rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-slate-900 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Quantity Needed</label>
              <input type="number" required placeholder="0" min="1" value={formData.quantity_needed} onChange={(e) => setFormData({ ...formData, quantity_needed: e.target.value })} className="w-full p-2 border rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-slate-900 outline-none font-bold" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unit</label>
              <select value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} className="w-full p-2 border rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-slate-900 outline-none">
                <option value="Bags">Bags</option><option value="Pcs">Pcs</option><option value="Cu.m">Cu.m</option><option value="Kilos">Kilos</option><option value="Unit">Unit</option>
              </select>
            </div>
            <div className="md:col-span-2 flex justify-end mt-2">
              <button type="submit" disabled={isSubmitting} className="w-full bg-slate-900 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
                {isSubmitting ? <Loader className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4"/> Submit Request to Admin</>}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b text-slate-500">
            <tr>
              <th className="px-6 py-4 font-bold">Request ID</th>
              <th className="px-6 py-4 font-bold">Material Details</th>
              <th className="px-6 py-4 font-bold">Project Site</th>
              <th className="px-6 py-4 font-bold text-center">Status</th>
              {["admin", "owner"].includes(userRole) && <th className="px-6 py-4 font-bold text-right">Fulfillment Routing</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={5} className="py-12 text-center text-slate-400"><Loader className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading queue...</td></tr>
            ) : requests.length === 0 ? (
              <tr><td colSpan={5} className="py-12 text-center text-slate-400 font-medium"><PackageOpen className="w-10 h-10 mx-auto mb-2 opacity-20"/>No material requests found.</td></tr>
            ) : (
              requests.map((req) => {
                const site = sites.find(s => s.id === req.site_id);
                const isPending = req.status === "Pending Approval" || req.status === "Pending";
                
                return (
                  <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-slate-500">REQ-{String(req.id).padStart(4, '0')}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 text-base flex items-center gap-2">
                        {req.item_name}
                        {req.inventory_id != null && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-black uppercase rounded">Auto</span>}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{req.brand} • <span className="font-bold text-indigo-600">{req.quantity_needed} {req.unit}</span></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 font-medium text-neutral-700"><Building2 className="w-4 h-4 text-neutral-400" />{site?.site_name || "Unknown Site"}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {getStatusBadge(req.status)}
                      {req.fulfillment_method && <div className="text-[10px] text-neutral-400 mt-1 font-mono tracking-tighter">via {req.fulfillment_method}</div>}
                    </td>
                    {["admin", "owner"].includes(userRole) && (
                      <td className="px-6 py-4 text-right">
                        {req.status === "Fulfilled" ? (
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex justify-end items-center gap-1"><Lock className="w-3 h-3"/> Locked</span>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            {isPending && (
                              <button onClick={() => runAdvisor(req)} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-xs font-bold inline-flex items-center gap-1.5 shadow-sm">
                                <Sparkles className="w-3.5 h-3.5" /> Fulfill
                              </button>
                            )}
                            <select value={req.status} onChange={(e) => handleStatusUpdate(req.id, e.target.value)} className="bg-white border border-neutral-300 text-neutral-700 text-xs font-bold rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500">
                              <option value="Pending Approval">Pending</option>
                              <option value="Approved & Routing">Routing</option>
                              <option value="Rejected">Rejected</option>
                            </select>
                            <button onClick={() => handleDeleteRequest(req.id)} className="p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 rounded-md transition-colors" title="Delete Request">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showAdvisorModal && activeRequest && createPortal(
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b bg-slate-900 border-slate-800 flex justify-between items-center text-white">
              <h2 className="text-lg font-bold flex items-center gap-2"><Sparkles className="w-5 h-5 text-emerald-400" /> Fulfillment Advisory Engine</h2>
              <button onClick={() => setShowAdvisorModal(false)} className="p-1 hover:bg-white/10 rounded-md transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-neutral-50">
              <div className="mb-6 bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <p className="text-xs text-neutral-500 font-bold uppercase tracking-wider">Requested Material</p>
                  <p className="text-xl font-black text-neutral-900">{activeRequest.item_name}</p>
                  <p className="text-sm text-neutral-600 mt-1 font-medium">Destination: {sites.find(s => s.id === activeRequest.site_id)?.site_name || "Site"}</p>
                </div>
                <div className="bg-red-50 p-3 rounded-lg border border-red-100 text-center min-w-[100px]">
                  <label className="block text-[10px] text-red-600 font-bold uppercase mb-1">Required Qty</label>
                  <div className="text-2xl font-black text-red-700">{activeRequest.quantity_needed} <span className="text-sm text-red-600 font-bold">{activeRequest.unit}</span></div>
                </div>
              </div>

              {!hasScanned && !isAdvisorLoading && (
                <div className="text-center py-8">
                  <button onClick={() => runAdvisor(activeRequest)} className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-lg shadow-md transition-all flex items-center gap-2 mx-auto">
                    <Navigation className="w-5 h-5" /> Calculate Routing Options
                  </button>
                  <p className="text-xs text-neutral-500 mt-3 font-medium">The system will scan for internal surpluses before checking external suppliers.</p>
                </div>
              )}

              {isAdvisorLoading && (
                <div className="py-12 text-center text-slate-700 font-bold animate-pulse flex flex-col items-center">
                  <Navigation className="w-8 h-8 text-indigo-500 animate-spin mb-4" /> Calculating optimal network routes and procurement costs...
                </div>
              )}

              {!isAdvisorLoading && hasScanned && advisorOptions.length === 0 && (
                <div className="py-12 text-center text-neutral-500 font-medium bg-white rounded-xl border border-neutral-200 shadow-sm">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                  No viable surplus or external suppliers found for "{activeRequest.item_name}". <br/>
                  Please ensure you have registered suppliers for this material.
                </div>
              )}

              {/* --- UI DECOUPLING OF SUPPLIER STOCK DATA --- */}
              {!isAdvisorLoading && hasScanned && advisorOptions.length > 0 && (
                <div className="space-y-4">
                  {advisorOptions.map((opt, index) => (
                    <div key={index} className={`p-5 rounded-xl border shadow-sm ${index === 0 ? "border-emerald-400 bg-emerald-50" : "border-neutral-200 bg-white"}`}>
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            {index === 0 && <span className="bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">Recommended</span>}
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${opt.type === "EXTERNAL_PURCHASE" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>{opt.type.replace("_", " ")}</span>
                          </div>
                          <h3 className="text-lg font-bold text-neutral-900">{opt.source_name}</h3>
                          
                          {/* DECOUPLED UI METRICS */}
                          <div className="flex items-center gap-3 mt-2">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-slate-200/50 px-2 py-1 rounded">
                              <PackageOpen className="w-3 h-3 text-slate-500"/> 
                              Stock Available: {opt.available_stock} {opt.unit}
                            </span>
                            {opt.unit_price > 0 && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded">
                                Unit Price: ₱{opt.unit_price.toFixed(2)}
                              </span>
                            )}
                          </div>
                          
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Total Est. Cost</p>
                          <p className={`text-2xl font-black ${index === 0 ? "text-emerald-700" : "text-neutral-900"}`}>₱{opt.estimated_total_cost.toLocaleString('en-PH', {minimumFractionDigits: 2})}</p>
                          <p className="text-xs text-neutral-500 mt-1 font-mono">{opt.distance_km} km away</p>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-black/5 flex justify-end">
                        <button onClick={() => handleExecuteFulfillment(opt)} className={`px-4 py-2 rounded-lg text-sm font-bold text-white transition-colors shadow-sm ${opt.type === "EXTERNAL_PURCHASE" ? "bg-blue-600 hover:bg-blue-700" : "bg-purple-600 hover:bg-purple-700"}`}>
                          {opt.type === "EXTERNAL_PURCHASE" ? "Approve & Buy" : "Approve & Transfer"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  );
}