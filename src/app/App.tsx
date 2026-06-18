import { RouterProvider } from "react-router-dom";
import { router } from "./routes";
import { Navigate } from "react-router-dom";

// ---> ADD THIS TRAFFIC COP COMPONENT <---
function RootRedirect() {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/login" replace />;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const role = payload.role?.toLowerCase() || "staff";
    
    // Project Managers hit the tactical project view, Owners hit the global Dashboard
    return role === "staff" ? <Navigate to="/projects" replace /> : <Navigate to="/dashboard" replace />;
  } catch (e) {
    return <Navigate to="/login" replace />;
  }
}


export default function App() {
  return (
    <RouterProvider router={router} />
  );
}