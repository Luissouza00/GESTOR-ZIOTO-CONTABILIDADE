-- =============================================================================
-- ZGESTOR - SISTEMA DE GESTÃO CONTÁBIL
-- Script Completo de Banco de Dados PostgreSQL + Políticas de Segurança (RLS)
-- Compatível com Supabase (SQL Editor)
-- Versão: 2.0 (Produção com Portal do Cliente, Múltiplos PIX e RLS Isolado)
-- =============================================================================

-- Habilitar extensão para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. TABELA DE EMPRESAS (CLIENTES DO ESCRITÓRIO)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.empresas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo_interno TEXT,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT UNIQUE NOT NULL,
  regime_tributario TEXT NOT NULL CHECK (regime_tributario IN ('Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI', 'Imune/Isenta')),
  inscricao_estadual TEXT,
  inscricao_municipal TEXT,
  responsavel_legal TEXT,
  telefone TEXT,
  email TEXT,
  status TEXT NOT NULL CHECK (status IN ('ATIVA', 'EM_ONBOARDING', 'SUSPENSA', 'BAIXADA')) DEFAULT 'EM_ONBOARDING',
  valor_honorario_padrao NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  dia_vencimento_honorario INTEGER NOT NULL DEFAULT 10 CHECK (dia_vencimento_honorario BETWEEN 1 AND 31),
  possui_funcionarios BOOLEAN NOT NULL DEFAULT TRUE,
  competencia_inicial TEXT NOT NULL DEFAULT '01/2026',
  validade_certificado DATE,
  canal_pagamento_padrao TEXT NOT NULL DEFAULT 'PIX_PRINCIPAL',
  data_entrada DATE NOT NULL DEFAULT CURRENT_DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 2. TABELA DE PERFIS DE USUÁRIOS (Vinculada ao Supabase Auth)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  cargo TEXT NOT NULL CHECK (cargo IN ('ADMIN', 'COLABORADOR', 'CLIENTE')) DEFAULT 'COLABORADOR',
  departamento TEXT NOT NULL CHECK (departamento IN ('TODOS', 'FISCAL', 'CONTABIL', 'PESSOAL', 'FINANCEIRO', 'SOCIETARIO', 'CLIENTE')) DEFAULT 'FISCAL',
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  permissoes JSONB,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Funções auxiliares de segurança para RLS (Security Definer)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND cargo = 'ADMIN' AND ativo = TRUE
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_client()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND cargo = 'CLIENTE' AND ativo = TRUE
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.client_empresa_id()
RETURNS UUID AS $$
  SELECT empresa_id FROM public.profiles
  WHERE id = auth.uid() AND cargo = 'CLIENTE' AND ativo = TRUE
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.user_department()
RETURNS TEXT AS $$
  SELECT departamento FROM public.profiles
  WHERE id = auth.uid() AND ativo = TRUE
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================================================
-- 3. TABELA DE DADOS DO PRÓPRIO ESCRITÓRIO E CONTAS PIX
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.escritorio_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  crc TEXT,
  endereco TEXT,
  cidade_uf TEXT,
  telefone TEXT,
  email TEXT,
  pix_principal JSONB,
  pix_secundario JSONB,
  pix_autonomo JSONB,
  api_integra_contador JSONB,
  qrcode_img TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 4. TABELA DE ONBOARDING DE NOVOS CLIENTES (CHECKLIST)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.onboarding_itens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  etapa TEXT NOT NULL CHECK (etapa IN ('DOCUMENTACAO', 'CERTIFICADO_PROCURACOES', 'CADASTRO_SISTEMAS', 'REUNIAO_ALINHAMENTO')),
  titulo TEXT NOT NULL,
  descricao TEXT,
  departamento TEXT NOT NULL CHECK (departamento IN ('FISCAL', 'CONTABIL', 'PESSOAL', 'FINANCEIRO', 'SOCIETARIO')),
  obrigatorio BOOLEAN NOT NULL DEFAULT TRUE,
  concluido BOOLEAN NOT NULL DEFAULT FALSE,
  data_conclusao DATE,
  responsavel_nome TEXT,
  observacao TEXT,
  ordem INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 5. MODELOS E TAREFAS MENSAIS / FECHAMENTOS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.modelos_tarefas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  departamento TEXT NOT NULL CHECK (departamento IN ('FISCAL', 'CONTABIL', 'PESSOAL', 'FINANCEIRO', 'SOCIETARIO')),
  regimes_aplicaveis TEXT[] NOT NULL DEFAULT ARRAY['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI', 'Imune/Isenta'],
  dia_prazo_padrao INTEGER NOT NULL CHECK (dia_prazo_padrao BETWEEN 1 AND 31),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tarefas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  competencia TEXT NOT NULL, -- MM/AAAA
  departamento TEXT NOT NULL CHECK (departamento IN ('FISCAL', 'CONTABIL', 'PESSOAL', 'FINANCEIRO', 'SOCIETARIO')),
  tipo TEXT NOT NULL CHECK (tipo IN ('MENSAL', 'AVULSA')) DEFAULT 'MENSAL',
  origem TEXT NOT NULL DEFAULT 'INTERNO', -- 'INTERNO' | 'PORTAL_CLIENTE'
  titulo TEXT NOT NULL,
  descricao TEXT,
  solicitante TEXT,
  prazo_entrega DATE NOT NULL,
  data_entrega DATE,
  status TEXT NOT NULL CHECK (status IN ('PENDENTE', 'EM_ANDAMENTO', 'ENTREGUE_NO_PRAZO', 'ENTREGUE_COM_ATRASO')) DEFAULT 'PENDENTE',
  responsavel_nome TEXT,
  protocolo_observacao TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.guias_impostos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  competencia TEXT NOT NULL,
  tipo_guia TEXT NOT NULL,
  departamento TEXT NOT NULL DEFAULT 'FISCAL',
  data_vencimento DATE NOT NULL,
  valor NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  status_envio TEXT NOT NULL CHECK (status_envio IN ('PENDENTE_GERACAO', 'GERADA_AGUARDANDO_ENVIO', 'ENVIADA_CLIENTE', 'VISUALIZADA_CLIENTE')) DEFAULT 'PENDENTE_GERACAO',
  data_geracao DATE,
  data_envio DATE,
  canal_envio TEXT,
  responsavel_nome TEXT,
  visualizado_em TEXT,
  visualizado_por TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 6. PARCELAMENTOS E GUIAS DE PARCELAMENTOS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.parcelamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente_avulso BOOLEAN NOT NULL DEFAULT FALSE,
  nome_cliente TEXT,
  documento TEXT,
  orgao TEXT NOT NULL,
  modalidade TEXT NOT NULL,
  numero_processo TEXT,
  total_parcelas INTEGER NOT NULL CHECK (total_parcelas > 0),
  parcelas_pagas INTEGER NOT NULL DEFAULT 0 CHECK (parcelas_pagas >= 0),
  valor_consolidado NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  valor_parcela_estimado NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  dia_vencimento INTEGER NOT NULL DEFAULT 28 CHECK (dia_vencimento BETWEEN 1 AND 31),
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL CHECK (status IN ('ATIVO', 'EM_ATRASO', 'ENCERRADO_FALTA_PAGAMENTO', 'ENCERRADO_OPCAO')) DEFAULT 'ATIVO',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.parcelamento_guias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parcelamento_id UUID NOT NULL REFERENCES public.parcelamentos(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  competencia TEXT NOT NULL,
  numero_parcela INTEGER NOT NULL,
  data_vencimento DATE NOT NULL,
  valor_guia NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  status_guia TEXT NOT NULL CHECK (status_guia IN ('PENDENTE_EMISSAO', 'EMITIDA', 'ENVIADA_CLIENTE', 'VISUALIZADA_CLIENTE')) DEFAULT 'PENDENTE_EMISSAO',
  data_emissao DATE,
  data_envio_cliente DATE,
  data_pagamento DATE,
  responsavel_nome TEXT,
  visualizado_em TEXT,
  visualizado_por TEXT,
  observacao TEXT,
  parcelas_anteriores_abertas INTEGER NOT NULL DEFAULT 0,
  detalhe_pendencia_anterior TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (parcelamento_id, competencia)
);

