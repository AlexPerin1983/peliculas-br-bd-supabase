const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfig = {
    url: envUrl || 'https://avlefzsipbqvollukgyt.supabase.co',
    anonKey:
        envAnonKey ||
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2bGVmenNpcGJxdm9sbHVrZ3l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3Nzc0MjUsImV4cCI6MjA4MjM1MzQyNX0.mXiqnxe9reQNwuAjZ6yFfm1AR1Qcdib3EjXCaG9EonM'
};
