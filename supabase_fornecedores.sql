-- Criar tabela de fornecedores
CREATE TABLE IF NOT EXISTS public.fornecedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    empresa TEXT NOT NULL,
    contato TEXT,
    telefone TEXT,
    representacoes TEXT,
    email TEXT,
    endereco TEXT,
    observacao TEXT,
    criado_em TIMESTAMPTZ DEFAULT now()
);

-- Habilitar Row Level Security
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

-- Política para leitura (apenas o próprio usuário)
CREATE POLICY "Usuários podem ver seus próprios fornecedores" 
ON public.fornecedores FOR SELECT 
USING (auth.uid() = user_id);

-- Política para inserção (apenas o próprio usuário)
CREATE POLICY "Usuários podem inserir seus próprios fornecedores" 
ON public.fornecedores FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Política para atualização (apenas o próprio usuário)
CREATE POLICY "Usuários podem atualizar seus próprios fornecedores" 
ON public.fornecedores FOR UPDATE 
USING (auth.uid() = user_id);

-- Política para exclusão (apenas o próprio usuário)
CREATE POLICY "Usuários podem excluir seus próprios fornecedores" 
ON public.fornecedores FOR DELETE 
USING (auth.uid() = user_id);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_fornecedores_user_id ON public.fornecedores(user_id);
