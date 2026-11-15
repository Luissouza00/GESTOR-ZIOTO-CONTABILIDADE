# ZGESTOR — Sistema de Gestão para Escritório de Contabilidade

Sistema web completo desenvolvido para gestão contábil, fiscal, departamento pessoal, financeiro e societário, com banco de dados híbrido (**Supabase PostgreSQL + Persistência Local**) e **Políticas de Segurança por Departamento (RLS)**.

## 🚀 Como Abrir e Usar Imediatamente

1. Dê um duplo clique em **`Iniciar_ZGESTOR.bat`** ou abra diretamente o arquivo **`index.html`** em qualquer navegador moderno (Chrome, Edge, Opera, Brave).
2. O sistema já inicia populado com dados realistas de demonstração e persistência automática no navegador, permitindo testar imediatamente todos os módulos e perfis de segurança.

## ☁️ Como Conectar ao Supabase na Nuvem (Opcional)

1. Crie um projeto gratuito em https://supabase.com.
2. No painel do Supabase, acesse **SQL Editor** -> **New Query**, copie todo o conteúdo do arquivo [`supabase/schema.sql`](./supabase/schema.sql) e clique em **Run**. Isso criará:
   - Todas as tabelas (`profiles`, `empresas`, `onboarding_itens`, `modelos_tarefas`, `tarefas`, `parcelamentos`, `parcelamento_guias`, `honorarios`, `honorario_pagamentos`, `audit_logs`);
   - A trigger automática `trg_atualizar_totais_honorario` para cálculo de saldo em aberto;
   - Todas as **Políticas de Segurança Row-Level Security (RLS)** por perfil (`ADMIN` vs. `COLABORADOR` por departamento).
3. Dentro do ZGESTOR, clique na aba **Usuários & Segurança**, cole a **Project URL** e a **Anon Key** do seu Supabase e clique em **Salvar & Conectar Supabase**.

