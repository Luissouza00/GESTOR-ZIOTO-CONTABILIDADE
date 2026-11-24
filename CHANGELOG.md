# Changelog — ZGESTOR Contábil

Todas as atualizações notáveis deste projeto são documentadas neste arquivo.
O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/) e adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

## [1.4.0] - 2026-11-24

### Adicionado & Melhorado
- **Novo Módulo Prático de Tarefas, Rotinas e Fechamentos**:
  - **Aba Separada "Definir Rotinas"**: painel dedicado por departamento (Fiscal, Contábil, Pessoal, Societário) com switch de 1 clique (Ativa/Desativada), periodicidade (**Mensal** ou **Anual**), exigência de Inscrição Estadual e criação/edição personalizada.
  - **Barra de Progresso e Botões Rápidos de 1 Clique**: acompanhamento visual da porcentagem concluída na competência e botões diretos na linha (`Docs`, `Fazendo`, `✓ Normal`, `S/ Mov.`) para concluir normalmente ou **Sem Movimento** sem abrir modal.
  - **Fiscal por Etapas + Regra de Inscrição Estadual (I.E.)**:
    - Simples Nacional: Cobrança de Documentos → Apuração/Transmissão PGDAS-D (Normal/Sem Movimento) → Apuração ICMS (somente com I.E.) → DeSTDA (somente com I.E.).
    - Lucro Presumido e Real: Cobrança de Documentos → EFD-ICMS/IPI (somente com I.E.) → EFD-Contribuições → EFD-Reinf/DCTFWeb → IRPJ/CSLL.
  - **Contábil por Etapas + Matriz Anual + Anuais**: Cobrança de Extratos → Conciliação Bancária → Fechamento Mensal (integrado à Matriz Anual Jan–Dez) + obrigações anuais **ECD** (Junho) e **ECF** (Julho).
  - **Pessoal (DP)**: rotinas mantidas desativadas por padrão, podendo ser ativadas a qualquer momento na aba *Definir Rotinas*.
  - **Toggle Rápido de I.E. em Minhas Empresas**: botão clicável direto na tabela de empresas para marcar/informar Inscrição Estadual.

---

## [1.3.0] - 2026-11-23

### Adicionado
- **Módulo Completo de Alvarás & Licenças Operacionais**:
  - Geração automática e padronizada do **Alvará de Funcionamento** para todas as empresas da carteira do escritório.
  - Funcionalidade completa para cadastro e controle de licenças adicionais:
    - Vigilância Sanitária (VISA municipal/estadual)
    - Certificado de Registro de Petrecho de Pesca (Ministério da Pesca / IBAMA)
    - Auto de Vistoria do Corpo de Bombeiros (AVCB / CLCB)
    - Licenciamento Ambiental (CETESB / Órgãos Ambientais)
    - Outras licenças regulatórias e municipais personalizadas.
  - Painel com KPIs executivos: total de alvarás monitorados, vigentes, a vencer em 30/60 dias, vencidos e em renovação.
  - Registro de protocolo de pedido de renovação (atribui automaticamente status "Em Renovação" resguardando o cliente perante fiscalizações).
  - Anexo de documentos (PDF e imagens até 15MB) com download e visualização direta.
  - Filtros avançados por empresa, tipo de licença, status de validade e busca textual.
- **Suporte Multi-Provedor de Inteligência Artificial (OpenAI ChatGPT + Google Gemini)**:
  - Adição de integração nativa com a **OpenAI API (ChatGPT)** permitindo vincular chave de API (`sk-...`) e selecionar modelos (`gpt-4o-mini`, `gpt-4o`, `gpt-3.5-turbo`).
  - Botão de teste de conexão em tempo real diretamente com os servidores da OpenAI.
  - Seletor de provedor preferencial ativo (Google Gemini ou OpenAI) com fallback automático e inteligência tributária nativa offline.
- **Saneamento e Limpeza da Base de Usuários**:
  - Remoção definitiva de todos os usuários fictícios de demonstração antigos (`contador@...`, `fiscal@...`, `dp@...`, etc.).
  - Preservação estrita e exclusiva do usuário real validado: **Luis Filipe (Zioto Contabilidade) - `ziotocont.luisf@gmail.com`** com privilégios de Administrador Master.

---

## [1.2.0] - 2026-11-23

### Adicionado
- **Aba Exclusiva de Inteligência Artificial (Assistente IA Contábil)**:
  - Módulo completo no menu lateral com vinculação e teste de chave de API (Google Gemini).
  - Diagnóstico executivo automatizado da competência (auditoria de pendências fiscais, CNDs a vencer e honorários em aberto).
  - Consultor Tributário & Fiscal (chat interativo especializado em Simples Nacional, Lucro Presumido, DCTFWeb, EFD-Reinf e FGTS Digital).
  - Gerador inteligente de comunicados para WhatsApp e E-mail (cobrança amigável, aviso de impostos e solicitação de documentos).
  - Assistente para redação técnica de respostas a chamados do Portal do Cliente.
- **Validação Rigorosa de E-mails**:
  - Implementação de validação profunda de formato e domínio de e-mail real (RFC 5322) tanto na interface quanto na camada do banco de dados (`dbEngine`).
  - Bloqueio imediato de e-mails inválidos, incompletos ou fictícios (validado e testado com `ziotocont.luisf@gmail.com`).
- **Padronização de Versionamento Visual**:
  - Exibição da versão oficial `v1.2.0` no rodapé da barra lateral e na tela de login.
  - Atualização do Service Worker para `zgestor-pwa-v1.2.0` garantindo atualização imediata nos celulares.

---

## [1.1.0] - 2026-11-15

### Adicionado
- **Otimização Mobile & PWA Instalável**:
  - Configuração do manifesto do aplicativo (`manifest.json`), Service Worker (`sw.js`) e meta tags para instalação nativa no Android e iOS.
  - Menu responsivo em gaveta deslizante (Drawer) acionado por botão hambúrguer nos cabeçalhos.
  - Rolagem horizontal fluida (`overflow-x-auto`) em todas as tabelas (Empresas, Tarefas, Parcelamentos, CNDs, Honorários e Portal).
  - Modais com redimensionamento dinâmico (`max-h-[92vh]`) e botões otimizados para toque.
- **Padronização de Uploads Multi-Formato**:
  - Suporte formal a arquivos `.pdf`, `.xml`, `.xlsx`, `.xls`, `.csv`, `.png`, `.jpg`, `.jpeg` com limite de 15 MB e identificador visual por extensão.
  - Upload e pré-visualização de Logotipo Oficial do Escritório e imagens de QR Code PIX nos formatos `.png`, `.jpg`, `.jpeg`, `.svg`, `.webp`.
  - Visualização em nova aba de navegador via Blob e download padronizado.

---

## [1.0.0] - 2026-11-15

### Adicionado
- **Lançamento Oficial ZGESTOR Contábil**:
  - Módulos de Visão Geral (Dashboard), Gestão de Tarefas & Obrigações, Guias de Impostos, Parcelamentos Fiscais, Controle de CNDs, Cadastro de Empresas, Onboarding e Gestão de Honorários com Recibos PIX em PDF.
  - Central e Portal do Cliente com isolamento multi-inquilino.
  - Integração com banco de dados PostgreSQL na nuvem via **Supabase Cloud** com políticas de Row Level Security (RLS).
  - Hospedagem e deploy contínuo na **Vercel**.
