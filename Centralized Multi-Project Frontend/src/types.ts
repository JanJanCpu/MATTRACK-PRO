// API Response Types synchronized with backend models
export interface ProjectSite {
  id: number;
  site_name: string;
  latitude: number;
  longitude: number;
}

export interface Inventory {
  id: number;
  item_name: string;
  quantity: number;
  unit: string;
  status: string;
  site_id: number;
  brand: string;      // <-- ADDED FOR LEDGER
  fsn_status: string; // <-- ADDED FOR LEDGER
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
  quantity_needed: number;
  site_id: number;
  status: string;
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