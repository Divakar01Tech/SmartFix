import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

const certPath = path.resolve(__dirname, '../backend/certs/cert.pem');
const keyPath = path.resolve(__dirname, '../backend/certs/key.pem');
const hasSslCerts = false; // fs.existsSync(certPath) && fs.existsSync(keyPath);

export default defineConfig({
  plugins: [react()],
  server: {
    https: hasSslCerts
      ? {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath),
        }
      : false,
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: hasSslCerts ? 'https://localhost:5000' : 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: hasSslCerts ? 'https://localhost:5000' : 'http://localhost:5000',
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
  },
});