-- =============================================================================
-- 7. CERTIDÕES NEGATIVAS DE DÉBITO (CNDs)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.cnds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  orgao TEXT NOT NULL,
  tipo_cnd TEXT,
  esfera TEXT NOT NULL DEFAULT 'FEDERAL',
  situacao TEXT NOT NULL CHECK (situacao IN ('NEGATIVA', 'POSITIVA_EFEITO_NEGATIVA', 'POSITIVA_COM_PENDENCIA')) DEFAULT 'NEGATIVA',
  numero_controle TEXT,
  codigo_controle TEXT,
  arquivo_pdf_nome TEXT,
  arquivo_pdf_base64 TEXT,
  origem_emissao TEXT NOT NULL DEFAULT 'MANUAL',
  data_emissao DATE,
  data_vencimento DATE,
  responsavel_nome TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 8. PORTAL DO CLIENTE: ARQUIVOS E CENTRAL DE ATENDIMENTO
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.portal_arquivos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  pasta TEXT NOT NULL CHECK (pasta IN ('CONSTITUTIVOS', 'GUIAS_IMPOSTOS', 'PARCELAMENTOS', 'CNDS', 'RELATORIOS', 'OUTROS')) DEFAULT 'CONSTITUTIVOS',
  titulo TEXT NOT NULL,
  nome_arquivo TEXT NOT NULL,
  tamanho TEXT,
  competencia TEXT NOT NULL DEFAULT 'Permanente',
  data_upload DATE NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento DATE,
  valor NUMERIC(12, 2) DEFAULT 0.00,
  enviado_por TEXT,
  observacoes TEXT,
  conteudo_url TEXT,
  conteudo_base64 TEXT,
  visualizado BOOLEAN NOT NULL DEFAULT FALSE,
  cliente_confirmou_leitura BOOLEAN NOT NULL DEFAULT FALSE,
  data_visualizacao TIMESTAMPTZ,
  visualizado_em_fmt TEXT,
  visualizado_por TEXT,
  status_leitura TEXT NOT NULL DEFAULT 'PENDENTE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.central_cliente_registros (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  data_registro DATE NOT NULL DEFAULT CURRENT_DATE,
  categoria TEXT NOT NULL CHECK (categoria IN ('SOLICITACAO', 'DOCUMENTO', 'COMUNICADO', 'REUNIAO', 'SOCIETARIO')) DEFAULT 'SOLICITACAO',
  titulo TEXT NOT NULL,
  descricao TEXT,
  departamento TEXT NOT NULL DEFAULT 'CONTABIL',
  solicitante_cliente TEXT,
  prazo_desejado DATE,
  responsavel_nome TEXT,
  canal TEXT NOT NULL DEFAULT 'Portal do Cliente',
  status TEXT NOT NULL CHECK (status IN ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO')) DEFAULT 'PENDENTE',
  resposta_contabilidade TEXT,
  tarefa_vinculada_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 9. HONORÁRIOS MENSAIS E PAGAMENTOS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.honorarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  competencia TEXT NOT NULL, -- MM/AAAA
  data_vencimento DATE NOT NULL,
  valor_mensal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  saldo_anterior NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  competencia_saldo_anterior TEXT,
  servicos_extras NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  desconto NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  valor_pago NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  saldo_aberto NUMERIC(12, 2) GENERATED ALWAYS AS (GREATEST((valor_mensal + saldo_anterior + servicos_extras - desconto) - valor_pago, 0)) STORED,
  status TEXT NOT NULL CHECK (status IN ('ABERTO', 'PARCIAL', 'PAGO', 'ATRASADO')) DEFAULT 'ABERTO',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (empresa_id, competencia)
);

