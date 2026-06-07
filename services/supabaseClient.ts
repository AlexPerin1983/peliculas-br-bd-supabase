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
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            // O login social (Google) volta com ?code= (fluxo PKCE). Sem isto o
            // cliente usa o padrao 'implicit' e rejeita o callback com erro de
            // mismatch, impedindo a troca do codigo por sessao (loop no login).
            flowType: 'pkce',
            // Nova storage key para invalidar tokens locais gerados antes da rotacao das chaves.
            storageKey: 'peliculas-br-bd-auth-v4',
        }
    }
);
