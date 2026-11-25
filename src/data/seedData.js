// =============================================================================
// ZGESTOR - Dados Iniciais, Modelos de Tarefas Mensais, Guias, Parcelamentos,
// Controle de CNDs e Portal / Central do Cliente
// - Regra Contábil: Competência MM/AAAA possui Prazo de Entrega e Vencimento de
//   Honorários no mês subsequente (MM+1/AAAA). Ex: Comp. 10/2026 vence em 11/2026.
// - Separação entre Pró-Labore (Padrão = Sim -> Gera DARF INSS/IRRF) e
//   Funcionários CLT (Gera Folha CLT e Guia de FGTS Digital).
// =============================================================================

window.ZGESTOR_MODELS = {
  escritorioPadrao: {
    nome_escritorio: 'ZIOTO CONTABILIDADE & CONSULTORIA EMPRESARIAL LTDA',
    razao_social: 'ZIOTO CONTABILIDADE & CONSULTORIA EMPRESARIAL LTDA',
    nome_fantasia: 'ZIOTO CONTABILIDADE',
    cnpj_escritorio: '12.345.678/0001-90',
    crc_escritorio: 'CRC/SP 2SP098765/O-0',
    endereco_escritorio: 'Av. Paulista, 1000 - Sala 804 - Centro',
    logradouro: 'Av. Paulista',
    numero: '1000',
    complemento: 'Sala 804',
    bairro: 'Bela Vista',
    cidade_uf: 'São Paulo / SP',
    municipio: 'São Paulo',
    uf: 'SP',
    cep: '01310-100',
    telefone_escritorio: '(11) 3344-5566',
    whatsapp_escritorio: '(11) 99888-7766',
    email_escritorio: 'contato@ziotocontabilidade.com.br',
    email_financeiro: 'financeiro@ziotocontabilidade.com.br',
    chave_pix: '12.345.678/0001-90',
    tipo_chave_pix: 'CNPJ',
    banco_pix: 'Banco Inter (077) / Itaú Empresas',
    favorecido_pix: 'ZIOTO CONTABILIDADE LTDA',
    qrcode_img: '',
    mensagem_recibo: 'Favor realizar o pagamento via PIX utilizando a chave acima até a data de vencimento e encaminhar o comprovante ao setor financeiro.',
    // 3 Contas Bancárias & Canais PIX Oficiais
    pix_principal: {
      nome: 'Conta PJ Principal (CNPJ Principal)',
      banco: 'Banco Inter (077) / Itaú Empresas',
      tipo_chave: 'CNPJ',
      chave_pix: '12.345.678/0001-90',
      favorecido: 'ZIOTO CONTABILIDADE LTDA',
      qrcode_img: ''
    },
    pix_secundario: {
      nome: 'Conta PJ Secundária (CNPJ Secundário / Filial)',
      banco: 'Sicoob / Nubank PJ',
      tipo_chave: 'CNPJ',
      chave_pix: '98.765.432/0001-10',
      favorecido: 'ZIOTO CONTABILIDADE FILIAL LTDA',
      qrcode_img: ''
    },
    pix_autonomo: {
      nome: 'Conta Autônomo / Sócio (Pessoa Física)',
      banco: 'Santander / Inter PF',
      tipo_chave: 'CPF',
      chave_pix: '123.456.789-00',
      favorecido: 'Luis Filipe Ferreira (Contador Sócio)',
      qrcode_img: ''
    },
    // Integração API Integra Contador (SERPRO / Receita Federal)
    api_integra_contador: {
      ativo: true,
      status: 'CONECTADO',
      client_id: 'IC-SERPRO-ZIOTO-2026-PROD',
      endpoint: 'https://apigateway.serpro.gov.br/integra-contador/v1',
      ultima_sincronizacao: '2026-11-14 19:30:00',
      renovacao_automatica: true
    }
  },

  mesesAno: [
    { num: '01', nome: 'Janeiro', abrev: 'Jan', curto: 'Jan' },
    { num: '02', nome: 'Fevereiro', abrev: 'Fev', curto: 'Fev' },
    { num: '03', nome: 'Março', abrev: 'Mar', curto: 'Mar' },
    { num: '04', nome: 'Abril', abrev: 'Abr', curto: 'Abr' },
    { num: '05', nome: 'Maio', abrev: 'Mai', curto: 'Mai' },
    { num: '06', nome: 'Junho', abrev: 'Jun', curto: 'Jun' },
    { num: '07', nome: 'Julho', abrev: 'Jul', curto: 'Jul' },
    { num: '08', nome: 'Agosto', abrev: 'Ago', curto: 'Ago' },
    { num: '09', nome: 'Setembro', abrev: 'Set', curto: 'Set' },
    { num: '10', nome: 'Outubro', abrev: 'Out', curto: 'Out' },
    { num: '11', nome: 'Novembro', abrev: 'Nov', curto: 'Nov' },
    { num: '12', nome: 'Dezembro', abrev: 'Dez', curto: 'Dez' }
  ],

  departamentos: [
    { id: 'FISCAL', nome: 'Fiscal', cor: 'blue', icone: 'receipt' },
    { id: 'CONTABIL', nome: 'Contábil', cor: 'indigo', icone: 'calculator' },
    { id: 'PESSOAL', nome: 'Pessoal (DP)', cor: 'purple', icone: 'users' },
    { id: 'FINANCEIRO', nome: 'Financeiro / BPO', cor: 'emerald', icone: 'wallet' },
    { id: 'SOCIETARIO', nome: 'Societário / Legal', cor: 'amber', icone: 'building-2' }
  ],

  regimesTributarios: [
    'Simples Nacional',
    'Lucro Presumido',
    'Lucro Real',
    'MEI',
    'Imune/Isenta'
  ],

  tiposGuiasImpostos: [
    { sigla: 'DAS - Simples Nacional', departamento: 'FISCAL', dia_vencimento_padrao: 20 },
    { sigla: 'DAE / DARE - ICMS (Antecipação / DIFAL / ST)', departamento: 'FISCAL', dia_vencimento_padrao: 20 },
    { sigla: 'DARF - DCTFWeb / INSS / IRRF (Pró-Labore / Folha)', departamento: 'PESSOAL', dia_vencimento_padrao: 20 },
    { sigla: 'FGTS Digital - Guia Mensal (Funcionários CLT)', departamento: 'PESSOAL', dia_vencimento_padrao: 20 },
    { sigla: 'DARF - PIS / COFINS', departamento: 'FISCAL', dia_vencimento_padrao: 25 },
    { sigla: 'DARF - IRPJ / CSLL', departamento: 'FISCAL', dia_vencimento_padrao: 30 },
    { sigla: 'DAM / Guia ISS Municipal', departamento: 'FISCAL', dia_vencimento_padrao: 15 },
    { sigla: 'DAS - SIMEI (MEI)', departamento: 'FISCAL', dia_vencimento_padrao: 20 },
    { sigla: 'DAS-MEI', departamento: 'FISCAL', dia_vencimento_padrao: 20 }
  ],

  statusParcelamentoOpcoes: [
    { id: 'ATIVO', label: 'Ativo (Em Dia)' },
    { id: 'EM_ATRASO', label: 'Ativo em Atraso (Parcela em Aberto)' },
    { id: 'ENCERRADO_FALTA_PAGAMENTO', label: 'Encerrado por Falta de Pagamento (Rescindido)' },
    { id: 'ENCERRADO_OPCAO', label: 'Encerrado por Opção / Quitação' }
  ],

  tiposCND: [
    { id: 'CND_FEDERAL', esfera: 'FEDERAL', nome: 'CND Federal / PGFN (RFB / PGFN / INSS)', validade_dias: 180 },
    { id: 'CRF_FGTS', esfera: 'FGTS', nome: 'CRF - Regularidade do FGTS (Caixa Econômica)', validade_dias: 30 },
    { id: 'CNDT_TRABALHISTA', esfera: 'TRABALHISTA', nome: 'CNDT - Certidão Trabalhista (TST)', validade_dias: 180 },
    { id: 'CND_ESTADUAL', esfera: 'ESTADUAL', nome: 'CND Estadual (SEFAZ MG / SEFAZ ES)', validade_dias: 90 },
    { id: 'CND_MUNICIPAL', esfera: 'MUNICIPAL', nome: 'CND Municipal (Prefeitura ISS MG / ES)', validade_dias: 90 }
  ],

  pastasPortalCliente: [
    { id: 'CONSTITUTIVOS', nome: 'Documentos Constitutivos & Societários', label: '1. Documentos Constitutivos & Societários', icone: 'folder-key', cor: 'amber', descricao: 'Contrato Social, Alterações, Cartão CNPJ, Alvarás e Procurações' },
    { id: 'GUIAS_IMPOSTOS', nome: 'Guias de Impostos & Parcelamentos', label: '2. Guias de Impostos & Parcelamentos', icone: 'receipt', cor: 'emerald', descricao: 'DAS, DAE ICMS, DARF INSS/IRRF, FGTS Digital e Parcelamentos' },
    { id: 'CONTABIL_FOLHA', nome: 'Balancetes, Demonstrações & Folha/Pró-Labore', label: '3. Balancetes, Demonstrações & Folha/Pró-Labore', icone: 'file-spreadsheet', cor: 'indigo', descricao: 'Balancetes assinados, DRE, Holerites, Recibos de Pró-Labore e Honorários' },
    { id: 'CERTIDOES_CND', nome: 'Certidões Negativas (CNDs)', label: '4. Certidões Negativas (CNDs)', icone: 'shield-check', cor: 'teal', descricao: 'Certidões Federal, Estadual, Municipal, FGTS e Trabalhista vigentes' }
  ],

  etapasOnboarding: [
    { id: 'DOCUMENTACAO', titulo: '1. Documentação e Societário', descricao: 'Coleta de atos constitutivos, CNPJ e contrato de prestação de serviços' },
    { id: 'CERTIFICADO_PROCURACOES', titulo: '2. Certificado Digital e Procurações', descricao: 'Configuração de acessos e-CAC, FGTS Digital, SEFAZ e Prefeitura' },
    { id: 'CADASTRO_SISTEMAS', titulo: '3. Parametrização nos Sistemas', descricao: 'Cadastro no ERP contábil, folha de pagamento e importação de saldos' },
    { id: 'REUNIAO_ALINHAMENTO', titulo: '4. Reunião Inicial e Alinhamento', descricao: 'Boas-vindas, definição de prazos e fluxo mensal com o cliente' }
  ],

  checklistModelos: {
    ABERTURA_EMPRESA: {
      id: 'ABERTURA_EMPRESA',
      nome: 'Abertura de Empresa',
      subtitulo: 'Viabilidade, Junta Comercial, CNPJ, Inscrições e Certificado',
      itens: [
        { etapa: 'DOCUMENTACAO', titulo: 'Consulta Prévia de Viabilidade e Pesquisa de Nome Empresarial (Junta Comercial/Prefeitura)', departamento: 'SOCIETARIO', obrigatorio: true, ordem: 1 },
        { etapa: 'DOCUMENTACAO', titulo: 'Coleta de Documentos Pessoais dos Sócios, CNH, CPF e Comprovante de Residência', departamento: 'SOCIETARIO', obrigatorio: true, ordem: 2 },
        { etapa: 'DOCUMENTACAO', titulo: 'Elaboração e Assinatura do Contrato Social / Ato Constitutivo e DBE da Receita Federal', departamento: 'SOCIETARIO', obrigatorio: true, ordem: 3 },
        { etapa: 'DOCUMENTACAO', titulo: 'Protocolo e Registro do Contrato Social na Junta Comercial do Estado', departamento: 'SOCIETARIO', obrigatorio: true, ordem: 4 },
        { etapa: 'DOCUMENTACAO', titulo: 'Emissão e Validação do Cartão CNPJ na Receita Federal', departamento: 'SOCIETARIO', obrigatorio: true, ordem: 5 },
        { etapa: 'DOCUMENTACAO', titulo: 'Inscrição Estadual (SEFAZ) e Inscrição Municipal / Alvará de Funcionamento', departamento: 'SOCIETARIO', obrigatorio: true, ordem: 6 },
        { etapa: 'CERTIFICADO_PROCURACOES', titulo: 'Emissão, Teste e Validação do Certificado Digital e-CNPJ (A1/A3)', departamento: 'FISCAL', obrigatorio: true, ordem: 7 },
        { etapa: 'CERTIFICADO_PROCURACOES', titulo: 'Cadastramento de Procurações Eletrônicas e-CAC (Receita) e Posto Fiscal SEFAZ', departamento: 'FISCAL', obrigatorio: true, ordem: 8 },
        { etapa: 'CERTIFICADO_PROCURACOES', titulo: 'Habilitação FGTS Digital, Conectividade Social e eSocial DP', departamento: 'PESSOAL', obrigatorio: true, ordem: 9 },
        { etapa: 'CADASTRO_SISTEMAS', titulo: 'Enquadramento Tributário (Opção pelo Simples Nacional ou Lucro Presumido)', departamento: 'FISCAL', obrigatorio: true, ordem: 10 },
        { etapa: 'CADASTRO_SISTEMAS', titulo: 'Parametrização no Sistema Contábil, Pró-Labore dos Sócios e/ou Folha CLT', departamento: 'PESSOAL', obrigatorio: true, ordem: 11 },
        { etapa: 'REUNIAO_ALINHAMENTO', titulo: 'Reunião de Boas-Vindas, Apresentação da Equipe e Liberação do Portal do Cliente', departamento: 'SOCIETARIO', obrigatorio: true, ordem: 12 }
      ]
    },
    TROCA_CONTABILIDADE: {
      id: 'TROCA_CONTABILIDADE',
      nome: 'Troca de Contabilidade',
      subtitulo: 'Termo de Transferência, Procurações e-CAC/SEFAZ, Importação de Balancete e Histórico Fiscal',
      itens: [
        { etapa: 'DOCUMENTACAO', titulo: 'Solicitação e Emissão do Termo de Transferência de Responsabilidade Técnica (CRCTransf)', departamento: 'SOCIETARIO', obrigatorio: true, ordem: 1 },
        { etapa: 'DOCUMENTACAO', titulo: 'Coleta de Contrato Social Consolidado, Últimas Alterações e Cartão CNPJ Atualizado', departamento: 'SOCIETARIO', obrigatorio: true, ordem: 2 },
        { etapa: 'DOCUMENTACAO', titulo: 'Contrato de Prestação de Serviços Contábeis Assinado e Definição do Honorário Mensal', departamento: 'FINANCEIRO', obrigatorio: true, ordem: 3 },
        { etapa: 'CERTIFICADO_PROCURACOES', titulo: 'Recebimento e Teste do Certificado Digital e-CNPJ (A1/A3) e Senhas de Acesso', departamento: 'FISCAL', obrigatorio: true, ordem: 4 },
        { etapa: 'CERTIFICADO_PROCURACOES', titulo: 'Cadastramento / Transferência de Procuração Eletrônica e-CAC (Receita Federal)', departamento: 'FISCAL', obrigatorio: true, ordem: 5 },
        { etapa: 'CERTIFICADO_PROCURACOES', titulo: 'Procuração Eletrônica SEFAZ Estadual e Domicílio Tributário Eletrônico (DTE)', departamento: 'FISCAL', obrigatorio: true, ordem: 6 },
        { etapa: 'CERTIFICADO_PROCURACOES', titulo: 'Outorga de Procuração FGTS Digital / Conectividade Social e Acesso eSocial DP', departamento: 'PESSOAL', obrigatorio: true, ordem: 7 },
        { etapa: 'CADASTRO_SISTEMAS', titulo: 'Obtenção e Importação do Balancete de Verificação, Plano de Contas e Livro Razão', departamento: 'CONTABIL', obrigatorio: true, ordem: 8 },
        { etapa: 'CADASTRO_SISTEMAS', titulo: 'Importação de Arquivos Fiscais (SPED EFD Contribuições, ECF, XMLs de Notas e Livros)', departamento: 'FISCAL', obrigatorio: true, ordem: 9 },
        { etapa: 'CADASTRO_SISTEMAS', titulo: 'Importação do Histórico de Funcionários, Folha de Pagamento e Fichas de Registro CLT', departamento: 'PESSOAL', obrigatorio: true, ordem: 10 },
        { etapa: 'CADASTRO_SISTEMAS', titulo: 'Levantamento de Débitos, Verificação de Parcelamentos Ativos e Emissão de CNDs Iniciais', departamento: 'FISCAL', obrigatorio: true, ordem: 11 },
        { etapa: 'REUNIAO_ALINHAMENTO', titulo: 'Reunião de Alinhamento de Transição, Apresentação da Equipe e Liberação do Portal do Cliente', departamento: 'SOCIETARIO', obrigatorio: true, ordem: 12 }
      ]
    }
  },

  checklistPadraoOnboarding: [
    { etapa: 'DOCUMENTACAO', titulo: 'Contrato Social / Última Alteração Consolidada e Cartão CNPJ', departamento: 'SOCIETARIO', obrigatorio: true, ordem: 1 },
    { etapa: 'DOCUMENTACAO', titulo: 'Documentos Pessoais dos Sócios (RG/CNH, CPF e Comprovante de Endereço)', departamento: 'SOCIETARIO', obrigatorio: true, ordem: 2 },
    { etapa: 'DOCUMENTACAO', titulo: 'Contrato de Prestação de Serviços Contábeis Assinado e Termo de Transferência', departamento: 'FINANCEIRO', obrigatorio: true, ordem: 3 },
    { etapa: 'CERTIFICADO_PROCURACOES', titulo: 'Recebimento e Teste do Certificado Digital e-CNPJ (A1/A3)', departamento: 'FISCAL', obrigatorio: true, ordem: 4 },
    { etapa: 'CERTIFICADO_PROCURACOES', titulo: 'Procuração Eletrônica e-CAC (Receita Federal) Cadastrada', departamento: 'FISCAL', obrigatorio: true, ordem: 5 },
    { etapa: 'CERTIFICADO_PROCURACOES', titulo: 'Procuração FGTS Digital / Conectividade Social e Acesso eSocial', departamento: 'PESSOAL', obrigatorio: true, ordem: 6 },
    { etapa: 'CERTIFICADO_PROCURACOES', titulo: 'Acesso Portal da Prefeitura (NFS-e) e Posto Fiscal SEFAZ', departamento: 'FISCAL', obrigatorio: true, ordem: 7 },
    { etapa: 'CADASTRO_SISTEMAS', titulo: 'Cadastro da Empresa no Sistema Contábil/Fiscal e Parametrização Tributária', departamento: 'FISCAL', obrigatorio: true, ordem: 8 },
    { etapa: 'CADASTRO_SISTEMAS', titulo: 'Parametrização de Pró-Labore dos Sócios e/ou Cadastro de Funcionários CLT', departamento: 'PESSOAL', obrigatorio: true, ordem: 9 },
    { etapa: 'CADASTRO_SISTEMAS', titulo: 'Importação do Balancete de Verificação, Plano de Contas e Razão Anterior', departamento: 'CONTABIL', obrigatorio: true, ordem: 10 },
    { etapa: 'REUNIAO_ALINHAMENTO', titulo: 'Cadastro do Honorário Mensal e Envio das Boas-Vindas Financeiras', departamento: 'FINANCEIRO', obrigatorio: true, ordem: 11 },
    { etapa: 'REUNIAO_ALINHAMENTO', titulo: 'Reunião de Onboarding e Liberação do Portal Central do Cliente', departamento: 'SOCIETARIO', obrigatorio: true, ordem: 12 }
  ],

  modelosTarefasMensais: [
    // ==================== FISCAL — SIMPLES NACIONAL ====================
    {
      id: 'mod-fis-sn-docs',
      titulo: '1. Cobrança de Documentos e Arquivos Fiscais (XMLs / Notas)',
      descricao: 'Cobrar do cliente notas fiscais emitidas/tomadas, XMLs e documentos fiscais da competência.',
      departamento: 'FISCAL',
      periodicidade: 'MENSAL',
      regimes_aplicaveis: ['Simples Nacional'],
      dia_prazo_padrao: 5,
      requer_pro_labore: false,
      requer_funcionarios: false,
      requer_ie: false,
      ativo: true
    },
    {
      id: 'mod-fis-sn-pgdas',
      titulo: '2. Apuração e Transmissão PGDAS-D / Guia DAS (Simples Nacional)',
      descricao: 'Apurar receitas da competência, validar Fator R, transmitir PGDAS-D (Normal ou Sem Movimento) e enviar guia DAS até dia 20.',
      departamento: 'FISCAL',
      periodicidade: 'MENSAL',
      regimes_aplicaveis: ['Simples Nacional'],
      dia_prazo_padrao: 18,
      requer_pro_labore: false,
      requer_funcionarios: false,
      requer_ie: false,
      ativo: true
    },
    {
      id: 'mod-fis-sn-icms',
      titulo: '3. Apuração de ICMS (DIFAL / ST / Antecipação / DAE)',
      descricao: 'Conferir entradas interestaduais e apurar ICMS DIFAL, ST ou Antecipação. Gerada apenas para empresas com Inscrição Estadual.',
      departamento: 'FISCAL',
      periodicidade: 'MENSAL',
      regimes_aplicaveis: ['Simples Nacional'],
      dia_prazo_padrao: 15,
      requer_pro_labore: false,
      requer_funcionarios: false,
      requer_ie: true,
      ativo: true
    },
    {
      id: 'mod-fis-sn-destda',
      titulo: '4. Transmissão DeSTDA / SEDIF-SN',
      descricao: 'Gerar e transmitir DeSTDA (Normal ou Sem Movimento). Obrigatória apenas para empresas do Simples Nacional com Inscrição Estadual.',
      departamento: 'FISCAL',
      periodicidade: 'MENSAL',
      regimes_aplicaveis: ['Simples Nacional'],
      dia_prazo_padrao: 25,
      requer_pro_labore: false,
      requer_funcionarios: false,
      requer_ie: true,
      ativo: true
    },

    // ==================== FISCAL — LUCRO PRESUMIDO & LUCRO REAL ====================
    {
      id: 'mod-fis-pr-docs',
      titulo: '1. Cobrança de Documentos, XMLs e Retenções na Fonte',
      descricao: 'Cobrar notas fiscais de entrada/saída/serviços e comprovantes de retenções (IRRF, CSRF, ISS) da competência.',
      departamento: 'FISCAL',
      periodicidade: 'MENSAL',
      regimes_aplicaveis: ['Lucro Presumido', 'Lucro Real'],
      dia_prazo_padrao: 5,
      requer_pro_labore: false,
      requer_funcionarios: false,
      requer_ie: false,
      ativo: true
    },
    {
      id: 'mod-fis-pr-sped-icms',
      titulo: '2. Apuração ICMS / IPI e Transmissão EFD-ICMS/IPI (SPED Fiscal)',
      descricao: 'Apurar ICMS/IPI e transmitir SPED Fiscal. Gerada apenas para empresas com Inscrição Estadual.',
      departamento: 'FISCAL',
      periodicidade: 'MENSAL',
      regimes_aplicaveis: ['Lucro Presumido', 'Lucro Real'],
      dia_prazo_padrao: 15,
      requer_pro_labore: false,
      requer_funcionarios: false,
      requer_ie: true,
      ativo: true
    },
    {
      id: 'mod-fis-pr-efd-contrib',
      titulo: '3. Apuração PIS / COFINS e Transmissão EFD-Contribuições',
      descricao: 'Apurar PIS e COFINS, emitir DARFs e transmitir EFD-Contribuições.',
      departamento: 'FISCAL',
      periodicidade: 'MENSAL',
      regimes_aplicaveis: ['Lucro Presumido', 'Lucro Real'],
      dia_prazo_padrao: 15,
      requer_pro_labore: false,
      requer_funcionarios: false,
      requer_ie: false,
      ativo: true
    },
    {
      id: 'mod-fis-pr-reinf',
      titulo: '4. Transmissão EFD-Reinf e Fechamento DCTFWeb / MIT',
      descricao: 'Transmitir eventos periódicos da EFD-Reinf (retenções/distribuição de lucros) e fechar DCTFWeb / MIT.',
      departamento: 'FISCAL',
      periodicidade: 'MENSAL',
      regimes_aplicaveis: ['Lucro Presumido', 'Lucro Real'],
      dia_prazo_padrao: 15,
      requer_pro_labore: false,
      requer_funcionarios: false,
      requer_ie: false,
      ativo: true
    },
    {
      id: 'mod-fis-pr-irpj',
      titulo: '5. Apuração IRPJ / CSLL (Presumido / Real)',
      descricao: 'Calcular IRPJ e CSLL do período e emitir guias DARF correspondentes.',
      departamento: 'FISCAL',
      periodicidade: 'MENSAL',
      regimes_aplicaveis: ['Lucro Presumido', 'Lucro Real'],
      dia_prazo_padrao: 25,
      requer_pro_labore: false,
      requer_funcionarios: false,
      requer_ie: false,
      ativo: true
    },

    // ==================== CONTÁBIL — ETAPAS MENSAIS & ANUAIS ====================
    {
      id: 'mod-ctb-docs',
      titulo: '1. Cobrança de Extratos Bancários (OFX/PDF) e Movimentação',
      descricao: 'Solicitar e conferir recebimento de extratos bancários, faturas de cartão e comprovantes de despesas do mês.',
      departamento: 'CONTABIL',
      periodicidade: 'MENSAL',
      regimes_aplicaveis: ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'Imune/Isenta'],
      dia_prazo_padrao: 8,
      requer_pro_labore: false,
      requer_funcionarios: false,
      requer_ie: false,
      ativo: true
    },
    {
      id: 'mod-ctb-concil',
      titulo: '2. Importação, Classificação e Conciliação Bancária',
      descricao: 'Importar extratos, classificar lançamentos contábeis, conciliar bancos, clientes, fornecedores e tributos.',
      departamento: 'CONTABIL',
      periodicidade: 'MENSAL',
      regimes_aplicaveis: ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'Imune/Isenta'],
      dia_prazo_padrao: 18,
      requer_pro_labore: false,
      requer_funcionarios: false,
      requer_ie: false,
      ativo: true
    },
    {
      id: 'mod-ctb-fechamento',
      titulo: '3. Fechamento Contábil Mensal e Emissão do Balancete',
      descricao: 'Conferir saldos, validar DRE/Balancete mensal e marcar o mês como fechado na Matriz Anual.',
      departamento: 'CONTABIL',
      periodicidade: 'MENSAL',
      regimes_aplicaveis: ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'Imune/Isenta'],
      dia_prazo_padrao: 25,
      requer_pro_labore: false,
      requer_funcionarios: false,
      requer_ie: false,
      ativo: true
    },
    {
      id: 'mod-ctb-ecd-anual',
      titulo: 'ECD Anual — Escrituração Contábil Digital (SPED Contábil)',
      descricao: 'Gerar, validar e transmitir a ECD anual referente ao exercício anterior (entrega até final de Junho).',
      departamento: 'CONTABIL',
      periodicidade: 'ANUAL',
      mes_entrega: '06',
      regimes_aplicaveis: ['Lucro Presumido', 'Lucro Real', 'Imune/Isenta'],
      dia_prazo_padrao: 30,
      requer_pro_labore: false,
      requer_funcionarios: false,
      requer_ie: false,
      ativo: true
    },
    {
      id: 'mod-ctb-ecf-anual',
      titulo: 'ECF Anual — Escrituração Contábil Fiscal',
      descricao: 'Gerar, validar e transmitir a ECF anual referente ao exercício anterior (entrega até final de Julho).',
      departamento: 'CONTABIL',
      periodicidade: 'ANUAL',
      mes_entrega: '07',
      regimes_aplicaveis: ['Lucro Presumido', 'Lucro Real', 'Imune/Isenta'],
      dia_prazo_padrao: 31,
      requer_pro_labore: false,
      requer_funcionarios: false,
      requer_ie: false,
      ativo: true
    },

    // ==================== PESSOAL (DESATIVADO POR PADRÃO) ====================
    {
      id: 'mod-prolabore',
      titulo: 'Apuração de Pró-Labore, DCTFWeb e Emissão de DARF INSS / IRRF',
      descricao: 'Processar retirada de pró-labore dos sócios, transmitir eSocial/DCTFWeb e emitir guia DARF de INSS/IRRF.',
      departamento: 'PESSOAL',
      periodicidade: 'MENSAL',
      regimes_aplicaveis: ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'Imune/Isenta'],
      dia_prazo_padrao: 15,
      requer_pro_labore: true,
      requer_funcionarios: false,
      requer_ie: false,
      ativo: false
    },
    {
      id: 'mod-folha-clt',
      titulo: 'Fechamento de Folha de Funcionários (CLT) e Guia FGTS Digital',
      descricao: 'Processar folha mensal de empregados CLT, emitir holerites e gerar guia do FGTS Digital.',
      departamento: 'PESSOAL',
      periodicidade: 'MENSAL',
      regimes_aplicaveis: ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI', 'Imune/Isenta'],
      dia_prazo_padrao: 15,
      requer_pro_labore: false,
      requer_funcionarios: true,
      requer_ie: false,
      ativo: false
    }
  ]
};

window.ZGESTOR_INITIAL_DB = {
  escritorio: JSON.parse(JSON.stringify(window.ZGESTOR_MODELS.escritorioPadrao)),

  profiles: [
    {
      id: 'usr-admin-luis',
      nome: 'Luis Filipe (Zioto Contabilidade)',
      email: 'ziotocont.luisf@gmail.com',
      cargo: 'ADMIN',
      departamento: 'TODOS',
      ativo: true,
      permissoes: {
        dashboard: true,
        tarefas: true,
        guias: true,
        parcelamentos: true,
        cnds: true,
        alvaras: true,
        empresas: true,
        onboarding: true,
        honorarios: true,
        central_cliente: true,
        seguranca: true
      },
      created_at: '2026-01-10T09:00:00Z'
    }
  ],

  empresas: [],
  onboarding_itens: [],
  tarefas: [],
  guias_impostos: [],
  parcelamentos: [],
  parcelamento_guias: [],
  alvaras: [],
  cnds: [],
  portal_arquivos: [],
  central_cliente_registros: [],
  honorarios: [],
  honorario_pagamentos: [],
  audit_logs: [],
  convites: []
};
