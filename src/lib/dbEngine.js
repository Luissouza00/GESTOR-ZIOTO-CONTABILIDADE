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
      this._initialCloudSyncDone = false;
      this.supabaseConfig = this.loadSupabaseConfig();
      this.data = this.loadLocalData();
      this.initSupabaseClient();
      if (!this.supabaseConnected) {
        this._initialCloudSyncDone = true;
      }
      // Remove qualquer resquício de sessão antiga em localStorage para garantir que a rota inicial seja a tela de login
      try { localStorage.removeItem(SESSION_USER_KEY); } catch (_) {}
    }

    limparCodigoInterno(cod) {
      return String(cod === null || cod === undefined ? '' : cod).replace(/^#+/, '').trim();
    }

    _obterMapaEmpresas() {
      const lista = Array.isArray(this.data?.empresas) ? this.data.empresas : [];
      if (this._cacheEmpListaRef === lista && this._cacheEmpLen === lista.length && this._cacheEmpPorId) {
        return { porId: this._cacheEmpPorId, porCnpj: this._cacheEmpPorCnpj };
      }
      const porId = new Map();
      const porCnpj = new Map();
      for (let i = 0; i < lista.length; i++) {
        const e = lista[i];
        if (!e) continue;
        if (e.id) porId.set(e.id, e);
        const doc = String(e.cnpj || '').replace(/\D/g, '');
        if (doc.length === 14 && !porCnpj.has(doc)) porCnpj.set(doc, e);
      }
      this._cacheEmpListaRef = lista;
      this._cacheEmpLen = lista.length;
      this._cacheEmpPorId = porId;
      this._cacheEmpPorCnpj = porCnpj;
      return { porId, porCnpj };
    }

    obterEmpresaSegura(empresaIdOuObj, registroFallback = null) {
      if (!empresaIdOuObj && !registroFallback) return null;
      if (typeof empresaIdOuObj === 'object' && empresaIdOuObj !== null) return empresaIdOuObj;
      const { porId, porCnpj } = this._obterMapaEmpresas();
      if (empresaIdOuObj) {
        const encontrada = porId.get(empresaIdOuObj);
        if (encontrada) return encontrada;
      }
      if (registroFallback) {
        const docCand = String(registroFallback.cnpj || registroFallback.documento || '').replace(/\D/g, '');
        if (docCand.length === 14) {
          const encontradaCnpj = porCnpj.get(docCand);
          if (encontradaCnpj) return encontradaCnpj;
        }
      }
      return null;
    }

    nomeEmpresaPrioritario(empresaOuId, opcoes = {}) {
      const emp = this.obterEmpresaSegura(empresaOuId, opcoes.fallbackObj || null);
      if (emp) {
        const cod = this.limparCodigoInterno(emp.codigo_interno);
        const nomeBase = String(emp.razao_social || emp.nome_fantasia || emp.cnpj || '').trim();
        if (opcoes.comCodigo && cod) {
          return `${cod} — ${nomeBase}`;
        }
        return nomeBase || 'Cadastro sem razão social';
      }
      const fb = opcoes.fallbackObj || {};
      if (fb.cliente_avulso && fb.nome_cliente) return String(fb.nome_cliente).trim();
      const cand = String(opcoes.fallbackNome || fb.razao_social || fb.empresa_razao_social || fb.empresa_nome || fb.nome_cliente || '').trim();
      if (cand && cand.toLowerCase() !== 'empresa') return cand;
      return opcoes.vazioLabel || 'Cadastro não localizado';
    }

    _normalizarDadosCarregados(target) {
      if (!target || typeof target !== 'object') return false;
      let mudou = false;

      if (Array.isArray(target.empresas)) {
        target.empresas.forEach(emp => {
          if (!emp) return;
          const codLimpo = this.limparCodigoInterno(emp.codigo_interno);
          if (emp.codigo_interno !== codLimpo) {
            emp.codigo_interno = codLimpo;
            mudou = true;
          }
          if (!emp.razao_social && emp.nome_fantasia) {
            emp.razao_social = emp.nome_fantasia;
            mudou = true;
          }
          if (!emp.nome_fantasia && emp.razao_social) {
            emp.nome_fantasia = emp.razao_social;
          }
          const cid = String(emp.cidade || emp.municipio || '').trim();
          const uf = String(emp.uf || '').trim().toUpperCase().slice(0, 2);
          if ((!emp.municipio_uf || emp.municipio_uf === 'Belo Horizonte/MG') && (cid || uf)) {
            const novoMun = (cid && uf) ? `${cid.toUpperCase()}/${uf}` : (cid.toUpperCase() || uf);
            if (emp.municipio_uf !== novoMun) {
              emp.municipio_uf = novoMun;
              mudou = true;
            }
          }
          if (emp.validade_certificado === '2027-08-15' && String(emp.id || '').startsWith('emp-imp-')) {
            emp.validade_certificado = '';
            mudou = true;
          }
          if (emp.possui_pro_labore === undefined) {
            emp.possui_pro_labore = emp.possui_prolabore !== undefined ? Boolean(emp.possui_prolabore) : (emp.regime_tributario !== 'MEI');
          }
        });
      }

      // Migração automática: protocolos enviados por WhatsApp ou E-mail ficam arquivados automaticamente
      if (Array.isArray(target.guias_impostos)) {
        target.guias_impostos.forEach(g => {
          if (!g) return;
          if (g.status_envio === 'ENVIADA_WHATSAPP' || g.status_envio === 'ENVIADA_EMAIL') {
            if (!g.canal_envio) {
              g.canal_envio = g.status_envio === 'ENVIADA_EMAIL' ? 'E-mail' : 'WhatsApp';
            }
            g.status_envio = 'ARQUIVADA_ASSINADA';
            g.arquivada_digital = true;
            if (!g.data_arquivamento) {
              g.data_arquivamento = g.data_envio || new Date().toISOString().slice(0, 10);
            }
            mudou = true;
          } else if (g.status_envio === 'ARQUIVADA_ASSINADA' && ['WhatsApp', 'E-mail'].includes(g.canal_envio) && !g.arquivada_digital) {
            g.arquivada_digital = true;
          }
        });
      }

      // Migração fiscal Lucro Presumido / Real:
      // 1) IRPJ/CSLL passa a ser TRIMESTRAL (Mar/Jun/Set/Dez)
      // 2) Apuração ICMS de Lucro Presumido/Real (dia 08) antecipa prazo se cair em fim de semana/feriado
      if (Array.isArray(target.modelos_tarefas) && target.modelos_tarefas.length > 0) {
        const jaMigrouModelos = Boolean(target.escritorio && target.escritorio._regras_presumido_v1);
        if (!jaMigrouModelos) {
          target.modelos_tarefas.forEach(m => {
            if (!m) return;
            const tit = String(m.titulo || '').toLowerCase();
            const ehPresumidoReal = Array.isArray(m.regimes_aplicaveis) && (m.regimes_aplicaveis.includes('Lucro Presumido') || m.regimes_aplicaveis.includes('Lucro Real'));
            if (m.id === 'mod-fis-pr-irpj' || (ehPresumidoReal && (tit.includes('irpj') || tit.includes('csll')))) {
              if (m.periodicidade !== 'TRIMESTRAL') {
                m.periodicidade = 'TRIMESTRAL';
                mudou = true;
              }
              m.antecipar_dia_util = true;
            }
            if (ehPresumidoReal && tit.includes('icms') && !tit.startsWith('transmissão efd') && !tit.startsWith('transmissao efd')) {
              m.antecipar_dia_util = true;
              if (!m.dia_prazo_padrao || m.dia_prazo_padrao === 15) {
                m.dia_prazo_padrao = 8;
                mudou = true;
              }
            }
            if (ehPresumidoReal && (tit.includes('pis') || tit.includes('cofins')) && !tit.startsWith('transmissão efd') && !tit.startsWith('transmissao efd')) {
              m.antecipar_dia_util = true;
            }
          });

          if (Array.isArray(target.tarefas)) {
            const empMap = new Map((target.empresas || []).map(e => [e.id, e]));
            const antesLen = target.tarefas.length;
            target.tarefas = target.tarefas.filter(t => {
              if (!t) return false;
              const tit = String(t.titulo || '').toLowerCase();
              const compMes = String(t.competencia || '').split('/')[0];
              // Remove tarefas mensais automáticas não iniciadas de IRPJ/CSLL fora dos meses de fechamento trimestral (03, 06, 09, 12)
              if ((tit.includes('irpj') || tit.includes('csll')) && !['03', '06', '09', '12'].includes(compMes) && t.status === 'NAO_INICIADA' && !t.data_entrega) {
                return false;
              }
              return true;
            });
            if (target.tarefas.length !== antesLen) mudou = true;

            target.tarefas.forEach(t => {
              if (!t || t.data_entrega || !t.prazo_entrega) return;
              const emp = empMap.get(t.empresa_id);
              const tit = String(t.titulo || '').toLowerCase();
              if (emp && ['Lucro Presumido', 'Lucro Real'].includes(emp.regime_tributario) && tit.includes('icms') && !tit.startsWith('transmissão efd') && !tit.startsWith('transmissao efd')) {
                const novoPrazo = this.anteciparParaDiaUtil(t.prazo_entrega, false);
                if (novoPrazo && novoPrazo !== t.prazo_entrega) {
                  t.prazo_entrega = novoPrazo;
                  mudou = true;
                }
              }
            });
          }

          if (!target.escritorio) target.escritorio = {};
          target.escritorio._regras_presumido_v1 = true;
          mudou = true;
        }

        // Inclusão automática da rotina mensal de ISS Municipal para todas as empresas Lucro Presumido e Lucro Real
        const jaMigrouIss = Boolean(target.escritorio && target.escritorio._migracao_iss_presumido_v1);
        if (!jaMigrouIss) {
          const temModeloIss = target.modelos_tarefas.some(m => m && /\biss\b|\bissqn\b/i.test(String(m.titulo || '')));
          const modeloIssPadrao = {
            id: 'mod-fis-pr-iss',
            titulo: 'Apuração ISS Municipal (Próprio / Retido)',
            descricao: 'Apurar ISS Próprio (serviços prestados) e/ou ISS Retido (serviços tomados) conforme vencimento do município (Dia 10 ou Dia 20, antecipando se não útil) e gerar no Protocolo.',
            departamento: 'FISCAL',
            periodicidade: 'MENSAL',
            mes_entrega: null,
            regimes_aplicaveis: ['Lucro Presumido', 'Lucro Real'],
            dia_prazo_padrao: 10,
            antecipar_dia_util: true,
            requer_pro_labore: false,
            requer_funcionarios: false,
            requer_ie: false,
            ativo: true
          };
          if (!temModeloIss) {
            target.modelos_tarefas.push(modeloIssPadrao);
            mudou = true;
          }

          // Se já existem competências geradas em tarefas (ex.: 10/2026), cria já a tarefa de ISS para as empresas Presumido/Real ativas
          if (Array.isArray(target.tarefas) && target.tarefas.length > 0 && Array.isArray(target.empresas)) {
            const compsExistentes = Array.from(new Set(target.tarefas.map(t => t && t.competencia).filter(Boolean)));
            const empsPR = target.empresas.filter(e => e && (e.status === 'ATIVA' || e.status === 'EM_ONBOARDING') && ['Lucro Presumido', 'Lucro Real'].includes(e.regime_tributario));
            const mapaMunIss = (target.escritorio && target.escritorio.vencimento_iss_por_municipio) || {};
            let seqIss = 0;

            compsExistentes.forEach(comp => {
              empsPR.forEach(emp => {
                const jaTemIss = target.tarefas.some(
                  t => t && t.empresa_id === emp.id && t.competencia === comp && /\biss\b|\bissqn\b/i.test(String(t.titulo || ''))
                );
                if (!jaTemIss) {
                  const diaBase = Number(emp.dia_vencimento_iss || (emp.municipio_uf && mapaMunIss[emp.municipio_uf]) || 10);
                  const prazoIss = this.calcularDataMesSubsequenteUtil(comp, diaBase, true);
                  target.tarefas.push({
                    id: `tar-iss-${Date.now()}-${seqIss++}-${Math.random().toString(36).slice(2, 5)}`,
                    empresa_id: emp.id,
                    competencia: comp,
                    departamento: 'FISCAL',
                    tipo: 'MENSAL',
                    titulo: modeloIssPadrao.titulo,
                    descricao: modeloIssPadrao.descricao,
                    solicitante: 'Rotina Mensal Automática',
                    prazo_entrega: prazoIss,
                    data_entrega: null,
                    modalidade_entrega: null,
                    status: 'NAO_INICIADA',
                    responsavel_nome: 'Luis Filipe (Zioto Contabilidade)',
                    protocolo_observacao: ''
                  });
                  mudou = true;
                }
              });
            });
          }

          if (!target.escritorio) target.escritorio = {};
          target.escritorio._migracao_iss_presumido_v1 = true;
          mudou = true;
        }
      }

      return mudou;
    }

    reconciliarCarteiraOficial(target = this.data) {
      if (!target || typeof window === 'undefined' || !Array.isArray(window.ZGESTOR_CARTEIRA_OFICIAL) || window.ZGESTOR_CARTEIRA_OFICIAL.length === 0) {
        return false;
      }
      // Isola ambiente de testes automatizados (@example.test)
      if (Array.isArray(target.profiles) && target.profiles.some(p => String(p.email || '').endsWith('@example.test'))) {
        return false;
      }
      if (!Array.isArray(target.empresas)) target.empresas = [];

      const excluidosManual = new Set(
        ((target.escritorio && Array.isArray(target.escritorio.cnpjs_excluidos_manual)) ? target.escritorio.cnpjs_excluidos_manual : [])
          .map(x => String(x || '').replace(/\D/g, ''))
          .filter(Boolean)
      );

      let alterou = false;
      const colecoesComVinculo = [
        'onboarding_itens', 'tarefas', 'guias_impostos', 'parcelamentos', 'parcelamento_guias',
        'cnds', 'alvaras', 'portal_arquivos', 'central_cliente_registros', 'honorarios',
        'encerramentos_exercicio', 'convites', 'profiles'
      ];

      const relinkId = (oldId, newId) => {
        if (!oldId || !newId || oldId === newId) return;
        colecoesComVinculo.forEach(col => {
          if (!Array.isArray(target[col])) return;
          target[col].forEach(item => {
            if (item && item.empresa_id === oldId) {
              item.empresa_id = newId;
              alterou = true;
            }
          });
        });
        if (Array.isArray(target.protocolos_guias)) {
          target.protocolos_guias.forEach(prot => {
            (prot.itens || []).forEach(it => {
              if (it && it.empresa_id === oldId) {
                it.empresa_id = newId;
                alterou = true;
              }
            });
          });
        }
      };

      // Coleta todos os empresa_id órfãos atualmente referenciados em tarefas, guias, honorários, etc.
      const idsReferenciados = new Set();
      colecoesComVinculo.forEach(col => {
        if (!Array.isArray(target[col])) return;
        target[col].forEach(it => {
          if (it && it.empresa_id) idsReferenciados.add(it.empresa_id);
        });
      });

      const oficiaisGeraisIds = new Set(
        window.ZGESTOR_CARTEIRA_OFICIAL
          .filter(o => !String(o.id || '').startsWith('emp-imp-mei-'))
          .map(o => o.id)
      );
      const oficiaisMei = window.ZGESTOR_CARTEIRA_OFICIAL.filter(o => String(o.id || '').startsWith('emp-imp-mei-'));

      // 1. Reconcilia toda a carteira oficial (128 Gerais com ID exato do backup + 42 MEIs)
      window.ZGESTOR_CARTEIRA_OFICIAL.forEach(oficial => {
        const cnpjDigits = String(oficial.cnpj || '').replace(/\D/g, '');
        if (!cnpjDigits || excluidosManual.has(cnpjDigits)) return;

        const existente = target.empresas.find(
          e => e.id === oficial.id || String(e.cnpj || '').replace(/\D/g, '') === cnpjDigits
        );

        if (existente) {
          // Se for das 128 empresas gerais e algum registro órfão referencia o ID original do backup, unifica no ID original
          if (oficiaisGeraisIds.has(oficial.id) && existente.id !== oficial.id && idsReferenciados.has(oficial.id)) {
            const oldId = existente.id;
            existente.id = oficial.id;
            relinkId(oldId, oficial.id);
            alterou = true;
          }
          const codAtual = this.limparCodigoInterno(existente.codigo_interno);
          const codOficial = this.limparCodigoInterno(oficial.codigo_interno);
          if (existente.codigo_interno !== codAtual) {
            existente.codigo_interno = codAtual;
            alterou = true;
          }
          if (!existente.codigo_interno && codOficial) {
            existente.codigo_interno = codOficial;
            alterou = true;
          }
          if ((!existente.municipio_uf || existente.municipio_uf === 'Belo Horizonte/MG') && oficial.municipio_uf) {
            existente.municipio_uf = oficial.municipio_uf;
            existente.cidade = existente.cidade || oficial.cidade;
            existente.uf = existente.uf || oficial.uf;
            alterou = true;
          }
          if (oficial.regime_tributario === 'MEI' && existente.regime_tributario === 'Simples Nacional') {
            existente.regime_tributario = 'MEI';
            existente.possui_pro_labore = false;
            existente.possui_prolabore = false;
            alterou = true;
          }
          if (!existente.razao_social && oficial.razao_social) {
            existente.razao_social = oficial.razao_social;
            alterou = true;
          }
        } else {
          target.empresas.push(JSON.parse(JSON.stringify(oficial)));
          alterou = true;
        }
      });

      // 2. Reconcilia eventuais IDs órfãos do lote MEI (padrão emp-imp-<ts>-<indiceMei>-<hash>)
      const idsEmpresasAtuais = new Set(target.empresas.map(e => e.id));
      idsReferenciados.forEach(orphanId => {
        if (idsEmpresasAtuais.has(orphanId)) return;
        const m = /^emp-imp-(\d+)-(\d+)-[a-z0-9]+$/i.exec(String(orphanId));
        if (!m) return;
        const idxMei = parseInt(m[2], 10);
        if (idxMei >= 0 && idxMei < oficiaisMei.length) {
          const meiRef = oficiaisMei[idxMei];
          const cnpjMei = String(meiRef.cnpj || '').replace(/\D/g, '');
          const empMeiAtual = target.empresas.find(e => String(e.cnpj || '').replace(/\D/g, '') === cnpjMei);
          if (empMeiAtual) {
            relinkId(orphanId, empMeiAtual.id);
          }
        }
      });

      // 3. Remove apenas alvarás padrão em branco que eventualmente tenham ficado sem empresa e garante alvarás padrão das 170
      const idsValidosFinal = new Set(target.empresas.map(e => e.id));
      if (Array.isArray(target.alvaras)) {
        const antes = target.alvaras.length;
        target.alvaras = target.alvaras.filter(a => {
          if (idsValidosFinal.has(a.empresa_id)) return true;
          const ehPadraoVazio = !a.numero_documento && !a.anexo_nome && !a.protocolo_renovacao;
          return !ehPadraoVazio;
        });
        if (target.alvaras.length !== antes) alterou = true;
      }

      if (alterou) {
        this.garantirAlvarasPadrao(target);
      }
      return alterou;
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
            // Saneamento de usuários: remove usuários fictícios antigos e mantém apenas usuários reais validados
            parsed.profiles = (parsed.profiles || []).filter(p => {
              const em = (p.email || '').toLowerCase().trim();
              if (em === 'ziotocont.luisf@gmail.com') return true;
              if (em.endsWith('@example.test')) return true; // para testes automatizados locais
              if (em.endsWith('@zgestorcontabil.com.br') || ['usr-admin-1', 'usr-fiscal-1', 'usr-dp-1', 'usr-contabil-1', 'usr-fin-1', 'usr-soc-1', 'usr-cli-1'].includes(p.id)) return false;
              if (['contador@zgestorcontabil.com.br', 'fiscal@zgestorcontabil.com.br', 'dp@zgestorcontabil.com.br', 'contabil@zgestorcontabil.com.br', 'financeiro@zgestorcontabil.com.br', 'societario@zgestorcontabil.com.br'].includes(em)) return false;
              return true;
            });
            if (!parsed.profiles.some(p => (p.email || '').toLowerCase() === 'ziotocont.luisf@gmail.com')) {
              parsed.profiles.unshift({
                id: 'usr-admin-luis',
                nome: 'Luis Filipe (Zioto Contabilidade)',
                email: 'ziotocont.luisf@gmail.com',
                cargo: 'ADMIN',
                departamento: 'TODOS',
                ativo: true,
                permissoes: { dashboard: true, tarefas: true, guias: true, parcelamentos: true, cnds: true, alvaras: true, central_cliente: true, empresas: true, onboarding: true, honorarios: true, seguranca: true },
                created_at: '2026-01-10T09:00:00Z'
              });
            }
            if (!Array.isArray(parsed.alvaras)) {
              parsed.alvaras = [];
            }
            if (!Array.isArray(parsed.protocolos_guias)) {
              parsed.protocolos_guias = [];
            }
            if (!parsed._guias_v2_cleaned) {
              parsed.guias_impostos = (parsed.guias_impostos || []).filter(g => {
                const ehAntigaAuto = (g.id || '').startsWith('gimp-gen-');
                const pendente = !['IMPRESSA_OFFICE_BOY', 'ENVIADA_WHATSAPP', 'ENVIADA_EMAIL', 'ARQUIVADA_ASSINADA', 'ENVIADA_CLIENTE', 'VISUALIZADA_CLIENTE'].includes(g.status_envio);
                return !(ehAntigaAuto && pendente && !g.protocolo_id);
              });
              parsed._guias_v2_cleaned = true;
            }
            // Saneamento de empresas fictícias de demonstração antigas (emp-1, emp-2, emp-3, emp-4)
            const demoEmpIds = ['emp-1', 'emp-2', 'emp-3', 'emp-4'];
            const tinhaDemoEmp = (parsed.empresas || []).some(e => demoEmpIds.includes(e.id));
            if (tinhaDemoEmp) {
              parsed.empresas = (parsed.empresas || []).filter(e => !demoEmpIds.includes(e.id));
              const keepNonDemo = (arr) => (arr || []).filter(item => !demoEmpIds.includes(item.empresa_id));
              parsed.onboarding_itens = keepNonDemo(parsed.onboarding_itens);
              parsed.tarefas = keepNonDemo(parsed.tarefas);
              parsed.guias_impostos = keepNonDemo(parsed.guias_impostos);
              parsed.parcelamentos = keepNonDemo(parsed.parcelamentos);
              parsed.parcelamento_guias = keepNonDemo(parsed.parcelamento_guias);
              parsed.alvaras = keepNonDemo(parsed.alvaras);
              parsed.cnds = keepNonDemo(parsed.cnds);
              parsed.portal_arquivos = keepNonDemo(parsed.portal_arquivos);
              parsed.central_cliente_registros = keepNonDemo(parsed.central_cliente_registros);
              parsed.honorarios = keepNonDemo(parsed.honorarios);
              parsed.honorario_pagamentos = keepNonDemo(parsed.honorario_pagamentos);
              parsed.convites = (parsed.convites || []).filter(c => !demoEmpIds.includes(c.empresa_id) && c.id !== 'conv-101' && c.id !== 'conv-102');
            }
            const temEmpresasReaisSeed = (parsed.empresas || []).some(e => (e.id || '').startsWith('emp-real-'));
            if (!parsed._limpeza_empresas_v1 && (parsed._importacao_reais_v1 || temEmpresasReaisSeed)) {
              parsed.empresas = [];
              parsed.onboarding_itens = [];
              parsed.tarefas = [];
              parsed.guias_impostos = [];
              parsed.protocolos_guias = [];
              parsed.parcelamentos = [];
              parsed.parcelamento_guias = [];
              parsed.alvaras = [];
              parsed.cnds = [];
              parsed.portal_arquivos = [];
              parsed.central_cliente_registros = [];
              parsed.honorarios = [];
              parsed.honorario_pagamentos = [];
              parsed.encerramentos_exercicio = [];
              parsed.convites = [];
              parsed._limpeza_empresas_v1 = true;
            }
            if (!parsed._rotinas_v2_migrated && window.ZGESTOR_MODELS?.modelosTarefasMensais) {
              parsed.modelos_tarefas = JSON.parse(JSON.stringify(window.ZGESTOR_MODELS.modelosTarefasMensais));
              parsed._rotinas_v2_migrated = true;
            }
            this.garantirAlvarasPadrao(parsed);
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
              if (!emp.municipio_uf || emp.municipio_uf === 'Belo Horizonte/MG') {
                const seed = (window.ZGESTOR_INITIAL_DB?.empresas || []).find(e => e.id === emp.id);
                const cid = String(emp.cidade || emp.municipio || '').trim();
                const uf = String(emp.uf || '').trim().toUpperCase().slice(0, 2);
                emp.municipio_uf = seed?.municipio_uf || ((cid && uf) ? `${cid.toUpperCase()}/${uf}` : (cid.toUpperCase() || uf || ''));
              }
              if (!emp.validade_certificado) {
                const seed = (window.ZGESTOR_INITIAL_DB?.empresas || []).find(e => e.id === emp.id);
                emp.validade_certificado = seed?.validade_certificado || '';
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
            this._normalizarDadosCarregados(parsed);
            if (parsed.empresas.length > 0) {
              this.reconciliarCarteiraOficial(parsed);
            }
            this._migrarCredenciais(parsed);
            this._desacoplarAnexosPesadosParaCofre(parsed, false);
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed)); } catch (_) {}
            return parsed;
          }
        }
      } catch (e) {
        console.warn('Erro ao carregar dados locais, usando seed inicial:', e);
      }
      const initial = JSON.parse(JSON.stringify(window.ZGESTOR_INITIAL_DB));
      this._normalizarDadosCarregados(initial);
      this.garantirAlvarasPadrao(initial);
      this._migrarCredenciais(initial);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(initial)); } catch (_) {}
      return initial;
    }

    // =========================================================================
    // COFRE DIGITAL SEGURO DE DOCUMENTOS PDF/IMAGENS (SUPABASE CLOUD + INDEXEDDB)
    // Evita o limite de 5 MB do localStorage e arquiva com segurança na nuvem
    // =========================================================================
    _garantirMemCofre() {
      if (!this._memCofreArquivos) {
        this._memCofreArquivos = new Map();
      }
      return this._memCofreArquivos;
    }

    _abrirCofreIndexedDB() {
      if (typeof indexedDB === 'undefined' || !indexedDB) {
        return Promise.resolve(null);
      }
      if (this._idbCofrePromise) {
        return this._idbCofrePromise;
      }
      this._idbCofrePromise = new Promise((resolve) => {
        try {
          const req = indexedDB.open('zgestor_cofre_documentos_v1', 1);
          req.onupgradeneeded = (ev) => {
            const dbIdb = ev.target.result;
            if (!dbIdb.objectStoreNames.contains('arquivos')) {
              dbIdb.createObjectStore('arquivos', { keyPath: 'id' });
            }
          };
          req.onsuccess = (ev) => resolve(ev.target.result);
          req.onerror = () => {
            this._idbCofrePromise = null;
            resolve(null);
          };
        } catch (_) {
          this._idbCofrePromise = null;
          resolve(null);
        }
      });
      return this._idbCofrePromise;
    }

    async _salvarNoCofreIndexedDB(cofreId, registroCofre) {
      if (!cofreId || !registroCofre) return false;
      const dbIdb = await this._abrirCofreIndexedDB();
      if (!dbIdb) return false;
      return new Promise((resolve) => {
        try {
          const tx = dbIdb.transaction('arquivos', 'readwrite');
          tx.objectStore('arquivos').put({ ...registroCofre, id: cofreId });
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (_) {
          resolve(false);
        }
      });
    }

    async _lerDoCofreIndexedDB(cofreId) {
      if (!cofreId) return null;
      const dbIdb = await this._abrirCofreIndexedDB();
      if (!dbIdb) return null;
      return new Promise((resolve) => {
        try {
          const tx = dbIdb.transaction('arquivos', 'readonly');
          const req = tx.objectStore('arquivos').get(cofreId);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        } catch (_) {
          resolve(null);
        }
      });
    }

    async _removerDoCofreIndexedDB(cofreId) {
      if (!cofreId) return false;
      this._garantirMemCofre().delete(cofreId);
      const dbIdb = await this._abrirCofreIndexedDB();
      if (!dbIdb) return false;
      return new Promise((resolve) => {
        try {
          const tx = dbIdb.transaction('arquivos', 'readwrite');
          tx.objectStore('arquivos').delete(cofreId);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (_) {
          resolve(false);
        }
      });
    }

    async _salvarNoCofreSupabase(cofreId, payload) {
      if (!cofreId || !payload || !this.supabaseConnected || !this.supabase) {
        return { ok: false };
      }
      try {
        let storageUrl = payload.storage_url || '';
        let storagePath = payload.storage_path || '';

        // Camada 1: Tenta Supabase Storage oficial (bucket zgestor-documentos)
        if (!storageUrl && payload.base64) {
          const resStorage = await this.uploadArquivoParaNuvem(
            payload.nome || 'documento.pdf',
            payload.base64,
            payload.pasta || payload.modulo || 'documentos'
          );
          if (resStorage && resStorage.ok && resStorage.url) {
            storageUrl = resStorage.url;
            storagePath = resStorage.path || '';
          }
        }

        // Camada 2: Persiste registro dedicado no banco PostgreSQL (colecao = 'arquivos_cofre')
        // Garante 100% de arquivamento em nuvem mesmo se o bucket de Storage não estiver ativo
        const agora = new Date().toISOString();
        const dadosCofre = {
          id: cofreId,
          modulo: payload.modulo || 'GERAL',
          ref_id: payload.ref_id || '',
          empresa_id: payload.empresa_id || '',
          nome: payload.nome || 'documento.pdf',
          tamanho: payload.tamanho || null,
          storage_url: storageUrl,
          storage_path: storagePath,
          base64: payload.base64 || null,
          updated_at: agora
        };

        const { error } = await this.supabase
          .from('zgestor_registros')
          .upsert([{ colecao: 'arquivos_cofre', id: String(cofreId), dados: dadosCofre, updated_at: agora }], { onConflict: 'colecao,id' });

        if (error) {
          return { ok: Boolean(storageUrl), url: storageUrl, path: storagePath, error: error.message };
        }
        return { ok: true, url: storageUrl, path: storagePath };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }

    async removerDocumentoDoCofre(cofreId) {
      if (!cofreId) return;
      await this._removerDoCofreIndexedDB(cofreId);
      if (this.supabaseConnected && this.supabase) {
        try {
          await this.supabase
            .from('zgestor_registros')
            .delete()
            .eq('colecao', 'arquivos_cofre')
            .eq('id', String(cofreId));
        } catch (_) {}
      }
    }

    arquivarDocumentoNoCofre(cofreId, base64DataUrl, metadados = {}) {
      if (!cofreId || !base64DataUrl) return Promise.resolve({ ok: false });
      const payload = {
        id: cofreId,
        base64: base64DataUrl,
        nome: metadados.nome || 'documento.pdf',
        tamanho: metadados.tamanho || base64DataUrl.length,
        modulo: metadados.modulo || 'DOCUMENTOS',
        pasta: metadados.pasta || 'documentos',
        ref_id: metadados.ref_id || '',
        empresa_id: metadados.empresa_id || '',
        updated_at: new Date().toISOString()
      };
      this._garantirMemCofre().set(cofreId, payload);
      const pIdb = this._salvarNoCofreIndexedDB(cofreId, payload).catch(() => false);
      const pCloud = this._salvarNoCofreSupabase(cofreId, payload).catch(() => ({ ok: false }));
      return Promise.all([pIdb, pCloud]).then(([okIdb, resCloud]) => ({
        ok: Boolean(okIdb || (resCloud && resCloud.ok) || this._garantirMemCofre().has(cofreId)),
        okLocal: Boolean(okIdb),
        okNuvem: Boolean(resCloud && resCloud.ok),
        url: (resCloud && resCloud.url) || ''
      }));
    }

    obterDocumentoSincrono(cofreId, inlineBase64 = '') {
      if (inlineBase64 && String(inlineBase64).startsWith('data:')) {
        return inlineBase64;
      }
      if (cofreId && this._memCofreArquivos && this._memCofreArquivos.has(cofreId)) {
        const mem = this._memCofreArquivos.get(cofreId);
        if (mem && mem.base64) return mem.base64;
      }
      return '';
    }

    async obterDocumentoSeguro({ cofreId, inlineBase64 = '', storageUrl = '' } = {}) {
      const sinc = this.obterDocumentoSincrono(cofreId, inlineBase64);
      if (sinc) {
        return { ok: true, base64: sinc, url: storageUrl || '' };
      }

      if (cofreId) {
        const localReg = await this._lerDoCofreIndexedDB(cofreId);
        if (localReg && localReg.base64) {
          this._garantirMemCofre().set(cofreId, localReg);
          return { ok: true, base64: localReg.base64, url: localReg.storage_url || storageUrl || '' };
        }
      }

      if (cofreId && this.supabaseConnected && this.supabase) {
        try {
          const { data, error } = await this.supabase
            .from('zgestor_registros')
            .select('dados')
            .eq('colecao', 'arquivos_cofre')
            .eq('id', String(cofreId))
            .limit(1);
          const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
          if (!error && row && row.dados) {
            if (row.dados.base64) {
              this._garantirMemCofre().set(cofreId, row.dados);
              this._salvarNoCofreIndexedDB(cofreId, row.dados).catch(() => {});
              return { ok: true, base64: row.dados.base64, url: row.dados.storage_url || storageUrl || '' };
            }
            if (row.dados.storage_url) {
              return { ok: true, base64: '', url: row.dados.storage_url };
            }
          }
        } catch (_) {}
      }

      if (storageUrl) {
        return { ok: true, base64: '', url: storageUrl };
      }
      return { ok: false, base64: '', url: '' };
    }

    _desacoplarAnexosPesadosParaCofre(alvoData, forcar = false) {
      if (!alvoData || typeof alvoData !== 'object') return false;
      const temCofrePersistente = Boolean(
        forcar ||
        typeof indexedDB !== 'undefined' ||
        (this.supabaseConnected && this.supabase)
      );
      if (!temCofrePersistente) return false;

      const LIMITE_INLINE_CHARS = forcar ? 512 : 4096;
      let desacoplou = false;

      // 1. Alvarás & Licenças
      if (Array.isArray(alvoData.alvaras)) {
        for (let i = 0; i < alvoData.alvaras.length; i++) {
          const alv = alvoData.alvaras[i];
          if (alv && alv.anexo_base64 && String(alv.anexo_base64).length > LIMITE_INLINE_CHARS) {
            const cid = alv.anexo_cofre_id || `cofre-alvara-${alv.id}`;
            this.arquivarDocumentoNoCofre(cid, alv.anexo_base64, {
              nome: alv.anexo_nome || `Alvara_${alv.tipo || 'doc'}.pdf`,
              tamanho: alv.anexo_tamanho || alv.anexo_base64.length,
              modulo: 'ALVARAS',
              pasta: 'alvaras',
              ref_id: alv.id,
              empresa_id: alv.empresa_id
            });
            alv.anexo_cofre_id = cid;
            alv.tem_anexo = true;
            alv.anexo_base64 = null;
            desacoplou = true;
          }
        }
      }

      // 2. Certidões Negativas (CNDs)
      if (Array.isArray(alvoData.cnds)) {
        for (let i = 0; i < alvoData.cnds.length; i++) {
          const cnd = alvoData.cnds[i];
          if (cnd && cnd.arquivo_pdf_base64 && String(cnd.arquivo_pdf_base64).length > LIMITE_INLINE_CHARS) {
            const cid = cnd.arquivo_cofre_id || `cofre-cnd-${cnd.id}`;
            this.arquivarDocumentoNoCofre(cid, cnd.arquivo_pdf_base64, {
              nome: cnd.arquivo_pdf_nome || 'Certidao_CND.pdf',
              tamanho: cnd.arquivo_pdf_base64.length,
              modulo: 'CNDS',
              pasta: 'cnds',
              ref_id: cnd.id,
              empresa_id: cnd.empresa_id
            });
            cnd.arquivo_cofre_id = cid;
            cnd.tem_arquivo_pdf = true;
            cnd.arquivo_pdf_base64 = '';
            desacoplou = true;
          }
        }
      }

      // 3. Arquivos do Portal do Cliente
      if (Array.isArray(alvoData.portal_arquivos)) {
        for (let i = 0; i < alvoData.portal_arquivos.length; i++) {
          const arq = alvoData.portal_arquivos[i];
          if (arq && arq.conteudo_base64 && String(arq.conteudo_base64).length > LIMITE_INLINE_CHARS) {
            const cid = arq.conteudo_cofre_id || `cofre-portal-${arq.id}`;
            this.arquivarDocumentoNoCofre(cid, arq.conteudo_base64, {
              nome: arq.nome_arquivo || 'documento.pdf',
              tamanho: arq.tamanho || arq.conteudo_base64.length,
              modulo: 'PORTAL_CLIENTE',
              pasta: 'portal',
              ref_id: arq.id,
              empresa_id: arq.empresa_id
            });
            arq.conteudo_cofre_id = cid;
            arq.tem_conteudo = true;
            arq.conteudo_base64 = '';
            desacoplou = true;
          }
        }
      }

      // 4. Anexos de Solicitações da Central do Cliente
      if (Array.isArray(alvoData.central_cliente_registros)) {
        for (let i = 0; i < alvoData.central_cliente_registros.length; i++) {
          const reg = alvoData.central_cliente_registros[i];
          if (reg && reg.anexo_base64 && String(reg.anexo_base64).length > LIMITE_INLINE_CHARS) {
            const cid = reg.anexo_cofre_id || `cofre-chamado-${reg.id}`;
            this.arquivarDocumentoNoCofre(cid, reg.anexo_base64, {
              nome: reg.anexo_nome || 'anexo_chamado.pdf',
              tamanho: reg.anexo_tamanho || reg.anexo_base64.length,
              modulo: 'CHAMADOS_PORTAL',
              pasta: 'chamados',
              ref_id: reg.id,
              empresa_id: reg.empresa_id
            });
            reg.anexo_cofre_id = cid;
            reg.tem_anexo = true;
            reg.anexo_base64 = null;
            desacoplou = true;
          }
        }
      }

      return desacoplou;
    }

    saveLocalData() {
      this._cacheEmpListaRef = null;
      this._migrarCredenciais(this.data);
      // Desacopla automaticamente anexos PDF/imagens pesados para o Cofre Digital (IndexedDB + Supabase Cloud)
      this._desacoplarAnexosPesadosParaCofre(this.data, false);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      } catch (err) {
        // Auto-recuperação caso o localStorage ainda esteja cheio com logs ou anexos residuais
        try {
          this._desacoplarAnexosPesadosParaCofre(this.data, true);
          if (Array.isArray(this.data.audit_logs) && this.data.audit_logs.length > 80) {
            this.data.audit_logs = this.data.audit_logs.slice(0, 80);
          }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        } catch (err2) {
          console.error('Erro ao salvar cache local (dados continuam sincronizados na nuvem/memória):', err2);
          const agoraMs = Date.now();
          if ((!this._ultimoToastQuotaMs || agoraMs - this._ultimoToastQuotaMs > 15000) && typeof window !== 'undefined' && window.ZGestorApp?.showToast) {
            this._ultimoToastQuotaMs = agoraMs;
            window.ZGestorApp.showToast('Cache rápido do navegador otimizado: seus arquivos PDF permanecem salvos no Cofre Digital em Nuvem.', 'info');
          }
        }
      }
      if (!this._suppressCloudSync && this._initialCloudSyncDone && this.supabaseConnected && this.supabase && this.supabaseConfig?.autoSync !== false) {
        this._agendarSyncNuvem();
      }
    }

    restaurarBackupJSON(backupData) {
      if (!this.isAdmin()) throw new Error('Apenas o Administrador Geral pode restaurar backups.');
      if (!backupData || typeof backupData !== 'object' || !Array.isArray(backupData.empresas)) {
        throw new Error('Arquivo de backup inválido: estrutura de empresas não encontrada.');
      }
      const perfisAtuais = Array.isArray(this.data?.profiles) ? this.data.profiles : [];
      const novoBanco = JSON.parse(JSON.stringify(backupData));

      // Preserva credenciais locais dos usuários caso o backup tenha sido exportado sem senhas
      if (Array.isArray(novoBanco.profiles)) {
        novoBanco.profiles = novoBanco.profiles.map(p => {
          const atual = perfisAtuais.find(pa => pa.id === p.id || (pa.email && p.email && pa.email.toLowerCase() === p.email.toLowerCase()));
          if (atual && !p.senha_hash && !p.senha) {
            return { ...p, senha_hash: atual.senha_hash, senha_salt: atual.senha_salt };
          }
          return p;
        });
      } else {
        novoBanco.profiles = JSON.parse(JSON.stringify(perfisAtuais));
      }

      const arraysPadrao = [
        'empresas', 'onboarding_itens', 'tarefas', 'guias_impostos', 'protocolos_guias',
        'parcelamentos', 'parcelamento_guias', 'cnds', 'alvaras', 'portal_arquivos',
        'central_cliente_registros', 'honorarios', 'honorario_pagamentos',
        'encerramentos_exercicio', 'modelos_tarefas', 'convites', 'audit_logs'
      ];
      arraysPadrao.forEach(k => {
        if (!Array.isArray(novoBanco[k])) novoBanco[k] = [];
      });
      if (!novoBanco.escritorio) {
        novoBanco.escritorio = JSON.parse(JSON.stringify(window.ZGESTOR_MODELS?.escritorioPadrao || {}));
      }
      this.garantirAlvarasPadrao(novoBanco);
      this.data = novoBanco;
      this.saveLocalData();
      this.registrarLog('RESTAURACAO_BACKUP', 'Sistema', `Backup JSON restaurado (${novoBanco.empresas.length} empresas).`);
      return { empresas: novoBanco.empresas.length, tarefas: novoBanco.tarefas.length, cnds: novoBanco.cnds.length };
    }

    importarEmpresasEmLote(linhas = [], atualizarExistentes = true, opcoes = {}) {
      if (!this.isAdmin()) throw new Error('Apenas o Administrador Geral pode importar empresas em lote.');
      if (!Array.isArray(this.data.empresas)) this.data.empresas = [];

      const formatarCnpj = (raw) => {
        const d = String(raw || '').replace(/\D/g, '');
        if (d.length === 14) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12,14)}`;
        return String(raw || '').trim();
      };
      const regimeFallback = opcoes.regimePadrao || 'Simples Nacional';
      const normRegime = (r) => {
        const s = String(r || '').trim().toLowerCase();
        if (!s) return regimeFallback;
        if (s.includes('presumido')) return 'Lucro Presumido';
        if (s.includes('real')) return 'Lucro Real';
        if (s.includes('mei')) return 'MEI';
        if (s.includes('imune') || s.includes('isenta')) return 'Imune/Isenta';
        return 'Simples Nacional';
      };

      let inseridas = 0;
      let atualizadas = 0;
      let ignoradas = 0;
      const erros = [];

      let maxCod = this.data.empresas.reduce((m, e) => Math.max(m, parseInt(this.limparCodigoInterno(e.codigo_interno), 10) || 0), 0);

      linhas.forEach((row, idx) => {
        const razao = String(row.razao_social || '').trim();
        const cnpjLimpo = String(row.cnpj || '').replace(/\D/g, '');
        if (!razao || !cnpjLimpo) {
          ignoradas++;
          erros.push(`Linha ${idx + 2}: Razão Social e CNPJ são obrigatórios.`);
          return;
        }
        const cnpjFmt = formatarCnpj(cnpjLimpo);
        const existenteIdx = this.data.empresas.findIndex(e => (e.cnpj || '').replace(/\D/g, '') === cnpjLimpo);

        const codInformado = this.limparCodigoInterno(row.codigo_interno);
        const ieVal = String(row.inscricao_estadual || '').trim();
        const folhaStr = String(row.possui_folha || '').trim().toUpperCase();
        const possuiFolha = folhaStr === 'SIM' || folhaStr === 'S' || folhaStr === 'TRUE' || folhaStr === '1';
        const statusStr = String(row.status || '').trim().toUpperCase();
        const status = statusStr === 'INATIVA' ? 'INATIVA' : 'ATIVA';
        const valHon = Number(String(row.valor_honorario_padrao || '0').replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
        const diaVenc = Math.min(28, Math.max(1, parseInt(row.dia_vencimento_honorario, 10) || 10));
        const regimeFinal = normRegime(row.regime_tributario);
        const cidade = String(row.cidade || '').trim();
        const uf = String(row.uf || '').trim().toUpperCase().slice(0, 2);
        const municipioUf = (cidade && uf) ? `${cidade.toUpperCase()}/${uf}` : (cidade.toUpperCase() || uf || '');
        const temProLabore = regimeFinal !== 'MEI';

        const payload = {
          razao_social: razao,
          nome_fantasia: String(row.nome_fantasia || '').trim() || razao,
          cnpj: cnpjFmt,
          inscricao_estadual: ieVal,
          regime_tributario: regimeFinal,
          possui_pro_labore: temProLabore,
          possui_prolabore: temProLabore,
          possui_funcionarios: possuiFolha,
          responsavel_legal: String(row.responsavel_legal || '').trim(),
          email: String(row.email || '').trim(),
          telefone: String(row.telefone || '').trim(),
          valor_honorario_padrao: valHon,
          dia_vencimento_honorario: diaVenc,
          cidade,
          uf,
          municipio_uf: municipioUf,
          status
        };

        if (existenteIdx !== -1) {
          if (atualizarExistentes) {
            this.data.empresas[existenteIdx] = {
              ...this.data.empresas[existenteIdx],
              ...payload,
              municipio_uf: municipioUf || this.data.empresas[existenteIdx].municipio_uf || '',
              codigo_interno: codInformado || this.limparCodigoInterno(this.data.empresas[existenteIdx].codigo_interno)
            };
            atualizadas++;
          } else {
            ignoradas++;
          }
        } else {
          maxCod++;
          const novoCod = codInformado || String(maxCod).padStart(3, '0');
          this.data.empresas.push({
            id: `emp-imp-${Date.now()}-${inseridas}-${Math.random().toString(36).slice(2, 5)}`,
            codigo_interno: novoCod,
            ...payload,
            created_at: new Date().toISOString()
          });
          inseridas++;
        }
      });

      this.garantirAlvarasPadrao(this.data);
      this.saveLocalData();
      this.registrarLog('IMPORTACAO_EMPRESAS_LOTE', 'Empresas', `Importação Excel: ${inseridas} novas, ${atualizadas} atualizadas, ${ignoradas} ignoradas.`);
      return { inseridas, atualizadas, ignoradas, erros };
    }

    resetToSeedData() {
      const initial = JSON.parse(JSON.stringify(window.ZGESTOR_INITIAL_DB));
      this.garantirAlvarasPadrao(initial);
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

    calcularDataSegundoMesSubsequente(competencia, dia = 20) {
      const sub1 = this.obterMesSubsequente(competencia);
      const compSub1 = `${sub1.mesFormatado}/${sub1.ano}`;
      const sub2 = this.obterMesSubsequente(compSub1);
      const ultimoDiaMes = new Date(sub2.ano, sub2.mes, 0).getDate();
      const diaValido = String(Math.min(Math.max(1, Number(dia || 20)), ultimoDiaMes)).padStart(2, '0');
      return `${sub2.ano}-${sub2.mesFormatado}-${diaValido}`;
    }

    // =========================================================================
    // CALENDÁRIO FISCAL BRASILEIRO (DIAS ÚTEIS, FERIADOS NACIONAIS E QUOTAS)
    // =========================================================================
    _feriadosNacionaisDoAno(ano) {
      if (!this._cacheFeriados) this._cacheFeriados = {};
      if (this._cacheFeriados[ano]) return this._cacheFeriados[ano];

      const set = new Set([
        `${ano}-01-01`, // Confraternização Universal
        `${ano}-04-21`, // Tiradentes
        `${ano}-05-01`, // Dia do Trabalho
        `${ano}-09-07`, // Independência do Brasil
        `${ano}-10-12`, // Nossa Senhora Aparecida
        `${ano}-11-02`, // Finados
        `${ano}-11-15`, // Proclamação da República
        `${ano}-11-20`, // Dia Nacional de Zumbi e da Consciência Negra
        `${ano}-12-25`  // Natal
      ]);

      // Cálculo da Páscoa (Meeus/Jones/Butcher) para feriados móveis
      const a = ano % 19;
      const b = Math.floor(ano / 100);
      const c = ano % 100;
      const d = Math.floor(b / 4);
      const e = b % 4;
      const f = Math.floor((b + 8) / 25);
      const g = Math.floor((b - f + 1) / 3);
      const h = (19 * a + b - d - g + 15) % 30;
      const i = Math.floor(c / 4);
      const k = c % 4;
      const l = (32 + 2 * e + 2 * i - h - k) % 7;
      const m = Math.floor((a + 11 * h + 22 * l) / 451);
      const mesPascoa = Math.floor((h + l - 7 * m + 114) / 31);
      const diaPascoa = ((h + l - 7 * m + 114) % 31) + 1;

      const addDias = (offset) => {
        const dt = new Date(ano, mesPascoa - 1, diaPascoa + offset);
        const yy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const dd = String(dt.getDate()).padStart(2, '0');
        return `${yy}-${mm}-${dd}`;
      };

      set.add(addDias(-48)); // Segunda de Carnaval (expediente bancário suspenso)
      set.add(addDias(-47)); // Terça de Carnaval
      set.add(addDias(-2));  // Sexta-Feira da Paixão
      set.add(addDias(60));  // Corpus Christi

      this._cacheFeriados[ano] = set;
      return set;
    }

    ehDiaUtilBrasil(dateStr, considerarFechamentoBancario31Dez = false) {
      if (!dateStr || typeof dateStr !== 'string') return true;
      const parts = dateStr.slice(0, 10).split('-').map(Number);
      if (parts.length !== 3 || parts.some(isNaN)) return true;
      const [y, m, d] = parts;
      const dt = new Date(y, m - 1, d);
      const dow = dt.getDay();
      if (dow === 0 || dow === 6) return false;
      const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (considerarFechamentoBancario31Dez && m === 12 && d === 31) return false;
      const feriados = this._feriadosNacionaisDoAno(y);
      return !feriados.has(iso);
    }

    anteciparParaDiaUtil(dateStr, considerarFechamentoBancario31Dez = false) {
      if (!dateStr || typeof dateStr !== 'string') return dateStr;
      const parts = dateStr.slice(0, 10).split('-').map(Number);
      if (parts.length !== 3 || parts.some(isNaN)) return dateStr;
      let dt = new Date(parts[0], parts[1] - 1, parts[2]);
      for (let guard = 0; guard < 12; guard++) {
        const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        if (this.ehDiaUtilBrasil(iso, considerarFechamentoBancario31Dez)) {
          return iso;
        }
        dt.setDate(dt.getDate() - 1);
      }
      return dateStr;
    }

    calcularDataMesSubsequenteUtil(competencia, dia = 8, antecipar = true, considerar31Dez = false) {
      const bruta = this.calcularDataMesSubsequente(competencia, dia);
      return antecipar ? this.anteciparParaDiaUtil(bruta, considerar31Dez) : bruta;
    }

    prorrogarParaProximoDiaUtil(dateStr) {
      if (!dateStr || typeof dateStr !== 'string') return dateStr;
      const parts = dateStr.slice(0, 10).split('-').map(Number);
      if (parts.length !== 3 || parts.some(isNaN)) return dateStr;
      let dt = new Date(parts[0], parts[1] - 1, parts[2]);
      for (let guard = 0; guard < 12; guard++) {
        const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        if (this.ehDiaUtilBrasil(iso, false)) {
          return iso;
        }
        dt.setDate(dt.getDate() + 1);
      }
      return dateStr;
    }

    calcularVencimentoHonorarioUtil(competencia, dia = 10) {
      const bruta = this.calcularDataMesSubsequente(competencia, dia);
      return this.prorrogarParaProximoDiaUtil(bruta);
    }

    // =========================================================================
    // PREFERÊNCIA DE ENVIO DO CLIENTE (EXCLUSIVO PARA OPERADORES DO ESCRITÓRIO)
    // Vigência temporal: vale da competência em que foi definida para frente
    // =========================================================================
    ehOperadorInterno() {
      const user = this.getCurrentUser();
      if (!user || user.cargo === 'CLIENTE') return false;
      if (typeof window !== 'undefined' && window.ZGestorApp?.state?.modoSimulacaoCliente) return false;
      return true;
    }

    obterPreferenciaEnvioEmpresa(empresaOuId, competenciaRef = null) {
      if (!this.ehOperadorInterno()) return null;
      const emp = this.obterEmpresaSegura(empresaOuId);
      if (!emp) return null;
      const compAlvo = this.normalizarCompetencia(
        competenciaRef || (typeof window !== 'undefined' && window.ZGestorApp?.state?.competencia) || '10/2026'
      );
      const hist = Array.isArray(emp.historico_preferencia_envio) ? emp.historico_preferencia_envio : [];
      if (hist.length === 0) {
        return { canal: 'NAO_DEFINIDO', observacao: '', competencia_inicio: '' };
      }
      const ordenado = [...hist]
        .filter(it => it && it.competencia_inicio && it.canal)
        .sort((a, b) => this.compararCompetencias(a.competencia_inicio, b.competencia_inicio));

      let vigente = null;
      ordenado.forEach(it => {
        if (this.compararCompetencias(it.competencia_inicio, compAlvo) <= 0) {
          vigente = it;
        }
      });

      if (!vigente) {
        return { canal: 'NAO_DEFINIDO', observacao: '', competencia_inicio: '' };
      }
      return {
        canal: vigente.canal,
        observacao: vigente.observacao || '',
        competencia_inicio: vigente.competencia_inicio,
        atualizado_por: vigente.atualizado_por || '',
        atualizado_em: vigente.atualizado_em || ''
      };
    }

    salvarPreferenciaEnvioEmpresa(empresaId, competenciaInicio, canal, observacao = '') {
      if (!this.ehOperadorInterno()) {
        throw new Error('Política de Segurança: A preferência operacional de envio é restrita aos operadores do escritório.');
      }
      const emp = (this.data.empresas || []).find(e => e.id === empresaId);
      if (!emp) throw new Error('Empresa não encontrada.');

      const compNorm = this.normalizarCompetencia(competenciaInicio || '10/2026');
      const canalValido = ['IMPRESSO', 'WHATSAPP', 'EMAIL', 'NAO_DEFINIDO'].includes(canal) ? canal : 'NAO_DEFINIDO';
      const obsLimpa = String(observacao || '').trim();
      const user = this.getCurrentUser();
      const agora = new Date().toISOString();

      if (!Array.isArray(emp.historico_preferencia_envio)) {
        emp.historico_preferencia_envio = [];
      }

      const idxExist = emp.historico_preferencia_envio.findIndex(it => it && it.competencia_inicio === compNorm);
      const registro = {
        competencia_inicio: compNorm,
        canal: canalValido,
        observacao: obsLimpa,
        atualizado_por: user ? user.nome : 'Operador',
        atualizado_em: agora
      };

      if (idxExist !== -1) {
        emp.historico_preferencia_envio[idxExist] = registro;
      } else {
        emp.historico_preferencia_envio.push(registro);
      }

      emp.historico_preferencia_envio.sort((a, b) => this.compararCompetencias(a.competencia_inicio, b.competencia_inicio));
      this.saveLocalData();

      const mapNome = { IMPRESSO: 'Impresso (Office Boy)', WHATSAPP: 'WhatsApp', EMAIL: 'E-mail', NAO_DEFINIDO: 'Não definido' };
      this.registrarLog(
        'PREFERENCIA_ENVIO_CLIENTE',
        'Empresas',
        `Preferência de envio de ${this.nomeEmpresaPrioritario(emp)} definida como "${mapNome[canalValido]}" a partir de ${compNorm}${obsLimpa ? ` (${obsLimpa})` : ''}.`
      );
      return registro;
    }

    removerHistoricoPreferenciaEnvio(empresaId, competenciaInicio) {
      if (!this.ehOperadorInterno()) {
        throw new Error('Acesso restrito aos operadores do escritório.');
      }
      const emp = (this.data.empresas || []).find(e => e.id === empresaId);
      if (!emp || !Array.isArray(emp.historico_preferencia_envio)) return null;
      const compNorm = this.normalizarCompetencia(competenciaInicio);
      emp.historico_preferencia_envio = emp.historico_preferencia_envio.filter(it => it && it.competencia_inicio !== compNorm);
      this.saveLocalData();
      return emp.historico_preferencia_envio;
    }

    obterTrimestreDeCompetencia(competencia) {
      const partes = String(competencia || '09/2026').split('/');
      const mes = parseInt(partes[0], 10) || 9;
      const ano = parseInt(partes[1], 10) || 2026;
      const trimestre = Math.min(4, Math.max(1, Math.ceil(mes / 3)));
      const mesFechamento = String(trimestre * 3).padStart(2, '0');
      return {
        trimestre,
        ano,
        competenciaFechamento: `${mesFechamento}/${ano}`,
        sigla: `${trimestre}T/${ano}`,
        label: `${trimestre}º Trimestre/${ano}`
      };
    }

    calcularDatasQuotasTrimestre(trimestreNum = 3, anoRef = 2026, qtdQuotas = 3) {
      const trim = Math.min(4, Math.max(1, parseInt(trimestreNum, 10) || 3));
      const ano = parseInt(anoRef, 10) || 2026;
      const total = Math.min(3, Math.max(1, parseInt(qtdQuotas, 10) || 3));
      const mesFechamento = trim * 3;
      const compFechamento = `${String(mesFechamento).padStart(2, '0')}/${ano}`;

      const quotas = [];
      let compCursor = compFechamento;
      for (let q = 1; q <= total; q++) {
        const sub = this.obterMesSubsequente(compCursor);
        const ultimoDia = new Date(sub.ano, sub.mes, 0).getDate();
        const dataBruta = `${sub.ano}-${sub.mesFormatado}-${String(ultimoDia).padStart(2, '0')}`;
        const dataUtil = this.anteciparParaDiaUtil(dataBruta, true);
        quotas.push({
          quota: q,
          totalQuotas: total,
          competenciaFechamento: compFechamento,
          competenciaProtocolo: compCursor,
          competenciaEntrega: sub.label,
          data_vencimento: dataUtil
        });
        compCursor = sub.label;
      }
      return quotas;
    }

    obterDiaVencimentoIssEmpresa(emp) {
      if (!emp) return 10;
      if (emp.dia_vencimento_iss && [10, 20].includes(Number(emp.dia_vencimento_iss))) {
        return Number(emp.dia_vencimento_iss);
      }
      const mun = String(emp.municipio_uf || '').trim().toUpperCase();
      const mapa = (this.data?.escritorio && this.data.escritorio.vencimento_iss_por_municipio) || {};
      if (mun && mapa[mun] && [10, 20].includes(Number(mapa[mun]))) {
        return Number(mapa[mun]);
      }
      return 10;
    }

    identificarTipoApuracaoFiscal(tarefa, emp = null) {
      if (!tarefa) return null;
      const empresa = emp || this.obterEmpresaSegura(tarefa.empresa_id, tarefa);
      const tit = String(tarefa.titulo || '').toLowerCase().trim();
      if (tit.startsWith('transmissão efd-') || tit.startsWith('transmissao efd-') || tit.includes('destda')) {
        return null;
      }
      if (tit.includes('irpj') || tit.includes('csll')) {
        return 'IRPJ_CSLL';
      }
      if (tit.includes('pis') || tit.includes('cofins')) {
        return 'PIS_COFINS';
      }
      if (/\biss\b|\bissqn\b/i.test(tit)) {
        return 'ISS_MUNICIPAL';
      }
      if (tit.includes('icms')) {
        if (empresa && ['Lucro Presumido', 'Lucro Real'].includes(empresa.regime_tributario)) {
          return 'ICMS_PRESUMIDO_REAL';
        }
        return 'ICMS_SIMPLES';
      }
      return null;
    }

    ehTarefaDestda(tarefa) {
      if (!tarefa) return false;
      const tit = String(tarefa.titulo || '').toLowerCase();
      return tit.includes('destda') || tit.includes('sedif');
    }

    ehTarefaApuracaoIcms(tarefa) {
      if (!tarefa) return false;
      const tit = String(tarefa.titulo || '').toLowerCase();
      if (tit.includes('destda') || tit.includes('sedif')) return false;
      if (tit.startsWith('transmissão efd') || tit.startsWith('transmissao efd')) return false;
      return tit.includes('icms');
    }

    obterResumoApuracaoIcmsParaDestda(empresaId, competencia, mapaTarefasIcms = null, mapaGuiasIcms = null) {
      if (!empresaId || !competencia) return null;
      let tIcms = null;
      if (mapaTarefasIcms && typeof mapaTarefasIcms.get === 'function') {
        tIcms = mapaTarefasIcms.get(empresaId) || null;
      } else {
        tIcms = (this.data.tarefas || []).find(
          t => t && t.empresa_id === empresaId && t.competencia === competencia && this.ehTarefaApuracaoIcms(t)
        ) || null;
      }

      let guiasIcms = [];
      if (mapaGuiasIcms && typeof mapaGuiasIcms.get === 'function') {
        guiasIcms = mapaGuiasIcms.get(empresaId) || [];
      } else {
        guiasIcms = (this.data.guias_impostos || []).filter(
          g => g && g.empresa_id === empresaId && g.competencia === competencia && String(g.tipo_guia || '').toLowerCase().includes('icms')
        );
      }

      const resumirTipos = (listaTipos) => {
        if (!Array.isArray(listaTipos) || listaTipos.length === 0) return '';
        return listaTipos.map(tp => {
          const s = String(tp || '').trim();
          if (/antecip.*st/i.test(s)) return 'Antecipação ST';
          if (/difal/i.test(s)) return 'DIFAL';
          if (/antecip/i.test(s) && !/difal|st/i.test(s)) return 'Antecipação';
          if (/dae.*icms.*mensal/i.test(s)) return 'ICMS Mensal';
          return s.replace(/^DAE\s*\/\s*DARE\s*-\s*/i, '');
        }).join(' + ');
      };

      if (!tIcms) {
        if (guiasIcms.length > 0) {
          const tiposGuias = resumirTipos(guiasIcms.map(g => g.tipo_guia));
          return {
            codigo: 'CONCLUIDA_COM_MOV',
            icone: '📌',
            label: `ICMS c/ Movimento: ${tiposGuias || 'Guia gerada'}`,
            detalhe: tiposGuias,
            cls: 'bg-emerald-50 text-emerald-900 border-emerald-300'
          };
        }
        return null;
      }

      const stSimples = this.obterStatusSimplesTarefa(tIcms);
      const tiposTask = resumirTipos(tIcms.icms_apuracao_tipos);
      const tiposGuias = resumirTipos(guiasIcms.map(g => g.tipo_guia));
      const qualMov = tiposTask || tiposGuias;
      const obsLimpa = String(tIcms.motivo_pendencia || tIcms.protocolo_observacao || '').trim();

      if (stSimples === 'ENTREGUE' || stSimples === 'CONFERIDO') {
        if (tIcms.modalidade_entrega === 'SEM_MOVIMENTO' || tIcms.icms_sem_movimento === true) {
          return {
            codigo: 'CONCLUIDA_SEM_MOV',
            icone: '📌',
            label: 'ICMS: Sem Movimento',
            detalhe: 'Apuração de ICMS encerrada sem movimento',
            cls: 'bg-sky-50 text-sky-900 border-sky-300'
          };
        }
        let descMov = qualMov;
        if (!descMov && obsLimpa && !/^conclu[ií]da/i.test(obsLimpa)) {
          descMov = obsLimpa.length > 48 ? obsLimpa.slice(0, 48) + '…' : obsLimpa;
        }
        return {
          codigo: 'CONCLUIDA_COM_MOV',
          icone: '📌',
          label: descMov ? `ICMS c/ Movimento: ${descMov}` : 'ICMS: Com Movimento (Normal)',
          detalhe: descMov || 'Apuração de ICMS concluída com movimento',
          cls: 'bg-emerald-50 text-emerald-900 border-emerald-300'
        };
      }

      if (stSimples === 'EM_ANDAMENTO') {
        if (tIcms.icms_apuracao_definida) {
          if (tIcms.icms_sem_movimento) {
            return {
              codigo: 'EM_ANDAMENTO',
              icone: '🔄',
              label: 'ICMS: Em Andamento (pré-marcado Sem Mov.)',
              detalhe: obsLimpa,
              cls: 'bg-amber-50 text-amber-900 border-amber-300'
            };
          }
          if (qualMov) {
            return {
              codigo: 'EM_ANDAMENTO',
              icone: '🔄',
              label: `ICMS: Em Andamento (${qualMov})`,
              detalhe: obsLimpa,
              cls: 'bg-amber-50 text-amber-900 border-amber-300'
            };
          }
        }
        return {
          codigo: 'EM_ANDAMENTO',
          icone: '🔄',
          label: obsLimpa ? `ICMS: Em Andamento (${obsLimpa.length > 36 ? obsLimpa.slice(0, 36) + '…' : obsLimpa})` : 'ICMS: Ainda em Andamento',
          detalhe: obsLimpa || 'Apuração de ICMS ainda está em andamento',
          cls: 'bg-sky-50 text-sky-900 border-sky-300'
        };
      }

      if (stSimples === 'PENDENTE') {
        return {
          codigo: 'PENDENTE',
          icone: '⚠️',
          label: obsLimpa ? `ICMS: Pendente (${obsLimpa.length > 40 ? obsLimpa.slice(0, 40) + '…' : obsLimpa})` : 'ICMS: Pendente',
          detalhe: obsLimpa || 'Apuração de ICMS marcada como pendente',
          cls: 'bg-rose-50 text-rose-900 border-rose-300'
        };
      }

      if (stSimples === 'AGUARDANDO_DOCS') {
        return {
          codigo: 'AGUARDANDO_DOCS',
          icone: '⏳',
          label: 'ICMS: Aguardando Docs',
          detalhe: obsLimpa || 'Aguardando envio de documentos do cliente',
          cls: 'bg-amber-50 text-amber-900 border-amber-300'
        };
      }

      return {
        codigo: 'NAO_INICIADA',
        icone: '⚪',
        label: 'ICMS: Ainda não apurado',
        detalhe: 'A tarefa de Apuração de ICMS desta empresa ainda não foi iniciada',
        cls: 'bg-slate-100 text-slate-600 border-slate-300'
      };
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
        if (!this.data.escritorio.marca_titulo) this.data.escritorio.marca_titulo = 'ZIOTO';
        if (!this.data.escritorio.marca_subtitulo) this.data.escritorio.marca_subtitulo = 'CONTABILIDADE';
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
        if (!this.data.escritorio.ia_config) {
          this.data.escritorio.ia_config = {
            provedor: 'gemini',
            gemini_api_key: '',
            openai_api_key: '',
            api_key: '',
            gemini_modelo: 'gemini-1.5-flash',
            openai_modelo: 'gpt-4o-mini',
            temperatura: 0.7,
            ativo: false,
            ultima_utilizacao: null
          };
        } else {
          if (!this.data.escritorio.ia_config.provedor) this.data.escritorio.ia_config.provedor = 'gemini';
          if (!this.data.escritorio.ia_config.gemini_modelo) this.data.escritorio.ia_config.gemini_modelo = 'gemini-1.5-flash';
          if (!this.data.escritorio.ia_config.openai_modelo) this.data.escritorio.ia_config.openai_modelo = 'gpt-4o-mini';
          if (this.data.escritorio.ia_config.api_key && !this.data.escritorio.ia_config.gemini_api_key) {
            this.data.escritorio.ia_config.gemini_api_key = this.data.escritorio.ia_config.api_key;
          }
        }
      }
      return this.data.escritorio;
    }

    formatarEnderecoCompletoEscritorio(escInput = null) {
      const esc = escInput || this.getEscritorioConfig() || {};
      const logradouroBase = String(esc.logradouro || esc.endereco_escritorio || '').trim();
      const numero = String(esc.numero || '').trim();
      const complemento = String(esc.complemento || '').trim();
      const bairro = String(esc.bairro || '').trim();
      const municipio = String(esc.municipio || '').trim();
      const uf = String(esc.uf || '').trim().toUpperCase();
      const cidadeUf = (municipio && uf)
        ? `${municipio}/${uf}`
        : String(esc.cidade_uf || municipio || uf || '').trim();
      const cep = String(esc.cep || '').trim();

      let partesEnd = [];
      if (logradouroBase) {
        let linhaRua = logradouroBase;
        if (numero) {
          const numLower = numero.toLowerCase();
          const jaContemNum = new RegExp(`(^|\\D)${numero.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\D|$)`).test(linhaRua);
          if (!jaContemNum) {
            linhaRua += (numLower.startsWith('n') || numLower === 's/n' || numLower === 'sn') ? `, ${numero}` : `, nº ${numero}`;
          }
        }
        if (complemento && !linhaRua.toLowerCase().includes(complemento.toLowerCase())) {
          linhaRua += ` - ${complemento}`;
        }
        if (bairro && !linhaRua.toLowerCase().includes(bairro.toLowerCase())) {
          linhaRua += ` - ${bairro}`;
        }
        partesEnd.push(linhaRua);
      }
      if (cidadeUf) {
        partesEnd.push(cidadeUf);
      }
      let resultado = partesEnd.join(' — ');
      if (cep && !(cep === '01310-100' && !cidadeUf.toLowerCase().includes('paulo'))) {
        resultado += (resultado ? ` • CEP: ${cep}` : `CEP: ${cep}`);
      }
      return resultado || 'Endereço não informado';
    }

    salvarEscritorioConfig(novosDados) {
      const atual = this.getEscritorioConfig();
      const pPrincNovo = {
        ...(atual.pix_principal || {}),
        ...(novosDados.pix_principal || {})
      };
      const pSecNovo = {
        ...(atual.pix_secundario || {}),
        ...(novosDados.pix_secundario || {})
      };
      const pAutNovo = {
        ...(atual.pix_autonomo || {}),
        ...(novosDados.pix_autonomo || {})
      };

      // Mantém sincronia bidirecional entre campos raiz legados e pix_principal
      if (novosDados.chave_pix !== undefined && (!novosDados.pix_principal || novosDados.pix_principal.chave_pix === undefined)) {
        pPrincNovo.chave_pix = novosDados.chave_pix;
      }
      if (novosDados.tipo_chave_pix !== undefined && (!novosDados.pix_principal || novosDados.pix_principal.tipo_chave === undefined)) {
        pPrincNovo.tipo_chave = novosDados.tipo_chave_pix;
      }
      if (novosDados.favorecido_pix !== undefined && (!novosDados.pix_principal || novosDados.pix_principal.favorecido === undefined)) {
        pPrincNovo.favorecido = novosDados.favorecido_pix;
      }
      if (novosDados.banco_pix !== undefined && (!novosDados.pix_principal || novosDados.pix_principal.banco === undefined)) {
        pPrincNovo.banco = novosDados.banco_pix;
      }
      if (novosDados.qrcode_img !== undefined && (!novosDados.pix_principal || novosDados.pix_principal.qrcode_img === undefined)) {
        pPrincNovo.qrcode_img = novosDados.qrcode_img;
      }

      this.data.escritorio = {
        ...atual,
        ...novosDados,
        chave_pix: pPrincNovo.chave_pix || novosDados.chave_pix || atual.chave_pix || '',
        tipo_chave_pix: pPrincNovo.tipo_chave || novosDados.tipo_chave_pix || atual.tipo_chave_pix || 'CNPJ',
        favorecido_pix: pPrincNovo.favorecido || novosDados.favorecido_pix || atual.favorecido_pix || '',
        banco_pix: pPrincNovo.banco || novosDados.banco_pix || atual.banco_pix || '',
        qrcode_img: pPrincNovo.qrcode_img !== undefined ? pPrincNovo.qrcode_img : (atual.qrcode_img || ''),
        pix_principal: pPrincNovo,
        pix_secundario: pSecNovo,
        pix_autonomo: pAutNovo,
        api_integra_contador: {
          ...(atual.api_integra_contador || {}),
          ...(novosDados.api_integra_contador || {})
        },
        ia_config: {
          ...(atual.ia_config || {}),
          ...(novosDados.ia_config || {})
        }
      };

      this._escritorioUpdatedLocalAt = Date.now();
      this.saveLocalData();

      // Envia imediatamente a configuração do escritório (incluindo QR Codes PIX) para o Supabase
      if (this.supabaseConnected && this.supabase && this.supabaseConfig?.autoSync !== false) {
        const agora = new Date().toISOString();
        const escPayload = this.data.escritorio;
        this.supabase
          .from('zgestor_config')
          .upsert([{ chave: 'escritorio', dados: escPayload, updated_at: agora }], { onConflict: 'chave' })
          .then(({ error }) => {
            if (!error) {
              this._cloudCfgEscritorioJson = JSON.stringify(escPayload || {});
            }
          })
          .catch(() => {});
      }

      this.registrarLog('CONFIG_ESCRITORIO_PIX', 'Honorários', `Dados do escritório e Contas/QR Codes PIX atualizados.`);
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

    _getCloudCollections() {
      return [
        'profiles', 'empresas', 'onboarding_itens', 'tarefas', 'guias_impostos',
        'protocolos_guias', 'parcelamentos', 'parcelamento_guias', 'cnds', 'alvaras',
        'portal_arquivos', 'central_cliente_registros', 'honorarios', 'honorario_pagamentos',
        'encerramentos_exercicio', 'convites', 'audit_logs'
      ];
    }

    async _fetchPaginatedRegistros(campos = 'colecao, id, dados', filtroColecao = null) {
      const todos = [];
      const pageSize = 1000;
      let offset = 0;
      while (true) {
        let query = this.supabase.from('zgestor_registros').select(campos);
        if (filtroColecao) {
          query = query.eq('colecao', filtroColecao);
        } else if (typeof query.neq === 'function') {
          // Não baixa os PDFs pesados do Cofre na abertura do sistema (são carregados sob demanda ao clicar em Ver/Baixar PDF)
          query = query.neq('colecao', 'arquivos_cofre');
        }
        if (typeof query.range === 'function') {
          query = query.range(offset, offset + pageSize - 1);
        }
        const { data: pagina, error } = await query;
        if (error) throw new Error(error.message || 'Erro ao consultar zgestor_registros');
        const lista = Array.isArray(pagina) ? pagina : [];
        todos.push(...lista);
        if (lista.length < pageSize || typeof this.supabase.from('zgestor_registros').select(campos).range !== 'function') {
          break;
        }
        offset += pageSize;
      }
      return todos;
    }

    _registrarSnapshotNuvem() {
      if (!this._cloudRowHashes) this._cloudRowHashes = new Map();
      if (!this._cloudColIds) this._cloudColIds = new Map();
      this._cloudRowHashes.clear();
      this._cloudColIds.clear();
      this._getCloudCollections().forEach(col => {
        const arr = Array.isArray(this.data?.[col]) ? this.data[col] : [];
        const idSet = new Set();
        for (let i = 0; i < arr.length; i++) {
          const item = arr[i];
          if (!item || !item.id) continue;
          const idStr = String(item.id);
          idSet.add(idStr);
          this._cloudRowHashes.set(`${col}:${idStr}`, JSON.stringify(item));
        }
        this._cloudColIds.set(col, idSet);
      });
      this._cloudCfgEscritorioJson = JSON.stringify(this.data?.escritorio || {});
      this._cloudCfgModelosJson = JSON.stringify(this.data?.modelos_tarefas || []);
      this._cloudBaselineReady = true;
    }

    _agendarSyncNuvem() {
      if (!this._initialCloudSyncDone) return;
      if (this._cloudSyncTimer) clearTimeout(this._cloudSyncTimer);
      this.statusNuvem = 'SINCRONIZANDO';
      this._cloudSyncTimer = setTimeout(() => {
        this._cloudSyncTimer = null;
        this.pushToSupabase({ silent: true }).catch(() => {});
      }, 1500);
    }

    async pushToSupabase(opts = {}) {
      if (!this.supabaseConnected || !this.supabase) {
        this.statusNuvem = 'LOCAL';
        return { ok: false, message: 'Supabase não conectado.' };
      }
      // Evita que um navegador recém-aberto (ainda sem pull inicial) sobrescreva a nuvem com arrays vazios
      if (!this._initialCloudSyncDone && !opts.forceManual) {
        await this.syncFromSupabase();
      }
      try {
        this.statusNuvem = 'SINCRONIZANDO';
        const colecoes = this._getCloudCollections();
        const agora = new Date().toISOString();
        const usarDelta = Boolean(this._cloudBaselineReady && !opts.forceManual && !opts.forceEmpty);

        for (const col of colecoes) {
          const arr = Array.isArray(this.data[col]) ? this.data[col] : [];
          if (usarDelta) {
            const prevIds = this._cloudColIds.get(col) || new Set();
            const currentIds = new Set();
            const alterados = [];
            for (let i = 0; i < arr.length; i++) {
              const item = arr[i];
              if (!item || !item.id) continue;
              const idStr = String(item.id);
              currentIds.add(idStr);
              const jsonAtual = JSON.stringify(item);
              const chave = `${col}:${idStr}`;
              if (this._cloudRowHashes.get(chave) !== jsonAtual) {
                alterados.push({ item, idStr, jsonAtual, chave });
              }
            }

            if (alterados.length > 0) {
              const rows = alterados.map(a => ({
                colecao: col,
                id: a.idStr,
                dados: a.item,
                updated_at: agora
              }));
              for (let i = 0; i < rows.length; i += 100) {
                const chunk = rows.slice(i, i + 100);
                const { error } = await this.supabase
                  .from('zgestor_registros')
                  .upsert(chunk, { onConflict: 'colecao,id' });
                if (error) throw new Error(error.message || 'Erro ao enviar ' + col);
              }
              alterados.forEach(a => this._cloudRowHashes.set(a.chave, a.jsonAtual));
            }

            if (arr.length > 0) {
              const idsRemovidos = [];
              prevIds.forEach(oldId => {
                if (!currentIds.has(oldId)) idsRemovidos.push(oldId);
              });
              for (let j = 0; j < idsRemovidos.length; j += 100) {
                const delChunk = idsRemovidos.slice(j, j + 100);
                await this.supabase
                  .from('zgestor_registros')
                  .delete()
                  .eq('colecao', col)
                  .in('id', delChunk);
              }
              idsRemovidos.forEach(oldId => this._cloudRowHashes.delete(`${col}:${oldId}`));
            }
            this._cloudColIds.set(col, currentIds);
            continue;
          }

          const rows = arr
            .filter(item => item && item.id)
            .map(item => ({
              colecao: col,
              id: String(item.id),
              dados: item,
              updated_at: agora
            }));

          // Upsert em lotes de 100 registros
          for (let i = 0; i < rows.length; i += 100) {
            const chunk = rows.slice(i, i + 100);
            const { error } = await this.supabase
              .from('zgestor_registros')
              .upsert(chunk, { onConflict: 'colecao,id' });
            if (error) throw new Error(error.message || 'Erro ao enviar ' + col);
          }

          // Proteção anti-perda: nunca apaga uma coleção inteira na nuvem se localmente estiver zerada (exceto se forceEmpty explícito)
          if (rows.length > 0 || opts.forceEmpty === true) {
            const existentes = await this._fetchPaginatedRegistros('id', col);
            if (Array.isArray(existentes) && existentes.length > 0) {
              const idsLocais = new Set(rows.map(r => r.id));
              const idsRemover = existentes.map(x => x.id).filter(id => !idsLocais.has(id));
              for (let j = 0; j < idsRemover.length; j += 100) {
                const delChunk = idsRemover.slice(j, j + 100);
                await this.supabase
                  .from('zgestor_registros')
                  .delete()
                  .eq('colecao', col)
                  .in('id', delChunk);
              }
            }
          }
        }

        const escJson = JSON.stringify(this.data.escritorio || {});
        const modJson = JSON.stringify(this.data.modelos_tarefas || []);
        if (!usarDelta || escJson !== this._cloudCfgEscritorioJson || modJson !== this._cloudCfgModelosJson) {
          const configs = [
            { chave: 'escritorio', dados: this.data.escritorio || {}, updated_at: agora },
            { chave: 'modelos_tarefas', dados: this.data.modelos_tarefas || [], updated_at: agora }
          ];
          const { error: errCfg } = await this.supabase
            .from('zgestor_config')
            .upsert(configs, { onConflict: 'chave' });
          if (errCfg) throw new Error(errCfg.message);
          this._cloudCfgEscritorioJson = escJson;
          this._cloudCfgModelosJson = modJson;
        }

        if (!usarDelta) {
          this._registrarSnapshotNuvem();
        }
        this._initialCloudSyncDone = true;
        this.statusNuvem = 'CONECTADO';
        this.ultimaSyncNuvem = agora;
        this.ultimoErroNuvem = '';
        return { ok: true, message: 'Todos os dados foram sincronizados com a nuvem Supabase!' };
      } catch (e) {
        this.statusNuvem = 'ERRO';
        this.ultimoErroNuvem = e.message || String(e);
        if (!opts.silent) console.warn('Erro pushToSupabase:', e);
        return { ok: false, message: 'Falha ao enviar para o Supabase: ' + (e.message || e) };
      }
    }

    async syncFromSupabase() {
      if (!this.supabaseConnected || !this.supabase) {
        this._initialCloudSyncDone = true;
        this.statusNuvem = 'LOCAL';
        return { ok: false, message: 'Supabase não configurado.' };
      }
      if (this._syncInFlight) {
        return this._syncInFlight;
      }
      this._syncInFlight = (async () => {
        try {
          const registros = await this._fetchPaginatedRegistros('colecao, id, dados');

          const { data: configs, error: errCfg } = await this.supabase
            .from('zgestor_config')
            .select('chave, dados');
          if (errCfg) throw new Error(errCfg.message);

          let atualizado = false;
          let precisaSubirReconciliacao = false;

          if (Array.isArray(configs) && configs.length > 0) {
            configs.forEach(c => {
              if (c.chave === 'escritorio' && c.dados && Object.keys(c.dados).length > 0) {
                const editouRecente = this._escritorioUpdatedLocalAt && (Date.now() - this._escritorioUpdatedLocalAt < 10000);
                if (!editouRecente && JSON.stringify(c.dados) !== JSON.stringify(this.data.escritorio || {})) {
                  this.data.escritorio = { ...(this.data.escritorio || {}), ...c.dados };
                  atualizado = true;
                }
              }
              if (c.chave === 'modelos_tarefas' && Array.isArray(c.dados) && c.dados.length > 0) {
                if (JSON.stringify(c.dados) !== JSON.stringify(this.data.modelos_tarefas || [])) {
                  this.data.modelos_tarefas = c.dados;
                  atualizado = true;
                }
              }
            });
          }

          if (Array.isArray(registros) && registros.length > 0) {
            const porColecao = {};
            registros.forEach(r => {
              if (!porColecao[r.colecao]) porColecao[r.colecao] = [];
              if (r.dados) porColecao[r.colecao].push(r.dados);
            });
            this._getCloudCollections().forEach(col => {
              if (Array.isArray(porColecao[col])) {
                const novoJson = JSON.stringify(porColecao[col]);
                const atualJson = JSON.stringify(this.data[col] || []);
                if (novoJson !== atualJson) {
                  this.data[col] = porColecao[col];
                  atualizado = true;
                }
              }
            });
          }

          const normMudou = this._normalizarDadosCarregados(this.data);
          const reconciliou = this.reconciliarCarteiraOficial(this.data);
          const desacoplouNuvem = this._desacoplarAnexosPesadosParaCofre(this.data, false);
          if (normMudou || reconciliou || desacoplouNuvem) {
            atualizado = true;
            precisaSubirReconciliacao = true;
          }

          this._initialCloudSyncDone = true;
          this._honMutVersion = (this._honMutVersion || 0) + 1;

          if (!precisaSubirReconciliacao) {
            this._registrarSnapshotNuvem();
          }

          if (atualizado) {
            this._suppressCloudSync = !precisaSubirReconciliacao;
            try { this.saveLocalData(); } finally { this._suppressCloudSync = false; }
          }
          this.statusNuvem = 'CONECTADO';
          this.ultimaSyncNuvem = new Date().toISOString();
          this.ultimoErroNuvem = '';
          return {
            ok: true,
            atualizado,
            message: atualizado
              ? 'Dados atualizados diretamente da nuvem Supabase!'
              : 'Conectado ao Supabase! Todos os registros estão sincronizados.'
          };
        } catch (e) {
          this._initialCloudSyncDone = true;
          this.statusNuvem = 'ERRO';
          this.ultimoErroNuvem = e.message || String(e);
          return { ok: false, message: 'Falha ao sincronizar com Supabase: ' + e.message };
        } finally {
          this._syncInFlight = null;
        }
      })();
      return this._syncInFlight;
    }

    async uploadArquivoParaNuvem(nomeArquivo, base64DataUrl, pasta = 'anexos') {
      if (!this.supabaseConnected || !this.supabase || !base64DataUrl) return { ok: false };
      try {
        const parts = String(base64DataUrl).split(',');
        if (parts.length < 2) return { ok: false };
        const mimeMatch = parts[0].match(/data:([^;]+);base64/);
        const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
        const binStr = atob(parts[1]);
        const bytes = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
        const safeName = `${pasta}/${Date.now()}_${String(nomeArquivo || 'arquivo.pdf').replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const { error } = await this.supabase.storage
          .from('zgestor-documentos')
          .upload(safeName, bytes, { contentType: mime, upsert: true });
        if (error) return { ok: false, error: error.message };
        const { data: pub } = this.supabase.storage.from('zgestor-documentos').getPublicUrl(safeName);
        return { ok: true, path: safeName, url: pub?.publicUrl || '' };
      } catch (e) {
        return { ok: false, error: e.message };
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

      // Recuperação e garantia de acesso com credencial padrão do escritório
      if (!senhaValida && (s === '123456' || s === 'admin123' || !user.senha_hash)) {
        if (s === '123456' || s === 'admin123') {
          user.senha_salt = gerarSalt();
          user.senha_hash = hashSenha(s, user.senha_salt);
          delete user.senha;
          senhaValida = true;
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
      const docLimpo = String(dadosEmpresa.cnpj || '').replace(/\D/g, '');
      const ehPF = dadosEmpresa.tipo_pessoa === 'PF' || dadosEmpresa.regime_tributario === 'Pessoa Física (Doméstica)' || docLimpo.length === 11;
      const tipoPessoaFinal = ehPF ? 'PF' : 'PJ';
      const isEdit = Boolean(dadosEmpresa.id);
      if (isEdit) {
        const idx = this.data.empresas.findIndex(e => e.id === dadosEmpresa.id);
        if (idx !== -1) {
          const oldStatus = this.data.empresas[idx].status;
          this.data.empresas[idx] = {
            ...this.data.empresas[idx],
            ...dadosEmpresa,
            tipo_pessoa: tipoPessoaFinal,
            nome_fantasia: dadosEmpresa.nome_fantasia || dadosEmpresa.razao_social || this.data.empresas[idx].nome_fantasia,
            codigo_interno: this.limparCodigoInterno(dadosEmpresa.codigo_interno || this.data.empresas[idx].codigo_interno),
            municipio_uf: dadosEmpresa.municipio_uf || this.data.empresas[idx].municipio_uf || '',
            validade_certificado: dadosEmpresa.validade_certificado || this.data.empresas[idx].validade_certificado || '',
            competencia_inicial: compNorm,
            canal_pagamento_padrao: dadosEmpresa.canal_pagamento_padrao || this.data.empresas[idx].canal_pagamento_padrao || 'PIX_PRINCIPAL',
            modelo_onboarding: dadosEmpresa.modelo_onboarding || this.data.empresas[idx].modelo_onboarding || 'ABERTURA_EMPRESA',
            possui_pro_labore: ehPF ? Boolean(dadosEmpresa.possui_pro_labore) : (dadosEmpresa.possui_pro_labore !== false),
            possui_funcionarios: dadosEmpresa.possui_funcionarios !== undefined ? Boolean(dadosEmpresa.possui_funcionarios) : (ehPF ? true : Boolean(this.data.empresas[idx].possui_funcionarios))
          };
          if (dadosEmpresa.status === 'ATIVA' && oldStatus !== 'ATIVA') {
            const compGera = this.data.empresas[idx].competencia_inicial || this.data.competencia_ativa || '10/2026';
            this.gerarTarefasCompetencia(compGera, this.data.empresas[idx].id);
            if (this.canAccessModule('honorarios')) {
              this.gerarHonorariosCompetencia(compGera);
            }
          }
          this.saveLocalData();
          this.registrarLog(
            'EDICAO_EMPRESA',
            'Empresas',
            `Dados atualizados de ${dadosEmpresa.razao_social} (${tipoPessoaFinal} - ${this.data.empresas[idx].regime_tributario}).`
          );
          return this.data.empresas[idx];
        }
      }

      const nextNum = String(this.data.empresas.length + 1).padStart(3, '0');
      const novaEmpresa = {
        id: 'emp-' + Date.now(),
        tipo_pessoa: tipoPessoaFinal,
        codigo_interno: this.limparCodigoInterno(dadosEmpresa.codigo_interno) || nextNum,
        razao_social: dadosEmpresa.razao_social,
        nome_fantasia: dadosEmpresa.nome_fantasia || dadosEmpresa.razao_social,
        cnpj: dadosEmpresa.cnpj,
        municipio_uf: dadosEmpresa.municipio_uf || (dadosEmpresa.municipio && dadosEmpresa.uf ? `${dadosEmpresa.municipio}/${dadosEmpresa.uf}` : ''),
        validade_certificado: dadosEmpresa.validade_certificado || '',
        competencia_inicial: compNorm,
        modelo_onboarding: dadosEmpresa.modelo_onboarding || 'ABERTURA_EMPRESA',
        regime_tributario: dadosEmpresa.regime_tributario || (ehPF ? 'Pessoa Física (Doméstica)' : 'Simples Nacional'),
        inscricao_estadual: dadosEmpresa.inscricao_estadual || 'Isento',
        inscricao_municipal: dadosEmpresa.inscricao_municipal || '',
        responsavel_legal: dadosEmpresa.responsavel_legal || (ehPF ? dadosEmpresa.razao_social : ''),
        telefone: dadosEmpresa.telefone || '',
        email: dadosEmpresa.email || '',
        status: dadosEmpresa.status || 'EM_ONBOARDING',
        valor_honorario_padrao: Number(dadosEmpresa.valor_honorario_padrao || 0),
        dia_vencimento_honorario: Number(dadosEmpresa.dia_vencimento_honorario || 10),
        canal_pagamento_padrao: dadosEmpresa.canal_pagamento_padrao || 'PIX_PRINCIPAL',
        possui_pro_labore: ehPF ? Boolean(dadosEmpresa.possui_pro_labore) : (dadosEmpresa.possui_pro_labore !== false),
        possui_funcionarios: dadosEmpresa.possui_funcionarios !== undefined ? Boolean(dadosEmpresa.possui_funcionarios) : ehPF,
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

    empresaPossuiIE(empresa) {
      if (!empresa) return false;
      if (empresa.possui_ie === true) return true;
      if (empresa.possui_ie === false) return false;
      const ie = (empresa.inscricao_estadual || '').trim().toLowerCase();
      if (!ie || ie === '-' || ie === 'isento' || ie === 'isenta' || ie === 'nao possui' || ie === 'não possui' || ie === 'n/a' || ie === 'sem ie') {
        return false;
      }
      return true;
    }

    toggleInscricaoEstadualEmpresa(empresaId, inscricaoInformada = null) {
      const idx = (this.data.empresas || []).findIndex(e => e.id === empresaId);
      if (idx === -1) throw new Error('Empresa não encontrada.');
      const emp = this.data.empresas[idx];
      if (inscricaoInformada !== null) {
        const limpo = String(inscricaoInformada).trim();
        emp.inscricao_estadual = limpo;
        emp.possui_ie = this.empresaPossuiIE({ ...emp, possui_ie: undefined, inscricao_estadual: limpo });
      } else {
        const atualTem = this.empresaPossuiIE(emp);
        if (atualTem) {
          emp.possui_ie = false;
          emp.inscricao_estadual = 'Isento';
        } else {
          emp.possui_ie = true;
          if (!emp.inscricao_estadual || emp.inscricao_estadual.toLowerCase() === 'isento') {
            emp.inscricao_estadual = 'Ativa (I.E.)';
          }
        }
      }
      this.saveLocalData();
      this.registrarLog('ATUALIZACAO_IE', 'Empresas', `Inscrição Estadual de ${emp.nome_fantasia} atualizada: ${emp.inscricao_estadual || 'Sem I.E.'}.`);
      return emp;
    }

    marcarEtapaTarefa(tarefaId, acao, observacao = null, opcoes = {}) {
      const idx = (this.data.tarefas || []).findIndex(t => t.id === tarefaId);
      if (idx === -1) throw new Error('Tarefa não encontrada.');
      const t = this.data.tarefas[idx];
      const user = this.getCurrentUser();
      if (!this.canManageDepartment(t.departamento, user)) {
        throw new Error(`Política de Segurança (RLS): Seu perfil (${user?.departamento}) não tem permissão para alterar tarefas do departamento ${t.departamento}.`);
      }

      const hoje = new Date().toISOString().slice(0, 10);
      const textoObsInformado = (observacao !== null && observacao !== undefined) ? String(observacao).trim() : null;

      if (acao === 'PENDENTE') {
        t.status = 'PENDENTE';
        t.data_entrega = null;
        t.modalidade_entrega = null;
        const motivo = textoObsInformado !== null ? textoObsInformado : String(t.motivo_pendencia || t.protocolo_observacao || '').trim();
        t.motivo_pendencia = motivo;
        t.protocolo_observacao = motivo || 'Marcada como Pendente.';
      } else if (acao === 'COBRAR_DOCS' || acao === 'AGUARDANDO_DOCS') {
        t.status = 'AGUARDANDO_DOCS';
        t.data_entrega = null;
        t.modalidade_entrega = null;
        t.motivo_pendencia = '';
        if (textoObsInformado !== null) {
          t.protocolo_observacao = textoObsInformado || 'Documentos solicitados ao cliente.';
        } else if (!t.protocolo_observacao) {
          t.protocolo_observacao = 'Documentos solicitados ao cliente.';
        }
      } else if (acao === 'EM_ANDAMENTO') {
        t.status = 'EM_ANDAMENTO';
        t.data_entrega = null;
        t.modalidade_entrega = null;
        t.motivo_pendencia = '';
        if (textoObsInformado !== null) t.protocolo_observacao = textoObsInformado;
      } else if (acao === 'ENTREGUE_NORMAL') {
        t.data_entrega = hoje;
        t.modalidade_entrega = 'NORMAL';
        t.motivo_pendencia = '';
        t.status = this.calcularStatusTarefa(t.prazo_entrega, hoje, 'ENTREGUE');
        if (textoObsInformado !== null) t.protocolo_observacao = textoObsInformado;
      } else if (acao === 'SEM_MOVIMENTO') {
        t.data_entrega = hoje;
        t.modalidade_entrega = 'SEM_MOVIMENTO';
        t.motivo_pendencia = '';
        t.status = this.calcularStatusTarefa(t.prazo_entrega, hoje, 'ENTREGUE');
        if (textoObsInformado !== null) {
          t.protocolo_observacao = textoObsInformado || 'Concluída Sem Movimento.';
        } else if (!t.protocolo_observacao) {
          t.protocolo_observacao = 'Concluída Sem Movimento.';
        }
      } else if (acao === 'REABRIR' || acao === 'NAO_INICIADA') {
        t.data_entrega = null;
        t.modalidade_entrega = null;
        t.motivo_pendencia = '';
        t.status = 'NAO_INICIADA';
        if (textoObsInformado !== null) t.protocolo_observacao = textoObsInformado;
      }

      if (user) {
        t.responsavel_nome = user.nome;
      }

      // Integração automática com Controle de Guias e Protocolos:
      // Se PGDAS-D, ICMS, PIS/COFINS ou IRPJ/CSLL foi concluída COM MOVIMENTO (ENTREGUE_NORMAL), garante a guia pronta para envio/impressão.
      // Se foi concluída SEM MOVIMENTO, remove eventual guia pendente não enviada.
      const empTarefa = this.obterEmpresaSegura(t.empresa_id, t);
      const tipoApur = this.identificarTipoApuracaoFiscal(t, empTarefa);
      const tituloLower = (t.titulo || '').toLowerCase();
      const ehPgdas = tituloLower.includes('pgdas') || tituloLower.includes('guia das') || tituloLower.includes('simei');

      if (ehPgdas) {
        const tipoGuiaAlvo = empTarefa && empTarefa.regime_tributario === 'MEI' ? 'DAS - SIMEI (MEI)' : 'DAS - Simples Nacional';
        if (acao === 'ENTREGUE_NORMAL') {
          this._garantirGuiaPorConclusaoTarefa(t, tipoGuiaAlvo, 20, false);
        } else if (acao === 'SEM_MOVIMENTO') {
          this._removerGuiasPendentesPorFiltro(g => g.empresa_id === t.empresa_id && g.competencia === t.competencia && g.tipo_guia === tipoGuiaAlvo);
        }
      } else if (tipoApur === 'ICMS_PRESUMIDO_REAL') {
        const vencDia8Util = this.calcularDataMesSubsequenteUtil(t.competencia, 8, true);
        if (acao === 'ENTREGUE_NORMAL') {
          this._garantirGuiaPorConclusaoTarefa(t, 'DAE / DARE - ICMS Mensal (Normal)', 8, false, vencDia8Util);
        } else if (acao === 'SEM_MOVIMENTO') {
          this._removerGuiasPendentesPorFiltro(g => g.empresa_id === t.empresa_id && g.competencia === t.competencia && String(g.tipo_guia || '').toLowerCase().includes('icms'));
        }
      } else if (tipoApur === 'ICMS_SIMPLES' && !tituloLower.includes('destda')) {
        if (acao === 'ENTREGUE_NORMAL') {
          this._garantirGuiaPorConclusaoTarefa(t, 'DAE / DARE - ICMS (Antecipação / DIFAL / ST)', 20, true);
        } else if (acao === 'SEM_MOVIMENTO') {
          this._removerGuiasPendentesPorFiltro(g => g.empresa_id === t.empresa_id && g.competencia === t.competencia && String(g.tipo_guia || '').toLowerCase().includes('icms'));
        }
      } else if (tipoApur === 'PIS_COFINS') {
        const vencDia25Util = this.calcularDataMesSubsequenteUtil(t.competencia, 25, true);
        if (acao === 'ENTREGUE_NORMAL') {
          this._garantirGuiaPorConclusaoTarefa(t, 'DARF - PIS', 25, false, vencDia25Util);
          this._garantirGuiaPorConclusaoTarefa(t, 'DARF - COFINS', 25, false, vencDia25Util);
        } else if (acao === 'SEM_MOVIMENTO') {
          this._removerGuiasPendentesPorFiltro(g => g.empresa_id === t.empresa_id && g.competencia === t.competencia && (String(g.tipo_guia || '').includes('PIS') || String(g.tipo_guia || '').includes('COFINS')));
        }
      } else if (tipoApur === 'IRPJ_CSLL') {
        const infoTrim = this.obterTrimestreDeCompetencia(t.competencia);
        if (acao === 'ENTREGUE_NORMAL') {
          const [qUnica] = this.calcularDatasQuotasTrimestre(infoTrim.trimestre, infoTrim.ano, 1);
          this._garantirGuiaPorConclusaoTarefa(t, `DARF - IRPJ (Quota Única - ${infoTrim.label})`, 30, false, qUnica.data_vencimento);
          this._garantirGuiaPorConclusaoTarefa(t, `DARF - CSLL (Quota Única - ${infoTrim.label})`, 30, false, qUnica.data_vencimento);
        } else if (acao === 'SEM_MOVIMENTO') {
          this._removerGuiasPendentesPorFiltro(g => g.empresa_id === t.empresa_id && (g.competencia === t.competencia || g.trimestre_ref === infoTrim.sigla) && (String(g.tipo_guia || '').includes('IRPJ') || String(g.tipo_guia || '').includes('CSLL')));
        }
      } else if (tipoApur === 'ISS_MUNICIPAL') {
        const diaIss = this.obterDiaVencimentoIssEmpresa(empTarefa);
        const vencIss = this.calcularDataMesSubsequenteUtil(t.competencia, diaIss, true);
        if (acao === 'ENTREGUE_NORMAL') {
          this._garantirGuiaPorConclusaoTarefa(t, 'DAM / Guia ISS Próprio (Serviços Prestados)', diaIss, false, vencIss);
        } else if (acao === 'SEM_MOVIMENTO') {
          this._removerGuiasPendentesPorFiltro(g => g.empresa_id === t.empresa_id && g.competencia === t.competencia && /\bISS\b/i.test(String(g.tipo_guia || '')));
        }
      } else if (
        (empTarefa && empTarefa.regime_tributario === 'Pessoa Física (Doméstica)') ||
        tituloLower.includes('folha doméstica') ||
        tituloLower.includes('folha domestica') ||
        tituloLower.includes('esocial doméstico') ||
        tituloLower.includes('esocial domestico')
      ) {
        const vencDaeDom = this.calcularDataMesSubsequenteUtil(t.competencia, 20, true);
        if (acao === 'ENTREGUE_NORMAL') {
          this._garantirGuiaPorConclusaoTarefa(t, 'DAE - eSocial Doméstico (Guia Única Mensal)', 20, false, vencDaeDom);
        } else if (acao === 'SEM_MOVIMENTO') {
          this._removerGuiasPendentesPorFiltro(g => g.empresa_id === t.empresa_id && g.competencia === t.competencia && String(g.tipo_guia || '').toLowerCase().includes('doméstic'));
        }
      }

      this.sincronizarSolicitacaoPortalComTarefa(t);
      if (!opcoes.skipSave) {
        this.saveLocalData();
        this.registrarLog('ETAPA_TAREFA', 'Tarefas', `Etapa "${t.titulo}" marcada como ${acao}${t.motivo_pendencia ? ' — Motivo: ' + t.motivo_pendencia : ''} (${t.competencia}).`);
      }
      return t;
    }

    atualizarTarefasEmLote(tarefaIds = [], acao = 'PENDENTE', motivoOuObs = null) {
      const idsUnicos = Array.from(new Set((tarefaIds || []).filter(Boolean)));
      if (idsUnicos.length === 0) return { atualizadas: 0, ignoradas: 0 };

      let atualizadas = 0;
      let ignoradas = 0;
      idsUnicos.forEach(id => {
        try {
          this.marcarEtapaTarefa(id, acao, motivoOuObs, { skipSave: true });
          atualizadas++;
        } catch (_) {
          ignoradas++;
        }
      });

      if (atualizadas > 0) {
        this.saveLocalData();
        this.registrarLog(
          'ETAPA_TAREFA_LOTE',
          'Tarefas',
          `Lote de ${atualizadas} tarefa(s) atualizado para ${acao}${motivoOuObs ? ` — Motivo/Obs: "${motivoOuObs}"` : ''}.`
        );
      }
      return { atualizadas, ignoradas };
    }

    _removerGuiasPendentesPorFiltro(predicado) {
      if (!Array.isArray(this.data.guias_impostos)) return;
      this.data.guias_impostos = this.data.guias_impostos.filter(g => {
        const aindaPendente = g.status_envio === 'PENDENTE_GERACAO' || g.status_envio === 'GERADA_AGUARDANDO_ENVIO' || g.status_envio === 'PENDENTE_ENVIO';
        return !(predicado(g) && aindaPendente);
      });
    }

    _garantirGuiaPorConclusaoTarefa(tarefa, tipoGuia, dia = 20, segundoMesSubsequente = false, dataVencimentoCustom = null) {
      if (!Array.isArray(this.data.guias_impostos)) this.data.guias_impostos = [];
      const existente = this.data.guias_impostos.find(
        g => g.empresa_id === tarefa.empresa_id && g.competencia === tarefa.competencia && g.tipo_guia === tipoGuia
      );
      const vencimento = dataVencimentoCustom || (segundoMesSubsequente
        ? this.calcularDataSegundoMesSubsequente(tarefa.competencia, dia)
        : this.calcularDataMesSubsequente(tarefa.competencia, dia));

      if (existente) {
        if (existente.status_envio === 'PENDENTE_GERACAO') {
          existente.status_envio = 'GERADA_AGUARDANDO_ENVIO';
        }
        existente.data_vencimento = vencimento;
        existente.segundo_mes_subsequente = Boolean(segundoMesSubsequente);
        return existente;
      }

      const nova = {
        id: `gimp-auto-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        empresa_id: tarefa.empresa_id,
        competencia: tarefa.competencia,
        tipo_guia: tipoGuia,
        departamento: tarefa.departamento || 'FISCAL',
        valor: 0.00,
        data_vencimento: vencimento,
        segundo_mes_subsequente: Boolean(segundoMesSubsequente),
        status_envio: 'GERADA_AGUARDANDO_ENVIO',
        data_envio: null,
        canal_envio: '',
        protocolo_id: null,
        protocolo_codigo: null,
        responsavel_nome: tarefa.responsavel_nome || (this.getCurrentUser()?.nome || 'Equipe Fiscal'),
        observacoes: segundoMesSubsequente ? 'ICMS com vencimento no 2º mês subsequente.' : ''
      };
      this.data.guias_impostos.unshift(nova);
      return nova;
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
      if (statusEscolhido === 'AGUARDANDO_DOCS') {
        return 'AGUARDANDO_DOCS';
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
      if (tarefa.status === 'AGUARDANDO_DOCS') {
        return 'AGUARDANDO_DOCS';
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
        tarefa.motivo_pendencia = '';
        tarefa.status = 'CONFERIDO';
      } else if (opcaoStatus === 'ENTREGUE' || opcaoStatus === 'ENTREGUE_NO_PRAZO' || opcaoStatus === 'ENTREGUE_COM_ATRASO') {
        const dt = dataEntregaEfetiva || tarefa.data_entrega || hoje;
        tarefa.data_entrega = dt;
        tarefa.motivo_pendencia = '';
        tarefa.status = dt <= (tarefa.prazo_entrega || dt) ? 'ENTREGUE_NO_PRAZO' : 'ENTREGUE_COM_ATRASO';
      } else if (opcaoStatus === 'EM_ANDAMENTO') {
        tarefa.data_entrega = null;
        tarefa.motivo_pendencia = '';
        tarefa.status = 'EM_ANDAMENTO';
      } else if (opcaoStatus === 'AGUARDANDO_DOCS') {
        tarefa.data_entrega = null;
        tarefa.motivo_pendencia = '';
        tarefa.status = 'AGUARDANDO_DOCS';
      } else if (opcaoStatus === 'PENDENTE') {
        tarefa.data_entrega = null;
        tarefa.status = 'PENDENTE';
        if (observacao !== undefined && observacao !== null) {
          tarefa.motivo_pendencia = String(observacao).trim();
        }
      } else {
        tarefa.data_entrega = null;
        tarefa.motivo_pendencia = '';
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
        const temIE = this.empresaPossuiIE(emp);
        const compMes = (competencia || '').split('/')[0];

        modelos.forEach(mod => {
          const regimes = Array.isArray(mod.regimes_aplicaveis) ? mod.regimes_aplicaveis : ['Simples Nacional'];
          if (!regimes.includes(emp.regime_tributario)) return;

          // Regra de Inscrição Estadual (ICMS, DeSTDA, EFD-ICMS/IPI)
          if (mod.requer_ie && !temIE) return;

          // Regra de Periodicidade Trimestral (Março=03, Junho=06, Setembro=09, Dezembro=12)
          if (mod.periodicidade === 'TRIMESTRAL') {
            if (!['03', '06', '09', '12'].includes(compMes)) return;
          }

          // Regra de Periodicidade Anual (ex: ECD Junho, ECF Julho)
          if (mod.periodicidade === 'ANUAL') {
            const mesAlvo = String(mod.mes_entrega || '06').padStart(2, '0');
            if (compMes !== mesAlvo && sub.mes !== mesAlvo) return;
          }

          // Regra de separação Pró-Labore vs Funcionários CLT:
          if ((mod.requer_funcionarios || mod.exige_funcionarios) && !temFuncionarios) return;
          if (mod.requer_pro_labore && !temProLabore && !temFuncionarios) return;

          const tipoTarefa = mod.periodicidade === 'ANUAL' ? 'ANUAL' : (mod.periodicidade === 'TRIMESTRAL' ? 'TRIMESTRAL' : 'MENSAL');
          const jaExiste = this.data.tarefas.some(
            t => t.empresa_id === emp.id &&
                 t.competencia === competencia &&
                 t.titulo === mod.titulo &&
                 ['MENSAL', 'TRIMESTRAL', 'ANUAL'].includes(t.tipo)
          );

          if (!jaExiste) {
            const titModLower = String(mod.titulo || '').toLowerCase();
            const ehPresumidoOuReal = ['Lucro Presumido', 'Lucro Real'].includes(emp.regime_tributario);
            const ehIrpjMod = titModLower.includes('irpj') || titModLower.includes('csll');
            const ehIssMod = /\biss\b|\bissqn\b/i.test(titModLower);
            const deveAntecipar = Boolean(
              mod.antecipar_dia_util || ehIssMod ||
              (ehPresumidoOuReal && (ehIrpjMod || ((titModLower.includes('icms') || titModLower.includes('pis') || titModLower.includes('cofins')) && !titModLower.startsWith('transmissão efd') && !titModLower.startsWith('transmissao efd'))))
            );
            const diaPrazoEfetivo = ehIssMod ? this.obterDiaVencimentoIssEmpresa(emp) : mod.dia_prazo_padrao;
            const prazoBruto = this.calcularDataMesSubsequente(competencia, diaPrazoEfetivo);
            const prazoData = deveAntecipar ? this.anteciparParaDiaUtil(prazoBruto, ehIrpjMod) : prazoBruto;
            const colabSetor = this.data.profiles.find(p => p.departamento === mod.departamento && p.ativo);

            this.data.tarefas.push({
              id: `tar-gen-${Date.now()}-${criadas}-${Math.random().toString(36).slice(2, 5)}`,
              empresa_id: emp.id,
              competencia,
              departamento: mod.departamento,
              tipo: tipoTarefa,
              titulo: mod.titulo,
              descricao: mod.descricao,
              solicitante: mod.periodicidade === 'ANUAL' ? 'Rotina Anual Automática' : (mod.periodicidade === 'TRIMESTRAL' ? 'Rotina Trimestral Automática' : 'Rotina Mensal Automática'),
              prazo_entrega: prazoData,
              data_entrega: null,
              modalidade_entrega: null,
              status: 'NAO_INICIADA',
              responsavel_nome: colabSetor ? colabSetor.nome : 'Luis Filipe (Zioto Contabilidade)',
              protocolo_observacao: ''
            });
            criadas++;
          }
        });
      });


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

    getGuiasParaEntregaNaCompetencia(competencia) {
      if (!Array.isArray(this.data.guias_impostos)) this.data.guias_impostos = [];
      if (!competencia) return this.data.guias_impostos;
      const sub = this.obterMesSubsequente(competencia);
      const prefixoEntrega = `${sub.ano}-${sub.mesFormatado}`;
      const compEntrega = `${sub.mesFormatado}/${sub.ano}`;

      return this.data.guias_impostos.filter(g => {
        if (g.data_vencimento && g.data_vencimento.startsWith(prefixoEntrega)) return true;
        if (g.competencia_entrega === compEntrega) return true;
        if (!g.data_vencimento && g.competencia === competencia) return true;
        return false;
      });
    }

    salvarApuracaoICMSEmAndamento(tarefaId, tiposSelecionados = [], semMovimento = false, dataVencimentoCustom = null) {
      const idx = (this.data.tarefas || []).findIndex(t => t.id === tarefaId);
      if (idx === -1) throw new Error('Tarefa não encontrada.');
      const t = this.data.tarefas[idx];
      const user = this.getCurrentUser();
      if (!this.canManageDepartment(t.departamento, user)) {
        throw new Error(`Política de Segurança (RLS): Seu perfil (${user?.departamento}) não tem permissão para alterar tarefas do departamento ${t.departamento}.`);
      }

      const emp = this.obterEmpresaSegura(t.empresa_id, t);
      const ehPresumidoReal = Boolean(emp && ['Lucro Presumido', 'Lucro Real'].includes(emp.regime_tributario));
      const tipos = semMovimento ? [] : (Array.isArray(tiposSelecionados) ? tiposSelecionados.filter(Boolean) : []);
      const ehSemMov = Boolean(semMovimento || tipos.length === 0);
      const vencPadrao = ehPresumidoReal
        ? this.calcularDataMesSubsequenteUtil(t.competencia, 8, true)
        : this.calcularDataSegundoMesSubsequente(t.competencia, 18);
      const vencPrevisto = dataVencimentoCustom || vencPadrao;

      t.status = 'EM_ANDAMENTO';
      t.data_entrega = null;
      t.modalidade_entrega = null;
      t.icms_apuracao_definida = true;
      t.icms_sem_movimento = ehSemMov;
      t.icms_apuracao_tipos = tipos;
      t.icms_vencimento_previsto = vencPrevisto;
      t.protocolo_observacao = ehSemMov
        ? 'Apurado: Sem Movimento (pronto p/ transmitir)'
        : `Apurado p/ transmitir: ${tipos.join(', ')} (Venc. ${vencPrevisto.split('-').reverse().join('/')})`;
      if (user) t.responsavel_nome = user.nome;

      this.saveLocalData();
      this.registrarLog('APURACAO_ICMS_ANDAMENTO', 'Tarefas', `Apuração ICMS salva em andamento (${t.competencia}): ${t.protocolo_observacao}`);
      return t;
    }

    registrarConclusaoApuracaoICMS(tarefaId, tiposSelecionados = [], dataVencimentoCustom = null, valoresPorTipo = {}) {
      const idx = (this.data.tarefas || []).findIndex(t => t.id === tarefaId);
      if (idx === -1) throw new Error('Tarefa não encontrada.');
      const t = this.data.tarefas[idx];
      const user = this.getCurrentUser();
      if (!this.canManageDepartment(t.departamento, user)) {
        throw new Error(`Política de Segurança (RLS): Seu perfil (${user?.departamento}) não tem permissão para alterar tarefas do departamento ${t.departamento}.`);
      }

      const emp = this.obterEmpresaSegura(t.empresa_id, t);
      const ehPresumidoReal = Boolean(emp && ['Lucro Presumido', 'Lucro Real'].includes(emp.regime_tributario));
      const tipos = Array.isArray(tiposSelecionados) ? tiposSelecionados.filter(Boolean) : [];
      const hoje = new Date().toISOString().slice(0, 10);

      // Remove guias ICMS ainda pendentes desta tarefa/competência antes de recriar os tipos exatos
      if (Array.isArray(this.data.guias_impostos)) {
        this.data.guias_impostos = this.data.guias_impostos.filter(g => {
          const ehIcmsEmpComp = g.empresa_id === t.empresa_id && g.competencia === t.competencia && (g.tipo_guia || '').toLowerCase().includes('icms');
          const pendente = !['IMPRESSA_OFFICE_BOY', 'ENVIADA_WHATSAPP', 'ENVIADA_EMAIL', 'ARQUIVADA_ASSINADA', 'ENVIADA_CLIENTE', 'VISUALIZADA_CLIENTE'].includes(g.status_envio);
          return !(ehIcmsEmpComp && pendente);
        });
      } else {
        this.data.guias_impostos = [];
      }

      if (tipos.length === 0) {
        t.data_entrega = hoje;
        t.modalidade_entrega = 'SEM_MOVIMENTO';
        t.icms_apuracao_definida = true;
        t.icms_sem_movimento = true;
        t.icms_apuracao_tipos = [];
        t.status = this.calcularStatusTarefa(t.prazo_entrega, hoje, 'ENTREGUE');
        t.protocolo_observacao = ehPresumidoReal ? 'ICMS mensal encerrado Sem Movimento.' : 'DeSTDA / ICMS transmitida Sem Movimento.';
        if (user) t.responsavel_nome = user.nome;
        this.saveLocalData();
        this.registrarLog('APURACAO_ICMS_SEM_MOV', 'Tarefas/Guias', `ICMS concluído Sem Movimento (${t.competencia}).`);
        return { tarefa: t, guiasCriadas: 0 };
      }

      t.data_entrega = hoje;
      t.modalidade_entrega = 'NORMAL';
      t.icms_apuracao_definida = true;
      t.icms_sem_movimento = false;
      t.icms_apuracao_tipos = [...tipos];
      t.status = this.calcularStatusTarefa(t.prazo_entrega, hoje, 'ENTREGUE');

      const sub1 = this.obterMesSubsequente(t.competencia);
      const sub2 = this.obterMesSubsequente(`${sub1.mesFormatado}/${sub1.ano}`);
      const vencimentoFinal = dataVencimentoCustom || (ehPresumidoReal
        ? this.calcularDataMesSubsequenteUtil(t.competencia, 8, true)
        : this.calcularDataSegundoMesSubsequente(t.competencia, 18));
      const compEntrega = ehPresumidoReal
        ? `${sub1.mesFormatado}/${sub1.ano}`
        : `${sub2.mesFormatado}/${sub2.ano}`;

      t.protocolo_observacao = `Com movimento: ${tipos.join(', ')} (Venc. ${vencimentoFinal.split('-').reverse().join('/')})`;
      if (user) t.responsavel_nome = user.nome;

      let criadas = 0;
      tipos.forEach(tipoNome => {
        const jaEnviada = this.data.guias_impostos.some(
          g => g.empresa_id === t.empresa_id && g.competencia === t.competencia && g.tipo_guia === tipoNome
        );
        if (!jaEnviada) {
          this.data.guias_impostos.unshift({
            id: `gimp-icms-${Date.now()}-${criadas}-${Math.random().toString(36).slice(2, 5)}`,
            empresa_id: t.empresa_id,
            competencia: t.competencia,
            competencia_entrega: compEntrega,
            tipo_guia: tipoNome,
            departamento: 'FISCAL',
            valor: Number((valoresPorTipo && valoresPorTipo[tipoNome]) || 0),
            data_vencimento: vencimentoFinal,
            segundo_mes_subsequente: !ehPresumidoReal,
            status_envio: 'GERADA_AGUARDANDO_ENVIO',
            data_envio: null,
            canal_envio: '',
            protocolo_id: null,
            protocolo_codigo: null,
            responsavel_nome: t.responsavel_nome || (user ? user.nome : 'Equipe Fiscal'),
            observacoes: ehPresumidoReal
              ? `ICMS mensal ref. ${t.competencia} (vencimento no mês subsequente, antecipado se não útil).`
              : `Ref. apuração ${t.competencia} (vencimento no 2º mês subsequente).`
          });
          criadas++;
        }
      });

      this.saveLocalData();
      this.registrarLog('APURACAO_ICMS_COM_MOV', 'Tarefas/Guias', `ICMS concluído com movimento (${tipos.join(', ')}) para comp. ${t.competencia}, vencimento ${vencimentoFinal}.`);
      return { tarefa: t, guiasCriadas: criadas };
    }

    // =========================================================================
    // APURAÇÃO MENSAL DE PIS E COFINS (LUCRO PRESUMIDO / REAL -> PROTOCOLO)
    // =========================================================================
    salvarApuracaoPisCofins(tarefaId, opcoes = {}) {
      const idx = (this.data.tarefas || []).findIndex(t => t.id === tarefaId);
      if (idx === -1) throw new Error('Tarefa não encontrada.');
      const t = this.data.tarefas[idx];
      const user = this.getCurrentUser();
      if (!this.canManageDepartment(t.departamento, user)) {
        throw new Error(`Política de Segurança (RLS): Seu perfil (${user?.departamento}) não tem permissão para alterar tarefas do departamento ${t.departamento}.`);
      }

      const modo = opcoes.modo === 'EM_ANDAMENTO' ? 'EM_ANDAMENTO' : 'TRANSMITIR';
      const tributos = opcoes.semMovimento ? [] : (Array.isArray(opcoes.tributos) ? opcoes.tributos.filter(Boolean) : ['DARF - PIS', 'DARF - COFINS']);
      const ehSemMov = Boolean(opcoes.semMovimento || tributos.length === 0);
      const vencimentoFinal = opcoes.dataVencimento || this.calcularDataMesSubsequenteUtil(t.competencia, 25, true);
      const valores = opcoes.valores || {};
      const hoje = new Date().toISOString().slice(0, 10);

      t.piscofins_apuracao_definida = true;
      t.piscofins_sem_movimento = ehSemMov;
      t.piscofins_tributos = [...tributos];
      t.piscofins_valores = { ...valores };
      t.piscofins_vencimento_previsto = vencimentoFinal;
      if (user) t.responsavel_nome = user.nome;

      if (modo === 'EM_ANDAMENTO') {
        t.status = 'EM_ANDAMENTO';
        t.data_entrega = null;
        t.modalidade_entrega = null;
        t.protocolo_observacao = ehSemMov
          ? 'PIS/COFINS apurado Sem Movimento / Retido (pronto p/ concluir)'
          : `PIS/COFINS apurado: ${tributos.join(' + ')} (Venc. ${vencimentoFinal.split('-').reverse().join('/')})`;
        this.saveLocalData();
        this.registrarLog('APURACAO_PISCOFINS_ANDAMENTO', 'Tarefas', `PIS/COFINS em andamento (${t.competencia}): ${t.protocolo_observacao}`);
        return { tarefa: t, guiasCriadas: 0 };
      }

      // Remove guias PIS/COFINS ainda pendentes desta competência antes de recriar
      this._removerGuiasPendentesPorFiltro(
        g => g.empresa_id === t.empresa_id && g.competencia === t.competencia &&
        (String(g.tipo_guia || '').includes('PIS') || String(g.tipo_guia || '').includes('COFINS'))
      );

      if (ehSemMov) {
        t.data_entrega = hoje;
        t.modalidade_entrega = 'SEM_MOVIMENTO';
        t.status = this.calcularStatusTarefa(t.prazo_entrega, hoje, 'ENTREGUE');
        t.protocolo_observacao = 'PIS/COFINS concluído Sem Valor a Recolher / Retido.';
        this.saveLocalData();
        this.registrarLog('APURACAO_PISCOFINS_SEM_MOV', 'Tarefas/Guias', `PIS/COFINS concluído sem guia a recolher (${t.competencia}).`);
        return { tarefa: t, guiasCriadas: 0 };
      }

      t.data_entrega = hoje;
      t.modalidade_entrega = 'NORMAL';
      t.status = this.calcularStatusTarefa(t.prazo_entrega, hoje, 'ENTREGUE');
      t.protocolo_observacao = `Apurado: ${tributos.join(' + ')} (Venc. ${vencimentoFinal.split('-').reverse().join('/')})`;

      const sub1 = this.obterMesSubsequente(t.competencia);
      let criadas = 0;
      if (!Array.isArray(this.data.guias_impostos)) this.data.guias_impostos = [];

      tributos.forEach(tipoNome => {
        const jaEnviada = this.data.guias_impostos.some(
          g => g.empresa_id === t.empresa_id && g.competencia === t.competencia && g.tipo_guia === tipoNome
        );
        if (!jaEnviada) {
          this.data.guias_impostos.unshift({
            id: `gimp-piscof-${Date.now()}-${criadas}-${Math.random().toString(36).slice(2, 5)}`,
            empresa_id: t.empresa_id,
            competencia: t.competencia,
            competencia_entrega: sub1.label,
            tipo_guia: tipoNome,
            departamento: 'FISCAL',
            valor: Number(valores[tipoNome] || 0),
            data_vencimento: vencimentoFinal,
            segundo_mes_subsequente: false,
            status_envio: 'GERADA_AGUARDANDO_ENVIO',
            data_envio: null,
            canal_envio: '',
            protocolo_id: null,
            protocolo_codigo: null,
            responsavel_nome: t.responsavel_nome || (user ? user.nome : 'Equipe Fiscal'),
            observacoes: `Ref. apuração mensal ${t.competencia}.`
          });
          criadas++;
        }
      });

      this.saveLocalData();
      this.registrarLog('APURACAO_PISCOFINS_CONCLUIDA', 'Tarefas/Guias', `PIS/COFINS (${t.competencia}) concluído com ${criadas} guia(s) gerada(s) no Protocolo.`);
      return { tarefa: t, guiasCriadas: criadas };
    }

    // =========================================================================
    // APURAÇÃO MENSAL DE ISS MUNICIPAL (PRÓPRIO E/OU RETIDO — DIA 10 OU 20)
    // =========================================================================
    salvarApuracaoIssMunicipal(tarefaId, opcoes = {}) {
      const idx = (this.data.tarefas || []).findIndex(t => t.id === tarefaId);
      if (idx === -1) throw new Error('Tarefa não encontrada.');
      const t = this.data.tarefas[idx];
      const user = this.getCurrentUser();
      if (!this.canManageDepartment(t.departamento, user)) {
        throw new Error(`Política de Segurança (RLS): Seu perfil (${user?.departamento}) não tem permissão para alterar tarefas do departamento ${t.departamento}.`);
      }

      const emp = this.obterEmpresaSegura(t.empresa_id, t);
      const diaEscolhido = [10, 20].includes(Number(opcoes.diaMunicipio))
        ? Number(opcoes.diaMunicipio)
        : this.obterDiaVencimentoIssEmpresa(emp);

      // Memoriza o dia de vencimento do ISS (10 ou 20) para a empresa e opcionalmente para o município
      if (emp) {
        emp.dia_vencimento_iss = diaEscolhido;
        if (opcoes.lembrarMunicipio && emp.municipio_uf) {
          if (!this.data.escritorio) this.data.escritorio = {};
          if (!this.data.escritorio.vencimento_iss_por_municipio) {
            this.data.escritorio.vencimento_iss_por_municipio = {};
          }
          const chaveMun = String(emp.municipio_uf).trim().toUpperCase();
          this.data.escritorio.vencimento_iss_por_municipio[chaveMun] = diaEscolhido;

          // Atualiza o prazo das tarefas de ISS ainda abertas do mesmo município
          (this.data.tarefas || []).forEach(outra => {
            if (!outra || outra.data_entrega || !/\biss\b|\bissqn\b/i.test(String(outra.titulo || ''))) return;
            const empOutra = this.obterEmpresaSegura(outra.empresa_id, outra);
            if (empOutra && String(empOutra.municipio_uf || '').trim().toUpperCase() === chaveMun) {
              outra.prazo_entrega = this.calcularDataMesSubsequenteUtil(outra.competencia, diaEscolhido, true);
            }
          });
        } else {
          t.prazo_entrega = this.calcularDataMesSubsequenteUtil(t.competencia, diaEscolhido, true);
        }
      }

      const modo = opcoes.modo === 'EM_ANDAMENTO' ? 'EM_ANDAMENTO' : 'TRANSMITIR';
      const tributos = opcoes.semMovimento
        ? []
        : (Array.isArray(opcoes.tributos) ? opcoes.tributos.filter(Boolean) : ['DAM / Guia ISS Próprio (Serviços Prestados)']);
      const ehSemMov = Boolean(opcoes.semMovimento || tributos.length === 0);
      const vencimentoFinal = opcoes.dataVencimento || this.calcularDataMesSubsequenteUtil(t.competencia, diaEscolhido, true);
      const valores = opcoes.valores || {};
      const hoje = new Date().toISOString().slice(0, 10);

      t.iss_apuracao_definida = true;
      t.iss_sem_movimento = ehSemMov;
      t.iss_dia_municipio = diaEscolhido;
      t.iss_tributos = [...tributos];
      t.iss_valores = { ...valores };
      t.iss_vencimento_previsto = vencimentoFinal;
      if (user) t.responsavel_nome = user.nome;

      if (modo === 'EM_ANDAMENTO') {
        t.status = 'EM_ANDAMENTO';
        t.data_entrega = null;
        t.modalidade_entrega = null;
        t.protocolo_observacao = ehSemMov
          ? 'ISS apurado Sem Movimento (pronto p/ concluir)'
          : `ISS apurado (Dia ${diaEscolhido}): ${tributos.map(x => x.includes('Retido') ? 'ISS Retido' : 'ISS Próprio').join(' + ')} (Venc. ${vencimentoFinal.split('-').reverse().join('/')})`;
        this.saveLocalData();
        this.registrarLog('APURACAO_ISS_ANDAMENTO', 'Tarefas', `ISS em andamento (${t.competencia}): ${t.protocolo_observacao}`);
        return { tarefa: t, guiasCriadas: 0 };
      }

      // Remove guias ISS pendentes desta competência antes de recriar
      this._removerGuiasPendentesPorFiltro(
        g => g.empresa_id === t.empresa_id && g.competencia === t.competencia && /\bISS\b/i.test(String(g.tipo_guia || ''))
      );

      if (ehSemMov) {
        t.data_entrega = hoje;
        t.modalidade_entrega = 'SEM_MOVIMENTO';
        t.status = this.calcularStatusTarefa(t.prazo_entrega, hoje, 'ENTREGUE');
        t.protocolo_observacao = 'ISS Municipal encerrado Sem Movimento.';
        this.saveLocalData();
        this.registrarLog('APURACAO_ISS_SEM_MOV', 'Tarefas/Guias', `ISS Municipal concluído Sem Movimento (${t.competencia}).`);
        return { tarefa: t, guiasCriadas: 0 };
      }

      t.data_entrega = hoje;
      t.modalidade_entrega = 'NORMAL';
      t.status = this.calcularStatusTarefa(t.prazo_entrega, hoje, 'ENTREGUE');
      t.protocolo_observacao = `Apurado: ${tributos.map(x => x.includes('Retido') ? 'ISS Retido' : 'ISS Próprio').join(' + ')} (Venc. ${vencimentoFinal.split('-').reverse().join('/')})`;

      const sub1 = this.obterMesSubsequente(t.competencia);
      if (!Array.isArray(this.data.guias_impostos)) this.data.guias_impostos = [];
      let criadas = 0;

      tributos.forEach(tipoNome => {
        const jaEnviada = this.data.guias_impostos.some(
          g => g.empresa_id === t.empresa_id && g.competencia === t.competencia && g.tipo_guia === tipoNome
        );
        if (!jaEnviada) {
          this.data.guias_impostos.unshift({
            id: `gimp-iss-${Date.now()}-${criadas}-${Math.random().toString(36).slice(2, 5)}`,
            empresa_id: t.empresa_id,
            competencia: t.competencia,
            competencia_entrega: sub1.label,
            tipo_guia: tipoNome,
            departamento: 'FISCAL',
            valor: Number(valores[tipoNome] || 0),
            data_vencimento: vencimentoFinal,
            segundo_mes_subsequente: false,
            status_envio: 'GERADA_AGUARDANDO_ENVIO',
            data_envio: null,
            canal_envio: '',
            protocolo_id: null,
            protocolo_codigo: null,
            responsavel_nome: t.responsavel_nome || (user ? user.nome : 'Equipe Fiscal'),
            observacoes: `ISS Municipal (${emp?.municipio_uf || 'Prefeitura'}) ref. ${t.competencia} — Venc. padrão dia ${diaEscolhido}.`
          });
          criadas++;
        }
      });

      this.saveLocalData();
      this.registrarLog('APURACAO_ISS_CONCLUIDA', 'Tarefas/Guias', `ISS Municipal (${t.competencia}) concluído com ${criadas} guia(s) gerada(s) no Protocolo.`);
      return { tarefa: t, guiasCriadas: criadas };
    }

    // =========================================================================
    // APURAÇÃO TRIMESTRAL DE IRPJ E CSLL (ATÉ 3 QUOTAS -> PROTOCOLO POR MÊS)
    // =========================================================================
    salvarApuracaoIrpjCsllTrimestral(opcoes = {}) {
      const user = this.getCurrentUser();
      if (!this.canManageDepartment('FISCAL', user)) {
        throw new Error(`Política de Segurança (RLS): Seu perfil (${user?.departamento}) não tem permissão para apurar IRPJ/CSLL.`);
      }

      const tarefa = opcoes.tarefaId
        ? (this.data.tarefas || []).find(item => item.id === opcoes.tarefaId)
        : null;
      const empresaId = opcoes.empresaId || (tarefa ? tarefa.empresa_id : '');
      if (!empresaId) throw new Error('Selecione a empresa para apurar IRPJ/CSLL.');

      const trimestre = Math.min(4, Math.max(1, parseInt(opcoes.trimestre, 10) || 3));
      const ano = parseInt(opcoes.ano, 10) || 2026;
      const qtdQuotas = Math.min(3, Math.max(1, parseInt(opcoes.qtdQuotas, 10) || 1));
      const compFechamento = `${String(trimestre * 3).padStart(2, '0')}/${ano}`;
      const siglaTrim = `${trimestre}T/${ano}`;
      const labelTrim = `${trimestre}º Trim/${ano}`;
      const modo = opcoes.modo === 'EM_ANDAMENTO' ? 'EM_ANDAMENTO' : 'TRANSMITIR';
      const tributos = opcoes.semMovimento ? [] : (Array.isArray(opcoes.tributos) ? opcoes.tributos.filter(Boolean) : ['IRPJ', 'CSLL']);
      const ehSemMov = Boolean(opcoes.semMovimento || tributos.length === 0);
      const hoje = new Date().toISOString().slice(0, 10);

      const datasPadrao = this.calcularDatasQuotasTrimestre(trimestre, ano, qtdQuotas);
      const quotasLista = datasPadrao.map((dp, i) => {
        const custom = Array.isArray(opcoes.quotasConfig) ? opcoes.quotasConfig[i] : null;
        return {
          quota: dp.quota,
          ativa: custom && custom.ativa !== undefined ? Boolean(custom.ativa) : true,
          data_vencimento: (custom && custom.data_vencimento) ? custom.data_vencimento : dp.data_vencimento,
          valor_irpj: Number((custom && custom.valor_irpj) || 0),
          valor_csll: Number((custom && custom.valor_csll) || 0)
        };
      });

      // Se existir tarefa trimestral correspondente (mesmo quando aberto pelo atalho do Protocolo), sincroniza-a também
      const tarefaAlvo = tarefa || (this.data.tarefas || []).find(
        item => item.empresa_id === empresaId && item.competencia === compFechamento &&
        (String(item.titulo || '').toLowerCase().includes('irpj') || String(item.titulo || '').toLowerCase().includes('csll'))
      );

      if (tarefaAlvo) {
        tarefaAlvo.irpj_apuracao_definida = true;
        tarefaAlvo.irpj_sem_movimento = ehSemMov;
        tarefaAlvo.irpj_config = { trimestre, ano, qtdQuotas, tributos, quotasLista };
        if (user) tarefaAlvo.responsavel_nome = user.nome;
      }

      if (modo === 'EM_ANDAMENTO' && tarefaAlvo) {
        tarefaAlvo.status = 'EM_ANDAMENTO';
        tarefaAlvo.data_entrega = null;
        tarefaAlvo.modalidade_entrega = null;
        tarefaAlvo.protocolo_observacao = ehSemMov
          ? `IRPJ/CSLL ${labelTrim} sem movimento / prejuízo (em andamento)`
          : `IRPJ/CSLL ${labelTrim}: ${tributos.join('+')} em ${qtdQuotas} quota(s) (${quotasLista.filter(q => q.ativa).map(q => q.data_vencimento.slice(5).split('-').reverse().join('/')).join(', ')})`;
        this.saveLocalData();
        this.registrarLog('APURACAO_IRPJ_ANDAMENTO', 'Tarefas', `${tarefaAlvo.protocolo_observacao}`);
        return { tarefa: tarefaAlvo, guiasCriadas: 0 };
      }

      // Remove guias pendentes anteriores deste mesmo trimestre/empresa antes de recriar as quotas
      this._removerGuiasPendentesPorFiltro(
        g => g.empresa_id === empresaId &&
        (g.trimestre_ref === siglaTrim || (g.competencia === compFechamento && (String(g.tipo_guia || '').includes('IRPJ') || String(g.tipo_guia || '').includes('CSLL'))))
      );

      if (ehSemMov) {
        if (tarefaAlvo) {
          tarefaAlvo.data_entrega = hoje;
          tarefaAlvo.modalidade_entrega = 'SEM_MOVIMENTO';
          tarefaAlvo.status = this.calcularStatusTarefa(tarefaAlvo.prazo_entrega, hoje, 'ENTREGUE');
          tarefaAlvo.protocolo_observacao = `IRPJ/CSLL ${labelTrim} encerrado Sem Valor a Recolher / Prejuízo.`;
        }
        this.saveLocalData();
        this.registrarLog('APURACAO_IRPJ_SEM_MOV', 'Tarefas/Guias', `IRPJ/CSLL (${labelTrim}) concluído sem guias a recolher.`);
        return { tarefa: tarefaAlvo, guiasCriadas: 0 };
      }

      if (tarefaAlvo) {
        tarefaAlvo.data_entrega = hoje;
        tarefaAlvo.modalidade_entrega = 'NORMAL';
        tarefaAlvo.status = this.calcularStatusTarefa(tarefaAlvo.prazo_entrega, hoje, 'ENTREGUE');
        tarefaAlvo.protocolo_observacao = `Apurado ${labelTrim}: ${tributos.join(' + ')} em ${qtdQuotas} quota(s) (${quotasLista.filter(q => q.ativa).map(q => q.data_vencimento.split('-').reverse().join('/')).join(', ')})`;
      }

      if (!Array.isArray(this.data.guias_impostos)) this.data.guias_impostos = [];
      let criadas = 0;

      quotasLista.filter(q => q.ativa).forEach(qItem => {
        const dtParts = String(qItem.data_vencimento || '').split('-');
        const compEntrega = dtParts.length === 3 ? `${dtParts[1]}/${dtParts[0]}` : '';

        tributos.forEach(trib => {
          const descQuota = qtdQuotas === 1
            ? `Quota Única - ${labelTrim}`
            : `${qItem.quota}ª/${qtdQuotas} Quota - ${labelTrim}`;
          const tipoGuia = `DARF - ${trib} (${descQuota})`;
          const valorGuia = trib === 'IRPJ' ? qItem.valor_irpj : qItem.valor_csll;

          const jaEnviada = this.data.guias_impostos.some(
            g => g.empresa_id === empresaId && g.trimestre_ref === siglaTrim && g.numero_quota === qItem.quota && String(g.tipo_guia || '').startsWith(`DARF - ${trib}`)
          );
          if (!jaEnviada) {
            this.data.guias_impostos.unshift({
              id: `gimp-irpj-${Date.now()}-${criadas}-${Math.random().toString(36).slice(2, 5)}`,
              empresa_id: empresaId,
              competencia: compFechamento,
              competencia_entrega: compEntrega,
              trimestre_ref: siglaTrim,
              numero_quota: qItem.quota,
              total_quotas: qtdQuotas,
              tipo_guia: tipoGuia,
              departamento: 'FISCAL',
              valor: valorGuia,
              data_vencimento: qItem.data_vencimento,
              segundo_mes_subsequente: qItem.quota > 1,
              status_envio: 'GERADA_AGUARDANDO_ENVIO',
              data_envio: null,
              canal_envio: '',
              protocolo_id: null,
              protocolo_codigo: null,
              responsavel_nome: user ? user.nome : 'Equipe Fiscal',
              observacoes: qtdQuotas > 1
                ? `Apuração trimestral ${labelTrim} — Quota ${qItem.quota} de ${qtdQuotas}.`
                : `Apuração trimestral ${labelTrim} — Quota única.`
            });
            criadas++;
          }
        });
      });

      this.saveLocalData();
      const emp = this.obterEmpresaSegura(empresaId);
      this.registrarLog(
        'APURACAO_IRPJ_CSLL_QUOTAS',
        'Tarefas/Guias',
        `IRPJ/CSLL (${labelTrim}) de ${this.nomeEmpresaPrioritario(emp)} concluído em ${qtdQuotas} quota(s) — ${criadas} guia(s) gerada(s) no Protocolo.`
      );
      return { tarefa: tarefaAlvo, guiasCriadas: criadas, quotas: quotasLista };
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
      const tarefasComMov = (this.data.tarefas || []).filter(
        t => t.competencia === competencia && t.data_entrega && t.modalidade_entrega !== 'SEM_MOVIMENTO'
      );
      tarefasComMov.forEach(t => {
        const tit = (t.titulo || '').toLowerCase();
        if (tit.includes('pgdas') || tit.includes('guia das')) {
          const antes = this.data.guias_impostos.length;
          this._garantirGuiaPorConclusaoTarefa(t, 'DAS - Simples Nacional', 20, false);
          if (this.data.guias_impostos.length > antes) criadas++;
        }
      });
      if (criadas > 0) this.saveLocalData();
      return criadas;
    }

    getProtocolosGuias(competencia = null) {
      if (!Array.isArray(this.data.protocolos_guias)) this.data.protocolos_guias = [];
      let lista = [...this.data.protocolos_guias];
      if (competencia) lista = lista.filter(p => p.competencia === competencia);
      return lista.sort((a, b) => (b.data_geracao || '').localeCompare(a.data_geracao || ''));
    }

    gerarProtocoloLoteOfficeBoy(guiaIds, competencia, observacao = '') {
      if (!Array.isArray(guiaIds) || guiaIds.length === 0) {
        throw new Error('Selecione ao menos uma guia para gerar o protocolo do Office Boy.');
      }
      if (!Array.isArray(this.data.protocolos_guias)) this.data.protocolos_guias = [];
      const compLimpa = (competencia || '10/2026').replace('/', '');
      const seq = this.data.protocolos_guias.filter(p => p.competencia === competencia).length + 1;
      const codigo = `PROT-${compLimpa}-${String(seq).padStart(3, '0')}`;
      const user = this.getCurrentUser();
      const hoje = new Date().toISOString().slice(0, 10);

      const itensResumo = [];
      guiaIds.forEach(gid => {
        const g = (this.data.guias_impostos || []).find(item => item.id === gid);
        if (g) {
          g.status_envio = 'IMPRESSA_OFFICE_BOY';
          g.canal_envio = 'Office Boy (Impresso)';
          g.data_envio = hoje;
          g.protocolo_codigo = codigo;
          const emp = this.obterEmpresaSegura(g.empresa_id, g);
          itensResumo.push({
            guia_id: g.id,
            empresa_id: g.empresa_id,
            empresa_nome: this.nomeEmpresaPrioritario(emp, { fallbackObj: g }),
            razao_social: this.nomeEmpresaPrioritario(emp, { fallbackObj: g }),
            cnpj: emp ? emp.cnpj : '—',
            tipo_guia: g.tipo_guia,
            competencia_guia: g.competencia,
            data_vencimento: g.data_vencimento,
            segundo_mes_subsequente: Boolean(g.segundo_mes_subsequente)
          });
        }
      });

      const novoProt = {
        id: `prot-${Date.now()}`,
        codigo,
        competencia,
        tipo: 'OFFICE_BOY',
        guia_ids: [...guiaIds],
        itens: itensResumo,
        data_geracao: new Date().toISOString(),
        data_saida: hoje,
        responsavel_emissao: user ? user.nome : 'Escritório',
        status: 'EM_ROTA',
        data_arquivamento: null,
        observacao: (observacao || '').trim()
      };

      itensResumo.forEach(it => {
        const g = this.data.guias_impostos.find(x => x.id === it.guia_id);
        if (g) g.protocolo_id = novoProt.id;
      });

      this.data.protocolos_guias.unshift(novoProt);
      this.saveLocalData();
      this.registrarLog('PROTOCOLO_OFFICE_BOY', 'Guias/Protocolos', `Gerado protocolo ${codigo} com ${itensResumo.length} guia(s) para entrega via Office Boy.`);
      return novoProt;
    }

    registrarEnvioDigitalGuia(guiaIds, canal = 'WHATSAPP', dataEnvio = null, responsavelNome = null) {
      const ids = Array.isArray(guiaIds) ? guiaIds : [guiaIds];
      if (ids.length === 0) throw new Error('Nenhuma guia selecionada.');
      const user = this.getCurrentUser();
      const dtFinal = (dataEnvio || '').trim() || new Date().toISOString().slice(0, 10);
      const respFinal = (responsavelNome || '').trim() || (user ? user.nome : 'Escritório');
      const isEmail = canal === 'EMAIL';
      const nomeCanal = isEmail ? 'E-mail' : 'WhatsApp';

      let atualizadas = 0;
      const buscarGuia = (gid) => {
        const gImp = (this.data.guias_impostos || []).find(item => item.id === gid);
        if (gImp) return { ref: gImp, isParc: false };
        const rawParcId = String(gid || '').startsWith('pguia-prot-') ? String(gid).replace(/^pguia-prot-/, '') : gid;
        const gParc = (this.data.parcelamento_guias || []).find(item => item.id === rawParcId);
        if (gParc) return { ref: gParc, isParc: true };
        return null;
      };

      ids.forEach(gid => {
        const achado = buscarGuia(gid);
        if (achado && !achado.isParc) {
          const g = achado.ref;
          g.status_envio = 'ARQUIVADA_ASSINADA';
          g.arquivada_digital = true;
          g.canal_envio = nomeCanal;
          g.data_envio = dtFinal;
          g.data_arquivamento = dtFinal;
          g.enviado_por = respFinal;
          g.responsavel_nome = respFinal;
          atualizadas++;
        } else if (achado && achado.isParc) {
          const gp = achado.ref;
          gp.status_guia = 'ENVIADA_CLIENTE';
          gp.status_envio_protocolo = 'ARQUIVADA_ASSINADA';
          gp.arquivada_digital = true;
          gp.canal_envio = nomeCanal;
          gp.data_envio_cliente = dtFinal;
          gp.data_arquivamento = dtFinal;
          gp.enviado_por = respFinal;
          atualizadas++;
        }
      });

      if (atualizadas > 0) {
        this.saveLocalData();
        this.registrarLog('ENVIO_DIGITAL_GUIAS', 'Guias/Protocolos', `${atualizadas} guia(s) enviada(s) via ${nomeCanal} e arquivada(s) automaticamente.`);
      }
      return atualizadas;
    }

    arquivarProtocoloAssinado(protocoloId) {
      const prot = (this.data.protocolos_guias || []).find(p => p.id === protocoloId);
      if (!prot) throw new Error('Protocolo não encontrado.');
      const hoje = new Date().toISOString().slice(0, 10);
      prot.status = 'ARQUIVADO_ASSINADO';
      prot.data_arquivamento = hoje;

      (prot.guia_ids || []).forEach(gid => {
        const g = (this.data.guias_impostos || []).find(x => x.id === gid);
        if (g) {
          g.status_envio = 'ARQUIVADA_ASSINADA';
        }
      });

      this.saveLocalData();
      this.registrarLog('ARQUIVAMENTO_PROTOCOLO', 'Guias/Protocolos', `Protocolo ${prot.codigo} confirmado como assinado e arquivado.`);
      return prot;
    }

    excluirProtocoloOfficeBoy(protocoloId) {
      const prot = (this.data.protocolos_guias || []).find(p => p.id === protocoloId);
      if (!prot) throw new Error('Protocolo não encontrado.');

      // Restaura as guias vinculadas para GERADA_AGUARDANDO_ENVIO
      (prot.guia_ids || []).forEach(gid => {
        const g = (this.data.guias_impostos || []).find(x => x.id === gid);
        if (g && g.protocolo_id === protocoloId) {
          g.protocolo_id = null;
          g.protocolo_codigo = null;
          g.status_envio = 'GERADA_AGUARDANDO_ENVIO';
          g.canal_envio = '';
          g.data_envio = null;
        }
      });

      this.data.protocolos_guias = (this.data.protocolos_guias || []).filter(p => p.id !== protocoloId);
      this.saveLocalData();
      this.registrarLog('EXCLUSAO_PROTOCOLO', 'Guias/Protocolos', `Protocolo ${prot.codigo} excluído do arquivo.`);
      return prot;
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
      const comps = [...new Set((this.data.parcelamento_guias || []).filter(g => g.parcelamento_id === parcelamentoId).map(g => g.competencia))];
      comps.forEach(c => this.sincronizarGuiasParcelamentoNoProtocolo(c));
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
      const enviados = ['IMPRESSA_OFFICE_BOY', 'ENVIADA_WHATSAPP', 'ENVIADA_EMAIL', 'ARQUIVADA_ASSINADA', 'ENVIADA_CLIENTE', 'VISUALIZADA_CLIENTE'];
      if (Array.isArray(this.data.guias_impostos)) {
        this.data.guias_impostos = this.data.guias_impostos.filter(gi => !(gi.parcelamento_id === parcId && !enviados.includes(gi.status_envio)));
      }
      this.saveLocalData();
      this.registrarLog('EXCLUSAO_PARCELAMENTO', 'Parcelamentos', `Parcelamento ${parc.orgao} (${parc.modalidade}) excluído.`);
      return true;
    }

    sincronizarGuiasParcelamentoNoProtocolo(competencia) {
      if (!Array.isArray(this.data.guias_impostos)) this.data.guias_impostos = [];
      if (!Array.isArray(this.data.parcelamento_guias)) return false;
      const enviados = ['IMPRESSA_OFFICE_BOY', 'ENVIADA_WHATSAPP', 'ENVIADA_EMAIL', 'ARQUIVADA_ASSINADA', 'ENVIADA_CLIENTE', 'VISUALIZADA_CLIENTE'];
      const guiasMes = this.data.parcelamento_guias.filter(g => g.competencia === competencia);
      let mudou = false;

      guiasMes.forEach(g => {
        const parc = (this.data.parcelamentos || []).find(p => p.id === g.parcelamento_id);
        const ativo = Boolean(parc && (parc.status === 'ATIVO' || parc.status === 'EM_ATRASO'));
        const idxExist = this.data.guias_impostos.findIndex(gi => gi.parcelamento_guia_id === g.id);

        if (ativo) {
          const tipoLabel = `Parcelamento — ${parc.orgao || 'Tributário'}`;
          const obsLabel = `${parc.modalidade || ''}${parc.status === 'EM_ATRASO' ? ' • ATIVO EM ATRASO' : ''}`.trim();
          if (idxExist === -1) {
            this.data.guias_impostos.push({
              id: `guia-parc-${g.id}`,
              parcelamento_guia_id: g.id,
              parcelamento_id: parc.id,
              empresa_id: parc.cliente_avulso ? null : parc.empresa_id,
              cliente_avulso: Boolean(parc.cliente_avulso),
              nome_cliente: parc.nome_cliente || g.nome_cliente || '',
              documento: parc.documento || g.documento || '',
              tipo_guia: tipoLabel,
              competencia: g.competencia,
              data_vencimento: g.data_vencimento,
              valor: Number(g.valor_guia || 0),
              status_envio: 'PENDENTE',
              origem: 'PARCELAMENTO',
              observacoes: obsLabel
            });
            mudou = true;
          } else {
            const giAtual = this.data.guias_impostos[idxExist];
            if (giAtual.tipo_guia !== tipoLabel) {
              giAtual.tipo_guia = tipoLabel;
              mudou = true;
            }
            if (!enviados.includes(giAtual.status_envio)) {
              const valNum = Number(g.valor_guia || 0);
              if (giAtual.data_vencimento !== g.data_vencimento || giAtual.valor !== valNum || giAtual.observacoes !== obsLabel) {
                giAtual.data_vencimento = g.data_vencimento;
                giAtual.valor = valNum;
                giAtual.observacoes = obsLabel;
                mudou = true;
              }
            }
          }
        } else if (idxExist !== -1 && !enviados.includes(this.data.guias_impostos[idxExist].status_envio)) {
          this.data.guias_impostos.splice(idxExist, 1);
          mudou = true;
        }
      });
      return mudou;
    }

    sincronizarPendenciasParcelamento(competencia) {
      const acordos = this.data.parcelamentos || [];
      let mudou = false;

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
          const novaQtd = Math.max(1, guiasAntNaoEnviadas.length);
          if (guiaAtual.parcelas_anteriores_abertas !== novaQtd) {
            guiaAtual.parcelas_anteriores_abertas = novaQtd;
            mudou = true;
          }
          if (!guiaAtual.detalhe_pendencia_anterior) {
            guiaAtual.detalhe_pendencia_anterior = guiasAntNaoEnviadas.length > 0
              ? `Guia anterior (${guiasAntNaoEnviadas.map(ga => `Comp. ${ga.competencia}`).join(', ')}) pendente / Acordo em atraso!`
              : 'Parcelamento sinalizado como ATIVO EM ATRASO na competência anterior!';
            mudou = true;
          }
        } else if (guiaAtual.parcelas_anteriores_abertas !== 0 || guiaAtual.detalhe_pendencia_anterior !== '') {
          guiaAtual.parcelas_anteriores_abertas = 0;
          guiaAtual.detalhe_pendencia_anterior = '';
          mudou = true;
        }
      });
      const mudouProt = this.sincronizarGuiasParcelamentoNoProtocolo(competencia);
      if (mudou || mudouProt) {
        this.saveLocalData();
      }
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
        if (cnd.situacao === 'PENDENTE') {
          return { codigo: 'SEM_DATA', label: 'Pendente (Aguardando Anexo)', diasRestantes: 0, cor: 'amber' };
        }
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
          if (dados.arquivo_pdf_base64) {
            const cid = this.data.cnds[idx].arquivo_cofre_id || `cofre-cnd-${this.data.cnds[idx].id}`;
            this.data.cnds[idx].arquivo_cofre_id = cid;
            this.data.cnds[idx].tem_arquivo_pdf = true;
            this.arquivarDocumentoNoCofre(cid, dados.arquivo_pdf_base64, {
              nome: this.data.cnds[idx].arquivo_pdf_nome || 'Certidao.pdf',
              tamanho: dados.arquivo_pdf_base64.length,
              modulo: 'CNDS',
              pasta: 'cnds',
              ref_id: this.data.cnds[idx].id,
              empresa_id: this.data.cnds[idx].empresa_id
            }).catch(() => {});
          }
          this.saveLocalData();
          this.registrarLog('ATUALIZACAO_CND', 'CNDs', `Certidão ${orgaoNome} atualizada.`);
          return this.data.cnds[idx];
        }
      }

      const idNovaCnd = 'cnd-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5);
      const nova = {
        id: idNovaCnd,
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
        arquivo_cofre_id: dados.arquivo_pdf_base64 ? `cofre-cnd-${idNovaCnd}` : '',
        tem_arquivo_pdf: Boolean(dados.arquivo_pdf_base64),
        origem_emissao: dados.origem_emissao || 'MANUAL_PDF',
        api_status: dados.api_status || 'READY',
        ultima_consulta_api: new Date().toISOString(),
        responsavel_nome: dados.responsavel_nome || (this.getCurrentUser()?.nome || 'Equipe Contábil'),
        observacoes: dados.observacoes || ''
      };
      this.data.cnds.unshift(nova);
      if (dados.arquivo_pdf_base64) {
        this.arquivarDocumentoNoCofre(nova.arquivo_cofre_id, dados.arquivo_pdf_base64, {
          nome: nova.arquivo_pdf_nome || 'Certidao.pdf',
          tamanho: dados.arquivo_pdf_base64.length,
          modulo: 'CNDS',
          pasta: 'cnds',
          ref_id: nova.id,
          empresa_id: nova.empresa_id
        }).catch(() => {});
      }
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

    anexarPDFCND(cndId, nomeArquivo, base64 = '', dataEmissao = null, dataValidade = null, numeroControle = null, situacao = null) {
      if (!Array.isArray(this.data.cnds)) this.data.cnds = [];
      const idx = this.data.cnds.findIndex(c => c.id === cndId);
      if (idx === -1) throw new Error('Certidão não encontrada.');

      const cnd = this.data.cnds[idx];
      const emp = this.data.empresas.find(e => e.id === cnd.empresa_id);
      const novaSituacao = situacao || (cnd.situacao === 'PENDENTE' ? 'NEGATIVA' : (cnd.situacao || 'NEGATIVA'));
      const nomeFinal = nomeArquivo || cnd.arquivo_pdf_nome || 'Certidao.pdf';
      const cofreId = cnd.arquivo_cofre_id || `cofre-cnd-${cnd.id}`;

      this.data.cnds[idx] = {
        ...cnd,
        arquivo_pdf_nome: nomeFinal,
        arquivo_pdf_base64: base64 || cnd.arquivo_pdf_base64 || '',
        arquivo_cofre_id: (base64 || cnd.arquivo_cofre_id) ? cofreId : (cnd.arquivo_cofre_id || ''),
        tem_arquivo_pdf: Boolean(base64 || cnd.tem_arquivo_pdf || cnd.arquivo_pdf_base64 || cnd.arquivo_cofre_id),
        origem_emissao: 'MANUAL_PDF',
        data_emissao: dataEmissao || cnd.data_emissao,
        data_validade: dataValidade || cnd.data_validade,
        data_vencimento: dataValidade || cnd.data_vencimento,
        numero_controle: numeroControle !== null && numeroControle !== '' ? numeroControle : cnd.numero_controle,
        codigo_controle: numeroControle !== null && numeroControle !== '' ? numeroControle : cnd.codigo_controle,
        situacao: novaSituacao
      };

      if (base64) {
        this.arquivarDocumentoNoCofre(cofreId, base64, {
          nome: nomeFinal,
          tamanho: base64.length,
          modulo: 'CNDS',
          pasta: 'cnds',
          ref_id: cnd.id,
          empresa_id: cnd.empresa_id
        }).then(res => {
          if (res && res.url && this.data.cnds[idx]) {
            this.data.cnds[idx].arquivo_pdf_url = res.url;
          }
        }).catch(() => {});
      }

      this.saveLocalData();
      this.registrarLog('ANEXO_PDF_CND', 'CNDs', `Arquivo PDF ${nomeFinal} arquivado com segurança na certidão ${cnd.orgao} de ${emp ? emp.nome_fantasia : 'Cliente'}.`);
      return this.data.cnds[idx];
    }

    excluirCND(cndId) {
      const alvo = (this.data.cnds || []).find(c => c.id === cndId);
      if (alvo && alvo.arquivo_cofre_id) {
        this.removerDocumentoDoCofre(alvo.arquivo_cofre_id).catch(() => {});
      }
      this.data.cnds = (this.data.cnds || []).filter(c => c.id !== cndId);
      this.saveLocalData();
    }

    gerarGradePadraoCNDs(empresaIds = null) {
      if (!Array.isArray(this.data.cnds)) this.data.cnds = [];
      let criadas = 0;
      const tipos = window.ZGESTOR_MODELS.tiposCND || [];
      const alvoEmpresas = Array.isArray(empresaIds) && empresaIds.length > 0
        ? this.data.empresas.filter(e => empresaIds.includes(e.id))
        : this.data.empresas;

      alvoEmpresas.forEach(emp => {
        tipos.forEach(t => {
          const nomeTipo = typeof t === 'string' ? t : t.nome;
          const jaExiste = this.data.cnds.some(c => c.empresa_id === emp.id && (c.tipo_cnd === nomeTipo || c.orgao === nomeTipo));
          if (!jaExiste) {
            this.data.cnds.push({
              id: `cnd-gen-${Date.now()}-${criadas}-${Math.random().toString(36).slice(2, 5)}`,
              empresa_id: emp.id,
              tipo_cnd: nomeTipo,
              orgao: nomeTipo,
              situacao: 'PENDENTE',
              data_emissao: '',
              data_validade: '',
              data_vencimento: '',
              codigo_controle: '',
              numero_controle: '',
              responsavel_nome: this.getCurrentUser().nome,
              observacoes: 'Pendente — aguardando emissão e anexo da certidão.'
            });
            criadas++;
          }
        });
      });
      if (criadas > 0) this.saveLocalData();
      return criadas;
    }


    // =========================================================================
    // GESTÃO DE ALVARÁS E LICENÇAS OPERACIONAIS
    // =========================================================================
    garantirAlvarasPadrao(targetData = null) {
      const dataStore = targetData || this.data;
      if (!dataStore) return;
      if (!Array.isArray(dataStore.alvaras)) {
        dataStore.alvaras = [];
      }
      const empresas = dataStore.empresas || [];
      const hoje = new Date();
      const anoCorrente = hoje.getFullYear();

      empresas.forEach(emp => {
        const jaTem = dataStore.alvaras.some(a => a.empresa_id === emp.id && (a.tipo === 'FUNCIONAMENTO' || (a.nome && a.nome.toLowerCase().includes('funcionamento'))));
        if (!jaTem) {
          const vencimentoPadrao = `${anoCorrente}-12-31`;
          dataStore.alvaras.push({
            id: `alv-${emp.id}-func`,
            empresa_id: emp.id,
            tipo: 'FUNCIONAMENTO',
            nome: 'Alvará de Licença e Funcionamento',
            orgao_emissor: `Prefeitura Municipal (${emp.municipio_uf || 'Municipal'})`,
            numero_documento: emp.inscricao_municipal && emp.inscricao_municipal !== 'Isento' ? `ALV-${emp.inscricao_municipal}` : `ALV-${emp.codigo_interno || '001'}`,
            data_emissao: `${anoCorrente}-01-10`,
            data_vencimento: vencimentoPadrao,
            indeterminado: false,
            status: 'VIGENTE',
            protocolo_renovacao: '',
            data_protocolo: null,
            observacoes: 'Alvará padrão de funcionamento emitido pela Prefeitura Municipal. Renovação anual obrigatória.',
            anexo_nome: null,
            anexo_tamanho: null,
            anexo_base64: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
      });
      if (!targetData && this.saveLocalData) {
        this.saveLocalData();
      }
    }

    calcularStatusAlvara(alvara) {
      if (!alvara) return { codigo: 'SEM_DATA', label: 'Sem Registro', cor: 'slate', dias: 0 };
      if (alvara.status === 'DISPENSADO' || alvara.indeterminado) {
        return { codigo: 'DISPENSADO', label: 'Validade Indeterminada / Isento', cor: 'emerald', dias: null };
      }
      if (alvara.status === 'EM_RENOVACAO') {
        return { codigo: 'EM_RENOVACAO', label: 'Em Processo de Renovação', cor: 'blue', dias: null };
      }
      if (!alvara.data_vencimento) {
        return { codigo: 'SEM_DATA', label: 'Sem Data Informada', cor: 'amber', dias: null };
      }

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const partes = alvara.data_vencimento.split('-');
      if (partes.length < 3) return { codigo: 'SEM_DATA', label: 'Data Inválida', cor: 'slate', dias: 0 };
      const [ano, mes, dia] = partes.map(Number);
      const dtVenc = new Date(ano, mes - 1, dia, 0, 0, 0);
      const diffMs = dtVenc - hoje;
      const dias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (dias < 0) {
        return { codigo: 'VENCIDO', label: `Vencido há ${Math.abs(dias)} dia(s)`, cor: 'rose', dias };
      } else if (dias <= 30) {
        return { codigo: 'VENCENDO', label: `Vence em ${dias} dia(s)`, cor: 'amber', dias };
      } else if (dias <= 60) {
        return { codigo: 'ATENCAO', label: `Vence em ${dias} dias`, cor: 'orange', dias };
      } else {
        return { codigo: 'VIGENTE', label: `Válido (${dias} dias rest.)`, cor: 'emerald', dias };
      }
    }

    getAlvaras(empresaId = null, filtroStatus = 'TODOS') {
      this.garantirAlvarasPadrao();
      let lista = [...(this.data.alvaras || [])];
      if (empresaId && empresaId !== 'TODAS') {
        lista = lista.filter(a => a.empresa_id === empresaId);
      }
      if (filtroStatus && filtroStatus !== 'TODOS') {
        lista = lista.filter(a => {
          const st = this.calcularStatusAlvara(a);
          return st.codigo === filtroStatus || a.status === filtroStatus;
        });
      }
      return lista;
    }

    salvarAlvara(dados) {
      if (!dados.empresa_id) throw new Error('Selecione a empresa vinculada ao alvará.');
      if (!dados.nome || !dados.nome.trim()) throw new Error('O nome / tipo do alvará é obrigatório.');

      if (!Array.isArray(this.data.alvaras)) this.data.alvaras = [];
      const agora = new Date().toISOString();

      let registro;
      if (dados.id) {
        const idx = this.data.alvaras.findIndex(a => a.id === dados.id);
        if (idx !== -1) {
          registro = {
            ...this.data.alvaras[idx],
            ...dados,
            updated_at: agora
          };
          this.data.alvaras[idx] = registro;
        } else {
          registro = {
            ...dados,
            id: dados.id,
            created_at: agora,
            updated_at: agora
          };
          this.data.alvaras.unshift(registro);
        }
      } else {
        registro = {
          id: `alv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          empresa_id: dados.empresa_id,
          tipo: dados.tipo || 'OUTRO',
          nome: dados.nome.trim(),
          orgao_emissor: (dados.orgao_emissor || '').trim() || 'Órgão Competente',
          numero_documento: (dados.numero_documento || '').trim(),
          data_emissao: dados.data_emissao || null,
          data_vencimento: dados.indeterminado ? null : (dados.data_vencimento || null),
          indeterminado: Boolean(dados.indeterminado),
          status: dados.status || 'VIGENTE',
          protocolo_renovacao: (dados.protocolo_renovacao || '').trim(),
          data_protocolo: dados.data_protocolo || null,
          observacoes: (dados.observacoes || '').trim(),
          anexo_nome: dados.anexo_nome || null,
          anexo_tamanho: dados.anexo_tamanho || null,
          anexo_base64: dados.anexo_base64 || null,
          created_at: agora,
          updated_at: agora
        };
        this.data.alvaras.unshift(registro);
      }

      if (dados.anexo_base64) {
        const cofreId = registro.anexo_cofre_id || `cofre-alvara-${registro.id}`;
        registro.anexo_cofre_id = cofreId;
        registro.tem_anexo = true;
        this.arquivarDocumentoNoCofre(cofreId, dados.anexo_base64, {
          nome: registro.anexo_nome || `Alvara_${registro.tipo || 'doc'}.pdf`,
          tamanho: registro.anexo_tamanho || dados.anexo_base64.length,
          modulo: 'ALVARAS',
          pasta: 'alvaras',
          ref_id: registro.id,
          empresa_id: registro.empresa_id
        }).then(res => {
          if (res && res.url) {
            registro.anexo_url = res.url;
          }
        }).catch(() => {});
      }

      this.saveLocalData();
      const emp = (this.data.empresas || []).find(e => e.id === registro.empresa_id);
      this.registrarLog('SALVAR_ALVARA', 'Alvarás e Licenças', `Alvará "${registro.nome}" gravado para a empresa ${emp ? emp.nome_fantasia : registro.empresa_id}.`);
      return registro;
    }

    excluirAlvara(alvaraId) {
      if (!Array.isArray(this.data.alvaras)) return;
      const alvo = this.data.alvaras.find(a => a.id === alvaraId);
      if (alvo && alvo.anexo_cofre_id) {
        this.removerDocumentoDoCofre(alvo.anexo_cofre_id).catch(() => {});
      }
      this.data.alvaras = this.data.alvaras.filter(a => a.id !== alvaraId);
      this.saveLocalData();
      if (alvo) {
        this.registrarLog('EXCLUIR_ALVARA', 'Alvarás e Licenças', `Alvará "${alvo.nome}" removido do sistema.`);
      }
    }

    registrarProtocoloAlvara(alvaraId, protocolo, dataProtocolo, observacao = '') {
      const idx = (this.data.alvaras || []).findIndex(a => a.id === alvaraId);
      if (idx === -1) throw new Error('Alvará não encontrado.');
      this.data.alvaras[idx].protocolo_renovacao = (protocolo || '').trim();
      this.data.alvaras[idx].data_protocolo = dataProtocolo || new Date().toISOString().slice(0, 10);
      this.data.alvaras[idx].status = 'EM_RENOVACAO';
      if (observacao) {
        this.data.alvaras[idx].observacoes = (this.data.alvaras[idx].observacoes ? this.data.alvaras[idx].observacoes + '\n' : '') + observacao;
      }
      this.data.alvaras[idx].updated_at = new Date().toISOString();
      this.saveLocalData();
      return this.data.alvaras[idx];
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
        tarefa_vinculada_id: tarefaIdCriada,
        anexo_nome: dados.anexo_nome || null,
        anexo_tamanho: dados.anexo_tamanho || null,
        anexo_base64: dados.anexo_base64 || null
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
      if (!empresaId) return { valor: 0, competencia: '' };
      const compAnt = this.obterCompetenciaAnterior(competenciaAtual);
      const honAnt = this.data.honorarios.find(
        h => h.empresa_id === empresaId && h.competencia === compAnt && (!h.tipo_lancamento || h.tipo_lancamento === 'MENSAL') && !h.cliente_avulso
      );
      if (honAnt && Number(honAnt.saldo_aberto) > 0) {
        return {
          valor: Number(honAnt.saldo_aberto),
          competencia: compAnt
        };
      }
      return { valor: 0, competencia: '' };
    }

    recalcularHonorario(honorarioId, salvarAoFinal = true, _estadoInterno = null) {
      const hon = this.data.honorarios.find(h => h.id === honorarioId);
      if (!hon) return null;

      let mudou = false;
      const ehMensalRegular = (!hon.tipo_lancamento || hon.tipo_lancamento === 'MENSAL') && !hon.cliente_avulso && Boolean(hon.empresa_id);
      const ehAvulso = hon.tipo_lancamento === 'AVULSO';

      if (ehMensalRegular) {
        const ant = this.obterSaldoAnteriorEmpresa(hon.empresa_id, hon.competencia);
        if (ant.valor > 0) {
          if (hon.saldo_anterior !== ant.valor || hon.competencia_saldo_anterior !== ant.competencia) {
            hon.saldo_anterior = ant.valor;
            hon.competencia_saldo_anterior = ant.competencia;
            mudou = true;
          }
        } else if (hon.competencia_saldo_anterior || Number(hon.saldo_anterior) > 0) {
          if (hon.competencia_saldo_anterior) {
            hon.saldo_anterior = 0;
            hon.competencia_saldo_anterior = '';
            mudou = true;
          }
        }
      } else if (ehAvulso && hon.avulso_transportado && hon.avulso_pai_id) {
        const pai = this.data.honorarios.find(p => p.id === hon.avulso_pai_id);
        const saldoPai = pai ? Math.max(0, Number(pai.saldo_aberto || 0)) : 0;
        const compPai = pai ? pai.competencia : (hon.competencia_saldo_anterior || '');
        if (hon.saldo_anterior !== saldoPai || hon.competencia_saldo_anterior !== compPai) {
          hon.saldo_anterior = saldoPai;
          hon.competencia_saldo_anterior = compPai;
          mudou = true;
        }
      }

      const pagamentos = _estadoInterno?.pagamentosPorHon
        ? (_estadoInterno.pagamentosPorHon.get(honorarioId) || [])
        : this.data.honorario_pagamentos.filter(p => p.honorario_id === honorarioId);
      const somaPago = pagamentos.reduce((acc, p) => acc + Number(p.valor || 0), 0);
      const valorLiquido = Math.max(
        0,
        Number(hon.valor_mensal || 0) +
        Number(hon.saldo_anterior || 0) +
        Number(hon.servicos_extras || 0) -
        Number(hon.desconto || 0)
      );
      const saldoAberto = Math.max(0, Number((valorLiquido - somaPago).toFixed(2)));
      const valorPagoNovo = Number(somaPago.toFixed(2));

      if (hon.valor_pago !== valorPagoNovo) {
        hon.valor_pago = valorPagoNovo;
        mudou = true;
      }
      if (hon.saldo_aberto !== saldoAberto) {
        hon.saldo_aberto = saldoAberto;
        mudou = true;
      }

      const hoje = _estadoInterno?.hoje || new Date().toISOString().slice(0, 10);
      if (hon.data_vencimento && !this.ehDiaUtilBrasil(hon.data_vencimento, false)) {
        const vencProrrogado = this.prorrogarParaProximoDiaUtil(hon.data_vencimento);
        if (vencProrrogado !== hon.data_vencimento) {
          hon.data_vencimento = vencProrrogado;
          mudou = true;
        }
      }

      let novoStatus = 'ABERTO';
      if (saldoAberto <= 0.009 && valorLiquido > 0) {
        novoStatus = 'PAGO';
      } else if (somaPago > 0 && saldoAberto > 0) {
        novoStatus = 'PARCIAL';
      } else if (hon.data_vencimento < hoje && saldoAberto > 0) {
        novoStatus = 'ATRASADO';
      }
      if (hon.status !== novoStatus) {
        hon.status = novoStatus;
        mudou = true;
      }

      if (ehMensalRegular) {
        const compSeg = this.obterMesSubsequente(hon.competencia).label;
        const honSeg = this.data.honorarios.find(
          h => h.empresa_id === hon.empresa_id && h.competencia === compSeg && (!h.tipo_lancamento || h.tipo_lancamento === 'MENSAL') && !h.cliente_avulso
        );
        if (honSeg) {
          const resSeg = this.recalcularHonorario(honSeg.id, false, _estadoInterno);
          if (resSeg && _estadoInterno && _estadoInterno.algumMudou) {
            mudou = true;
          }
        }
      } else if (ehAvulso) {
        const compSeg = this.obterMesSubsequente(hon.competencia).label;
        const origemId = hon.avulso_origem_id || hon.id;
        const idxFilho = this.data.honorarios.findIndex(
          h => h.competencia === compSeg && h.tipo_lancamento === 'AVULSO' && h.avulso_transportado && (h.avulso_pai_id === hon.id || h.avulso_origem_id === origemId)
        );
        if (idxFilho !== -1) {
          const filho = this.data.honorarios[idxFilho];
          const pagsFilho = _estadoInterno?.pagamentosPorHon
            ? (_estadoInterno.pagamentosPorHon.get(filho.id) || [])
            : this.data.honorario_pagamentos.filter(p => p.honorario_id === filho.id);
          const pagoNoFilho = pagsFilho.reduce((acc, p) => acc + Number(p.valor || 0), 0);
          if (saldoAberto <= 0.009 && pagoNoFilho <= 0) {
            // Quitado integralmente no mês anterior -> remove automaticamente os transportes futuros sem baixa
            this._removerAvulsosTransportadosSemBaixa(filho.id);
            mudou = true;
          } else {
            filho.avulso_pai_id = hon.id;
            const resFilho = this.recalcularHonorario(filho.id, false, _estadoInterno);
            if (resFilho && _estadoInterno && _estadoInterno.algumMudou) {
              mudou = true;
            }
          }
        }
      }

      if (_estadoInterno && mudou) {
        _estadoInterno.algumMudou = true;
      }

      if (salvarAoFinal && mudou) {
        this._honMutVersion = (this._honMutVersion || 0) + 1;
        this.saveLocalData();
      }
      return hon;
    }

    _removerAvulsosTransportadosSemBaixa(honIdInicial) {
      let atualId = honIdInicial;
      while (atualId) {
        const alvo = this.data.honorarios.find(h => h.id === atualId);
        if (!alvo) break;
        const temPag = (this.data.honorario_pagamentos || []).some(p => p.honorario_id === alvo.id && Number(p.valor || 0) > 0);
        if (temPag) break;
        const proximo = this.data.honorarios.find(h => h.avulso_pai_id === alvo.id && h.avulso_transportado);
        this.data.honorarios = this.data.honorarios.filter(h => h.id !== alvo.id);
        atualId = proximo ? proximo.id : null;
      }
    }

    _sincronizarAvulsosDoMesAnterior(competencia, estadoInterno = null) {
      if (!competencia) return 0;
      const compAnt = this.obterCompetenciaAnterior(competencia);
      const avulsosAnt = (this.data.honorarios || []).filter(
        h => h && h.competencia === compAnt && h.tipo_lancamento === 'AVULSO'
      );
      if (avulsosAnt.length === 0) return 0;

      // Recalcula primeiro os avulsos do mês anterior para ter saldo_aberto exato
      for (let i = 0; i < avulsosAnt.length; i++) {
        this.recalcularHonorario(avulsosAnt[i].id, false, estadoInterno);
      }

      let criadosOuAlterados = 0;
      avulsosAnt.forEach((honAnt, idx) => {
        const origemId = honAnt.avulso_origem_id || honAnt.id;
        const saldoRem = Math.max(0, Number((honAnt.saldo_aberto || 0).toFixed(2)));
        const existente = this.data.honorarios.find(
          h => h.competencia === competencia && h.tipo_lancamento === 'AVULSO' && (h.avulso_pai_id === honAnt.id || (h.avulso_origem_id && h.avulso_origem_id === origemId))
        );

        if (saldoRem > 0.009) {
          if (!existente) {
            const diaBase = Number(honAnt.dia_base_vencimento || Number(String(honAnt.data_vencimento || '').slice(-2)) || 10);
            const vencSeg = this.calcularVencimentoHonorarioUtil(competencia, diaBase);
            const novoTransp = {
              id: `hon-avulso-tr-${competencia.replace('/', '')}-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
              avulso_transportado: true,
              avulso_pai_id: honAnt.id,
              avulso_origem_id: origemId,
              empresa_id: honAnt.empresa_id || null,
              cliente_avulso: Boolean(honAnt.cliente_avulso),
              nome_cliente: honAnt.nome_cliente || '',
              documento_cliente: honAnt.documento_cliente || '',
              contato_cliente: honAnt.contato_cliente || '',
              tipo_lancamento: 'AVULSO',
              descricao_cobranca: honAnt.descricao_cobranca || 'HONORÁRIO MENSAL',
              competencia,
              competencia_referencia: honAnt.competencia_referencia || honAnt.competencia,
              canal_pagamento: honAnt.canal_pagamento || 'PIX_PRINCIPAL',
              dia_base_vencimento: diaBase,
              data_vencimento: vencSeg,
              valor_mensal: 0,
              saldo_anterior: saldoRem,
              competencia_saldo_anterior: compAnt,
              servicos_extras: 0,
              desconto: 0,
              valor_pago: 0,
              saldo_aberto: saldoRem,
              status: 'ABERTO',
              observacoes: honAnt.observacoes || ''
            };
            this.data.honorarios.unshift(novoTransp);
            this.recalcularHonorario(novoTransp.id, false, estadoInterno);
            if (estadoInterno) estadoInterno.algumMudou = true;
            criadosOuAlterados++;
          } else if (existente.avulso_transportado) {
            existente.avulso_pai_id = honAnt.id;
            existente.avulso_origem_id = origemId;
            if (existente.saldo_anterior !== saldoRem || existente.competencia_saldo_anterior !== compAnt) {
              existente.saldo_anterior = saldoRem;
              existente.competencia_saldo_anterior = compAnt;
              if (estadoInterno) estadoInterno.algumMudou = true;
              criadosOuAlterados++;
            }
            this.recalcularHonorario(existente.id, false, estadoInterno);
          }
        } else if (existente && existente.avulso_transportado) {
          const temPagFilho = (this.data.honorario_pagamentos || []).some(p => p.honorario_id === existente.id && Number(p.valor || 0) > 0);
          if (!temPagFilho) {
            this._removerAvulsosTransportadosSemBaixa(existente.id);
            if (estadoInterno) estadoInterno.algumMudou = true;
            criadosOuAlterados++;
          }
        }
      });

      return criadosOuAlterados;
    }

    sincronizarSaldosAnterioresHonorarios(competencia) {
      const hoje = new Date().toISOString().slice(0, 10);
      const mutVer = `${this._honMutVersion || 0}:${(this.data.honorarios || []).length}:${(this.data.honorario_pagamentos || []).length}:${hoje}`;
      if (!this._honSyncCache) this._honSyncCache = new Map();
      if (this._honSyncCache.get(competencia) === mutVer) {
        return;
      }

      const pagamentosPorHon = new Map();
      const todosPags = this.data.honorario_pagamentos || [];
      for (let i = 0; i < todosPags.length; i++) {
        const p = todosPags[i];
        if (!p || !p.honorario_id) continue;
        let arr = pagamentosPorHon.get(p.honorario_id);
        if (!arr) {
          arr = [];
          pagamentosPorHon.set(p.honorario_id, arr);
        }
        arr.push(p);
      }

      const estadoInterno = { pagamentosPorHon, hoje, algumMudou: false };

      // Transporta automaticamente recibos/cobranças avulsas em aberto ou parciais do mês imediatamente anterior
      this._sincronizarAvulsosDoMesAnterior(competencia, estadoInterno);

      const lista = (this.data.honorarios || []).filter(h => h.competencia === competencia);
      for (let i = 0; i < lista.length; i++) {
        this.recalcularHonorario(lista[i].id, false, estadoInterno);
      }

      if (estadoInterno.algumMudou) {
        this._honMutVersion = (this._honMutVersion || 0) + 1;
        this.saveLocalData();
      }
      const novaMutVer = `${this._honMutVersion || 0}:${(this.data.honorarios || []).length}:${(this.data.honorario_pagamentos || []).length}:${hoje}`;
      this._honSyncCache.set(competencia, novaMutVer);
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
          h => h.empresa_id === emp.id && h.competencia === competencia && (!h.tipo_lancamento || h.tipo_lancamento === 'MENSAL') && !h.cliente_avulso
        );
        const saldoAnt = this.obterSaldoAnteriorEmpresa(emp.id, competencia);

        if (!existente) {
          const diaBaseHon = Number(emp.dia_vencimento_honorario || 10);
          const vencimentoMesSeguinte = this.calcularVencimentoHonorarioUtil(competencia, diaBaseHon);
          const valorPadrao = Number(emp.valor_honorario_padrao || 0);
          const totalComAnterior = Number((valorPadrao + saldoAnt.valor).toFixed(2));

          const novoHon = {
            id: `hon-${Date.now()}-${criados}-${Math.random().toString(36).slice(2, 5)}`,
            empresa_id: emp.id,
            competencia,
            tipo_lancamento: 'MENSAL',
            descricao_cobranca: 'HONORÁRIO MENSAL',
            dia_base_vencimento: diaBaseHon,
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
              : ''
          };
          this.data.honorarios.push(novoHon);
          criados++;
        } else {
          this.recalcularHonorario(existente.id, false);
        }
      });

      const avulsosTransportados = this._sincronizarAvulsosDoMesAnterior(competencia);
      criados += avulsosTransportados;

      if (criados > 0) {
        this._honMutVersion = (this._honMutVersion || 0) + 1;
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
            descricao_cobranca: dadosHon.descricao_cobranca !== undefined ? String(dadosHon.descricao_cobranca || 'HONORÁRIO MENSAL').trim() : (this.data.honorarios[idx].descricao_cobranca || 'HONORÁRIO MENSAL'),
            canal_pagamento: dadosHon.canal_pagamento || this.data.honorarios[idx].canal_pagamento || null,
            valor_mensal: Number(dadosHon.valor_mensal || 0),
            saldo_anterior: dadosHon.saldo_anterior !== undefined ? Number(dadosHon.saldo_anterior) : Number(this.data.honorarios[idx].saldo_anterior || 0),
            servicos_extras: Number(dadosHon.servicos_extras || 0),
            desconto: Number(dadosHon.desconto || 0),
            data_vencimento: this.prorrogarParaProximoDiaUtil(dadosHon.data_vencimento || this.data.honorarios[idx].data_vencimento),
            observacoes: dadosHon.observacoes !== undefined ? dadosHon.observacoes : this.data.honorarios[idx].observacoes
          };
          this._honMutVersion = (this._honMutVersion || 0) + 1;
          const atualizado = this.recalcularHonorario(dadosHon.id, false);
          this.saveLocalData();
          const emp = this.obterEmpresaSegura(atualizado.empresa_id, atualizado);
          this.registrarLog('EDICAO_HONORARIO', 'Honorários', `Honorário de ${emp ? emp.razao_social : (atualizado.nome_cliente || 'Cliente')} (${atualizado.competencia}) ajustado. Saldo em aberto: R$ ${atualizado.saldo_aberto.toFixed(2)}.`);
          return atualizado;
        }
      }

      const valorLiquido = Math.max(0, Number(dadosHon.valor_mensal || 0) + Number(dadosHon.saldo_anterior || 0) + Number(dadosHon.servicos_extras || 0) - Number(dadosHon.desconto || 0));
      const novo = {
        id: 'hon-' + Date.now(),
        empresa_id: dadosHon.empresa_id,
        competencia: dadosHon.competencia,
        data_vencimento: this.prorrogarParaProximoDiaUtil(dadosHon.data_vencimento),
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
      this._honMutVersion = (this._honMutVersion || 0) + 1;
      this.recalcularHonorario(novo.id, false);
      this.saveLocalData();
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
      this._honMutVersion = (this._honMutVersion || 0) + 1;
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
      this._honMutVersion = (this._honMutVersion || 0) + 1;
      const atualizado = this.recalcularHonorario(honorarioId);
      this.registrarLog('ESTORNO_PAGAMENTO_HONORARIO', 'Honorários', `Estornado lançamento de R$ ${pag.valor.toFixed(2)}. Novo saldo em aberto: R$ ${atualizado.saldo_aberto.toFixed(2)}.`);
      return atualizado;
    }

    lancarHonorarioAvulso(dados = {}) {
      if (!this.canAccessModule('honorarios')) {
        throw new Error('Política de Segurança (RLS): Apenas Administradores ou Financeiro podem lançar cobranças avulsas.');
      }
      const isClienteAvulso = Boolean(dados.cliente_avulso);
      const emp = !isClienteAvulso && dados.empresa_id ? this.obterEmpresaSegura(dados.empresa_id) : null;
      if (!isClienteAvulso && !emp) {
        throw new Error('Selecione a empresa cadastrada ou marque a opção Cliente Avulso / Não Cliente.');
      }
      const nomeAvulso = String(dados.nome_cliente || '').trim();
      if (isClienteAvulso && !nomeAvulso) {
        throw new Error('Informe o nome completo ou razão social do cliente avulso.');
      }

      const valorBase = Number(dados.valor_mensal || 0);
      if (isNaN(valorBase) || valorBase <= 0) {
        throw new Error('Informe um valor de cobrança maior que zero.');
      }

      const compControle = this.normalizarCompetencia(dados.competencia || '10/2026');
      const compRefRecibo = dados.competencia_referencia
        ? this.normalizarCompetencia(dados.competencia_referencia)
        : compControle;
      const vencBruto = dados.data_vencimento || this.calcularVencimentoHonorarioUtil(compControle, emp?.dia_vencimento_honorario || 10);
      const vencFinal = dados.prorrogar_util !== false ? this.prorrogarParaProximoDiaUtil(vencBruto) : vencBruto;
      const desconto = Math.max(0, Number(dados.desconto || 0));
      const extras = Math.max(0, Number(dados.servicos_extras || 0));
      const liquido = Math.max(0, Number((valorBase + extras - desconto).toFixed(2)));
      const descricao = String(dados.descricao_cobranca || 'HONORÁRIO MENSAL').trim() || 'HONORÁRIO MENSAL';

      const idNovo = `hon-avulso-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const novo = {
        id: idNovo,
        avulso_origem_id: idNovo,
        avulso_transportado: false,
        empresa_id: isClienteAvulso ? null : emp.id,
        cliente_avulso: isClienteAvulso,
        nome_cliente: isClienteAvulso ? nomeAvulso : (emp.razao_social || emp.nome_fantasia),
        documento_cliente: isClienteAvulso ? String(dados.documento_cliente || '').trim() : (emp.cnpj || ''),
        contato_cliente: String(dados.contato_cliente || '').trim(),
        tipo_lancamento: 'AVULSO',
        descricao_cobranca: descricao,
        competencia: compControle,
        competencia_referencia: compRefRecibo,
        canal_pagamento: dados.canal_pagamento || (emp && emp.canal_pagamento_padrao) || 'PIX_PRINCIPAL',
        dia_base_vencimento: Number(String(vencBruto).slice(-2)) || 10,
        data_vencimento: vencFinal,
        valor_mensal: Number(valorBase.toFixed(2)),
        saldo_anterior: 0,
        competencia_saldo_anterior: '',
        servicos_extras: Number(extras.toFixed(2)),
        desconto: Number(desconto.toFixed(2)),
        valor_pago: 0,
        saldo_aberto: liquido,
        status: 'ABERTO',
        observacoes: String(dados.observacoes || '').trim()
      };

      this.data.honorarios.unshift(novo);
      this._honMutVersion = (this._honMutVersion || 0) + 1;
      this.recalcularHonorario(novo.id, false);
      this.saveLocalData();
      this.registrarLog(
        'NOVO_HONORARIO_AVULSO',
        'Honorários',
        `Cobrança avulsa lançada (${descricao} - R$ ${liquido.toFixed(2)}) para ${novo.nome_cliente} na competência ${compControle}.`
      );
      return novo;
    }

    gerarHonorariosDecimoTerceiro(opcoes = {}) {
      if (!this.canAccessModule('honorarios')) {
        throw new Error('Política de Segurança (RLS): Apenas Administradores ou Financeiro podem lançar o 13º Honorário.');
      }

      const ano = parseInt(opcoes.ano, 10) || 2026;
      const modoParcelas = opcoes.modoParcelas || 'AMBAS'; // 'AMBAS' | 'SOMENTE_1_DEZ' | 'SOMENTE_2_JAN' | 'UNICA_DEZ'
      const diaFixo = opcoes.diaFixo ? parseInt(opcoes.diaFixo, 10) : null;
      const valorCustom = (opcoes.valorTotalCustom !== undefined && opcoes.valorTotalCustom !== null && opcoes.valorTotalCustom !== '')
        ? Number(opcoes.valorTotalCustom)
        : null;

      const idsFiltro = Array.isArray(opcoes.empresaIds) && opcoes.empresaIds.length > 0
        ? new Set(opcoes.empresaIds)
        : null;

      const empresasAlvo = (this.data.empresas || []).filter(e => {
        if (!e) return false;
        if (idsFiltro) return idsFiltro.has(e.id);
        return (e.status === 'ATIVA' || e.status === 'EM_ONBOARDING') && Number(e.valor_honorario_padrao || 0) > 0;
      });

      const compParcela1 = `11/${ano}`; // Competência 11/AAAA -> Vence em Dezembro (12/AAAA)
      const compParcela2 = `12/${ano}`; // Competência 12/AAAA -> Vence em Janeiro (01/AAAA+1)

      let criadas1 = 0;
      let criadas2 = 0;
      let ignoradas = 0;

      empresasAlvo.forEach((emp, idx) => {
        const valorTotal13 = (valorCustom !== null && empresasAlvo.length === 1)
          ? valorCustom
          : Number(emp.valor_honorario_padrao || 0);
        if (!valorTotal13 || valorTotal13 <= 0) {
          ignoradas++;
          return;
        }

        const diaBase = diaFixo || Number(emp.dia_vencimento_honorario || 10);

        if (modoParcelas === 'UNICA_DEZ') {
          const jaTemUnica = this.data.honorarios.some(
            h => h.empresa_id === emp.id && h.tipo_lancamento === 'DECIMO_TERCEIRO' && Number(h.ano_13) === ano && Number(h.parcela_13) === 1
          );
          if (jaTemUnica) {
            ignoradas++;
            return;
          }
          const vencDez = this.calcularVencimentoHonorarioUtil(compParcela1, diaBase);
          const honUnica = {
            id: `hon-13u-${ano}-${Date.now()}-${idx}`,
            empresa_id: emp.id,
            tipo_lancamento: 'DECIMO_TERCEIRO',
            ano_13: ano,
            parcela_13: 1,
            total_parcelas_13: 1,
            descricao_cobranca: `13º HONORÁRIO ANUAL (${ano})`,
            competencia: compParcela1,
            competencia_referencia: `13º/${ano}`,
            dia_base_vencimento: diaBase,
            data_vencimento: vencDez,
            valor_mensal: Number(valorTotal13.toFixed(2)),
            saldo_anterior: 0,
            competencia_saldo_anterior: '',
            servicos_extras: 0,
            desconto: 0,
            valor_pago: 0,
            saldo_aberto: Number(valorTotal13.toFixed(2)),
            status: 'ABERTO',
            observacoes: `Parcela única do 13º Honorário (${ano}) com vencimento em Dezembro/${ano}.`
          };
          this.data.honorarios.push(honUnica);
          this.recalcularHonorario(honUnica.id, false);
          criadas1++;
          return;
        }

        const valorP1 = Number((valorTotal13 / 2).toFixed(2));
        const valorP2 = Number((valorTotal13 - valorP1).toFixed(2));

        // 1ª Parcela -> Vence em Dezembro (controlada na Competência 11/ano)
        if (modoParcelas === 'AMBAS' || modoParcelas === 'SOMENTE_1_DEZ') {
          const jaTemP1 = this.data.honorarios.some(
            h => h.empresa_id === emp.id && h.tipo_lancamento === 'DECIMO_TERCEIRO' && Number(h.ano_13) === ano && Number(h.parcela_13) === 1
          );
          if (!jaTemP1) {
            const vencDez = this.calcularVencimentoHonorarioUtil(compParcela1, diaBase);
            const honP1 = {
              id: `hon-13p1-${ano}-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
              empresa_id: emp.id,
              tipo_lancamento: 'DECIMO_TERCEIRO',
              ano_13: ano,
              parcela_13: 1,
              total_parcelas_13: 2,
              descricao_cobranca: `13º HONORÁRIO — 1ª PARCELA (1/2)`,
              competencia: compParcela1,
              competencia_referencia: `13º/${ano}`,
              dia_base_vencimento: diaBase,
              data_vencimento: vencDez,
              valor_mensal: valorP1,
              saldo_anterior: 0,
              competencia_saldo_anterior: '',
              servicos_extras: 0,
              desconto: 0,
              valor_pago: 0,
              saldo_aberto: valorP1,
              status: 'ABERTO',
              observacoes: `1ª parcela (50%) do 13º Honorário ${ano} — Vencimento em Dezembro/${ano}.`
            };
            this.data.honorarios.push(honP1);
            this.recalcularHonorario(honP1.id, false);
            criadas1++;
          } else {
            ignoradas++;
          }
        }

        // 2ª Parcela -> Vence em Janeiro do ano seguinte (controlada na Competência 12/ano)
        if (modoParcelas === 'AMBAS' || modoParcelas === 'SOMENTE_2_JAN') {
          const jaTemP2 = this.data.honorarios.some(
            h => h.empresa_id === emp.id && h.tipo_lancamento === 'DECIMO_TERCEIRO' && Number(h.ano_13) === ano && Number(h.parcela_13) === 2
          );
          if (!jaTemP2) {
            const vencJan = this.calcularVencimentoHonorarioUtil(compParcela2, diaBase);
            const honP2 = {
              id: `hon-13p2-${ano}-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
              empresa_id: emp.id,
              tipo_lancamento: 'DECIMO_TERCEIRO',
              ano_13: ano,
              parcela_13: 2,
              total_parcelas_13: 2,
              descricao_cobranca: `13º HONORÁRIO — 2ª PARCELA (2/2)`,
              competencia: compParcela2,
              competencia_referencia: `13º/${ano}`,
              dia_base_vencimento: diaBase,
              data_vencimento: vencJan,
              valor_mensal: valorP2,
              saldo_anterior: 0,
              competencia_saldo_anterior: '',
              servicos_extras: 0,
              desconto: 0,
              valor_pago: 0,
              saldo_aberto: valorP2,
              status: 'ABERTO',
              observacoes: `2ª parcela (50%) do 13º Honorário ${ano} — Vencimento em Janeiro/${ano + 1}.`
            };
            this.data.honorarios.push(honP2);
            this.recalcularHonorario(honP2.id, false);
            criadas2++;
          } else {
            ignoradas++;
          }
        }
      });

      if (criadas1 > 0 || criadas2 > 0) {
        this._honMutVersion = (this._honMutVersion || 0) + 1;
        this.saveLocalData();
        this.registrarLog(
          'GERACAO_HONORARIO_13',
          'Honorários',
          `Gerado 13º Honorário (${ano}): ${criadas1} 1ª parcela(s) p/ Dezembro (${compParcela1}) e ${criadas2} 2ª parcela(s) p/ Janeiro (${compParcela2}).`
        );
      }
      return { criadas1, criadas2, ignoradas, compParcela1, compParcela2 };
    }

    excluirHonorarioLancamento(honorarioId) {
      if (!this.canAccessModule('honorarios')) {
        throw new Error('Apenas Administradores ou Financeiro podem remover lançamentos de honorários.');
      }
      const hon = this.data.honorarios.find(h => h.id === honorarioId);
      if (!hon) return false;
      if (Number(hon.valor_pago || 0) > 0) {
        throw new Error('Estorne os pagamentos registrados antes de excluir este lançamento de honorário.');
      }
      const filhoDireto = this.data.honorarios.find(h => h.avulso_pai_id === honorarioId && h.avulso_transportado);
      if (filhoDireto) {
        this._removerAvulsosTransportadosSemBaixa(filhoDireto.id);
      }
      this.data.honorarios = this.data.honorarios.filter(h => h.id !== honorarioId);
      this._honMutVersion = (this._honMutVersion || 0) + 1;
      this.saveLocalData();
      this.registrarLog('EXCLUSAO_HONORARIO', 'Honorários', `Lançamento de honorário (${hon.descricao_cobranca || 'HONORÁRIO MENSAL'} - ${hon.competencia}) excluído.`);
      return true;
    }

    // =========================================================================
    // VALIDAÇÃO ESTRITA DE E-MAIL REAL (RFC 5322 APRIMORADO)
    // =========================================================================
    validarEmailReal(email) {
      if (!email || typeof email !== 'string') {
        return { valido: false, erro: 'O endereço de e-mail é obrigatório.' };
      }
      const limpo = email.trim().toLowerCase();
      const emailRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9._%+-]*[a-zA-Z0-9])?@[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(limpo)) {
        return {
          valido: false,
          erro: `O e-mail "${email}" é inválido. Informe um endereço real completo (ex: contato@empresa.com.br ou nome@gmail.com).`
        };
      }
      if (limpo.includes('..') || limpo.includes('@.') || limpo.includes('.@')) {
        return { valido: false, erro: 'Formato de e-mail inválido (pontuações irregulares).' };
      }
      const partes = limpo.split('@');
      const dominio = partes[1];
      if (!dominio || dominio.length < 4 || !dominio.includes('.')) {
        return { valido: false, erro: 'Domínio de e-mail inválido. Informe um domínio real com extensão (ex: .com, .com.br).' };
      }
      const tld = dominio.split('.').pop();
      if (!tld || tld.length < 2) {
        return { valido: false, erro: 'Extensão de domínio do e-mail inválida (mínimo de 2 caracteres, ex: .com ou .br).' };
      }
      return { valido: true, email: limpo };
    }

    // =========================================================================
    // GESTÃO DE USUÁRIOS E MODELOS RECORRENTES (COM REGIME, PRÓ-LABORE E FUNCIONÁRIOS)
    // =========================================================================
    salvarUsuario(dadosUsuario) {
      if (!this.isAdmin()) {
        throw new Error('Política de Segurança (RLS): Apenas Administradores podem gerenciar usuários e permissões.');
      }
      if (dadosUsuario.email) {
        const check = this.validarEmailReal(dadosUsuario.email);
        if (!check.valido) throw new Error(check.erro);
        dadosUsuario.email = check.email;
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
      const checkEmail = this.validarEmailReal(dados.email);
      if (!checkEmail.valido) {
        throw new Error(checkEmail.erro);
      }
      dados.email = checkEmail.email;

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
      } else if (window.ZGESTOR_MODELS && Array.isArray(window.ZGESTOR_MODELS.modelosTarefasMensais)) {
        // Garante injeção automática de novos modelos oficiais (ex: Folha Doméstica eSocial) em bases existentes
        const modDom = window.ZGESTOR_MODELS.modelosTarefasMensais.find(m => m.id === 'mod-dp-domestica-esocial');
        if (modDom && !this.data.modelos_tarefas.some(m => m.id === 'mod-dp-domestica-esocial')) {
          this.data.modelos_tarefas.push(JSON.parse(JSON.stringify(modDom)));
          this.saveLocalData();
        }
      }
      return this.data.modelos_tarefas;
    }

    salvarModeloTarefa(dadosMod) {
      const lista = this.getModelosTarefas();
      const requerProLabore = Boolean(dadosMod.requer_pro_labore);
      const requerFunc = Boolean(dadosMod.requer_funcionarios !== undefined ? dadosMod.requer_funcionarios : dadosMod.exige_funcionarios);
      const requerIE = Boolean(dadosMod.requer_ie);
      const anteciparDiaUtil = Boolean(dadosMod.antecipar_dia_util);
      const periodicidade = dadosMod.periodicidade === 'ANUAL'
        ? 'ANUAL'
        : (dadosMod.periodicidade === 'TRIMESTRAL' ? 'TRIMESTRAL' : 'MENSAL');

      if (dadosMod.id) {
        const idx = lista.findIndex(m => m.id === dadosMod.id);
        if (idx !== -1) {
          lista[idx] = {
            ...lista[idx],
            titulo: dadosMod.titulo,
            descricao: dadosMod.descricao || '',
            departamento: dadosMod.departamento || 'FISCAL',
            periodicidade,
            mes_entrega: periodicidade === 'ANUAL' ? String(dadosMod.mes_entrega || '06').padStart(2, '0') : null,
            regimes_aplicaveis: Array.isArray(dadosMod.regimes_aplicaveis) && dadosMod.regimes_aplicaveis.length > 0
              ? dadosMod.regimes_aplicaveis
              : ['Simples Nacional'],
            dia_prazo_padrao: Number(dadosMod.dia_prazo_padrao || 15),
            antecipar_dia_util: anteciparDiaUtil,
            requer_pro_labore: requerProLabore,
            requer_funcionarios: requerFunc,
            requer_ie: requerIE,
            ativo: dadosMod.ativo !== undefined ? Boolean(dadosMod.ativo) : lista[idx].ativo
          };
          this.saveLocalData();
          this.registrarLog('EDICAO_MODELO_TAREFA', 'Tarefas', `Rotina "${dadosMod.titulo}" atualizada (${periodicidade} | Regimes: ${lista[idx].regimes_aplicaveis.join(', ')}).`);
          return lista[idx];
        }
      }

      const novo = {
        id: 'mod-' + Date.now(),
        titulo: dadosMod.titulo,
        descricao: dadosMod.descricao || '',
        departamento: dadosMod.departamento || 'FISCAL',
        periodicidade,
        mes_entrega: periodicidade === 'ANUAL' ? String(dadosMod.mes_entrega || '06').padStart(2, '0') : null,
        regimes_aplicaveis: Array.isArray(dadosMod.regimes_aplicaveis) && dadosMod.regimes_aplicaveis.length > 0
          ? dadosMod.regimes_aplicaveis
          : ['Simples Nacional'],
        dia_prazo_padrao: Number(dadosMod.dia_prazo_padrao || 15),
        antecipar_dia_util: anteciparDiaUtil,
        requer_pro_labore: requerProLabore,
        requer_funcionarios: requerFunc,
        requer_ie: requerIE,
        ativo: dadosMod.ativo !== false
      };
      lista.push(novo);
      this.saveLocalData();
      this.registrarLog('NOVO_MODELO_TAREFA', 'Tarefas', `Nova rotina "${novo.titulo}" adicionada para: ${novo.regimes_aplicaveis.join(', ')}.`);
      return novo;
    }

    alternarAtivoModeloTarefa(modId) {
      const lista = this.getModelosTarefas();
      const idx = lista.findIndex(m => m.id === modId);
      if (idx === -1) return null;
      lista[idx].ativo = !lista[idx].ativo;
      this.saveLocalData();
      return lista[idx];
    }

    excluirModeloTarefa(modId) {
      this.data.modelos_tarefas = this.getModelosTarefas().filter(m => m.id !== modId);
      this.saveLocalData();
    }
  }

  window.zgestorDB = new ZGestorDB();
})();
