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
  
  // 1. Get the secure token from local storage
  const token = localStorage.getItem("token");
  
  // 2. Attach headers (including Auth if token exists)
  // FIXED: Strictly typed as a string dictionary to satisfy TypeScript
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
    // FastAPI requires form-data for login, not JSON!
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
    
    // Save token to localStorage for the fetchAPI wrapper to use
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
};

// --- 2. INVENTORY & AUDIT APIs ---
export const inventoryAPI = {
  list: () => fetchAPI<Inventory[]>("/inventory/"),
  
  // Replaced .create() with the new Audit Logging Endpoint
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
  
};

// --- 3. SUPPLIER APIs (CROWDSOURCING) ---
export const suppliersAPI = {
  list: () => fetchAPI<Supplier[]>("/suppliers/"),
  
  // Includes the new optional crowdsourced data
  create: (supplierData: {
    name: string;
    contact: string;
    lat: number;
    lon: number;
    rating: number;
    material?: string;
    price?: string;
    stockLevel?: string;
  }) =>
    fetchAPI<Supplier>("/suppliers/", {
      method: "POST",
      body: JSON.stringify(supplierData),
    }),
};

// --- 4. ADVISORY APIs ---
export const advisoryAPI = {
  // Your original deterministic engine
  procure: (site_id: number, item_name: string) =>
    fetchAPI<ProcurementAdvice[]>(`/advisory/procure/${site_id}/${item_name}`),

  // The NEW AI Chatbot engine
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