import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { Inventory } from "./components/Inventory";
import { Advisory } from "./components/Advisory";
import { LogisticsMap } from "./components/LogisticsMap";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: "inventory", Component: Inventory },
      { path: "advisory", Component: Advisory },
      { path: "logistics", Component: LogisticsMap },
      { path: "projects", Component: () => <div className="p-8 text-center text-gray-500">Projects view coming soon...</div> },
      { path: "*", Component: () => <div className="p-8 text-center text-gray-500">Page not found</div> },
    ],
  },
]);
