import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Fallback para variáveis de ambiente do sistema (Vercel)
  const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const geminiApiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  return {
    server: {
      port: 3001,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(geminiApiKey),
      'process.env.GEMINI_API_KEY': JSON.stringify(geminiApiKey),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return undefined;
            }

            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react';
            }

            if (id.includes('@supabase/supabase-js')) {
              return 'vendor-supabase';
            }

            if (id.includes('@google/generative-ai') || id.includes('tesseract.js')) {
              return 'vendor-ai';
            }

            if (id.includes('jspdf')) {
              return 'vendor-jspdf';
            }

            if (id.includes('html2canvas') || id.includes('html-to-image')) {
              return 'vendor-dom-capture';
            }

            if (id.includes('html5-qrcode') || id.includes('qrcode.react') || id.includes('qrcode')) {
              return 'vendor-qr';
            }

            if (id.includes('dexie') || id.includes('lucide-react') || id.includes('vaul')) {
              return 'vendor-utils';
            }

            return undefined;
          }
        }
      }
    },
    publicDir: 'public'
  };
});
