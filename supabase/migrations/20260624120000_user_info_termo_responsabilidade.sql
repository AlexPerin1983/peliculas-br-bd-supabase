-- Termo de Responsabilidade sobre a integridade dos vidros, exibido como seção no
-- rodapé do orçamento em PDF.
--
-- termo_responsabilidade: texto editável pela empresa nas Configurações.
--   NULL  = usa o texto padrão do app (DEFAULT_TERMO_RESPONSABILIDADE).
-- incluir_termo_responsabilidade_padrao: padrão global de inclusão do termo no PDF.
--   Pode ser sobrescrito por orçamento (campo no generalDiscount). Default: true.
--
-- IMPORTANTE: aplicar ANTES de publicar o código novo. saveUserInfo() passa a
-- gravar estas colunas; sem elas, o salvamento das Configurações falha.

alter table public.user_info
  add column if not exists termo_responsabilidade text,
  add column if not exists incluir_termo_responsabilidade_padrao boolean not null default true;
