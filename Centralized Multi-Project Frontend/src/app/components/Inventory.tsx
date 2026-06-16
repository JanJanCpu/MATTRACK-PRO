import {
  PackageSearch,
  Plus,
  Trash2,
  Upload,
  Download,
  Sparkles,
  AlertTriangle,
  Activity,
  ListChecks, // <-- NEW Icon for the toggle button
  X
} from "lucide-react";
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; 
import { inventoryAPI, sitesAPI } from "../../services/apiService";
import type { Inventory as InventoryItem, ProjectSite } from "../../types";
import { BulkImportWizard } from "./BulkImportWizard";

interface InventoryWithCategory extends InventoryItem {
  category: "Fast-Moving" | "Slow-Moving" | "Non-Moving";
  siteName: string;
}

export function Inventory() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("All");
  const [inventoryData, setInventoryData] = useState<InventoryWithCategory[]>([]);
  const [sitesList, setSitesList] = useState<ProjectSite[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkWizard, setShowBulkWizard] = useState(false); 
  const [error, setError] = useState<string | null>(null);

  // NEW: State to track if we are in "Bulk Delete Mode"
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [newItem, setNewItem] = useState({
    item_name: "",
    brand: "Generic/No Brand", 
    quantity: 0,
    unit: "Bags",
    status: "Healthy",
    fsn_status: "FAST", 
    site_id: "",
  });

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
          item.status === "Critical" || item.status === "Warning"
            ? "Fast-Moving"
            : item.status === "Healthy"
              ? "Slow-Moving"
              : "Non-Moving",
        siteName: siteMap.get(item.site_id) || `Site ${item.site_id}`,
      })) as InventoryWithCategory[];

      setInventoryData(categorized);
      
      // Safety: Clear selections and exit mode when data refreshes
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
      setNewItem({
        item_name: "",
        brand: "Generic/No Brand",
        quantity: 0,
        unit: "Bags",
        status: "Healthy",
        fsn_status: "FAST",
        site_id: "",
      });
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

  // Multi-Select Logic
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredData.map((item) => item.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectItem = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`SECURITY WARNING:\n\nYou are about to permanently delete ${selectedIds.length} items from the ledger.\n\nThis action cannot be undone. Are you absolutely sure?`)) return;
    
    try {
      await Promise.all(selectedIds.map(id => inventoryAPI.delete(id)));
      fetchData(); // This will automatically reset the delete mode and clear selections
    } catch (err) {
      alert("An error occurred while deleting some items. Please check the console.");
      console.error(err);
      fetchData();
    }
  };

  const exportToCSV = () => {
    if (inventoryData.length === 0) {
      alert("No data to export.");
      return;
    }

    const headers = ["Item Name", "Brand", "Location", "Quantity", "Unit", "Category", "Status"];
    
    const rows = inventoryData.map(item => {
      return `"${item.item_name}","${item.brand}","${item.siteName}",${item.quantity},"${item.unit}","${item.category}","${item.status}"`;
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `MatTrack_Inventory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredData =
    filter === "All"
      ? inventoryData
      : inventoryData.filter((i) => i.category === filter || i.status === filter);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            Inventory & Ledger
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Manage stock and track audit logs across {sitesList.length} project sites.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {/* DYNAMIC HEADER BUTTONS: Changes based on whether we are in delete mode or not */}
          {isDeleteMode ? (
            <>
              {/* Escape Delete Mode Button */}
              <button
                onClick={() => {
                  setIsDeleteMode(false);
                  setSelectedIds([]); // Clear selections if they cancel
                }}
                className="px-4 py-2 bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-100 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
              >
                <X className="w-4 h-4" /> Cancel Selection
              </button>

              {/* The Actual Bulk Delete Execution Button */}
              <button
                onClick={handleBulkDelete}
                disabled={selectedIds.length === 0}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-sm"
              >
                <Trash2 className="w-4 h-4" /> Delete Selected ({selectedIds.length})
              </button>
            </>
          ) : (
            <>
              {/* NEW: Enter Bulk Delete Mode Button */}
              <button
                onClick={() => {
                  setIsDeleteMode(true);
                  setShowAddForm(false);
                  setShowBulkWizard(false);
                }}
                className="px-4 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                title="Select multiple items to delete"
              >
                <ListChecks className="w-4 h-4" /> Select Items
              </button>

              <button
                onClick={exportToCSV}
                className="px-4 py-2 bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                title="Download Inventory Report"
              >
                <Download className="w-4 h-4" /> Export
              </button>

              <button
                onClick={() => {
                  setShowBulkWizard(!showBulkWizard);
                  if (!showBulkWizard) setShowAddForm(false);
                }}
                className="px-4 py-2 bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
              >
                <Upload className="w-4 h-4" /> 
                {showBulkWizard ? "Cancel Bulk Import" : "Bulk Import"}
              </button>
              
              <button
                onClick={() => {
                  setShowAddForm(!showAddForm);
                  if (!showAddForm) setShowBulkWizard(false);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" /> {showAddForm ? "Cancel" : "Add Stock"}
              </button>
            </>
          )}
        </div>
      </div>

      {showBulkWizard && (
        <BulkImportWizard 
          sitesList={sitesList} 
          onComplete={() => {
            setShowBulkWizard(false);
            fetchData();
          }} 
          onCancel={() => setShowBulkWizard(false)}
        />
      )}

      {showAddForm && (
        <div className="bg-white p-6 rounded-xl border border-emerald-200 shadow-sm animate-in slide-in-from-top-4">
          <form onSubmit={handleAddInventory} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
            <div>
              <label className="block text-xs font-bold text-neutral-500 mb-1">Project Site</label>
              <select className="w-full p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none" value={newItem.site_id} onChange={(e) => setNewItem({ ...newItem, site_id: e.target.value })} required>
                <option value="">Select Site...</option>
                {sitesList.map((s) => (
                  <option key={s.id} value={s.id}>{s.site_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-500 mb-1">Material</label>
              <input type="text" className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="e.g. Portland Cement" value={newItem.item_name} onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })} required />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-500 mb-1">Brand/Spec</label>
              <input type="text" className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="e.g. Holcim" value={newItem.brand} onChange={(e) => setNewItem({ ...newItem, brand: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-neutral-500 mb-1">Qty</label>
                <input type="number" className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })} required />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-500 mb-1">Unit</label>
                <select className="w-full p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none" value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}>
                  <option value="Bags">Bags</option>
                  <option value="Kilos">Kilos</option>
                  <option value="Linear Ft">Linear Ft</option>
                  <option value="Pcs">Pcs</option>
                  <option value="Cu.m">Cu.m</option>
                  <option value="Rolls">Rolls</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-500 mb-1">Status</label>
              <select className="w-full p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none" value={newItem.status} onChange={(e) => setNewItem({ ...newItem, status: e.target.value })}>
                <option value="Healthy">Healthy (Available)</option>
                <option value="Warning">Warning (Low-Stock)</option>
                <option value="Critical">Critical (Out-of-Stock)</option>
                <option value="Surplus">Surplus (Available)</option>
                <option value="In Transit">In Transit</option>
              </select>
            </div>
            <button type="submit" className="bg-slate-900 text-white py-2 rounded-lg font-bold hover:bg-slate-800 transition-colors w-full">
              Log Stock
            </button>
          </form>
        </div>
      )}

      {/* Network Inventory Table */}
      <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 bg-neutral-50/50">
          <div className="flex items-center gap-2">
            <PackageSearch className="w-5 h-5 text-neutral-500" />
            <h2 className="font-semibold text-neutral-900">Network Inventory</h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-200">
              <tr>
                {/* CONDITIONAL: Select All Checkbox */}
                {isDeleteMode && (
                  <th className="px-5 py-3 font-medium w-12 text-center animate-in fade-in duration-300">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                      onChange={handleSelectAll}
                      checked={filteredData.length > 0 && selectedIds.length === filteredData.length}
                    />
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
              {filteredData.length > 0 ? (
                filteredData.map((item) => (
                  <tr key={item.id} className={`hover:bg-neutral-50/50 transition-colors ${selectedIds.includes(item.id) ? "bg-red-50/30" : ""}`}>
                    {/* CONDITIONAL: Row Checkbox */}
                    {isDeleteMode && (
                      <td className="px-5 py-4 text-center animate-in fade-in duration-300">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                          checked={selectedIds.includes(item.id)}
                          onChange={() => handleSelectItem(item.id)}
                        />
                      </td>
                    )}
                    <td className="px-5 py-4 text-neutral-900">
                      <div className="font-medium">{item.item_name}</div>
                      <div className="text-xs text-neutral-500">{item.brand}</div>
                    </td>
                    <td className="px-5 py-4 text-neutral-600">{item.siteName}</td>
                    
                    <td className="px-5 py-4 text-right font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {(item.status === "Critical" || item.status === "Warning") && (
                          <span title="Stock running low" className="flex items-center">
                            <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" />
                          </span>
                        )}
                        <span>{item.quantity} <span className="text-neutral-400 font-normal text-xs">{item.unit}</span></span>
                      </div>
                    </td>
                    
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                        item.category === "Fast-Moving" ? "bg-blue-100 text-blue-700"
                        : item.category === "Slow-Moving" ? "bg-amber-100 text-amber-700"
                        : "bg-purple-100 text-purple-700"
                      }`}>
                        {item.category.charAt(0)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                        item.status === "Critical" ? "bg-red-100 text-red-700"
                        : item.status === "Warning" ? "bg-amber-100 text-amber-700"
                        : "bg-emerald-100 text-emerald-700"
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {/* If in Delete Mode, optionally hide the single action buttons to prevent clutter, 
                            but we will leave them here so users can still single-delete if they prefer. */}
                        <button
                          onClick={() => navigate('/advisory', { state: { autoPromptItem: item } })}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                          title="Ask AI to source this item"
                          disabled={isDeleteMode} // Disable routing if they are managing deletions
                        >
                          <Sparkles className="w-4 h-4" /> Source
                        </button>
                        
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isDeleteMode ? 8 : 7} className="px-5 py-8 text-center text-neutral-500">
                    No inventory items found in the ledger.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden mt-6">
        <div className="px-5 py-4 border-b border-neutral-200 bg-neutral-50/50 flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-500" />
          <h2 className="font-semibold text-neutral-900">Recent Ledger Activity</h2>
        </div>
        <div className="p-5">
          {auditLogs.length > 0 ? (
            <div className="space-y-4">
              {auditLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 mt-1.5 rounded-full bg-indigo-400 shrink-0"></div>
                  <div>
                    <p className="text-neutral-800 font-medium">{log.action}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">{log.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-500 text-center py-4">No recent activity detected.</p>
          )}
        </div>
      </div>

    </div>
  );
}