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
    {
      id: 'mod-prolabore',
      titulo: 'Apuração de Pró-Labore, DCTFWeb e Emissão de DARF INSS / IRRF',
      descricao: 'Processar retirada de pró-labore dos sócios, transmitir eSocial/DCTFWeb e emitir guia DARF de INSS/IRRF (vencimento dia 20 do mês seguinte).',
      departamento: 'PESSOAL',
      regimes_aplicaveis: ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'Imune/Isenta'],
      dia_prazo_padrao: 15,
      requer_pro_labore: true,
      requer_funcionarios: false,
      ativo: true
    },
    {
      id: 'mod-folha-clt',
      titulo: 'Fechamento de Folha de Funcionários (CLT) e Emissão da Guia FGTS Digital',
      descricao: 'Processar folha mensal de empregados CLT, emitir holerites e gerar guia do FGTS Digital para pagamento até dia 20 do mês seguinte.',
      departamento: 'PESSOAL',
      regimes_aplicaveis: ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI', 'Imune/Isenta'],
      dia_prazo_padrao: 15,
      requer_pro_labore: false,
      requer_funcionarios: true,
      ativo: true
    },
    {
      id: 'mod-4',
      titulo: 'Importação de XMLs (NF-e / NFS-e / CT-e) e Escrita Fiscal',
      descricao: 'Importar notas emitidas e tomadas na competência, validar CFOPs/NCMs e conferir retenções na fonte.',
      departamento: 'FISCAL',
      regimes_aplicaveis: ['Simples Nacional', 'Lucro Presumido', 'Lucro Real'],
      dia_prazo_padrao: 10,
      requer_pro_labore: false,
      requer_funcionarios: false,
      ativo: true
    },
    {
      id: 'mod-5',
      titulo: 'Apuração PGDAS-D e Emissão da Guia DAS (Simples Nacional)',
      descricao: 'Apurar receitas da competência, calcular Fator R, transmitir PGDAS-D e enviar guia DAS (vencimento dia 20 do mês seguinte).',
      departamento: 'FISCAL',
      regimes_aplicaveis: ['Simples Nacional'],
      dia_prazo_padrao: 18,
      requer_pro_labore: false,
      requer_funcionarios: false,
      ativo: true
    },
    {
      id: 'mod-10',
      titulo: 'DeSTDA / SEDIF-SN e Apuração de DAE ICMS (DIFAL / Antecipação / ST)',
      descricao: 'Apurar ICMS DIFAL/ST/Antecipação de compras interestaduais, emitir guia DAE ICMS e transmitir DeSTDA (Exclusivo Simples Nacional).',
      departamento: 'FISCAL',
      regimes_aplicaveis: ['Simples Nacional'],
      dia_prazo_padrao: 25,
      requer_pro_labore: false,
      requer_funcionarios: false,
      ativo: true
    },
    {
      id: 'mod-6',
      titulo: 'Apuração de PIS, COFINS, ISS, ICMS e Entrega da EFD-Contribuições / SPED',
      descricao: 'Apurar tributos da competência, transmitir obrigações acessórias e enviar DARFs/DARE no mês subsequente.',
      departamento: 'FISCAL',
      regimes_aplicaveis: ['Lucro Presumido', 'Lucro Real'],
      dia_prazo_padrao: 18,
      requer_pro_labore: false,
      requer_funcionarios: false,
      ativo: true
    },
    {
      id: 'mod-7',
      titulo: 'Conciliação Bancária, Classificação e Fechamento Contábil Mensal (Balancete)',
      descricao: 'Importar extratos OFX/PDF da competência, conciliar bancos, folha, impostos e encerrar o balancete mensal para fechamento.',
      departamento: 'CONTABIL',
      regimes_aplicaveis: ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'Imune/Isenta'],
      dia_prazo_padrao: 25,
      requer_pro_labore: false,
      requer_funcionarios: false,
      ativo: true
    },
    {
      id: 'mod-8',
      titulo: 'Conferência de Certidões Negativas (CNDs Federal, Estadual, Municipal e FGTS)',
      descricao: 'Monitorar regularidade fiscal e trabalhista do cliente e disponibilizar no Portal do Cliente.',
      departamento: 'SOCIETARIO',
      regimes_aplicaveis: ['Simples Nacional', 'Lucro Presumido', 'Lucro Real'],
      dia_prazo_padrao: 22,
      requer_pro_labore: false,
      requer_funcionarios: false,
      ativo: true
    }
  ]
};