CREATE TABLE IF NOT EXISTS public.honorario_pagamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  honorario_id UUID NOT NULL REFERENCES public.honorarios(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  data_pagamento DATE NOT NULL DEFAULT CURRENT_DATE,
  valor NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
  forma_pagamento TEXT NOT NULL CHECK (forma_pagamento IN ('PIX', 'Boleto', 'Transferência', 'Dinheiro', 'Cartão')) DEFAULT 'PIX',
  conta_destino TEXT NOT NULL DEFAULT 'Conta PJ Principal (Itaú)',
  observacao TEXT,
  registrado_por TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 10. CONVITES DE ACESSO (SEGURANÇA POR HASH)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.convites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_hash TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('COLABORADOR', 'CLIENTE')) DEFAULT 'COLABORADOR',
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  cargo TEXT NOT NULL,
  departamento TEXT NOT NULL,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  permissoes JSONB,
  status TEXT NOT NULL CHECK (status IN ('PENDENTE', 'ACEITO', 'REVOGADO')) DEFAULT 'PENDENTE',
  criado_por TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expira_em TIMESTAMPTZ NOT NULL,
  aceito_em TIMESTAMPTZ
);

-- =============================================================================
-- 11. AUDITORIA E LOGS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_nome TEXT NOT NULL,
  usuario_cargo TEXT NOT NULL,
  acao TEXT NOT NULL,
  modulo TEXT NOT NULL,
  detalhes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 12. POLÍTICAS DE ROW LEVEL SECURITY (RLS)
