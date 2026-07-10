import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./styles/index.css";

// 1. Import the virtual registration script provided by the Vite PWA plugin
import { registerSW } from "virtual:pwa-register";

// 2. Register the service worker to enable offline caching and installation
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(<App />);
