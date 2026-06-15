import { createBrowserRouter, Navigate } from "react-router-dom";

// Note: If your editor complains about these paths, 
// change "./components/..." to "./app/components/..." based on your folder structure.
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { Inventory } from "./components/Inventory";
import { Advisory } from "./components/Advisory";
import { LogisticsMap } from "./components/LogisticsMap";
import { Projects } from "./components/Projects";
import { ProjectDetails } from "./components/ProjectDetails"; // <-- IMPORTED PROJECT DETAILS
import { Suppliers } from "./components/Suppliers";
import { Settings } from "./components/Settings";
import { Register } from "./components/Register"; 
import Login from "./components/Login"; 

// --- SECURITY WRAPPER ---
// This checks if the user has a valid token. If not, they get kicked to the login page.
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem("token");
  return token ? <>{children}</> : <Navigate to="/login" replace />;
};

export const router = createBrowserRouter([
  // --- PUBLIC ROUTES (No token required) ---
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/register", 
    element: <Register />,
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
      { path: "projects", Component: Projects },
      { path: "projects/:id", Component: ProjectDetails }, // <-- ADDED DYNAMIC ROUTE HERE
      { path: "suppliers", Component: Suppliers },
      { path: "settings", Component: Settings },
      {
        path: "*",
        Component: () => (
          <div className="p-8 text-center text-gray-500">Page not found</div>
        ),
      },
    ],
  },
]);