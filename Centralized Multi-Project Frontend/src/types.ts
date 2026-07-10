// API Response Types synchronized with backend models
export interface ProjectSite {
  id: number;
  site_name: string;
  address?: string;
  latitude: number;
  longitude: number;
  stage_status?: string;
  progress_percentage: number;
  manager_id?: number;
}

export interface Inventory {
  id: number;
  item_name: string;
  quantity: number;
  unit: string;
  status: string;
  site_id: number;
  brand: string;
  fsn_status: string;
  baseline_quantity?: number;
  is_locked_status?: boolean;
}

export interface Supplier {
  id: number;
  name: string;
  contact: string;
  latitude: number;
  longitude: number;
  quality_rating: number;
  categories?: string;
  address?: string;             
}

// --- ERP UPGRADED MODEL ---
export interface MaterialRequest {
  id: number;
  item_name: string;
  brand: string;
  quantity_needed: number;
  unit: string;
  site_id: number;
  inventory_id?: number;        // <-- Links to the physical shortage
  status: string;
  fulfillment_method?: string;  // <-- "Internal Transfer" | "External Purchase"
  requested_by_id?: number;
  approved_by_id?: number;
  created_at?: string;
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