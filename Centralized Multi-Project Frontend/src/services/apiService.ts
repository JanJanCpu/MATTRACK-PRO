import { API_ENDPOINTS } from '../config';
import type {
  ProjectSite,
  Inventory,
  Supplier,
  MaterialRequest,
  InventoryGrouped,
  ProcurementAdvice,
} from '../types';

// Fallback base URL for the new endpoints if they aren't in config yet
const BASE_URL = "http://localhost:8000";

// Error handling & Security wrapper
async function fetchAPI<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  try {
    // --- CRITICAL RBAC FIX: Grab the JWT token from localStorage ---
    const token = localStorage.getItem("token") || localStorage.getItem("access_token");
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options?.headers as Record<string, string>) || {}),
    };

    // Inject the security token into the headers so FastAPI lets us in!
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}

// --- 0. AUTHENTICATION APIs ---
export const authAPI = {
  login: async (username: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append("username", username);
    formData.append("password", password);

    const response = await fetch(`${BASE_URL}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData,
    });
    
    if (!response.ok) throw new Error("Invalid username or password");
    const data = await response.json();
    
    localStorage.setItem("token", data.access_token);
    return data;
  },

  register: (userData: { username: string; email: string; password: string; role: string; company_name?: string }) => 
    fetchAPI<any>("/register", {
      method: "POST",
      body: JSON.stringify(userData),
    }),

  logout: () => {
    localStorage.removeItem("token");
  }
};

// Site APIs
export const sitesAPI = {
  create: (siteData: { name: string; address?: string; lat: number; lon: number; manager_id: number }) =>
    fetchAPI<ProjectSite>(API_ENDPOINTS.SITES_CREATE, {
      method: 'POST',
      body: JSON.stringify(siteData),
    }),

  list: () =>
    fetchAPI<ProjectSite[]>(API_ENDPOINTS.SITES_LIST),

  // FIXED: Added ${BASE_URL} so it hits the backend on port 8000
  updateProgress: (id: number, stage_status: string, progress_percentage: number) =>
    fetchAPI<ProjectSite>(`${BASE_URL}/sites/${id}/progress`, {
      method: "PATCH",
      body: JSON.stringify({ stage_status, progress_percentage }),
    }),
};

// Inventory APIs
export const inventoryAPI = {
  create: (item: Omit<Inventory, 'id'>) =>
    fetchAPI<Inventory>(API_ENDPOINTS.INVENTORY_CREATE, {
      method: 'POST',
      body: JSON.stringify(item),
    }),

  list: () =>
    fetchAPI<Inventory[]>(API_ENDPOINTS.INVENTORY_LIST),

  grouped: () =>
    fetchAPI<InventoryGrouped>(API_ENDPOINTS.INVENTORY_GROUPED),

  // Log Delivery / Usage
  logTransaction: (data: any) =>
    fetchAPI(`${BASE_URL}/inventory/log`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getLogs: () =>
    fetchAPI<any[]>(`${BASE_URL}/inventory/audit-logs`),

  delete: (id: number) =>
    fetchAPI(`${BASE_URL}/inventory/${id}`, {
      method: 'DELETE',
    }),

  bulkUploadMapped: async (mappedItems: any[]) =>
    fetchAPI<any>("/inventory/bulk-upload", {
      method: "POST",
      body: JSON.stringify(mappedItems),
    }),
};

// --- NEW: Material Transfer APIs (The 3-Step Handshake) ---
export const transferAPI = {
  initiate: (data: { source_site_id: number; destination_site_id: number; item_name: string; brand: string; quantity: number; unit: string; }) =>
    fetchAPI(`${BASE_URL}/transfers/initiate`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getIncoming: (site_id: number) =>
    fetchAPI<any[]>(`${BASE_URL}/transfers/incoming/${site_id}`),

  receive: (transfer_id: number) =>
    fetchAPI(`${BASE_URL}/transfers/${transfer_id}/receive`, {
      method: 'POST',
    }),
};

// Supplier APIs
export const suppliersAPI = {
  create: (data: any) =>
    fetchAPI<Supplier>(API_ENDPOINTS.SUPPLIERS_CREATE, {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        rating: Number(data.rating) 
      }),
    }),

  list: () =>
    fetchAPI<Supplier[]>(API_ENDPOINTS.SUPPLIERS_LIST),

  updateRating: (id: number, rating: number) =>
    fetchAPI<any>(`${BASE_URL}/suppliers/${id}/rating`, { 
      method: "PATCH", 
      body: JSON.stringify({ rating: Number(rating) }) 
    }),

  delete: (id: number) => 
    fetchAPI<any>(`${BASE_URL}/suppliers/${id}`, { 
      method: "DELETE" 
    }),
};

// Advisory APIs
export const advisoryAPI = {
  procure: (site_id: number, item_name: string) =>
    fetchAPI<ProcurementAdvice[]>(
      API_ENDPOINTS.ADVISORY_PROCURE(site_id, item_name)
    ),

  askAI: (message: string, context?: any) =>
    fetchAPI<any>("/advisory/chat", {
      method: "POST",
      body: JSON.stringify({ message, context }),
    }),
};

// Material Request APIs
export const requestsAPI = {
  create: (item: Omit<MaterialRequest, 'id'>) =>
    fetchAPI<MaterialRequest>(API_ENDPOINTS.REQUESTS_CREATE, {
      method: 'POST',
      body: JSON.stringify(item),
    }),

  list: () =>
    fetchAPI<MaterialRequest[]>(API_ENDPOINTS.REQUESTS_LIST),
};

// Health check
export const systemAPI = {
  healthCheck: () =>
    fetchAPI(API_ENDPOINTS.HEALTH_CHECK),
};

// --- SMART GEOCODING HELPER ---
export const geocodeAddress = async (addressText: string): Promise<{lat: number, lon: number} | null> => {
  try {
    const tryFetch = async (queryStr: string) => {
      const query = encodeURIComponent(`${queryStr}, Philippines`);
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      }
      return null;
    };

    let result = await tryFetch(addressText);
    if (result) return result;

    const parts = addressText.split(',').map(p => p.trim());
    let attempts = 0;
    
    while (parts.length > 1 && attempts < 3) {
      parts.shift(); 
      const fallbackAddress = parts.join(', ');
      
      console.log(`Fallback attempt ${attempts + 1}: ${fallbackAddress}`);
      await new Promise(r => setTimeout(r, 500));
      
      result = await tryFetch(fallbackAddress);
      if (result) return result;
      
      attempts++;
    }

    return null;
  } catch (error) {
    console.error("Geocoding failed:", error);
    return null;
  }
};

// --- NEW: User & Team Management APIs ---
export const usersAPI = {
  create: (userData: any) =>
    fetchAPI(`${BASE_URL}/register`, {
      method: 'POST',
      body: JSON.stringify(userData),
    }),

  getStaff: () =>
    fetchAPI<any[]>(`${BASE_URL}/users/managers`),
};