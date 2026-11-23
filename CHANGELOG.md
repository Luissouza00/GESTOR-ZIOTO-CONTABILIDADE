# Changelog — ZGESTOR Contábil

Todas as atualizações notáveis deste projeto são documentadas neste arquivo.
O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/) e adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

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
