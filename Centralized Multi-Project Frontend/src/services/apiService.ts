import type {
  ProjectSite,
  Inventory,
  Supplier,
  MaterialRequest,
  InventoryGrouped,
  ProcurementAdvice,
} from '../types';

// AUTOMATIC NETWORK ROUTING: 
// This automatically uses 'localhost' when on your PC, and your IP Address when on your phone!
const BASE_URL = `http://${window.location.hostname}:8000`;

async function fetchAPI<T>(
  endpoint: string, 
  options?: RequestInit
): Promise<T> {
  try {
    const token = localStorage.getItem("token") || localStorage.getItem("access_token");
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options?.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(endpoint, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `API Error: ${response.status} ${response.statusText}`);
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
    fetchAPI<any>(`${BASE_URL}/register`, {
      method: "POST",
      body: JSON.stringify(userData),
    }),

  logout: () => {
    localStorage.removeItem("token");
  }
};

// --- 1. SITE APIs ---
export const sitesAPI = {
  create: (siteData: { name: string; address?: string; lat: number; lon: number; manager_id: number }) =>
    fetchAPI<ProjectSite>(`${BASE_URL}/sites/`, { 
      method: 'POST',
      body: JSON.stringify(siteData),
    }),

  list: () =>
    fetchAPI<ProjectSite[]>(`${BASE_URL}/sites/`), 

  updateProgress: (id: number, stage_status: string, progress_percentage: number) =>
    fetchAPI<ProjectSite>(`${BASE_URL}/sites/${id}/progress`, {
      method: "PATCH",
      body: JSON.stringify({ stage_status, progress_percentage }),
    }),
};

// --- 2. INVENTORY APIs ---
export const inventoryAPI = {
  create: (item: Omit<Inventory, 'id'>) =>
    fetchAPI<Inventory>(`${BASE_URL}/inventory/`, { 
      method: 'POST',
      body: JSON.stringify(item),
    }),

  list: () =>
    fetchAPI<Inventory[]>(`${BASE_URL}/inventory/`), 

  grouped: () =>
    fetchAPI<InventoryGrouped>(`${BASE_URL}/inventory/grouped`),

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
    fetchAPI<any>(`${BASE_URL}/inventory/bulk-upload`, {
      method: "POST",
      body: JSON.stringify(mappedItems),
    }),
};

// --- 3. MATERIAL TRANSFER APIs ---
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

// --- 4. SUPPLIER APIs ---
export const suppliersAPI = {
  create: (data: any) =>
    fetchAPI<Supplier>(`${BASE_URL}/suppliers/`, { 
      method: 'POST',
      body: JSON.stringify({
        ...data,
        rating: Number(data.rating) 
      }),
    }),

  list: () =>
    fetchAPI<Supplier[]>(`${BASE_URL}/suppliers/`), 

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

// --- 5. ADVISORY APIs ---
export const advisoryAPI = {
  procure: (site_id: number, item_name: string) =>
    fetchAPI<ProcurementAdvice[]>(`${BASE_URL}/advisory/procure/${site_id}/${item_name}`),

  askAI: (message: string, context?: any) =>
    fetchAPI<any>(`${BASE_URL}/advisory/chat`, {
      method: "POST",
      body: JSON.stringify({ message, context }),
    }),
};

// --- 6. MATERIAL REQUEST APIs ---
export const requestsAPI = {
  create: (item: Omit<MaterialRequest, 'id'>) =>
    fetchAPI<MaterialRequest>(`${BASE_URL}/requests/`, {
      method: 'POST',
      body: JSON.stringify(item),
    }),

  list: () =>
    fetchAPI<MaterialRequest[]>(`${BASE_URL}/requests/`),
};

// --- 7. SYSTEM APIs ---
export const systemAPI = {
  healthCheck: () =>
    fetchAPI(`${BASE_URL}/`),
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

// --- 8. USER & TEAM MANAGEMENT APIs ---
export const usersAPI = {
  create: (userData: any) =>
    fetchAPI(`${BASE_URL}/register`, {
      method: 'POST',
      body: JSON.stringify(userData),
    }),

  getStaff: () =>
    fetchAPI<any[]>(`${BASE_URL}/users/managers`),
};

// --- 9. NOTIFICATIONS API ---
export const notificationsAPI = {
  listUnread: () =>
    fetchAPI<any[]>(`${BASE_URL}/notifications`),

  markAsRead: (id: number) =>
    fetchAPI(`${BASE_URL}/notifications/${id}/read`, {
      method: 'PATCH',
    }),

  markAllAsRead: () =>
    fetchAPI(`${BASE_URL}/notifications/read-all`, {
      method: 'PATCH',
    }),
};

// --- 10. SECURITY & SETTINGS API ---
export const securityAPI = {
  updatePassword: (data: any) =>
    fetchAPI(`${BASE_URL}/users/password`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getSessions: () =>
    fetchAPI<any[]>(`${BASE_URL}/users/sessions`),

  revokeOtherSessions: () =>
    fetchAPI(`${BASE_URL}/users/sessions`, {
      method: 'DELETE',
    }),

  getSecurityLogs: () =>
    fetchAPI<any[]>(`${BASE_URL}/users/security-logs`),
};