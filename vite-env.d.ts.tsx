// Fix: Correcting process.env type definitions to avoid re-declaration errors
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      API_KEY: string;
    }
  }
}

export {};