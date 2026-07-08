// API Response Types synchronized with backend models
export interface ProjectSite {
  id: number;
  site_name: string;
  address?: string;             // <-- ADDED to match backend
  latitude: number;
  longitude: number;
  stage_status?: string;        // <-- ADDED to match backend
  progress_percentage: number;  // <-- ADDED to match backend
  manager_id?: number;          // <-- ADDED: Fixes the TypeScript error!
}

export interface Inventory {
  id: number;
  item_name: string;
  quantity: number;
  unit: string;
  status: string;
  site_id: number;
  brand: string;                // <-- ADDED FOR LEDGER
  fsn_status: string;           // <-- ADDED FOR LEDGER
  baseline_quantity?: number;   // <-- ADDED: For the 10% dynamic logic
  is_locked_status?: boolean;   // <-- ADDED: For the PM override logic
}

export interface Supplier {
  id: number;
  name: string;
  contact: string;
  latitude: number;
  longitude: number;
  quality_rating: number;
  categories?: string;
}

export interface MaterialRequest {
  id: number;
  item_name: string;
  brand: string;                // <-- FIX: Added this!
  quantity_needed: number;
  unit: string;                 // <-- FIX: Added this!
  site_id: number;
  status: string;
  requested_by_id?: number;     // <-- FIX: Added this!
  created_at?: string;          // <-- FIX: Added this!
}

export interface InventoryGrouped {
  [key: string]: {
    id: number;
    item: string;
    qty: number;
    unit: string;
    status: string;
  }[];
}

export interface ProcurementAdvice {
  item_name: string;
  site_id: number;
  recommendations: Array<{
    supplier: string;
    price: number;
    distance: number;
    quality: number;
  }>;
}

export interface Dashboard {
  totalSites: number;
  criticalShortages: number;
  pendingDeliveries: number;
  surplusItems: number;
}