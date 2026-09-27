-- Observações do cliente (ex.: "portão azul, falar com o Sr. João", "prefere contato à tarde").
-- Lidas e gravadas só pela ficha do cliente: o cadastro não mexe nelas.
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS notes text;
