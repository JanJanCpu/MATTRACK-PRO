import { API_ENDPOINTS } from "../config";
import type {
  ProjectSite,
  Inventory,
  Supplier,
  MaterialRequest,
  InventoryGrouped,
  ProcurementAdvice,
} from "../types";

// Error handling wrapper
async function fetchAPI<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      // This will help you debug 422 errors (validation errors)
      const errorDetail = await response.json().catch(() => ({}));
      console.error("Backend Validation Error:", errorDetail);
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("API call failed:", error);
    throw error;
  }
}

// 1. Site APIs (Matches SiteCreate schema)
export const sitesAPI = {
  // siteData must match SiteCreate: { name, lat, lon }
  create: (siteData: { name: string; lat: number; lon: number }) =>
    fetchAPI<ProjectSite>(API_ENDPOINTS.SITES_CREATE, {
      method: "POST",
      body: JSON.stringify(siteData),
    }),

  list: () => fetchAPI<ProjectSite[]>(API_ENDPOINTS.SITES_LIST),
};

// 2. Inventory APIs (Matches InventoryCreate schema)
export const inventoryAPI = {
  list: () => fetchAPI<Inventory[]>(API_ENDPOINTS.INVENTORY_LIST),

  create: (itemData: {
    item_name: string;
    quantity: number;
    unit: string;
    status: string;
    site_id: number;
  }) =>
    fetchAPI<Inventory>(API_ENDPOINTS.INVENTORY_CREATE, {
      method: "POST",
      body: JSON.stringify(itemData),
    }),

  delete: (id: number) => {
    // We strip any trailing slash from the base endpoint then add /ID
    const baseUrl = API_ENDPOINTS.INVENTORY_CREATE.replace(/\/$/, "");
    return fetchAPI<any>(`${baseUrl}/${id}`, {
      method: "DELETE",
    });
  },

  grouped: () => fetchAPI<any>(API_ENDPOINTS.INVENTORY_GROUPED),
};

// 3. Supplier APIs (Matches SupplierCreate schema)
export const suppliersAPI = {
  // supplierData should be: { name, contact, lat, lon, rating }
  create: (supplierData: {
    name: string;
    contact: string;
    lat: number;
    lon: number;
    rating: number;
  }) =>
    fetchAPI<Supplier>(API_ENDPOINTS.SUPPLIERS_CREATE, {
      method: "POST",
      body: JSON.stringify(supplierData),
    }),

  list: () => fetchAPI<Supplier[]>(API_ENDPOINTS.SUPPLIERS_LIST),
};

// 4. Advisory APIs (The "Smart Engine")
export const advisoryAPI = {
  procure: (site_id: number, item_name: string) =>
    fetchAPI<ProcurementAdvice[]>(
      API_ENDPOINTS.ADVISORY_PROCURE(site_id, item_name),
    ),
};

// 5. Material Request APIs
export const requestsAPI = {
  create: (item: Omit<MaterialRequest, "id">) =>
    fetchAPI<MaterialRequest>(API_ENDPOINTS.REQUESTS_CREATE, {
      method: "POST",
      body: JSON.stringify(item),
    }),

  list: () => fetchAPI<MaterialRequest[]>(API_ENDPOINTS.REQUESTS_LIST),
};

// 6. Health check
export const systemAPI = {
  healthCheck: () => fetchAPI(API_ENDPOINTS.HEALTH_CHECK),
};
