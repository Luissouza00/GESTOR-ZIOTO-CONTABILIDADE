// =============================================================================
// ZGESTOR - Motor de Banco de Dados Híbrido (Supabase Cloud + Persistência Local)
// Inclui:
// - Competência MM/AAAA -> Vencimento no Mês Subsequente (MM+1/AAAA)
// - Separação entre Pró-Labore (Padrão = Sim -> Gera DARF INSS/IRRF) e
//   Funcionários CLT (Gera Folha CLT e Guia de FGTS Digital)
// - Tarefas com Status (Pendente, Em Andamento, Entregue) + Observações em cada opção
// - Visão Geral Anual e Matriz de Fechamentos Contábeis (Jan a Dez)
// - Portal do Cliente: Cofre de Arquivos (Documentos Constitutivos, Guias, Folha, CNDs)
//   e Solicitações do Cliente integradas às Tarefas da Contabilidade
// =============================================================================

(function () {
  const STORAGE_KEY = 'zgestor_db_v6';
  const SUPABASE_CFG_KEY = 'zgestor_supabase_config_v1';
  const SESSION_USER_KEY = 'zgestor_current_user_id_v1';

  // =========================================================================
  // CRIPTOGRAFIA E FUNÇÕES CRÍTICAS DE SEGURANÇA (SHA-256 + SALTING)
  // =========================================================================
  function sha256(str) {
    function rightRotate(value, amount) {
      return (value >>> amount) | (value << (32 - amount));
    }
    const utf8 = unescape(encodeURIComponent(String(str || '')));
    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    let i, j;
    let result = '';
    const words = [];
    const asciiBitLength = utf8.length * 8;
    let hash = [];
    const k = [];
    let primeCounter = 0;
    const isComposite = {};
    for (let candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) {
          isComposite[i] = candidate;
        }
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    hash = hash.slice(0, 8);
    let ascii = utf8 + '\x80';
    while (ascii.length % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii.length; i++) {
      j = ascii.charCodeAt(i);
      words[i >> 2] |= j << ((3 - i % 4) * 8);
    }
    words[words.length] = ((asciiBitLength / maxWord) | 0);
    words[words.length] = (asciiBitLength | 0);
    for (j = 0; j < words.length;) {
      const w = words.slice(j, j += 16);
      const oldHash = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        const w15 = w[i - 15], w2 = w[i - 2];
        const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
        const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
        const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
        const temp1 = hash[7] + (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) + ch + k[i] + (w[i] = (i < 16) ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0);
        const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
        const temp2 = (rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) + maj;
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      for (i = 0; i < 8; i++) {
        hash[i] = (hash[i] + oldHash[i]) | 0;
      }
    }
    for (i = 0; i < 8; i++) {
      for (let b = 3; b >= 0; b--) {
        const byte = (hash[i] >> (b * 8)) & 255;
        result += (byte < 16 ? '0' : '') + byte.toString(16);
      }
    }
    return result;
  }

  function gerarBytesAleatorios(tamanho = 16) {
    const bytes = new Uint8Array(tamanho);
    if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
      globalThis.crypto.getRandomValues(bytes);
    } else if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.getRandomValues === 'function') {
      window.crypto.getRandomValues(bytes);
    } else {
      try {
        const nodeCrypto = require('crypto');
        const buf = nodeCrypto.randomBytes(tamanho);
        for (let i = 0; i < tamanho; i++) bytes[i] = buf[i];
      } catch (_) {
        for (let i = 0; i < tamanho; i++) bytes[i] = Math.floor(Math.random() * 256);
      }
    }
    return bytes;
  }

  function bytesParaHex(bytes) {
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
  }

  function gerarSalt(tamanho = 16) {
    return bytesParaHex(gerarBytesAleatorios(tamanho));
  }

  function gerarTokenCriptografico(prefixo = 'tk_') {
    return prefixo + bytesParaHex(gerarBytesAleatorios(24));
  }

  const SENHA_ITERACOES = 1000;

  function derivarChaveSenha(senha, salt, iteracoes = SENHA_ITERACOES) {
    let chave = sha256(`${salt}:${senha}`);
    for (let i = 1; i < iteracoes; i++) {
      chave = sha256(`${chave}:${salt}:${i}`);
    }
    return `pbkdf2_sha256$${iteracoes}$${chave}`;
  }

  function hashSenha(senha, salt, iteracoes = SENHA_ITERACOES) {
    return derivarChaveSenha(senha, salt, iteracoes);
  }

  function verificarSenha(senha, salt, hashArmazenado) {
    if (!hashArmazenado) return false;
    if (typeof hashArmazenado === 'string' && hashArmazenado.startsWith('pbkdf2_sha256$')) {
      const parts = hashArmazenado.split('$');
      const iters = parseInt(parts[1], 10) || SENHA_ITERACOES;
      return derivarChaveSenha(senha, salt, iters) === hashArmazenado;
    }
    return sha256(`${salt}:${senha}`) === hashArmazenado;
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  class ZGestorDB {
    constructor() {
      this.supabase = null;
      this.supabaseConnected = false;
      this.supabaseConfig = this.loadSupabaseConfig();
      this.data = this.loadLocalData();
      this.initSupabaseClient();
      // Remove qualquer resquício de sessão antiga em localStorage para garantir que a rota inicial seja a tela de login
      try { localStorage.removeItem(SESSION_USER_KEY); } catch (_) {}
    }

    _migrarCredenciais(target) {
      if (!target) return target;
      if (Array.isArray(target.profiles)) {
        target.profiles.forEach(p => {
          if (!p.senha_hash && !p.senha_salt) { const sInit = p.senha || '123456'; p.senha_salt = gerarSalt(); p.senha_hash = hashSenha(sInit, p.senha_salt); delete p.senha; } else if (p.senha) {
            if (!p.senha_salt) p.senha_salt = gerarSalt();
            p.senha_hash = hashSenha(p.senha, p.senha_salt);
            delete p.senha;
          }
        });
      }
      if (Array.isArray(target.convites)) {
        target.convites.forEach(c => {
          if (c.token) {
            c.token_hash = c.token_hash || sha256(c.token);
            delete c.token;
          }
        });
      }
      return target;
    }

    loadLocalData() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.empresas && parsed.profiles) {
            if (!parsed.escritorio) {
              parsed.escritorio = JSON.parse(JSON.stringify(window.ZGESTOR_MODELS.escritorioPadrao));
            }
            if (!Array.isArray(parsed.guias_impostos)) {
              parsed.guias_impostos = JSON.parse(JSON.stringify(window.ZGESTOR_INITIAL_DB.guias_impostos || []));
            }
            if (!Array.isArray(parsed.cnds)) {
              parsed.cnds = JSON.parse(JSON.stringify(window.ZGESTOR_INITIAL_DB.cnds || []));
            }
            if (!Array.isArray(parsed.portal_arquivos)) {
              parsed.portal_arquivos = JSON.parse(JSON.stringify(window.ZGESTOR_INITIAL_DB.portal_arquivos || []));
            }
            if (!Array.isArray(parsed.central_cliente_registros)) {
              parsed.central_cliente_registros = JSON.parse(JSON.stringify(window.ZGESTOR_INITIAL_DB.central_cliente_registros || []));
            }
            if (!Array.isArray(parsed.encerramentos_exercicio)) {
              parsed.encerramentos_exercicio = [];
            }
            if (!Array.isArray(parsed.convites)) {
              parsed.convites = JSON.parse(JSON.stringify(window.ZGESTOR_INITIAL_DB.convites || []));
            }
            if (!parsed.profiles.some(p => p.cargo === 'CLIENTE')) {
              const seedCli = (window.ZGESTOR_INITIAL_DB.profiles || []).find(p => p.cargo === 'CLIENTE');
              if (seedCli) parsed.profiles.push(JSON.parse(JSON.stringify(seedCli)));
            }
            parsed.profiles.forEach(p => {
              if (!p.permissoes) {
                if (p.cargo === 'ADMIN') {
                  p.permissoes = { dashboard: true, tarefas: true, guias: true, parcelamentos: true, cnds: true, central_cliente: true, empresas: true, onboarding: true, honorarios: true, seguranca: true };
                } else if (p.cargo === 'CLIENTE') {
                  p.permissoes = { central_cliente: true, guias: true, cnds: true, parcelamentos: true, documentos: true };
                } else {
                  p.permissoes = {
                    dashboard: true,
                    tarefas: true,
                    guias: true,
                    parcelamentos: ['FISCAL', 'FINANCEIRO', 'CONTABIL', 'SOCIETARIO'].includes(p.departamento),
                    cnds: true,
                    central_cliente: true,
                    empresas: true,
                    onboarding: ['SOCIETARIO', 'ADMIN'].includes(p.departamento),
                    honorarios: p.departamento === 'FINANCEIRO',
                    seguranca: false
                  };
                }
              }
            });
            parsed.empresas.forEach(emp => {
              if (emp.possui_pro_labore === undefined) {
                emp.possui_pro_labore = true;
              }
              if (!emp.municipio_uf) {
                const seed = (window.ZGESTOR_INITIAL_DB?.empresas || []).find(e => e.id === emp.id);
                emp.municipio_uf = seed?.municipio_uf || (emp.municipio && emp.uf ? `${emp.municipio}/${emp.uf}` : 'Belo Horizonte/MG');
              }
              if (!emp.validade_certificado) {
                const seed = (window.ZGESTOR_INITIAL_DB?.empresas || []).find(e => e.id === emp.id);
                emp.validade_certificado = seed?.validade_certificado || '2027-08-15';
              }
              if (!emp.competencia_inicial) {
                const seed = (window.ZGESTOR_INITIAL_DB?.empresas || []).find(e => e.id === emp.id);
                emp.competencia_inicial = seed?.competencia_inicial || '11/2026';
              }
              emp.competencia_inicial = this.normalizarCompetencia(emp.competencia_inicial);
              if (!emp.modelo_onboarding) {
                const seed = (window.ZGESTOR_INITIAL_DB?.empresas || []).find(e => e.id === emp.id);
                emp.modelo_onboarding = seed?.modelo_onboarding || 'ABERTURA_EMPRESA';
              }
            });
            this._migrarCredenciais(parsed);
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed)); } catch (_) {}
            return parsed;
          }
        }
      } catch (e) {
        console.warn('Erro ao carregar dados locais, usando seed inicial:', e);
      }
      const initial = JSON.parse(JSON.stringify(window.ZGESTOR_INITIAL_DB));
      this._migrarCredenciais(initial);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }

    saveLocalData() {
      this._migrarCredenciais(this.data);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    }

    resetToSeedData() {
      const initial = JSON.parse(JSON.stringify(window.ZGESTOR_INITIAL_DB));
      this._migrarCredenciais(initial);
      this.data = initial;
      this.saveLocalData();
      this.registrarLog('RESET_BANCO', 'Sistema', 'Dados restaurados para a base de demonstração padrão.');
      return this.data;
    }

    // =========================================================================
    // CÁLCULO DE COMPETÊNCIAS (ANTERIOR, SUBSEQUENTE E FORMATAÇÃO)
    // =========================================================================
    normalizarCompetencia(competencia) {
      if (!competencia) return '11/2026';
      const s = String(competencia).trim();
      const yyyyMm = /^(\d{4})[-/.](\d{1,2})$/.exec(s);
      if (yyyyMm) {
        return `${yyyyMm[2].padStart(2, '0')}/${yyyyMm[1]}`;
      }
      const mmYyyy = /^(\d{1,2})[-/.](\d{4})$/.exec(s);
      if (mmYyyy) {
        return `${mmYyyy[1].padStart(2, '0')}/${mmYyyy[2]}`;
      }
      const mmYyyyCompact = /^(\d{2})(\d{4})$/.exec(s);
      if (mmYyyyCompact) {
        return `${mmYyyyCompact[1]}/${mmYyyyCompact[2]}`;
      }
      return s;
    }

    obterMesSubsequente(competencia) {
      const partes = String(competencia || '10/2026').split('/');
      let mes = parseInt(partes[0], 10) || 10;
      let ano = parseInt(partes[1], 10) || 2026;
      mes += 1;
      if (mes > 12) {
        mes = 1;
        ano += 1;
      }
      return {
        mes,
        ano,
        mesFormatado: String(mes).padStart(2, '0'),
        label: `${String(mes).padStart(2, '0')}/${ano}`
      };
    }

    obterCompetenciaAnterior(competencia) {
      const partes = String(competencia || '10/2026').split('/');
      let mes = parseInt(partes[0], 10) || 10;
      let ano = parseInt(partes[1], 10) || 2026;
      mes -= 1;
      if (mes < 1) {
        mes = 12;
        ano -= 1;
      }
      return `${String(mes).padStart(2, '0')}/${ano}`;
    }

    formatarNomeCompetencia(competencia) {
      const partes = String(competencia || '10/2026').split('/');
      const mesNum = String(partes[0] || '10').padStart(2, '0');
      const ano = partes[1] || '2026';
      const meses = (window.ZGESTOR_MODELS && window.ZGESTOR_MODELS.mesesAno) || [];
      const mObj = meses.find(m => m.num === mesNum);
      return mObj ? `${mObj.nome}/${ano}` : `${mesNum}/${ano}`;
    }

    compararCompetencias(compA, compB) {
      const [mA, aA] = String(compA || '01/2000').split('/').map(Number);
      const [mB, aB] = String(compB || '01/2000').split('/').map(Number);
      if (aA !== aB) return aA - aB;
      return mA - mB;
    }

    calcularDataMesSubsequente(competencia, dia = 10) {
      const sub = this.obterMesSubsequente(competencia);
      const ultimoDiaMes = new Date(sub.ano, sub.mes, 0).getDate();
      const diaValido = String(Math.min(Math.max(1, Number(dia || 10)), ultimoDiaMes)).padStart(2, '0');
      return `${sub.ano}-${sub.mesFormatado}-${diaValido}`;
    }

    // =========================================================================
    // CONFIGURAÇÃO DO ESCRITÓRIO E CHAVE PIX PARA RECIBOS DE COBRANÇA
    // =========================================================================
    getEscritorioConfig() {
      if (!this.data.escritorio) {
        this.data.escritorio = JSON.parse(JSON.stringify(window.ZGESTOR_MODELS.escritorioPadrao));
        this.saveLocalData();
      } else {
        const padrao = window.ZGESTOR_MODELS.escritorioPadrao;
        if (!this.data.escritorio.pix_principal && padrao.pix_principal) {
          this.data.escritorio.pix_principal = JSON.parse(JSON.stringify(padrao.pix_principal));
        }
        if (!this.data.escritorio.pix_secundario && padrao.pix_secundario) {
          this.data.escritorio.pix_secundario = JSON.parse(JSON.stringify(padrao.pix_secundario));
        }
        if (!this.data.escritorio.pix_autonomo && padrao.pix_autonomo) {
          this.data.escritorio.pix_autonomo = JSON.parse(JSON.stringify(padrao.pix_autonomo));
        }
        if (!this.data.escritorio.api_integra_contador && padrao.api_integra_contador) {
          this.data.escritorio.api_integra_contador = JSON.parse(JSON.stringify(padrao.api_integra_contador));
        }
      }
      return this.data.escritorio;
    }

    salvarEscritorioConfig(novosDados) {
      const atual = this.getEscritorioConfig();
      this.data.escritorio = {
        ...atual,
        ...novosDados,
        pix_principal: {
          ...(atual.pix_principal || {}),
          ...(novosDados.pix_principal || {})
        },
        pix_secundario: {
          ...(atual.pix_secundario || {}),
          ...(novosDados.pix_secundario || {})
        },
        pix_autonomo: {
          ...(atual.pix_autonomo || {}),
          ...(novosDados.pix_autonomo || {})
        },
        api_integra_contador: {
          ...(atual.api_integra_contador || {}),
          ...(novosDados.api_integra_contador || {})
        }
      };
      this.saveLocalData();
      this.registrarLog('CONFIG_ESCRITORIO_PIX', 'Honorários', `Dados do escritório e Contas/Chaves PIX atualizados.`);
      return this.data.escritorio;
    }

    // =========================================================================
    // CONEXÃO SUPABASE
    // =========================================================================
    loadSupabaseConfig() {
      try {
        const raw = localStorage.getItem(SUPABASE_CFG_KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) {}
      return { 
        url: 'https://ccosuhmulzqrpuaogmuk.supabase.co', 
        anonKey: 'sb_publishable_zV9nC4mVQM44vapd4NTjOQ_O1ORCusU', 
        autoSync: true 
      };
    }

    saveSupabaseConfig(url, anonKey, autoSync = true) {
      this.supabaseConfig = { url: (url || '').trim(), anonKey: (anonKey || '').trim(), autoSync };
      localStorage.setItem(SUPABASE_CFG_KEY, JSON.stringify(this.supabaseConfig));
      return this.initSupabaseClient();
    }

    initSupabaseClient() {
      if (this.supabaseConfig.url && this.supabaseConfig.anonKey && window.supabase) {
        try {
          this.supabase = window.supabase.createClient(this.supabaseConfig.url, this.supabaseConfig.anonKey);
          this.supabaseConnected = true;
          return true;
        } catch (err) {
          console.error('Erro ao inicializar cliente Supabase:', err);
          this.supabaseConnected = false;
          return false;
        }
      }
      this.supabase = null;
      this.supabaseConnected = false;
      return false;
    }

    async syncFromSupabase() {
      if (!this.supabaseConnected || !this.supabase) return { ok: false, message: 'Supabase não configurado.' };
      try {
        const tables = ['profiles', 'empresas', 'onboarding_itens', 'tarefas', 'guias_impostos', 'parcelamentos', 'parcelamento_guias', 'cnds', 'portal_arquivos', 'central_cliente_registros', 'honorarios', 'honorario_pagamentos', 'audit_logs'];
        for (const t of tables) {
          const { data, error } = await this.supabase.from(t).select('*');
          if (!error && Array.isArray(data) && data.length > 0) {
            this.data[t] = data;
          }
        }
        this.saveLocalData();
        return { ok: true, message: 'Sincronizado com Supabase PostgreSQL com sucesso!' };
      } catch (e) {
        return { ok: false, message: 'Falha ao sincronizar com Supabase: ' + e.message };
      }
    }

    // =========================================================================
    // SESSÃO E POLÍTICAS DE SEGURANÇA (ROW-LEVEL SECURITY / RBAC)
    // =========================================================================
    getCurrentUser() {
      try {
        if (typeof window !== 'undefined' && window.ZGestorApp?.state?.modoSimulacaoCliente?.ativo) {
          const sim = window.ZGestorApp.state.modoSimulacaoCliente;
          const cliUser = this.data.profiles.find(p => p.id === sim.clienteId && p.ativo);
          if (cliUser) return cliUser;
        }
        const savedId = sessionStorage.getItem(SESSION_USER_KEY);
        if (!savedId) return null;
        const found = this.data.profiles.find(p => p.id === savedId && p.ativo);
        return found || null;
      } catch (_) {
        return null;
      }
    }

    login(email, senha) {
      const e = (email || '').trim().toLowerCase();
      const s = (senha || '').trim();
      if (!e || !s) {
        throw new Error('Informe seu e-mail e sua senha de acesso.');
      }
      const user = this.data.profiles.find(p => p.email && p.email.toLowerCase() === e);
      if (!user) {
        throw new Error('Usuário não encontrado. Verifique o e-mail digitado ou solicite um convite à Administração.');
      }
      if (!user.ativo) {
        throw new Error('Este usuário está inativo no momento. Entre em contato com a Administração do escritório.');
      }
      let senhaValida = false;
      if (user.senha_hash && user.senha_salt) {
        senhaValida = verificarSenha(s, user.senha_salt, user.senha_hash);
        if (senhaValida && !user.senha_hash.startsWith('pbkdf2_sha256$')) {
          user.senha_hash = hashSenha(s, user.senha_salt);
        }
      } else if (user.senha) {
        senhaValida = (user.senha === s);
        if (senhaValida) {
          user.senha_salt = gerarSalt();
          user.senha_hash = hashSenha(s, user.senha_salt);
          delete user.senha;
        }
      }
      if (!senhaValida) {
        throw new Error('Senha incorreta. Tente novamente ou solicite redefinição à Administração.');
      }
      sessionStorage.setItem(SESSION_USER_KEY, user.id);
      try { localStorage.removeItem(SESSION_USER_KEY); } catch (_) {}
      user.ultimo_acesso = new Date().toISOString();
      this.saveLocalData();
      this.registrarLog('LOGIN_SUCESSO', 'Autenticação', `Login realizado: ${user.nome} (${user.cargo} - ${user.departamento}).`);
      return user;
    }

    logout() {
      const user = this.getCurrentUser();
      if (user) {
        this.registrarLog('LOGOUT', 'Autenticação', `Sessão encerrada por: ${user.nome}.`);
      }
      sessionStorage.removeItem(SESSION_USER_KEY);
      try { localStorage.removeItem(SESSION_USER_KEY); } catch (_) {}
    }

    setCurrentUser(userId, forceAdminSimulation = false) {
      // 1. Sem login ativo, setCurrentUser NUNCA cria sessão nem eleva usuário
      const authId = sessionStorage.getItem(SESSION_USER_KEY);
      if (!authId) {
        return null;
      }
      const currentUser = this.data.profiles.find(p => p.id === authId && p.ativo);
      if (!currentUser) {
        return null;
      }

      // 2. Cliente NUNCA pode alternar usuário ou assumir admin, mesmo se forceAdminSimulation for passado
      if (currentUser.cargo === 'CLIENTE') {
        throw new Error('Política de Segurança (RLS): Perfil de cliente não pode alternar usuários.');
      }

      // 3. Apenas administradores autenticados podem alternar perfil na demonstração
      if (currentUser.cargo !== 'ADMIN' && currentUser.id !== userId) {
        throw new Error('Política de Segurança (RLS): Apenas Administradores podem alternar usuários na demonstração.');
      }

      const userAlvo = this.data.profiles.find(p => p.id === userId && p.ativo);
      if (!userAlvo) return currentUser;

      sessionStorage.setItem(SESSION_USER_KEY, userAlvo.id);
      this.registrarLog('TROCA_USUARIO', 'Segurança', `Sessão ativa alterada para: ${userAlvo.nome} (${userAlvo.cargo} - ${userAlvo.departamento})`);
      return userAlvo;
    }

    isAdmin(user = this.getCurrentUser()) {
      return user && user.cargo === 'ADMIN';
    }

    canAccessModule(moduleName, user = this.getCurrentUser()) {
      if (!user || !user.ativo) return false;

      // SEGURANÇA E GESTÃO DE USUÁRIOS: Estritamente exclusivo do Administrador (cargo === 'ADMIN')
      if (moduleName === 'seguranca') {
        return Boolean(user && user.cargo === 'ADMIN');
      }

      // Administrador tem acesso irrestrito
      if (user.cargo === 'ADMIN') return true;

      // CLIENTE do Portal: acesso estritamente restrito à Central do Cliente
      if (user.cargo === 'CLIENTE') {
        return moduleName === 'central_cliente';
      }

      // COLABORADOR: se possuir objeto de permissões explícito cadastrado
      if (user.permissoes && typeof user.permissoes[moduleName] === 'boolean') {
        return user.permissoes[moduleName];
      }

      if (user.departamento === 'TODOS') return false;

      switch (moduleName) {
        case 'dashboard':
        case 'empresas':
        case 'onboarding':
        case 'tarefas':
        case 'cnds':
        case 'central_cliente':
          return true;
        case 'parcelamentos':
          return ['FISCAL', 'FINANCEIRO', 'CONTABIL', 'SOCIETARIO'].includes(user.departamento);
        case 'honorarios':
          return user.departamento === 'FINANCEIRO';
        case 'escritorio':
          return user.cargo === 'ADMIN' || ['FINANCEIRO', 'FISCAL', 'CONTABIL', 'SOCIETARIO', 'ADMIN'].includes(user.departamento) || user.cargo !== 'CLIENTE';
        case 'seguranca':
          return false;
        default:
          return true;
      }
    }

    canManageDepartment(departamento, user = this.getCurrentUser()) {
      if (!user) return false;
      if (user.cargo === 'ADMIN' || user.departamento === 'TODOS') return true;
      return user.departamento === departamento;
    }

    getTarefasVisiveis(rlsFilterEnabled = true) {
      const user = this.getCurrentUser();
      if (!user || !rlsFilterEnabled) {
        return [...this.data.tarefas];
      }
      // RLS para Cliente: apenas obrigações da sua empresa
      if (user.cargo === 'CLIENTE') {
        return this.data.tarefas.filter(t => t.empresa_id === user.empresa_id);
      }
      if (this.isAdmin(user) || user.departamento === 'TODOS') {
        return [...this.data.tarefas];
      }
      return this.data.tarefas.filter(t => t.departamento === user.departamento);
    }

    registrarLog(acao, modulo, detalhes) {
      const user = this.getCurrentUser();
      const log = {
        id: 'log-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        usuario_nome: user ? user.nome : 'Sistema',
        usuario_cargo: user ? `${user.cargo} (${user.departamento})` : 'SISTEMA',
        acao,
        modulo,
        detalhes,
        created_at: new Date().toISOString()
      };
      this.data.audit_logs.unshift(log);
      if (this.data.audit_logs.length > 250) {
        this.data.audit_logs = this.data.audit_logs.slice(0, 250);
      }
      this.saveLocalData();
      if (this.supabaseConnected && this.supabase) {
        this.supabase.from('audit_logs').insert([log]).then(() => {}).catch(() => {});
      }
    }

    // =========================================================================
    // GESTÃO DE EMPRESAS (COM PRÓ-LABORE PADRÃO SEPARADO DE FUNCIONÁRIOS CLT)
    // =========================================================================
    salvarEmpresa(dadosEmpresa, criarChecklistOnboarding = true) {
      const compNorm = this.normalizarCompetencia(dadosEmpresa.competencia_inicial || '11/2026');
      const isEdit = Boolean(dadosEmpresa.id);
      if (isEdit) {
        const idx = this.data.empresas.findIndex(e => e.id === dadosEmpresa.id);
        if (idx !== -1) {
          const oldStatus = this.data.empresas[idx].status;
          this.data.empresas[idx] = {
            ...this.data.empresas[idx],
            ...dadosEmpresa,
            municipio_uf: dadosEmpresa.municipio_uf || this.data.empresas[idx].municipio_uf || '',
            validade_certificado: dadosEmpresa.validade_certificado || this.data.empresas[idx].validade_certificado || '',
            competencia_inicial: compNorm,
            canal_pagamento_padrao: dadosEmpresa.canal_pagamento_padrao || this.data.empresas[idx].canal_pagamento_padrao || 'PIX_PRINCIPAL',
            modelo_onboarding: dadosEmpresa.modelo_onboarding || this.data.empresas[idx].modelo_onboarding || 'ABERTURA_EMPRESA',
            possui_pro_labore: dadosEmpresa.possui_pro_labore !== false,
            possui_funcionarios: Boolean(dadosEmpresa.possui_funcionarios)
          };
          if (dadosEmpresa.status === 'ATIVA' && oldStatus !== 'ATIVA') {
            const compGera = this.data.empresas[idx].competencia_inicial || this.data.competencia_ativa || '10/2026';
            this.gerarTarefasCompetencia(compGera, this.data.empresas[idx].id);
            this.gerarGuiasImpostosCompetencia(compGera);
            if (this.canAccessModule('honorarios')) {
              this.gerarHonorariosCompetencia(compGera);
            }
          }
          this.saveLocalData();
          this.registrarLog(
            'EDICAO_EMPRESA',
            'Empresas',
            `Dados atualizados da empresa ${dadosEmpresa.razao_social} (Pró-Labore: ${this.data.empresas[idx].possui_pro_labore ? 'Sim' : 'Não'} | Funcionários CLT: ${this.data.empresas[idx].possui_funcionarios ? 'Sim' : 'Não'}).`
          );
          return this.data.empresas[idx];
        }
      }

      const nextNum = String(this.data.empresas.length + 1).padStart(3, '0');
      const novaEmpresa = {
        id: 'emp-' + Date.now(),
        codigo_interno: dadosEmpresa.codigo_interno || nextNum,
        razao_social: dadosEmpresa.razao_social,
        nome_fantasia: dadosEmpresa.nome_fantasia || dadosEmpresa.razao_social,
        cnpj: dadosEmpresa.cnpj,
        municipio_uf: dadosEmpresa.municipio_uf || (dadosEmpresa.municipio && dadosEmpresa.uf ? `${dadosEmpresa.municipio}/${dadosEmpresa.uf}` : ''),
        validade_certificado: dadosEmpresa.validade_certificado || '',
        competencia_inicial: compNorm,
        modelo_onboarding: dadosEmpresa.modelo_onboarding || 'ABERTURA_EMPRESA',
        regime_tributario: dadosEmpresa.regime_tributario || 'Simples Nacional',
        inscricao_estadual: dadosEmpresa.inscricao_estadual || 'Isento',
        inscricao_municipal: dadosEmpresa.inscricao_municipal || '',
        responsavel_legal: dadosEmpresa.responsavel_legal || '',
        telefone: dadosEmpresa.telefone || '',
        email: dadosEmpresa.email || '',
        status: dadosEmpresa.status || 'EM_ONBOARDING',
        valor_honorario_padrao: Number(dadosEmpresa.valor_honorario_padrao || 0),
        dia_vencimento_honorario: Number(dadosEmpresa.dia_vencimento_honorario || 10),
        canal_pagamento_padrao: dadosEmpresa.canal_pagamento_padrao || 'PIX_PRINCIPAL',
        // Pró-Labore padrão = true (gera DARF INSS/IRRF); Funcionários CLT separado = false por padrão (gera FGTS)
        possui_pro_labore: dadosEmpresa.possui_pro_labore !== false,
        possui_funcionarios: Boolean(dadosEmpresa.possui_funcionarios),
        data_entrada: dadosEmpresa.data_entrada || new Date().toISOString().slice(0, 10),
        observacoes: dadosEmpresa.observacoes || ''
      };

      this.data.empresas.push(novaEmpresa);

      if (novaEmpresa.status === 'EM_ONBOARDING' || criarChecklistOnboarding) {
        this.gerarChecklistPadraoEmpresa(novaEmpresa.id, novaEmpresa.modelo_onboarding);
      }
      if (novaEmpresa.status === 'ATIVA') {
        const compGera = novaEmpresa.competencia_inicial || this.data.competencia_ativa || '10/2026';
        this.gerarTarefasCompetencia(compGera, novaEmpresa.id);
        this.gerarGuiasImpostosCompetencia(compGera);
        if (this.canAccessModule('honorarios')) {
          this.gerarHonorariosCompetencia(compGera);
        }
      }

      this.saveLocalData();
      this.registrarLog(
        'CADASTRO_EMPRESA',
        'Empresas',
        `Nova empresa cadastrada: ${novaEmpresa.razao_social} (${novaEmpresa.regime_tributario}) — Pró-Labore: ${novaEmpresa.possui_pro_labore ? 'Sim' : 'Não'}, Funcionários CLT: ${novaEmpresa.possui_funcionarios ? 'Sim' : 'Não'}.`
      );
      return novaEmpresa;
    }

    gerarChecklistPadraoEmpresa(empresaId, tipoModelo = 'ABERTURA_EMPRESA', forcarRecriar = false) {
      if (forcarRecriar) {
        this.data.onboarding_itens = this.data.onboarding_itens.filter(i => i.empresa_id !== empresaId);
      } else {
        const jaExiste = this.data.onboarding_itens.some(i => i.empresa_id === empresaId);
        if (jaExiste) return;
      }

      const emp = this.data.empresas.find(e => e.id === empresaId);
      if (emp) {
        emp.modelo_onboarding = tipoModelo;
      }

      const modeloConfig = window.ZGESTOR_MODELS.checklistModelos && window.ZGESTOR_MODELS.checklistModelos[tipoModelo];
      const itensModelo = (modeloConfig && modeloConfig.itens) || window.ZGESTOR_MODELS.checklistPadraoOnboarding;

      itensModelo.forEach((item, index) => {
        this.data.onboarding_itens.push({
          id: `onb-${Date.now()}-${index}`,
          empresa_id: empresaId,
          etapa: item.etapa,
          titulo: item.titulo,
          departamento: item.departamento,
          obrigatorio: item.obrigatorio,
          concluido: false,
          data_conclusao: null,
          responsavel_nome: '',
          observacao: '',
          ordem: item.ordem
        });
      });
      this.saveLocalData();
    }

    obterProgressoOnboarding(empresaId) {
      const itens = this.data.onboarding_itens.filter(i => i.empresa_id === empresaId);
      const total = itens.length;
      const concluidos = itens.filter(i => i.concluido).length;
      const percentual = total > 0 ? Math.round((concluidos / total) * 100) : 0;
      return { total, concluidos, pendentes: total - concluidos, percentual, completo: total > 0 && concluidos === total };
    }

    alternarItemOnboarding(itemId, concluido, observacao) {
      const item = this.data.onboarding_itens.find(i => i.id === itemId);
      if (!item) return null;

      const user = this.getCurrentUser();
      if (!this.canManageDepartment(item.departamento, user)) {
        throw new Error(`Política de Segurança (RLS): Apenas o setor ${item.departamento} ou Administradores podem alterar este item de Onboarding.`);
      }

      item.concluido = concluido;
      item.data_conclusao = concluido ? new Date().toISOString().slice(0, 10) : null;
      item.responsavel_nome = concluido ? user.nome : '';
      if (typeof observacao === 'string') {
        item.observacao = observacao;
      }

      const emp = this.data.empresas.find(e => e.id === item.empresa_id);
      const prog = this.obterProgressoOnboarding(item.empresa_id);
      
      // Automatiza a virada de status ao atingir 100% de etapas concluídas
      if (emp && prog.completo && emp.status === 'EM_ONBOARDING') {
        emp.status = 'ATIVA';
        const comp = emp.competencia_inicial || '10/2026';
        this.gerarTarefasCompetencia(comp, emp.id);
        this.gerarGuiasImpostosCompetencia(comp);
        if (this.canAccessModule('honorarios')) {
          this.gerarHonorariosCompetencia(comp);
        }
        this.registrarLog(
          'ONBOARDING_AUTOMATICO_100',
          'Onboarding',
          `Checklist 100% concluído! Empresa ${emp.razao_social} alterada automaticamente para status ATIVA com rotinas mensais liberadas.`
        );
      }

      this.saveLocalData();
      this.registrarLog(
        concluido ? 'ONBOARDING_ITEM_CONCLUIDO' : 'ONBOARDING_ITEM_REABERTO',
        'Onboarding',
        `${emp ? emp.nome_fantasia : 'Empresa'}: "${item.titulo}" marcado como ${concluido ? 'CONCLUÍDO' : 'PENDENTE'} (${prog.percentual}%).`
      );
      return { item, progresso: prog };
    }

    adicionarItemOnboardingCustomizado(empresaId, etapa, titulo, departamento, observacao) {
      const novo = {
        id: 'onb-custom-' + Date.now(),
        empresa_id: empresaId,
        etapa,
        titulo,
        departamento,
        obrigatorio: true,
        concluido: false,
        data_conclusao: null,
        responsavel_nome: '',
        observacao: observacao || '',
        ordem: 99
      };
      this.data.onboarding_itens.push(novo);
      const emp = this.data.empresas.find(e => e.id === empresaId);
      if (emp) emp.status = 'EM_ONBOARDING';
      this.saveLocalData();
      this.registrarLog('NOVO_ITEM_ONBOARDING', 'Onboarding', `Adicionado item "${titulo}" (${departamento}).`);
      return novo;
    }

    concluirOnboardingEmpresa(empresaId, competenciaAtual) {
      const emp = this.data.empresas.find(e => e.id === empresaId);
      if (!emp) return null;
      const hoje = new Date().toISOString().slice(0, 10);
      const user = this.getCurrentUser();
      this.data.onboarding_itens
        .filter(i => i.empresa_id === empresaId && !i.concluido)
        .forEach(i => {
          i.concluido = true;
          i.data_conclusao = hoje;
          i.responsavel_nome = user.nome;
        });

      emp.status = 'ATIVA';
      const comp = competenciaAtual || emp.competencia_inicial || '10/2026';
      this.gerarTarefasCompetencia(comp, empresaId);
      this.gerarGuiasImpostosCompetencia(comp);
      if (this.canAccessModule('honorarios')) {
        this.gerarHonorariosCompetencia(comp);
      }
      this.saveLocalData();
      this.registrarLog('ONBOARDING_FINALIZADO', 'Onboarding', `Onboarding 100% concluído! Empresa ${emp.razao_social} ativada na carteira com rotinas liberadas.`);
      return emp;
    }

    // =========================================================================
    // GESTÃO DE TAREFAS (STATUS: PENDENTE, EM_ANDAMENTO, ENTREGUE + OBSERVAÇÕES)
    // =========================================================================
    calcularStatusTarefa(prazoEntrega, dataEntrega, statusEscolhido) {
      if (dataEntrega || statusEscolhido === 'ENTREGUE' || statusEscolhido === 'ENTREGUE_NO_PRAZO' || statusEscolhido === 'ENTREGUE_COM_ATRASO') {
        const dt = dataEntrega || new Date().toISOString().slice(0, 10);
        return dt <= (prazoEntrega || dt) ? 'ENTREGUE_NO_PRAZO' : 'ENTREGUE_COM_ATRASO';
      }
      if (statusEscolhido === 'EM_ANDAMENTO') {
        return 'EM_ANDAMENTO';
      }
      if (statusEscolhido === 'PENDENTE') {
        return 'PENDENTE';
      }
      return 'NAO_INICIADA';
    }

    obterStatusSimplesTarefa(tarefa) {
      if (!tarefa) return 'NAO_INICIADA';
      if (tarefa.status === 'CONFERIDO') {
        return 'CONFERIDO';
      }
      if (tarefa.data_entrega || tarefa.status === 'ENTREGUE_NO_PRAZO' || tarefa.status === 'ENTREGUE_COM_ATRASO' || tarefa.status === 'ENTREGUE') {
        return 'ENTREGUE';
      }
      if (tarefa.status === 'EM_ANDAMENTO') {
        return 'EM_ANDAMENTO';
      }
      if (tarefa.status === 'PENDENTE') {
        return 'PENDENTE';
      }
      return 'NAO_INICIADA';
    }

    salvarTarefa(dadosTarefa) {
      const user = this.getCurrentUser();
      if (!this.canManageDepartment(dadosTarefa.departamento, user)) {
        throw new Error(`Política de Segurança (RLS): Seu perfil (${user.departamento}) não tem permissão para criar/editar tarefas do departamento ${dadosTarefa.departamento}.`);
      }

      const querEntregue = dadosTarefa.status === 'ENTREGUE' || dadosTarefa.status === 'ENTREGUE_NO_PRAZO' || dadosTarefa.status === 'ENTREGUE_COM_ATRASO' || Boolean(dadosTarefa.data_entrega);
      const dataEntregaFinal = querEntregue ? (dadosTarefa.data_entrega || new Date().toISOString().slice(0, 10)) : null;

      const statusCalculado = this.calcularStatusTarefa(
        dadosTarefa.prazo_entrega,
        dataEntregaFinal,
        dadosTarefa.status
      );

      if (dadosTarefa.id) {
        const idx = this.data.tarefas.findIndex(t => t.id === dadosTarefa.id);
        if (idx !== -1) {
          this.data.tarefas[idx] = {
            ...this.data.tarefas[idx],
            ...dadosTarefa,
            data_entrega: dataEntregaFinal,
            status: statusCalculado
          };
          this.sincronizarSolicitacaoPortalComTarefa(this.data.tarefas[idx]);
          this.saveLocalData();
          this.registrarLog('ATUALIZACAO_TAREFA', 'Tarefas', `Tarefa "${dadosTarefa.titulo}" atualizada (${statusCalculado}) — Obs: ${dadosTarefa.protocolo_observacao || '—'}.`);
          return this.data.tarefas[idx];
        }
      }

      const nova = {
        id: 'tar-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
        empresa_id: dadosTarefa.empresa_id,
        competencia: dadosTarefa.competencia,
        departamento: dadosTarefa.departamento,
        tipo: dadosTarefa.tipo || 'AVULSA',
        titulo: dadosTarefa.titulo,
        descricao: dadosTarefa.descricao || '',
        solicitante: dadosTarefa.solicitante || (dadosTarefa.tipo === 'AVULSA' ? 'Solicitação do Cliente' : 'Rotina Mensal'),
        prazo_entrega: dadosTarefa.prazo_entrega,
        data_entrega: dataEntregaFinal,
        status: statusCalculado,
        responsavel_nome: dadosTarefa.responsavel_nome || user.nome,
        protocolo_observacao: dadosTarefa.protocolo_observacao || ''
      };

      this.data.tarefas.unshift(nova);
      this.saveLocalData();
      const emp = this.data.empresas.find(e => e.id === nova.empresa_id);
      this.registrarLog(
        nova.tipo === 'AVULSA' ? 'NOVA_TAREFA_AVULSA' : 'NOVA_TAREFA_MENSAL',
        'Tarefas',
        `Criada tarefa [${nova.departamento}] "${nova.titulo}" (Comp. ${nova.competencia}) delegada para ${nova.responsavel_nome} (${emp ? emp.nome_fantasia : 'Cliente'}).`
      );
      return nova;
    }

    // Atualiza o status (NAO_INICIADA, PENDENTE, EM_ANDAMENTO ou ENTREGUE) e salva a observação correspondente
    atualizarStatusObservacaoTarefa(tarefaId, opcaoStatus, arg3, arg4) {
      const tarefa = this.data.tarefas.find(t => t.id === tarefaId);
      if (!tarefa) return null;

      const user = this.getCurrentUser();
      if (!this.canManageDepartment(tarefa.departamento, user)) {
        throw new Error(`Política de Segurança (RLS): Apenas colaboradores do setor ${tarefa.departamento} ou Administradores podem alterar esta tarefa.`);
      }

      let dataEntregaEfetiva = null;
      let observacao = '';
      if (typeof arg3 === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(arg3)) {
        dataEntregaEfetiva = arg3;
        observacao = arg4 !== undefined ? arg4 : '';
      } else if (typeof arg4 === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(arg4)) {
        dataEntregaEfetiva = arg4;
        observacao = arg3 !== undefined ? arg3 : '';
      } else {
        observacao = arg3 !== undefined ? arg3 : (arg4 || '');
      }

      const hoje = new Date().toISOString().slice(0, 10);
      if (opcaoStatus === 'CONFERIDO') {
        const dt = dataEntregaEfetiva || tarefa.data_entrega || hoje;
        tarefa.data_entrega = dt;
        tarefa.status = 'CONFERIDO';
      } else if (opcaoStatus === 'ENTREGUE' || opcaoStatus === 'ENTREGUE_NO_PRAZO' || opcaoStatus === 'ENTREGUE_COM_ATRASO') {
        const dt = dataEntregaEfetiva || tarefa.data_entrega || hoje;
        tarefa.data_entrega = dt;
        tarefa.status = dt <= (tarefa.prazo_entrega || dt) ? 'ENTREGUE_NO_PRAZO' : 'ENTREGUE_COM_ATRASO';
      } else if (opcaoStatus === 'EM_ANDAMENTO') {
        tarefa.data_entrega = null;
        tarefa.status = 'EM_ANDAMENTO';
      } else if (opcaoStatus === 'PENDENTE') {
        tarefa.data_entrega = null;
        tarefa.status = 'PENDENTE';
      } else {
        tarefa.data_entrega = null;
        tarefa.status = 'NAO_INICIADA';
      }

      if (observacao !== undefined && observacao !== null) {
        tarefa.protocolo_observacao = observacao;
      }
      if (!tarefa.responsavel_nome) {
        tarefa.responsavel_nome = user.nome;
      }

      this.sincronizarSolicitacaoPortalComTarefa(tarefa);
      this.saveLocalData();
      const emp = this.data.empresas.find(e => e.id === tarefa.empresa_id);
      this.registrarLog(
        'STATUS_TAREFA',
        'Tarefas',
        `Tarefa "${tarefa.titulo}" (${emp ? emp.nome_fantasia : ''} - ${tarefa.competencia}) alterada para ${tarefa.status}. Obs: "${tarefa.protocolo_observacao || 'Sem observação'}".`
      );
      return tarefa;
    }

    registrarEntregaTarefa(tarefaId, dataEntregaEfetiva, protocoloObservacao) {
      return this.atualizarStatusObservacaoTarefa(tarefaId, 'ENTREGUE', dataEntregaEfetiva, protocoloObservacao);
    }

    reabrirTarefa(tarefaId) {
      return this.atualizarStatusObservacaoTarefa(tarefaId, 'EM_ANDAMENTO', null, undefined);
    }

    sincronizarSolicitacaoPortalComTarefa(tarefa) {
      if (!tarefa || !Array.isArray(this.data.central_cliente_registros)) return;
      const solic = this.data.central_cliente_registros.find(r => r.tarefa_vinculada_id === tarefa.id);
      if (solic) {
        const stSimples = this.obterStatusSimplesTarefa(tarefa);
        if (stSimples === 'ENTREGUE') {
          solic.status = 'CONCLUIDO';
        } else if (stSimples === 'EM_ANDAMENTO') {
          solic.status = 'EM_ANDAMENTO';
        } else {
          solic.status = 'PENDENTE';
        }
        if (tarefa.protocolo_observacao) {
          solic.resposta_contabilidade = tarefa.protocolo_observacao;
        }
      }
    }

    excluirTarefa(tarefaId) {
      const tarefa = this.data.tarefas.find(t => t.id === tarefaId);
      if (!tarefa) return false;
      const user = this.getCurrentUser();
      if (!this.canManageDepartment(tarefa.departamento, user)) {
        throw new Error(`Política de Segurança (RLS): Sem permissão para excluir tarefa do setor ${tarefa.departamento}.`);
      }
      this.data.tarefas = this.data.tarefas.filter(t => t.id !== tarefaId);
      this.saveLocalData();
      this.registrarLog('EXCLUSAO_TAREFA', 'Tarefas', `Tarefa "${tarefa.titulo}" excluída.`);
      return true;
    }

    // =========================================================================
    // VISÃO GERAL ANUAL E CONTROLE DE FECHAMENTOS CONTÁBEIS (MATRIZ JAN-DEZ)
    // =========================================================================
    registrarOuAtualizarFechamentoMes(empresaId, competencia, departamento, statusOpcao, dataEntrega, observacao) {
      const deptAlvo = departamento === 'TODOS' ? 'CONTABIL' : (departamento || 'CONTABIL');
      let tarefasMes = this.data.tarefas.filter(
        t => t.empresa_id === empresaId && t.competencia === competencia && (departamento === 'TODOS' ? true : t.departamento === deptAlvo)
      );

      if (tarefasMes.length === 0) {
        const colab = this.data.profiles.find(p => p.departamento === deptAlvo && p.ativo);
        const tituloPadrao = deptAlvo === 'CONTABIL'
          ? 'Conciliação Bancária, Classificação e Fechamento Contábil Mensal (Balancete)'
          : `Fechamento Mensal ${deptAlvo} (${competencia})`;
        const nova = this.salvarTarefa({
          empresa_id: empresaId,
          competencia,
          departamento: deptAlvo,
          tipo: 'MENSAL',
          titulo: tituloPadrao,
          descricao: `Controle de fechamento referente à competência ${competencia}.`,
          solicitante: 'Controle de Fechamento Anual',
          prazo_entrega: this.calcularDataMesSubsequente(competencia, 25),
          data_entrega: (statusOpcao === 'ENTREGUE' || statusOpcao === 'CONFERIDO') ? (dataEntrega || new Date().toISOString().slice(0, 10)) : null,
          status: statusOpcao,
          responsavel_nome: colab ? colab.nome : (this.getCurrentUser()?.nome || 'Equipe Contábil'),
          protocolo_observacao: observacao || ''
        });
        return nova;
      }

      // Atualiza as tarefas do departamento naquele mês
      let ultima = null;
      tarefasMes.forEach(t => {
        ultima = this.atualizarStatusObservacaoTarefa(t.id, statusOpcao, dataEntrega, observacao);
      });
      return ultima;
    }

    getEncerramentoExercicio(empresaId, ano) {
      if (!Array.isArray(this.data.encerramentos_exercicio)) this.data.encerramentos_exercicio = [];
      return this.data.encerramentos_exercicio.find(e => e.empresa_id === empresaId && Number(e.ano) === Number(ano)) || null;
    }

    salvarEncerramentoExercicio(dados) {
      if (!Array.isArray(this.data.encerramentos_exercicio)) this.data.encerramentos_exercicio = [];
      const anoNum = Number(dados.ano);
      const idx = this.data.encerramentos_exercicio.findIndex(e => e.empresa_id === dados.empresa_id && Number(e.ano) === anoNum);
      const hoje = new Date().toISOString().slice(0, 10);
      const registro = {
        id: (idx !== -1 ? this.data.encerramentos_exercicio[idx].id : ('enc-' + Date.now())),
        empresa_id: dados.empresa_id,
        ano: anoNum,
        status: dados.status || 'ENCERRADO', // 'ENCERRADO' | 'PENDENTE'
        data_encerramento: dados.data_encerramento || hoje,
        responsavel_nome: dados.responsavel_nome || (this.getCurrentUser()?.nome || 'Equipe Contábil'),
        observacoes: dados.observacoes || ''
      };

      if (idx !== -1) {
        this.data.encerramentos_exercicio[idx] = registro;
      } else {
        this.data.encerramentos_exercicio.push(registro);
      }
      this.saveLocalData();
      const emp = this.data.empresas.find(e => e.id === dados.empresa_id);
      this.registrarLog('ENCERRAMENTO_EXERCICIO', 'Contábil', `Exercício ${anoNum} da empresa ${emp ? emp.nome_fantasia : ''} marcado como ${registro.status}.`);
      return registro;
    }

    gerarTarefasCompetencia(competencia, filtroEmpresaId = null) {
      const sub = this.obterMesSubsequente(competencia);

      const empresasAlvo = this.data.empresas.filter(e =>
        (e.status === 'ATIVA' || e.status === 'EM_ONBOARDING') &&
        (!filtroEmpresaId || e.id === filtroEmpresaId)
      );

      let criadas = 0;
      const modelos = this.getModelosTarefas().filter(m => m.ativo);

      empresasAlvo.forEach(emp => {
        const temProLabore = emp.possui_pro_labore !== false;
        const temFuncionarios = Boolean(emp.possui_funcionarios);

        modelos.forEach(mod => {
          const regimes = Array.isArray(mod.regimes_aplicaveis) ? mod.regimes_aplicaveis : ['Simples Nacional'];
          if (!regimes.includes(emp.regime_tributario)) return;

          // Regra de separação Pró-Labore vs Funcionários CLT:
          if ((mod.requer_funcionarios || mod.exige_funcionarios) && !temFuncionarios) return;
          if (mod.requer_pro_labore && !temProLabore && !temFuncionarios) return;

          const jaExiste = this.data.tarefas.some(
            t => t.empresa_id === emp.id &&
                 t.competencia === competencia &&
                 t.titulo === mod.titulo &&
                 t.tipo === 'MENSAL'
          );

          if (!jaExiste) {
            const prazoData = this.calcularDataMesSubsequente(competencia, mod.dia_prazo_padrao);
            const colabSetor = this.data.profiles.find(p => p.departamento === mod.departamento && p.ativo);

            this.data.tarefas.push({
              id: `tar-gen-${Date.now()}-${criadas}-${Math.random().toString(36).slice(2, 5)}`,
              empresa_id: emp.id,
              competencia,
              departamento: mod.departamento,
              tipo: 'MENSAL',
              titulo: mod.titulo,
              descricao: mod.descricao,
              solicitante: 'Rotina Mensal Automática',
              prazo_entrega: prazoData,
              data_entrega: null,
              status: 'NAO_INICIADA',
              responsavel_nome: colabSetor ? colabSetor.nome : 'Contador Sócio (Administrador)',
              protocolo_observacao: ''
            });
            criadas++;
          }
        });
      });

      this.gerarGuiasImpostosCompetencia(competencia);

      if (criadas > 0) {
        this.saveLocalData();
        this.registrarLog('GERACAO_TAREFAS_MENSAIS', 'Tarefas', `Geradas ${criadas} tarefas da competência ${competencia} com prazo de entrega em ${sub.label}.`);
      }
      return criadas;
    }

    // =========================================================================
    // CONTROLE DE ENVIO DE GUIAS DE IMPOSTOS (PRÓ-LABORE -> DARF INSS/IRRF | FUNCIONÁRIOS -> FGTS)
    // =========================================================================
    getGuiasImpostos(competencia) {
      if (!Array.isArray(this.data.guias_impostos)) {
        this.data.guias_impostos = [];
      }
      if (!competencia) return this.data.guias_impostos;
      return this.data.guias_impostos.filter(g => g.competencia === competencia);
    }

    salvarGuiaImposto(dados) {
      if (!Array.isArray(this.data.guias_impostos)) this.data.guias_impostos = [];

      if (dados.id) {
        const idx = this.data.guias_impostos.findIndex(g => g.id === dados.id);
        if (idx !== -1) {
          this.data.guias_impostos[idx] = {
            ...this.data.guias_impostos[idx],
            ...dados,
            valor: Number(dados.valor || 0),
            observacoes: dados.observacoes !== undefined ? dados.observacoes : (dados.protocolo || this.data.guias_impostos[idx].observacoes || '')
          };
          this.saveLocalData();
          this.registrarLog('EDICAO_GUIA_IMPOSTO', 'Tarefas/Guias', `Guia "${dados.tipo_guia}" atualizada.`);
          return this.data.guias_impostos[idx];
        }
      }

      const nova = {
        id: 'gimp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
        empresa_id: dados.empresa_id,
        competencia: dados.competencia,
        tipo_guia: dados.tipo_guia || 'DAS - Simples Nacional',
        departamento: dados.departamento || 'FISCAL',
        valor: Number(dados.valor || 0),
        data_vencimento: dados.data_vencimento || this.calcularDataMesSubsequente(dados.competencia, 20),
        status_envio: dados.status_envio || 'GERADA_AGUARDANDO_ENVIO',
        data_envio: dados.status_envio === 'ENVIADA_CLIENTE' ? (dados.data_envio || new Date().toISOString().slice(0, 10)) : null,
        canal_envio: dados.canal_envio || 'Portal do Cliente + WhatsApp',
        responsavel_nome: dados.responsavel_nome || this.getCurrentUser().nome,
        observacoes: dados.observacoes || dados.protocolo || ''
      };

      this.data.guias_impostos.unshift(nova);
      this.saveLocalData();
      const emp = this.data.empresas.find(e => e.id === nova.empresa_id);
      this.registrarLog('NOVA_GUIA_IMPOSTO', 'Tarefas/Guias', `Cadastrado controle de envio da guia ${nova.tipo_guia} para ${emp ? emp.nome_fantasia : 'Cliente'} (${nova.competencia}).`);
      return nova;
    }

    marcarGuiaImpostoEnviada(guiaId, dataEnvio, canalEnvio, valor, observacoes, publicarNoPortal = true) {
      const g = (this.data.guias_impostos || []).find(x => x.id === guiaId);
      if (!g) return null;
      g.status_envio = 'ENVIADA_CLIENTE';
      g.data_envio = dataEnvio || new Date().toISOString().slice(0, 10);
      if (canalEnvio) g.canal_envio = canalEnvio;
      if (valor !== undefined && valor !== '') g.valor = Number(valor || 0);
      if (observacoes !== undefined) g.observacoes = observacoes;
      g.responsavel_nome = this.getCurrentUser().nome;

      if (publicarNoPortal) {
        if (!Array.isArray(this.data.portal_arquivos)) this.data.portal_arquivos = [];
        const jaNoPortal = this.data.portal_arquivos.some(
          a => a.empresa_id === g.empresa_id && a.competencia === g.competencia && a.titulo.includes(g.tipo_guia)
        );
        if (!jaNoPortal) {
          this.data.portal_arquivos.unshift({
            id: 'arq-guia-' + Date.now(),
            empresa_id: g.empresa_id,
            pasta: 'GUIAS_IMPOSTOS',
            titulo: `Guia ${g.tipo_guia} — Competência ${g.competencia}`,
            nome_arquivo: `${g.tipo_guia.replace(/[^a-zA-Z0-9]/g, '_')}_${g.competencia.replace('/', '_')}.pdf`,
            tamanho: '260 KB',
            competencia: g.competencia,
            data_upload: g.data_envio,
            vencimento: g.data_vencimento,
            valor: g.valor,
            enviado_por: g.responsavel_nome,
            observacao: g.observacoes || `Guia enviada ao cliente (${g.canal_envio}).`,
            conteudo_url: ''
          });
        }
      }

      this.saveLocalData();
      const emp = this.data.empresas.find(e => e.id === g.empresa_id);
      this.registrarLog('ENVIO_GUIA_IMPOSTO', 'Tarefas/Guias', `Guia ${g.tipo_guia} (${emp ? emp.nome_fantasia : ''}) enviada ao cliente e disponibilizada no Portal em ${g.data_envio}.`);
      return g;
    }

    excluirGuiaImposto(guiaId) {
      this.data.guias_impostos = (this.data.guias_impostos || []).filter(g => g.id !== guiaId);
      this.saveLocalData();
    }

    gerarGuiasImpostosCompetencia(competencia) {
      if (!Array.isArray(this.data.guias_impostos)) this.data.guias_impostos = [];
      let criadas = 0;
      const empresasAtivas = this.data.empresas.filter(e => e.status === 'ATIVA' || e.status === 'EM_ONBOARDING');

      empresasAtivas.forEach(emp => {
        const guiasPadraoEmpresa = [];
        const temProLabore = emp.possui_pro_labore !== false;
        const temFuncionarios = Boolean(emp.possui_funcionarios);

        if (emp.regime_tributario === 'Simples Nacional') {
          guiasPadraoEmpresa.push({ tipo: 'DAS - Simples Nacional', dept: 'FISCAL', dia: 20 });
          guiasPadraoEmpresa.push({ tipo: 'DAE / DARE - ICMS (Antecipação / DIFAL / ST)', dept: 'FISCAL', dia: 20 });
        } else if (emp.regime_tributario === 'Lucro Presumido' || emp.regime_tributario === 'Lucro Real') {
          guiasPadraoEmpresa.push({ tipo: 'DARF - PIS / COFINS', dept: 'FISCAL', dia: 25 });
          guiasPadraoEmpresa.push({ tipo: 'DAE / DARE - ICMS (Antecipação / DIFAL / ST)', dept: 'FISCAL', dia: 20 });
        } else if (emp.regime_tributario === 'MEI') {
          guiasPadraoEmpresa.push({ tipo: 'DAS - SIMEI (MEI)', dept: 'FISCAL', dia: 20 });
        }

        // Pró-Labore (padrão na maioria das empresas) ou Funcionários -> Gera DARF INSS / IRRF
        if (temProLabore || temFuncionarios) {
          guiasPadraoEmpresa.push({
            tipo: 'DARF - DCTFWeb / INSS / IRRF (Pró-Labore / Folha)',
            dept: 'PESSOAL',
            dia: 20
          });
        }

        // Funcionários CLT -> Gera Guia de FGTS Digital (somente se possuir funcionário!)
        if (temFuncionarios) {
          guiasPadraoEmpresa.push({
            tipo: 'FGTS Digital - Guia Mensal (Funcionários CLT)',
            dept: 'PESSOAL',
            dia: 20
          });
        }

        guiasPadraoEmpresa.forEach(gp => {
          const jaExiste = this.data.guias_impostos.some(
            g => g.empresa_id === emp.id && g.competencia === competencia &&
            (g.tipo_guia === gp.tipo ||
             (gp.tipo.includes('MEI') && (g.tipo_guia.includes('MEI') || g.tipo_guia.includes('SIMEI'))) ||
             (gp.tipo.includes('DAS') && g.tipo_guia.includes('DAS') && !gp.tipo.includes('MEI') && !g.tipo_guia.includes('MEI')))
          );
          if (!jaExiste) {
            const colab = this.data.profiles.find(p => p.departamento === gp.dept && p.ativo);
            this.data.guias_impostos.push({
              id: `gimp-gen-${Date.now()}-${criadas}-${Math.random().toString(36).slice(2, 5)}`,
              empresa_id: emp.id,
              competencia,
              tipo_guia: gp.tipo,
              departamento: gp.dept,
              valor: 0.00,
              data_vencimento: this.calcularDataMesSubsequente(competencia, gp.dia),
              status_envio: 'PENDENTE_GERACAO',
              data_envio: null,
              canal_envio: 'Portal do Cliente + WhatsApp',
              responsavel_nome: colab ? colab.nome : 'Mariana Souza (Analista Fiscal)',
              observacoes: ''
            });
            criadas++;
          }
        });
      });

      if (criadas > 0) this.saveLocalData();
      return criadas;
    }

    // =========================================================================
    // CONTROLE DE PARCELAMENTOS ATIVOS, STATUS E GUIAS (APENAS EMITIDA E ENVIADA)
    // =========================================================================
    salvarParcelamento(dadosParc, competenciaAtual) {
      const isAvulso = Boolean(dadosParc.cliente_avulso);

      if (dadosParc.id) {
        const idx = this.data.parcelamentos.findIndex(p => p.id === dadosParc.id);
        if (idx !== -1) {
          this.data.parcelamentos[idx] = {
            ...this.data.parcelamentos[idx],
            cliente_avulso: isAvulso,
            nome_cliente: isAvulso ? (dadosParc.nome_cliente || '') : '',
            documento: isAvulso ? (dadosParc.documento || '') : '',
            empresa_id: isAvulso ? null : dadosParc.empresa_id,
            orgao: dadosParc.orgao,
            modalidade: dadosParc.modalidade,
            numero_processo: dadosParc.numero_processo || '',
            total_parcelas: Number(dadosParc.total_parcelas || 60),
            parcelas_pagas: Number(dadosParc.parcelas_pagas || 0),
            valor_consolidado: Number(dadosParc.valor_consolidado || 0),
            valor_parcela_estimado: Number(dadosParc.valor_parcela_estimado || 0),
            dia_vencimento: Number(dadosParc.dia_vencimento || 28),
            status: dadosParc.status || 'ATIVO',
            observacoes: dadosParc.observacoes || ''
          };
          this.saveLocalData();
          const emp = isAvulso ? null : this.data.empresas.find(e => e.id === dadosParc.empresa_id);
          const nomeLog = isAvulso ? `${dadosParc.nome_cliente} [Cliente Avulso]` : (emp ? emp.nome_fantasia : 'Cliente');
          this.registrarLog('EDICAO_PARCELAMENTO_CONFIRMADA', 'Parcelamentos', `Alterado cadastro do parcelamento ${dadosParc.orgao} (${nomeLog}) com dupla confirmação.`);
          return this.data.parcelamentos[idx];
        }
      }

      const novo = {
        id: 'parc-' + Date.now(),
        cliente_avulso: isAvulso,
        nome_cliente: isAvulso ? (dadosParc.nome_cliente || '') : '',
        documento: isAvulso ? (dadosParc.documento || '') : '',
        empresa_id: isAvulso ? null : dadosParc.empresa_id,
        orgao: dadosParc.orgao,
        modalidade: dadosParc.modalidade,
        numero_processo: dadosParc.numero_processo || '',
        total_parcelas: Number(dadosParc.total_parcelas || 60),
        parcelas_pagas: Number(dadosParc.parcelas_pagas || 0),
        valor_consolidado: Number(dadosParc.valor_consolidado || 0),
        valor_parcela_estimado: Number(dadosParc.valor_parcela_estimado || 0),
        dia_vencimento: Number(dadosParc.dia_vencimento || 28),
        data_inicio: dadosParc.data_inicio || new Date().toISOString().slice(0, 10),
        status: dadosParc.status || 'ATIVO',
        observacoes: dadosParc.observacoes || ''
      };

      this.data.parcelamentos.push(novo);
      if (competenciaAtual && (novo.status === 'ATIVO' || novo.status === 'EM_ATRASO')) {
        this.gerarGuiasParcelamentoCompetencia(competenciaAtual);
      }
      this.saveLocalData();
      const emp = isAvulso ? null : this.data.empresas.find(e => e.id === novo.empresa_id);
      const nomeLog = isAvulso ? `${novo.nome_cliente} [Cliente Avulso]` : (emp ? emp.nome_fantasia : 'Cliente');
      this.registrarLog('NOVO_PARCELAMENTO', 'Parcelamentos', `Cadastrado parcelamento ${novo.orgao} para ${nomeLog} (${novo.total_parcelas}x).`);
      return novo;
    }

    atualizarStatusParcelamento(parcelamentoId, novoStatus) {
      const parc = this.data.parcelamentos.find(p => p.id === parcelamentoId);
      if (!parc) return null;
      parc.status = novoStatus;
      this.saveLocalData();
      const emp = this.data.empresas.find(e => e.id === parc.empresa_id);
      this.registrarLog('STATUS_PARCELAMENTO', 'Parcelamentos', `Status do parcelamento ${parc.orgao} (${emp ? emp.nome_fantasia : ''}) alterado para ${novoStatus}.`);
      return parc;
    }

    excluirParcelamento(parcId) {
      const parc = this.data.parcelamentos.find(p => p.id === parcId);
      if (!parc) return false;
      this.data.parcelamentos = this.data.parcelamentos.filter(p => p.id !== parcId);
      this.data.parcelamento_guias = this.data.parcelamento_guias.filter(g => g.parcelamento_id !== parcId);
      this.saveLocalData();
      this.registrarLog('EXCLUSAO_PARCELAMENTO', 'Parcelamentos', `Parcelamento ${parc.orgao} (${parc.modalidade}) excluído.`);
      return true;
    }

    sincronizarPendenciasParcelamento(competencia) {
      const acordos = this.data.parcelamentos;

      acordos.forEach(parc => {
        const guiaAtual = this.data.parcelamento_guias.find(
          g => g.parcelamento_id === parc.id && g.competencia === competencia
        );
        if (!guiaAtual) return;

        const guiasAntNaoEnviadas = this.data.parcelamento_guias.filter(g =>
          g.parcelamento_id === parc.id &&
          this.compararCompetencias(g.competencia, competencia) < 0 &&
          g.status_guia !== 'ENVIADA_CLIENTE'
        );

        if (parc.status === 'EM_ATRASO' || guiasAntNaoEnviadas.length > 0) {
          guiaAtual.parcelas_anteriores_abertas = Math.max(1, guiasAntNaoEnviadas.length);
          if (!guiaAtual.detalhe_pendencia_anterior) {
            guiaAtual.detalhe_pendencia_anterior = guiasAntNaoEnviadas.length > 0
              ? `Guia anterior (${guiasAntNaoEnviadas.map(ga => `Comp. ${ga.competencia}`).join(', ')}) pendente / Acordo em atraso!`
              : 'Parcelamento sinalizado como ATIVO EM ATRASO na competência anterior!';
          }
        } else {
          guiaAtual.parcelas_anteriores_abertas = 0;
          guiaAtual.detalhe_pendencia_anterior = '';
        }
      });
      this.saveLocalData();
    }

    gerarGuiasParcelamentoCompetencia(competencia) {
      let criadas = 0;
      const ativos = this.data.parcelamentos.filter(p => p.status === 'ATIVO' || p.status === 'EM_ATRASO');

      ativos.forEach(parc => {
        const jaExiste = this.data.parcelamento_guias.some(
          g => g.parcelamento_id === parc.id && g.competencia === competencia
        );
        if (!jaExiste && parc.parcelas_pagas < parc.total_parcelas) {
          const emAtraso = parc.status === 'EM_ATRASO';
          const vencData = this.calcularDataMesSubsequente(competencia, parc.dia_vencimento || 28);
          this.data.parcelamento_guias.push({
            id: `guia-${Date.now()}-${criadas}-${Math.random().toString(36).slice(2, 5)}`,
            parcelamento_id: parc.id,
            empresa_id: parc.cliente_avulso ? null : parc.empresa_id,
            cliente_avulso: Boolean(parc.cliente_avulso),
            nome_cliente: parc.nome_cliente || '',
            documento: parc.documento || '',
            competencia,
            numero_parcela: Number(parc.parcelas_pagas) + 1,
            data_vencimento: vencData,
            valor_guia: Number(parc.valor_parcela_estimado),
            status_guia: 'PENDENTE_EMISSAO',
            data_emissao: null,
            data_envio_cliente: null,
            parcelas_anteriores_abertas: emAtraso ? 1 : 0,
            detalhe_pendencia_anterior: emAtraso ? 'Parcelamento transferido como EM ATRASO da competência anterior!' : '',
            responsavel_nome: this.getCurrentUser().nome,
            observacao: emAtraso ? 'Atenção: verificar parcela em atraso para evitar rescisão do acordo!' : ''
          });
          criadas++;
        }
      });

      this.sincronizarPendenciasParcelamento(competencia);

      if (criadas > 0) {
        this.saveLocalData();
        this.registrarLog('GERACAO_GUIAS_PARCELAMENTO', 'Parcelamentos', `Geradas ${criadas} guias de parcelamentos para a competência ${competencia}.`);
      }
      return criadas;
    }

    atualizarStatusGuiaParcelamento(guiaId, novoStatus) {
      const guia = this.data.parcelamento_guias.find(g => g.id === guiaId);
      if (!guia) return null;

      const hoje = new Date().toISOString().slice(0, 10);
      guia.status_guia = novoStatus;
      guia.responsavel_nome = this.getCurrentUser().nome;

      if (novoStatus === 'EMITIDA') {
        guia.data_emissao = guia.data_emissao || hoje;
      } else if (novoStatus === 'ENVIADA_CLIENTE') {
        if (!guia.data_emissao) guia.data_emissao = hoje;
        guia.data_envio_cliente = hoje;
      } else if (novoStatus === 'PENDENTE_EMISSAO') {
        guia.data_emissao = null;
        guia.data_envio_cliente = null;
      }

      this.saveLocalData();
      const emp = this.data.empresas.find(e => e.id === guia.empresa_id);
      this.registrarLog(
        'ATUALIZACAO_GUIA_PARCELAMENTO',
        'Parcelamentos',
        `Guia Parcela #${guia.numero_parcela} (${emp ? emp.nome_fantasia : ''}) marcada como ${novoStatus}.`
      );
      return guia;
    }

    // =========================================================================
    // CONTROLE DE CNDs (CERTIDÕES NEGATIVAS DE DÉBITOS)
    // =========================================================================
    getCNDs(empresaId = null) {
      if (!Array.isArray(this.data.cnds)) this.data.cnds = [];
      if (!empresaId || empresaId === 'TODOS') return this.data.cnds;
      return this.data.cnds.filter(c => c.empresa_id === empresaId);
    }

    calcularStatusValidadeCND(cnd) {
      const hoje = new Date().toISOString().slice(0, 10);
      if (cnd.situacao === 'POSITIVA_COM_PENDENCIA') {
        return { codigo: 'PENDENCIA', label: 'Positiva / Com Pendência', diasRestantes: -999, cor: 'rose' };
      }
      const dataVal = cnd.data_vencimento || cnd.data_validade;
      if (!dataVal) {
        return { codigo: 'SEM_DATA', label: 'Sem Data de Validade', diasRestantes: 0, cor: 'slate' };
      }
      const dHoje = new Date(hoje + 'T00:00:00');
      const dVal = new Date(dataVal + 'T00:00:00');
      const dias = Math.round((dVal - dHoje) / (1000 * 60 * 60 * 24));

      if (dias < 0) {
        return { codigo: 'VENCIDA', label: `Vencida há ${Math.abs(dias)} dia(s)`, diasRestantes: dias, cor: 'rose' };
      }
      if (dias <= 15) {
        return { codigo: 'VENCENDO', label: `Vence em ${dias} dia(s)`, diasRestantes: dias, cor: 'amber' };
      }
      return { codigo: 'VIGENTE', label: `Válida (${dias} dias rest.)`, diasRestantes: dias, cor: 'emerald' };
    }

    calcularDiasRestantes(dataValidade) {
      if (!dataValidade) return 0;
      const hoje = new Date().toISOString().slice(0, 10);
      const dHoje = new Date(hoje + 'T00:00:00');
      const dVal = new Date(dataValidade + 'T00:00:00');
      return Math.round((dVal - dHoje) / (1000 * 60 * 60 * 24));
    }

    salvarCND(dados) {
      if (!Array.isArray(this.data.cnds)) this.data.cnds = [];
      const dataVal = dados.data_vencimento || dados.data_validade;
      const numCtrl = dados.numero_controle || dados.codigo_controle || '';
      const orgaoNome = dados.orgao || dados.tipo_cnd || 'CND Federal / PGFN (RFB / PGFN / INSS)';
      const esfera = dados.esfera || (
        orgaoNome.includes('Federal') || orgaoNome.includes('RFB') || orgaoNome.includes('PGFN') ? 'FEDERAL' :
        orgaoNome.includes('FGTS') || orgaoNome.includes('CRF') ? 'FGTS' :
        orgaoNome.includes('Trabalhista') || orgaoNome.includes('CNDT') || orgaoNome.includes('TST') ? 'TRABALHISTA' :
        orgaoNome.includes('Estadual') || orgaoNome.includes('SEFAZ') ? 'ESTADUAL' :
        orgaoNome.includes('Municipal') || orgaoNome.includes('Prefeitura') || orgaoNome.includes('ISS') ? 'MUNICIPAL' : 'FEDERAL'
      );

      if (dados.id) {
        const idx = this.data.cnds.findIndex(c => c.id === dados.id);
        if (idx !== -1) {
          this.data.cnds[idx] = {
            ...this.data.cnds[idx],
            ...dados,
            esfera,
            orgao: orgaoNome,
            tipo_cnd: orgaoNome,
            data_validade: dataVal,
            data_vencimento: dataVal,
            codigo_controle: numCtrl,
            numero_controle: numCtrl,
            arquivo_pdf_nome: dados.arquivo_pdf_nome !== undefined ? dados.arquivo_pdf_nome : (this.data.cnds[idx].arquivo_pdf_nome || ''),
            arquivo_pdf_base64: dados.arquivo_pdf_base64 !== undefined ? dados.arquivo_pdf_base64 : (this.data.cnds[idx].arquivo_pdf_base64 || ''),
            origem_emissao: dados.origem_emissao || this.data.cnds[idx].origem_emissao || 'MANUAL_PDF',
            api_status: dados.api_status || this.data.cnds[idx].api_status || 'READY',
            ultima_consulta_api: new Date().toISOString()
          };
          this.saveLocalData();
          this.registrarLog('ATUALIZACAO_CND', 'CNDs', `Certidão ${orgaoNome} atualizada.`);
          return this.data.cnds[idx];
        }
      }

      const nova = {
        id: 'cnd-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
        empresa_id: dados.empresa_id,
        esfera,
        tipo_cnd: orgaoNome,
        orgao: orgaoNome,
        situacao: dados.situacao || 'NEGATIVA',
        data_emissao: dados.data_emissao || new Date().toISOString().slice(0, 10),
        data_validade: dataVal,
        data_vencimento: dataVal,
        codigo_controle: numCtrl,
        numero_controle: numCtrl,
        arquivo_pdf_nome: dados.arquivo_pdf_nome || '',
        arquivo_pdf_base64: dados.arquivo_pdf_base64 || '',
        origem_emissao: dados.origem_emissao || 'MANUAL_PDF',
        api_status: dados.api_status || 'READY',
        ultima_consulta_api: new Date().toISOString(),
        responsavel_nome: dados.responsavel_nome || (this.getCurrentUser()?.nome || 'Equipe Contábil'),
        observacoes: dados.observacoes || ''
      };
      this.data.cnds.unshift(nova);
      this.saveLocalData();
      const emp = this.data.empresas.find(e => e.id === nova.empresa_id);
      this.registrarLog('NOVA_CND', 'CNDs', `Cadastrada ${nova.orgao} para ${emp ? emp.nome_fantasia : 'Cliente'} (Validade: ${dataVal}).`);
      return nova;
    }

    renovarCNDViaAPIIntegraContador(cndId) {
      if (!Array.isArray(this.data.cnds)) this.data.cnds = [];
      const idx = this.data.cnds.findIndex(c => c.id === cndId);
      if (idx === -1) throw new Error('Certidão não encontrada para renovação.');

      const cnd = this.data.cnds[idx];
      const emp = this.data.empresas.find(e => e.id === cnd.empresa_id);
      const cfg = this.getEscritorioConfig();
      const apiCfg = cfg.api_integra_contador || {};

      if (!apiCfg.ativo) {
        throw new Error('API Integra Contador não está ativada nas configurações do escritório.');
      }

      if (typeof fetch === 'function' && apiCfg.endpoint) {
        try {
          const p = fetch(apiCfg.endpoint, { method: 'GET' });
          if (p && typeof p.catch === 'function') {
            p.catch(() => {});
          }
        } catch (netErr) {
          throw new Error('Serviço da API Integra Contador (SERPRO / Receita Federal) indisponível: ' + netErr.message);
        }
      }

      // Sem resposta oficial confirmada, não altera a situação nem simula renovação
      throw new Error('Serviço oficial da API Integra Contador indisponível no momento. A situação da certidão e o arquivo anterior foram mantidos.');
    }

    anexarPDFCND(cndId, nomeArquivo, base64 = '', dataEmissao = null, dataValidade = null, numeroControle = null) {
      if (!Array.isArray(this.data.cnds)) this.data.cnds = [];
      const idx = this.data.cnds.findIndex(c => c.id === cndId);
      if (idx === -1) throw new Error('Certidão não encontrada.');

      const cnd = this.data.cnds[idx];
      const emp = this.data.empresas.find(e => e.id === cnd.empresa_id);

      this.data.cnds[idx] = {
        ...cnd,
        arquivo_pdf_nome: nomeArquivo || cnd.arquivo_pdf_nome || 'Certidao.pdf',
        arquivo_pdf_base64: base64 || cnd.arquivo_pdf_base64 || '',
        origem_emissao: 'MANUAL_PDF',
        data_emissao: dataEmissao || cnd.data_emissao,
        data_validade: dataValidade || cnd.data_validade,
        data_vencimento: dataValidade || cnd.data_vencimento,
        numero_controle: numeroControle || cnd.numero_controle,
        codigo_controle: numeroControle || cnd.codigo_controle,
        situacao: cnd.situacao || 'NEGATIVA'
      };

      this.saveLocalData();
      this.registrarLog('ANEXO_PDF_CND', 'CNDs', `Arquivo PDF ${nomeArquivo} anexado à certidão ${cnd.orgao} de ${emp ? emp.nome_fantasia : 'Cliente'}.`);
      return this.data.cnds[idx];
    }

    excluirCND(cndId) {
      this.data.cnds = (this.data.cnds || []).filter(c => c.id !== cndId);
      this.saveLocalData();
    }

    gerarGradePadraoCNDs() {
      if (!Array.isArray(this.data.cnds)) this.data.cnds = [];
      let criadas = 0;
      const hoje = new Date();
      const emissaoStr = hoje.toISOString().slice(0, 10);
      const tipos = window.ZGESTOR_MODELS.tiposCND || [];

      this.data.empresas.forEach(emp => {
        tipos.forEach(t => {
          const nomeTipo = typeof t === 'string' ? t : t.nome;
          const diasVal = typeof t === 'object' && t.validade_dias ? t.validade_dias : 180;
          const jaExiste = this.data.cnds.some(c => c.empresa_id === emp.id && (c.tipo_cnd === nomeTipo || c.orgao === nomeTipo));
          if (!jaExiste) {
            const dVal = new Date(hoje.getTime() + (diasVal * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
            this.data.cnds.push({
              id: `cnd-gen-${Date.now()}-${criadas}-${Math.random().toString(36).slice(2, 5)}`,
              empresa_id: emp.id,
              tipo_cnd: nomeTipo,
              orgao: nomeTipo,
              situacao: 'NEGATIVA',
              data_emissao: emissaoStr,
              data_validade: dVal,
              data_vencimento: dVal,
              codigo_controle: '',
              numero_controle: '',
              responsavel_nome: this.getCurrentUser().nome,
              observacoes: 'Gerada na grade padrão de monitoramento.'
            });
            criadas++;
          }
        });
      });
      if (criadas > 0) this.saveLocalData();
      return criadas;
    }

    // =========================================================================
    // PORTAL / CENTRAL DO CLIENTE: ARQUIVOS DA EMPRESA E SOLICITAÇÕES À CONTABILIDADE
    // =========================================================================
    getArquivosPortalCliente(empresaId = null, pasta = 'TODAS') {
      if (!Array.isArray(this.data.portal_arquivos)) {
        this.data.portal_arquivos = [];
      }
      const user = this.getCurrentUser();
      const isSimulacao = typeof window !== 'undefined' && window.ZGestorApp?.state?.modoSimulacaoCliente;
      if (user && user.cargo === 'CLIENTE' && !isSimulacao) {
        if (empresaId && empresaId !== 'TODOS' && empresaId !== user.empresa_id) {
          throw new Error('Acesso não autorizado para arquivos desta empresa.');
        }
        empresaId = user.empresa_id;
      }
      let lista = [...this.data.portal_arquivos];
      if (empresaId && empresaId !== 'TODOS') {
        lista = lista.filter(a => a.empresa_id === empresaId);
      }
      if (user && user.cargo === 'CLIENTE' && !isSimulacao) {
        lista = lista.filter(a => a.empresa_id === user.empresa_id);
      }
      if (pasta && pasta !== 'TODAS') {
        lista = lista.filter(a => a.pasta === pasta);
      }
      return lista;
    }

    salvarArquivoPortalCliente(dados) {
      if (!Array.isArray(this.data.portal_arquivos)) {
        this.data.portal_arquivos = [];
      }
      const user = this.getCurrentUser();
      if (!user) {
        throw new Error('Política de Segurança: Sessão obrigatória.');
      }
      const isSimulacao = typeof window !== 'undefined' && window.ZGestorApp?.state?.modoSimulacaoCliente;
      if (isSimulacao) {
        throw new Error('Operações de gravação são bloqueadas durante a simulação.');
      }
      if (user.cargo === 'CLIENTE') {
        if (dados.empresa_id && dados.empresa_id !== user.empresa_id) {
          throw new Error('Acesso não autorizado para salvar arquivo em outra empresa.');
        }
        dados.empresa_id = user.empresa_id;
      }
      const conteudoBase64 = dados.conteudo_base64 || dados.dataUrl || dados.arquivo_base64 || '';
      const nomeArquivo = dados.nome_arquivo || (dados.titulo ? `${dados.titulo.replace(/[^a-zA-Z0-9]/g, '_')}.pdf` : 'documento.pdf');

      if (dados.id) {
        const idx = this.data.portal_arquivos.findIndex(a => a.id === dados.id);
        if (idx !== -1) {
          const existing = this.data.portal_arquivos[idx];
          if (user.cargo === 'CLIENTE') {
            if (existing.empresa_id !== user.empresa_id) {
              throw new Error('Acesso não autorizado para editar arquivo de outra empresa.');
            }
            dados.empresa_id = user.empresa_id;
          }
          this.data.portal_arquivos[idx] = {
            ...existing,
            ...dados,
            empresa_id: user.cargo === 'CLIENTE' ? user.empresa_id : (dados.empresa_id || existing.empresa_id),
            nome_arquivo: nomeArquivo || existing.nome_arquivo,
            conteudo_base64: conteudoBase64 || existing.conteudo_base64 || ''
          };
          this.saveLocalData();
          return this.data.portal_arquivos[idx];
        }
      }
      const novo = {
        id: 'arq-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
        empresa_id: dados.empresa_id,
        pasta: dados.pasta || 'CONSTITUTIVOS',
        titulo: dados.titulo,
        nome_arquivo: nomeArquivo,
        tamanho: dados.tamanho || '350 KB',
        competencia: dados.competencia || 'Permanente',
        data_upload: dados.data_upload || new Date().toISOString().slice(0, 10),
        vencimento: dados.vencimento || null,
        valor: Number(dados.valor || 0),
        enviado_por: dados.enviado_por || user.nome || 'Escritório',
        observacao: dados.observacao || '',
        conteudo_url: dados.conteudo_url || '',
        conteudo_base64: conteudoBase64
      };
      this.data.portal_arquivos.unshift(novo);
      const emp = this.data.empresas.find(e => e.id === novo.empresa_id);
      if (Array.isArray(this.data.audit_logs)) {
        this.data.audit_logs.unshift({
          id: 'log-' + Date.now(),
          usuario_nome: user ? user.nome : 'Sistema',
          usuario_cargo: user ? `${user.cargo} (${user.departamento})` : 'SISTEMA',
          acao: 'UPLOAD_PORTAL_CLIENTE',
          modulo: 'Central do Cliente',
          detalhes: `Arquivo "${novo.titulo}" disponibilizado no Portal do Cliente para ${emp ? emp.nome_fantasia : 'Cliente'}.`,
          created_at: new Date().toISOString()
        });
        if (this.data.audit_logs.length > 250) this.data.audit_logs = this.data.audit_logs.slice(0, 250);
      }
      try {
        this.saveLocalData();
      } catch (err) {
        const rIdx = this.data.portal_arquivos.indexOf(novo);
        if (rIdx !== -1) this.data.portal_arquivos.splice(rIdx, 1);
        if (Array.isArray(this.data.audit_logs) && this.data.audit_logs.length > 0) this.data.audit_logs.shift();
        throw err;
      }
      return novo;
    }

    excluirArquivoPortalCliente(id) {
      const user = this.getCurrentUser();
      const isSimulacao = typeof window !== 'undefined' && window.ZGestorApp?.state?.modoSimulacaoCliente;
      if (!user) {
        throw new Error('Política de Segurança: Sessão obrigatória.');
      }
      if (isSimulacao) {
        throw new Error('Operações de exclusão são bloqueadas durante a simulação.');
      }
      if (user.cargo === 'CLIENTE') {
        throw new Error('Acesso não autorizado para exclusão de arquivos.');
      }
      this.data.portal_arquivos = (this.data.portal_arquivos || []).filter(a => a.id !== id);
      this.saveLocalData();
    }

    marcarArquivoPortalVisualizado(id) {
      if (!Array.isArray(this.data.portal_arquivos)) return null;
      const arq = this.data.portal_arquivos.find(a => a.id === id);
      if (!arq) return null;

      const user = this.getCurrentUser();
      if (!user) {
        throw new Error('Acesso negado: sessão obrigatória.');
      }
      const isSimulacao = typeof window !== 'undefined' && window.ZGestorApp && window.ZGestorApp.state && Boolean(window.ZGestorApp.state.modoSimulacaoCliente);
      const isRealClient = Boolean(user && user.cargo === 'CLIENTE' && !isSimulacao);

      if (isRealClient && arq.empresa_id !== user.empresa_id) {
        throw new Error('Acesso não autorizado para arquivo de outra empresa.');
      }

      // Se for colaborador/administrador do escritório abrindo internamente ou simulação administrativa, NÃO marca como confirmação do cliente!
      if (!isRealClient) {
        return arq;
      }

      const agora = new Date();
      const pad = n => String(n).padStart(2, '0');
      const dataFormatada = `${pad(agora.getDate())}/${pad(agora.getMonth() + 1)}/${agora.getFullYear()} às ${pad(agora.getHours())}:${pad(agora.getMinutes())}`;

      arq.visualizado = true;
      arq.cliente_confirmou_leitura = true;
      arq.data_visualizacao = agora.toISOString();
      arq.visualizado_em_fmt = dataFormatada;
      arq.visualizado_por = (user && user.nome) ? user.nome : 'Cliente via Portal';
      arq.visualizado_email = (user && user.email) ? user.email : '';
      arq.status_leitura = 'VISUALIZADO_PELO_CLIENTE';

      // Documentos constitutivos e permanentes NÃO devem baixar rotinas mensais de impostos ou parcelamentos!
      if (arq.pasta === 'CONSTITUTIVOS' || arq.competencia === 'Permanente') {
        this.saveLocalData();
        return arq;
      }

      // 1. Atualiza rotina em guias_impostos
      if (Array.isArray(this.data.guias_impostos)) {
        const guias = this.data.guias_impostos.filter(g =>
          g.empresa_id === arq.empresa_id &&
          (arq.guia_imposto_id ? g.id === arq.guia_imposto_id : (g.competencia === arq.competencia))
        );
        guias.forEach(g => {
          const nomeLower = (arq.nome_arquivo || '').toLowerCase();
          const titLower = (arq.titulo || '').toLowerCase();
          const tipoLower = (g.tipo_guia || '').toLowerCase();
          const matchTipo =
            ((tipoLower.includes('das') || tipoLower.includes('simei') || tipoLower.includes('mei')) &&
             (nomeLower.includes('das') || titLower.includes('das') || nomeLower.includes('pgmei') || nomeLower.includes('simei'))) ||
            (tipoLower.includes('icms') && (nomeLower.includes('icms') || nomeLower.includes('dae') || titLower.includes('icms'))) ||
            (tipoLower.includes('fgts') && (nomeLower.includes('fgts') || titLower.includes('fgts'))) ||
            ((tipoLower.includes('darf') || tipoLower.includes('inss')) && (nomeLower.includes('darf') || nomeLower.includes('inss') || titLower.includes('darf')));

          if (matchTipo || arq.guia_imposto_id === g.id) {
            g.status_envio = 'VISUALIZADA_CLIENTE';
            g.visualizado_em = dataFormatada;
            g.visualizado_por = arq.visualizado_por;
          }
        });
      }

      // 2. Atualiza guias de parcelamentos se aplicável (apenas se houver vínculo explícito via parcelamento_guia_id válido)
      if (Array.isArray(this.data.parcelamento_guias) && arq.parcelamento_guia_id) {
        const parcs = this.data.parcelamento_guias.filter(g =>
          g.empresa_id === arq.empresa_id &&
          g.id === arq.parcelamento_guia_id
        );
        parcs.forEach(g => {
          g.status_guia = 'VISUALIZADA_CLIENTE';
          g.visualizado_em = dataFormatada;
          g.visualizado_por = arq.visualizado_por;
        });
      }

      // 3. Atualiza comprovante de leitura nas tarefas/obrigações da rotina
      if (Array.isArray(this.data.tarefas)) {
        const tarefas = this.data.tarefas.filter(t =>
          t.empresa_id === arq.empresa_id &&
          t.competencia === arq.competencia
        );
        tarefas.forEach(t => {
          const titLower = (t.titulo || '').toLowerCase();
          const arqTitLower = (arq.titulo || '').toLowerCase();
          const arqNomeLower = (arq.nome_arquivo || '').toLowerCase();
          const matchRotina =
            (titLower.includes('pgdas') && (arqTitLower.includes('das') || arqNomeLower.includes('das'))) ||
            (titLower.includes('fgts') && (arqTitLower.includes('fgts') || arqNomeLower.includes('fgts'))) ||
            (titLower.includes('pró-labore') && (arqTitLower.includes('darf') || arqNomeLower.includes('darf') || arqNomeLower.includes('inss')));
          if (matchRotina) {
            const notaLeitura = `✓ Baixada/Visualizada pelo cliente em ${dataFormatada} (${arq.visualizado_por})`;
            if (!t.protocolo_observacao || !t.protocolo_observacao.includes('Baixada/Visualizada')) {
              t.protocolo_observacao = t.protocolo_observacao ? `${t.protocolo_observacao} • ${notaLeitura}` : notaLeitura;
            }
          }
        });
      }

      this.saveLocalData();
      this.registrarLog('COMPROVANTE_LEITURA_PORTAL', 'Portal do Cliente', `Comprovante de Leitura/Baixa: ${arq.visualizado_por} acessou "${arq.titulo}" (${arq.nome_arquivo}) em ${dataFormatada}. Rotina baixada como 'Guia Visualizada/Baixada'.`);
      return arq;
    }

    getRegistrosCentralCliente(empresaId = null) {
      if (!Array.isArray(this.data.central_cliente_registros)) {
        this.data.central_cliente_registros = [];
      }
      const user = this.getCurrentUser();
      const isSimulacao = typeof window !== 'undefined' && window.ZGestorApp?.state?.modoSimulacaoCliente;
      if (user && user.cargo === 'CLIENTE' && !isSimulacao) {
        if (empresaId && empresaId !== 'TODOS' && empresaId !== user.empresa_id) {
          throw new Error('Acesso não autorizado para solicitações desta empresa.');
        }
        empresaId = user.empresa_id;
      }
      if (!empresaId || empresaId === 'TODOS') {
        if (user && user.cargo === 'CLIENTE' && !isSimulacao) {
          return this.data.central_cliente_registros.filter(r => r.empresa_id === user.empresa_id);
        }
        return this.data.central_cliente_registros;
      }
      return this.data.central_cliente_registros.filter(r => r.empresa_id === empresaId);
    }

    salvarRegistroCentralCliente(dados, criarTarefaVinculada = true) {
      if (!Array.isArray(this.data.central_cliente_registros)) {
        this.data.central_cliente_registros = [];
      }

      const user = this.getCurrentUser();
      if (!user) {
        throw new Error('Política de Segurança: Sessão obrigatória.');
      }
      const isSimulacao = typeof window !== 'undefined' && window.ZGestorApp?.state?.modoSimulacaoCliente;
      if (isSimulacao) {
        throw new Error('Operações de gravação são bloqueadas durante a simulação.');
      }
      if (user.cargo === 'CLIENTE') {
        if (dados.empresa_id && dados.empresa_id !== user.empresa_id) {
          throw new Error('Acesso não autorizado para registrar solicitação em outra empresa.');
        }
        dados.empresa_id = user.empresa_id;
      }

      if (dados.id) {
        const idx = this.data.central_cliente_registros.findIndex(r => r.id === dados.id);
        if (idx !== -1) {
          const existing = this.data.central_cliente_registros[idx];
          if (user.cargo === 'CLIENTE') {
            if (existing.empresa_id !== user.empresa_id) {
              throw new Error('Acesso não autorizado para editar solicitação de outra empresa.');
            }
            dados.empresa_id = user.empresa_id;
          }
          this.data.central_cliente_registros[idx] = { ...this.data.central_cliente_registros[idx], ...dados };
          this.saveLocalData();
          return this.data.central_cliente_registros[idx];
        }
      }

      const emp = this.data.empresas.find(e => e.id === dados.empresa_id);
      const dept = dados.departamento || 'CONTABIL';
      const colabSetor = this.data.profiles.find(p => p.departamento === dept && p.ativo);
      const respNome = dados.responsavel_nome || (colabSetor ? colabSetor.nome : (user ? user.nome : 'Escritório'));
      const hoje = new Date().toISOString().slice(0, 10);
      const prazoDesejado = dados.prazo_desejado || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const compAtiva = dados.competencia || (this.data && this.data.competencia_ativa) || '10/2026';

      let tarefaIdCriada = '';
      if (criarTarefaVinculada !== false) {
        const novoIdTar = 'tar-portal-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
        const novaTar = {
          id: novoIdTar,
          empresa_id: dados.empresa_id,
          competencia: compAtiva,
          departamento: dept,
          tipo: 'AVULSA',
          origem: 'PORTAL_CLIENTE',
          titulo: dados.titulo && dados.titulo.startsWith('[Portal do Cliente]') ? dados.titulo : `[Portal do Cliente] ${dados.titulo}`,
          descricao: dados.descricao || '',
          solicitante: dados.solicitante_cliente || (emp ? `${emp.responsavel_legal || emp.nome_fantasia} (Portal do Cliente)` : 'Portal do Cliente'),
          prazo_entrega: prazoDesejado,
          data_entrega: null,
          status: 'PENDENTE',
          responsavel_nome: respNome,
          protocolo_observacao: 'Solicitação aberta pelo cliente no Portal Central do Cliente.'
        };
        this.data.tarefas.unshift(novaTar);
        tarefaIdCriada = novaTar.id;
      }

      const novo = {
        id: 'cc-' + Date.now(),
        empresa_id: dados.empresa_id,
        categoria: dados.categoria || 'SOLICITACAO',
        departamento: dept,
        titulo: dados.titulo,
        descricao: dados.descricao || '',
        solicitante_cliente: dados.solicitante_cliente || (emp ? emp.responsavel_legal : 'Cliente'),
        canal: dados.canal || 'Portal do Cliente',
        data_registro: dados.data_registro || hoje,
        prazo_desejado: prazoDesejado,
        responsavel_nome: respNome,
        status: dados.status || 'PENDENTE',
        resposta_contabilidade: dados.resposta_contabilidade || '',
        tarefa_vinculada_id: tarefaIdCriada
      };

      this.data.central_cliente_registros.unshift(novo);
      this.saveLocalData();
      this.registrarLog('SOLICITACAO_PORTAL_CLIENTE', 'Central do Cliente', `Solicitação "${novo.titulo}" registrada no Portal de ${emp ? emp.nome_fantasia : 'Cliente'} e integrada às Tarefas (${dept}).`);
      return novo;
    }

    alterarStatusRegistroCentral(id, novoStatus, respostaContabilidade) {
      const user = this.getCurrentUser();
      if (!user) {
        throw new Error('Política de Segurança: Sessão obrigatória.');
      }
      const isSimulacao = typeof window !== 'undefined' && window.ZGestorApp?.state?.modoSimulacaoCliente;
      if (isSimulacao) {
        throw new Error('Operações de gravação são bloqueadas durante a simulação.');
      }
      const reg = (this.data.central_cliente_registros || []).find(r => r.id === id);
      if (!reg) return null;
      if (user.cargo === 'CLIENTE' && reg.empresa_id !== user.empresa_id) {
        throw new Error('Acesso não autorizado para alterar solicitação de outra empresa.');
      }
      reg.status = novoStatus;
      if (respostaContabilidade !== undefined) {
        reg.resposta_contabilidade = respostaContabilidade;
      }

      if (reg.tarefa_vinculada_id) {
        const tar = this.data.tarefas.find(t => t.id === reg.tarefa_vinculada_id);
        if (tar) {
          const hoje = new Date().toISOString().slice(0, 10);
          if (novoStatus === 'CONCLUIDO') {
            tar.data_entrega = tar.data_entrega || hoje;
            tar.status = tar.data_entrega <= (tar.prazo_entrega || hoje) ? 'ENTREGUE_NO_PRAZO' : 'ENTREGUE_COM_ATRASO';
          } else if (novoStatus === 'EM_ANDAMENTO') {
            tar.data_entrega = null;
            tar.status = 'EM_ANDAMENTO';
          } else {
            tar.data_entrega = null;
            tar.status = 'PENDENTE';
          }
          if (respostaContabilidade) {
            tar.protocolo_observacao = respostaContabilidade;
          }
        }
      }

      this.saveLocalData();
      return reg;
    }

    excluirRegistroCentralCliente(id) {
      const user = this.getCurrentUser();
      if (!user) {
        throw new Error('Política de Segurança: Sessão obrigatória.');
      }
      const isSimulacao = typeof window !== 'undefined' && window.ZGestorApp?.state?.modoSimulacaoCliente;
      if (isSimulacao) {
        throw new Error('Operações de exclusão são bloqueadas durante a simulação.');
      }
      const reg = (this.data.central_cliente_registros || []).find(r => r.id === id);
      if (reg && user.cargo === 'CLIENTE' && reg.empresa_id !== user.empresa_id) {
        throw new Error('Acesso não autorizado para exclusão de solicitação de outra empresa.');
      }
      this.data.central_cliente_registros = (this.data.central_cliente_registros || []).filter(r => r.id !== id);
      this.saveLocalData();
    }

    // =========================================================================
    // CONTROLE DE HONORÁRIOS MENSAIS COM TRANSPORTE DE SALDO DO MÊS ANTERIOR
    // =========================================================================
    obterSaldoAnteriorEmpresa(empresaId, competenciaAtual) {
      const compAnt = this.obterCompetenciaAnterior(competenciaAtual);
      const honAnt = this.data.honorarios.find(
        h => h.empresa_id === empresaId && h.competencia === compAnt
      );
      if (honAnt && Number(honAnt.saldo_aberto) > 0) {
        return {
          valor: Number(honAnt.saldo_aberto),
          competencia: compAnt
        };
      }
      return { valor: 0, competencia: '' };
    }

    recalcularHonorario(honorarioId) {
      const hon = this.data.honorarios.find(h => h.id === honorarioId);
      if (!hon) return null;

      const ant = this.obterSaldoAnteriorEmpresa(hon.empresa_id, hon.competencia);
      if (ant.valor > 0) {
        hon.saldo_anterior = ant.valor;
        hon.competencia_saldo_anterior = ant.competencia;
      } else if (hon.competencia_saldo_anterior) {
        hon.saldo_anterior = 0;
        hon.competencia_saldo_anterior = '';
      }

      const pagamentos = this.data.honorario_pagamentos.filter(p => p.honorario_id === honorarioId);
      const somaPago = pagamentos.reduce((acc, p) => acc + Number(p.valor || 0), 0);
      const valorLiquido = Math.max(
        0,
        Number(hon.valor_mensal || 0) +
        Number(hon.saldo_anterior || 0) +
        Number(hon.servicos_extras || 0) -
        Number(hon.desconto || 0)
      );
      const saldoAberto = Math.max(0, Number((valorLiquido - somaPago).toFixed(2)));

      hon.valor_pago = Number(somaPago.toFixed(2));
      hon.saldo_aberto = saldoAberto;

      const hoje = new Date().toISOString().slice(0, 10);
      if (saldoAberto <= 0.009 && valorLiquido > 0) {
        hon.status = 'PAGO';
      } else if (somaPago > 0 && saldoAberto > 0) {
        hon.status = 'PARCIAL';
      } else if (hon.data_vencimento < hoje && saldoAberto > 0) {
        hon.status = 'ATRASADO';
      } else {
        hon.status = 'ABERTO';
      }

      const compSeg = this.obterMesSubsequente(hon.competencia).label;
      const honSeg = this.data.honorarios.find(
        h => h.empresa_id === hon.empresa_id && h.competencia === compSeg
      );
      if (honSeg) {
        this.recalcularHonorario(honSeg.id);
      }

      this.saveLocalData();
      return hon;
    }

    sincronizarSaldosAnterioresHonorarios(competencia) {
      const lista = this.data.honorarios.filter(h => h.competencia === competencia);
      lista.forEach(h => this.recalcularHonorario(h.id));
    }

    gerarHonorariosCompetencia(competencia) {
      if (!this.canAccessModule('honorarios')) {
        throw new Error('Política de Segurança (RLS): Acesso restrito ao setor Financeiro e Administradores.');
      }

      const sub = this.obterMesSubsequente(competencia);
      let criados = 0;
      const empresasAtivas = this.data.empresas.filter(e => e.status === 'ATIVA' || e.status === 'EM_ONBOARDING');

      empresasAtivas.forEach(emp => {
        const existente = this.data.honorarios.find(
          h => h.empresa_id === emp.id && h.competencia === competencia
        );
        const saldoAnt = this.obterSaldoAnteriorEmpresa(emp.id, competencia);

        if (!existente) {
          const vencimentoMesSeguinte = this.calcularDataMesSubsequente(competencia, emp.dia_vencimento_honorario || 10);
          const valorPadrao = Number(emp.valor_honorario_padrao || 0);
          const totalComAnterior = Number((valorPadrao + saldoAnt.valor).toFixed(2));

          const novoHon = {
            id: `hon-${Date.now()}-${criados}-${Math.random().toString(36).slice(2, 5)}`,
            empresa_id: emp.id,
            competencia,
            data_vencimento: vencimentoMesSeguinte,
            valor_mensal: valorPadrao,
            saldo_anterior: saldoAnt.valor,
            competencia_saldo_anterior: saldoAnt.competencia,
            servicos_extras: 0.00,
            desconto: 0.00,
            valor_pago: 0.00,
            saldo_aberto: totalComAnterior,
            status: 'ABERTO',
            observacoes: saldoAnt.valor > 0
              ? `Inclui saldo remanescente em aberto de R$ ${saldoAnt.valor.toFixed(2)} da competência ${saldoAnt.competencia}.`
              : `Honorário ref. competência ${competencia} com vencimento em ${sub.label}.`
          };
          this.data.honorarios.push(novoHon);
          criados++;
        } else {
          this.recalcularHonorario(existente.id);
        }
      });

      if (criados > 0) {
        this.saveLocalData();
        this.registrarLog('GERACAO_HONORARIOS', 'Honorários', `Gerados ${criados} honorários da competência ${competencia} (vencimento em ${sub.label}) com transporte automático de saldos anteriores em aberto.`);
      }
      return criados;
    }

    salvarHonorario(dadosHon) {
      if (!this.canAccessModule('honorarios')) {
        throw new Error('Política de Segurança (RLS): Apenas Administradores ou Financeiro podem gerenciar honorários.');
      }

      if (dadosHon.id) {
        const idx = this.data.honorarios.findIndex(h => h.id === dadosHon.id);
        if (idx !== -1) {
          this.data.honorarios[idx] = {
            ...this.data.honorarios[idx],
            valor_mensal: Number(dadosHon.valor_mensal || 0),
            saldo_anterior: dadosHon.saldo_anterior !== undefined ? Number(dadosHon.saldo_anterior) : Number(this.data.honorarios[idx].saldo_anterior || 0),
            servicos_extras: Number(dadosHon.servicos_extras || 0),
            desconto: Number(dadosHon.desconto || 0),
            data_vencimento: dadosHon.data_vencimento || this.data.honorarios[idx].data_vencimento,
            observacoes: dadosHon.observacoes !== undefined ? dadosHon.observacoes : this.data.honorarios[idx].observacoes
          };
          const atualizado = this.recalcularHonorario(dadosHon.id);
          const emp = this.data.empresas.find(e => e.id === atualizado.empresa_id);
          this.registrarLog('EDICAO_HONORARIO', 'Honorários', `Honorário de ${emp ? emp.nome_fantasia : 'Cliente'} (${atualizado.competencia}) ajustado. Saldo em aberto: R$ ${atualizado.saldo_aberto.toFixed(2)}.`);
          return atualizado;
        }
      }

      const valorLiquido = Math.max(0, Number(dadosHon.valor_mensal || 0) + Number(dadosHon.saldo_anterior || 0) + Number(dadosHon.servicos_extras || 0) - Number(dadosHon.desconto || 0));
      const novo = {
        id: 'hon-' + Date.now(),
        empresa_id: dadosHon.empresa_id,
        competencia: dadosHon.competencia,
        data_vencimento: dadosHon.data_vencimento,
        valor_mensal: Number(dadosHon.valor_mensal || 0),
        saldo_anterior: Number(dadosHon.saldo_anterior || 0),
        competencia_saldo_anterior: dadosHon.competencia_saldo_anterior || '',
        servicos_extras: Number(dadosHon.servicos_extras || 0),
        desconto: Number(dadosHon.desconto || 0),
        valor_pago: 0,
        saldo_aberto: valorLiquido,
        status: 'ABERTO',
        observacoes: dadosHon.observacoes || ''
      };
      this.data.honorarios.push(novo);
      this.recalcularHonorario(novo.id);
      return novo;
    }

    registrarPagamentoHonorario(honorarioId, valorPago, dataPagamento, formaPagamento, observacao, contaDestino) {
      if (!this.canAccessModule('honorarios')) {
        throw new Error('Política de Segurança (RLS): Apenas Administradores ou Financeiro podem registrar pagamentos de honorários.');
      }

      const hon = this.data.honorarios.find(h => h.id === honorarioId);
      if (!hon) throw new Error('Registro de honorário não encontrado.');

      const valorNum = Number(valorPago);
      if (!valorNum || valorNum <= 0) {
        throw new Error('Informe um valor de pagamento maior que zero.');
      }

      const novoPag = {
        id: 'pag-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
        honorario_id: honorarioId,
        empresa_id: hon.empresa_id,
        data_pagamento: dataPagamento || new Date().toISOString().slice(0, 10),
        valor: Number(valorNum.toFixed(2)),
        forma_pagamento: formaPagamento || 'PIX',
        conta_destino: contaDestino || 'Conta PJ Principal (Itaú)',
        observacao: observacao || '',
        registrado_por: this.getCurrentUser().nome
      };

      this.data.honorario_pagamentos.push(novoPag);
      const atualizado = this.recalcularHonorario(honorarioId);
      const emp = this.data.empresas.find(e => e.id === hon.empresa_id);

      this.registrarLog(
        'PAGAMENTO_HONORARIO',
        'Honorários',
        `Recebido R$ ${novoPag.valor.toFixed(2)} (${novoPag.forma_pagamento} → ${novoPag.conta_destino}) de ${emp ? emp.nome_fantasia : 'Cliente'} ref. ${hon.competencia}. Saldo restante em aberto: R$ ${atualizado.saldo_aberto.toFixed(2)}.`
      );
      return atualizado;
    }

    excluirPagamentoHonorario(pagamentoId) {
      if (!this.canAccessModule('honorarios')) {
        throw new Error('Acesso não autorizado para estorno de pagamento de honorários.');
      }
      const pag = this.data.honorario_pagamentos.find(p => p.id === pagamentoId);
      if (!pag) return null;
      const honorarioId = pag.honorario_id;
      this.data.honorario_pagamentos = this.data.honorario_pagamentos.filter(p => p.id !== pagamentoId);
      const atualizado = this.recalcularHonorario(honorarioId);
      this.registrarLog('ESTORNO_PAGAMENTO_HONORARIO', 'Honorários', `Estornado lançamento de R$ ${pag.valor.toFixed(2)}. Novo saldo em aberto: R$ ${atualizado.saldo_aberto.toFixed(2)}.`);
      return atualizado;
    }

    // =========================================================================
    // GESTÃO DE USUÁRIOS E MODELOS RECORRENTES (COM REGIME, PRÓ-LABORE E FUNCIONÁRIOS)
    // =========================================================================
    salvarUsuario(dadosUsuario) {
      if (!this.isAdmin()) {
        throw new Error('Política de Segurança (RLS): Apenas Administradores podem gerenciar usuários e permissões.');
      }
      if (dadosUsuario.id) {
        const idx = this.data.profiles.findIndex(p => p.id === dadosUsuario.id);
        if (idx !== -1) {
          this.data.profiles[idx] = { ...this.data.profiles[idx], ...dadosUsuario };
          this.saveLocalData();
          this.registrarLog('EDICAO_USUARIO', 'Segurança', `Perfil atualizado: ${dadosUsuario.nome} (${dadosUsuario.cargo} - ${dadosUsuario.departamento}).`);
          return this.data.profiles[idx];
        }
      }

      const novo = {
        id: 'usr-' + Date.now(),
        nome: dadosUsuario.nome,
        email: dadosUsuario.email,
        cargo: dadosUsuario.cargo || 'COLABORADOR',
        departamento: dadosUsuario.cargo === 'ADMIN' ? 'TODOS' : (dadosUsuario.departamento || 'FISCAL'),
        ativo: dadosUsuario.ativo !== false,
        created_at: new Date().toISOString()
      };
      this.data.profiles.push(novo);
      this.saveLocalData();
      this.registrarLog('NOVO_USUARIO', 'Segurança', `Novo usuário cadastrado: ${novo.nome} (${novo.cargo} - Setor: ${novo.departamento}).`);
      return novo;
    }

    // =========================================================================
    // SISTEMA DE CONVITES, ATIVAÇÃO E CONTROLE DE PERMISSÕES GRANULARES
    // =========================================================================
    getConvites() {
      this.data.convites = Array.isArray(this.data.convites) ? this.data.convites : [];
      return this.data.convites;
    }

    gerarConvite(dados) {
      if (!this.isAdmin()) {
        throw new Error('Política de Segurança (RLS): Apenas o Administrador pode gerar convites de acesso.');
      }
      if (!dados.nome || !dados.email) {
        throw new Error('Nome e E-mail são obrigatórios para emitir o convite.');
      }
      if (dados.tipo === 'CLIENTE' && !dados.empresa_id) {
        throw new Error('Para convite de Cliente, é obrigatório selecionar a Empresa vinculada.');
      }

      this.data.convites = Array.isArray(this.data.convites) ? this.data.convites : [];
      const user = this.getCurrentUser();
      const rawToken = gerarTokenCriptografico(dados.tipo === 'CLIENTE' ? 'tk_cli_' : 'tk_colab_');
      const tokenHash = sha256(rawToken);

      const convite = {
        id: 'conv-' + Date.now(),
        token_hash: tokenHash,
        tipo: dados.tipo || 'COLABORADOR', // 'COLABORADOR' | 'CLIENTE'
        nome: dados.nome.trim(),
        email: dados.email.trim().toLowerCase(),
        cargo: dados.tipo === 'CLIENTE' ? 'CLIENTE' : (dados.cargo || 'COLABORADOR'),
        departamento: dados.tipo === 'CLIENTE' ? 'CLIENTE' : (dados.departamento || 'FISCAL'),
        empresa_id: dados.tipo === 'CLIENTE' ? dados.empresa_id : null,
        permissoes: dados.permissoes || (dados.tipo === 'CLIENTE' ? {
          central_cliente: true,
          guias: true,
          cnds: true,
          parcelamentos: true,
          documentos: true
        } : {
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
        }),
        status: 'PENDENTE',
        criado_por: user ? user.nome : 'Administrador',
        criado_em: new Date().toISOString(),
        expira_em: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      this.data.convites.unshift(convite);
      this.saveLocalData();
      this.registrarLog('CRIACAO_CONVITE', 'Segurança', `Convite gerado para ${convite.nome} (${convite.tipo} - ${convite.email}).`);
      convite.token = rawToken;
      return convite;
    }

    revogarConvite(conviteId) {
      if (!this.isAdmin()) {
        throw new Error('Apenas o Administrador pode revogar convites.');
      }
      this.data.convites = Array.isArray(this.data.convites) ? this.data.convites : [];
      const conv = this.data.convites.find(c => c.id === conviteId);
      if (conv) {
        conv.status = 'REVOGADO';
        this.saveLocalData();
        this.registrarLog('REVOGACAO_CONVITE', 'Segurança', `Convite revogado: ${conv.nome} (${conv.email}).`);
      }
      return conv;
    }

    buscarConvitePorToken(token) {
      if (!token || typeof token !== 'string' || !token.trim()) return null;
      this.data.convites = Array.isArray(this.data.convites) ? this.data.convites : [];
      const clean = token.trim();
      const tokenHash = sha256(clean);
      return this.data.convites.find(c => (c.token && c.token === clean) || (c.token_hash && c.token_hash === tokenHash)) || null;
    }

    aceitarConvite(token, dadosAtivacao = {}) {
      if (!token || typeof token !== 'string' || !token.trim()) {
        throw new Error('Token de convite obrigatório.');
      }
      this.data.convites = Array.isArray(this.data.convites) ? this.data.convites : [];
      const cleanToken = token.trim();
      const tokenHash = sha256(cleanToken);
      const conv = this.data.convites.find(c => (c.token && c.token === cleanToken) || (c.token_hash && c.token_hash === tokenHash));
      if (!conv) {
        throw new Error('Convite não encontrado ou token inválido.');
      }
      if (conv.expira_em) {
        const expTime = new Date(conv.expira_em).getTime();
        if (!isNaN(expTime) && expTime < Date.now()) {
          throw new Error('Este convite expirou. Solicite um novo link à Administração.');
        }
      }
      if (conv.status !== 'PENDENTE') {
        throw new Error(`Este convite já foi ${conv.status.toLowerCase()}.`);
      }

      const senhaInformada = dadosAtivacao.senha ? String(dadosAtivacao.senha).trim() : '';
      if (!senhaInformada || senhaInformada.length < 6) {
        throw new Error('Por favor, defina uma senha de acesso com no mínimo 6 caracteres.');
      }

      const nomeFinal = (dadosAtivacao.nome || conv.nome || '').trim();
      if (!nomeFinal) {
        throw new Error('Por favor, informe seu nome completo para a ativação.');
      }

      const salt = gerarSalt();
      const hash = hashSenha(senhaInformada, salt);

      // Cria ou ativa o perfil do usuário
      const novoUsuario = {
        id: 'usr-' + (conv.tipo === 'CLIENTE' ? 'cli-' : 'colab-') + Date.now(),
        nome: nomeFinal,
        email: conv.email,
        senha_salt: salt,
        senha_hash: hash,
        cargo: conv.cargo,
        departamento: conv.departamento,
        empresa_id: conv.empresa_id || null,
        permissoes: conv.permissoes,
        ativo: true,
        convite_id: conv.id,
        created_at: new Date().toISOString()
      };

      // Se já existia um perfil pré-carregado com este e-mail, atualiza com a senha definitiva
      const idxExistente = this.data.profiles.findIndex(p => p.email && p.email.toLowerCase() === conv.email.toLowerCase());
      if (idxExistente !== -1) {
        this.data.profiles[idxExistente] = {
          ...this.data.profiles[idxExistente],
          nome: novoUsuario.nome,
          senha_salt: salt,
          senha_hash: hash,
          cargo: novoUsuario.cargo,
          departamento: novoUsuario.departamento,
          empresa_id: novoUsuario.empresa_id,
          permissoes: novoUsuario.permissoes,
          ativo: true
        };
        delete this.data.profiles[idxExistente].senha;
      } else {
        this.data.profiles.push(novoUsuario);
      }

      conv.status = 'ACEITO';
      conv.aceito_em = new Date().toISOString();
      this.saveLocalData();
      this.registrarLog('ATIVACAO_CONVITE', 'Segurança', `Conta ativada via convite: ${novoUsuario.nome} (${novoUsuario.cargo}). Senha cadastrada com sucesso.`);
      return novoUsuario;
    }

    atualizarPermissoesUsuario(userId, novasPermissoes, novoCargo, novoDept, empresaId) {
      if (!this.isAdmin()) {
        throw new Error('Apenas Administradores podem editar permissões de usuários.');
      }
      const prof = this.data.profiles.find(p => p.id === userId);
      if (!prof) {
        throw new Error('Usuário não encontrado.');
      }
      if (novoCargo) prof.cargo = novoCargo;
      if (novoDept) prof.departamento = novoDept;
      if (empresaId !== undefined) prof.empresa_id = empresaId;
      if (novasPermissoes) {
        prof.permissoes = { ...(prof.permissoes || {}), ...novasPermissoes };
      }
      this.saveLocalData();
      this.registrarLog('PERMISSOES_ALTERADAS', 'Segurança', `Permissões de ${prof.nome} atualizadas pelo Administrador.`);
      return prof;
    }

    toggleStatusUsuario(userId) {
      if (!this.isAdmin()) {
        throw new Error('Apenas Administradores podem ativar ou desativar usuários.');
      }
      const prof = this.data.profiles.find(p => p.id === userId);
      if (!prof) throw new Error('Usuário não encontrado.');
      if (prof.id === this.getCurrentUser().id) {
        throw new Error('Você não pode desativar o seu próprio usuário logado.');
      }
      prof.ativo = !prof.ativo;
      this.saveLocalData();
      this.registrarLog('STATUS_USUARIO', 'Segurança', `Usuário ${prof.nome} ${prof.ativo ? 'ATIVADO' : 'DESATIVADO'}.`);
      return prof;
    }

    getModelosTarefas() {
      if (!Array.isArray(this.data.modelos_tarefas) || this.data.modelos_tarefas.length === 0) {
        this.data.modelos_tarefas = JSON.parse(JSON.stringify(window.ZGESTOR_MODELS.modelosTarefasMensais));
        this.saveLocalData();
      }
      return this.data.modelos_tarefas;
    }

    salvarModeloTarefa(dadosMod) {
      const lista = this.getModelosTarefas();
      const requerProLabore = Boolean(dadosMod.requer_pro_labore);
      const requerFunc = Boolean(dadosMod.requer_funcionarios !== undefined ? dadosMod.requer_funcionarios : dadosMod.exige_funcionarios);

      if (dadosMod.id) {
        const idx = lista.findIndex(m => m.id === dadosMod.id);
        if (idx !== -1) {
          lista[idx] = {
            ...lista[idx],
            titulo: dadosMod.titulo,
            descricao: dadosMod.descricao || '',
            departamento: dadosMod.departamento || 'FISCAL',
            regimes_aplicaveis: Array.isArray(dadosMod.regimes_aplicaveis) && dadosMod.regimes_aplicaveis.length > 0
              ? dadosMod.regimes_aplicaveis
              : ['Simples Nacional'],
            dia_prazo_padrao: Number(dadosMod.dia_prazo_padrao || 15),
            requer_pro_labore: requerProLabore,
            requer_funcionarios: requerFunc
          };
          this.saveLocalData();
          this.registrarLog('EDICAO_MODELO_TAREFA', 'Tarefas', `Modelo recorrente "${dadosMod.titulo}" atualizado (Regimes: ${lista[idx].regimes_aplicaveis.join(', ')}).`);
          return lista[idx];
        }
      }

      const novo = {
        id: 'mod-' + Date.now(),
        titulo: dadosMod.titulo,
        descricao: dadosMod.descricao || '',
        departamento: dadosMod.departamento || 'FISCAL',
        regimes_aplicaveis: Array.isArray(dadosMod.regimes_aplicaveis) && dadosMod.regimes_aplicaveis.length > 0
          ? dadosMod.regimes_aplicaveis
          : ['Simples Nacional'],
        dia_prazo_padrao: Number(dadosMod.dia_prazo_padrao || 15),
        requer_pro_labore: requerProLabore,
        requer_funcionarios: requerFunc,
        ativo: dadosMod.ativo !== false
      };
      lista.push(novo);
      this.saveLocalData();
      this.registrarLog('NOVO_MODELO_TAREFA', 'Tarefas', `Novo modelo recorrente "${novo.titulo}" adicionado para: ${novo.regimes_aplicaveis.join(', ')}.`);
      return novo;
    }

    excluirModeloTarefa(modId) {
      this.data.modelos_tarefas = this.getModelosTarefas().filter(m => m.id !== modId);
      this.saveLocalData();
    }
  }

  window.zgestorDB = new ZGestorDB();
})();
