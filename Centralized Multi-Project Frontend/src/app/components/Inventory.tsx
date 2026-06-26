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
  Filter,
  Lock,
  ArrowDownToLine,
  ArrowUpFromLine,
  Send
} from "lucide-react";
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom"; 

// REAL API IMPORTS
import { inventoryAPI, sitesAPI, suppliersAPI, transferAPI } from "../../services/apiService"; 
import type { Inventory as InventoryItem, ProjectSite, Supplier } from "../../types"; 
import { BulkImportWizard } from "./BulkImportWizard";

interface InventoryWithCategory extends InventoryItem {
  category: "Fast-Moving" | "Slow-Moving" | "Non-Moving";
  siteName: string;
}

export function Inventory() {
  const navigate = useNavigate();
  const location = useLocation();

  const [currentUserRole, setCurrentUserRole] = useState("staff");
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const [activeTab, setActiveTab] = useState<"inventory" | "audit">("inventory");
  
  const [statusFilter, setStatusFilter] = useState("All"); 
  const [siteFilter, setSiteFilter] = useState<number | null>(null);
  const [pivotSiteName, setPivotSiteName] = useState("");

  const [inventoryData, setInventoryData] = useState<InventoryWithCategory[]>([]);
  const [sitesList, setSitesList] = useState<ProjectSite[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]); 

  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkWizard, setShowBulkWizard] = useState(false); 
  const [error, setError] = useState<string | null>(null);

  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Transaction Modal State (UPDATED for Transactional Learning)
  const [modalType, setModalType] = useState<"IN" | "OUT" | "TRANSFER" | null>(null);
  const [activeTransactionItem, setActiveTransactionItem] = useState<InventoryWithCategory | null>(null);
  const [transactionForm, setTransactionForm] = useState({
    quantity: 0,
    destination_site_id: "",
    supplier_id: "",
    batch_rating: 0,
    price: 0
  });

  const [itemType, setItemType] = useState<"consumable" | "asset">("consumable");
  const [newItem, setNewItem] = useState({
    item_name: "",
    brand: "Generic/No Brand", 
    quantity: 0,
    unit: "Bags",
    status: "Healthy",
    fsn_status: "FAST", 
    site_id: "",
    supplier_id: "",
    batch_rating: 0,
    price: 0
  });

  // --- FSN ALGORITHM HELPER ---
  const calculateFSN = (status: string) => {
    if (status === "Critical" || status === "Low Stock") return "FAST";
    if (status === "Surplus") return "NON-MOVING";
    return "SLOW";
  };

  // --- THE ROUTING LISTENER ---
  useEffect(() => {
    const state = location.state as any;
    if (!state) return;

    let processedFilters = false;

    if (state.autoFilter) {
      setStatusFilter(state.autoFilter);
      processedFilters = true;
    }
    
    if (state.autoPivotSiteId) {
      setSiteFilter(state.autoPivotSiteId);
      setPivotSiteName(state.siteName || "");
      setNewItem(prev => ({ ...prev, site_id: state.autoPivotSiteId }));
      processedFilters = true;
    }
    
    if (processedFilters) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, navigate, location.pathname]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setCurrentUserRole(payload.role ? payload.role.toLowerCase() : "staff");
        setCurrentUserId(payload.id);
      } catch (e) {
        console.error("Token parse error");
      }
    }
  }, []);

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
      const [inventoryList, sites, logs, suppliers] = await Promise.all([
        inventoryAPI.list(),
        sitesAPI.list(),
        inventoryAPI.getLogs(),
        suppliersAPI.list() 
      ]);

      setSitesList(sites);
      setAuditLogs(logs); 
      setSuppliersList(suppliers); 

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
    if (newItem.supplier_id && newItem.batch_rating === 0) {
        return alert("Please provide a star rating for this delivery batch.");
    }

    try {
      await inventoryAPI.logTransaction({
        item_name: newItem.item_name,
        brand: newItem.brand,
        quantity: Number(newItem.quantity),
        unit: newItem.unit,
        status: newItem.status,
        fsn_status: calculateFSN(newItem.status), // Dynamically calculate FSN
        site_id: Number(newItem.site_id),
        supplier_id: newItem.supplier_id ? Number(newItem.supplier_id) : undefined,
        batch_rating: newItem.batch_rating > 0 ? Number(newItem.batch_rating) : undefined,
        price: newItem.price > 0 ? Number(newItem.price) : undefined,
      });

      setShowAddForm(false);
      setNewItem({ item_name: "", brand: "Generic/No Brand", quantity: 0, unit: "Bags", status: "Healthy", fsn_status: "FAST", site_id: siteFilter ? String(siteFilter) : "", supplier_id: "", batch_rating: 0, price: 0 });      
      fetchData();
      
      window.dispatchEvent(new Event("inventoryUpdated"));
    } catch (err) {
      alert("Failed to add item to the ledger.");
    }
  };

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTransactionItem || !modalType) return;
    if (transactionForm.quantity <= 0) return alert("Quantity must be greater than 0");

    if (modalType === "IN" && transactionForm.supplier_id && transactionForm.batch_rating === 0) {
        return alert("Please provide a star rating for this delivery batch.");
    }

    if (modalType === "TRANSFER") {
        if (!transactionForm.destination_site_id) return alert("Select a destination site.");
        if (activeTransactionItem.quantity < transactionForm.quantity) {
            return alert("Not enough stock to transfer.");
        }
        
        try {
            await transferAPI.initiate({
                source_site_id: activeTransactionItem.site_id,
                destination_site_id: Number(transactionForm.destination_site_id),
                item_name: activeTransactionItem.item_name,
                brand: activeTransactionItem.brand,
                quantity: transactionForm.quantity,
                unit: activeTransactionItem.unit
            });
            setModalType(null);
            setTransactionForm({ quantity: 0, destination_site_id: "", supplier_id: "", batch_rating: 0, price: 0 });
            fetchData();
            window.dispatchEvent(new Event("inventoryUpdated"));
            alert("Transfer dispatched successfully! It is now IN TRANSIT.");
        } catch (err) {
            alert("Failed to initiate transfer.");
        }
        return; 
    }

    let finalQuantity = transactionForm.quantity;
    let finalStatus = "Healthy";
    const isAsset = activeTransactionItem.unit === "Unit" || activeTransactionItem.unit === "Set";

    if (modalType === "OUT") {
      if (activeTransactionItem.quantity < transactionForm.quantity) return alert(`Not enough stock! You only have ${activeTransactionItem.quantity} ${activeTransactionItem.unit}.`);
      
      finalQuantity = -Math.abs(transactionForm.quantity);
      const stockAfterDeduction = activeTransactionItem.quantity - transactionForm.quantity;
      
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
        item_name: activeTransactionItem.item_name,
        brand: activeTransactionItem.brand,
        quantity: finalQuantity,
        unit: activeTransactionItem.unit,
        status: finalStatus,
        fsn_status: calculateFSN(finalStatus), // Dynamically calculate FSN
        site_id: activeTransactionItem.site_id,
        supplier_id: transactionForm.supplier_id ? Number(transactionForm.supplier_id) : undefined,
        batch_rating: transactionForm.batch_rating > 0 ? Number(transactionForm.batch_rating) : undefined,
        price: transactionForm.price > 0 ? Number(transactionForm.price) : undefined,
      });

      setModalType(null);
      setTransactionForm({ quantity: 0, destination_site_id: "", supplier_id: "", batch_rating: 0, price: 0 });
      fetchData();
      window.dispatchEvent(new Event("inventoryUpdated"));
    } catch (err) {
      alert("Transaction failed. Check connection.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to remove this item from the ledger? This cannot be undone.")) return;
    try {
      await inventoryAPI.delete(id);
      fetchData(); 
      window.dispatchEvent(new Event("inventoryUpdated"));
    } catch (err) {
      alert("Failed to delete item. You may not have clearance for this site.");
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`SECURITY WARNING:\n\nYou are about to permanently delete ${selectedIds.length} items from the ledger.\n\nThis action cannot be undone. Are you absolutely sure?`)) return;
    try {
      await Promise.all(selectedIds.map(id => inventoryAPI.delete(id)));
      fetchData(); 
      window.dispatchEvent(new Event("inventoryUpdated"));
    } catch (err) {
      alert("An error occurred while deleting some items. You may not have clearance for all selected sites.");
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

  // --- THE MASTER INVENTORY SMART SORT ALGORITHM ---
  let processedData = inventoryData;
  if (siteFilter) {
    processedData = processedData.filter(i => i.site_id === siteFilter);
  }
  if (statusFilter !== "All") {
    processedData = processedData.filter(i => i.status === statusFilter);
  }

  const getStatusWeight = (status: string) => {
    switch(status) {
      case "Critical": case "Maintenance": return 1; 
      case "Low Stock": return 2;
      case "Healthy": case "Available": return 3;
      case "In Use": return 4;
      case "Surplus": return 5; 
      default: return 99;
    }
  };

  const sortedData = [...processedData].sort((a, b) => getStatusWeight(a.status) - getStatusWeight(b.status));

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const editableIds = sortedData.filter(item => {
        const site = sitesList.find(s => s.id === item.site_id);
        return currentUserRole !== "staff" || (site && site.manager_id === currentUserId);
      }).map(item => item.id);
      setSelectedIds(editableIds);
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectItem = (id: number) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]);
  };

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

  const editableSites = sitesList.filter(s => currentUserRole !== "staff" || s.manager_id === currentUserId);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-neutral-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Global Inventory Ledger</h1>
          <p className="text-sm text-neutral-500 mt-1">Global visibility enabled. You can only modify data for sites you manage.</p>
          
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

      {activeTab === "inventory" && (
        <>
          {siteFilter && (
            <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2 text-indigo-800 font-medium text-sm">
                <Filter className="w-4 h-4" /> Filtered to Project Site: <strong className="font-black">{pivotSiteName || `SITE-${siteFilter}`}</strong>
              </div>
              <button 
                onClick={() => {
                  setSiteFilter(null);
                  navigate('.', { replace: true, state: null }); 
                }}
                className="px-3 py-1 bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-100 rounded text-xs font-bold transition-colors"
              >
                Clear Filter (View Global)
              </button>
            </div>
          )}

          {showBulkWizard && <BulkImportWizard sitesList={editableSites} suppliersList={suppliersList} onComplete={() => { setShowBulkWizard(false); fetchData(); window.dispatchEvent(new Event("inventoryUpdated")); }} onCancel={() => setShowBulkWizard(false)} />}

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

              <form onSubmit={handleAddInventory} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 mb-1">Project Site</label>
                    <select className="w-full p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none" value={newItem.site_id} onChange={(e) => setNewItem({ ...newItem, site_id: e.target.value })} required>
                      <option value="">Select Managed Site...</option>
                      {editableSites.map((s) => <option key={s.id} value={s.id}>{s.site_name}</option>)}
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
                      <input type="number" min="1" className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" value={newItem.quantity || ""} onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })} required />
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
                </div>

                {/* --- Transactional Learning Inputs for New Stock --- */}
                <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200">
                  <label className="block text-xs font-bold text-neutral-500 mb-2">Supplier Source & Procurement Data (Optional)</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <select className="w-full p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none" value={newItem.supplier_id} onChange={(e) => setNewItem({ ...newItem, supplier_id: e.target.value })}>
                        <option value="">No Supplier Selected</option>
                        {suppliersList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    {newItem.supplier_id && (
                      <>
                        <div>
                          <input type="number" min="0" step="0.01" className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Unit Price (₱) e.g. 250.00" value={newItem.price || ""} onChange={(e) => setNewItem({ ...newItem, price: Number(e.target.value) })} />
                        </div>
                        <div>
                          <input type="number" min="1" max="5" className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Delivery Rating (1 to 5 Stars)" value={newItem.batch_rating || ""} onChange={(e) => setNewItem({ ...newItem, batch_rating: Number(e.target.value) })} required />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <button type="submit" className="bg-slate-900 text-white py-2 rounded-lg font-bold hover:bg-slate-800 transition-colors w-full">
                  Log Initial Stock
                </button>
              </form>
            </div>
          )}

          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            <div className="flex items-center gap-2 px-3 py-1 bg-neutral-200/50 rounded-full text-xs font-bold text-neutral-500 mr-2">
              <Filter className="w-3 h-3" /> Filters
            </div>
            {["All", "Critical", "Low Stock", "Healthy", "Surplus", "Available", "In Use"].map(f => (
              <button 
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${statusFilter === f ? "bg-slate-800 text-white shadow-md" : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}
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
                        <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-red-600 cursor-pointer" onChange={handleSelectAll} checked={sortedData.length > 0 && selectedIds.length === sortedData.filter(i => currentUserRole !== "staff" || sitesList.find(s => s.id === i.site_id)?.manager_id === currentUserId).length}/>
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
                    sortedData.map((item) => {
                      const itemSite = sitesList.find(s => s.id === item.site_id);
                      const canEdit = currentUserRole !== "staff" || (itemSite && itemSite.manager_id === currentUserId);

                      return (
                        <tr key={item.id} className={`hover:bg-neutral-50/50 transition-colors ${selectedIds.includes(item.id) ? "bg-red-50/30" : ""} ${!canEdit && isDeleteMode ? "opacity-50 bg-neutral-50" : ""}`}>
                          {isDeleteMode && (
                            <td className="px-5 py-4 text-center">
                              {canEdit ? (
                                <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-red-600 cursor-pointer" checked={selectedIds.includes(item.id)} onChange={() => handleSelectItem(item.id)}/>
                              ) : (
                                <Lock className="w-4 h-4 text-neutral-300 mx-auto" />
                              )}
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
                          
                          {/* DYNAMIC FSN BADGE RENDERING */}
                          <td className="px-5 py-4 text-center">
                            <span className={`inline-flex text-[10px] font-black px-2 py-1 rounded tracking-wider
                              ${calculateFSN(item.status) === 'FAST' ? 'text-amber-700 bg-amber-100' : 
                                calculateFSN(item.status) === 'NON-MOVING' ? 'text-blue-700 bg-blue-100' : 
                                'text-emerald-700 bg-emerald-100'}`}
                            >
                              {calculateFSN(item.status)}
                            </span>
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
                              
                              {canEdit ? (
                                <>
                                  <button onClick={() => { setActiveTransactionItem(item); setModalType("IN"); }} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Log Delivery (In)"><ArrowDownToLine className="w-4 h-4" /></button>
                                  <button onClick={() => { setActiveTransactionItem(item); setModalType("OUT"); }} className="p-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors" title="Log Usage (Out)"><ArrowUpFromLine className="w-4 h-4" /></button>
                                  <button onClick={() => { setActiveTransactionItem(item); setModalType("TRANSFER"); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Transfer to Site"><Send className="w-4 h-4" /></button>
                                </>
                              ) : (
                                <button disabled className="p-2 text-neutral-300 rounded-lg cursor-not-allowed" title="Read Only (Managed by another site)">
                                  <Lock className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
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

      {/* Audit Tab */}
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

      {/* Transaction Modal */}
      {modalType && activeTransactionItem && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className={`p-4 border-b flex justify-between items-center 
              ${modalType === "IN" ? "bg-emerald-50 border-emerald-100 text-emerald-900" : 
                modalType === "OUT" ? "bg-slate-900 border-slate-800 text-white" : 
                "bg-blue-50 border-blue-100 text-blue-900"}`
            }>
              <h2 className="text-lg font-bold flex items-center gap-2">
                {modalType === "IN" && <><ArrowDownToLine className="w-5 h-5"/> Log Delivery</>}
                {modalType === "OUT" && <><ArrowUpFromLine className="w-5 h-5"/> Log Usage</>}
                {modalType === "TRANSFER" && <><Send className="w-5 h-5"/> Dispatch Transfer</>}
              </h2>
              <button onClick={() => setModalType(null)} className="p-1 hover:bg-black/10 rounded-md transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleTransactionSubmit} className="p-6 space-y-5">
              <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                <p className="text-xs text-neutral-500 font-bold uppercase mb-1">Target Item</p>
                <p className="font-bold text-neutral-900">{activeTransactionItem.item_name} <span className="text-neutral-500 font-normal">({activeTransactionItem.brand})</span></p>
                <p className="text-xs text-neutral-500 mt-1">Current Stock: {activeTransactionItem.quantity} {activeTransactionItem.unit}</p>
              </div>

              {/* --- Transactional Learning Inputs for Log Delivery --- */}
              {modalType === "IN" && (
                <div className="space-y-4 pt-2 border-t border-neutral-100">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Supplier (Optional)</label>
                    <select
                      value={transactionForm.supplier_id}
                      onChange={(e) => setTransactionForm({ ...transactionForm, supplier_id: e.target.value })}
                      className="w-full p-3 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="">No Supplier / General Delivery</option>
                      {suppliersList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>

                  {transactionForm.supplier_id && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Unit Price (₱)</label>
                        <input
                          type="number" min="0" step="0.01"
                          value={transactionForm.price || ""}
                          onChange={(e) => setTransactionForm({ ...transactionForm, price: Number(e.target.value) })}
                          className="w-full p-3 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                          placeholder="e.g. 250.00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Delivery Rating (1-5)</label>
                        <input
                          type="number" min="1" max="5" required
                          value={transactionForm.batch_rating || ""}
                          onChange={(e) => setTransactionForm({ ...transactionForm, batch_rating: Number(e.target.value) })}
                          className="w-full p-3 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                          placeholder="Rate 1 to 5"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

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
                    {sitesList.filter(s => s.id !== activeTransactionItem.site_id).map(site => (
                      <option key={site.id} value={site.id}>{site.site_name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-2 border-t border-neutral-100 mt-4">
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Quantity {modalType === "IN" ? "Received" : modalType === "TRANSFER" ? "To Transfer" : "Used"}</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="number" required min="1" max={modalType !== "IN" ? activeTransactionItem.quantity : undefined}
                    value={transactionForm.quantity || ""}
                    onChange={(e) => setTransactionForm({ ...transactionForm, quantity: Number(e.target.value) })}
                    className="w-full p-3 border border-neutral-300 rounded-lg text-lg font-bold text-center focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <span className="font-bold text-neutral-500 bg-neutral-100 px-4 py-3 rounded-lg border border-neutral-200">{activeTransactionItem.unit}</span>
                </div>
              </div>

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

export default function App() {
  return <Inventory />;
}