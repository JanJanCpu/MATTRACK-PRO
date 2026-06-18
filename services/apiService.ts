import { API_ENDPOINTS } from "../Centralized Multi-Project Frontend/src/config";
import type {
  ProjectSite,
  Inventory,
  Supplier,
  MaterialRequest,
  InventoryGrouped,
  ProcurementAdvice,
} from "../Centralized Multi-Project Frontend/src/types";

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
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("API call failed:", error);
    throw error;
  }
}

// Site APIs
export const sitesAPI = {
  create: (name: string, lat: number, lon: number) =>
    fetchAPI<ProjectSite>(API_ENDPOINTS.SITES_CREATE, {
      method: "POST",
      body: JSON.stringify({ name, lat, lon }),
    }),

  list: () => fetchAPI<ProjectSite[]>(API_ENDPOINTS.SITES_LIST),
};

// Inventory APIs
export const inventoryAPI = {
  create: (item: Omit<Inventory, "id">) =>
    fetchAPI<Inventory>(API_ENDPOINTS.INVENTORY_CREATE, {
      method: "POST",
      body: JSON.stringify(item),
    }),

  list: () => fetchAPI<Inventory[]>(API_ENDPOINTS.INVENTORY_LIST),

  grouped: () => fetchAPI<InventoryGrouped>(API_ENDPOINTS.INVENTORY_GROUPED),
};

// Supplier APIs
export const suppliersAPI = {
  create: (
    name: string,
    contact: string,
    lat: number,
    lon: number,
    rating: number,
  ) =>
    fetchAPI<Supplier>(API_ENDPOINTS.SUPPLIERS_CREATE, {
      method: "POST",
      body: JSON.stringify({ name, contact, lat, lon, rating }),
    }),

  list: () => fetchAPI<Supplier[]>(API_ENDPOINTS.SUPPLIERS_LIST),
};

// Advisory APIs
export const advisoryAPI = {
  procure: (site_id: number, item_name: string) =>
    fetchAPI<ProcurementAdvice>(
      API_ENDPOINTS.ADVISORY_PROCURE(site_id, item_name),
    ),
};

// Material Request APIs
export const requestsAPI = {
  create: (item: Omit<MaterialRequest, "id">) =>
    fetchAPI<MaterialRequest>(API_ENDPOINTS.REQUESTS_CREATE, {
      method: "POST",
      body: JSON.stringify(item),
    }),

  list: () => fetchAPI<MaterialRequest[]>(API_ENDPOINTS.REQUESTS_LIST),
};

// Health check
export const systemAPI = {
  healthCheck: () => fetchAPI(API_ENDPOINTS.HEALTH_CHECK),
};
