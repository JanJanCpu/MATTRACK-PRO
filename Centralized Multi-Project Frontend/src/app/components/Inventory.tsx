import {
  PackageSearch,
  Plus,
  Trash2,
  Upload,
  Download,
  Sparkles,
  AlertTriangle,
  Activity,
  ListChecks,
  X,
  History,
  Filter
} from "lucide-react";
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom"; 
import { inventoryAPI, sitesAPI } from "../../services/apiService";
import type { Inventory as InventoryItem, ProjectSite } from "../../types";
import { BulkImportWizard } from "./BulkImportWizard";

interface InventoryWithCategory extends InventoryItem {
  category: "Fast-Moving" | "Slow-Moving" | "Non-Moving";
  siteName: string;
}

export function Inventory() {
  const navigate = useNavigate();
  const location = useLocation();

  // --- Master Tabs & Filters ---
  const [activeTab, setActiveTab] = useState<"inventory" | "audit">("inventory");
  const [filter, setFilter] = useState(location.state?.autoFilter || "All"); 

  const [inventoryData, setInventoryData] = useState<InventoryWithCategory[]>([]);
  const [sitesList, setSitesList] = useState<ProjectSite[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkWizard, setShowBulkWizard] = useState(false); 
  const [error, setError] = useState<string | null>(null);

  // Bulk Delete Mode
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Strict Form Logic
  const [itemType, setItemType] = useState<"consumable" | "asset">("consumable");
  const [newItem, setNewItem] = useState({
    item_name: "",
    brand: "Generic/No Brand", 
    quantity: 0,
    unit: "Bags",
    status: "Healthy",
    fsn_status: "FAST", 
    site_id: "",
  });

  useEffect(() => {
    if (itemType === "consumable") {
      setNewItem(prev => ({ ...prev, unit: "Bags", status: "Healthy" }));
    } else {
      setNewItem(prev => ({ ...prev, unit: "Unit", status: "Available" }));
    }
  }, [itemType]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [inventoryList, sites, logs] = await Promise.all([
        inventoryAPI.list(),
        sitesAPI.list(),
        inventoryAPI.getLogs() 
      ]);

      setSitesList(sites);
      setAuditLogs(logs); 

      const siteMap = new Map(sites.map((s) => [s.id, s.site_name]));

      const categorized = inventoryList.map((item) => ({
        ...item,
        category:
          item.status === "Critical" || item.status === "Low Stock"
            ? "Fast-Moving"
            : item.status === "Healthy" || item.status === "Available"
              ? "Slow-Moving"
              : "Non-Moving",
        siteName: siteMap.get(item.site_id) || `Site ${item.site_id}`,
      })) as InventoryWithCategory[];

      setInventoryData(categorized);
      
      setSelectedIds([]); 
      setIsDeleteMode(false);
    } catch (err) {
      setError("Failed to load inventory data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await inventoryAPI.logTransaction({
        item_name: newItem.item_name,
        brand: newItem.brand,
        quantity: Number(newItem.quantity),
        unit: newItem.unit,
        status: newItem.status,
        fsn_status: newItem.fsn_status,
        site_id: Number(newItem.site_id),
      });

      setShowAddForm(false);
      setNewItem({ item_name: "", brand: "Generic/No Brand", quantity: 0, unit: "Bags", status: "Healthy", fsn_status: "FAST", site_id: "" });
      fetchData();
    } catch (err) {
      alert("Failed to add item to the ledger.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to remove this item from the ledger? This cannot be undone.")) return;
    try {
      await inventoryAPI.delete(id);
      fetchData(); 
    } catch (err) {
      alert("Failed to delete item.");
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`SECURITY WARNING:\n\nYou are about to permanently delete ${selectedIds.length} items from the ledger.\n\nThis action cannot be undone. Are you absolutely sure?`)) return;
    try {
      await Promise.all(selectedIds.map(id => inventoryAPI.delete(id)));
      fetchData(); 
    } catch (err) {
      alert("An error occurred while deleting some items. Please check the console.");
      fetchData();
    }
  };

  const exportToCSV = () => {
    if (inventoryData.length === 0) return alert("No data to export.");
    const headers = ["Item Name", "Brand", "Location", "Quantity", "Unit", "Category", "Status"];
    const rows = sortedData.map(item => `"${item.item_name}","${item.brand}","${item.siteName}",${item.quantity},"${item.unit}","${item.category}","${item.status}"`);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `MatTrack_Inventory_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // --- SMART SORT ENGINE ---
  
  // 1. Filter Logic
  const rawFilteredData = filter === "All" 
    ? inventoryData 
    : inventoryData.filter((i) => i.status === filter);

  // 2. Assign Priority Weights
  const getStatusWeight = (status: string) => {
    switch(status) {
      case "Critical": 
      case "Maintenance": 
        return 1; // Top priority
      case "Low Stock": 
        return 2;
      case "Healthy": 
      case "Available": 
        return 3;
      case "In Use": 
        return 4;
      case "Surplus": 
        return 5; // Lowest priority
      default: 
        return 99;
    }
  };

  // 3. Apply the Sort
  const sortedData = [...rawFilteredData].sort((a, b) => getStatusWeight(a.status) - getStatusWeight(b.status));

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.target.checked ? setSelectedIds(sortedData.map((item) => item.id)) : setSelectedIds([]);
  };

  const handleSelectItem = (id: number) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]);
  };

  // Status Badge Color Logic
  const getStatusColor = (status: string) => {
    switch(status) {
      case "Critical": case "Maintenance": return "bg-red-100 text-red-700 border-red-200";
      case "Low Stock": return "bg-amber-100 text-amber-700 border-amber-200";
      case "Healthy": case "Available": return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "Surplus": return "bg-blue-100 text-blue-700 border-blue-200";
      case "In Use": return "bg-indigo-100 text-indigo-700 border-indigo-200";
      default: return "bg-neutral-100 text-neutral-700 border-neutral-200";
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* HEADER & MASTER TABS */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-neutral-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Inventory & Ledger</h1>
          <p className="text-sm text-neutral-500 mt-1">Manage global stock and track system audit logs.</p>
          
          <div className="flex bg-neutral-100 p-1 rounded-lg w-fit mt-4">
            <button 
              onClick={() => setActiveTab("inventory")}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === "inventory" ? "bg-white text-emerald-700 shadow-sm" : "text-neutral-500 hover:text-neutral-700"}`}
            >
              <PackageSearch className="w-4 h-4" /> Network Inventory
            </button>
            <button 
              onClick={() => setActiveTab("audit")}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === "audit" ? "bg-white text-emerald-700 shadow-sm" : "text-neutral-500 hover:text-neutral-700"}`}
            >
              <History className="w-4 h-4" /> System Audit Logs
            </button>
          </div>
        </div>
        
        {/* ACTION BUTTONS */}
        {activeTab === "inventory" && (
          <div className="flex flex-wrap gap-2">
            {isDeleteMode ? (
              <>
                <button onClick={() => { setIsDeleteMode(false); setSelectedIds([]); }} className="px-4 py-2 bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-100 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
                  <X className="w-4 h-4" /> Cancel Selection
                </button>
                <button onClick={handleBulkDelete} disabled={selectedIds.length === 0} className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-sm">
                  <Trash2 className="w-4 h-4" /> Delete Selected ({selectedIds.length})
                </button>
              </>
            ) : (
              <>
                <button onClick={() => { setIsDeleteMode(true); setShowAddForm(false); setShowBulkWizard(false); }} className="px-4 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
                  <ListChecks className="w-4 h-4" /> Select Items
                </button>
                <button onClick={exportToCSV} className="px-4 py-2 bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
                  <Download className="w-4 h-4" /> Export
                </button>
                <button onClick={() => { setShowBulkWizard(!showBulkWizard); if (!showBulkWizard) setShowAddForm(false); }} className="px-4 py-2 bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
                  <Upload className="w-4 h-4" /> {showBulkWizard ? "Cancel Bulk Import" : "Bulk Import"}
                </button>
                <button onClick={() => { setShowAddForm(!showAddForm); if (!showAddForm) setShowBulkWizard(false); }} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
                  <Plus className="w-4 h-4" /> {showAddForm ? "Cancel" : "Add Stock"}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* --- INVENTORY TAB CONTENT --- */}
      {activeTab === "inventory" && (
        <>
          {showBulkWizard && <BulkImportWizard sitesList={sitesList} onComplete={() => { setShowBulkWizard(false); fetchData(); }} onCancel={() => setShowBulkWizard(false)} />}

          {showAddForm && (
            <div className="bg-white p-6 rounded-xl border border-emerald-200 shadow-sm animate-in slide-in-from-top-4">
              <div className="flex gap-4 mb-4 pb-4 border-b border-neutral-100">
                <button onClick={() => setItemType("consumable")} className={`px-4 py-2 rounded-lg font-bold text-sm border-2 ${itemType === "consumable" ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-transparent text-neutral-500 hover:bg-neutral-50"}`}>
                  Materials & Consumables
                </button>
                <button onClick={() => setItemType("asset")} className={`px-4 py-2 rounded-lg font-bold text-sm border-2 ${itemType === "asset" ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-transparent text-neutral-500 hover:bg-neutral-50"}`}>
                  Tools & Assets
                </button>
              </div>

              <form onSubmit={handleAddInventory} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 mb-1">Project Site</label>
                  <select className="w-full p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none" value={newItem.site_id} onChange={(e) => setNewItem({ ...newItem, site_id: e.target.value })} required>
                    <option value="">Select Site...</option>
                    {sitesList.map((s) => <option key={s.id} value={s.id}>{s.site_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 mb-1">{itemType === "consumable" ? "Material Name" : "Tool Name"}</label>
                  <input type="text" className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder={itemType === "consumable" ? "e.g. Portland Cement" : "e.g. Angle Grinder"} value={newItem.item_name} onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 mb-1">Brand/Spec</label>
                  <input type="text" className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder={itemType === "consumable" ? "e.g. Republic" : "e.g. Bosch 800W"} value={newItem.brand} onChange={(e) => setNewItem({ ...newItem, brand: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 mb-1">Qty</label>
                    <input type="number" className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })} required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 mb-1">Unit</label>
                    <select className="w-full p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none" value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}>
                      {itemType === "consumable" ? (
                        <>
                          <option value="Bags">Bags</option>
                          <option value="Pcs">Pcs</option>
                          <option value="Kilos">Kilos</option>
                          <option value="Linear Ft">Linear Ft</option>
                          <option value="Cu.m">Cu.m</option>
                        </>
                      ) : (
                        <>
                          <option value="Unit">Unit</option>
                          <option value="Set">Set</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 mb-1">Status</label>
                  <select className="w-full p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none" value={newItem.status} onChange={(e) => setNewItem({ ...newItem, status: e.target.value })}>
                    {itemType === "consumable" ? (
                      <>
                        <option value="Healthy">Healthy</option>
                        <option value="Low Stock">Low Stock</option>
                        <option value="Critical">Critical</option>
                        <option value="Surplus">Surplus</option>
                      </>
                    ) : (
                      <>
                        <option value="Available">Available</option>
                        <option value="In Use">In Use</option>
                        <option value="Maintenance">Maintenance</option>
                      </>
                    )}
                  </select>
                </div>
                <button type="submit" className="bg-slate-900 text-white py-2 rounded-lg font-bold hover:bg-slate-800 transition-colors w-full">
                  Log Stock
                </button>
              </form>
            </div>
          )}

          {/* Quick Filters */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            <div className="flex items-center gap-2 px-3 py-1 bg-neutral-200/50 rounded-full text-xs font-bold text-neutral-500 mr-2">
              <Filter className="w-3 h-3" /> Filters
            </div>
            {["All", "Critical", "Low Stock", "Healthy", "Surplus", "Available", "In Use"].map(f => (
              <button 
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${filter === f ? "bg-slate-800 text-white shadow-md" : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-200">
                  <tr>
                    {isDeleteMode && (
                      <th className="px-5 py-3 font-medium w-12 text-center">
                        <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-red-600 cursor-pointer" onChange={handleSelectAll} checked={sortedData.length > 0 && selectedIds.length === sortedData.length}/>
                      </th>
                    )}
                    <th className="px-5 py-3 font-medium">Item & Brand</th>
                    <th className="px-5 py-3 font-medium">Location</th>
                    <th className="px-5 py-3 font-medium text-right">Current Stock</th>
                    <th className="px-5 py-3 font-medium text-center">FSN</th>
                    <th className="px-5 py-3 font-medium text-center">Status</th>
                    <th className="px-5 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {sortedData.length > 0 ? (
                    sortedData.map((item) => (
                      <tr key={item.id} className={`hover:bg-neutral-50/50 transition-colors ${selectedIds.includes(item.id) ? "bg-red-50/30" : ""}`}>
                        {isDeleteMode && (
                          <td className="px-5 py-4 text-center">
                            <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-red-600 cursor-pointer" checked={selectedIds.includes(item.id)} onChange={() => handleSelectItem(item.id)}/>
                          </td>
                        )}
                        <td className="px-5 py-4 text-neutral-900">
                          <div className="font-bold text-sm">{item.item_name}</div>
                          <div className="text-xs text-neutral-500">{item.brand}</div>
                        </td>
                        <td className="px-5 py-4 text-neutral-600">{item.siteName}</td>
                        <td className="px-5 py-4 text-right font-medium">
                          <div className="flex items-center justify-end gap-2">
                            {(item.status === "Critical" || item.status === "Low Stock") && (
                              <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" />
                            )}
                            <span className="text-base">{item.quantity} <span className="text-neutral-400 font-normal text-xs">{item.unit}</span></span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className="text-[10px] font-black text-neutral-400 bg-neutral-100 px-2 py-1 rounded">{item.fsn_status}</span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={`inline-flex px-2.5 py-1 rounded border text-[10px] font-bold uppercase tracking-wider ${getStatusColor(item.status)}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => navigate('/advisory', { state: { autoPromptItem: item } })} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold" title="Ask AI to source this item" disabled={isDeleteMode}>
                              <Sparkles className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(item.id)} className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete Item">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={isDeleteMode ? 8 : 7} className="px-5 py-12 text-center text-neutral-500 bg-neutral-50/50">
                        No inventory matches your current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* --- AUDIT TRAIL TAB CONTENT --- */}
      {activeTab === "audit" && (
        <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden animate-in slide-in-from-bottom-4">
          <div className="px-6 py-5 border-b border-neutral-200 bg-slate-900 flex items-center gap-3">
            <Activity className="w-5 h-5 text-emerald-400" />
            <h2 className="font-semibold text-white">System Audit Trail</h2>
          </div>
          <div className="p-0">
            {auditLogs.length > 0 ? (
              <div className="divide-y divide-neutral-100">
                {auditLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-4 p-5 hover:bg-neutral-50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center border border-emerald-200 shrink-0 text-emerald-700 font-bold">
                      SA
                    </div>
                    <div>
                      <p className="text-neutral-900 font-medium text-sm leading-relaxed">{log.action}</p>
                      <p className="text-xs text-neutral-400 mt-1 font-mono">{log.timestamp}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center">
                <History className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-neutral-900">No Activity Recorded</h3>
                <p className="text-sm text-neutral-500 mt-1">Actions performed on the database will appear here chronologically.</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}