import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Importante para hospedagem estática (Netlify/Vercel)
  base: './', 
  build: {
    outDir: 'dist',
  },
});