window.ZGESTOR_INITIAL_DB = {
  escritorio: JSON.parse(JSON.stringify(window.ZGESTOR_MODELS.escritorioPadrao)),

  profiles: [
    {
      id: 'usr-admin-1',
      nome: 'Contador Sócio (Administrador)',
      email: 'contador@zgestorcontabil.com.br',
      cargo: 'ADMIN',
      departamento: 'TODOS',
      ativo: true,
      permissoes: {
        dashboard: true,
        tarefas: true,
        guias: true,
        parcelamentos: true,
        cnds: true,
        empresas: true,
        onboarding: true,
        honorarios: true,
        central_cliente: true,
        seguranca: true
      },
      created_at: '2026-01-10T09:00:00Z'
    },
    {
      id: 'usr-fiscal-1',
      nome: 'Mariana Souza (Analista Fiscal)',
      email: 'fiscal@zgestorcontabil.com.br',
      cargo: 'COLABORADOR',
      departamento: 'FISCAL',
      ativo: true,
      permissoes: {
        dashboard: true,
        tarefas: true,
        guias: true,
        parcelamentos: true,
        cnds: true,
        central_cliente: true,
        empresas: true,
        onboarding: false,
        honorarios: false,
        seguranca: false
      },
      created_at: '2026-02-15T09:00:00Z'
    },
    {
      id: 'usr-dp-1',
      nome: 'Carlos Eduardo (Depto. Pessoal)',
      email: 'dp@zgestorcontabil.com.br',
      cargo: 'COLABORADOR',
      departamento: 'PESSOAL',
      ativo: true,
      permissoes: {
        dashboard: true,
        tarefas: true,
        guias: true,
        parcelamentos: false,
        cnds: true,
        central_cliente: true,
        empresas: true,
        onboarding: false,
        honorarios: false,
        seguranca: false
      },
      created_at: '2026-02-15T09:00:00Z'
    },
    {
      id: 'usr-contabil-1',
      nome: 'Fernanda Lima (Analista Contábil)',
      email: 'contabil@zgestorcontabil.com.br',
      cargo: 'COLABORADOR',
      departamento: 'CONTABIL',
      ativo: true,
      permissoes: {
        dashboard: true,
        tarefas: true,
        guias: true,
        parcelamentos: true,
        cnds: true,
        central_cliente: true,
        empresas: true,
        onboarding: false,
        honorarios: false,
        seguranca: false
      },
      created_at: '2026-03-01T09:00:00Z'
    },
    {
      id: 'usr-fin-1',
      nome: 'Roberto Alves (Financeiro & Honorários)',
      email: 'financeiro@zgestorcontabil.com.br',
      cargo: 'COLABORADOR',
      departamento: 'FINANCEIRO',
      ativo: true,
      permissoes: {
        dashboard: true,
        tarefas: true,
        guias: true,
        parcelamentos: true,
        cnds: true,
        central_cliente: true,
        empresas: true,
        onboarding: false,
        honorarios: true,
        seguranca: false
      },
      created_at: '2026-03-10T09:00:00Z'
    },
    {
      id: 'usr-soc-1',
      nome: 'Patrícia Rocha (Societário / Legalização)',
      email: 'societario@zgestorcontabil.com.br',
      cargo: 'COLABORADOR',
      departamento: 'SOCIETARIO',
      ativo: true,
      permissoes: {
        dashboard: true,
        tarefas: true,
        guias: false,
        parcelamentos: true,
        cnds: true,
        central_cliente: true,
        empresas: true,
        onboarding: true,
        honorarios: false,
        seguranca: false
      },
      created_at: '2026-04-01T09:00:00Z'
    },
    {
      id: 'usr-cli-1',
      nome: 'Henrique Moreira (Sócio TechNova)',
      email: 'henrique@technova.com.br',
      cargo: 'CLIENTE',
      departamento: 'CLIENTE',
      empresa_id: 'emp-1',
      ativo: true,
      permissoes: {
        central_cliente: true,
        guias: true,
        cnds: true,
        parcelamentos: true,
        documentos: true
      },
      created_at: '2026-05-10T10:00:00Z'
    }
  ],

  empresas: [
    {
      id: 'emp-1',
      codigo_interno: '001',
      razao_social: 'TechNova Soluções em Software Ltda',
      nome_fantasia: 'TechNova Sistemas',
      cnpj: '34.512.890/0001-45',
      municipio_uf: 'São Paulo/SP',
      validade_certificado: '2027-08-15',
      competencia_inicial: '03/2024',
      modelo_onboarding: 'ABERTURA_EMPRESA',
      regime_tributario: 'Simples Nacional',
      inscricao_estadual: 'Isento',
      inscricao_municipal: '849201-4',
      responsavel_legal: 'Henrique Vasconcelos',
      telefone: '(11) 99812-4400',
      email: 'financeiro@technova.com.br',
      status: 'ATIVA',
      valor_honorario_padrao: 1450.00,
      dia_vencimento_honorario: 10,
      canal_pagamento_padrao: 'PIX_PRINCIPAL',
      possui_pro_labore: true,
      possui_funcionarios: true,
      data_entrada: '2024-03-01',
      observacoes: 'Possui Pró-Labore (2 sócios -> DARF INSS/IRRF) e 8 funcionários CLT (-> FGTS Digital). Apuração Fator R.'
    },
    {
      id: 'emp-2',
      codigo_interno: '002',
      razao_social: 'Comercial Horizonte Distribuidora de Alimentos Ltda',
      nome_fantasia: 'Horizonte Alimentos',
      cnpj: '18.230.450/0001-19',
      municipio_uf: 'Belo Horizonte/MG',
      validade_certificado: '2026-11-28', // Alerta visual: faltam 14 dias para o vencimento (< 30 dias)
      competencia_inicial: '07/2023',
      modelo_onboarding: 'TROCA_CONTABILIDADE',
      regime_tributario: 'Lucro Presumido',
      inscricao_estadual: '110.482.910.114',
      inscricao_municipal: '442190-1',
      responsavel_legal: 'Marcos Antônio Ribeiro',
      telefone: '(11) 98431-2211',
      email: 'marcos@horizontealimentos.com.br',
      status: 'ATIVA',
      valor_honorario_padrao: 2800.00,
      dia_vencimento_honorario: 10,
      canal_pagamento_padrao: 'PIX_SECUNDARIO',
      possui_pro_labore: true,
      possui_funcionarios: true,
      data_entrada: '2023-07-15',
      observacoes: 'Possui Pró-Labore + Funcionários CLT. ICMS-ST e parcelamento PGFN ativo.'
    },
    {
      id: 'emp-3',
      codigo_interno: '003',
      razao_social: 'Clínica Médica Vida Plena S/S Ltda',
      nome_fantasia: 'Clínica Vida Plena',
      cnpj: '41.890.123/0001-82',
      municipio_uf: 'Vitória/ES',
      validade_certificado: '2026-10-30', // Alerta visual: Vencido!
      competencia_inicial: '01/2025',
      modelo_onboarding: 'ABERTURA_EMPRESA',
      regime_tributario: 'Lucro Presumido',
      inscricao_estadual: 'Isento',
      inscricao_municipal: '991023-8',
      responsavel_legal: 'Dra. Camila Borges',
      telefone: '(11) 99104-7788',
      email: 'adm@clinicavidaplena.med.br',
      status: 'ATIVA',
      valor_honorario_padrao: 1950.00,
      dia_vencimento_honorario: 15,
      canal_pagamento_padrao: 'PIX_AUTONOMO',
      possui_pro_labore: true,
      possui_funcionarios: false,
      data_entrada: '2025-01-10',
      observacoes: 'Possui SOMENTE Pró-Labore das sócias médicas (gera DARF INSS/IRRF), SEM funcionários CLT (não gera FGTS mensal).'
    },
    {
      id: 'emp-4',
      codigo_interno: '004',
      razao_social: 'Construtora & Engenharia Atlas Ltda',
      nome_fantasia: 'Atlas Engenharia',
      cnpj: '52.671.334/0001-08',
      municipio_uf: 'Curitiba/PR',
      validade_certificado: '2027-05-20',
      competencia_inicial: '11/2026',
      modelo_onboarding: 'TROCA_CONTABILIDADE',
      regime_tributario: 'Simples Nacional',
      inscricao_estadual: '148.920.331.110',
      inscricao_municipal: '718290-5',
      responsavel_legal: 'Eng. Leonardo Martins',
      telefone: '(11) 97654-3090',
      email: 'contato@atlasengenharia.com.br',
      status: 'EM_ONBOARDING',
      valor_honorario_padrao: 2200.00,
      dia_vencimento_honorario: 10,
      possui_pro_labore: true,
      possui_funcionarios: true,
      data_entrada: '2026-11-01',
      observacoes: 'Novo cliente em Onboarding. Possui Pró-Labore + Funcionários CLT e DAE ICMS DIFAL.'
    }
  ],

  onboarding_itens: [
    { id: 'onb-1', empresa_id: 'emp-4', etapa: 'DOCUMENTACAO', titulo: 'Contrato Social / Última Alteração Consolidada e Cartão CNPJ', departamento: 'SOCIETARIO', obrigatorio: true, concluido: true, data_conclusao: '2026-11-02', responsavel_nome: 'Patrícia Rocha (Societário / Legalização)', observacao: '3ª alteração consolidada arquivada na JUCESP.', ordem: 1 },
    { id: 'onb-2', empresa_id: 'emp-4', etapa: 'DOCUMENTACAO', titulo: 'Documentos Pessoais dos Sócios (RG/CNH, CPF e Comprovante de Endereço)', departamento: 'SOCIETARIO', obrigatorio: true, concluido: true, data_conclusao: '2026-11-02', responsavel_nome: 'Patrícia Rocha (Societário / Legalização)', observacao: 'CNH digital dos 2 sócios salva na pasta.', ordem: 2 },
    { id: 'onb-3', empresa_id: 'emp-4', etapa: 'DOCUMENTACAO', titulo: 'Contrato de Prestação de Serviços Contábeis Assinado e Termo de Transferência', departamento: 'FINANCEIRO', obrigatorio: true, concluido: true, data_conclusao: '2026-11-03', responsavel_nome: 'Roberto Alves (Financeiro & Honorários)', observacao: 'Assinado via assinatura digital.', ordem: 3 },
    { id: 'onb-4', empresa_id: 'emp-4', etapa: 'CERTIFICADO_PROCURACOES', titulo: 'Recebimento e Teste do Certificado Digital e-CNPJ (A1/A3)', departamento: 'FISCAL', obrigatorio: true, concluido: true, data_conclusao: '2026-11-04', responsavel_nome: 'Mariana Souza (Analista Fiscal)', observacao: 'Certificado A1 válido até 08/2027.', ordem: 4 },
    { id: 'onb-5', empresa_id: 'emp-4', etapa: 'CERTIFICADO_PROCURACOES', titulo: 'Procuração Eletrônica e-CAC (Receita Federal) Cadastrada', departamento: 'FISCAL', obrigatorio: true, concluido: true, data_conclusao: '2026-11-04', responsavel_nome: 'Mariana Souza (Analista Fiscal)', observacao: 'Outorgada para o CNPJ do escritório.', ordem: 5 },
    { id: 'onb-6', empresa_id: 'emp-4', etapa: 'CERTIFICADO_PROCURACOES', titulo: 'Procuração FGTS Digital / Conectividade Social e Acesso eSocial', departamento: 'PESSOAL', obrigatorio: true, concluido: true, data_conclusao: '2026-11-05', responsavel_nome: 'Carlos Eduardo (Depto. Pessoal)', observacao: 'Perfil procurador habilitado no FGTS Digital.', ordem: 6 },
    { id: 'onb-7', empresa_id: 'emp-4', etapa: 'CERTIFICADO_PROCURACOES', titulo: 'Acesso Portal da Prefeitura (NFS-e) e Posto Fiscal SEFAZ', departamento: 'FISCAL', obrigatorio: true, concluido: false, data_conclusao: null, responsavel_nome: 'Mariana Souza (Analista Fiscal)', observacao: 'Aguardando senha web da prefeitura.', ordem: 7 },
    { id: 'onb-8', empresa_id: 'emp-4', etapa: 'CADASTRO_SISTEMAS', titulo: 'Cadastro da Empresa no Sistema Contábil/Fiscal e Parametrização Tributária', departamento: 'FISCAL', obrigatorio: true, concluido: true, data_conclusao: '2026-11-06', responsavel_nome: 'Mariana Souza (Analista Fiscal)', observacao: 'Anexo IV configurado no sistema.', ordem: 8 },
    { id: 'onb-9', empresa_id: 'emp-4', etapa: 'CADASTRO_SISTEMAS', titulo: 'Parametrização de Pró-Labore dos Sócios e/ou Cadastro de Funcionários CLT', departamento: 'PESSOAL', obrigatorio: true, concluido: false, data_conclusao: null, responsavel_nome: 'Carlos Eduardo (Depto. Pessoal)', observacao: 'Contabilidade anterior enviou backup da folha hoje.', ordem: 9 },
    { id: 'onb-10', empresa_id: 'emp-4', etapa: 'CADASTRO_SISTEMAS', titulo: 'Importação do Balancete de Verificação, Plano de Contas e Razão Anterior', departamento: 'CONTABIL', obrigatorio: true, concluido: false, data_conclusao: null, responsavel_nome: 'Fernanda Lima (Analista Contábil)', observacao: 'Aguardando balancete fechado até Setembro/2026.', ordem: 10 },
    { id: 'onb-11', empresa_id: 'emp-4', etapa: 'REUNIAO_ALINHAMENTO', titulo: 'Cadastro do Honorário Mensal e Envio das Boas-Vindas Financeiras', departamento: 'FINANCEIRO', obrigatorio: true, concluido: true, data_conclusao: '2026-11-06', responsavel_nome: 'Roberto Alves (Financeiro & Honorários)', observacao: 'Vencimento configurado para todo dia 10.', ordem: 11 },
    { id: 'onb-12', empresa_id: 'emp-4', etapa: 'REUNIAO_ALINHAMENTO', titulo: 'Reunião de Onboarding e Liberação do Portal Central do Cliente', departamento: 'SOCIETARIO', obrigatorio: true, concluido: false, data_conclusao: null, responsavel_nome: 'Contador Sócio (Administrador)', observacao: 'Agendada para sexta-feira às 14h.', ordem: 12 }
  ],

  tarefas: [
    // TAREFAS DA COMPETÊNCIA 10/2026 (PRAZO EM 11/2026)
    {
      id: 'tar-1',
      empresa_id: 'emp-1',
      competencia: '10/2026',
      departamento: 'PESSOAL',
      tipo: 'MENSAL',
      titulo: 'Apuração de Pró-Labore, DCTFWeb e Emissão de DARF INSS / IRRF',
      descricao: 'Pró-labore ref. 10/2026 dos 2 sócios + transmissão DCTFWeb e emissão do DARF previdenciário.',
      solicitante: 'Rotina Mensal',
      prazo_entrega: '2026-11-15',
      data_entrega: '2026-11-04',
      status: 'ENTREGUE_NO_PRAZO',
      responsavel_nome: 'Carlos Eduardo (Depto. Pessoal)',
      protocolo_observacao: 'Recibos de pró-labore e DARF INSS/IRRF disponibilizados no Portal do Cliente em 04/11.'
    },
    {
      id: 'tar-1b',
      empresa_id: 'emp-1',
      competencia: '10/2026',
      departamento: 'PESSOAL',
      tipo: 'MENSAL',
      titulo: 'Fechamento de Folha de Funcionários (CLT) e Emissão da Guia FGTS Digital',
      descricao: 'Folha ref. competência 10/2026 (8 colaboradores CLT) e guia FGTS Digital.',
      solicitante: 'Rotina Mensal',
      prazo_entrega: '2026-11-15',
      data_entrega: '2026-11-05',
      status: 'ENTREGUE_NO_PRAZO',
      responsavel_nome: 'Carlos Eduardo (Depto. Pessoal)',
      protocolo_observacao: 'Folha CLT fechada e Guia FGTS Digital enviada em 05/11/2026.'
    },
    {
      id: 'tar-3-prolab',
      empresa_id: 'emp-3',
      competencia: '10/2026',
      departamento: 'PESSOAL',
      tipo: 'MENSAL',
      titulo: 'Apuração de Pró-Labore, DCTFWeb e Emissão de DARF INSS / IRRF',
      descricao: 'Apuração de Pró-Labore das sócias médicas (empresa sem funcionários CLT — gera apenas DARF INSS/IRRF, sem FGTS).',
      solicitante: 'Rotina Mensal',
      prazo_entrega: '2026-11-15',
      data_entrega: '2026-11-06',
      status: 'ENTREGUE_NO_PRAZO',
      responsavel_nome: 'Carlos Eduardo (Depto. Pessoal)',
      protocolo_observacao: 'DARF INSS/IRRF sobre pró-labore emitido e publicado no Portal da Clínica.'
    },
    {
      id: 'tar-2',
      empresa_id: 'emp-2',
      competencia: '10/2026',
      departamento: 'PESSOAL',
      tipo: 'MENSAL',
      titulo: 'Fechamento de Folha de Funcionários (CLT) e Emissão da Guia FGTS Digital',
      descricao: 'Folha ref. competência 10/2026 com horas extras e comissão de vendedores (entrega em 11/2026).',
      solicitante: 'Rotina Mensal',
      prazo_entrega: '2026-11-05',
      data_entrega: '2026-11-07',
      status: 'ENTREGUE_COM_ATRASO',
      responsavel_nome: 'Carlos Eduardo (Depto. Pessoal)',
      protocolo_observacao: 'Cliente enviou planilha de comissões de Outubro somente dia 06/11. Entregue em 07/11.'
    },
    {
      id: 'tar-3',
      empresa_id: 'emp-1',
      competencia: '10/2026',
      departamento: 'FISCAL',
      tipo: 'MENSAL',
      titulo: 'Apuração PGDAS-D e Emissão da Guia DAS (Simples Nacional)',
      descricao: 'Apurar faturamento de Outubro/2026 (R$ 142.500,00 no Anexo III) com vencimento do DAS em 20/11/2026.',
      solicitante: 'Rotina Mensal',
      prazo_entrega: '2026-11-18',
      data_entrega: null,
      status: 'EM_ANDAMENTO',
      responsavel_nome: 'Mariana Souza (Analista Fiscal)',
      protocolo_observacao: 'Notas de Outubro importadas, conferindo retenções de ISS para transmitir antes de 18/11.'
    },
    {
      id: 'tar-10',
      empresa_id: 'emp-1',
      competencia: '10/2026',
      departamento: 'FISCAL',
      tipo: 'MENSAL',
      titulo: 'DeSTDA / SEDIF-SN e Apuração de DAE ICMS (DIFAL / Antecipação / ST)',
      descricao: 'Conferir compras interestaduais de Outubro/2026, emitir guia DAE ICMS e transmitir DeSTDA até 25/11/2026.',
      solicitante: 'Rotina Mensal',
      prazo_entrega: '2026-11-25',
      data_entrega: null,
      status: 'PENDENTE',
      responsavel_nome: 'Mariana Souza (Analista Fiscal)',
      protocolo_observacao: 'Aguardando confirmação de encerramento de manifesto de notas de entrada.'
    },
    {
      id: 'tar-4',
      empresa_id: 'emp-2',
      competencia: '10/2026',
      departamento: 'FISCAL',
      tipo: 'MENSAL',
      titulo: 'Apuração de PIS, COFINS, ICMS e Entrega da EFD-Contribuições / SPED',
      descricao: 'Fechamento fiscal da competência 10/2026 com entrega e envio das guias em Novembro/2026.',
      solicitante: 'Rotina Mensal',
      prazo_entrega: '2026-11-18',
      data_entrega: null,
      status: 'PENDENTE',
      responsavel_nome: 'Mariana Souza (Analista Fiscal)',
      protocolo_observacao: 'Pendente envio do arquivo Sintegra/SPED pelo ERP do cliente.'
    },
    {
      id: 'tar-5',
      empresa_id: 'emp-3',
      competencia: '10/2026',
      departamento: 'CONTABIL',
      tipo: 'AVULSA',
      titulo: 'Relatório de Faturamento dos Últimos 12 Meses Assinado (Para Banco Itaú)',
      descricao: 'Solicitação aberta pela cliente no Portal do Cliente para renovação de limite bancário.',
      solicitante: 'Dra. Camila Borges (Portal do Cliente)',
      prazo_entrega: '2026-11-12',
      data_entrega: null,
      status: 'EM_ANDAMENTO',
      responsavel_nome: 'Fernanda Lima (Analista Contábil)',
      protocolo_observacao: 'Relatório gerado, aguardando assinatura digital do Contador Sócio.'
    },
    {
      id: 'tar-6',
      empresa_id: 'emp-2',
      competencia: '10/2026',
      departamento: 'SOCIETARIO',
      tipo: 'AVULSA',
      titulo: 'Alteração Contratual - Inclusão de CNAE Secundário e Atualização de Capital',
      descricao: 'Viabilidade, DBE e instrumento de alteração na Junta Comercial a pedido do sócio Marcos.',
      solicitante: 'Marcos Antônio Ribeiro (Portal do Cliente)',
      prazo_entrega: '2026-11-20',
      data_entrega: null,
      status: 'EM_ANDAMENTO',
      responsavel_nome: 'Patrícia Rocha (Societário / Legalização)',
      protocolo_observacao: 'Viabilidade aprovada, aguardando liberação do DBE na Receita Federal.'
    },
    {
      id: 'tar-8',
      empresa_id: 'emp-1',
      competencia: '10/2026',
      departamento: 'CONTABIL',
      tipo: 'MENSAL',
      titulo: 'Conciliação Bancária, Classificação e Fechamento Contábil Mensal (Balancete)',
      descricao: 'Conciliar extratos de Outubro/2026 (Banco Inter e Itaú) e fechar balancete em Novembro/2026.',
      solicitante: 'Rotina Mensal',
      prazo_entrega: '2026-11-25',
      data_entrega: null,
      status: 'EM_ANDAMENTO',
      responsavel_nome: 'Fernanda Lima (Analista Contábil)',
      protocolo_observacao: 'Banco Inter conciliado 100%; falta extrato de aplicação do Itaú.'
    },
    {
      id: 'tar-cont-emp2-10',
      empresa_id: 'emp-2',
      competencia: '10/2026',
      departamento: 'CONTABIL',
      tipo: 'MENSAL',
      titulo: 'Conciliação Bancária, Classificação e Fechamento Contábil Mensal (Balancete)',
      descricao: 'Conciliar contas bancárias, estoque, fornecedores e fechar balancete de Outubro/2026.',
      solicitante: 'Rotina Mensal',
      prazo_entrega: '2026-11-25',
      data_entrega: null,
      status: 'PENDENTE',
      responsavel_nome: 'Fernanda Lima (Analista Contábil)',
      protocolo_observacao: 'Aguardando cliente enviar extratos OFX de Outubro/2026 no Portal.'
    },
    {
      id: 'tar-cont-emp3-10',
      empresa_id: 'emp-3',
      competencia: '10/2026',
      departamento: 'CONTABIL',
      tipo: 'MENSAL',
      titulo: 'Conciliação Bancária, Classificação e Fechamento Contábil Mensal (Balancete)',
      descricao: 'Fechamento contábil mensal e apuração de distribuição de lucros isenta da clínica.',
      solicitante: 'Rotina Mensal',
      prazo_entrega: '2026-11-25',
      data_entrega: '2026-11-08',
      status: 'ENTREGUE_NO_PRAZO',
      responsavel_nome: 'Fernanda Lima (Analista Contábil)',
      protocolo_observacao: 'Balancete 10/2026 fechado, conciliado e publicado no Portal do Cliente.'
    },

    // =========================================================================
    // HISTÓRICO DE FECHAMENTOS CONTÁBEIS DO ANO 2026 (PARA A VISÃO GERAL ANUAL)
    // =========================================================================
    // TechNova (emp-1): Jan a Set/2026 já fechados e entregues!
    { id: 'hist-c-1-01', empresa_id: 'emp-1', competencia: '01/2026', departamento: 'CONTABIL', tipo: 'MENSAL', titulo: 'Conciliação Bancária, Classificação e Fechamento Contábil Mensal (Balancete)', descricao: 'Fechamento contábil 01/2026', solicitante: 'Rotina Mensal', prazo_entrega: '2026-02-25', data_entrega: '2026-02-20', status: 'ENTREGUE_NO_PRAZO', responsavel_nome: 'Fernanda Lima (Analista Contábil)', protocolo_observacao: 'Balancete Jan/2026 fechado e conferido.' },
    { id: 'hist-c-1-02', empresa_id: 'emp-1', competencia: '02/2026', departamento: 'CONTABIL', tipo: 'MENSAL', titulo: 'Conciliação Bancária, Classificação e Fechamento Contábil Mensal (Balancete)', descricao: 'Fechamento contábil 02/2026', solicitante: 'Rotina Mensal', prazo_entrega: '2026-03-25', data_entrega: '2026-03-22', status: 'ENTREGUE_NO_PRAZO', responsavel_nome: 'Fernanda Lima (Analista Contábil)', protocolo_observacao: 'Balancete Fev/2026 fechado.' },
    { id: 'hist-c-1-03', empresa_id: 'emp-1', competencia: '03/2026', departamento: 'CONTABIL', tipo: 'MENSAL', titulo: 'Conciliação Bancária, Classificação e Fechamento Contábil Mensal (Balancete)', descricao: 'Fechamento contábil 03/2026', solicitante: 'Rotina Mensal', prazo_entrega: '2026-04-25', data_entrega: '2026-04-23', status: 'ENTREGUE_NO_PRAZO', responsavel_nome: 'Fernanda Lima (Analista Contábil)', protocolo_observacao: '1º Trimestre conciliado.' },
    { id: 'hist-c-1-04', empresa_id: 'emp-1', competencia: '04/2026', departamento: 'CONTABIL', tipo: 'MENSAL', titulo: 'Conciliação Bancária, Classificação e Fechamento Contábil Mensal (Balancete)', descricao: 'Fechamento contábil 04/2026', solicitante: 'Rotina Mensal', prazo_entrega: '2026-05-25', data_entrega: '2026-05-21', status: 'ENTREGUE_NO_PRAZO', responsavel_nome: 'Fernanda Lima (Analista Contábil)', protocolo_observacao: 'Balancete Abr/2026 fechado.' },
    { id: 'hist-c-1-05', empresa_id: 'emp-1', competencia: '05/2026', departamento: 'CONTABIL', tipo: 'MENSAL', titulo: 'Conciliação Bancária, Classificação e Fechamento Contábil Mensal (Balancete)', descricao: 'Fechamento contábil 05/2026', solicitante: 'Rotina Mensal', prazo_entrega: '2026-06-25', data_entrega: '2026-06-24', status: 'ENTREGUE_NO_PRAZO', responsavel_nome: 'Fernanda Lima (Analista Contábil)', protocolo_observacao: 'Balancete Mai/2026 fechado.' },
    { id: 'hist-c-1-06', empresa_id: 'emp-1', competencia: '06/2026', departamento: 'CONTABIL', tipo: 'MENSAL', titulo: 'Conciliação Bancária, Classificação e Fechamento Contábil Mensal (Balancete)', descricao: 'Fechamento contábil 06/2026', solicitante: 'Rotina Mensal', prazo_entrega: '2026-07-25', data_entrega: '2026-07-22', status: 'ENTREGUE_NO_PRAZO', responsavel_nome: 'Fernanda Lima (Analista Contábil)', protocolo_observacao: '1º Semestre 100% fechado.' },
    { id: 'hist-c-1-07', empresa_id: 'emp-1', competencia: '07/2026', departamento: 'CONTABIL', tipo: 'MENSAL', titulo: 'Conciliação Bancária, Classificação e Fechamento Contábil Mensal (Balancete)', descricao: 'Fechamento contábil 07/2026', solicitante: 'Rotina Mensal', prazo_entrega: '2026-08-25', data_entrega: '2026-08-20', status: 'ENTREGUE_NO_PRAZO', responsavel_nome: 'Fernanda Lima (Analista Contábil)', protocolo_observacao: 'Balancete Jul/2026 fechado.' },
    { id: 'hist-c-1-08', empresa_id: 'emp-1', competencia: '08/2026', departamento: 'CONTABIL', tipo: 'MENSAL', titulo: 'Conciliação Bancária, Classificação e Fechamento Contábil Mensal (Balancete)', descricao: 'Fechamento contábil 08/2026', solicitante: 'Rotina Mensal', prazo_entrega: '2026-09-25', data_entrega: '2026-09-24', status: 'ENTREGUE_NO_PRAZO', responsavel_nome: 'Fernanda Lima (Analista Contábil)', protocolo_observacao: 'Balancete Ago/2026 fechado.' },
    { id: 'hist-c-1-09', empresa_id: 'emp-1', competencia: '09/2026', departamento: 'CONTABIL', tipo: 'MENSAL', titulo: 'Conciliação Bancária, Classificação e Fechamento Contábil Mensal (Balancete)', descricao: 'Fechamento contábil 09/2026', solicitante: 'Rotina Mensal', prazo_entrega: '2026-10-25', data_entrega: '2026-10-23', status: 'ENTREGUE_NO_PRAZO', responsavel_nome: 'Fernanda Lima (Analista Contábil)', protocolo_observacao: '3º Trimestre fechado.' },

    // Horizonte Alimentos (emp-2): Jan a Jul fechados, Ago em andamento, Set pendente
    { id: 'hist-c-2-01', empresa_id: 'emp-2', competencia: '01/2026', departamento: 'CONTABIL', tipo: 'MENSAL', titulo: 'Conciliação Bancária, Classificação e Fechamento Contábil Mensal (Balancete)', descricao: 'Fechamento contábil 01/2026', solicitante: 'Rotina Mensal', prazo_entrega: '2026-02-25', data_entrega: '2026-02-24', status: 'ENTREGUE_NO_PRAZO', responsavel_nome: 'Fernanda Lima (Analista Contábil)', protocolo_observacao: 'Fechado.' },
    { id: 'hist-c-2-02', empresa_id: 'emp-2', competencia: '02/2026', departamento: 'CONTABIL', tipo: 'MENSAL', titulo: 'Conciliação Bancária, Classificação e Fechamento Contábil Mensal (Balancete)', descricao: 'Fechamento contábil 02/2026', solicitante: 'Rotina Mensal', prazo_entrega: '2026-03-25', data_entrega: '2026-03-25', status: 'ENTREGUE_NO_PRAZO', responsavel_nome: 'Fernanda Lima (Analista Contábil)', protocolo_observacao: 'Fechado.' },
    { id: 'hist-c-2-03', empresa_id: 'emp-2', competencia: '03/2026', departamento: 'CONTABIL', tipo: 'MENSAL', titulo: 'Conciliação Bancária, Classificação e Fechamento Contábil Mensal (Balancete)', descricao: 'Fechamento contábil 03/2026', solicitante: 'Rotina Mensal', prazo_entrega: '2026-04-25', data_entrega: '2026-04-28', status: 'ENTREGUE_COM_ATRASO', responsavel_nome: 'Fernanda Lima (Analista Contábil)', protocolo_observacao: 'Fechado após ajuste de inventário.' },
    { id: 'hist-c-2-04', empresa_id: 'emp-2', competencia: '04/2026', departamento: 'CONTABIL', tipo: 'MENSAL', titulo: 'Conciliação Bancária, Classificação e Fechamento Contábil Mensal (Balancete)', descricao: 'Fechamento contábil 04/2026', solicitante: 'Rotina Mensal', prazo_entrega: '2026-05-25', data_entrega: '2026-05-22', status: 'ENTREGUE_NO_PRAZO', responsavel_nome: 'Fernanda Lima (Analista Contábil)', protocolo_observacao: 'Fechado.' },
    { id: 'hist-c-2-05', empresa_id: 'emp-2', competencia: '05/2026', departamento: 'CONTABIL', tipo: 'MENSAL', titulo: 'Conciliação Bancária, Classificação e Fechamento Contábil Mensal (Balancete)', descricao: 'Fechamento contábil 05/2026', solicitante: 'Rotina Mensal', prazo_entrega: '2026-06-25', data_entrega: '2026-06-23', status: 'ENTREGUE_NO_PRAZO', responsavel_nome: 'Fernanda Lima (Analista Contábil)', protocolo_observacao: 'Fechado.' },
    { id: 'hist-c-2-06', empresa_id: 'emp-2', competencia: '06/2026', departamento: 'CONTABIL', tipo: 'MENSAL', titulo: 'Conciliação Bancária, Classificação e Fechamento Contábil Mensal (Balancete)', descricao: 'Fechamento contábil 06/2026', solicitante: 'Rotina Mensal', prazo_entrega: '2026-07-25', data_entrega: '2026-07-24', status: 'ENTREGUE_NO_PRAZO', responsavel_nome: 'Fernanda Lima (Analista Contábil)', protocolo_observacao: '1º Semestre encerrado.' },
    { id: 'hist-c-2-07', empresa_id: 'emp-2', competencia: '07/2026', departamento: 'CONTABIL', tipo: 'MENSAL', titulo: 'Conciliação Bancária, Classificação e Fechamento Contábil Mensal (Balancete)', descricao: 'Fechamento contábil 07/2026', solicitante: 'Rotina Mensal', prazo_entrega: '2026-08-25', data_entrega: '2026-08-25', status: 'ENTREGUE_NO_PRAZO', responsavel_nome: 'Fernanda Lima (Analista Contábil)', protocolo_observacao: 'Fechado.' },
    { id: 'hist-c-2-08', empresa_id: 'emp-2', competencia: '08/2026', departamento: 'CONTABIL', tipo: 'MENSAL', titulo: 'Conciliação Bancária, Classificação e Fechamento Contábil Mensal (Balancete)', descricao: 'Fechamento contábil 08/2026', solicitante: 'Rotina Mensal', prazo_entrega: '2026-09-25', data_entrega: null, status: 'EM_ANDAMENTO', responsavel_nome: 'Fernanda Lima (Analista Contábil)', protocolo_observacao: 'Conferindo saldo da conta Fornecedores e parcelamento PGFN.' },
    { id: 'hist-c-2-09', empresa_id: 'emp-2', competencia: '09/2026', departamento: 'CONTABIL', tipo: 'MENSAL', titulo: 'Conciliação Bancária, Classificação e Fechamento Contábil Mensal (Balancete)', descricao: 'Fechamento contábil 09/2026', solicitante: 'Rotina Mensal', prazo_entrega: '2026-10-25', data_entrega: null, status: 'PENDENTE', responsavel_nome: 'Fernanda Lima (Analista Contábil)', protocolo_observacao: 'Falta extrato Banco do Brasil de Setembro/2026.' },

    // Clínica Vida Plena (emp-3): Jan a Out/2026 100% fechados!
    { id: 'hist-c-3-01', empresa_id: 'emp-3', competencia: '01/2026', departamento: 'CONTABIL', tipo: 'MENSAL', titulo: 'Conciliação Bancária, Classificação e Fechamento Contábil Mensal (Balancete)', descricao: 'Fechamento contábil 01/2026', solicitante: 'Rotina Mensal', prazo_entrega: '2026-02-25', data_entrega: '2026-02-18', status: 'ENTREGUE_NO_PRAZO', responsavel_nome: 'Fernanda Lima (Analista Contábil)', protocolo_observacao: 'Fechado.' },
    { id: 'hist-c-3-02', empresa_id: 'emp-3', competencia: '02/2026', departamento: 'CONTABIL', tipo: 'MENSAL', titulo: 'Conciliação Bancária, Classificação e Fechamento Contábil Mensal (Balancete)', descricao: 'Fechamento contábil 02/2026', solicitante: 'Rotina Mensal', prazo_entrega: '2026-03-25', data_entrega: '2026-03-19', status: 'ENTREGUE_NO_PRAZO', responsavel_nome: 'Fernanda Lima (Analista Contábil)', protocolo_observacao: 'Fechado.' },
    { id: 'hist-c-3-03', empresa_id: 'emp-3', competencia: '03/2026', departamento: 'CONTABIL', tipo: 'MENSAL', titulo: 'Conciliação Bancária, Classificação e Fechamento Contábil Mensal (Balancete)', descricao: 'Fechamento contábil 03/2026', solicitante: 'Rotina Mensal', prazo_entrega: '2026-04-25', data_entrega: '2026-04-20', status: 'ENTREGUE_NO_PRAZO', responsavel_nome: 'Fernanda Lima (Analista Contábil)', protocolo_observacao: 'Fechado.' },
    { id: 'hist-c-3-04', empresa_id: 'emp-3', competencia: '04/2026', departamento: 'CONTABIL', tipo: 'MENSAL', titulo: 'Conciliação Bancária, Classificação e Fechamento Contábil Mensal (Balancete)', descricao: 'Fechamento contábil 04/2026', solicitante: 'Rotina Mensal', prazo_entrega: '2026-05-25', data_entrega: '2026-05-19', status: 'ENTREGUE_NO_PRAZO', responsavel_nome: 'Fernanda Lima (Analista Contábil)', protocolo_observacao: 'Fechado.' },
    { id: 'hist-c-3-05', empresa_id: 'emp-3', competencia: '05/2026', departamento: 'CONTABIL', tipo: 'MENSAL', titulo: 'Conciliação Bancária, Classificação e Fechamento Contábil Mensal (Balancete)', descricao: 'Fechamento contábil 05/2026', solicitante: 'Rotina Mensal', prazo_entrega: '2026-06-25', data_entrega: '2026-06-18', status: 'ENTREGUE_NO_PRAZO', responsavel_nome: 'Fernanda Lima (Analista Contábil)', protocolo_observacao: 'Fechado.' },
    { id: 'hist-c-3-06', empresa_id: 'emp-3', competencia: '06/2026', departamento: 'CONTABIL', tipo: 'MENSAL', titulo: 'Conciliação Bancária, Classificação e Fechamento Contábil Mensal (Balancete)', descricao: 'Fechamento contábil 06/2026', solicitante: 'Rotina Mensal', prazo_entrega: '2026-07-25', data_entrega: '2026-07-20', status: 'ENTREGUE_NO_PRAZO', responsavel_nome: 'Fernanda Lima (Analista Contábil)', protocolo_observacao: 'Fechado.' },
    { id: 'hist-c-3-07', empresa_id: 'emp-3', competencia: '07/2026', departamento: 'CONTABIL', tipo: 'MENSAL', titulo: 'Conciliação Bancária, Classificação e Fechamento Contábil Mensal (Balancete)', descricao: 'Fechamento contábil 07/2026', solicitante: 'Rotina Mensal', prazo_entrega: '2026-08-25', data_entrega: '2026-08-19', status: 'ENTREGUE_NO_PRAZO', responsavel_nome: 'Fernanda Lima (Analista Contábil)', protocolo_observacao: 'Fechado.' },
    { id: 'hist-c-3-08', empresa_id: 'emp-3', competencia: '08/2026', departamento: 'CONTABIL', tipo: 'MENSAL', titulo: 'Conciliação Bancária, Classificação e Fechamento Contábil Mensal (Balancete)', descricao: 'Fechamento contábil 08/2026', solicitante: 'Rotina Mensal', prazo_entrega: '2026-09-25', data_entrega: '2026-09-18', status: 'ENTREGUE_NO_PRAZO', responsavel_nome: 'Fernanda Lima (Analista Contábil)', protocolo_observacao: 'Fechado.' },
    { id: 'hist-c-3-09', empresa_id: 'emp-3', competencia: '09/2026', departamento: 'CONTABIL', tipo: 'MENSAL', titulo: 'Conciliação Bancária, Classificação e Fechamento Contábil Mensal (Balancete)', descricao: 'Fechamento contábil 09/2026', solicitante: 'Rotina Mensal', prazo_entrega: '2026-10-25', data_entrega: '2026-10-20', status: 'ENTREGUE_NO_PRAZO', responsavel_nome: 'Fernanda Lima (Analista Contábil)', protocolo_observacao: 'Fechado.' }
  ],

  // ===========================================================================
  // CONTROLE DE ENVIO DE GUIAS DE IMPOSTOS (SIMPLES NACIONAL, DAE ICMS, DARFs...)
  // ===========================================================================
  guias_impostos: [
    {
      id: 'gimp-1',
      empresa_id: 'emp-1',
      competencia: '10/2026',
      tipo_guia: 'DAS - Simples Nacional',
      departamento: 'FISCAL',
      valor: 8540.20,
      data_vencimento: '2026-11-20',
      status_envio: 'ENVIADA_CLIENTE',
      data_envio: '2026-11-08',
      canal_envio: 'Portal do Cliente + WhatsApp',
      responsavel_nome: 'Mariana Souza (Analista Fiscal)',
      observacoes: 'Disponibilizada no Portal do Cliente e enviada ao sócio Henrique.'
    },
    {
      id: 'gimp-1-darf',
      empresa_id: 'emp-1',
      competencia: '10/2026',
      tipo_guia: 'DARF - DCTFWeb / INSS / IRRF (Pró-Labore / Folha)',
      departamento: 'PESSOAL',
      valor: 3420.15,
      data_vencimento: '2026-11-20',
      status_envio: 'ENVIADA_CLIENTE',
      data_envio: '2026-11-05',
      canal_envio: 'Portal do Cliente + E-mail',
      responsavel_nome: 'Carlos Eduardo (Depto. Pessoal)',
      observacoes: 'DARF INSS/IRRF (Pró-Labore + Folha CLT).'
    },
    {
      id: 'gimp-3',
      empresa_id: 'emp-1',
      competencia: '10/2026',
      tipo_guia: 'FGTS Digital - Guia Mensal (Funcionários CLT)',
      departamento: 'PESSOAL',
      valor: 2180.00,
      data_vencimento: '2026-11-20',
      status_envio: 'ENVIADA_CLIENTE',
      data_envio: '2026-11-05',
      canal_envio: 'Portal do Cliente + E-mail',
      responsavel_nome: 'Carlos Eduardo (Depto. Pessoal)',
      observacoes: 'Guia FGTS Digital dos 8 funcionários CLT.'
    },
    {
      id: 'gimp-emp3-darf',
      empresa_id: 'emp-3',
      competencia: '10/2026',
      tipo_guia: 'DARF - DCTFWeb / INSS / IRRF (Pró-Labore / Folha)',
      departamento: 'PESSOAL',
      valor: 1185.40,
      data_vencimento: '2026-11-20',
      status_envio: 'ENVIADA_CLIENTE',
      data_envio: '2026-11-06',
      canal_envio: 'Portal do Cliente + WhatsApp',
      responsavel_nome: 'Carlos Eduardo (Depto. Pessoal)',
      observacoes: 'Referente exclusivamente ao Pró-Labore das sócias (Clínica não possui funcionários CLT, não gera FGTS).'
    },
    {
      id: 'gimp-2',
      empresa_id: 'emp-4',
      competencia: '10/2026',
      tipo_guia: 'DAE / DARE - ICMS (Antecipação / DIFAL / ST)',
      departamento: 'FISCAL',
      valor: 1290.50,
      data_vencimento: '2026-11-20',
      status_envio: 'GERADA_AGUARDANDO_ENVIO',
      data_envio: null,
      canal_envio: 'Portal do Cliente + WhatsApp',
      responsavel_nome: 'Mariana Souza (Analista Fiscal)',
      observacoes: 'DAE ICMS DIFAL de compra de materiais fora do Estado.'
    },
    {
      id: 'gimp-4',
      empresa_id: 'emp-2',
      competencia: '10/2026',
      tipo_guia: 'DARF - PIS / COFINS',
      departamento: 'FISCAL',
      valor: 6430.90,
      data_vencimento: '2026-11-25',
      status_envio: 'PENDENTE_GERACAO',
      data_envio: null,
      canal_envio: 'Portal do Cliente',
      responsavel_nome: 'Mariana Souza (Analista Fiscal)',
      observacoes: 'Aguardando fechamento do SPED Contribuições.'
    },
    {
      id: 'gimp-5',
      empresa_id: 'emp-2',
      competencia: '10/2026',
      tipo_guia: 'DAE / DARE - ICMS (Antecipação / DIFAL / ST)',
      departamento: 'FISCAL',
      valor: 4820.00,
      data_vencimento: '2026-11-20',
      status_envio: 'GERADA_AGUARDANDO_ENVIO',
      data_envio: null,
      canal_envio: 'Portal do Cliente + WhatsApp',
      responsavel_nome: 'Mariana Souza (Analista Fiscal)',
      observacoes: 'Guia ICMS-ST apurada, pronta para envio.'
    }
  ],

  // ===========================================================================
  // PARCELAMENTOS ATIVOS (Status: ATIVO, EM_ATRASO, ENCERRADO_FALTA_PAGAMENTO, ENCERRADO_OPCAO)
  // ===========================================================================
  parcelamentos: [
    {
      id: 'parc-1',
      empresa_id: 'emp-1',
      orgao: 'Simples Nacional / Receita Federal',
      modalidade: 'Parcelamento Ordinário Simples Nacional',
      numero_processo: '08192.441029/2025-11',
      total_parcelas: 60,
      parcelas_pagas: 14,
      valor_consolidado: 54000.00,
      valor_parcela_estimado: 1085.40,
      dia_vencimento: 28,
      data_inicio: '2025-09-01',
      status: 'ATIVO',
      observacoes: 'Emitir DAS de parcelamento todo mês pelo e-CAC / Portal do Simples.'
    },
    {
      id: 'parc-2',
      empresa_id: 'emp-2',
      orgao: 'PGFN / Regularize (Dívida Ativa da União)',
      modalidade: 'Transação Tributária PGFN - Edital Pequeno Valor',
      numero_processo: '00492.882310/2024-90',
      total_parcelas: 48,
      parcelas_pagas: 21,
      valor_consolidado: 118500.00,
      valor_parcela_estimado: 2640.00,
      dia_vencimento: 28,
      data_inicio: '2025-02-01',
      status: 'EM_ATRASO',
      observacoes: 'ATENÇÃO: Parcelamento em atraso (possui parcela da competência anterior em aberto no Regularize).'
    },
    {
      id: 'parc-3',
      empresa_id: 'emp-2',
      orgao: 'SEFAZ Estadual (ICMS)',
      modalidade: 'Parcelamento Ordinário ICMS (DAE/DARE)',
      numero_processo: '100.449.281-7',
      total_parcelas: 36,
      parcelas_pagas: 10,
      valor_consolidado: 43200.00,
      valor_parcela_estimado: 1315.80,
      dia_vencimento: 25,
      data_inicio: '2026-01-25',
      status: 'ATIVO',
      observacoes: 'Guia DAE/DARE emitida no portal da SEFAZ.'
    },
    {
      id: 'parc-4',
      empresa_id: 'emp-3',
      orgao: 'Prefeitura Municipal (ISS)',
      modalidade: 'PPI / Parcelamento Administrativo ISS',
      numero_processo: '2026.0019283-4',
      total_parcelas: 24,
      parcelas_pagas: 6,
      valor_consolidado: 19200.00,
      valor_parcela_estimado: 845.00,
      dia_vencimento: 20,
      data_inicio: '2026-05-20',
      status: 'ATIVO',
      observacoes: 'Emitir DAMSP no portal municipal até o dia 15.'
    }
  ],

  parcelamento_guias: [
    {
      id: 'guia-1',
      parcelamento_id: 'parc-1',
      empresa_id: 'emp-1',
      competencia: '10/2026',
      numero_parcela: 15,
      data_vencimento: '2026-11-28',
      valor_guia: 1094.20,
      status_guia: 'ENVIADA_CLIENTE',
      data_emissao: '2026-11-04',
      data_envio_cliente: '2026-11-04',
      parcelas_anteriores_abertas: 0,
      detalhe_pendencia_anterior: '',
      responsavel_nome: 'Mariana Souza (Analista Fiscal)',
      observacao: 'Guia DAS Parcela 15/60 emitida e publicada no Portal do Cliente.'
    },
    {
      id: 'guia-2',
      parcelamento_id: 'parc-2',
      empresa_id: 'emp-2',
      competencia: '10/2026',
      numero_parcela: 22,
      data_vencimento: '2026-11-28',
      valor_guia: 2668.50,
      status_guia: 'EMITIDA',
      data_emissao: '2026-11-06',
      data_envio_cliente: null,
      parcelas_anteriores_abertas: 1,
      detalhe_pendencia_anterior: 'Parcela #21 (Comp. 09/2026 - R$ 2.640,00) consta EM ATRASO / ABERTO!',
      responsavel_nome: 'Mariana Souza (Analista Fiscal)',
      observacao: 'DARF PGFN emitido no Regularize. Falta enviar ao cliente.'
    },
    {
      id: 'guia-3',
      parcelamento_id: 'parc-3',
      empresa_id: 'emp-2',
      competencia: '10/2026',
      numero_parcela: 11,
      data_vencimento: '2026-11-25',
      valor_guia: 1322.10,
      status_guia: 'PENDENTE_EMISSAO',
      data_emissao: null,
      data_envio_cliente: null,
      parcelas_anteriores_abertas: 0,
      detalhe_pendencia_anterior: '',
      responsavel_nome: 'Mariana Souza (Analista Fiscal)',
      observacao: 'Aguardando atualização da taxa SELIC no portal SEFAZ.'
    },
    {
      id: 'guia-4',
      parcelamento_id: 'parc-4',
      empresa_id: 'emp-3',
      competencia: '10/2026',
      numero_parcela: 7,
      data_vencimento: '2026-11-20',
      valor_guia: 845.00,
      status_guia: 'ENVIADA_CLIENTE',
      data_emissao: '2026-11-03',
      data_envio_cliente: '2026-11-03',
      parcelas_anteriores_abertas: 0,
      detalhe_pendencia_anterior: '',
      responsavel_nome: 'Roberto Alves (Financeiro & Honorários)',
      observacao: 'Guia ISS disponibilizada no Portal do Cliente.'
    }
  ],

  // ===========================================================================
  // CONTROLE DE CNDs (CERTIDÕES NEGATIVAS DE DÉBITOS)
  // ===========================================================================
  cnds: [
    {
      id: 'cnd-1',
      empresa_id: 'emp-1',
      tipo_cnd: 'CND Federal (RFB / PGFN / INSS)',
      orgao: 'CND Federal (RFB / PGFN / INSS)',
      situacao: 'POSITIVA_EFEITO_NEGATIVA',
      data_emissao: '2026-08-15',
      data_validade: '2027-02-11',
       data_vencimento: '2027-02-11',
      codigo_controle: 'A8F2.9910.44B1.C029',
      numero_controle: 'A8F2.9910.44B1.C029',
      responsavel_nome: 'Patrícia Rocha (Societário / Legalização)',
      arquivo_pdf_nome: 'CND_Federal_TechNova_2026.pdf',
      origem_emissao: 'API_INTEGRA_CONTADOR',
      api_status: 'SYNCED',
      observacoes: 'Certidão Positiva com Efeitos de Negativa devido ao parcelamento Simples Nacional em dia.'
    },
    {
      id: 'cnd-2',
      empresa_id: 'emp-1',
      tipo_cnd: 'CRF - Regularidade do FGTS (Caixa)',
      orgao: 'CRF - Regularidade do FGTS (Caixa)',
      situacao: 'NEGATIVA',
      data_emissao: '2026-10-25',
      data_validade: '2026-11-23',
      data_vencimento: '2026-11-23',
      codigo_controle: '202610250918273645',
      numero_controle: '202610250918273645',
      responsavel_nome: 'Carlos Eduardo (Depto. Pessoal)',
      arquivo_pdf_nome: 'CRF_FGTS_TechNova_2026.pdf',
      origem_emissao: 'API_INTEGRA_CONTADOR',
      api_status: 'SYNCED',
      observacoes: 'Regular no FGTS Digital.'
    },
    {
      id: 'cnd-3',
      empresa_id: 'emp-2',
      tipo_cnd: 'CND Federal (RFB / PGFN / INSS)',
      orgao: 'CND Federal (RFB / PGFN / INSS)',
      situacao: 'POSITIVA_COM_PENDENCIA',
      data_emissao: '2026-11-02',
      data_validade: '2026-11-02',
      data_vencimento: '2026-11-02',
      codigo_controle: 'PENDENCIA-ECAC-2026',
      numero_controle: 'PENDENCIA-ECAC-2026',
      responsavel_nome: 'Mariana Souza (Analista Fiscal)',
      arquivo_pdf_nome: '',
      origem_emissao: 'MANUAL_PDF',
      api_status: 'READY',
      observacoes: 'Consta 1 parcela em atraso da Transação PGFN no Regularize impedindo renovação da CND.'
    },
    {
      id: 'cnd-4',
      empresa_id: 'emp-2',
      tipo_cnd: 'CND Estadual (SEFAZ / ICMS)',
      orgao: 'CND Estadual (SEFAZ / ICMS)',
      situacao: 'POSITIVA_EFEITO_NEGATIVA',
      data_emissao: '2026-09-20',
      data_validade: '2026-12-19',
      data_vencimento: '2026-12-19',
      codigo_controle: 'SEFAZ-998123-2026',
      numero_controle: 'SEFAZ-998123-2026',
      responsavel_nome: 'Mariana Souza (Analista Fiscal)',
      arquivo_pdf_nome: 'CND_Estadual_SEFAZ_Horizonte.pdf',
      origem_emissao: 'API_INTEGRA_CONTADOR',
      api_status: 'SYNCED',
      observacoes: 'Válida por 90 dias (acordo ICMS ativo).'
    },
    {
      id: 'cnd-5',
      empresa_id: 'emp-3',
      tipo_cnd: 'CND Municipal (Prefeitura / ISS)',
      orgao: 'CND Municipal (Prefeitura / ISS)',
      situacao: 'NEGATIVA',
      data_emissao: '2026-08-18',
      data_validade: '2026-11-16',
      data_vencimento: '2026-11-16',
      codigo_controle: 'PM-00192834-26',
      numero_controle: 'PM-00192834-26',
      responsavel_nome: 'Patrícia Rocha (Societário / Legalização)',
      arquivo_pdf_nome: '',
      origem_emissao: 'MANUAL_PDF',
      api_status: 'READY',
      observacoes: 'Atenção: Vence nos próximos dias! Necessária para credenciamento de convênios médicos.'
    },
    {
      id: 'cnd-6',
      empresa_id: 'emp-3',
      tipo_cnd: 'CNDT - Certidão Negativa Trabalhista (TST)',
      orgao: 'CNDT - Certidão Negativa Trabalhista (TST)',
      situacao: 'NEGATIVA',
      data_emissao: '2026-09-01',
      data_validade: '2027-02-28',
      data_vencimento: '2027-02-28',
      codigo_controle: '19283746/2026',
      numero_controle: '19283746/2026',
      responsavel_nome: 'Carlos Eduardo (Depto. Pessoal)',
      arquivo_pdf_nome: 'CNDT_Trabalhista_VidaPlena.pdf',
      origem_emissao: 'API_INTEGRA_CONTADOR',
      api_status: 'SYNCED',
      observacoes: 'Sem pendências trabalhistas.'
    }
  ],

  // ===========================================================================
  // PORTAL DO CLIENTE: COFRE DE ARQUIVOS E DOCUMENTOS DA EMPRESA
  // ===========================================================================
  portal_arquivos: [
    {
      id: 'arq-1',
      empresa_id: 'emp-1',
      pasta: 'CONSTITUTIVOS',
      titulo: 'Contrato Social Consolidado (4ª Alteração JUCESP)',
      nome_arquivo: 'Contrato_Social_TechNova_4a_Alteracao.pdf',
      tamanho: '1.4 MB',
      competencia: 'Permanente',
      data_upload: '2026-01-15',
      vencimento: null,
      valor: 0,
      enviado_por: 'Patrícia Rocha (Societário / Legalização)',
      observacao: 'Documento constitutivo atualizado com cláusula de administração e capital social de R$ 250.000,00.',
      conteudo_url: ''
    },
    {
      id: 'arq-2',
      empresa_id: 'emp-1',
      pasta: 'CONSTITUTIVOS',
      titulo: 'Cartão CNPJ Receita Federal e Comprovante de Inscrição Municipal CCM',
      nome_arquivo: 'Cartao_CNPJ_e_CCM_TechNova.pdf',
      tamanho: '420 KB',
      competencia: 'Permanente',
      data_upload: '2026-01-15',
      vencimento: null,
      valor: 0,
      enviado_por: 'Patrícia Rocha (Societário / Legalização)',
      observacao: 'Comprovante oficial de inscrição cadastral ativa.',
      conteudo_url: ''
    },
    {
      id: 'arq-3',
      empresa_id: 'emp-1',
      pasta: 'GUIAS_IMPOSTOS',
      titulo: 'Guia DAS Simples Nacional — Competência 10/2026',
      nome_arquivo: 'DAS_Simples_Nacional_10_2026_TechNova.pdf',
      tamanho: '285 KB',
      competencia: '10/2026',
      data_upload: '2026-11-08',
      vencimento: '2026-11-20',
      valor: 8540.20,
      enviado_por: 'Mariana Souza (Analista Fiscal)',
      observacao: 'Pagar até 20/11/2026 via PIX no QR Code da guia ou código de barras.',
      conteudo_url: ''
    },
    {
      id: 'arq-4',
      empresa_id: 'emp-1',
      pasta: 'GUIAS_IMPOSTOS',
      titulo: 'DARF Previdenciário INSS/IRRF (Pró-Labore + Folha) — Comp. 10/2026',
      nome_arquivo: 'DARF_DCTFWeb_INSS_IRRF_10_2026.pdf',
      tamanho: '310 KB',
      competencia: '10/2026',
      data_upload: '2026-11-05',
      vencimento: '2026-11-20',
      valor: 3420.15,
      enviado_por: 'Carlos Eduardo (Depto. Pessoal)',
      observacao: 'Guia DARF unificada DCTFWeb (INSS e IRRF sobre Pró-Labore e Folha).',
      conteudo_url: ''
    },
    {
      id: 'arq-5',
      empresa_id: 'emp-1',
      pasta: 'CONTABIL_FOLHA',
      titulo: 'Balancete Contábil e DRE Assinados — 3º Trimestre/2026',
      nome_arquivo: 'Balancete_e_DRE_Set2026_TechNova.pdf',
      tamanho: '890 KB',
      competencia: '09/2026',
      data_upload: '2026-10-23',
      vencimento: null,
      valor: 0,
      enviado_por: 'Fernanda Lima (Analista Contábil)',
      observacao: 'Assinado digitalmente pelo Contador e disponível para bancos e fornecedores.',
      conteudo_url: ''
    },
    {
      id: 'arq-6',
      empresa_id: 'emp-2',
      pasta: 'CONSTITUTIVOS',
      titulo: 'Contrato Social e Ficha Cadastral SEFAZ (IE Ativa)',
      nome_arquivo: 'Contrato_Social_Horizonte_Alimentos.pdf',
      tamanho: '2.1 MB',
      competencia: 'Permanente',
      data_upload: '2026-02-10',
      vencimento: null,
      valor: 0,
      enviado_por: 'Patrícia Rocha (Societário / Legalização)',
      observacao: 'Atos constitutivos arquivados na Junta Comercial.',
      conteudo_url: ''
    },
    {
      id: 'arq-7',
      empresa_id: 'emp-3',
      pasta: 'CONSTITUTIVOS',
      titulo: 'Contrato Social Sociedade Simples (Registro Cartório) & Alvará Vigilância Sanitária',
      nome_arquivo: 'Contrato_Social_e_Alvara_Clinica_Vida_Plena.pdf',
      tamanho: '1.8 MB',
      competencia: 'Permanente',
      data_upload: '2026-03-05',
      vencimento: null,
      valor: 0,
      enviado_por: 'Patrícia Rocha (Societário / Legalização)',
      observacao: 'Documentos constitutivos e licença sanitária da clínica.',
      conteudo_url: ''
    },
    {
      id: 'arq-8',
      empresa_id: 'emp-3',
      pasta: 'GUIAS_IMPOSTOS',
      titulo: 'DARF INSS / IRRF sobre Pró-Labore das Sócias — Comp. 10/2026',
      nome_arquivo: 'DARF_INSS_ProLabore_10_2026_Clinica.pdf',
      tamanho: '240 KB',
      competencia: '10/2026',
      data_upload: '2026-11-06',
      vencimento: '2026-11-20',
      valor: 1185.40,
      enviado_por: 'Carlos Eduardo (Depto. Pessoal)',
      observacao: 'Guia DARF do Pró-Labore com vencimento em 20/11/2026.',
      conteudo_url: ''
    }
  ],

  // ===========================================================================
  // PORTAL DO CLIENTE: SOLICITAÇÕES DO CLIENTE PARA A CONTABILIDADE
  // ===========================================================================
  central_cliente_registros: [
    {
      id: 'cc-1',
      empresa_id: 'emp-1',
      categoria: 'SOLICITACAO',
      departamento: 'PESSOAL',
      titulo: 'Simulação de Custos para Contratação de Novo Desenvolvedor Pleno (CLT)',
      descricao: 'Solicito simulação de encargos mensais (INSS, FGTS, Férias e 13º) para salário base de R$ 6.500,00.',
      solicitante_cliente: 'Henrique Vasconcelos (Sócio)',
      canal: 'Portal do Cliente',
      data_registro: '2026-11-08',
      prazo_desejado: '2026-11-12',
      responsavel_nome: 'Carlos Eduardo (Depto. Pessoal)',
      status: 'CONCLUIDO',
      resposta_contabilidade: 'Planilha comparativa de custo CLT enviada e anexada na pasta Folha/Contábil. Custo total mensal estimado: R$ 8.940,00.',
      tarefa_vinculada_id: ''
    },
    {
      id: 'cc-2',
      empresa_id: 'emp-3',
      categoria: 'SOLICITACAO',
      departamento: 'CONTABIL',
      titulo: 'Relatório de Faturamento dos Últimos 12 Meses Assinado (Para Banco Itaú)',
      descricao: 'Precisamos da relação de faturamento dos últimos 12 meses assinada pelo contador para renovação do limite da conta PJ no Itaú.',
      solicitante_cliente: 'Dra. Camila Borges',
      canal: 'Portal do Cliente',
      data_registro: '2026-11-05',
      prazo_desejado: '2026-11-12',
      responsavel_nome: 'Fernanda Lima (Analista Contábil)',
      status: 'EM_ANDAMENTO',
      resposta_contabilidade: 'Relatório já emitido pelo setor Contábil, aguardando assinatura digital para disponibilizar no cofre.',
      tarefa_vinculada_id: 'tar-5'
    },
    {
      id: 'cc-3',
      empresa_id: 'emp-2',
      categoria: 'SOLICITACAO',
      departamento: 'SOCIETARIO',
      titulo: 'Inclusão de CNAE Secundário de Atacado e Atualização de Capital Social',
      descricao: 'Solicito iniciar alteração contratual para incluir comércio atacadista de bebidas e elevar o capital social.',
      solicitante_cliente: 'Marcos Antônio Ribeiro',
      canal: 'Portal do Cliente',
      data_registro: '2026-11-04',
      prazo_desejado: '2026-11-20',
      responsavel_nome: 'Patrícia Rocha (Societário / Legalização)',
      status: 'EM_ANDAMENTO',
      resposta_contabilidade: 'Pedido de viabilidade aprovado na Junta Comercial. DBE transmitido na Receita Federal.',
      tarefa_vinculada_id: 'tar-6'
    }
  ],

  // ===========================================================================
  // HONORÁRIOS DA COMPETÊNCIA 10/2026 -> VENCIMENTO EM NOVEMBRO/2026 (11/2026)
  // ===========================================================================
  honorarios: [
    {
      id: 'hon-prev-2',
      empresa_id: 'emp-2',
      competencia: '09/2026',
      data_vencimento: '2026-10-10',
      valor_mensal: 2800.00,
      saldo_anterior: 0.00,
      competencia_saldo_anterior: '',
      servicos_extras: 0.00,
      desconto: 0.00,
      valor_pago: 2300.00,
      saldo_aberto: 500.00,
      status: 'PARCIAL',
      observacoes: 'Restou saldo de R$ 500,00 da competência 09/2026 transferido para complementar 10/2026.'
    },
    {
      id: 'hon-1',
      empresa_id: 'emp-1',
      competencia: '10/2026',
      data_vencimento: '2026-11-10',
      valor_mensal: 1450.00,
      saldo_anterior: 0.00,
      competencia_saldo_anterior: '',
      servicos_extras: 0.00,
      desconto: 0.00,
      valor_pago: 1450.00,
      saldo_aberto: 0.00,
      status: 'PAGO',
      observacoes: 'Honorário ref. competência 10/2026 (vencimento 10/11/2026) quitado via PIX.'
    },
    {
      id: 'hon-2',
      empresa_id: 'emp-2',
      competencia: '10/2026',
      data_vencimento: '2026-11-10',
      valor_mensal: 2800.00,
      saldo_anterior: 500.00,
      competencia_saldo_anterior: '09/2026',
      servicos_extras: 450.00,
      desconto: 0.00,
      valor_pago: 1500.00,
      saldo_aberto: 2250.00,
      status: 'PARCIAL',
      observacoes: 'Inclui R$ 500,00 em aberto de 09/2026 + R$ 450,00 alteração contratual. Cliente adiantou R$ 1.500,00 via PIX dia 06/11 e restam R$ 2.250,00.'
    },
    {
      id: 'hon-3',
      empresa_id: 'emp-3',
      competencia: '10/2026',
      data_vencimento: '2026-11-15',
      valor_mensal: 1950.00,
      saldo_anterior: 0.00,
      competencia_saldo_anterior: '',
      servicos_extras: 180.00,
      desconto: 0.00,
      valor_pago: 0.00,
      saldo_aberto: 2130.00,
      status: 'ABERTO',
      observacoes: 'Honorário ref. competência 10/2026 com vencimento em 15/11/2026. Imprimir recibo PIX para cobrança.'
    },
    {
      id: 'hon-4',
      empresa_id: 'emp-4',
      competencia: '10/2026',
      data_vencimento: '2026-11-10',
      valor_mensal: 2200.00,
      saldo_anterior: 0.00,
      competencia_saldo_anterior: '',
      servicos_extras: 0.00,
      desconto: 200.00,
      valor_pago: 1000.00,
      saldo_aberto: 1000.00,
      status: 'PARCIAL',
      observacoes: 'Implantação/Onboarding (vence 10/11/2026): 50% pago na assinatura via PIX e R$ 1.000,00 em aberto.'
    }
  ],

  honorario_pagamentos: [
    {
      id: 'pag-prev-2',
      honorario_id: 'hon-prev-2',
      empresa_id: 'emp-2',
      data_pagamento: '2026-10-10',
      valor: 2300.00,
      forma_pagamento: 'PIX',
      observacao: 'Pagamento parcial competência 09/2026 (restou R$ 500,00 para o próximo mês)',
      registrado_por: 'Roberto Alves (Financeiro & Honorários)'
    },
    {
      id: 'pag-1',
      honorario_id: 'hon-1',
      empresa_id: 'emp-1',
      data_pagamento: '2026-11-08',
      valor: 1450.00,
      forma_pagamento: 'PIX',
      observacao: 'Pagamento integral competência 10/2026 (venc. 10/11/2026)',
      registrado_por: 'Roberto Alves (Financeiro & Honorários)'
    },
    {
      id: 'pag-2',
      honorario_id: 'hon-2',
      empresa_id: 'emp-2',
      data_pagamento: '2026-11-06',
      valor: 1500.00,
      forma_pagamento: 'PIX',
      observacao: '1ª parcela paga durante o mês de Novembro ref. competência 10/2026',
      registrado_por: 'Roberto Alves (Financeiro & Honorários)'
    },
    {
      id: 'pag-3',
      honorario_id: 'hon-4',
      empresa_id: 'emp-4',
      data_pagamento: '2026-11-03',
      valor: 1000.00,
      forma_pagamento: 'PIX',
      observacao: 'Sinal de 50% na entrada do Onboarding',
      registrado_por: 'Contador Sócio (Administrador)'
    }
  ],

  audit_logs: [
    {
      id: 'log-1',
      usuario_nome: 'Contador Sócio (Administrador)',
      usuario_cargo: 'ADMIN (TODOS)',
      acao: 'CRIACAO_ONBOARDING',
      modulo: 'Onboarding',
      detalhes: 'Iniciado processo de Onboarding da empresa Construtora & Engenharia Atlas Ltda (12 etapas geradas).',
      created_at: '2026-11-01T14:20:00Z'
    },
    {
      id: 'log-2',
      usuario_nome: 'Carlos Eduardo (Depto. Pessoal)',
      usuario_cargo: 'COLABORADOR (PESSOAL)',
      acao: 'ENTREGA_TAREFA',
      modulo: 'Tarefas',
      detalhes: 'Entregue no prazo: Apuração de Pró-Labore e DARF INSS/IRRF Comp. 10/2026 - TechNova Sistemas.',
      created_at: '2026-11-04T16:45:00Z'
    },
    {
      id: 'log-3',
      usuario_nome: 'Mariana Souza (Analista Fiscal)',
      usuario_cargo: 'COLABORADOR (FISCAL)',
      acao: 'ENVIO_GUIA_PARCELAMENTO',
      modulo: 'Parcelamentos',
      detalhes: 'Guia Parcela 15/60 (Simples Nacional - TechNova) emitida e disponibilizada no Portal do Cliente.',
      created_at: '2026-11-04T17:10:00Z'
    },
    {
      id: 'log-4',
      usuario_nome: 'Roberto Alves (Financeiro & Honorários)',
      usuario_cargo: 'COLABORADOR (FINANCEIRO)',
      acao: 'PAGAMENTO_HONORARIO',
      modulo: 'Honorários',
      detalhes: 'Registrado pagamento parcial de R$ 1.500,00 (Comp. 10/2026) de Horizonte Alimentos. Saldo mantido em aberto: R$ 2.250,00.',
      created_at: '2026-11-06T11:30:00Z'
    }
  ],

  convites: [
    {
      id: 'conv-101',
      token: 'tk_colab_juliana_fiscal',
      tipo: 'COLABORADOR',
      nome: 'Juliana Costa',
      email: 'juliana.fiscal@zgestor.com',
      cargo: 'COLABORADOR',
      departamento: 'FISCAL',
      empresa_id: null,
      permissoes: {
        dashboard: true,
        tarefas: true,
        guias: true,
        parcelamentos: true,
        cnds: true,
        central_cliente: true,
        empresas: false,
        onboarding: false,
        honorarios: false,
        seguranca: false
      },
      status: 'PENDENTE',
      criado_por: 'Contador Sócio (Administrador)',
      criado_em: '2026-11-10T14:30:00Z',
      expira_em: '2026-11-17T14:30:00Z'
    },
    {
      id: 'conv-102',
      token: 'tk_cli_horizonte_carlos',
      tipo: 'CLIENTE',
      nome: 'Carlos Drummond (Diretor Horizonte Alimentos)',
      email: 'carlos@horizontealimentos.com.br',
      cargo: 'CLIENTE',
      departamento: 'CLIENTE',
      empresa_id: 'emp-2',
      permissoes: {
        central_cliente: true,
        guias: true,
        cnds: true,
        parcelamentos: true,
        documentos: true
      },
      status: 'PENDENTE',
      criado_por: 'Contador Sócio (Administrador)',
      criado_em: '2026-11-11T09:15:00Z',
      expira_em: '2026-11-18T09:15:00Z'
    }
  ]
};
