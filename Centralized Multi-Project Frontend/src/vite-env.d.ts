/// <reference types="vite/client" />

// Vite environment variables
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// CSS modules declaration
declare module '*.css' {
  const content: string;
  export default content;
}

// Leaflet CSS declaration
declare module 'leaflet/dist/leaflet.css' {
  const content: string;
  export default content;
}

// Image declarations
declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.gif' {
  const content: string;
  export default content;
}

declare module '*.webp' {
  const content: string;
  export default content;
}
