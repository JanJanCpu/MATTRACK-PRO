import {
  PackageSearch, Plus, Trash2, Upload, Download, Sparkles, AlertTriangle,
  Activity, ListChecks, X, History, Filter, Lock, ArrowDownToLine,
  ArrowUpFromLine, Send, Truck, CheckCircle, FilePlus, BookmarkPlus, Ban,
  Building2, Flag, Star, ShoppingCart
} from "lucide-react";
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { inventoryAPI, sitesAPI, suppliersAPI, transferAPI, requestsAPI, purchaseOrdersAPI } from "../../services/apiService";
import type { Inventory as InventoryItem, ProjectSite, Supplier } from "../../types";
import { BulkImportWizard } from "./BulkImportWizard";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Navigation, MapPin, Clock } from "lucide-react";
import { createPortal } from "react-dom";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png", iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png", shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png" });
const createIcon = (color: string) => new L.Icon({ iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`, shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png", iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34] });
const sourceIcon = createIcon("violet"); const destIcon = createIcon("blue");

const MASTER_CATALOG = [
  { sku: "MAT-001", name: "Portland Cement", brand: "Republic", unit: "Bags" },
  { sku: "MAT-002", name: "Plywood 1/2\"", brand: "Standard Marine", unit: "Pcs" },
  { sku: "MAT-003", name: "12mm Deformed Rebar", brand: "SteelAsia", unit: "Pcs" },
  { sku: "MAT-004", name: "Rough Wood Lumber 2x4", brand: "Local Kiln", unit: "Pcs" },
  { sku: "MAT-005", name: "Washed Sand / Buhangin", brand: "Aggregate Co", unit: "Cu.m" },
  { sku: "MAT-006", name: "Gravel / 3/4 Crushed Stone", brand: "Aggregate Co", unit: "Cu.m" },
  { sku: "MAT-007", name: "Angle Grinder 800W", brand: "Bosch", unit: "Unit" },
  { sku: "MAT-008", name: "Safety Helmet / Hard Hat", brand: "MSA", unit: "Pcs" }
];

function RouteFitter({ coords }: { coords: [number, number][] }) { const map = useMap(); useEffect(() => { if (coords.length > 0) map.fitBounds(coords, { padding: [50, 50] }); }, [coords, map]); return null; }

interface InventoryWithCategory extends InventoryItem { category: "Fast-Moving" | "Slow-Moving" | "Non-Moving"; siteName: string; baseline_quantity: number; }

export function Inventory() {
  const navigate = useNavigate(); const location = useLocation();
  const [currentUserRole, setCurrentUserRole] = useState("staff"); const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"inventory" | "audit" | "incoming" | "procurement">("inventory");
  const [incomingTransfers, setIncomingTransfers] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("All"); const [siteFilter, setSiteFilter] = useState<number | null>(null); const [pivotSiteName, setPivotSiteName] = useState("");
  const [inventoryData, setInventoryData] = useState<InventoryWithCategory[]>([]);
  const [sitesList, setSitesList] = useState<ProjectSite[]>([]); const [auditLogs, setAuditLogs] = useState<any[]>([]); const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [showAddForm, setShowAddForm] = useState(false); const [showBulkWizard, setShowBulkWizard] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false); const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [pendingPOs, setPendingPOs] = useState<any[]>([]);

  const [modalType, setModalType] = useState<"IN" | "OUT" | "TRANSFER" | "LIFECYCLE" | null>(null);
  const [activeTransactionItem, setActiveTransactionItem] = useState<InventoryWithCategory | null>(null);
  const [transactionForm, setTransactionForm] = useState<{ quantity: number | ""; destination_site_id: string; supplier_id: string; batch_rating: number; }>({ quantity: "", destination_site_id: "", supplier_id: "", batch_rating: 0 });

  const [transferRouteCoords, setTransferRouteCoords] = useState<[number, number][]>([]); const [routeDetails, setRouteDetails] = useState({ distance: "0", eta: "0" });

  const [showRequestModal, setShowRequestModal] = useState(false); const [requestItem, setRequestItem] = useState<InventoryWithCategory | null>(null); const [requestQty, setRequestQty] = useState<number>(1);
  const [itemType, setItemType] = useState<"consumable" | "asset">("consumable");
  const [newItem, setNewItem] = useState<{ item_name: string; brand: string; quantity: number | ""; unit: string; status: string; fsn_status: string; site_id: string; }>({ item_name: "", brand: "Generic/No Brand", quantity: "", unit: "Bags", status: "In Stock", fsn_status: "FAST", site_id: "", });

  const [showRestockModal, setShowRestockModal] = useState(false); const [restockItem, setRestockItem] = useState<InventoryWithCategory | null>(null); const [restockOptions, setRestockOptions] = useState<any[]>([]); const [isRestockLoading, setIsRestockLoading] = useState(false); const [hasScanned, setHasScanned] = useState(false); const [restockQty, setRestockQty] = useState<number>(0);
  const [receivingPO, setReceivingPO] = useState<any | null>(null); const [poRating, setPoRating] = useState<number>(0);

  const handleSmartCatalogSelect = (selectedName: string) => { const match = MASTER_CATALOG.find(c => c.name === selectedName); if (match) setNewItem(prev => ({ ...prev, item_name: match.name, brand: match.brand, unit: match.unit })); else setNewItem(prev => ({ ...prev, item_name: selectedName })); };

  const handleRequestRestock = async (e: React.FormEvent) => { e.preventDefault(); if (!requestItem || !requestQty) return; try { await requestsAPI.restock(requestItem.id, requestQty); alert("✅ Restock request submitted! It is now pending Admin approval."); setShowRequestModal(false); fetchData(); } catch (err: any) { alert(err.message || "Failed to submit restock request."); } };

  const handleSmartRestock = (item: InventoryWithCategory) => { setRestockItem(item); setRestockQty(Math.max(1, item.baseline_quantity - item.quantity)); setRestockOptions([]); setHasScanned(false); setShowRestockModal(true); };

  const runAdvisorCalculation = async () => { if (!restockItem) return; setIsRestockLoading(true); setHasScanned(true); try { const response = await fetch(`http://${window.location.hostname}:8000/advisory/auto-restock/${restockItem.site_id}?item_name=${encodeURIComponent(restockItem.item_name)}&quantity_needed=${restockQty}`); if (response.ok) setRestockOptions(await response.json()); } catch (error) { alert("Network error: Could not reach the heuristic engine."); } finally { setIsRestockLoading(false); } };

  const handleExecuteRestock = async (option: any) => { if (!restockItem) return; try { if (option.type === "EXTERNAL_PURCHASE") { await purchaseOrdersAPI.create({ supplier_id: option.source_id, site_id: restockItem.site_id, material_name: restockItem.item_name, quantity: restockQty, total_price: option.estimated_total_cost, }); alert(`Purchase Order automatically sent to ${option.source_name}!`); } else if (option.type === "INTERNAL_TRANSFER") { await transferAPI.initiate({ source_site_id: option.source_id, destination_site_id: restockItem.site_id, item_name: restockItem.item_name, brand: restockItem.brand, quantity: restockQty, unit: restockItem.unit, }); alert(`Logistics network alerted. Transfer from ${option.source_name} is now IN TRANSIT.`); } setShowRestockModal(false); fetchData(); window.dispatchEvent(new Event("inventoryUpdated")); } catch (error) { alert("System Error: Failed to execute automated restock."); } };

  useEffect(() => {
    if (modalType === "TRANSFER" && transactionForm.destination_site_id && activeTransactionItem) {
      const sourceSite = sitesList.find((s) => s.id === activeTransactionItem.site_id); const destSite = sitesList.find((s) => s.id === Number(transactionForm.destination_site_id));
      if (sourceSite && destSite) {
        const fetchRoute = async () => { try { const url = `https://router.project-osrm.org/route/v1/driving/${sourceSite.longitude},${sourceSite.latitude};${destSite.longitude},${destSite.latitude}?overview=full&geometries=geojson`; const response = await fetch(url); const data = await response.json(); if (data.routes && data.routes.length > 0) { const coords = data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]]); setTransferRouteCoords(coords); setRouteDetails({ distance: (data.routes[0].distance / 1000).toFixed(1), eta: Math.max(10, Math.round(data.routes[0].duration / 60)).toString() }); } } catch (error) { setTransferRouteCoords([[sourceSite.latitude, sourceSite.longitude], [destSite.latitude, destSite.longitude]]); } }; fetchRoute();
      }
    } else { setTransferRouteCoords([]); setRouteDetails({ distance: "0", eta: "0" }); }
  }, [modalType, transactionForm.destination_site_id, activeTransactionItem, sitesList]);

  useEffect(() => { if (location.state?.autoFilter) setStatusFilter(location.state.autoFilter); if (location.state?.autoPivotSiteId) { setSiteFilter(location.state.autoPivotSiteId); setPivotSiteName(location.state.siteName || ""); setNewItem((prev) => ({ ...prev, site_id: String(location.state.autoPivotSiteId) })); } if (location.state) navigate(location.pathname, { replace: true, state: {} }); }, [location.state, navigate, location.pathname]);
  useEffect(() => { const token = localStorage.getItem("token"); if (token) { try { const payload = JSON.parse(atob(token.split(".")[1])); setCurrentUserRole(payload.role ? payload.role.toLowerCase() : "staff"); setCurrentUserId(payload.id); } catch (e) {} } }, []);
  useEffect(() => { if (itemType === "consumable") setNewItem((prev) => ({ ...prev, unit: "Bags", status: "In Stock" })); else setNewItem((prev) => ({ ...prev, unit: "Unit", status: "Available" })); }, [itemType]);

  const fetchData = async () => {
    try {
      setLoading(true); const [inventoryList, sites, logs, suppliers] = await Promise.all([ inventoryAPI.list(), sitesAPI.list(), inventoryAPI.getLogs(), suppliersAPI.list() ]);
      let pos = []; try { pos = await purchaseOrdersAPI.list(); } catch (e) {}
      setSitesList(sites); setAuditLogs(logs); setSuppliersList(suppliers); setPendingPOs(pos);
      const siteMap = new Map(sites.map((s) => [s.id, s.site_name]));
      const categorized = inventoryList.map((item) => ({ ...item, category: (item.status === "Critical" || item.status === "Low Stock") ? "Fast-Moving" : (item.status === "In Stock" || item.status === "Available" || item.status === "Sufficient") ? "Slow-Moving" : "Non-Moving", siteName: siteMap.get(item.site_id) || `Site ${item.site_id}`, })) as InventoryWithCategory[];
      setInventoryData(categorized); setSelectedIds([]); setIsDeleteMode(false);
    } catch (err) { setError("Failed to load inventory data."); } finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, []);

  const loadIncomingTransfers = async () => { try { const managedSites = sitesList.filter((s) => currentUserRole !== "staff" || s.manager_id === currentUserId); let allPending: any[] = []; for (const site of managedSites) { const transfers = await transferAPI.getIncoming(site.id); allPending = [...allPending, ...transfers]; } setIncomingTransfers(allPending); } catch (err) {} };
  useEffect(() => { if (activeTab === "incoming") loadIncomingTransfers(); }, [activeTab, sitesList]);

  const handleAcceptTransfer = async (transferId: number) => { if (!window.confirm("SECURITY VERIFICATION: Confirm receipt of these materials?")) return; try { await transferAPI.receive(transferId); alert("✅ Transfer successfully received! Critical statuses automatically updated."); loadIncomingTransfers(); fetchData(); window.dispatchEvent(new Event("inventoryUpdated")); } catch (err) { alert("Failed to receive transfer."); } };
  const handleCancelTransfer = async (transferId: number) => { if (!window.confirm("Are you sure you want to REJECT this incoming transfer? The materials will be routed back to the original sender.")) return; try { const token = localStorage.getItem("token"); const res = await fetch(`http://${window.location.hostname}:8000/transfers/${transferId}/cancel`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }); if (res.ok) { alert("❌ Transfer rejected. Items have been successfully refunded to the source inventory."); loadIncomingTransfers(); fetchData(); window.dispatchEvent(new Event("inventoryUpdated")); } else { alert("Failed to reject transfer."); } } catch (err) { alert("Network error."); } };

  const submitReceivePO = async (e: React.FormEvent) => { e.preventDefault(); if (!receivingPO) return; if (poRating === 0) return alert("Please provide a delivery rating before confirming."); try { await purchaseOrdersAPI.receive(receivingPO.id, poRating); alert("✅ External PO Shipment Received! Supplier rating recorded."); setReceivingPO(null); setPoRating(0); fetchData(); window.dispatchEvent(new Event("inventoryUpdated")); } catch (err: any) { alert(err.message || "Network error. Could not mark shipment as received."); } };
  const handleCancelPO = async (poId: number) => { if (!window.confirm("Are you sure you want to cancel this pending purchase order?")) return; try { await purchaseOrdersAPI.cancel(poId); alert("❌ Purchase Order successfully cancelled."); fetchData(); } catch (err: any) { alert(err.message || "Network error. Could not cancel PO."); } };

  const handleAddInventory = async (e: React.FormEvent) => { e.preventDefault(); if (newItem.quantity === "") return alert("Please specify physical item count."); try { await inventoryAPI.logTransaction({ item_name: newItem.item_name.trim(), brand: newItem.brand.trim(), quantity: Number(newItem.quantity), unit: newItem.unit, status: newItem.status, fsn_status: newItem.fsn_status, site_id: Number(newItem.site_id), }); setShowAddForm(false); setNewItem({ item_name: "", brand: "Generic/No Brand", quantity: "", unit: "Bags", status: "In Stock", fsn_status: "FAST", site_id: siteFilter ? String(siteFilter) : "" }); fetchData(); window.dispatchEvent(new Event("inventoryUpdated")); } catch (err) { alert("Failed to register baseline item to the ledger."); } };

  const handleOverrideStatus = async (status: string) => { if (!activeTransactionItem) return; try { await inventoryAPI.overrideStatus(activeTransactionItem.id, status); setModalType(null); fetchData(); window.dispatchEvent(new Event("inventoryUpdated")); alert(`Item status successfully updated to ${status}.`); } catch (err: any) { alert("Failed to update status: " + err.message); } };

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!activeTransactionItem || !modalType || transactionForm.quantity === "") return; if (Number(transactionForm.quantity) <= 0) return alert("Quantity must be greater than 0");
    if (modalType === "TRANSFER") { if (!transactionForm.destination_site_id) return alert("Select a destination site."); if (activeTransactionItem.quantity < Number(transactionForm.quantity)) return alert("Not enough stock to transfer."); try { await transferAPI.initiate({ source_site_id: activeTransactionItem.site_id, destination_site_id: Number(transactionForm.destination_site_id), item_name: activeTransactionItem.item_name, brand: activeTransactionItem.brand, quantity: Number(transactionForm.quantity), unit: activeTransactionItem.unit, }); setModalType(null); fetchData(); window.dispatchEvent(new Event("inventoryUpdated")); alert("Transfer dispatched successfully! It is now IN TRANSIT."); } catch (err: any) { alert(err.message || "Failed to initiate transfer."); } return; }
    let finalQuantity = Number(transactionForm.quantity); if (modalType === "OUT") { if (activeTransactionItem.quantity < Number(transactionForm.quantity)) return alert(`Not enough stock! You only have ${activeTransactionItem.quantity} ${activeTransactionItem.unit}.`); finalQuantity = -Math.abs(Number(transactionForm.quantity)); }
    try { await inventoryAPI.logTransaction({ item_name: activeTransactionItem.item_name, brand: activeTransactionItem.brand, quantity: finalQuantity, unit: activeTransactionItem.unit, status: activeTransactionItem.status, fsn_status: "FAST", site_id: activeTransactionItem.site_id, supplier_id: undefined, batch_rating: undefined, }); setModalType(null); fetchData(); window.dispatchEvent(new Event("inventoryUpdated")); } catch (err) { alert("Transaction failed. Check connection."); }
  };

  const handleBulkDelete = async () => { if (!window.confirm(`SECURITY WARNING:\n\nYou are about to permanently delete ${selectedIds.length} items.\n\nThis action cannot be undone. Are you absolutely sure?`)) return; try { await Promise.all(selectedIds.map((id) => inventoryAPI.delete(id))); fetchData(); window.dispatchEvent(new Event("inventoryUpdated")); } catch (err) { alert("An error occurred. You may not have clearance for all selected sites."); fetchData(); } };

  const exportToCSV = () => { if (inventoryData.length === 0) return alert("No data to export."); const headers = ["Item Name", "Brand", "Location", "Quantity", "Baseline 100%", "Unit", "Status"]; const rows = sortedData.map((item) => `"${item.item_name}","${item.brand}","${item.siteName}",${item.quantity},${item.baseline_quantity},"${item.unit}","${item.status}"`); const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n"); const link = document.createElement("a"); link.href = encodeURI(csvContent); link.download = `MatTrack_Inventory_${new Date().toISOString().split("T")[0]}.csv`; link.click(); };

  let processedData = inventoryData; if (siteFilter) processedData = processedData.filter((i) => i.site_id === siteFilter); if (statusFilter !== "All") processedData = processedData.filter((i) => i.status === statusFilter);

  const getStatusWeight = (status: string) => { switch (status) { case "Critical": case "Maintenance": case "Out of Stock": case "Fully Utilized": case "Depleted": return 1; case "Low Stock": return 2; case "In Stock": case "Sufficient": case "Available": return 3; case "In Use": return 4; case "Surplus": return 5; default: return 99; } };
  const sortedData = [...processedData].sort((a, b) => getStatusWeight(a.status) - getStatusWeight(b.status));

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.checked) { const editableIds = sortedData.filter((item: InventoryWithCategory) => { const site = sitesList.find((s: ProjectSite) => s.id === item.site_id); return currentUserRole !== "staff" || (site && site.manager_id === currentUserId); }).map((item: InventoryWithCategory) => item.id); setSelectedIds(editableIds); } else { setSelectedIds([]); } };
  const handleSelectItem = (id: number) => { setSelectedIds((prev) => prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]); };

  const getStatusColor = (status: string) => { switch (status) { case "Critical": case "Maintenance": return "bg-red-100 text-red-700 border-red-200"; case "Low Stock": return "bg-amber-100 text-amber-700 border-amber-200"; case "In Stock": case "Available": case "Sufficient": return "bg-emerald-100 text-emerald-700 border-emerald-200"; case "Surplus": return "bg-blue-100 text-blue-700 border-blue-200"; case "In Use": return "bg-indigo-100 text-indigo-700 border-indigo-200"; case "Out of Stock": case "Fully Utilized": case "Depleted": return "bg-neutral-100 text-neutral-500 border-neutral-300"; default: return "bg-neutral-100 text-neutral-700 border-neutral-200"; } };

  const editableSites = sitesList.filter((s) => currentUserRole !== "staff" || s.manager_id === currentUserId);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 border-b border-neutral-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Global Inventory Ledger</h1>
          <p className="text-sm text-neutral-500 mt-1">Global visibility enabled. Select your active project site below to isolate ledgers.</p>
        </div>
        <div className="flex bg-neutral-100 p-1 rounded-lg w-max max-w-full overflow-x-auto gap-1">
          <button onClick={() => setActiveTab("inventory")} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap shrink-0 ${activeTab === "inventory" ? "bg-white text-emerald-700 shadow-sm" : "text-neutral-500 hover:text-neutral-700"}`}><PackageSearch className="w-4 h-4 shrink-0" /> Network Inventory</button>
          <button onClick={() => setActiveTab("audit")} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap shrink-0 ${activeTab === "audit" ? "bg-white text-emerald-700 shadow-sm" : "text-neutral-500 hover:text-neutral-700"}`}><History className="w-4 h-4 shrink-0" /> System Audit Logs</button>
          <button onClick={() => setActiveTab("incoming")} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap shrink-0 ${activeTab === "incoming" ? "bg-white text-blue-700 shadow-sm" : "text-neutral-500 hover:text-neutral-700"}`}><Truck className="w-4 h-4 shrink-0" /> Incoming Transfers{incomingTransfers.length > 0 && (<span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">{incomingTransfers.length}</span>)}</button>
          <button onClick={() => setActiveTab("procurement")} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap shrink-0 ${activeTab === "procurement" ? "bg-white text-blue-700 shadow-sm" : "text-neutral-500 hover:text-neutral-700"}`}><FilePlus className="w-4 h-4 shrink-0" /> Procurement Queue</button>
        </div>
      </div>

      {activeTab === "inventory" && (
        <div className="space-y-4 pt-1">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center bg-white border border-neutral-300 rounded-lg px-3 py-2 shadow-sm w-full lg:w-72 shrink-0">
              <Filter className="w-4 h-4 text-neutral-400 mr-2 shrink-0" />
              <select value={siteFilter || ""} onChange={(e) => { const val = e.target.value; setSiteFilter(val ? Number(val) : null); setPivotSiteName(val ? sitesList.find(s => s.id === Number(val))?.site_name || "" : ""); }} className="bg-transparent text-sm font-bold text-neutral-700 outline-none w-full cursor-pointer">
                <option value="">All Network Sites</option>{sitesList.map(s => (<option key={s.id} value={s.id}>{s.site_name}</option>))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isDeleteMode ? (
                <><button onClick={() => { setIsDeleteMode(false); setSelectedIds([]); }} className="px-4 py-2 bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-100 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shrink-0"><X className="w-4 h-4" /> Cancel Selection</button><button onClick={handleBulkDelete} disabled={selectedIds.length === 0} className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-sm shrink-0"><Trash2 className="w-4 h-4" /> Delete Selected ({selectedIds.length})</button></>
              ) : (
                <><button onClick={() => { setIsDeleteMode(true); setShowAddForm(false); setShowBulkWizard(false); }} className="px-4 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shrink-0"><ListChecks className="w-4 h-4" /> Select Items</button><button onClick={exportToCSV} className="px-4 py-2 bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shrink-0"><Download className="w-4 h-4" /> Export</button><button onClick={() => { setShowBulkWizard(!showBulkWizard); if (!showBulkWizard) setShowAddForm(false); }} className="px-4 py-2 bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shrink-0"><Upload className="w-4 h-4" /> {showBulkWizard ? "Cancel Bulk Import" : "Bulk Import"}</button><button onClick={() => { setShowAddForm(!showAddForm); if (!showAddForm) setShowBulkWizard(false); }} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shrink-0"><BookmarkPlus className="w-4 h-4" /> {showAddForm ? "Cancel Setup" : "Register Item Baseline"}</button></>
              )}
            </div>
          </div>

          {siteFilter && (
            <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl flex items-center justify-between animate-in fade-in"><div className="flex items-center gap-2 text-indigo-800 font-medium text-sm"><Filter className="w-4 h-4" /> Isolating Inventory for Project Site: <strong className="font-black">{pivotSiteName || `SITE-${siteFilter}`}</strong></div><button onClick={() => { setSiteFilter(null); navigate(".", { replace: true, state: {} }); }} className="px-3 py-1 bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-100 rounded text-xs font-bold transition-colors">Clear Filter (View Global)</button></div>
          )}

          {showBulkWizard && <BulkImportWizard sitesList={editableSites} suppliersList={suppliersList} onComplete={() => { setShowBulkWizard(false); fetchData(); window.dispatchEvent(new Event("inventoryUpdated")); }} onCancel={() => setShowBulkWizard(false)} />}

          {showAddForm && (
            <div className="bg-white p-6 rounded-xl border border-emerald-200 shadow-sm animate-in slide-in-from-top-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-neutral-100">
                <div><h3 className="text-base font-bold text-neutral-900">Register Material Baseline</h3><p className="text-xs text-neutral-500">Set physical starting stock and alert thresholds for your site ledger.</p></div>
                <div className="flex gap-2"><button onClick={() => setItemType("consumable")} className={`px-4 py-2 rounded-lg font-bold text-sm border-2 ${itemType === "consumable" ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-transparent text-neutral-500 hover:bg-neutral-50"}`}>Materials & Consumables</button><button onClick={() => setItemType("asset")} className={`px-4 py-2 rounded-lg font-bold text-sm border-2 ${itemType === "asset" ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-transparent text-neutral-500 hover:bg-neutral-50"}`}>Tools & Assets</button></div>
              </div>
              <form onSubmit={handleAddInventory} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div><label className="block text-xs font-bold text-neutral-500 mb-1">Project Site</label><select className="w-full p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-medium" value={newItem.site_id} onChange={(e) => setNewItem({ ...newItem, site_id: e.target.value })} required><option value="">Select Managed Site...</option>{editableSites.map((s) => (<option key={s.id} value={s.id}>{s.site_name}</option>))}</select></div>
                <div><label className="block text-xs font-bold text-neutral-500 mb-1">{itemType === "consumable" ? "Master Item Name" : "Tool Name"}</label><input type="text" list="catalog-items" className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-medium" placeholder="Search master catalog..." value={newItem.item_name} onChange={(e) => handleSmartCatalogSelect(e.target.value)} required /><datalist id="catalog-items">{MASTER_CATALOG.map(c => <option key={c.sku} value={c.name}>{c.sku}: {c.brand}</option>)}</datalist></div>
                <div><label className="block text-xs font-bold text-neutral-500 mb-1">Brand/Spec</label><input type="text" className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="e.g. Republic" value={newItem.brand} onChange={(e) => setNewItem({ ...newItem, brand: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="block text-xs font-bold text-neutral-500 mb-1">Quantity (100%)</label><input type="number" placeholder="0" className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-bold" value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value === "" ? "" : Number(e.target.value) })} required /></div>
                  <div><label className="block text-xs font-bold text-neutral-500 mb-1">Unit</label><select className="w-full p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-medium" value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}>{itemType === "consumable" ? (<><option value="Bags">Bags</option><option value="Pcs">Pcs</option><option value="Kilos">Kilos</option><option value="Linear Ft">Linear Ft</option><option value="Cu.m">Cu.m</option></>) : (<><option value="Unit">Unit</option><option value="Set">Set</option></>)}</select></div>
                </div>
                <button type="submit" className="bg-slate-900 text-white py-2 rounded-lg font-bold hover:bg-slate-800 transition-colors w-full h-full max-h-[38px] flex items-center justify-center">Register Baseline</button>
              </form>
            </div>
          )}

          <div className="flex gap-2 mb-4 overflow-x-auto pb-2 mt-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-neutral-200/50 rounded-full text-xs font-bold text-neutral-500 mr-2"><Filter className="w-3 h-3" /> Filters</div>
            {["All", "Critical", "Low Stock", "In Stock", "Surplus", "Sufficient", "Out of Stock", "Fully Utilized"].map((f) => (
              <button key={f} onClick={() => setStatusFilter(f)} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${statusFilter === f ? "bg-slate-800 text-white shadow-md" : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}>{f}</button>
            ))}
          </div>

          <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-200">
                  <tr>
                    {isDeleteMode && (<th className="px-5 py-3 font-medium w-12 text-center"><input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-red-600 cursor-pointer" onChange={handleSelectAll} checked={sortedData.length > 0 && selectedIds.length === sortedData.filter((i) => currentUserRole !== "staff" || sitesList.find((s) => s.id === i.site_id)?.manager_id === currentUserId).length} /></th>)}
                    <th className="px-5 py-3 font-medium">Item & Brand</th>
                    <th className="px-5 py-3 font-medium">Location</th>
                    <th className="px-5 py-3 font-medium text-right w-48">Current Stock</th>
                    <th className="px-5 py-3 font-medium text-center">Status</th>
                    <th className="px-5 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {sortedData.length > 0 ? (
                    sortedData.map((item) => {
                      const itemSite = sitesList.find((s) => s.id === item.site_id);
                      const canEdit = currentUserRole !== "staff" || (itemSite && itemSite.manager_id === currentUserId);
                      const isCriticalOrLow = item.status === "Critical" || item.status === "Low Stock";
                      const isAsset = item.unit === "Unit" || item.unit === "Set";
                      const progressPercent = item.baseline_quantity > 0 ? Math.min(100, Math.max(0, (item.quantity / item.baseline_quantity) * 100)) : 0;
                      const isDepleted = item.status === 'Fully Utilized' || item.status === 'Out of Stock' || item.status === 'Depleted';

                      return (
                        <tr key={item.id} className={`hover:bg-neutral-50/50 transition-colors ${selectedIds.includes(item.id) ? "bg-red-50/30" : ""} ${!canEdit && isDeleteMode ? "opacity-50 bg-neutral-50" : ""}`}>
                          {isDeleteMode && (<td className="px-5 py-4 text-center">{canEdit ? (<input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-red-600 cursor-pointer" checked={selectedIds.includes(item.id)} onChange={() => handleSelectItem(item.id)} />) : ( <Lock className="w-4 h-4 text-neutral-300 mx-auto" /> )}</td>)}
                          <td className="px-5 py-4 text-neutral-900"><div className="font-bold text-sm">{item.item_name}</div><div className="text-xs text-neutral-500">{item.brand}</div></td>
                          <td className="px-5 py-4 text-neutral-600 font-medium">{item.siteName}</td>
                          <td className="px-5 py-4 w-48">
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex items-center gap-2">
                                {isCriticalOrLow && <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" />}
                                <span className={`text-base font-bold ${isDepleted ? 'text-neutral-400 line-through' : 'text-neutral-900'}`}>{item.quantity} <span className="text-neutral-400 font-normal text-xs">/ {item.baseline_quantity} {item.unit}</span></span>
                              </div>
                              {!isAsset && (<div className="w-full bg-neutral-200 rounded-full h-1.5 mt-1 overflow-hidden"><div className={`h-1.5 rounded-full ${progressPercent <= 10 ? 'bg-red-500' : progressPercent <= 30 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${progressPercent}%` }}></div></div>)}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-center"><span className={`inline-flex px-2.5 py-1 rounded border text-[10px] font-bold uppercase tracking-wider ${getStatusColor(item.status)}`}>{item.status}</span></td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex justify-end gap-1">
                              {canEdit ? (
                                <>
                                  <button onClick={() => { setActiveTransactionItem(item); setModalType("IN"); }} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title={isAsset ? "Mark as Available" : "Restock Delivery Intake"}><ArrowDownToLine className="w-4 h-4" /></button>
                                  <button onClick={() => { setActiveTransactionItem(item); setModalType("OUT"); }} className="p-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors" title={isAsset ? "Mark as In Use" : "Log Field Consumption"}><ArrowUpFromLine className="w-4 h-4" /></button>
                                  
                                  {/* PM ONLY: Restock Request Button */}
                                  {currentUserRole === "staff" && isCriticalOrLow && !isAsset && !isDeleteMode && (
                                    <button onClick={() => { setRequestItem(item); setRequestQty(Math.max(1, item.baseline_quantity - item.quantity)); setShowRequestModal(true); }} className="p-2 ml-1 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold border border-amber-200 shadow-sm" title="Send Replenishment Request to Admin"><ShoppingCart className="w-4 h-4" /> Restock</button>
                                  )}

                                  {/* EVERYONE (Admin & PM): Lifecycle Flag Button */}
                                  {!isAsset && !isDeleteMode && (
                                    <button onClick={() => { setActiveTransactionItem(item); setModalType("LIFECYCLE"); }} className="p-2 ml-1 text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 rounded-lg transition-colors" title="Manage Status Lifecycle"><Flag className="w-4 h-4" /></button>
                                  )}
                                  
                                  {/* ADMIN ONLY: AI Advisor & Network Transfer */}
                                  {currentUserRole !== "staff" && !isDeleteMode && (
                                    <>
                                      <button onClick={() => handleSmartRestock(item)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold" title="Logistics Advisor"><Sparkles className="w-4 h-4" /></button>
                                      <button onClick={() => { setActiveTransactionItem(item); setModalType("TRANSFER"); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Dispatch Site Transfer"><Send className="w-4 h-4" /></button>
                                    </>
                                  )}
                                </>
                              ) : ( <button disabled className="p-2 text-neutral-300 rounded-lg cursor-not-allowed" title="Read Only"><Lock className="w-4 h-4" /></button> )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (<tr><td colSpan={isDeleteMode ? 7 : 6} className="px-5 py-12 text-center text-neutral-500 bg-neutral-50/50 font-medium">No inventory matches your current scope.</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- INCOMING INTERNAL TRANSFERS --- */}
      {activeTab === "incoming" && (
        <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden animate-in slide-in-from-bottom-4">
          <div className="px-6 py-5 border-b border-neutral-200 bg-blue-50 flex items-center justify-between">
            <div className="flex items-center gap-3"><Truck className="w-5 h-5 text-blue-600" /><h2 className="font-semibold text-blue-900">Pending Internal Deliveries</h2></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-200"><tr><th className="px-5 py-3 font-medium">Tracking ID</th><th className="px-5 py-3 font-medium">Material</th><th className="px-5 py-3 font-medium">Route (Origin → Destination)</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 font-medium text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-neutral-100">
                {incomingTransfers.length > 0 ? (
                  incomingTransfers.map((transfer) => {
                    const sourceSite = sitesList.find((s) => s.id === transfer.source_site_id); const destSite = sitesList.find((s) => s.id === transfer.destination_site_id);
                    return (
                      <tr key={transfer.id} className="hover:bg-neutral-50/50 transition-colors">
                        <td className="px-5 py-4 text-neutral-500 font-mono text-xs font-bold">TRK-{transfer.id.toString().padStart(4, "0")}</td>
                        <td className="px-5 py-4"><div className="font-bold text-neutral-900">{transfer.item_name}</div><div className="text-xs text-neutral-500 font-medium mt-0.5">Qty: {transfer.quantity} {transfer.unit}</div></td>
                        <td className="px-5 py-4"><div className="flex flex-col gap-1 text-xs"><span className="flex items-center gap-1 font-medium text-slate-700"><Building2 className="w-3 h-3 text-slate-400" /> From: {sourceSite ? sourceSite.site_name : `Site ${transfer.source_site_id}`}</span><span className="flex items-center gap-1 font-bold text-indigo-700"><MapPin className="w-3 h-3 text-indigo-400" /> To: {destSite ? destSite.site_name : `Site ${transfer.destination_site_id}`}</span></div></td>
                        <td className="px-5 py-4"><span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-bold uppercase tracking-wider animate-pulse"><Truck className="w-3 h-3" /> In Transit</span></td>
                        <td className="px-5 py-4 text-right"><div className="flex justify-end gap-2"><button onClick={() => handleCancelTransfer(transfer.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 hover:bg-red-50 text-red-600 rounded-lg text-xs font-bold transition-colors shadow-sm"><X className="w-3.5 h-3.5" /> Reject</button><button onClick={() => handleAcceptTransfer(transfer.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"><CheckCircle className="w-3.5 h-3.5" /> Accept</button></div></td>
                      </tr>
                    );
                  })
                ) : (<tr><td colSpan={5} className="px-5 py-16 text-center"><Truck className="w-12 h-12 text-neutral-300 mx-auto mb-4" /><h3 className="text-lg font-bold text-neutral-900">No Pending Deliveries</h3><p className="text-sm text-neutral-500 mt-1">Your logistics queue is currently empty.</p></td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- PROCUREMENT QUEUE --- */}
      {activeTab === "procurement" && (
        <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden animate-in slide-in-from-bottom-4">
          <div className="px-6 py-5 border-b border-neutral-200 bg-blue-50 flex items-center justify-between">
            <div><h2 className="font-semibold text-blue-900 flex items-center gap-2"><FilePlus className="w-5 h-5" /> Procurement Queue</h2><p className="text-xs text-blue-700 mt-0.5">Track external orders from suppliers and confirm physical delivery into your inventory.</p></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-200"><tr><th className="px-6 py-3 font-medium">Order ID</th><th className="px-6 py-3 font-medium">Material</th><th className="px-6 py-3 font-medium">Supplier</th><th className="px-6 py-3 font-medium text-center">Qty Ordered</th><th className="px-6 py-3 font-medium text-center">Status</th><th className="px-6 py-3 font-medium text-right">Fulfillment Action</th></tr></thead>
              <tbody className="divide-y divide-neutral-100">
                {pendingPOs.filter((po: any) => po.status !== "Received" && po.status !== "Cancelled").length > 0 ? (
                  pendingPOs.filter((po: any) => po.status !== "Received" && po.status !== "Cancelled").map((po: any) => {
                    const sup = suppliersList.find(s => s.id === po.supplier_id);
                    return (
                      <tr key={po.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-neutral-500 font-bold">PO-{String(po.id).padStart(4, '0')}</td>
                        <td className="px-6 py-4 font-bold text-neutral-900">{po.material_name}</td>
                        <td className="px-6 py-4 text-neutral-600 font-medium">{sup ? sup.name : "Unknown Vendor"}</td>
                        <td className="px-6 py-4 text-center font-bold text-emerald-700">{po.quantity}</td>
                        <td className="px-6 py-4 text-center"><span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${po.status === "Pending" ? "bg-amber-100 text-amber-700 border border-amber-200" : po.status === "Shipped" || po.status === "In-Transit" ? "bg-blue-100 text-blue-700 border border-blue-200" : "bg-slate-100 text-slate-600 border border-slate-200"}`}>{po.status}</span></td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {po.status === "Pending" && (<><button onClick={() => handleCancelPO(po.id)} className="px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-xs font-bold inline-flex items-center gap-1.5 shadow-sm"><Ban className="w-3.5 h-3.5" /> Cancel</button><button disabled className="px-3 py-1.5 bg-neutral-200 text-neutral-400 rounded-lg cursor-not-allowed text-xs font-bold inline-flex items-center gap-1.5 shadow-sm"><Clock className="w-3.5 h-3.5" /> Awaiting Shipment</button></>)}
                            {(po.status === "Shipped" || po.status === "In-Transit") && (<button onClick={() => { setReceivingPO(po); setPoRating(0); }} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-xs font-bold inline-flex items-center gap-1.5 shadow-sm animate-pulse"><CheckCircle className="w-3.5 h-3.5" /> Confirm Delivery</button>)}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (<tr><td colSpan={6} className="px-6 py-12 text-center text-neutral-400">No pending vendor orders in the procurement queue.</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- AUDIT TRAIL TAB --- */}
      {activeTab === "audit" && (
        <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden animate-in slide-in-from-bottom-4">
          <div className="px-6 py-5 border-b border-neutral-200 bg-slate-900 flex items-center gap-3"><Activity className="w-5 h-5 text-emerald-400" /><h2 className="font-semibold text-white">System Audit Trail</h2></div>
          <div className="p-0">
            {auditLogs.length > 0 ? (
              <div className="divide-y divide-neutral-100">
                {auditLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-4 p-5 hover:bg-neutral-50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center border border-emerald-200 shrink-0 text-emerald-700 font-bold">SA</div>
                    <div><p className="text-neutral-900 font-medium text-sm leading-relaxed">{log.action}</p><p className="text-xs text-neutral-400 mt-1 font-mono">{log.timestamp}</p></div>
                  </div>
                ))}
              </div>
            ) : (<div className="py-20 text-center"><History className="w-12 h-12 text-neutral-300 mx-auto mb-4" /><h3 className="text-lg font-bold text-neutral-900">No Activity Recorded</h3><p className="text-sm text-neutral-500 mt-1">Actions performed on the database will appear here chronologically.</p></div>)}
          </div>
        </div>
      )}

      {/* --- ERP: REQUEST RESTOCK MODAL (PM) --- */}
      {showRequestModal && requestItem && createPortal(
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b bg-amber-50 border-amber-100 flex justify-between items-center text-amber-900"><h2 className="text-lg font-bold flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-amber-600" /> Request Material Restock</h2><button onClick={() => setShowRequestModal(false)} className="text-amber-700 hover:text-amber-900"><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleRequestRestock} className="p-6 bg-white space-y-5">
              <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200"><p className="text-xs text-neutral-500 font-bold uppercase mb-1">Target Material</p><p className="font-bold text-neutral-900">{requestItem.item_name} <span className="font-normal text-neutral-500">({requestItem.brand})</span></p><p className="text-xs text-neutral-500 mt-1 font-medium">Site: {requestItem.siteName} • Current Stock: {requestItem.quantity} {requestItem.unit}</p></div>
              <div><label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Quantity Needed</label><div className="flex items-center gap-3"><input type="number" min="1" required value={requestQty} onChange={(e) => setRequestQty(Number(e.target.value))} className="w-full p-3 border border-neutral-300 rounded-lg text-lg font-bold text-center focus:ring-2 focus:ring-amber-500 outline-none" /><span className="font-bold text-neutral-500 bg-neutral-100 px-4 py-3 rounded-lg border border-neutral-200 shrink-0">{requestItem.unit}</span></div></div>
              <div className="pt-2"><button type="submit" className="w-full py-3 rounded-lg text-sm font-bold transition-colors text-white bg-amber-600 hover:bg-amber-700 flex justify-center items-center gap-2"><Send className="w-4 h-4"/> Submit Request to Admin</button></div>
            </form>
          </div>
        </div>, document.body
      )}

      {/* --- PM LIFECYCLE OVERRIDE MODAL --- */}
      {modalType === "LIFECYCLE" && activeTransactionItem && createPortal(
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-indigo-50 text-indigo-900"><h3 className="font-bold flex items-center gap-2 text-lg"><Flag className="w-5 h-5 text-indigo-600" /> Manage Status Lifecycle</h3><button onClick={() => setModalType(null)} className="text-indigo-400 hover:text-indigo-600"><X className="w-5 h-5"/></button></div>
            <div className="p-5 space-y-4">
              <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200"><p className="text-xs text-neutral-500 font-bold uppercase mb-1">Target Material</p><p className="font-bold text-neutral-900">{activeTransactionItem.item_name}</p><p className="text-xs text-neutral-500 mt-1">Remaining: {activeTransactionItem.quantity} / {activeTransactionItem.baseline_quantity} {activeTransactionItem.unit}</p></div>
              <div className="space-y-3 pt-2">
                <button onClick={() => handleOverrideStatus("Sufficient")} className="w-full text-left p-4 rounded-xl border border-emerald-200 bg-white hover:bg-emerald-50 transition-colors group"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform"><CheckCircle className="w-4 h-4"/></div><div><h4 className="font-bold text-emerald-900">Flag as "Sufficient" (In Stock)</h4><p className="text-xs text-neutral-500 mt-0.5">The remaining 10% is enough to finish the project. Clear low stock warnings.</p></div></div></button>
                <button onClick={() => handleOverrideStatus("Surplus")} className="w-full text-left p-4 rounded-xl border border-blue-200 bg-white hover:bg-blue-50 transition-colors group"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform"><PackageSearch className="w-4 h-4"/></div><div><h4 className="font-bold text-blue-900">Flag as "Surplus"</h4><p className="text-xs text-neutral-500 mt-0.5">We ordered more than we needed. Flag these items for potential network transfer.</p></div></div></button>
                <button onClick={() => handleOverrideStatus("Fully Utilized")} className="w-full text-left p-4 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-100 transition-colors group"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-600 group-hover:scale-110 transition-transform"><Ban className="w-4 h-4"/></div><div><h4 className="font-bold text-neutral-900">Flag as "Fully Utilized"</h4><p className="text-xs text-neutral-500 mt-0.5">Material is completely used up and no longer needed for this phase. Finalize lifecycle.</p></div></div></button>
              </div>
            </div>
          </div>
        </div>, document.body
      )}

      {/* --- STANDARD TRANSACTIONS MODAL (IN/OUT/TRANSFER) --- */}
      {(modalType === "IN" || modalType === "OUT" || modalType === "TRANSFER") && activeTransactionItem && createPortal(
          <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 animate-in fade-in">
            <div className={`bg-white rounded-xl shadow-2xl w-full overflow-hidden flex flex-col md:flex-row transition-all duration-500 ease-in-out max-h-[90vh] ${modalType === "TRANSFER" ? "max-w-5xl" : "max-w-md"}`}>
              <div className={`flex flex-col overflow-y-auto ${modalType === "TRANSFER" ? "md:w-1/3 border-r border-neutral-200" : "w-full"}`}>
                <div className={`p-4 border-b flex justify-between items-center sticky top-0 z-10 ${modalType === "IN" ? "bg-emerald-50 border-emerald-100 text-emerald-900" : modalType === "OUT" ? "bg-slate-900 border-slate-800 text-white" : "bg-blue-50 border-blue-100 text-blue-900"}`}>
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    {modalType === "IN" && <><ArrowDownToLine className="w-5 h-5" /> Log Delivery Intake</>}
                    {modalType === "OUT" && <><ArrowUpFromLine className="w-5 h-5" /> Log Field Usage</>}
                    {modalType === "TRANSFER" && <><Send className="w-5 h-5" /> Dispatch Site Transfer</>}
                  </h2>
                  <button onClick={() => setModalType(null)} className="p-1 hover:bg-black/10 rounded-md transition-colors"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleTransactionSubmit} className="p-6 space-y-5 bg-white flex-1">
                  <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                    <p className="text-xs text-neutral-500 font-bold uppercase mb-1">Target Material</p>
                    <p className="font-bold text-neutral-900">{activeTransactionItem.item_name} <span className="text-neutral-500 font-normal">({activeTransactionItem.brand})</span></p>
                    <p className="text-xs text-neutral-500 mt-1 font-medium">Current Stock: {activeTransactionItem.quantity} / {activeTransactionItem.baseline_quantity} {activeTransactionItem.unit}</p>
                  </div>
                  {modalType === "TRANSFER" && (
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase mb-2 text-blue-600">Destination Project Site</label>
                      <select required value={transactionForm.destination_site_id} onChange={(e) => setTransactionForm({ ...transactionForm, destination_site_id: e.target.value }) } className="w-full p-3 border border-blue-200 bg-blue-50 rounded-lg text-sm font-bold text-neutral-900 focus:ring-2 focus:ring-blue-500 outline-none">
                        <option value="">Select Receiving Project Site...</option>
                        {sitesList.filter((s) => s.id !== activeTransactionItem.site_id).map((site) => (
                          <option key={site.id} value={site.id}>{site.site_name} — {(site as any).address || "Metro Manila"} (ID: SITE-{site.id})</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Quantity {modalType === "IN" ? "Received" : modalType === "TRANSFER" ? "To Transfer" : "Consumed"}</label>
                    <div className="flex items-center gap-3">
                      <input type="number" placeholder="0" required min="1" max={modalType !== "IN" ? activeTransactionItem.quantity : undefined} value={transactionForm.quantity} onChange={(e) => setTransactionForm({ ...transactionForm, quantity: e.target.value === "" ? "" : Number(e.target.value) }) } className="w-full p-3 border border-neutral-300 rounded-lg text-lg font-bold text-center focus:ring-2 focus:ring-emerald-500 outline-none" />
                      <span className="font-bold text-neutral-500 bg-neutral-100 px-4 py-3 rounded-lg border border-neutral-200 shrink-0">{activeTransactionItem.unit}</span>
                    </div>
                  </div>
                  <div className="pt-2">
                    <button type="submit" className={`w-full py-3 rounded-lg text-sm font-bold transition-colors text-white ${modalType === "IN" ? "bg-emerald-600 hover:bg-emerald-700" : modalType === "OUT" ? "bg-slate-900 hover:bg-slate-800" : "bg-blue-600 hover:bg-blue-700"}`}>{modalType === "TRANSFER" ? "Confirm Dispatch" : `Confirm ${modalType === "IN" ? "Delivery Intake" : "Field Consumption"}`}</button>
                  </div>
                </form>
              </div>
              {modalType === "TRANSFER" && (
                <div className="hidden md:flex flex-col md:w-2/3 bg-slate-100 relative min-h-[500px]">
                  {transactionForm.destination_site_id ? (
                    (() => {
                      const sourceSite = sitesList.find((s) => s.id === activeTransactionItem.site_id);
                      const destSite = sitesList.find((s) => s.id === Number(transactionForm.destination_site_id));
                      if (!sourceSite || !destSite) return null;
                      return (
                        <>
                          <MapContainer center={[sourceSite.latitude, sourceSite.longitude]} zoom={12} className="w-full h-full z-0" zoomControl={false}>
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                            <Marker position={[sourceSite.latitude, sourceSite.longitude]} icon={sourceIcon}><Popup><strong>Origin:</strong><br />{sourceSite.site_name}</Popup></Marker>
                            <Marker position={[destSite.latitude, destSite.longitude]} icon={destIcon}><Popup><strong>Destination:</strong><br />{destSite.site_name}</Popup></Marker>
                            {transferRouteCoords.length > 0 && (
                              <><Polyline positions={transferRouteCoords} pathOptions={{ color: "#4F46E5", dashArray: "10, 10", weight: 4, opacity: 0.8 }} /><RouteFitter coords={transferRouteCoords} /></>
                            )}
                          </MapContainer>
                          <div className="absolute top-4 left-4 z-[999] bg-white/95 backdrop-blur shadow-xl border border-neutral-200 rounded-xl p-5 max-w-sm pointer-events-none">
                            <h3 className="text-blue-600 font-bold text-xs tracking-wider uppercase flex items-center gap-2 mb-3"><Navigation className="w-4 h-4" /> Live Route Telemetry</h3>
                            <div className="flex items-start gap-3 mb-4"><div className="mt-1 flex flex-col items-center"><div className="w-3 h-3 rounded-full bg-violet-500"></div><div className="w-0.5 h-6 bg-neutral-300 my-1"></div><div className="w-3 h-3 rounded-full bg-blue-500"></div></div><div><p className="text-[10px] text-neutral-500 font-bold uppercase">Origin</p><p className="text-sm font-bold text-neutral-900 mb-1">{sourceSite.site_name}</p><p className="text-[10px] text-neutral-500 font-bold uppercase mt-2">Destination</p><p className="text-sm font-bold text-neutral-900">{destSite.site_name}</p></div></div>
                            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-neutral-100">
                              <div><p className="text-[10px] text-neutral-500 font-bold uppercase flex items-center gap-1"><MapPin className="w-3 h-3" /> Distance</p><p className="text-xl font-black text-neutral-800">{routeDetails.distance} <span className="text-xs font-medium text-neutral-500">km</span></p></div>
                              <div><p className="text-[10px] text-neutral-500 font-bold uppercase flex items-center gap-1"><Clock className="w-3 h-3" /> Travel Time</p><p className="text-xl font-black text-blue-600">~{routeDetails.eta} <span className="text-xs font-medium text-blue-400">mins</span></p></div>
                            </div>
                          </div>
                        </>
                      );
                    })()
                  ) : ( <div className="flex flex-col items-center justify-center h-full text-neutral-400 font-medium"><MapPin className="w-16 h-16 mb-4 opacity-20" /><p className="text-sm">Select a destination to visualize the logistics route.</p></div> )}
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}

      {/* --- ADMIN ONLY: LOGISTICS ADVISOR MODAL --- */}
      {showRestockModal && restockItem && createPortal(
          <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
              <div className="p-4 border-b bg-slate-900 border-slate-800 flex justify-between items-center text-white">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-400" /> Logistics Advisor
                </h2>
                <button onClick={() => setShowRestockModal(false)} className="p-1 hover:bg-white/10 rounded-md transition-colors"><X className="w-5 h-5" /></button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 bg-neutral-50">
                <div className="mb-6 bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <p className="text-xs text-neutral-500 font-bold uppercase tracking-wider">Target Material</p>
                    <p className="text-xl font-black text-neutral-900">{restockItem.item_name}</p>
                    <p className="text-sm text-neutral-600 mt-1 font-medium">Site: {restockItem.siteName} • Current Stock: {restockItem.quantity}</p>
                  </div>
                  <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200 w-full md:w-auto">
                    <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Target Restock Qty</label>
                    <div className="flex items-center gap-2">
                      <input type="number" min="1" value={restockQty} onChange={(e) => setRestockQty(Number(e.target.value))} className="w-24 p-2 border border-neutral-300 rounded-md text-lg font-bold text-center focus:ring-2 focus:ring-slate-900 outline-none" />
                      <span className="font-bold text-neutral-500">{restockItem.unit}</span>
                    </div>
                  </div>
                </div>

                {!hasScanned && !isRestockLoading && (
                  <div className="text-center py-8">
                    <button onClick={runAdvisorCalculation} className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-lg shadow-md transition-all flex items-center gap-2 mx-auto"><Navigation className="w-5 h-5" /> Calculate Optimal Supply Route</button>
                  </div>
                )}

                {isRestockLoading ? (
                  <div className="py-12 text-center text-slate-700 font-bold animate-pulse">Calculating logistics and procurement costs...</div>
                ) : hasScanned && restockOptions.length === 0 ? (
                  <div className="py-12 text-center text-neutral-500 font-medium bg-white rounded-xl border border-neutral-200 shadow-sm"><AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-500" />No viable surplus or external suppliers found for "{restockItem.item_name}" in the database. <br/>Please ensure you have registered suppliers for this material.</div>
                ) : hasScanned ? (
                  <div className="space-y-4">
                    {restockOptions.map((opt, index) => (
                      <div key={index} className={`p-5 rounded-xl border shadow-sm ${index === 0 ? "border-emerald-400 bg-emerald-50" : "border-neutral-200 bg-white"}`}>
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              {index === 0 && <span className="bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">Recommended Path</span>}
                              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${opt.type === "EXTERNAL_PURCHASE" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>{opt.type.replace("_", " ")}</span>
                            </div>
                            <h3 className="text-lg font-bold text-neutral-900">{opt.source_name}</h3>
                            <p className="text-sm text-neutral-600 mt-1 font-medium">{opt.recommendation_reason}</p>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Total Est. Cost</p>
                            <p className={`text-2xl font-black ${index === 0 ? "text-emerald-700" : "text-neutral-900"}`}>₱{opt.estimated_total_cost.toFixed(2)}</p>
                            <p className="text-xs text-neutral-500 mt-1 font-mono">{opt.distance_km} km away</p>
                          </div>
                        </div>
                        <div className="pt-4 border-t border-black/5 flex justify-end">
                          <button onClick={() => handleExecuteRestock(opt)} className={`px-4 py-2 rounded-lg text-sm font-bold text-white transition-colors shadow-sm ${opt.type === "EXTERNAL_PURCHASE" ? "bg-blue-600 hover:bg-blue-700" : "bg-purple-600 hover:bg-purple-700"}`}>
                            {opt.type === "EXTERNAL_PURCHASE" ? "Initiate Purchase Order" : "Request Site Transfer"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* --- PROCUREMENT RECEIVE & RATE MODAL --- */}
      {receivingPO && createPortal(
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-emerald-50 text-emerald-900">
              <h3 className="font-bold flex items-center gap-2 text-lg">
                <CheckCircle className="w-5 h-5 text-emerald-600" /> Confirm PO Delivery
              </h3>
              <button onClick={() => setReceivingPO(null)} className="text-emerald-400 hover:text-emerald-600"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={submitReceivePO} className="p-5 space-y-4">
              <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200 text-center">
                <p className="text-xs text-neutral-500 font-bold uppercase mb-1">Receiving Material</p>
                <p className="font-black text-xl text-neutral-900">{receivingPO.quantity}x {receivingPO.material_name}</p>
                <p className="text-sm text-neutral-500 mt-1 font-medium">From: {suppliersList.find(s => s.id === receivingPO.supplier_id)?.name || "Supplier"}</p>
              </div>

              <div className="pt-2 text-center">
                <label className="block text-sm font-bold text-neutral-700 mb-3">
                  Rate the quality and speed of this delivery:
                </label>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setPoRating(star)}
                      className={`p-3 rounded-xl transition-all border-2 ${
                        poRating >= star
                          ? "bg-amber-100 border-amber-400 text-amber-500 scale-110 shadow-sm"
                          : "bg-white border-neutral-200 text-neutral-300 hover:bg-neutral-50"
                      }`}
                    >
                      <Star className="w-8 h-8" fill={poRating >= star ? "currentColor" : "none"} />
                    </button>
                  ))}
                </div>
                <p className="text-xs text-neutral-500 mt-3 font-medium px-4">
                  This rating feeds into the AI Advisor to ensure we stop buying from unreliable vendors.
                </p>
              </div>

              <div className="pt-4 border-t border-neutral-100 flex gap-2">
                <button type="button" onClick={() => setReceivingPO(null)} className="flex-1 py-3 bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50 rounded-lg text-sm font-bold transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors shadow-sm">Confirm Inventory Intake</button>
              </div>
            </form>
          </div>
        </div>, document.body
      )}

    </div>
  );
}