// Configuration for backend API endpoints
export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000";

export const API_ENDPOINTS = {
  // Sites
  SITES_CREATE: `${API_BASE_URL}/sites/`, // Ensure trailing slash
  SITES_LIST: `${API_BASE_URL}/sites/`,

  // Inventory
  INVENTORY_CREATE: `${API_BASE_URL}/inventory/`, // Ensure trailing slash
  INVENTORY_LIST: `${API_BASE_URL}/inventory/`,
  INVENTORY_GROUPED: `${API_BASE_URL}/inventory/grouped`,

  // Suppliers
  SUPPLIERS_CREATE: `${API_BASE_URL}/suppliers`,
  SUPPLIERS_LIST: `${API_BASE_URL}/suppliers/`,

  // Advisory
  ADVISORY_PROCURE: (site_id: number, item_name: string) =>
    `${API_BASE_URL}/advisory/procure/${site_id}/${encodeURIComponent(item_name)}`,

  // Material Requests
  REQUESTS_CREATE: `${API_BASE_URL}/requests`,
  REQUESTS_LIST: `${API_BASE_URL}/requests/`,

  // System
  HEALTH_CHECK: `${API_BASE_URL}/`,
};
