import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from './supabaseConfig';

const supabaseUrl = supabaseConfig.url;
const supabaseAnonKey = supabaseConfig.anonKey;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URL or Anon Key missing. Authentication features will not work.');
}

export const supabase = createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
        auth: {
            persistSession: true,      // Persiste a sessão no localStorage
            autoRefreshToken: true,    // Auto-refresh do token antes de expirar
            detectSessionInUrl: true,  // Detecta sessão na URL (para OAuth)
            storageKey: 'peliculas-br-auth', // Chave única para armazenamento
        }
    }
);
