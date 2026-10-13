-- WhatsApp conectado: atualizações do painel local. Cada versão do painel (o pacote
-- de instalação) fica guardada aqui com a assinatura de quem publica. Os painéis
-- conectados perguntam pela ponte (whatsapp-bridge) se há versão nova, baixam o
-- pacote e conferem a assinatura antes de instalar.
--
-- Só acrescenta a tabela. O app não lê esta tabela: só a ponte (service_role).

CREATE TABLE IF NOT EXISTS public.whatsapp_panel_releases (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    version text NOT NULL UNIQUE CHECK (version ~ '^[0-9A-Za-z._-]{3,40}$'),
    -- SHA-256 do pacote (zip) e assinatura Ed25519 de "versão\nsha256" (base64).
    sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    signature text NOT NULL CHECK (char_length(signature) BETWEEN 40 AND 200),
    size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1000 AND 10000000),
    notes text CHECK (notes IS NULL OR char_length(notes) <= 1000),
    package_base64 text NOT NULL CHECK (char_length(package_base64) BETWEEN 1000 AND 14000000),
    -- Versão com problema: desligar faz os painéis voltarem a ver a anterior.
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_panel_releases ENABLE ROW LEVEL SECURITY;
-- Sem políticas: ninguém do app lê; a ponte usa service_role.
REVOKE ALL ON public.whatsapp_panel_releases FROM anon, authenticated;
GRANT SELECT ON public.whatsapp_panel_releases TO service_role;
