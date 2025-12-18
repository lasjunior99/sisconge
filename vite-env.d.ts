
// Fix: Removed vite/client reference as it is not available in the current environment
// /// <reference types="vite/client" />

declare global {
  interface Window {
    XLSX: any;
    html2canvas: any;
    jspdf: any;
  }

  namespace NodeJS {
    interface ProcessEnv {
      API_KEY: string;
    }
  }
}

// Fix: Removed explicit 'process' constant declaration to avoid conflicts with existing global Node.js types.
// The augmentation within 'declare global' ensures process.env is correctly typed.

export {};
