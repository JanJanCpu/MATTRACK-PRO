import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  ClipboardList, Plus, Clock, CheckCircle, XCircle, Truck, Building2,
  Sparkles, Loader, PackageOpen, Navigation, X, AlertTriangle, Send, Lock, Trash2,
  Star, ShieldCheck, AlertCircle, ShoppingCart, Pencil, Save
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
    item_name: "", brand: "", quantity_needed: "", unit: "Pcs", site_id: "",
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const [cart, setCart] = useState<any[]>([]);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRequest, setEditingRequest] = useState<MaterialRequest | null>(null);
  const [editForm, setEditForm] = useState({ item_name: "", brand: "", quantity_needed: "", unit: "" });

  const [showAdvisorModal, setShowAdvisorModal] = useState(false);
  const [activeRequest, setActiveRequest] = useState<MaterialRequest | null>(null);
  const [advisorOptions, setAdvisorOptions] = useState<any[]>([]);
  const [isAdvisorLoading, setIsAdvisorLoading] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);

  // --- NEW UX FEATURE: Extract Historic Brands from Request History for Autosuggest Memory ---
  const historicBrands = Array.from(new Set(requests.map(r => r.brand).filter(b => b && b.trim() !== "" && b !== "Generic/No Brand")));

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
        ...prev, item_name: item.item_name, brand: item.brand || "",
        unit: item.unit || "Pcs", quantity_needed: suggestedQty.toString(), site_id: item.site_id.toString()
      }));
      setSearchQuery(item.item_name);
      setShowForm(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate]);

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

  const handleAddToCart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.site_id || !formData.item_name || !formData.quantity_needed) return;
    
    setCart([...cart, { 
      ...formData, 
      brand: formData.brand.trim() || "Generic/No Brand", 
      quantity_needed: Number(formData.quantity_needed) 
    }]);
    
    setFormData({ ...formData, item_name: "", brand: "", quantity_needed: "", unit: "Pcs" });
    setSearchQuery("");
  };

  const handleRemoveFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const handleBulkSubmit = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);
    try {
      await requestsAPI.bulkCreate(cart);
      alert(`✅ Successfully submitted ${cart.length} items to the Main Office!`);
      setCart([]);
      setShowForm(false);
      fetchData();
    } catch (error) { 
      alert("Failed to submit bulk request."); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const handleOpenEdit = (req: MaterialRequest) => {
    setEditingRequest(req);
    setEditForm({
      item_name: req.item_name,
      brand: req.brand || "Generic/No Brand",
      quantity_needed: req.quantity_needed.toString(),
      unit: req.unit
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRequest) return;
    try {
      await requestsAPI.edit(editingRequest.id, {
        ...editForm,
        quantity_needed: Number(editForm.quantity_needed)
      });
      alert("Request modified successfully.");
      setShowEditModal(false);
      fetchData();
    } catch (err) {
      alert("Failed to update the request.");
    }
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
      // Using the live Render URL instead of localhost/hostname
      const url = `https://mattrack-personal.onrender.com/advisory/auto-restock/${req.site_id}?item_name=${encodeURIComponent(req.item_name)}&quantity_needed=${req.quantity_needed}`;
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
          <button onClick={() => { setShowForm(!showForm); setCart([]); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-sm">
            {showForm ? "Cancel Request" : <><Plus className="w-4 h-4" /> Manual Request</>}
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-xl border border-indigo-100 shadow-sm animate-in slide-in-from-top-4">
          <form onSubmit={handleAddToCart} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Target Project Site</label>
              <select required disabled={cart.length > 0} value={formData.site_id} onChange={(e) => setFormData({ ...formData, site_id: e.target.value })} className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium bg-neutral-50 disabled:opacity-50">
                <option value="">Select your site...</option>
                {editableSites.map(site => ( <option key={site.id} value={site.id}>{site.site_name}</option> ))}
              </select>
            </div>
            
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

            {/* --- NEW UX FEATURE: Autosuggest Brand Input --- */}
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Brand/Specs</label>
              <input type="text" list="historic-brands" placeholder="e.g. Republic (Optional)" value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} className="w-full p-2 border rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-slate-900 outline-none" />
              <datalist id="historic-brands">
                {historicBrands.map(b => <option key={b} value={b} />)}
              </datalist>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Quantity</label>
              <input type="number" required placeholder="0" min="1" value={formData.quantity_needed} onChange={(e) => setFormData({ ...formData, quantity_needed: e.target.value })} className="w-full p-2 border rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-slate-900 outline-none font-bold" />
            </div>
            
            {/* --- NEW UX FEATURE: Custom Unit Combo Box --- */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unit</label>
              <input type="text" list="unit-options" value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} className="w-full p-2 border rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-slate-900 outline-none" placeholder="e.g. Bags" required />
              <datalist id="unit-options">
                <option value="Bags"/><option value="Pcs"/><option value="Cu.m"/><option value="Kilos"/><option value="Unit"/><option value="Gallons"/><option value="Rolls"/>
              </datalist>
            </div>
            
            <div className="md:col-span-2 flex justify-end mt-2">
              <button type="submit" className="w-full bg-slate-100 text-slate-700 border border-slate-300 px-6 py-2.5 rounded-lg font-bold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2">
                <Plus className="w-4 h-4"/> Add to List
              </button>
            </div>
          </form>

          {/* TABULATED CART VIEW */}
          {cart.length > 0 && (
            <div className="border border-emerald-200 rounded-xl overflow-hidden bg-white animate-in slide-in-from-bottom-4">
              <div className="bg-emerald-50 px-4 py-3 border-b border-emerald-100 flex items-center justify-between">
                <h3 className="font-bold text-emerald-800 flex items-center gap-2"><ShoppingCart className="w-4 h-4" /> Ready to Submit ({cart.length} items)</h3>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded">Target: {sites.find(s => s.id === Number(cart[0].site_id))?.site_name}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-white text-slate-500 border-b border-neutral-100">
                    <tr>
                      <th className="px-4 py-2 font-bold">Material & Brand</th>
                      <th className="px-4 py-2 font-bold text-center">Quantity</th>
                      <th className="px-4 py-2 font-bold text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {cart.map((item, idx) => (
                      <tr key={idx} className="hover:bg-neutral-50">
                        <td className="px-4 py-3"><div className="font-bold text-slate-900">{item.item_name}</div><div className="text-xs text-slate-500">{item.brand}</div></td>
                        <td className="px-4 py-3 text-center font-black text-indigo-600">{item.quantity_needed} <span className="text-xs font-medium text-slate-500">{item.unit}</span></td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => handleRemoveFromCart(idx)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><X className="w-4 h-4"/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 bg-neutral-50 flex justify-end">
                <button onClick={handleBulkSubmit} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-bold transition-colors shadow-sm flex items-center gap-2">
                  {isSubmitting ? <Loader className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Submit All to Main Office</>}
                </button>
              </div>
            </div>
          )}
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
                              <>
                                <button onClick={() => handleOpenEdit(req)} className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-md transition-colors" title="Edit Quantity or Details">
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button onClick={() => runAdvisor(req)} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-xs font-bold inline-flex items-center gap-1.5 shadow-sm">
                                  <Sparkles className="w-3.5 h-3.5" /> Fulfill
                                </button>
                              </>
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

      {/* --- ADMIN EDIT MODAL WITH COMBO BOXES --- */}
      {showEditModal && editingRequest && createPortal(
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><Pencil className="w-4 h-4 text-blue-600" /> Edit Material Request</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Item Name</label>
                <input type="text" required value={editForm.item_name} onChange={e => setEditForm({...editForm, item_name: e.target.value})} className="w-full p-2 border rounded-lg text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-blue-600 font-bold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Brand</label>
                <input type="text" list="historic-brands" required value={editForm.brand} onChange={e => setEditForm({...editForm, brand: e.target.value})} className="w-full p-2 border rounded-lg text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-blue-600" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Quantity (Approved)</label>
                  <input type="number" required min="1" value={editForm.quantity_needed} onChange={e => setEditForm({...editForm, quantity_needed: e.target.value})} className="w-full p-2 border rounded-lg text-sm bg-blue-50 text-blue-900 outline-none focus:ring-2 focus:ring-blue-600 font-black text-center" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unit</label>
                  <input type="text" list="unit-options" required value={editForm.unit} onChange={e => setEditForm({...editForm, unit: e.target.value})} className="w-full p-2 border rounded-lg text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-blue-600 font-medium text-center" />
                </div>
              </div>
              <div className="pt-4 flex gap-2">
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 py-2.5 font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors text-sm">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center justify-center gap-2 text-sm"><Save className="w-4 h-4"/> Save Modifications</button>
              </div>
            </form>
          </div>
        </div>, document.body
      )}

      {showAdvisorModal && activeRequest && createPortal(
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b bg-slate-900 border-slate-800 flex justify-between items-center text-white">
              <h2 className="text-lg font-bold flex items-center gap-2"><Sparkles className="w-5 h-5 text-emerald-400" /> Fulfillment Advisory Engine</h2>
              <button onClick={() => setShowAdvisorModal(false)} className="p-1 hover:bg-white/10 rounded-md transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-neutral-100">
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

              {!isAdvisorLoading && hasScanned && advisorOptions.length > 0 && (
                <div className="space-y-3">
                  {advisorOptions.map((opt, index) => (
                    <div key={index} className={`p-4 rounded-xl border bg-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between transition-all hover:shadow-md ${
                        index === 0 ? "border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/10" : "border-neutral-200"
                      }`}
                    >
                      <div className="flex-1 w-full mb-4 sm:mb-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-bold text-neutral-800 text-base">{opt.source_name}</h3>
                          {opt.type === "INTERNAL_TRANSFER" ? (
                            <span className="px-2 py-0.5 bg-violet-100 text-violet-700 text-[10px] font-bold rounded-full flex items-center gap-1">
                              <Truck className="w-3 h-3" /> {opt.trust_badge || "Internal Surplus"}
                            </span>
                          ) : (
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full flex items-center gap-1 ${
                              opt.rating >= 4.0 ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-600"
                            }`}>
                              {opt.rating >= 4.0 ? <ShieldCheck className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />} 
                              {opt.trust_badge || (opt.rating >= 4.0 ? "Verified Trusted" : "Standard Supplier")}
                            </span>
                          )}
                          
                          <div className="flex items-center ml-2">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            <span className="text-xs font-bold text-neutral-700 ml-1">{opt.rating ? opt.rating.toFixed(1) : "5.0"}</span>
                          </div>
                        </div>

                        <p className="text-xs text-neutral-500 mb-2">{opt.recommendation_reason}</p>
                        
                        <div className="flex items-center gap-3">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">
                            <PackageOpen className="w-3 h-3 text-slate-500"/> 
                            Stock: {opt.available_stock} {opt.unit}
                          </span>
                          <span className="text-xs font-medium text-neutral-700">
                            Distance: <span className="font-bold">{opt.distance_km} km</span>
                          </span>
                        </div>
                      </div>

                      <div className="text-left sm:text-right sm:ml-4 sm:border-l sm:border-neutral-100 sm:pl-4 w-full sm:w-36 shrink-0 flex flex-col justify-end">
                        <p className="text-[10px] text-neutral-400 font-medium uppercase">Total Est. Cost</p>
                        <p className={`text-xl font-black mb-2 ${index === 0 ? "text-emerald-600" : "text-slate-700"}`}>
                          ₱{opt.estimated_total_cost.toLocaleString('en-PH', {minimumFractionDigits: 2})}
                        </p>
                        
                        <button 
                          onClick={() => handleExecuteFulfillment(opt)}
                          className={`px-4 py-2 text-xs font-bold rounded-lg shadow-sm w-full transition-all ${
                            opt.type === "INTERNAL_TRANSFER" 
                              ? "bg-violet-600 hover:bg-violet-700 text-white" 
                              : "bg-blue-600 hover:bg-blue-700 text-white"
                          }`}
                        >
                          {opt.type === "INTERNAL_TRANSFER" ? "Approve Transfer" : "Approve PO"}
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