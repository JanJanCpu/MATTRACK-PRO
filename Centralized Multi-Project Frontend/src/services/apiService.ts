import type {
  ProjectSite,
  Inventory,
  Supplier,
  MaterialRequest,
  ProcurementAdvice,
} from "../types";

const API_BASE = "http://localhost:8000";

// --- GLOBAL FETCH WRAPPER WITH JWT SECURITY ---
async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  const token = localStorage.getItem("token");
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorDetail = await response.json().catch(() => ({}));
      console.error("Backend Error:", errorDetail);
      throw new Error(errorDetail.detail || `API Error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("API call failed:", error);
    throw error;
  }
}

// --- 0. AUTHENTICATION APIs ---
export const authAPI = {
  login: async (username: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append("username", username);
    formData.append("password", password);

    const response = await fetch(`${API_BASE}/token`, {
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

// --- 1. SITE APIs ---
export const sitesAPI = {
  list: () => fetchAPI<ProjectSite[]>("/sites/"),
  
  create: (siteData: { name: string; lat: number; lon: number }) =>
    fetchAPI<ProjectSite>("/sites/", {
      method: "POST",
      body: JSON.stringify(siteData),
    }),

  updateProgress: (id: number, stage_status: string, progress_percentage: number) =>
    fetchAPI<ProjectSite>(`/sites/${id}/progress`, {
      method: "PATCH",
      body: JSON.stringify({ stage_status, progress_percentage }),
    }),
};

// --- 2. INVENTORY & AUDIT APIs ---
export const inventoryAPI = {
  list: () => fetchAPI<Inventory[]>("/inventory/"),
  
  logTransaction: (itemData: {
    item_name: string;
    brand: string;
    quantity: number;
    unit: string;
    status: string;
    fsn_status: string;
    site_id: number;
  }) =>
    fetchAPI<any>("/inventory/log", {
      method: "POST",
      body: JSON.stringify(itemData),
    }),

  delete: (id: number) => 
    fetchAPI<any>(`/inventory/${id}`, { method: "DELETE" }),

  getLogs: () => fetchAPI<any[]>("/inventory/audit-logs"),
  
  bulkUploadMapped: async (mappedItems: any[]) =>
    fetchAPI<any>("/inventory/bulk-upload", {
      method: "POST",
      body: JSON.stringify(mappedItems),
    }),
};

// --- 3. SUPPLIER APIs (CROWDSOURCING) ---
export const suppliersAPI = {
  list: () => fetchAPI<Supplier[]>("/suppliers/"),
  
  create: (data: any) => fetchAPI<Supplier>("/suppliers/", { 
    method: "POST", 
    body: JSON.stringify(data) 
  }),
  
  updateRating: (id: number, rating: number) =>
    fetchAPI<any>(`/suppliers/${id}/rating`, { 
      method: "PATCH", 
      body: JSON.stringify({ rating }) 
    }),

  delete: (id: number) => 
    fetchAPI<any>(`/suppliers/${id}`, { 
      method: "DELETE" 
    }),
};

// --- 4. ADVISORY APIs ---
export const advisoryAPI = {
  procure: (site_id: number, item_name: string) =>
    fetchAPI<ProcurementAdvice[]>(`/advisory/procure/${site_id}/${item_name}`),

  askAI: (message: string, context?: any) =>
    fetchAPI<any>("/advisory/chat", {
      method: "POST",
      body: JSON.stringify({ message, context }),
    }),
};

// --- 5. SYSTEM APIs ---
export const systemAPI = {
  healthCheck: () => fetchAPI<any>("/"),
};

// --- 6. SMART GEOCODING HELPER (PROGRESSIVE FALLBACK) ---
export const geocodeAddress = async (addressText: string): Promise<{lat: number, lon: number} | null> => {
  try {
    // Helper function to make the API call
    const tryFetch = async (queryStr: string) => {
      const query = encodeURIComponent(`${queryStr}, Philippines`);
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      }
      return null;
    };

    // Attempt 1: Try the exact address the user typed
    let result = await tryFetch(addressText);
    if (result) return result;

    // Attempt 2+: Progressive Fallback
    // Split the address by commas. Keep removing the first chunk and retrying until it works.
    const parts = addressText.split(',').map(p => p.trim());
    
    // We limit to 3 fallback attempts so we don't spam the free API and get temporarily blocked
    let attempts = 0;
    while (parts.length > 1 && attempts < 3) {
      parts.shift(); // Remove the most specific part (e.g., "1315")
      const fallbackAddress = parts.join(', ');
      
      console.log(`Fallback attempt ${attempts + 1}: ${fallbackAddress}`);
      
      // Small 500ms delay to respect OpenStreetMap's free API rate limits
      await new Promise(r => setTimeout(r, 500));
      
      result = await tryFetch(fallbackAddress);
      if (result) return result;
      
      attempts++;
    }

    // If it strips everything away and STILL fails, tell the UI to show the alert
    return null;
  } catch (error) {
    console.error("Geocoding failed:", error);
    return null;
  }
};