-- =============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escritorio_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modelos_tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guias_impostos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcelamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcelamento_guias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cnds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_arquivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.central_cliente_registros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.honorarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.honorario_pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 12.1. Perfis
CREATE POLICY "Leitura de perfis autenticados" ON public.profiles
  FOR SELECT TO authenticated USING (
    public.is_admin() OR id = auth.uid() OR NOT public.is_client()
  );

CREATE POLICY "Gestão de perfis restrita ao Admin" ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 12.2. Empresas
CREATE POLICY "Visualização de empresas" ON public.empresas
  FOR SELECT TO authenticated USING (
    public.is_admin() OR
    (public.is_client() AND id = public.client_empresa_id()) OR
    (NOT public.is_client())
  );

CREATE POLICY "Gerenciar empresas apenas equipe autorizada" ON public.empresas
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.user_department() IN ('TODOS', 'SOCIETARIO', 'ADMIN'))
  WITH CHECK (public.is_admin() OR public.user_department() IN ('TODOS', 'SOCIETARIO', 'ADMIN'));

-- 12.3. Portal de Arquivos (Isolamento total por cliente)
CREATE POLICY "Visualizar arquivos do portal" ON public.portal_arquivos
  FOR SELECT TO authenticated USING (
    public.is_admin() OR
    (public.is_client() AND empresa_id = public.client_empresa_id()) OR
    (NOT public.is_client())
  );

CREATE POLICY "Gerenciar arquivos do portal equipe ou cliente em sua pasta" ON public.portal_arquivos
  FOR ALL TO authenticated
  USING (
    public.is_admin() OR
    (NOT public.is_client()) OR
    (public.is_client() AND empresa_id = public.client_empresa_id())
  )
  WITH CHECK (
    public.is_admin() OR
    (NOT public.is_client()) OR
    (public.is_client() AND empresa_id = public.client_empresa_id())
  );

-- 12.4. Central do Cliente (Chamados)
CREATE POLICY "Visualizar solicitações da central" ON public.central_cliente_registros
  FOR SELECT TO authenticated USING (
    public.is_admin() OR
    (public.is_client() AND empresa_id = public.client_empresa_id()) OR
    (NOT public.is_client())
  );

