import { createBrowserRouter, Navigate } from "react-router-dom";

// Note: If your editor complains about these paths,
// change "./components/..." to "./app/components/..." based on your folder structure.
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { Inventory } from "./components/Inventory";
import { Advisory } from "./components/Advisory";
import { LogisticsMap } from "./components/LogisticsMap";
import { Projects } from "./components/Projects";
import { ProjectDetails } from "./components/ProjectDetails";
import { Suppliers } from "./components/Suppliers";
import { Settings } from "./components/Settings";
import { UserManagement } from "./components/UserManagement";
import { SellerPortal } from "./components/Seller"; 
import { Login } from "./components/Login";
import { SellerOrders } from "./components/SellerOrders";

// --- MATERIAL REQUESTS PAGE IMPORT ---
import { Requests } from "./components/Requests";

// --- STANDARD BOUNCER: Checks if you are logged in at all ---
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem("token");
  return token ? <>{children}</> : <Navigate to="/login" replace />;
};

// --- VIP BOUNCER: Checks if you have the correct role ---
const RoleProtectedRoute = ({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles: string[];
}) => {
  const token = localStorage.getItem("token");

  if (!token) return <Navigate to="/login" replace />;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const userRole = payload.role ? payload.role.toLowerCase() : "staff";

    if (!allowedRoles.includes(userRole)) {
      return <Navigate to="/inventory" replace />;
    }

    return <>{children}</>;
  } catch (error) {
    return <Navigate to="/login" replace />;
  }
};

export const router = createBrowserRouter([
  // --- PUBLIC ROUTES (No token required) ---
  {
    path: "/login",
    element: <Login />,
  },

  // --- PROTECTED ROUTES (Token required) ---
  {
    path: "/",
    element: (
      <PrivateRoute>
        <Layout />
      </PrivateRoute>
    ),
    children: [
      { index: true, Component: Dashboard },
      { path: "inventory", Component: Inventory },
      { path: "advisory", Component: Advisory },
      { path: "logistics", Component: LogisticsMap },
      { path: "settings", Component: Settings },

      // --- MATERIAL REQUESTS ROUTE ---
      {
        path: "requests",
        element: (
          <RoleProtectedRoute allowedRoles={["admin", "owner", "pm", "staff"]}>
            <Requests />
          </RoleProtectedRoute>
        ),
      },

      // --- RESTRICTED ROUTES (Wrapped in the VIP Bouncer) ---
      {
        path: "projects",
        element: (
          <RoleProtectedRoute allowedRoles={["admin", "owner"]}>
            <Projects />
          </RoleProtectedRoute>
        ),
      },
      {
        path: "projects/:id",
        element: (
          <RoleProtectedRoute allowedRoles={["admin", "owner"]}>
            <ProjectDetails />
          </RoleProtectedRoute>
        ),
      },
      {
        path: "suppliers",
        element: (
          <RoleProtectedRoute allowedRoles={["admin", "owner", "staff", "pm"]}>
            <Suppliers />
          </RoleProtectedRoute>
        ),
      },
      {
        path: "team",
        element: (
          <RoleProtectedRoute allowedRoles={["admin", "owner"]}>
            <UserManagement />
          </RoleProtectedRoute>
        ),
      },

      // --- 404 FALLBACK ---
      {
        path: "*",
        Component: () => (
          <div className="p-8 text-center text-gray-500">Page not found</div>
        ),
      },
      // --- SELLER ROUTES ---
      {
        path: "seller-portal",
        element: (
          <RoleProtectedRoute allowedRoles={["seller"]}>
            <SellerPortal />
          </RoleProtectedRoute>
        ),
      },
      {
        path: "seller-orders",
        element: (
          <RoleProtectedRoute allowedRoles={["seller"]}>
            <SellerOrders />
          </RoleProtectedRoute>
        ),
      },
    ],
  },
]);