CREATE POLICY "Criar e responder solicitações da central" ON public.central_cliente_registros
  FOR ALL TO authenticated
  USING (
    public.is_admin() OR
    (public.is_client() AND empresa_id = public.client_empresa_id()) OR
    (NOT public.is_client())
  )
  WITH CHECK (
    public.is_admin() OR
    (public.is_client() AND empresa_id = public.client_empresa_id()) OR
    (NOT public.is_client())
  );

-- 12.5. Honorários e Pagamentos (Apenas ADMIN e FINANCEIRO - Cliente bloqueado)
CREATE POLICY "Acesso restrito honorarios" ON public.honorarios
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.user_department() IN ('TODOS', 'FINANCEIRO'))
  WITH CHECK (public.is_admin() OR public.user_department() IN ('TODOS', 'FINANCEIRO'));

CREATE POLICY "Acesso restrito pagamentos honorarios" ON public.honorario_pagamentos
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.user_department() IN ('TODOS', 'FINANCEIRO'))
  WITH CHECK (public.is_admin() OR public.user_department() IN ('TODOS', 'FINANCEIRO'));

-- 12.6. Guias de Impostos e CNDs (Cliente vê apenas da sua empresa)
CREATE POLICY "Visualizar guias de impostos" ON public.guias_impostos
  FOR SELECT TO authenticated USING (
    public.is_admin() OR
    (public.is_client() AND empresa_id = public.client_empresa_id()) OR
    (NOT public.is_client())
  );

CREATE POLICY "Visualizar CNDs" ON public.cnds
  FOR SELECT TO authenticated USING (
    public.is_admin() OR
    (public.is_client() AND empresa_id = public.client_empresa_id()) OR
    (NOT public.is_client())
  );

-- 12.7. Logs de Auditoria
CREATE POLICY "Registrar logs de auditoria" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Visualizar logs apenas Administrador" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.is_admin());

-- =============================================================================
-- 13. SINCRONIZAÇÃO EM NUVEM MULTI-DISPOSITIVO ZGESTOR (JSONB + STORAGE)
-- =============================================================================
-- Tabelas flexíveis utilizadas pelo motor híbrido (dbEngine.js) para sincronizar
-- todas as coleções (empresas, tarefas, protocolos, parcelamentos, CNDs, alvarás,
-- honorários, rotinas e configurações) entre vários computadores e celulares.

CREATE TABLE IF NOT EXISTS public.zgestor_registros (
  colecao TEXT NOT NULL,
  id TEXT NOT NULL,
  dados JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (colecao, id)
);

CREATE INDEX IF NOT EXISTS idx_zgestor_registros_colecao ON public.zgestor_registros(colecao);

CREATE TABLE IF NOT EXISTS public.zgestor_config (
  chave TEXT PRIMARY KEY,
  dados JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.zgestor_registros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zgestor_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "zgestor_registros_acesso_total" ON public.zgestor_registros;
CREATE POLICY "zgestor_registros_acesso_total" ON public.zgestor_registros
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "zgestor_config_acesso_total" ON public.zgestor_config;
CREATE POLICY "zgestor_config_acesso_total" ON public.zgestor_config
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Bucket de Storage para arquivos PDF (CNDs, Alvarás, Guias, Documentos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('zgestor-documentos', 'zgestor-documentos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "zgestor_storage_leitura" ON storage.objects;
CREATE POLICY "zgestor_storage_leitura" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'zgestor-documentos');

DROP POLICY IF EXISTS "zgestor_storage_escrita" ON storage.objects;
CREATE POLICY "zgestor_storage_escrita" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'zgestor-documentos');

DROP POLICY IF EXISTS "zgestor_storage_update" ON storage.objects;
CREATE POLICY "zgestor_storage_update" ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'zgestor-documentos');
