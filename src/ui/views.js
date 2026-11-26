// =============================================================================
// ZGESTOR - Componentes Visuais e Telas dos Módulos Contábeis (Full-Width Layout)
// Inclui:
// - Tela Inicial com Honorários visível SOMENTE para quem tiver acesso (RLS)
// - Competência MM/AAAA com Vencimento/Entrega no Mês Subsequente (MM+1/AAAA)
// - Controle de Envio de Guias de Impostos (Simples Nacional DAS, DAE ICMS, DARF, FGTS)
// - Parcelamentos: Apenas Emitida e Enviada + Seletor de Status do Parcelamento
//   (Ativo, Ativo em Atraso, Encerrado por Falta de Pagamento, Encerrado por Opção)
// - Controle de CNDs (Certidões Negativas de Débitos) com cálculo automático de vigência
// - Central do Cliente (Visão 360° + Histórico de Solicitações, Documentos e Atendimentos)
// - Layout 100% responsivo em tela cheia sem necessidade de rolagem horizontal
// =============================================================================

window.ZGestorViews = {
  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  codLimpo(cod) {
    return String(cod === null || cod === undefined ? '' : cod).replace(/^#+/, '').trim();
  },

  obterEmp(db, empresaIdOuObj, fallbackObj = null) {
    if (!db) return null;
    if (typeof db.obterEmpresaSegura === 'function') {
      return db.obterEmpresaSegura(empresaIdOuObj, fallbackObj);
    }
    if (typeof empresaIdOuObj === 'object' && empresaIdOuObj !== null) return empresaIdOuObj;
    return (db.data?.empresas || []).find(e => e.id === empresaIdOuObj) || null;
  },

  nomeEmp(emp, opcoes = {}) {
    if (emp) {
      const cod = this.codLimpo(emp.codigo_interno);
      const razao = String(emp.razao_social || emp.nome_fantasia || emp.cnpj || '').trim();
      if (opcoes.comCodigo && cod) return `${cod} — ${razao}`;
      return razao || 'Sem Razão Social';
    }
    const fb = opcoes.fallbackObj || {};
    if (fb.cliente_avulso && fb.nome_cliente) return String(fb.nome_cliente).trim();
    const cand = String(opcoes.fallbackNome || fb.razao_social || fb.empresa_razao_social || fb.empresa_nome || fb.nome_cliente || '').trim();
    if (cand && cand.toLowerCase() !== 'empresa') return cand;
    return opcoes.vazioLabel || 'Cadastro não localizado';
  },

  renderBadgePreferenciaEnvio(emp, competenciaRef = null, mostrarObsInline = true) {
    const db = window.zgestorDB;
    if (!db || typeof db.ehOperadorInterno !== 'function' || !db.ehOperadorInterno() || !emp) return '';
    const comp = competenciaRef || (window.ZGestorApp?.state?.competencia || '10/2026');
    const pref = db.obterPreferenciaEnvioEmpresa(emp, comp);
    if (!pref) return '';

    const configMap = {
      IMPRESSO: {
        icone: '🖨️',
        label: 'Impresso',
        cls: 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200'
      },
      WHATSAPP: {
        icone: '💬',
        label: 'WhatsApp',
        cls: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
      },
      EMAIL: {
        icone: '✉️',
        label: 'E-mail',
        cls: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-300'
      },
      NAO_DEFINIDO: {
        icone: '⚙️',
        label: 'Definir Envio',
        cls: 'bg-slate-50 hover:bg-slate-100 text-slate-500 border-dashed border-slate-300'
      }
    };
    const cfg = configMap[pref.canal] || configMap.NAO_DEFINIDO;
    const obsTitle = pref.observacao
      ? `Preferência (${pref.competencia_inicio} em diante): ${cfg.label} — Obs: ${pref.observacao} (Clique p/ alterar)`
      : `Preferência interna de envio de guias/docs/honorários (${comp}). Clique para definir ou alterar de ${comp} p/ frente.`;

    return `
      <span class="inline-flex flex-wrap items-center gap-1">
        <button
          type="button"
          onclick="event.stopPropagation(); ZGestorApp.openModalPreferenciaEnvio('${this.escapeHtml(emp.id)}', '${this.escapeHtml(comp)}')"
          title="${this.escapeHtml(obsTitle)}"
          class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer ${cfg.cls}">
          <span>${cfg.icone}</span>
          <span>${cfg.label}</span>
        </button>
        ${mostrarObsInline && pref.observacao && pref.canal !== 'NAO_DEFINIDO' ? `
          <span class="text-[10px] text-slate-600 bg-amber-50/80 border border-amber-200 px-1.5 py-0.5 rounded font-medium max-w-[220px] truncate" title="${this.escapeHtml(pref.observacao)}">
            Obs: ${this.escapeHtml(pref.observacao)}
          </span>
        ` : ''}
      </span>
    `;
  },

  renderSeletorEmpresaBusca({
    uid,
    inputId,
    selectedId = '',
    placeholder = 'Digite código, razão social ou CNPJ...',
    onChangeFn = '',
    allowAllOption = false,
    allOptionValue = 'TODOS',
    allOptionLabel = 'Todas as Empresas'
  }) {
    const db = window.zgestorDB;
    const empresas = db?.data?.empresas || [];
    const empSel = (selectedId && selectedId !== allOptionValue)
      ? empresas.find(e => e.id === selectedId)
      : null;
    const textoInicial = allowAllOption && selectedId === allOptionValue
      ? ''
      : (empSel ? `${this.codLimpo(empSel.codigo_interno) ? this.codLimpo(empSel.codigo_interno) + ' — ' : ''}${empSel.razao_social || empSel.nome_fantasia} (${empSel.cnpj})` : '');
    const safeUid = String(uid || inputId || 'emp-cbx').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeChange = onChangeFn ? this.escapeHtml(onChangeFn) : '';

    return `
      <div class="relative zgestor-emp-combobox" id="emp-cbx-wrap-${safeUid}" data-cbx-uid="${safeUid}" data-input-id="${inputId}" data-onchange="${safeChange}" data-allow-all="${allowAllOption ? '1' : '0'}" data-all-val="${allOptionValue}" data-all-label="${this.escapeHtml(allOptionLabel)}">
        <input type="hidden" id="${inputId}" value="${this.escapeHtml(selectedId || '')}" />
        <div class="relative flex items-center">
          <span class="absolute left-2.5 text-slate-400 pointer-events-none">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </span>
          <input
            type="text"
            id="emp-cbx-search-${safeUid}"
            autocomplete="off"
            value="${this.escapeHtml(textoInicial)}"
            placeholder="${this.escapeHtml(placeholder)}"
            onfocus="ZGestorApp.abrirComboboxEmpresa('${safeUid}')"
            onclick="ZGestorApp.abrirComboboxEmpresa('${safeUid}')"
            oninput="ZGestorApp.filtrarComboboxEmpresa('${safeUid}', this.value)"
            onkeydown="ZGestorApp.aoTeclarComboboxEmpresa(event, '${safeUid}')"
            class="w-full rounded-xl border border-slate-300 bg-white pl-8 pr-8 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400"
          />
          <button
            type="button"
            onclick="event.stopPropagation(); ZGestorApp.toggleComboboxEmpresa('${safeUid}')"
            class="absolute right-2 p-0.5 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
            title="Ver lista de empresas">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
          </button>
        </div>
        <div
          id="emp-cbx-menu-${safeUid}"
          class="hidden absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-xl bg-white border border-slate-200 shadow-2xl py-1 text-xs divide-y divide-slate-100">
        </div>
      </div>
    `;
  },

  formatCurrency(val) {
    const num = Number(val || 0);
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  },

  formatDate(dateStr) {
    if (!dateStr) return '—';
    const parts = String(dateStr).slice(0, 10).split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  },

  deptBadge(deptId) {
    const map = {
      FISCAL: 'bg-blue-100 text-blue-800 border-blue-200',
      CONTABIL: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      PESSOAL: 'bg-purple-100 text-purple-800 border-purple-200',
      FINANCEIRO: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      SOCIETARIO: 'bg-amber-100 text-amber-800 border-amber-200',
      TODOS: 'bg-slate-800 text-white border-slate-700'
    };
    const labelMap = {
      FISCAL: 'Fiscal',
      CONTABIL: 'Contábil',
      PESSOAL: 'Pessoal (DP)',
      FINANCEIRO: 'Financeiro',
      SOCIETARIO: 'Societário',
      TODOS: 'Todos'
    };
    const cls = map[deptId] || 'bg-slate-100 text-slate-700 border-slate-200';
    return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls}">${labelMap[deptId] || deptId}</span>`;
  },

  statusTarefaBadge(tarefa) {
    const hoje = new Date().toISOString().slice(0, 10);
    if (tarefa.data_entrega) {
      if (tarefa.data_entrega <= tarefa.prazo_entrega) {
        return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <i data-lucide="check-circle-2" class="w-3 h-3"></i> No Prazo
        </span>`;
      } else {
        const dPrazo = new Date(tarefa.prazo_entrega + 'T00:00:00');
        const dEnt = new Date(tarefa.data_entrega + 'T00:00:00');
        const dias = Math.round((dEnt - dPrazo) / (1000 * 60 * 60 * 24));
        return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-300" title="Entregue com ${dias} dia(s) de atraso">
          <i data-lucide="clock-alert" class="w-3 h-3"></i> C/ Atraso (+${dias}d)
        </span>`;
      }
    }

    if (tarefa.prazo_entrega < hoje) {
      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
        <i data-lucide="alert-triangle" class="w-3 h-3"></i> Vencida
      </span>`;
    }

    if (tarefa.status === 'EM_ANDAMENTO') {
      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-800 border border-sky-200">
        🔄 Em Andamento
      </span>`;
    }

    if (tarefa.status === 'AGUARDANDO_DOCS') {
      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
        📄 Aguardando Docs
      </span>`;
    }

    if (tarefa.status === 'PENDENTE') {
      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-300">
        ⚠ Pendente
      </span>`;
    }

    return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-300">
      <i data-lucide="circle" class="w-3 h-3 text-slate-400"></i> Não Iniciada
    </span>`;
  },

  statusParcelamentoLabel(st) {
    const map = {
      ATIVO: { label: 'Ativo (Em Dia)', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
      EM_ATRASO: { label: 'Ativo em Atraso', cls: 'bg-rose-100 text-rose-800 border-rose-300' },
      ENCERRADO_FALTA_PAGAMENTO: { label: 'Encerrado p/ Falta de Pagto', cls: 'bg-amber-100 text-amber-900 border-amber-300' },
      ENCERRADO_OPCAO: { label: 'Encerrado p/ Opção / Quitação', cls: 'bg-slate-200 text-slate-800 border-slate-300' }
    };
    return map[st] || map.ATIVO;
  },

  calcularStatusCertificado(dataValidade) {
    if (!dataValidade) {
      return {
        label: 'Não informado',
        status: 'SEM_INFO',
        alerta: false,
        cls: 'text-slate-500 bg-slate-50 border-slate-200'
      };
    }
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const val = new Date(dataValidade + 'T00:00:00');
    const diffTime = val.getTime() - hoje.getTime();
    const diffDias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const dia = String(val.getDate()).padStart(2, '0');
    const mes = String(val.getMonth() + 1).padStart(2, '0');
    const ano = val.getFullYear();
    const dataFmt = `${dia}/${mes}/${ano}`;

    if (diffDias < 0) {
      return {
        label: `Vencido (${dataFmt})`,
        dias: diffDias,
        alerta: true,
        status: 'VENCIDO',
        cls: 'text-rose-700 bg-rose-50 border-rose-300 font-bold'
      };
    }
    if (diffDias <= 30) {
      return {
        label: `Vence em ${diffDias}d (${dataFmt})`,
        dias: diffDias,
        alerta: true,
        status: 'A_VENCER',
        cls: 'text-amber-800 bg-amber-50 border-amber-300 font-bold'
      };
    }
    return {
      label: `Válido até ${dataFmt}`,
      dias: diffDias,
      alerta: false,
      status: 'VALIDO',
      cls: 'text-emerald-700 bg-emerald-50 border-emerald-200'
    };
  },

  // ===========================================================================
  // 1. DASHBOARD EXECUTIVO
  // (HONORÁRIOS EXIBIDO SOMENTE PARA QUEM TEM ACESSO: ADMIN OU FINANCEIRO)
  // ===========================================================================
  renderDashboard(appState = {}) {
    const db = window.zgestorDB;
    const comp = appState.competencia || (db.data && db.data.competencia_ativa) || '10/2026';
    const sub = db.obterMesSubsequente(comp);
    const user = db.getCurrentUser() || { nome: 'Administrador', departamento: 'TODOS', cargo: 'ADMIN' };
    const canSeeHon = db.canAccessModule('honorarios', user);
    const hoje = new Date().toISOString().slice(0, 10);

    db.sincronizarSaldosAnterioresHonorarios(comp);
    db.sincronizarPendenciasParcelamento(comp);

    const empresasAtivas = db.data.empresas.filter(e => e.status === 'ATIVA');
    const empresasOnboardingPendentes = db.data.empresas.filter(e => {
      const prog = db.obterProgressoOnboarding(e.id);
      return e.status === 'EM_ONBOARDING' && !prog.completo;
    });

    const tarefasVisiveis = db.getTarefasVisiveis(true).filter(t => t.competencia === comp);
    const tarefasEntreguesPrazo = tarefasVisiveis.filter(t => t.data_entrega && t.data_entrega <= t.prazo_entrega);
    const tarefasEntreguesAtraso = tarefasVisiveis.filter(t => t.data_entrega && t.data_entrega > t.prazo_entrega);
    const tarefasPendentes = tarefasVisiveis.filter(t => !t.data_entrega);
    const tarefasVencidas = tarefasPendentes.filter(t => t.prazo_entrega < hoje);

    const guiasImpostosComp = db.getGuiasImpostos(comp);
    const guiasImpostosEnviadas = guiasImpostosComp.filter(g => g.status_envio === 'ENVIADA_CLIENTE');

    const guiasComp = db.data.parcelamento_guias.filter(g => g.competencia === comp);
    const guiasEnviadasParc = guiasComp.filter(g => g.status_guia === 'ENVIADA_CLIENTE');
    const parcelamentosEmAtraso = db.data.parcelamentos.filter(p => p.status === 'EM_ATRASO' || p.status === 'ENCERRADO_FALTA_PAGAMENTO');

    const cnds = db.getCNDs();
    const cndsAlertas = cnds.filter(c => {
      const st = db.calcularStatusValidadeCND(c);
      return st.codigo === 'VENCIDA' || st.codigo === 'PENDENCIA' || st.codigo === 'VENCENDO';
    });
    const cndsVigentes = cnds.filter(c => db.calcularStatusValidadeCND(c).codigo === 'VIGENTE');

    const honComp = db.data.honorarios.filter(h => h.competencia === comp);
    const totalHonPrevisto = honComp.reduce((s, h) => s + (Number(h.valor_mensal) + Number(h.saldo_anterior || 0) + Number(h.servicos_extras) - Number(h.desconto)), 0);
    const totalHonPago = honComp.reduce((s, h) => s + Number(h.valor_pago), 0);
    const totalHonAberto = honComp.reduce((s, h) => s + Number(h.saldo_aberto), 0);

    const depts = ['FISCAL', 'CONTABIL', 'PESSOAL', 'FINANCEIRO', 'SOCIETARIO'];
    const deptStats = depts.map(d => {
      const todas = db.data.tarefas.filter(t => t.competencia === comp && t.departamento === d);
      const concluidas = todas.filter(t => Boolean(t.data_entrega));
      const perc = todas.length > 0 ? Math.round((concluidas.length / todas.length) * 100) : 0;
      return { id: d, total: todas.length, concluidas: concluidas.length, perc };
    });

    const chamadosAguardando = (db.data.central_cliente_registros || []).filter(r => r.status === 'PENDENTE' || r.status === 'EM_ANDAMENTO');
    const chamadosNovos = (db.data.central_cliente_registros || []).filter(r => r.status === 'PENDENTE');

    return `
      <div class="space-y-5">
        <!-- Banner de Boas-vindas e Regra de Competência x Vencimento -->
        <div class="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-5 text-white shadow-lg flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div class="flex flex-wrap items-center gap-2 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-1">
              <span class="inline-flex items-center gap-1"><i data-lucide="calendar-clock" class="w-4 h-4"></i> Competência ${comp}</span>
              <span>•</span>
              <span>Usuário: ${user.nome} (${user.departamento})</span>
            </div>
            <h1 class="text-xl sm:text-2xl font-bold">Painel Executivo — Competência ${comp}</h1>
            <p class="text-slate-300 text-xs sm:text-sm mt-1">
              Obrigações mensais, envio de guias, parcelamentos e certidões negativas da carteira de clientes.
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button onclick="ZGestorReports.emitirRelatorioAba('dashboard', ZGestorApp.state)" class="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white font-semibold text-xs flex items-center gap-1.5 transition">
              <i data-lucide="printer" class="w-4 h-4"></i>
              Relatório Gerencial
            </button>
            <button onclick="ZGestorApp.gerarRotinaCompletaMes()" class="px-3.5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-semibold text-xs shadow flex items-center gap-1.5 transition">
              <i data-lucide="sparkles" class="w-4 h-4"></i>
              Gerar Competência ${comp}
            </button>
          </div>
        </div>

        <!-- Alerta de Chamados / Solicitações Abertas no Portal do Cliente -->
        ${chamadosAguardando.length > 0 ? `
          <div class="bg-gradient-to-r from-amber-500/10 via-amber-50 to-orange-50 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div class="flex items-start sm:items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow">
                <i data-lucide="bell-ring" class="w-5 h-5 animate-pulse"></i>
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-200 text-amber-900">
                    Atenção da Equipe
                  </span>
                  <span class="text-xs font-bold text-amber-900">
                    ${chamadosNovos.length} solicitação(ões) nova(s) aguardando atendimento
                  </span>
                </div>
                <p class="text-xs text-amber-800 mt-0.5">
                  Há <strong>${chamadosAguardando.length} chamado(s) aberto(s)</strong> por clientes no Portal que requerem resposta ou providências dos departamentos do escritório.
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button onclick="ZGestorApp.state.subTabCentralCliente = 'solicitacoes_portal'; ZGestorApp.navigate('central_cliente')"
                class="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition">
                <i data-lucide="message-square" class="w-4 h-4"></i>
                Atender Chamados no Portal →
              </button>
            </div>
          </div>
        ` : ''}

        <!-- KPIs Principais (Honorários exibido SOMENTE se canSeeHon === true) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${canSeeHon ? 'xl:grid-cols-6' : 'xl:grid-cols-5'} gap-3.5">
          <!-- Card 1: Empresas & Central do Cliente -->
          <div class="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer" onclick="ZGestorApp.navigate('central_cliente')">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Carteira & Central 360°</span>
              <div class="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <i data-lucide="building-2" class="w-4 h-4"></i>
              </div>
            </div>
            <div class="mt-2.5 flex items-baseline gap-2">
              <span class="text-2xl font-extrabold text-slate-900">${db.data.empresas.length}</span>
              <span class="text-xs font-medium text-slate-500">empresas</span>
            </div>
            <div class="mt-2.5 flex items-center justify-between text-[11px] pt-2.5 border-t border-slate-100">
              <span class="text-emerald-700 font-semibold">${empresasAtivas.length} Ativas</span>
              <span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">${empresasOnboardingPendentes.length} Onboarding</span>
            </div>
          </div>

          <!-- Card 2: Chamados do Portal do Cliente (Alerta & Indicador) -->
          <div class="bg-white rounded-2xl p-4 border ${chamadosNovos.length > 0 ? 'border-amber-300 ring-2 ring-amber-400/20 bg-amber-50/15' : 'border-slate-200'} shadow-sm hover:shadow-md transition cursor-pointer" onclick="ZGestorApp.state.subTabCentralCliente = 'solicitacoes_portal'; ZGestorApp.navigate('central_cliente')">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold uppercase tracking-wider ${chamadosNovos.length > 0 ? 'text-amber-800 font-extrabold' : 'text-slate-500'}">Chamados do Portal</span>
              <div class="w-9 h-9 rounded-xl ${chamadosNovos.length > 0 ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'} flex items-center justify-center relative">
                <i data-lucide="message-square" class="w-4 h-4"></i>
                ${chamadosNovos.length > 0 ? `<span class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white animate-ping"></span><span class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white"></span>` : ''}
              </div>
            </div>
            <div class="mt-2.5 flex items-baseline gap-2">
              <span class="text-2xl font-extrabold ${chamadosNovos.length > 0 ? 'text-amber-900' : 'text-slate-900'}">${chamadosNovos.length}</span>
              <span class="text-xs font-medium text-slate-500">aguardando retorno</span>
            </div>
            <div class="mt-2.5 flex items-center justify-between text-[11px] pt-2.5 border-t border-slate-100">
              <span class="${chamadosAguardando.length > 0 ? 'text-amber-700 font-bold' : 'text-slate-500'}">${chamadosAguardando.length} em aberto</span>
              <span class="text-indigo-600 font-semibold hover:underline">Ver no Portal →</span>
            </div>
          </div>

          <!-- Card 3: Entregas da Competência & Envio de Guias -->
          <div class="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer" onclick="ZGestorApp.navigate('tarefas')">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tarefas & Guias (${comp})</span>
              <div class="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <i data-lucide="check-square" class="w-4 h-4"></i>
              </div>
            </div>
            <div class="mt-2.5 flex items-baseline gap-2">
              <span class="text-2xl font-extrabold text-slate-900">${tarefasEntreguesPrazo.length + tarefasEntreguesAtraso.length}/${tarefasVisiveis.length}</span>
              <span class="text-xs font-medium text-slate-500">tarefas • ${guiasImpostosEnviadas.length}/${guiasImpostosComp.length} guias</span>
            </div>
            <div class="mt-2.5 flex items-center justify-between text-[11px] pt-2.5 border-t border-slate-100">
              <span class="text-emerald-700 font-semibold">${tarefasEntreguesPrazo.length} no prazo</span>
              ${tarefasVencidas.length > 0
        ? `<span class="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold">${tarefasVencidas.length} vencida(s)</span>`
        : `<span class="text-slate-500">${tarefasPendentes.length} pendentes</span>`}
            </div>
          </div>

          <!-- Card 3: Guias de Parcelamentos -->
          <div class="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer" onclick="ZGestorApp.navigate('parcelamentos')">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Parcelamentos (${comp})</span>
              <div class="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <i data-lucide="layers" class="w-4 h-4"></i>
              </div>
            </div>
            <div class="mt-2.5 flex items-baseline gap-2">
              <span class="text-2xl font-extrabold text-slate-900">${guiasEnviadasParc.length}/${guiasComp.length}</span>
              <span class="text-xs font-medium text-slate-500">guias enviadas</span>
            </div>
            <div class="mt-2.5 flex items-center justify-between text-[11px] pt-2.5 border-t border-slate-100">
              <span class="text-slate-600 font-semibold">${db.data.parcelamentos.length} acordos</span>
              ${parcelamentosEmAtraso.length > 0
        ? `<span class="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">${parcelamentosEmAtraso.length} em atraso</span>`
        : `<span class="text-emerald-700 font-semibold">Todos em dia</span>`}
            </div>
          </div>

          <!-- Card 4: Controle de CNDs -->
          <div class="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer" onclick="ZGestorApp.navigate('cnds')">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Controle de CNDs</span>
              <div class="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <i data-lucide="file-badge" class="w-4 h-4"></i>
              </div>
            </div>
            <div class="mt-2.5 flex items-baseline gap-2">
              <span class="text-2xl font-extrabold text-slate-900">${cndsVigentes.length}/${cnds.length}</span>
              <span class="text-xs font-medium text-slate-500">certidões vigentes</span>
            </div>
            <div class="mt-2.5 flex items-center justify-between text-[11px] pt-2.5 border-t border-slate-100">
              <span class="text-emerald-700 font-semibold">${cndsVigentes.length} regulares</span>
              ${cndsAlertas.length > 0
        ? `<span class="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">${cndsAlertas.length} alerta(s)/venc.</span>`
        : `<span class="text-slate-500">Sem pendências</span>`}
            </div>
          </div>

          <!-- Card 5: Honorários (EXIBIDO APENAS PARA QUEM TEM ACESSO!) -->
          ${canSeeHon ? `
            <div class="bg-white rounded-2xl p-4 border border-emerald-200 shadow-sm hover:shadow-md transition cursor-pointer" onclick="ZGestorApp.navigate('honorarios')">
              <div class="flex items-center justify-between">
                <span class="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Honorários (${comp})</span>
                <div class="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <i data-lucide="wallet" class="w-4 h-4"></i>
                </div>
              </div>
              <div class="mt-2.5">
                <div class="text-[11px] text-slate-500">Em Aberto (c/ Mês Ant.):</div>
                <div class="text-xl font-extrabold text-rose-600">${this.formatCurrency(totalHonAberto)}</div>
              </div>
              <div class="mt-2.5 flex items-center justify-between text-[11px] pt-2.5 border-t border-slate-100">
                <span class="text-emerald-700 font-semibold">Pago: ${this.formatCurrency(totalHonPago)}</span>
                <span class="text-slate-500">Total: ${this.formatCurrency(totalHonPrevisto)}</span>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Progresso por Departamento e Próximos Prazos -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm lg:col-span-1">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h2 class="text-sm font-bold text-slate-900">Entregas por Departamento</h2>
                <p class="text-xs text-slate-500">Competência ${comp}</p>
              </div>
            </div>
            <div class="space-y-3.5">
              ${deptStats.map(st => `
                <div>
                  <div class="flex items-center justify-between text-xs mb-1">
                    <div>${this.deptBadge(st.id)}</div>
                    <span class="font-bold text-slate-700">${st.concluidas}/${st.total} (${st.perc}%)</span>
                  </div>
                  <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div class="h-full bg-indigo-600 rounded-full transition-all duration-300" style="width: ${st.perc}%"></div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm lg:col-span-2">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h2 class="text-sm font-bold text-slate-900">Próximos Prazos de Entrega — Comp. ${comp}</h2>
                <p class="text-xs text-slate-500">Tarefas pendentes ordenadas pela data limite no mês seguinte</p>
              </div>
              <button onclick="ZGestorApp.openModalTarefa()" class="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs flex items-center gap-1">
                <i data-lucide="plus" class="w-3.5 h-3.5"></i> Nova Tarefa / Solicitação
              </button>
            </div>

            <div class="overflow-x-auto w-full">
              <table class="w-full min-w-[650px] text-left border-collapse">
              <thead>
                <tr class="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                  <th class="py-2 pr-2">Cliente</th>
                  <th class="py-2 px-2">Setor / Tipo</th>
                  <th class="py-2 px-2">Tarefa / Obrigação</th>
                  <th class="py-2 px-2">Prazo (${sub.label})</th>
                  <th class="py-2 pl-2 text-right">Situação & Acesso</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-xs">
                ${tarefasPendentes
        .sort((a, b) => a.prazo_entrega.localeCompare(b.prazo_entrega))
        .slice(0, 6)
        .map(t => {
          const emp = this.obterEmp(db, t.empresa_id, t);
          const codEmp = emp ? this.codLimpo(emp.codigo_interno) : '';
          const vencida = t.prazo_entrega < hoje;
          return `
                      <tr class="hover:bg-slate-50">
                        <td class="py-2.5 pr-2 font-bold text-slate-900">
                          ${codEmp ? `<span class="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 font-mono text-[10px] font-extrabold mr-1">${this.escapeHtml(codEmp)}</span>` : ''}
                          <span>${this.escapeHtml(this.nomeEmp(emp, { fallbackObj: t }))}</span>
                        </td>
                        <td class="py-2.5 px-2">
                          ${this.deptBadge(t.departamento)}
                          <span class="ml-1 text-[10px] px-1.5 py-0.5 rounded font-semibold ${t.tipo === 'AVULSA' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}">${t.tipo}</span>
                        </td>
                        <td class="py-2.5 px-2">
                          <div class="font-semibold text-slate-800 flex items-center gap-1.5 flex-wrap">
                            <span>${this.escapeHtml(t.titulo)}</span>
                            ${(t.origem === 'PORTAL_CLIENTE' || (t.titulo && t.titulo.startsWith('[Portal do Cliente]'))) ? `
                              <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200">
                                🌐 Portal do Cliente
                              </span>
                            ` : ''}
                          </div>
                          <div class="text-[11px] text-slate-500">Resp: ${t.responsavel_nome || '—'}</div>
                        </td>
                        <td class="py-2.5 px-2 font-bold ${vencida ? 'text-rose-600' : 'text-slate-700'}">
                          ${this.formatDate(t.prazo_entrega)}
                          ${vencida ? '<span class="block text-[10px] uppercase font-bold text-rose-600">Vencida!</span>' : ''}
                        </td>
                        <td class="py-2.5 pl-2 text-right">
                          <div class="inline-flex items-center gap-2 justify-end">
                            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${vencida ? 'bg-rose-50 text-rose-700 border border-rose-200' : (t.status === 'EM_ANDAMENTO' ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-amber-50 text-amber-700 border border-amber-200')}">
                              <span class="w-1.5 h-1.5 rounded-full ${vencida ? 'bg-rose-500' : (t.status === 'EM_ANDAMENTO' ? 'bg-sky-500' : 'bg-amber-500')}"></span>
                              ${vencida ? 'Atrasada' : (t.status === 'EM_ANDAMENTO' ? 'Em Andamento' : 'Pendente')}
                            </span>
                            <button
                              onclick="ZGestorApp.irParaTarefa('${t.id}', '${t.empresa_id}')"
                              class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 border border-slate-200 text-slate-700 text-[11px] font-bold inline-flex items-center gap-1 transition"
                              title="Ir direto para a obrigação na Gestão de Tarefas">
                              <span>Ver Tarefa</span>
                              <i data-lucide="arrow-right" class="w-3 h-3"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    `;
        }).join('') || `
                    <tr>
                      <td colspan="5" class="py-6 text-center text-slate-400">
                        Nenhuma tarefa pendente para o seu setor na competência ${comp}.
                      </td>
                    </tr>
                  `}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // ===========================================================================
  // 2. GESTÃO DE TAREFAS MENSAIS, VISÃO GERAL DE FECHAMENTOS CONTÁBEIS (ANUAL)
  //    E CONTROLE DE ENVIO DE GUIAS
  //    - Status: PENDENTE, EM_ANDAMENTO e ENTREGUE com Observação em qualquer opção
  //    - Visão Mensal + Visão Geral Anual (Matriz Jan-Dez p/ Fechamentos Contábeis)
  // ===========================================================================
  renderTarefas(appState) {
    const db = window.zgestorDB;
    const user = db.getCurrentUser();
    const comp = appState.competencia || (db && db.data ? db.data.competencia_ativa : '10/2026') || '10/2026';
    const sub = db.obterMesSubsequente(comp);
    const subTab = appState.subTabTarefas || 'obrigacoes'; // 'obrigacoes' | 'fechamentos_geral' | 'guias_impostos'
    const fCliente = appState.filtroTarefaCliente || 'TODOS';
    const fDept = appState.filtroTarefaDept || 'TODOS';
    const fModalidade = appState.filtroTarefaModalidade || 'TODOS';
    const fObrigacao = appState.filtroTarefaObrigacao || 'TODOS';
    const fStatus = appState.filtroTarefaStatus || 'TODOS';
    const fBusca = (appState.filtroTarefaBusca || '').toLowerCase().trim();
    const fGuiaTipo = appState.filtroGuiaImpostoTipo || 'TODOS';
    const fGuiaStatus = appState.filtroGuiaImpostoStatus || 'TODOS';
    const anoFechamento = Number(appState.anoFechamentoContabil || (comp && comp.includes('/') ? comp.split('/')[1] : 2026));
    const fSetorFechamento = appState.filtroSetorFechamento || 'CONTABIL';
    const fStatusGeral = appState.filtroStatusGeralAnual || 'TODOS';
    const rlsAtivo = appState.rlsFiltroSetor !== false;
    const hoje = new Date().toISOString().slice(0, 10);

    // 1. Filtra Tarefas e Solicitações Avulsas da Competência Selecionada
    let lista = db.getTarefasVisiveis(rlsAtivo).filter(t => t.competencia === comp);

    const fDeptAtual = appState.filtroTarefaDept || 'TODOS';
    const fRegimeAtual = appState.filtroEmpresaRegime || 'TODOS';

    if (fDeptAtual !== 'TODOS') lista = lista.filter(t => t.departamento === fDeptAtual);
    if (fRegimeAtual !== 'TODOS') {
      lista = lista.filter(t => {
        const emp = this.obterEmp(db, t.empresa_id, t);
        return emp && emp.regime_tributario === fRegimeAtual;
      });
    }

    if (fCliente !== 'TODOS') lista = lista.filter(t => t.empresa_id === fCliente);
    if (fModalidade !== 'TODOS') lista = lista.filter(t => t.tipo === fModalidade);
    if (fObrigacao !== 'TODOS') lista = lista.filter(t => (t.titulo || '') === fObrigacao);
    if (fStatus !== 'TODOS') {
      if (fStatus === 'NAO_INICIADA') {
        lista = lista.filter(t => db.obterStatusSimplesTarefa(t) === 'NAO_INICIADA');
      } else if (fStatus === 'PENDENTE') {
        lista = lista.filter(t => db.obterStatusSimplesTarefa(t) === 'PENDENTE');
      } else if (fStatus === 'AGUARDANDO_DOCS') {
        lista = lista.filter(t => db.obterStatusSimplesTarefa(t) === 'AGUARDANDO_DOCS');
      } else if (fStatus === 'EM_ANDAMENTO') {
        lista = lista.filter(t => db.obterStatusSimplesTarefa(t) === 'EM_ANDAMENTO');
      } else if (fStatus === 'ENTREGUE') {
        lista = lista.filter(t => db.obterStatusSimplesTarefa(t) === 'ENTREGUE');
      } else if (fStatus === 'PENDENTES_GERAL') {
        lista = lista.filter(t => !t.data_entrega);
      } else if (fStatus === 'ATRASADAS') {
        lista = lista.filter(t => !t.data_entrega && t.prazo_entrega < hoje);
      } else if (fStatus === 'ENTREGUE_NO_PRAZO') {
        lista = lista.filter(t => t.data_entrega && t.data_entrega <= t.prazo_entrega);
      } else if (fStatus === 'ENTREGUE_COM_ATRASO') {
        lista = lista.filter(t => t.data_entrega && t.data_entrega > t.prazo_entrega);
      }
    }
    if (fBusca) {
      lista = lista.filter(t => {
        const emp = this.obterEmp(db, t.empresa_id, t);
        const empNome = emp ? `${emp.codigo_interno || ''} ${emp.razao_social || ''} ${emp.nome_fantasia || ''} ${emp.cnpj || ''}`.toLowerCase() : '';
        return (
          (t.titulo || '').toLowerCase().includes(fBusca) ||
          (t.descricao || '').toLowerCase().includes(fBusca) ||
          (t.motivo_pendencia || '').toLowerCase().includes(fBusca) ||
          (t.protocolo_observacao || '').toLowerCase().includes(fBusca) ||
          (t.solicitante || '').toLowerCase().includes(fBusca) ||
          (t.responsavel_nome || '').toLowerCase().includes(fBusca) ||
          empNome.includes(fBusca)
        );
      });
    }
    lista.sort((a, b) => (a.prazo_entrega || '').localeCompare(b.prazo_entrega || ''));

    // Contadores rápidos da competência (uma única passada O(N))
    const todasComp = db.getTarefasVisiveis(rlsAtivo).filter(t => t.competencia === comp);
    let qtdNaoIniciadasComp = 0;
    let qtdPendentesComp = 0;
    let qtdAguardandoDocsComp = 0;
    let qtdAndamentoComp = 0;
    let qtdEntreguesComp = 0;
    for (let i = 0; i < todasComp.length; i++) {
      const stS = db.obterStatusSimplesTarefa(todasComp[i]);
      if (stS === 'NAO_INICIADA') qtdNaoIniciadasComp++;
      else if (stS === 'PENDENTE') qtdPendentesComp++;
      else if (stS === 'AGUARDANDO_DOCS') qtdAguardandoDocsComp++;
      else if (stS === 'EM_ANDAMENTO') qtdAndamentoComp++;
      else if (stS === 'ENTREGUE' || stS === 'CONFERIDO') qtdEntreguesComp++;
    }

    // 2. Filtra Guias de Impostos (somente executa filtros pesados quando na sub-aba guias_impostos)
    const ehGuiaDigital = (g) => Boolean(g.arquivada_digital || ['WhatsApp', 'E-mail'].includes(g.canal_envio) || ['ENVIADA_WHATSAPP', 'ENVIADA_EMAIL', 'ENVIADA_CLIENTE', 'VISUALIZADA_CLIENTE'].includes(g.status_envio));
    const todasGuiasComp = db.getGuiasParaEntregaNaCompetencia(comp) || [];
    let listaGuiasImpostos = subTab === 'guias_impostos' ? [...todasGuiasComp] : [];
    const fPrefGuia = appState.filtroGuiaPreferenciaEnvio || 'TODOS';
    if (subTab === 'guias_impostos') {
      if (fCliente !== 'TODOS') listaGuiasImpostos = listaGuiasImpostos.filter(g => g.empresa_id === fCliente);
      if (fGuiaTipo !== 'TODOS') {
        listaGuiasImpostos = listaGuiasImpostos.filter(g => {
          const tg = String(g.tipo_guia || '');
          if (fGuiaTipo === 'Parcelamento') return tg.startsWith('Parcelamento');
          if (fGuiaTipo.includes('IRPJ')) return tg.includes('IRPJ') || tg.includes('CSLL');
          if (fGuiaTipo.includes('PIS')) return tg.includes('PIS') || tg.includes('COFINS');
          if (fGuiaTipo.includes('ICMS')) return tg.includes('ICMS');
          if (/\bISS\b/i.test(fGuiaTipo)) return /\bISS\b/i.test(tg);
          return tg === fGuiaTipo;
        });
      }
      if (fGuiaStatus !== 'TODOS') {
        if (fGuiaStatus === 'PENDENTES') {
          listaGuiasImpostos = listaGuiasImpostos.filter(g => !['IMPRESSA_OFFICE_BOY', 'ENVIADA_WHATSAPP', 'ENVIADA_EMAIL', 'ARQUIVADA_ASSINADA', 'ENVIADA_CLIENTE', 'VISUALIZADA_CLIENTE'].includes(g.status_envio));
        } else if (fGuiaStatus === 'ENVIADAS_DIGITAIS') {
          listaGuiasImpostos = listaGuiasImpostos.filter(ehGuiaDigital);
        } else {
          listaGuiasImpostos = listaGuiasImpostos.filter(g => g.status_envio === fGuiaStatus);
        }
      }
      if (fPrefGuia !== 'TODOS' && db.ehOperadorInterno && db.ehOperadorInterno()) {
        listaGuiasImpostos = listaGuiasImpostos.filter(g => {
          const emp = this.obterEmp(db, g.empresa_id, g);
          const pref = emp ? db.obterPreferenciaEnvioEmpresa(emp, comp) : null;
          const canalPref = pref ? pref.canal : 'NAO_DEFINIDO';
          return canalPref === fPrefGuia;
        });
      }
      if (fBusca) {
        listaGuiasImpostos = listaGuiasImpostos.filter(g => {
          const emp = this.obterEmp(db, g.empresa_id, g);
          const empNome = emp ? `${emp.codigo_interno || ''} ${emp.razao_social || ''} ${emp.nome_fantasia || ''} ${emp.cnpj || ''}`.toLowerCase() : '';
          return (
            (g.tipo_guia || '').toLowerCase().includes(fBusca) ||
            (g.observacoes || '').toLowerCase().includes(fBusca) ||
            empNome.includes(fBusca)
          );
        });
      }
    }

    // 3. Dados para a Sub-Aba 2: Visão Geral & Controle de Fechamentos Contábeis (calculados apenas quando ativa)
    const mesesRaw = (window.ZGESTOR_MODELS && window.ZGESTOR_MODELS.mesesAno) || [
      { num: '01', curto: 'Jan', nome: 'Janeiro' },
      { num: '02', curto: 'Fev', nome: 'Fevereiro' },
      { num: '03', curto: 'Mar', nome: 'Março' },
      { num: '04', curto: 'Abr', nome: 'Abril' },
      { num: '05', curto: 'Mai', nome: 'Maio' },
      { num: '06', curto: 'Jun', nome: 'Junho' },
      { num: '07', curto: 'Jul', nome: 'Julho' },
      { num: '08', curto: 'Ago', nome: 'Agosto' },
      { num: '09', curto: 'Set', nome: 'Setembro' },
      { num: '10', curto: 'Out', nome: 'Outubro' },
      { num: '11', curto: 'Nov', nome: 'Novembro' },
      { num: '12', curto: 'Dez', nome: 'Dezembro' }
    ];
    const mesesLista = mesesRaw.map(m => ({
      ...m,
      curto: m.curto || m.abrev || (m.nome && m.nome.slice(0, 3)) || ''
    }));

    let empresasFechamento = [];
    let tarefasAnoGeral = [];
    if (subTab === 'fechamentos_geral') {
      empresasFechamento = [...db.data.empresas];
      if (fCliente !== 'TODOS') {
        empresasFechamento = empresasFechamento.filter(e => e.id === fCliente);
      }
      tarefasAnoGeral = db.getTarefasVisiveis(rlsAtivo).filter(t => String(t.competencia || '').endsWith(`/${anoFechamento}`));
      if (fSetorFechamento !== 'TODOS') {
        tarefasAnoGeral = tarefasAnoGeral.filter(t => t.departamento === fSetorFechamento);
      }
      if (fCliente !== 'TODOS') {
        tarefasAnoGeral = tarefasAnoGeral.filter(t => t.empresa_id === fCliente);
      }
      if (fStatusGeral !== 'TODOS') {
        tarefasAnoGeral = tarefasAnoGeral.filter(t => db.obterStatusSimplesTarefa(t) === fStatusGeral);
      }
      if (fBusca) {
        tarefasAnoGeral = tarefasAnoGeral.filter(t => {
          const emp = this.obterEmp(db, t.empresa_id, t);
          const empNome = emp ? `${emp.razao_social} ${emp.nome_fantasia}`.toLowerCase() : '';
          return (
            (t.titulo || '').toLowerCase().includes(fBusca) ||
            (t.protocolo_observacao || '').toLowerCase().includes(fBusca) ||
            (t.competencia || '').toLowerCase().includes(fBusca) ||
            empNome.includes(fBusca)
          );
        });
      }
      tarefasAnoGeral.sort((a, b) => {
        const [mA, yA] = String(a.competencia || '01/2026').split('/');
        const [mB, yB] = String(b.competencia || '01/2026').split('/');
        return `${yB}-${mB}`.localeCompare(`${yA}-${mA}`) || (a.empresa_id || '').localeCompare(b.empresa_id || '');
      });
    }

    const modelosTiposGuias = ((window.ZGESTOR_MODELS && window.ZGESTOR_MODELS.tiposGuiasImpostos) || []).map(tg =>
      typeof tg === 'string' ? { sigla: tg, departamento: 'FISCAL', dia_vencimento_padrao: 20 } : tg
    );

    const deptsAbas = [
      { id: 'TODOS', label: 'Todos os Setores' },
      { id: 'CONTABIL', label: 'Contábil' },
      { id: 'FISCAL', label: 'Fiscal' },
      { id: 'PESSOAL', label: 'Pessoal (DP)' },
      { id: 'FINANCEIRO', label: 'Financeiro' },
      { id: 'SOCIETARIO', label: 'Societário' }
    ];

    const statusGuiaImpBadge = (st, guiaObj = null) => {
      if (st === 'ARQUIVADA_ASSINADA') {
        if (guiaObj && (guiaObj.arquivada_digital || ['WhatsApp', 'E-mail'].includes(guiaObj.canal_envio))) {
          return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-900 border border-teal-300"><i data-lucide="folder-check" class="w-3 h-3"></i> Arquivada (${this.escapeHtml(guiaObj.canal_envio || 'Digital')})</span>`;
        }
        return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-900 border border-teal-300"><i data-lucide="folder-check" class="w-3 h-3"></i> Assinada e Arquivada</span>`;
      }
      if (st === 'IMPRESSA_OFFICE_BOY') {
        return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-900 border border-blue-300"><i data-lucide="printer" class="w-3 h-3"></i> Em Rota (Office Boy)</span>`;
      }
      if (st === 'ENVIADA_WHATSAPP') {
        return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300"><i data-lucide="message-circle" class="w-3 h-3"></i> Enviada (WhatsApp)</span>`;
      }
      if (st === 'ENVIADA_EMAIL') {
        return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300"><i data-lucide="mail" class="w-3 h-3"></i> Enviada (E-mail)</span>`;
      }
      if (st === 'VISUALIZADA_CLIENTE' || st === 'BAIXADA_VISUALIZADA') {
        return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-900 border border-teal-300"><i data-lucide="check-check" class="w-3 h-3"></i> Visualizada no Portal</span>`;
      }
      if (st === 'ENVIADA_CLIENTE') {
        return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200"><i data-lucide="send" class="w-3 h-3"></i> Enviada ao Cliente</span>`;
      }
      return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300"><i data-lucide="clock" class="w-3 h-3"></i> Pendente de Envio</span>`;
    };

    const renderNotionStatusPill = (t) => {
      const stAtual = db.obterStatusSimplesTarefa(t);
      if (stAtual === 'CONFERIDO') {
        return `
          <span
            title="Status: Fechado e Conferido (Auditado)"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-indigo-50 text-indigo-900 border border-indigo-300 shadow-2xs select-none cursor-default">
            <span class="w-2 h-2 rounded-full bg-indigo-600"></span>
            <span>⭐ Conferido</span>
          </span>
        `;
      }
      if (stAtual === 'NAO_INICIADA') {
        return `
          <span
            title="Status: Não iniciada"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs select-none cursor-default">
            <span class="w-2 h-2 rounded-full bg-slate-400"></span>
            <span>Não iniciada</span>
          </span>
        `;
      }
      if (stAtual === 'AGUARDANDO_DOCS') {
        return `
          <span
            title="Aguardando Documentos / Arquivos do Cliente"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs select-none cursor-default">
            <span class="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>Aguardando Docs</span>
          </span>
        `;
      }
      if (stAtual === 'PENDENTE') {
        const mot = this.escapeHtml(t?.motivo_pendencia || t?.protocolo_observacao || 'Pendente');
        return `
          <span
            title="Pendente — ${mot}"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-50 text-rose-800 border border-rose-300 shadow-2xs select-none cursor-default">
            <span class="w-2 h-2 rounded-full bg-rose-500"></span>
            <span>⚠ Pendente</span>
          </span>
        `;
      }
      if (stAtual === 'EM_ANDAMENTO') {
        return `
          <span
            title="Status: Em Andamento"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-300 shadow-2xs select-none cursor-default">
            <span class="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></span>
            <span>Em Andamento</span>
          </span>
        `;
      }
      if (t && t.modalidade_entrega === 'SEM_MOVIMENTO') {
        return `
          <span
            title="Concluído Sem Movimento"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-300 shadow-2xs select-none cursor-default">
            <span class="w-2 h-2 rounded-full bg-sky-500"></span>
            <span>Sem Movimento</span>
          </span>
        `;
      }
      return `
        <span
          title="Status: Concluído Normalmente"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs select-none cursor-default">
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Concluído</span>
        </span>
      `;
    };

    const renderSeletorStatusTarefa = renderNotionStatusPill;

    // Dados do Side Peek ativo (se selecionado)
    const sidePeekTarefa = appState.notionSidePeekTarefaId
      ? db.data.tarefas.find(item => item.id === appState.notionSidePeekTarefaId)
      : null;
    const sidePeekEmpresa = sidePeekTarefa
      ? db.data.empresas.find(e => e.id === sidePeekTarefa.empresa_id)
      : null;
    const sidePeekOutrasTarefas = (sidePeekTarefa && sidePeekEmpresa)
      ? db.data.tarefas.filter(item => item.empresa_id === sidePeekEmpresa.id && item.competencia === comp)
      : [];

    const colapsados = appState.notionGruposColapsados || {};

    return `
      <div class="space-y-4">
        <!-- Cabeçalho Limpo no Tema Padrão do ZGestor -->
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <div class="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 mb-0.5">
              <i data-lucide="calendar-clock" class="w-4 h-4"></i> Competência ${comp} (${db.formatarNomeCompetencia(comp)}) → Entrega em ${sub.label}
            </div>
            <h1 class="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>Gestão de Tarefas, Fechamentos & Obrigações</span>
              <button
                onclick="ZGestorApp.toggleCalendarioCompetencia(event)"
                class="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition">
                Mudar Mês ▾
              </button>
            </h1>
            <p class="text-xs text-slate-500">
              Controle de rotinas mensais e fechamentos organizado por departamentos e regimes tributários.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <button
              onclick="ZGestorReports.emitirRelatorioAba('tarefas', ZGestorApp.state)"
              class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition">
              <i data-lucide="printer" class="w-3.5 h-3.5"></i>
              <span>Relatório</span>
            </button>
            <button
              onclick="ZGestorApp.gerarTarefasMesAtual()"
              class="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold text-xs flex items-center gap-1.5 border border-indigo-300 transition cursor-pointer">
              <i data-lucide="zap" class="w-3.5 h-3.5 text-indigo-600"></i>
              <span>Gerar Rotinas (${comp})</span>
            </button>
            <button
              onclick="ZGestorApp.setFiltro('subTabTarefas', 'rotinas_config')"
              class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs flex items-center gap-1.5 border border-slate-200 transition cursor-pointer">
              <i data-lucide="settings-2" class="w-3.5 h-3.5 text-indigo-600"></i>
              <span>Definir Rotinas</span>
            </button>
            <button
              onclick="ZGestorApp.openModalGuiaImposto()"
              class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition">
              <i data-lucide="file-spreadsheet" class="w-3.5 h-3.5"></i>
              <span>+ Guia Imposto</span>
            </button>
            <button
              onclick="ZGestorApp.openModalTarefa('MENSAL')"
              class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition">
              <i data-lucide="plus" class="w-3.5 h-3.5"></i>
              <span>+ Nova Tarefa</span>
            </button>
          </div>
        </div>

        <!-- ABAS PRINCIPAIS DE NAVEGAÇÃO: DEPARTAMENTOS & ROTINAS -->
        <div class="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-2 text-xs">
          <div class="flex flex-wrap items-center gap-1.5">
            <button
              onclick="ZGestorApp.setFiltro('subTabTarefas', 'obrigacoes'); ZGestorApp.setNotionDept('TODOS')"
              class="px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition ${subTab === 'obrigacoes' && fDeptAtual === 'TODOS'
        ? 'bg-indigo-600 text-white shadow-xs'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}">
              <span>田</span>
              <span>Todos os Setores (${todasComp.length})</span>
            </button>
            <button
              onclick="ZGestorApp.setFiltro('subTabTarefas', 'obrigacoes'); ZGestorApp.setNotionDept('FISCAL')"
              class="px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition ${subTab === 'obrigacoes' && fDeptAtual === 'FISCAL'
        ? 'bg-orange-600 text-white shadow-xs'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}">
              <span>田</span>
              <span>Fiscal</span>
            </button>
            <button
              onclick="ZGestorApp.setFiltro('subTabTarefas', 'obrigacoes'); ZGestorApp.setNotionDept('CONTABIL')"
              class="px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition ${subTab === 'obrigacoes' && fDeptAtual === 'CONTABIL'
        ? 'bg-blue-600 text-white shadow-xs'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}">
              <span>田</span>
              <span>Contábil</span>
            </button>
            <button
              onclick="ZGestorApp.setFiltro('subTabTarefas', 'obrigacoes'); ZGestorApp.setNotionDept('PESSOAL')"
              class="px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition ${subTab === 'obrigacoes' && fDeptAtual === 'PESSOAL'
        ? 'bg-emerald-600 text-white shadow-xs'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}">
              <span>田</span>
              <span>Pessoal (DP)</span>
            </button>
            <button
              onclick="ZGestorApp.setFiltro('subTabTarefas', 'obrigacoes'); ZGestorApp.setNotionDept('FINANCEIRO')"
              class="px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition ${subTab === 'obrigacoes' && fDeptAtual === 'FINANCEIRO'
        ? 'bg-amber-600 text-white shadow-xs'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}">
              <span>田</span>
              <span>Financeiro</span>
            </button>
            <span class="text-slate-300 px-1 font-light">|</span>
            <button
              onclick="ZGestorApp.setFiltro('subTabTarefas', 'fechamentos_geral')"
              class="px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition ${subTab === 'fechamentos_geral'
        ? 'bg-purple-700 text-white shadow-xs'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}">
              <span>田</span>
              <span>Matriz Anual Jan–Dez</span>
            </button>
            <button
              onclick="ZGestorApp.setFiltro('subTabTarefas', 'rotinas_config')"
              class="px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition ${subTab === 'rotinas_config'
        ? 'bg-slate-900 text-white shadow-xs'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}">
              <i data-lucide="sliders-horizontal" class="w-3.5 h-3.5"></i>
              <span>Definir Rotinas</span>
            </button>
            <button
              onclick="ZGestorApp.setFiltro('subTabTarefas', 'guias_impostos')"
              class="px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition ${subTab === 'guias_impostos'
        ? 'bg-emerald-600 text-white shadow-xs'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}">
              <span>田</span>
              <span>Controle de Guias (${todasGuiasComp.length})</span>
            </button>
          </div>

          <div class="flex items-center gap-2">
            ${subTab === 'obrigacoes' ? `
              <button onclick="ZGestorApp.gerarTarefasMesAtual()" class="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-semibold text-xs flex items-center gap-1.5">
                <i data-lucide="calendar-plus" class="w-3.5 h-3.5 text-indigo-600"></i>
                Gerar Tarefas Recorrentes (${comp})
              </button>
            ` : ''}
          </div>
        </div>

        ${subTab === 'obrigacoes' ? `
          ${(() => {
            const totalC = todasComp.length;
            const pctC = totalC > 0 ? Math.round((qtdEntreguesComp / totalC) * 100) : 0;
            const qtdSemMovC = todasComp.filter(t => t.modalidade_entrega === 'SEM_MOVIMENTO').length;
            return `
              <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div class="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <span>Andamento Geral da Competência ${comp}</span>
                      <span class="px-2 py-0.5 rounded-full text-[11px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">${pctC}% Concluído</span>
                    </div>
                    <p class="text-[11px] text-slate-500 mt-0.5">
                      ${totalC === 0 ? 'Nenhuma rotina gerada ainda para este mês. Clique em "Gerar Rotinas" para criar automaticamente conforme regime e Inscrição Estadual.' : `${qtdEntreguesComp} de ${totalC} obrigações concluídas (${qtdEntreguesComp - qtdSemMovC} normais • ${qtdSemMovC} sem movimento) • ${qtdPendentesComp} pendente(s) • ${qtdAguardandoDocsComp} aguardando docs • ${qtdAndamentoComp} em andamento`}
                    </p>
                  </div>
                  ${totalC === 0 ? `
                    <button
                      type="button"
                      onclick="ZGestorApp.gerarTarefasMesAtual()"
                      class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition cursor-pointer shrink-0">
                      <i data-lucide="zap" class="w-4 h-4"></i>
                      <span>Gerar Rotinas (${comp})</span>
                    </button>
                  ` : ''}
                </div>
                <div class="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div class="bg-emerald-500 h-full transition-all" style="width: ${pctC}%"></div>
                </div>
              </div>
            `;
          })()}

          <!-- SUB-ABAS DE REGIME TRIBUTÁRIO DENTRO DO DEPARTAMENTO -->
          <div class="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2 text-xs">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-1 flex items-center gap-1">
                <i data-lucide="layers" class="w-3.5 h-3.5 text-indigo-600"></i>
                Regime do Cliente no Setor:
              </span>
              <button
                onclick="ZGestorApp.setNotionRegime('TODOS')"
                class="px-3 py-1.5 rounded-xl font-bold transition text-xs ${fRegimeAtual === 'TODOS'
          ? 'bg-slate-800 text-white shadow-xs'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'}">
                Todos os Regimes
              </button>
              <button
                onclick="ZGestorApp.setNotionRegime('Simples Nacional')"
                class="px-3 py-1.5 rounded-xl font-bold transition text-xs ${fRegimeAtual === 'Simples Nacional'
          ? 'bg-purple-700 text-white shadow-xs'
          : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200'}">
                🏢 Simples Nacional
              </button>
              <button
                onclick="ZGestorApp.setNotionRegime('Lucro Presumido')"
                class="px-3 py-1.5 rounded-xl font-bold transition text-xs ${fRegimeAtual === 'Lucro Presumido'
          ? 'bg-blue-700 text-white shadow-xs'
          : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200'}">
                🏛️ Lucro Presumido
              </button>
              <button
                onclick="ZGestorApp.setNotionRegime('Lucro Real')"
                class="px-3 py-1.5 rounded-xl font-bold transition text-xs ${fRegimeAtual === 'Lucro Real'
          ? 'bg-rose-700 text-white shadow-xs'
          : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'}">
                🏭 Lucro Real
              </button>
              <button
                onclick="ZGestorApp.setNotionRegime('MEI')"
                class="px-3 py-1.5 rounded-xl font-bold transition text-xs ${fRegimeAtual === 'MEI'
          ? 'bg-emerald-700 text-white shadow-xs'
          : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'}">
                👤 MEI
              </button>
            </div>

            ${fRegimeAtual !== 'TODOS' ? `
              <button
                onclick="ZGestorApp.setNotionRegime('TODOS')"
                class="text-xs font-bold text-rose-600 hover:text-rose-800 transition flex items-center gap-1">
                <span>Limpar Filtro de Regime</span>
                <i data-lucide="x" class="w-3.5 h-3.5"></i>
              </button>
            ` : ''}
          </div>

          <!-- BARRA DE FILTROS COMBINADOS & BUSCA RÁPIDA -->
          <div class="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div class="flex flex-wrap items-center gap-2 flex-1">
              <div class="relative flex-1 min-w-[220px]">
                <i data-lucide="search" class="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5"></i>
                <input
                  type="text"
                  id="input-filtro-tarefa-busca"
                  value="${this.escapeHtml(appState.filtroTarefaBusca || '')}"
                  oninput="ZGestorApp.setFiltro('filtroTarefaBusca', this.value)"
                  placeholder="Buscar empresa, obrigação, responsável..."
                  class="w-full rounded-xl bg-slate-50 border border-slate-200 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                />
              </div>

              <!-- Seletor / Busca Inteligente de Empresa (Searchable Dropdown) -->
              <div class="relative min-w-[300px]" id="wrapper-filtro-empresa">
                <div class="relative flex items-center">
                  <div class="absolute left-2.5 pointer-events-none text-slate-400">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                  </div>
                  <input
                    type="text"
                    id="input-filtro-empresa"
                    autocomplete="off"
                    placeholder="🏢 Digite razão social, código ou CNPJ..."
                    value="${fCliente !== 'TODOS' ? (() => { const ef = this.obterEmp(db, fCliente); return ef ? `${this.codLimpo(ef.codigo_interno) ? this.codLimpo(ef.codigo_interno) + ' - ' : ''}${ef.razao_social || ef.nome_fantasia}` : ''; })() : ''}"
                    onfocus="ZGestorApp.abrirDropdownEmpresaFiltro()"
                    onclick="ZGestorApp.abrirDropdownEmpresaFiltro()"
                    oninput="ZGestorApp.aoDigitarFiltroEmpresaLista(this.value)"
                    onkeydown="ZGestorApp.aoTeclarFiltroEmpresa(event)"
                    class="w-full rounded-xl bg-white border border-slate-300 pl-8 pr-14 py-1.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400 shadow-2xs transition"
                  />
                  <div class="absolute right-2 flex items-center gap-1">
                    ${fCliente !== 'TODOS' ? `
                      <button
                        type="button"
                        onclick="event.stopPropagation(); ZGestorApp.selecionarEmpresaFiltro('TODOS')"
                        class="p-0.5 rounded text-slate-400 hover:text-rose-600 transition"
                        title="Limpar filtro e ver Todas as Empresas">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                      </button>
                    ` : ''}
                    <button
                      type="button"
                      onclick="event.stopPropagation(); ZGestorApp.toggleDropdownEmpresaFiltro()"
                      class="p-0.5 rounded text-slate-400 hover:text-slate-600 transition"
                      title="Abrir lista de empresas">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>
                  </div>
                </div>

                <!-- Dropdown suspenso com lista de empresas filtradas em tempo real -->
                <div
                  id="dropdown-menu-empresas"
                  class="hidden absolute z-50 left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-xl bg-white border border-slate-200 shadow-xl py-1 text-xs divide-y divide-slate-100">
                  <div id="lista-opcoes-empresas"></div>
                </div>
              </div>

              <select
                onchange="ZGestorApp.setFiltro('filtroTarefaObrigacao', this.value)"
                class="rounded-xl bg-white border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800 max-w-[260px]">
                <option value="TODOS" ${fObrigacao === 'TODOS' ? 'selected' : ''}>Todas as Obrigações / Etapas</option>
                ${Array.from(new Set(todasComp.map(t => t.titulo).filter(Boolean))).sort().map(tit => `
                  <option value="${this.escapeHtml(tit)}" ${fObrigacao === tit ? 'selected' : ''}>${this.escapeHtml(tit)}</option>
                `).join('')}
              </select>

              <select
                onchange="ZGestorApp.setFiltro('filtroTarefaModalidade', this.value)"
                class="rounded-xl bg-white border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-800">
                <option value="TODOS" ${fModalidade === 'TODOS' ? 'selected' : ''}>Mensais + Avulsas</option>
                <option value="MENSAL" ${fModalidade === 'MENSAL' ? 'selected' : ''}>Apenas Mensais (Rotina)</option>
                <option value="AVULSA" ${fModalidade === 'AVULSA' ? 'selected' : ''}>Apenas Avulsas (Solicitação)</option>
              </select>
            </div>

            <!-- SELETOR DE VISUALIZAÇÃO MODERNO: LISTA | KANBAN | CALENDÁRIO -->
            <div class="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200 gap-1 shrink-0">
              <button
                type="button"
                onclick="ZGestorApp.setModoVisualizacaoTarefas('kanban')"
                class="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${(appState.modoVisualizacaoTarefas || 'kanban') === 'kanban' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}">
                <i data-lucide="kanban" class="w-3.5 h-3.5"></i>
                <span>Kanban</span>
              </button>
              <button
                type="button"
                onclick="ZGestorApp.setModoVisualizacaoTarefas('lista')"
                class="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${appState.modoVisualizacaoTarefas === 'lista' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}">
                <i data-lucide="list" class="w-3.5 h-3.5"></i>
                <span>Lista</span>
              </button>
              <button
                type="button"
                onclick="ZGestorApp.setModoVisualizacaoTarefas('calendario')"
                class="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${appState.modoVisualizacaoTarefas === 'calendario' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}">
                <i data-lucide="calendar-days" class="w-3.5 h-3.5"></i>
                <span>Calendário</span>
              </button>
            </div>
          </div>

          <!-- ÁREA PRINCIPAL MODERNA: KANBAN | LISTA | CALENDÁRIO + SIDE PEEK -->
          <div class="flex flex-col lg:flex-row gap-4 items-start">
            <div class="flex-1 w-full min-w-0">
              ${(() => {
                const modo = appState.modoVisualizacaoTarefas || 'kanban';
                const selecionadasSet = new Set(Array.isArray(appState.tarefasSelecionadas) ? appState.tarefasSelecionadas : []);
                const idsVisiveis = lista.map(t => t.id);
                const qtdSelVisiveis = idsVisiveis.filter(id => selecionadasSet.has(id)).length;
                const todasVisiveisMarcadas = idsVisiveis.length > 0 && qtdSelVisiveis === idsVisiveis.length;
                const totalSelecionadas = selecionadasSet.size;

                // Índices O(1) das tarefas e guias de ICMS da competência para exibição imediata ao lado da DeSTDA
                const mapaTarefasIcmsComp = new Map();
                for (let i = 0; i < todasComp.length; i++) {
                  const ti = todasComp[i];
                  if (ti && ti.empresa_id && db.ehTarefaApuracaoIcms && db.ehTarefaApuracaoIcms(ti)) {
                    mapaTarefasIcmsComp.set(ti.empresa_id, ti);
                  }
                }
                const mapaGuiasIcmsComp = new Map();
                const todasGuiasRefComp = db.getGuiasImpostos(comp) || [];
                for (let i = 0; i < todasGuiasRefComp.length; i++) {
                  const gi = todasGuiasRefComp[i];
                  if (gi && gi.empresa_id && String(gi.tipo_guia || '').toLowerCase().includes('icms')) {
                    let arrG = mapaGuiasIcmsComp.get(gi.empresa_id);
                    if (!arrG) {
                      arrG = [];
                      mapaGuiasIcmsComp.set(gi.empresa_id, arrG);
                    }
                    arrG.push(gi);
                  }
                }

                const renderBadgeIcmsAoLadoDestda = (t) => {
                  if (!db.ehTarefaDestda || !db.ehTarefaDestda(t)) return '';
                  const info = db.obterResumoApuracaoIcmsParaDestda(t.empresa_id, comp, mapaTarefasIcmsComp, mapaGuiasIcmsComp);
                  if (!info) return '';
                  return `
                    <span
                      title="${this.escapeHtml(info.detalhe || info.label)}"
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-extrabold border ${info.cls}">
                      <span>${info.icone}</span>
                      <span>${this.escapeHtml(info.label)}</span>
                    </span>
                  `;
                };

                const renderBlocoMotivoPendente = (t) => {
                  const stS = db.obterStatusSimplesTarefa(t);
                  const motivo = String(t.motivo_pendencia || (stS === 'PENDENTE' ? t.protocolo_observacao : '') || '').trim();
                  if (stS !== 'PENDENTE' && !t.motivo_pendencia) return '';
                  return `
                    <div class="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-50 text-rose-900 border border-rose-200 text-[10.5px] font-bold max-w-full">
                      <span>⚠ Motivo:</span>
                      <span class="truncate" title="${this.escapeHtml(motivo || 'Sem motivo informado')}">${this.escapeHtml(motivo || 'Clique em Pendente p/ informar o motivo')}</span>
                    </div>
                  `;
                };

                const barraLoteHtml = `
                  <div class="mb-3 rounded-2xl border px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5 transition ${totalSelecionadas > 0 ? 'bg-slate-900 text-white border-slate-800 shadow-lg sticky top-14 z-20' : 'bg-white text-slate-700 border-slate-200 shadow-2xs'}">
                    <div class="flex flex-wrap items-center gap-2.5 text-xs">
                      <label class="inline-flex items-center gap-2 font-bold cursor-pointer select-none">
                        <input
                          type="checkbox"
                          ${todasVisiveisMarcadas ? 'checked' : ''}
                          onchange="ZGestorApp.toggleSelecionarTodasTarefasVisiveis(this.checked)"
                          class="w-4 h-4 rounded text-indigo-600 cursor-pointer"
                        />
                        <span>${totalSelecionadas > 0 ? `${totalSelecionadas} tarefa(s) selecionada(s)` : `Selecionar tarefas em lote (${lista.length} visíveis)`}</span>
                      </label>
                      ${totalSelecionadas > 0 ? `
                        <button
                          type="button"
                          onclick="ZGestorApp.limparSelecaoTarefas()"
                          class="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold cursor-pointer">
                          Limpar seleção
                        </button>
                      ` : `<span class="text-[11px] text-slate-400 hidden sm:inline">Marque várias tarefas para alterar a situação ou registrar pendência com motivo de uma só vez.</span>`}
                    </div>

                    ${totalSelecionadas > 0 ? `
                      <div class="flex flex-wrap items-center gap-1.5 text-[11px]">
                        <button type="button" onclick="ZGestorApp.abrirModalLoteSelecionadas('PENDENTE')" class="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold shadow-xs cursor-pointer">
                          ⚠ Pendente (+ Motivo)
                        </button>
                        <button type="button" onclick="ZGestorApp.abrirModalLoteSelecionadas('AGUARDANDO_DOCS')" class="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold cursor-pointer">
                          📄 Aguardando Docs
                        </button>
                        <button type="button" onclick="ZGestorApp.aplicarAcaoRapidaLoteTarefas('EM_ANDAMENTO')" class="px-2.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold cursor-pointer">
                          🔄 Fazendo
                        </button>
                        <button type="button" onclick="ZGestorApp.aplicarAcaoRapidaLoteTarefas('ENTREGUE_NORMAL')" class="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold cursor-pointer">
                          ✓ Normal
                        </button>
                        <button type="button" onclick="ZGestorApp.aplicarAcaoRapidaLoteTarefas('SEM_MOVIMENTO')" class="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer">
                          S/ Mov.
                        </button>
                        <button type="button" onclick="ZGestorApp.aplicarAcaoRapidaLoteTarefas('REABRIR')" class="px-2.5 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold cursor-pointer">
                          ↩ A Fazer
                        </button>
                        <button type="button" onclick="ZGestorApp.abrirModalLoteSelecionadas('ESCOLHER')" class="px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold border border-white/20 cursor-pointer">
                          📝 Situação + Motivo...
                        </button>
                      </div>
                    ` : ''}
                  </div>
                `;

                const colunas = [
                  { key: 'NAO_INICIADA', label: 'A Fazer', dot: 'bg-slate-400', headerBg: 'bg-slate-50 border-slate-200', badge: 'bg-slate-200 text-slate-800' },
                  { key: 'PENDENTE', label: 'Pendentes', dot: 'bg-rose-500', headerBg: 'bg-rose-50/80 border-rose-200', badge: 'bg-rose-200 text-rose-900' },
                  { key: 'AGUARDANDO_DOCS', label: 'Aguardando Docs', dot: 'bg-amber-500', headerBg: 'bg-amber-50/80 border-amber-200', badge: 'bg-amber-200 text-amber-900' },
                  { key: 'EM_ANDAMENTO', label: 'Em Andamento', dot: 'bg-sky-500', headerBg: 'bg-sky-50/80 border-sky-200', badge: 'bg-sky-200 text-sky-900' },
                  { key: 'ENTREGUE', label: 'Concluídas', dot: 'bg-emerald-500', headerBg: 'bg-emerald-50/80 border-emerald-200', badge: 'bg-emerald-200 text-emerald-900' }
                ];

                const badgeSetor = (dept) => {
                  if (dept === 'FISCAL') return '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800">Fiscal</span>';
                  if (dept === 'CONTABIL') return '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">Contábil</span>';
                  if (dept === 'PESSOAL') return '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">DP</span>';
                  return '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">' + dept + '</span>';
                };

                const badgeRegime = (emp) => {
                  if (!emp) return '';
                  if (emp.regime_tributario === 'Simples Nacional') return '<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">Simples</span>';
                  if (emp.regime_tributario === 'Lucro Presumido') return '<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">Presumido</span>';
                  if (emp.regime_tributario === 'Lucro Real') return '<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">Real</span>';
                  return '<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">' + emp.regime_tributario + '</span>';
                };

                const svgEdit = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>';
                const svgTrash = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>';

                // Agrupa uma única vez O(N) para evitar múltiplos .filter() sobre 1.000+ tarefas
                const porGrupo = new Map();
                colunas.forEach(c => porGrupo.set(c.key, []));
                for (let i = 0; i < lista.length; i++) {
                  const itemT = lista[i];
                  let stKey = db.obterStatusSimplesTarefa(itemT);
                  if (stKey === 'CONFERIDO') stKey = 'ENTREGUE';
                  const bucket = porGrupo.get(stKey) || porGrupo.get('NAO_INICIADA');
                  bucket.push(itemT);
                }

                // =============================================================
                // MODO 1: QUADRO KANBAN MODERNO (COM DRAG & DROP + SELEÇÃO EM LOTE)
                // =============================================================
                if (modo === 'kanban') {
                  return `
                    ${barraLoteHtml}
                    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 items-start">
                      ${colunas.map(col => {
                        const cards = porGrupo.get(col.key) || [];
                        const todosColMarcados = cards.length > 0 && cards.every(c => selecionadasSet.has(c.id));
                        return `
                          <div
                            ondragover="ZGestorApp.onDragOverColunaKanban(event)"
                            ondrop="ZGestorApp.onDropColunaKanban(event, '${col.key}')"
                            class="bg-slate-50/90 rounded-2xl border border-slate-200 flex flex-col max-h-[72vh]">
                            <div class="p-2.5 rounded-t-2xl border-b ${col.headerBg} flex items-center justify-between shrink-0">
                              <div class="flex items-center gap-2 min-w-0">
                                ${cards.length > 0 ? `
                                  <input
                                    type="checkbox"
                                    ${todosColMarcados ? 'checked' : ''}
                                    onclick="event.stopPropagation()"
                                    onchange="ZGestorApp.toggleSelecionarGrupoTarefas('${col.key}', this.checked)"
                                    title="Selecionar todas de ${col.label}"
                                    class="w-3.5 h-3.5 rounded text-indigo-600 cursor-pointer shrink-0"
                                  />
                                ` : ''}
                                <span class="w-2.5 h-2.5 rounded-full ${col.dot} shrink-0"></span>
                                <h3 class="text-xs font-extrabold text-slate-800 truncate">${col.label}</h3>
                              </div>
                              <span class="px-2 py-0.5 rounded-full text-[11px] font-black ${col.badge}">${cards.length}</span>
                            </div>

                            <div class="p-2.5 space-y-2.5 overflow-y-auto flex-1 min-h-[140px]">
                              ${cards.length === 0 ? `
                                <div class="py-8 px-3 text-center text-[11px] text-slate-400 border border-dashed border-slate-200 rounded-xl bg-white/50">
                                  Arraste cards para cá ou use os botões rápidos
                                </div>
                              ` : cards.map(t => {
                                const emp = this.obterEmp(db, t.empresa_id, t);
                                const atrasada = !t.data_entrega && t.prazo_entrega && t.prazo_entrega < hoje;
                                const isAtivo = sidePeekTarefa && sidePeekTarefa.id === t.id;
                                const isChecked = selecionadasSet.has(t.id);
                                return `
                                  <div
                                    draggable="true"
                                    ondragstart="ZGestorApp.onDragStartTarefa(event, '${t.id}')"
                                    onclick="ZGestorApp.abrirNotionSidePeek('${t.id}')"
                                    class="bg-white p-3 rounded-xl border transition shadow-2xs hover:shadow-md cursor-pointer space-y-2 ${isChecked ? 'border-indigo-600 ring-2 ring-indigo-300 bg-indigo-50/20' : isAtivo ? 'border-indigo-500 ring-2 ring-indigo-200' : atrasada ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200 hover:border-indigo-300'}">
                                    <div class="flex items-center justify-between gap-1.5">
                                      <div class="flex items-center gap-1.5 flex-wrap">
                                        <input
                                          type="checkbox"
                                          ${isChecked ? 'checked' : ''}
                                          onclick="event.stopPropagation()"
                                          onchange="ZGestorApp.toggleSelecionarTarefa('${t.id}', this.checked)"
                                          class="w-3.5 h-3.5 rounded text-indigo-600 cursor-pointer"
                                          title="Selecionar tarefa p/ lote"
                                        />
                                        ${badgeSetor(t.departamento)}
                                        ${badgeRegime(emp)}
                                        ${t.tipo === 'TRIMESTRAL' ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200">Trimestral</span>' : ''}
                                        ${t.modalidade_entrega === 'SEM_MOVIMENTO' ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800">Sem Mov.</span>' : ''}
                                      </div>
                                      <span class="text-[10px] font-bold whitespace-nowrap ${atrasada ? 'text-rose-600' : 'text-slate-400'}">
                                        ${atrasada ? '⚠ ' : ''}${this.formatDate(t.prazo_entrega)}
                                      </span>
                                    </div>

                                    <div>
                                      <div class="text-[11px] font-bold text-indigo-700 truncate" title="${this.escapeHtml(this.nomeEmp(emp, { comCodigo: true, fallbackObj: t }))}">
                                        ${emp && this.codLimpo(emp.codigo_interno) ? `<span class="font-mono font-extrabold bg-indigo-50 px-1 py-0.2 rounded mr-1">${this.escapeHtml(this.codLimpo(emp.codigo_interno))}</span>` : ''}${this.escapeHtml(this.nomeEmp(emp, { fallbackObj: t }))}
                                      </div>
                                      <div class="text-xs font-extrabold text-slate-900 leading-snug mt-0.5 flex flex-wrap items-center gap-1.5">
                                        <span>${this.escapeHtml(t.titulo)}</span>
                                        ${renderBadgeIcmsAoLadoDestda(t)}
                                      </div>
                                      ${renderBlocoMotivoPendente(t)}
                                      ${t.icms_apuracao_definida ? `
                                        <div class="flex flex-wrap gap-1 mt-1.5">
                                          ${t.icms_sem_movimento
                                            ? '<span class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300 text-[10px] font-bold">Apurado: Sem Movimento</span>'
                                            : (t.icms_apuracao_tipos || []).map(tp => `<span class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold">Apurado: ${this.escapeHtml(tp)}</span>`).join('')}
                                        </div>
                                      ` : ''}
                                      ${t.protocolo_observacao && !t.icms_apuracao_definida && col.key !== 'PENDENTE' ? `
                                        <div class="text-[10px] text-slate-500 truncate mt-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                                          ${this.escapeHtml(t.protocolo_observacao)}
                                        </div>
                                      ` : ''}
                                    </div>

                                    <div class="pt-2 border-t border-slate-100 flex items-center justify-between gap-1" onclick="event.stopPropagation()">
                                      <div class="flex items-center gap-1 flex-wrap">
                                        ${col.key !== 'ENTREGUE' ? `
                                          <button type="button" onclick="ZGestorApp.marcarEtapaRapida('${t.id}', 'PENDENTE')" class="px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${col.key === 'PENDENTE' ? 'bg-rose-600 text-white border-rose-700' : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200'}">Pendente</button>
                                        ` : ''}
                                        ${col.key !== 'AGUARDANDO_DOCS' && col.key !== 'ENTREGUE' ? `
                                          <button type="button" onclick="ZGestorApp.marcarEtapaRapida('${t.id}', 'COBRAR_DOCS')" class="px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold cursor-pointer">Docs</button>
                                        ` : ''}
                                        ${col.key !== 'EM_ANDAMENTO' && col.key !== 'ENTREGUE' ? `
                                          <button type="button" onclick="ZGestorApp.marcarEtapaRapida('${t.id}', 'EM_ANDAMENTO')" class="px-1.5 py-0.5 rounded bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-[10px] font-bold cursor-pointer">Fazendo</button>
                                        ` : ''}
                                        ${col.key !== 'ENTREGUE' ? `
                                          <button type="button" onclick="ZGestorApp.marcarEtapaRapida('${t.id}', 'ENTREGUE_NORMAL')" class="px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold cursor-pointer">✓ Normal</button>
                                          <button type="button" onclick="ZGestorApp.marcarEtapaRapida('${t.id}', 'SEM_MOVIMENTO')" class="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-[10px] font-bold cursor-pointer">S/ Mov.</button>
                                        ` : `
                                          <button type="button" onclick="ZGestorApp.marcarEtapaRapida('${t.id}', 'REABRIR')" class="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-semibold cursor-pointer">Reabrir</button>
                                        `}
                                      </div>
                                      <button type="button" onclick="ZGestorApp.openModalEditarTarefa('${t.id}')" class="p-1 rounded text-slate-400 hover:text-indigo-600 cursor-pointer" title="Editar">
                                        ${svgEdit}
                                      </button>
                                    </div>
                                  </div>
                                `;
                              }).join('')}
                            </div>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  `;
                }

                // =============================================================
                // MODO 2: CALENDÁRIO MENSAL DE VENCIMENTOS E ENTREGAS
                // =============================================================
                if (modo === 'calendario') {
                  const anoCal = Number(sub.ano || 2026);
                  const mesCal = Number(sub.mes || 11);
                  const primeiroDia = new Date(anoCal, mesCal - 1, 1);
                  const ultimoDia = new Date(anoCal, mesCal, 0);
                  const totalDias = ultimoDia.getDate();
                  const offsetInicio = primeiroDia.getDay(); // 0 = Dom
                  const prefixoMes = `${anoCal}-${String(mesCal).padStart(2, '0')}`;

                  const tarefasForaMes = lista.filter(t => !t.prazo_entrega || !t.prazo_entrega.startsWith(prefixoMes));
                  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                  const celulas = [];
                  for (let i = 0; i < offsetInicio; i++) celulas.push(null);
                  for (let d = 1; d <= totalDias; d++) celulas.push(d);

                  return `
                    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                        <div class="flex items-center gap-2">
                          <i data-lucide="calendar-days" class="w-4 h-4 text-indigo-600"></i>
                          <span class="text-xs font-extrabold text-slate-900">Calendário de Vencimentos — ${sub.label}</span>
                          <span class="text-[11px] text-slate-500">(${lista.length} obrigações no filtro)</span>
                        </div>
                        <div class="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                          <span class="inline-flex items-center gap-1 text-emerald-700"><span class="w-2 h-2 rounded-full bg-emerald-500"></span>Concluída</span>
                          <span class="inline-flex items-center gap-1 text-sky-700"><span class="w-2 h-2 rounded-full bg-sky-500"></span>Sem Mov.</span>
                          <span class="inline-flex items-center gap-1 text-amber-700"><span class="w-2 h-2 rounded-full bg-amber-500"></span>Docs/Andamento</span>
                          <span class="inline-flex items-center gap-1 text-rose-700"><span class="w-2 h-2 rounded-full bg-rose-500"></span>Atrasada</span>
                        </div>
                      </div>

                      <div class="grid grid-cols-7 border-b border-slate-200 bg-slate-50/60 text-center text-[11px] font-extrabold text-slate-600">
                        ${diasSemana.map(ds => `<div class="py-2 border-r last:border-r-0 border-slate-200">${ds}</div>`).join('')}
                      </div>

                      <div class="grid grid-cols-7 divide-x divide-y divide-slate-200">
                        ${celulas.map(dia => {
                          if (!dia) return '<div class="min-h-[105px] bg-slate-50/50"></div>';
                          const dataStr = `${prefixoMes}-${String(dia).padStart(2, '0')}`;
                          const doDia = lista.filter(t => t.prazo_entrega === dataStr);
                          const ehHoje = dataStr === hoje;
                          return `
                            <div class="min-h-[105px] p-1.5 flex flex-col gap-1 ${ehHoje ? 'bg-indigo-50/40' : 'bg-white'}">
                              <div class="flex items-center justify-between px-1">
                                <span class="text-[11px] font-extrabold ${ehHoje ? 'bg-indigo-600 text-white px-1.5 py-0.5 rounded-full' : 'text-slate-700'}">${dia}</span>
                                ${doDia.length > 0 ? `<span class="text-[10px] font-bold text-slate-400">${doDia.length}</span>` : ''}
                              </div>
                              <div class="space-y-1 max-h-[120px] overflow-y-auto">
                                ${doDia.map(t => {
                                  const emp = this.obterEmp(db, t.empresa_id, t);
                                  const st = db.obterStatusSimplesTarefa(t);
                                  const atrasada = !t.data_entrega && t.prazo_entrega < hoje;
                                  let chipCls = 'bg-slate-100 text-slate-700 border-slate-200';
                                  if (st === 'ENTREGUE' && t.modalidade_entrega === 'SEM_MOVIMENTO') chipCls = 'bg-sky-50 text-sky-800 border-sky-200';
                                  else if (st === 'ENTREGUE' || st === 'CONFERIDO') chipCls = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                                  else if (atrasada) chipCls = 'bg-rose-50 text-rose-800 border-rose-300';
                                  else if (st === 'PENDENTE' || st === 'EM_ANDAMENTO') chipCls = 'bg-amber-50 text-amber-800 border-amber-200';

                                  return `
                                    <button
                                      type="button"
                                      onclick="ZGestorApp.abrirNotionSidePeek('${t.id}')"
                                      title="${this.escapeHtml(this.nomeEmp(emp, { comCodigo: true, fallbackObj: t }))} — ${this.escapeHtml(t.titulo)}"
                                      class="w-full text-left px-1.5 py-1 rounded-md border text-[10px] leading-tight truncate hover:ring-1 hover:ring-indigo-400 transition cursor-pointer ${chipCls}">
                                      <strong class="font-bold">${this.escapeHtml(this.nomeEmp(emp, { fallbackObj: t }))}</strong>: ${this.escapeHtml(t.titulo)}
                                    </button>
                                  `;
                                }).join('')}
                              </div>
                            </div>
                          `;
                        }).join('')}
                      </div>

                      ${tarefasForaMes.length > 0 ? `
                        <div class="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
                          <strong>Outras datas (${tarefasForaMes.length}):</strong>
                          <div class="flex flex-wrap gap-1.5 mt-1.5">
                            ${tarefasForaMes.slice(0, 12).map(t => {
                              const emp = this.obterEmp(db, t.empresa_id, t);
                              return `<button type="button" onclick="ZGestorApp.abrirNotionSidePeek('${t.id}')" class="px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] hover:border-indigo-400 cursor-pointer">${this.formatDate(t.prazo_entrega)} • ${this.escapeHtml(this.nomeEmp(emp, { comCodigo: true, fallbackObj: t }))} — ${this.escapeHtml(t.titulo)}</button>`;
                            }).join('')}
                          </div>
                        </div>
                      ` : ''}
                    </div>
                  `;
                }

                // =============================================================
                // MODO 3: LISTA PRÁTICA E MODERNA (COM SELEÇÃO EM LOTE, PENDENTE E ICMS NA DESTDA)
                // =============================================================
                return `
                  ${barraLoteHtml}
                  <div class="space-y-4">
                    ${colunas.map(grupo => {
                      const itensGrupo = porGrupo.get(grupo.key) || [];
                      const isColapsado = colapsados[grupo.key] === true;
                      const todosGrupoMarcados = itensGrupo.length > 0 && itensGrupo.every(it => selecionadasSet.has(it.id));
                      return `
                        <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                          <div
                            onclick="ZGestorApp.toggleNotionGrupo('${grupo.key}')"
                            class="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 transition select-none border-b border-slate-100">
                            <div class="flex items-center gap-2.5">
                              ${itensGrupo.length > 0 ? `
                                <input
                                  type="checkbox"
                                  ${todosGrupoMarcados ? 'checked' : ''}
                                  onclick="event.stopPropagation()"
                                  onchange="ZGestorApp.toggleSelecionarGrupoTarefas('${grupo.key}', this.checked)"
                                  title="Selecionar todas de ${grupo.label}"
                                  class="w-4 h-4 rounded text-indigo-600 cursor-pointer"
                                />
                              ` : ''}
                              <span class="text-xs text-slate-400 font-mono">${isColapsado ? '▶' : '▼'}</span>
                              <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${grupo.badge}">
                                <span class="w-2 h-2 rounded-full ${grupo.dot}"></span>
                                <span>${grupo.label}</span>
                              </span>
                              <span class="text-xs font-bold text-slate-500">(${itensGrupo.length})</span>
                            </div>
                          </div>

                          ${!isColapsado ? `
                            <div class="divide-y divide-slate-100">
                              ${itensGrupo.length === 0 ? `
                                <div class="py-4 text-center text-slate-400 text-xs italic">
                                  Nenhuma tarefa em "${grupo.label}".
                                </div>
                              ` : itensGrupo.map(t => {
                                const emp = this.obterEmp(db, t.empresa_id, t);
                                const atrasada = !t.data_entrega && t.prazo_entrega && t.prazo_entrega < hoje;
                                const isAtivo = sidePeekTarefa && sidePeekTarefa.id === t.id;
                                const isChecked = selecionadasSet.has(t.id);
                                const stLinha = db.obterStatusSimplesTarefa(t);
                                return `
                                  <div class="px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/90 transition ${isChecked ? 'bg-indigo-50/50' : isAtivo ? 'bg-indigo-50/60' : ''}">
                                    <div class="flex items-start gap-2.5 min-w-0 flex-1">
                                      <div class="pt-1 shrink-0" onclick="event.stopPropagation()">
                                        <input
                                          type="checkbox"
                                          ${isChecked ? 'checked' : ''}
                                          onchange="ZGestorApp.toggleSelecionarTarefa('${t.id}', this.checked)"
                                          class="w-4 h-4 rounded text-indigo-600 cursor-pointer"
                                          title="Selecionar tarefa p/ lote"
                                        />
                                      </div>
                                      <div class="flex items-start gap-3 min-w-0 flex-1 cursor-pointer" onclick="ZGestorApp.abrirNotionSidePeek('${t.id}')">
                                        <div class="pt-0.5 shrink-0">${renderNotionStatusPill(t)}</div>
                                        <div class="min-w-0 flex-1">
                                          <div class="flex items-center gap-2 flex-wrap">
                                            <span class="text-xs font-extrabold text-slate-900">${this.escapeHtml(this.nomeEmp(emp, { comCodigo: true, fallbackObj: t }))}</span>
                                            ${badgeSetor(t.departamento)}
                                            ${badgeRegime(emp)}
                                            <span class="text-[11px] font-bold ${atrasada ? 'text-rose-600' : 'text-slate-400'}">• Prazo: ${this.formatDate(t.prazo_entrega)}</span>
                                          </div>
                                          <div class="text-xs font-semibold text-slate-700 mt-0.5 flex flex-wrap items-center gap-2">
                                            <span>${this.escapeHtml(t.titulo)}</span>
                                            ${renderBadgeIcmsAoLadoDestda(t)}
                                          </div>
                                          ${renderBlocoMotivoPendente(t)}
                                          ${t.icms_apuracao_definida ? `
                                            <div class="flex flex-wrap gap-1 mt-1">
                                              ${t.icms_sem_movimento
                                                ? '<span class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300 text-[10px] font-bold">Apurado: Sem Movimento</span>'
                                                : (t.icms_apuracao_tipos || []).map(tp => `<span class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold">Apurado: ${this.escapeHtml(tp)}</span>`).join('')}
                                            </div>
                                          ` : (t.protocolo_observacao && stLinha !== 'PENDENTE') ? `<div class="text-[11px] text-slate-500 mt-0.5 truncate">Obs: ${this.escapeHtml(t.protocolo_observacao)}</div>` : ''}
                                        </div>
                                      </div>
                                    </div>

                                    <div class="flex items-center gap-1.5 flex-wrap shrink-0">
                                      <button type="button" onclick="ZGestorApp.marcarEtapaRapida('${t.id}', 'PENDENTE')" class="px-2 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${stLinha === 'PENDENTE' ? 'bg-rose-600 text-white border-rose-700' : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200'}">Pendente</button>
                                      <button type="button" onclick="ZGestorApp.marcarEtapaRapida('${t.id}', 'COBRAR_DOCS')" class="px-2 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${stLinha === 'AGUARDANDO_DOCS' ? 'bg-amber-500 text-white border-amber-600' : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'}">Docs</button>
                                      <button type="button" onclick="ZGestorApp.marcarEtapaRapida('${t.id}', 'EM_ANDAMENTO')" class="px-2 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${stLinha === 'EM_ANDAMENTO' ? 'bg-sky-600 text-white border-sky-700' : 'bg-sky-50 hover:bg-sky-100 text-sky-800 border-sky-200'}">Fazendo</button>
                                      <button type="button" onclick="ZGestorApp.marcarEtapaRapida('${t.id}', 'ENTREGUE_NORMAL')" class="px-2 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${stLinha === 'ENTREGUE' && t.modalidade_entrega !== 'SEM_MOVIMENTO' ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'}">✓ Normal</button>
                                      <button type="button" onclick="ZGestorApp.marcarEtapaRapida('${t.id}', 'SEM_MOVIMENTO')" class="px-2 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${t.modalidade_entrega === 'SEM_MOVIMENTO' ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'}">S/ Mov.</button>
                                      <button type="button" onclick="ZGestorApp.openModalEditarTarefa('${t.id}')" class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition cursor-pointer" title="Editar">${svgEdit}</button>
                                      <button type="button" onclick="ZGestorApp.excluirTarefa('${t.id}')" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer" title="Excluir">${svgTrash}</button>
                                    </div>
                                  </div>
                                `;
                              }).join('')}
                            </div>
                          ` : ''}
                        </div>
                      `;
                    }).join('')}
                  </div>
                `;
              })()}
            </div>

            <!-- PAINEL LATERAL DIREITO "NOTION SIDE PEEK" (Tema Claro) -->
            ${sidePeekTarefa && sidePeekEmpresa ? `
              <div class="w-full lg:w-[460px] shrink-0 bg-white border border-slate-200 rounded-2xl p-5 shadow-xl space-y-4 text-slate-800 sticky top-4">
                <!-- Topo do Side Peek -->
                <div class="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div class="flex items-center gap-2">
                    <span class="text-xl">🏢</span>
                    <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Detalhes da Empresa & Tarefa</span>
                  </div>
                  <button
                    onclick="ZGestorApp.fecharNotionSidePeek()"
                    class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-base font-bold transition"
                    title="Fechar Painel (X)">
                    ✕
                  </button>
                </div>

                <!-- Título da Empresa em destaque -->
                <div>
                  <h2 class="text-base font-extrabold text-slate-900 leading-tight">
                    ${this.escapeHtml(sidePeekEmpresa.razao_social || sidePeekEmpresa.nome_fantasia)}
                  </h2>
                  ${sidePeekEmpresa.nome_fantasia && sidePeekEmpresa.nome_fantasia !== sidePeekEmpresa.razao_social ? `
                    <div class="text-xs text-slate-500 mt-0.5">
                      Fantasia: ${this.escapeHtml(sidePeekEmpresa.nome_fantasia)}
                    </div>
                  ` : ''}
                </div>

                <!-- Lista de Propriedades no estilo Notion -->
                <div class="space-y-2 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div class="flex items-center justify-between">
                    <span class="text-slate-500 flex items-center gap-1.5 font-mono text-[11px]">
                      <span>=</span> COD
                    </span>
                    <span class="font-mono font-bold text-slate-800">${this.escapeHtml(this.codLimpo(sidePeekEmpresa.codigo_interno) || '—')}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-slate-500 flex items-center gap-1.5 font-mono text-[11px]">
                      <span>=</span> CNPJ
                    </span>
                    <span class="font-mono font-semibold text-slate-800">${sidePeekEmpresa.cnpj}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-slate-500 flex items-center gap-1.5 font-mono text-[11px]">
                      <span>=</span> I.E.
                    </span>
                    <span class="font-mono text-slate-700">${sidePeekEmpresa.inscricao_estadual || 'ISENTO'}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-slate-500 flex items-center gap-1.5 font-mono text-[11px]">
                      <span>⊙</span> Tributação
                    </span>
                    <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                      ${sidePeekEmpresa.regime_tributario}
                    </span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-slate-500 flex items-center gap-1.5 font-mono text-[11px]">
                      <span>📅</span> Prazo Vencimento
                    </span>
                    <span class="font-bold text-slate-800">${this.formatDate(sidePeekTarefa.prazo_entrega)}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-slate-500 flex items-center gap-1.5 font-mono text-[11px]">
                      <span>👤</span> Responsável
                    </span>
                    <span class="font-semibold text-slate-800">${sidePeekTarefa.responsavel_nome || 'Não atribuído'}</span>
                  </div>
                  ${db.ehOperadorInterno && db.ehOperadorInterno() ? `
                    <div class="flex items-center justify-between pt-1.5 border-t border-slate-200/80">
                      <span class="text-slate-500 flex items-center gap-1.5 font-mono text-[11px]">
                        <span>📨</span> Envio Preferido (${comp})
                      </span>
                      <div>${this.renderBadgePreferenciaEnvio(sidePeekEmpresa, comp, false)}</div>
                    </div>
                  ` : ''}
                </div>

                <!-- Formulário de Alteração de Status & Observação rápida -->
                <form onsubmit="ZGestorApp.salvarNotionSidePeek(event, '${sidePeekTarefa.id}')" class="space-y-3.5 text-xs">
                  <div>
                    <label class="block font-bold text-slate-700 mb-1 uppercase text-[10px] tracking-wider">
                      Obrigação Selecionada:
                    </label>
                    <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 space-y-1.5">
                      <div>${sidePeekTarefa.titulo}</div>
                      ${db.ehTarefaDestda && db.ehTarefaDestda(sidePeekTarefa) ? (() => {
                        const resIcmsSp = db.obterResumoApuracaoIcmsParaDestda(sidePeekTarefa.empresa_id, comp);
                        if (!resIcmsSp) return '';
                        return `<div class="p-2 rounded-lg border text-[11px] font-extrabold ${resIcmsSp.cls}">${resIcmsSp.icone} ${this.escapeHtml(resIcmsSp.label)}</div>`;
                      })() : ''}
                    </div>
                  </div>

                  <!-- Seletor dos Status com visual Notion Pill -->
                  <div>
                    <label class="block font-bold text-slate-700 mb-1.5 uppercase text-[10px] tracking-wider">
                      Situação / Status da Tarefa *
                    </label>
                    <div class="grid grid-cols-2 gap-2">
                      <label class="cursor-pointer">
                        <input
                          type="radio"
                          name="notion-sp-status"
                          value="NAO_INICIADA"
                          class="peer sr-only"
                          ${db.obterStatusSimplesTarefa(sidePeekTarefa) === 'NAO_INICIADA' ? 'checked' : ''}
                        />
                        <div class="p-2 rounded-xl bg-white border border-slate-300 text-center peer-checked:bg-slate-700 peer-checked:border-slate-800 peer-checked:text-white transition">
                          <span class="inline-flex items-center gap-1 text-[11px] font-bold">
                            <span class="w-2 h-2 rounded-full bg-slate-400"></span> Não iniciada
                          </span>
                        </div>
                      </label>

                      <label class="cursor-pointer">
                        <input
                          type="radio"
                          name="notion-sp-status"
                          value="PENDENTE"
                          class="peer sr-only"
                          ${db.obterStatusSimplesTarefa(sidePeekTarefa) === 'PENDENTE' ? 'checked' : ''}
                        />
                        <div class="p-2 rounded-xl bg-white border border-slate-300 text-center peer-checked:bg-rose-600 peer-checked:border-rose-700 peer-checked:text-white transition">
                          <span class="inline-flex items-center gap-1 text-[11px] font-bold">
                            <span class="w-2 h-2 rounded-full bg-rose-400"></span> ⚠ Pendente
                          </span>
                        </div>
                      </label>

                      <label class="cursor-pointer">
                        <input
                          type="radio"
                          name="notion-sp-status"
                          value="AGUARDANDO_DOCS"
                          class="peer sr-only"
                          ${db.obterStatusSimplesTarefa(sidePeekTarefa) === 'AGUARDANDO_DOCS' ? 'checked' : ''}
                        />
                        <div class="p-2 rounded-xl bg-white border border-slate-300 text-center peer-checked:bg-amber-500 peer-checked:border-amber-600 peer-checked:text-white transition">
                          <span class="inline-flex items-center gap-1 text-[11px] font-bold">
                            <span class="w-2 h-2 rounded-full bg-amber-400"></span> Aguardando Docs
                          </span>
                        </div>
                      </label>

                      <label class="cursor-pointer">
                        <input
                          type="radio"
                          name="notion-sp-status"
                          value="EM_ANDAMENTO"
                          class="peer sr-only"
                          ${db.obterStatusSimplesTarefa(sidePeekTarefa) === 'EM_ANDAMENTO' ? 'checked' : ''}
                        />
                        <div class="p-2 rounded-xl bg-white border border-slate-300 text-center peer-checked:bg-sky-600 peer-checked:border-sky-700 peer-checked:text-white transition">
                          <span class="inline-flex items-center gap-1 text-[11px] font-bold">
                            <span class="w-2 h-2 rounded-full bg-sky-300"></span> Em Andamento
                          </span>
                        </div>
                      </label>

                      <label class="cursor-pointer col-span-2">
                        <input
                          type="radio"
                          name="notion-sp-status"
                          value="ENTREGUE"
                          class="peer sr-only"
                          ${db.obterStatusSimplesTarefa(sidePeekTarefa) === 'ENTREGUE' ? 'checked' : ''}
                        />
                        <div class="p-2 rounded-xl bg-white border border-slate-300 text-center peer-checked:bg-emerald-600 peer-checked:border-emerald-700 peer-checked:text-white transition">
                          <span class="inline-flex items-center gap-1 text-[11px] font-bold">
                            <span class="w-2 h-2 rounded-full bg-emerald-300"></span> Concluído
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <!-- Campo de Data de Entrega (se concluído) -->
                  <div>
                    <label class="block font-bold text-slate-700 mb-1 uppercase text-[10px] tracking-wider">Data de Entrega (se concluído)</label>
                    <input
                      type="date"
                      id="notion-sp-data-entrega"
                      value="${sidePeekTarefa.data_entrega || hoje}"
                      class="w-full rounded-xl bg-white border border-slate-300 px-3 py-1.5 text-xs text-slate-800"
                    />
                  </div>

                  <!-- Motivo da Pendência / Observações -->
                  <div>
                    <label class="block font-bold text-slate-700 mb-1 uppercase text-[10px] tracking-wider">
                      💬 Motivo da Pendência / Observações
                    </label>
                    <textarea
                      id="notion-sp-obs"
                      rows="3"
                      placeholder="Informe o motivo caso esteja Pendente, detalhes do andamento ou protocolo..."
                      class="w-full rounded-xl bg-white border border-slate-300 p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500">${this.escapeHtml(sidePeekTarefa.motivo_pendencia || sidePeekTarefa.protocolo_observacao || '')}</textarea>
                  </div>

                  <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onclick="ZGestorApp.openModalEditarTarefa('${sidePeekTarefa.id}')"
                      class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition">
                      Edição Avançada
                    </button>
                    <button
                      type="submit"
                      class="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition">
                      Salvar Alterações
                    </button>
                  </div>
                </form>

                <!-- Outras Obrigações da Mesma Empresa no Mês (Visão 360 estilo Notion) -->
                <div class="pt-3 border-t border-slate-200 space-y-2">
                  <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Outras Obrigações de ${sidePeekEmpresa.nome_fantasia} (${comp}):
                  </span>
                  <div class="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    ${sidePeekOutrasTarefas.map(ot => `
                      <div
                        onclick="ZGestorApp.abrirNotionSidePeek('${ot.id}')"
                        class="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-between cursor-pointer transition ${ot.id === sidePeekTarefa.id ? 'ring-2 ring-indigo-500 bg-indigo-50/40' : ''}">
                        <div class="truncate pr-2">
                          <span class="font-bold text-slate-800 block text-xs truncate">${this.escapeHtml(ot.titulo)}</span>
                          <span class="text-[10px] text-slate-500">${this.formatDate(ot.prazo_entrega)}</span>
                        </div>
                        <div>
                          ${renderNotionStatusPill(ot)}
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              </div>
            ` : ''}
          </div>
        ` : subTab === 'rotinas_config' ? `
          <!-- ABA SEPARADA: DEFINIR ROTINAS MENSAIS E ANUAIS -->
          <div class="space-y-4">
            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 class="text-base font-bold text-slate-900 flex items-center gap-2">
                  <i data-lucide="sliders-horizontal" class="w-5 h-5 text-indigo-600"></i>
                  <span>Configuração de Rotinas Automáticas (Mensais e Anuais)</span>
                </h2>
                <p class="text-xs text-slate-500 mt-0.5">
                  Defina exatamente quais obrigações e etapas serão geradas para cada regime tributário. Rotinas com <strong>Exige Inscrição Estadual</strong> só são criadas para empresas que possuem I.E. ativa.
                </p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onclick="ZGestorApp.openModalModelosTarefas()"
                  class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition cursor-pointer">
                  <i data-lucide="plus" class="w-4 h-4"></i>
                  <span>+ Nova Rotina</span>
                </button>
                <button
                  type="button"
                  onclick="ZGestorApp.gerarTarefasMesAtual()"
                  class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition cursor-pointer">
                  <i data-lucide="zap" class="w-4 h-4"></i>
                  <span>Gerar Rotinas (${comp})</span>
                </button>
              </div>
            </div>

            ${(() => {
              const modelos = db.getModelosTarefas();
              const deptsCfg = [
                { key: 'FISCAL', titulo: 'Departamento Fiscal (Simples, Presumido e Real)', cor: 'orange', desc: 'Etapas separadas de cobrança, apuração PGDAS/ICMS/DeSTDA e SPEDs (EFD-Contribuições, EFD-ICMS/IPI, EFD-Reinf, IRPJ/CSLL).' },
                { key: 'CONTABIL', titulo: 'Departamento Contábil (Mensal e Anual)', cor: 'blue', desc: 'Etapas separadas de cobrança de extratos, conciliação bancária, fechamento mensal (Matriz Anual) e declarações anuais ECD/ECF.' },
                { key: 'PESSOAL', titulo: 'Departamento Pessoal (DP)', cor: 'emerald', desc: 'Deixado desativado por padrão conforme preferência do escritório. Ative manualmente se desejar gerar rotinas de folha/pró-labore.' },
                { key: 'SOCIETARIO', titulo: 'Societário / Legalização', cor: 'purple', desc: 'Rotinas de monitoramento societário e certidões.' }
              ];

              return deptsCfg.map(dep => {
                const itens = modelos.filter(m => m.departamento === dep.key);
                return `
                  <div class="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                    <div class="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h3 class="text-sm font-bold text-slate-900">${dep.titulo}</h3>
                        <p class="text-[11px] text-slate-500">${dep.desc}</p>
                      </div>
                      <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white border border-slate-200 text-slate-700 shrink-0">
                        ${itens.filter(i => i.ativo).length} ativa(s) de ${itens.length}
                      </span>
                    </div>

                    ${itens.length === 0 ? `
                      <div class="p-6 text-center text-xs text-slate-400 italic">
                        Nenhuma rotina cadastrada para este departamento.
                      </div>
                    ` : `
                      <div class="divide-y divide-slate-100">
                        ${itens.map(m => `
                          <div class="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-slate-50/70 transition ${!m.ativo ? 'opacity-60 bg-slate-50/40' : ''}">
                            <div class="space-y-1">
                              <div class="flex items-center gap-2 flex-wrap">
                                <span class="font-bold text-slate-900 text-xs">${this.escapeHtml(m.titulo)}</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ${m.periodicidade === 'ANUAL' ? 'bg-purple-50 text-purple-800 border-purple-200' : m.periodicidade === 'TRIMESTRAL' ? 'bg-teal-50 text-teal-800 border-teal-300' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}">
                                  ${m.periodicidade === 'ANUAL' ? `ANUAL (Mês ${m.mes_entrega || '06'})` : m.periodicidade === 'TRIMESTRAL' ? 'TRIMESTRAL (Mar/Jun/Set/Dez)' : 'MENSAL'}
                                </span>
                                ${m.antecipar_dia_util ? `
                                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                                    Antecipa Dia Útil
                                  </span>
                                ` : ''}
                                ${m.requer_ie ? `
                                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                                    Exige Inscrição Estadual (I.E.)
                                  </span>
                                ` : ''}
                              </div>
                              <p class="text-[11px] text-slate-500">${this.escapeHtml(m.descricao || '')}</p>
                              <div class="flex flex-wrap items-center gap-1.5 pt-0.5 text-[10px]">
                                <span class="text-slate-500 font-semibold">Prazo dia ${m.dia_prazo_padrao}</span>
                                <span class="text-slate-300">•</span>
                                ${(m.regimes_aplicaveis || []).map(r => `
                                  <span class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">${r}</span>
                                `).join('')}
                              </div>
                            </div>

                            <div class="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onclick="ZGestorApp.alternarRotinaAtiva('${m.id}')"
                                class="px-3 py-1.5 rounded-xl font-bold text-[11px] border transition cursor-pointer ${m.ativo ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100' : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'}">
                                ${m.ativo ? '● Ativa (Gerando)' : '○ Desativada'}
                              </button>
                              <button
                                type="button"
                                onclick="ZGestorApp.openModalModelosTarefas('${m.id}')"
                                class="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] transition cursor-pointer">
                                Editar
                              </button>
                              <button
                                type="button"
                                onclick="ZGestorApp.excluirModeloRecorrente('${m.id}')"
                                class="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                                title="Excluir rotina">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                              </button>
                            </div>
                          </div>
                        `).join('')}
                      </div>
                    `}
                  </div>
                `;
              }).join('');
            })()}
          </div>
        ` : subTab === 'fechamentos_geral' ? `
          <!-- SUB-ABA 2: VISÃO GERAL & CONTROLE DE FECHAMENTOS CONTÁBEIS (MATRIZ ANUAL JAN–DEZ) -->
          <div class="bg-white p-4 rounded-2xl border border-purple-200 shadow-sm space-y-4">
            <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <div class="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-purple-700">
                  <i data-lucide="book-check" class="w-4 h-4"></i> Painel Anual de Controle de Fechamentos Contábeis, Balancetes e Rotinas
                </div>
                <h2 class="text-base font-bold text-slate-900 mt-0.5">
                  Matriz Geral de Fechamentos por Empresa — Exercício ${anoFechamento}
                </h2>
                <p class="text-xs text-slate-500">
                  Visualize rapidamente todos os meses que já foram <strong>Fechados/Entregues</strong>, estão <strong>Em Andamento</strong> ou <strong>Pendentes</strong> para realizar fechamentos contábeis e balanços. <strong>Clique em qualquer mês</strong> para alterar o status e registrar observações!
                </p>
              </div>

              <!-- Controles do Ano e Setor do Fechamento -->
              <div class="flex flex-wrap items-center gap-2">
                <div class="inline-flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200">
                  <button onclick="ZGestorApp.setFiltro('anoFechamentoContabil', ${anoFechamento - 1})" class="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 hover:bg-white">◀ ${anoFechamento - 1}</button>
                  <span class="px-3 py-1 rounded-lg bg-purple-700 text-white text-xs font-extrabold">Ano ${anoFechamento}</span>
                  <button onclick="ZGestorApp.setFiltro('anoFechamentoContabil', ${anoFechamento + 1})" class="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 hover:bg-white">${anoFechamento + 1} ▶</button>
                </div>

                <select
                  onchange="ZGestorApp.setFiltro('filtroSetorFechamento', this.value)"
                  class="rounded-xl border border-purple-300 bg-purple-50/50 px-3 py-1.5 text-xs font-bold text-purple-900">
                  <option value="CONTABIL" ${fSetorFechamento === 'CONTABIL' ? 'selected' : ''}>📘 Setor Contábil (Balancetes / Fechamentos)</option>
                  <option value="FISCAL" ${fSetorFechamento === 'FISCAL' ? 'selected' : ''}>📙 Setor Fiscal (Apurações Mensais)</option>
                  <option value="PESSOAL" ${fSetorFechamento === 'PESSOAL' ? 'selected' : ''}>📗 Setor Pessoal (Pró-Labore / Folha)</option>
                  <option value="TODOS" ${fSetorFechamento === 'TODOS' ? 'selected' : ''}>🌐 Todos os Setores Consolidados</option>
                </select>

                <select
                  onchange="ZGestorApp.setFiltro('filtroTarefaCliente', this.value)"
                  class="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800">
                  <option value="TODOS" ${fCliente === 'TODOS' ? 'selected' : ''}>Todas as Empresas</option>
                  ${db.data.empresas.map(e => `
                    <option value="${e.id}" ${fCliente === e.id ? 'selected' : ''}>${this.codLimpo(e.codigo_interno) ? this.codLimpo(e.codigo_interno) + ' — ' : ''}${this.escapeHtml(e.razao_social || e.nome_fantasia)}</option>
                  `).join('')}
                </select>
              </div>
            </div>

            <!-- Legenda da Matriz Anual -->
            <div class="flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200">
              <div class="flex flex-wrap items-center gap-3.5">
                <span class="font-bold text-slate-700">Legenda dos Meses (Clique no mês p/ editar):</span>
                <span class="inline-flex items-center gap-1.5 font-bold text-indigo-900"><span class="w-3 h-3 rounded bg-indigo-600 inline-block"></span> ⭐ Fechado e Conferido</span>
                <span class="inline-flex items-center gap-1.5 font-semibold text-emerald-800"><span class="w-3 h-3 rounded bg-emerald-500 inline-block"></span> ✓ Fechado</span>
                <span class="inline-flex items-center gap-1.5 font-semibold text-sky-800"><span class="w-3 h-3 rounded bg-sky-500 inline-block"></span> Em Andamento</span>
                <span class="inline-flex items-center gap-1.5 font-semibold text-amber-800"><span class="w-3 h-3 rounded bg-amber-400 inline-block"></span> Pendente</span>
                <span class="inline-flex items-center gap-1.5 font-semibold text-slate-500"><span class="w-3 h-3 rounded bg-slate-200 inline-block"></span> Não Iniciado</span>
              </div>
              <span class="text-[11px] text-purple-800 font-semibold">💬 Ícone indica mês com observação registrada</span>
            </div>

            <!-- MATRIZ ANUAL JAN A DEZ POR EMPRESA -->
            <div class="overflow-x-auto w-full">
              <table class="w-full min-w-[920px] text-left border-collapse">
                <thead>
                  <tr class="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-600">
                    <th class="py-2.5 px-2.5 w-[18%]">Empresa Cliente & Regime</th>
                    ${mesesLista.map(m => `
                      <th class="py-2.5 px-1 text-center w-[5.4%] ${comp === `${m.num}/${anoFechamento}` ? 'bg-indigo-100 text-indigo-900 rounded-t-lg' : ''}">
                        ${m.curto || m.abrev || (m.nome && m.nome.slice(0, 3)) || ''}/${String(anoFechamento).slice(-2)}
                      </th>
                    `).join('')}
                    <th class="py-2.5 px-2 text-center w-[7%]">Fechado Ano</th>
                    <th class="py-2.5 px-2.5 text-center w-[11%]">Encerramento Exercício</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 text-xs">
                  ${empresasFechamento.map(emp => {
          let mesesConcluidos = 0;
          let mesesComRegistro = 0;
          const celulasHtml = mesesLista.map(m => {
            const compMes = `${m.num}/${anoFechamento}`;
            let tarefasCelula = db.data.tarefas.filter(t => t.empresa_id === emp.id && t.competencia === compMes);
            if (fSetorFechamento !== 'TODOS') {
              tarefasCelula = tarefasCelula.filter(t => t.departamento === fSetorFechamento);
            }

            if (tarefasCelula.length === 0) {
              return `
                          <td class="py-2 px-1 text-center">
                            <button
                              onclick="ZGestorApp.openModalFechamentoMes('${emp.id}', '${compMes}', '${fSetorFechamento === 'TODOS' ? 'CONTABIL' : fSetorFechamento}')"
                              title="${emp.nome_fantasia} (${compMes}): Sem lançamento. Clique para registrar Fechamento/Andamento/Pendência e Observação."
                              class="w-full py-1.5 px-1 rounded-lg border border-dashed border-slate-200 hover:border-purple-400 hover:bg-purple-50 text-[10px] font-semibold text-slate-400 hover:text-purple-700 transition">
                              —
                            </button>
                          </td>
                        `;
            }

            mesesComRegistro++;
            const todasConferidas = tarefasCelula.length > 0 && tarefasCelula.every(t => db.obterStatusSimplesTarefa(t) === 'CONFERIDO');
            const todasEntregues = tarefasCelula.length > 0 && tarefasCelula.every(t => {
              const st = db.obterStatusSimplesTarefa(t);
              return st === 'ENTREGUE' || st === 'CONFERIDO';
            });
            const algumaAndamento = tarefasCelula.some(t => db.obterStatusSimplesTarefa(t) === 'EM_ANDAMENTO');
            const algumaEntregueOuConf = tarefasCelula.some(t => {
              const st = db.obterStatusSimplesTarefa(t);
              return st === 'ENTREGUE' || st === 'CONFERIDO';
            });
            const todasNaoIniciadas = tarefasCelula.every(t => db.obterStatusSimplesTarefa(t) === 'NAO_INICIADA');
            const obsConcat = tarefasCelula.map(t => t.protocolo_observacao).filter(Boolean).join(' | ');

            let clsBtn = 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300';
            let txtBtn = 'Pend.';
            if (todasConferidas) {
              mesesConcluidos++;
              clsBtn = 'bg-indigo-100 hover:bg-indigo-200 text-indigo-950 border-indigo-300 font-black shadow-2xs';
              txtBtn = '⭐ Conf.';
            } else if (todasEntregues) {
              mesesConcluidos++;
              clsBtn = 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border-emerald-300 font-extrabold';
              txtBtn = '✓ Fech.';
            } else if (algumaAndamento || algumaEntregueOuConf) {
              clsBtn = 'bg-sky-100 hover:bg-sky-200 text-sky-900 border-sky-300';
              txtBtn = 'Andam.';
            } else if (todasNaoIniciadas) {
              clsBtn = 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-300';
              txtBtn = 'Não Inic.';
            }

            return `
                        <td class="py-2 px-1 text-center">
                          <button
                            onclick="ZGestorApp.openModalFechamentoMes('${emp.id}', '${compMes}', '${fSetorFechamento === 'TODOS' ? 'CONTABIL' : fSetorFechamento}')"
                            title="${emp.nome_fantasia} — Comp. ${compMes}: ${obsConcat || 'Clique para ver/editar status e observação'}"
                            class="w-full py-1.5 px-1 rounded-lg border text-[10px] font-extrabold transition flex items-center justify-center gap-0.5 ${clsBtn}">
                            <span>${txtBtn}</span>
                            ${obsConcat ? `<span title="${obsConcat}">💬</span>` : ''}
                          </button>
                        </td>
                      `;
          }).join('');

          const percAno = Math.round((mesesConcluidos / 12) * 100);
          const encEx = db.getEncerramentoExercicio(emp.id, anoFechamento);
          const estaEncerrado = encEx && encEx.status === 'ENCERRADO';

          return `
                      <tr class="hover:bg-slate-50">
                        <td class="py-2.5 px-2.5">
                          <div class="font-bold text-slate-900">${this.escapeHtml(emp.razao_social || emp.nome_fantasia)}</div>
                          <div class="text-[10px] text-slate-500">${this.codLimpo(emp.codigo_interno) ? `<span class="font-mono font-bold text-indigo-700">${this.escapeHtml(this.codLimpo(emp.codigo_interno))}</span> • ` : ''}${emp.regime_tributario}</div>
                        </td>
                        ${celulasHtml}
                        <td class="py-2.5 px-2 text-center">
                          <div class="font-extrabold text-slate-900">${mesesConcluidos}/12</div>
                          <div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                            <div class="h-full bg-emerald-600 rounded-full" style="width: ${percAno}%"></div>
                          </div>
                        </td>
                        <td class="py-2.5 px-2 text-center">
                          <button
                            onclick="ZGestorApp.openModalEncerramentoExercicio('${emp.id}', ${anoFechamento})"
                            class="w-full py-1.5 px-2 rounded-xl text-[10px] font-bold transition flex items-center justify-center gap-1 shadow-2xs ${estaEncerrado
              ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border border-emerald-300'
              : 'bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200'}"
                            title="${estaEncerrado ? `Exercício ${anoFechamento} encerrado em ${encEx.data_encerramento}` : `Clique para formalizar encerramento contábil de ${anoFechamento}`}">
                            <span>${estaEncerrado ? '✅ Encerrado' : '📜 Encerrar ' + anoFechamento}</span>
                          </button>
                        </td>
                      </tr>
                    `;
        }).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- LISTA GERAL CONSOLIDADA DE TODAS AS COMPETÊNCIAS DO ANO (HISTÓRICO DE FECHAMENTOS) -->
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 class="text-sm font-bold text-slate-900">Histórico Geral de Tarefas e Fechamentos no Exercício ${anoFechamento} (${tarefasAnoGeral.length} registros)</h3>
                <p class="text-xs text-slate-500">Confira tudo que já foi entregue, o que está em andamento e as observações de todas as competências para auxiliar no fechamento contábil.</p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <select
                  onchange="ZGestorApp.setFiltro('filtroStatusGeralAnual', this.value)"
                  class="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold">
                  <option value="TODOS" ${fStatusGeral === 'TODOS' ? 'selected' : ''}>Todos os Status (${anoFechamento})</option>
                  <option value="ENTREGUE" ${fStatusGeral === 'ENTREGUE' ? 'selected' : ''}>✅ Somente Já Fechados / Entregues</option>
                  <option value="EM_ANDAMENTO" ${fStatusGeral === 'EM_ANDAMENTO' ? 'selected' : ''}>🔄 Somente Em Andamento</option>
                  <option value="PENDENTE" ${fStatusGeral === 'PENDENTE' ? 'selected' : ''}>⏳ Somente Pendentes</option>
                </select>
                <input
                  type="text"
                  id="input-filtro-fechamento-busca"
                  value="${this.escapeHtml(appState.filtroTarefaBusca || '')}"
                  oninput="ZGestorApp.setFiltro('filtroTarefaBusca', this.value)"
                  placeholder="Filtrar por empresa, mês ou observação..."
                  class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs"
                />
              </div>
            </div>

            <div class="overflow-x-auto w-full">
              <table class="w-full min-w-[700px] text-left border-collapse">
              <thead>
                <tr class="bg-white border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                  <th class="py-2.5 px-3 w-[12%]">Competência</th>
                  <th class="py-2.5 px-2.5 w-[20%]">Cliente & Regime</th>
                  <th class="py-2.5 px-2.5 w-[12%]">Setor</th>
                  <th class="py-2.5 px-3 w-[32%]">Obrigação / Fechamento & Observação</th>
                  <th class="py-2.5 px-2.5 w-[24%] text-right">Status (Pendente / Andamento / Entregue)</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-xs">
                ${tarefasAnoGeral.slice(0, 45).map(t => {
          const emp = this.obterEmp(db, t.empresa_id, t);
          return `
                    <tr class="hover:bg-slate-50">
                      <td class="py-2.5 px-3">
                        <span class="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-800 font-extrabold text-xs border border-indigo-200">${t.competencia}</span>
                        <div class="text-[10px] text-slate-500 mt-0.5">${db.formatarNomeCompetencia(t.competencia)}</div>
                      </td>
                      <td class="py-2.5 px-2.5">
                        <div class="font-bold text-slate-900">${this.escapeHtml(this.nomeEmp(emp, { comCodigo: true, fallbackObj: t }))}</div>
                        <div class="text-[11px] text-slate-500">${emp ? emp.regime_tributario : ''}</div>
                      </td>
                      <td class="py-2.5 px-2.5">${this.deptBadge(t.departamento)}</td>
                      <td class="py-2.5 px-3">
                        <div class="font-bold text-slate-900">${this.escapeHtml(t.titulo)}</div>
                        <div class="text-[11px] text-slate-600 mt-0.5">
                          ${t.protocolo_observacao ? `<span class="font-semibold text-indigo-700">📝 Obs: ${t.protocolo_observacao}</span>` : '<span class="text-slate-400 italic">Sem observação</span>'}
                        </div>
                        ${t.data_entrega ? `<div class="text-[10px] text-emerald-700 font-semibold mt-0.5">Entregue em ${this.formatDate(t.data_entrega)} • Resp: ${t.responsavel_nome || '—'}</div>` : ''}
                      </td>
                      <td class="py-2.5 px-2.5 text-right">
                        ${renderSeletorStatusTarefa(t)}
                      </td>
                    </tr>
                  `;
        }).join('') || `
                  <tr>
                    <td colspan="5" class="py-8 text-center text-slate-400">Nenhum registro encontrado para os filtros selecionados no exercício ${anoFechamento}.</td>
                  </tr>
                `}
              </tbody>
            </table>
            </div>
          </div>
        ` : `
          <!-- SUB-ABA 3: CONTROLE DE GUIAS, PROTOCOLO OFFICE BOY & ENVIO DIGITAL -->
          ${(() => {
            const protocolosComp = db.getProtocolosGuias(comp);
            const selecionadas = appState.guiasSelecionadas || [];
            const ehPendente = (g) => !['IMPRESSA_OFFICE_BOY', 'ENVIADA_WHATSAPP', 'ENVIADA_EMAIL', 'ARQUIVADA_ASSINADA', 'ENVIADA_CLIENTE', 'VISUALIZADA_CLIENTE'].includes(g.status_envio);
            const mostrarArquivadasNaTabela = fGuiaStatus === 'ARQUIVADA_ASSINADA' || fGuiaStatus === 'ENVIADAS_DIGITAIS';
            const listaGuiasAtivas = mostrarArquivadasNaTabela
              ? listaGuiasImpostos
              : listaGuiasImpostos.filter(g => g.status_envio !== 'ARQUIVADA_ASSINADA');
            const listaGuiasArquivadas = (fCliente !== 'TODOS' ? todasGuiasComp.filter(g => g.empresa_id === fCliente) : todasGuiasComp)
              .filter(g => g.status_envio === 'ARQUIVADA_ASSINADA');
            const pendentesLista = listaGuiasAtivas.filter(ehPendente);
            const idsPendentes = pendentesLista.map(g => g.id);
            const todasPendMarcadas = idsPendentes.length > 0 && idsPendentes.every(id => selecionadas.includes(id));

            const qPendentes = todasGuiasComp.filter(ehPendente).length;
            const qEmRota = todasGuiasComp.filter(g => g.status_envio === 'IMPRESSA_OFFICE_BOY').length;
            const qDigitais = todasGuiasComp.filter(ehGuiaDigital).length;
            const qArquivadas = todasGuiasComp.filter(g => g.status_envio === 'ARQUIVADA_ASSINADA').length;

            return `
              <div class="space-y-4">
                <!-- 4 KPIs Limpos -->
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div class="bg-white p-3.5 rounded-2xl border border-amber-200 shadow-2xs">
                    <div class="text-[11px] font-bold text-amber-700 uppercase">Pendentes de Envio</div>
                    <div class="text-2xl font-black text-amber-600 mt-1">${qPendentes}</div>
                    <div class="text-[10px] text-slate-500">Aguardando Office Boy ou envio digital</div>
                  </div>
                  <div class="bg-white p-3.5 rounded-2xl border border-blue-200 shadow-2xs">
                    <div class="text-[11px] font-bold text-blue-700 uppercase">Em Rota (Office Boy)</div>
                    <div class="text-2xl font-black text-blue-600 mt-1">${qEmRota}</div>
                    <div class="text-[10px] text-slate-500">Impressas aguardando retorno assinado</div>
                  </div>
                  <div class="bg-white p-3.5 rounded-2xl border border-emerald-200 shadow-2xs">
                    <div class="text-[11px] font-bold text-emerald-700 uppercase">Enviadas (WhatsApp/E-mail)</div>
                    <div class="text-2xl font-black text-emerald-600 mt-1">${qDigitais}</div>
                    <div class="text-[10px] text-slate-500">Enviadas e arquivadas automaticamente</div>
                  </div>
                  <div class="bg-white p-3.5 rounded-2xl border border-teal-200 shadow-2xs">
                    <div class="text-[11px] font-bold text-teal-800 uppercase">Assinadas e Arquivadas</div>
                    <div class="text-2xl font-black text-teal-700 mt-1">${qArquivadas}</div>
                    <div class="text-[10px] text-slate-500">Total arquivado (Office Boy + Digital)</div>
                  </div>
                </div>

                <!-- Filtros & Ações -->
                <div class="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <div>
                    <label class="block text-[10px] font-bold uppercase text-slate-500 mb-1">Empresa</label>
                    ${this.renderSeletorEmpresaBusca({
                      uid: 'prot-filtro-emp',
                      inputId: 'f-prot-filtro-emp',
                      selectedId: fCliente,
                      placeholder: 'Todas as Empresas (digite razão ou cód.)...',
                      onChangeFn: "ZGestorApp.setFiltro('filtroTarefaCliente', val)",
                      allowAllOption: true,
                      allOptionValue: 'TODOS',
                      allOptionLabel: 'Todas as Empresas'
                    })}
                  </div>
                  <div>
                    <label class="block text-[10px] font-bold uppercase text-slate-500 mb-1">Tipo de Guia</label>
                    <select onchange="ZGestorApp.setFiltro('filtroGuiaImpostoTipo', this.value)" class="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-800">
                      <option value="TODOS" ${fGuiaTipo === 'TODOS' ? 'selected' : ''}>Todas (DAS, ICMS, DARF...)</option>
                      ${modelosTiposGuias.map(tg => `<option value="${tg.sigla}" ${fGuiaTipo === tg.sigla ? 'selected' : ''}>${tg.sigla}</option>`).join('')}
                      <option value="Parcelamento" ${fGuiaTipo === 'Parcelamento' ? 'selected' : ''}>Parcelamentos</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-[10px] font-bold uppercase text-slate-500 mb-1">Status de Entrega</label>
                    <select onchange="ZGestorApp.setFiltro('filtroGuiaImpostoStatus', this.value)" class="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-800">
                      <option value="TODOS" ${fGuiaStatus === 'TODOS' ? 'selected' : ''}>Todos os Status</option>
                      <option value="PENDENTES" ${fGuiaStatus === 'PENDENTES' ? 'selected' : ''}>⏳ Pendentes de Envio</option>
                      <option value="IMPRESSA_OFFICE_BOY" ${fGuiaStatus === 'IMPRESSA_OFFICE_BOY' ? 'selected' : ''}>🖨️ Em Rota (Office Boy)</option>
                      <option value="ENVIADAS_DIGITAIS" ${fGuiaStatus === 'ENVIADAS_DIGITAIS' ? 'selected' : ''}>💬 Enviadas (WhatsApp / E-mail)</option>
                      <option value="ARQUIVADA_ASSINADA" ${fGuiaStatus === 'ARQUIVADA_ASSINADA' ? 'selected' : ''}>📁 Assinadas e Arquivadas</option>
                    </select>
                  </div>
                  ${db.ehOperadorInterno && db.ehOperadorInterno() ? `
                    <div>
                      <label class="block text-[10px] font-bold uppercase text-indigo-700 mb-1">Preferência do Cliente (Operador)</label>
                      <select onchange="ZGestorApp.setFiltro('filtroGuiaPreferenciaEnvio', this.value)" class="w-full rounded-xl border border-indigo-200 bg-indigo-50/30 px-2.5 py-1.5 text-xs font-semibold text-slate-800">
                        <option value="TODOS" ${fPrefGuia === 'TODOS' ? 'selected' : ''}>Todas as Preferências</option>
                        <option value="IMPRESSO" ${fPrefGuia === 'IMPRESSO' ? 'selected' : ''}>🖨️ Prefere Impresso</option>
                        <option value="WHATSAPP" ${fPrefGuia === 'WHATSAPP' ? 'selected' : ''}>💬 Prefere WhatsApp</option>
                        <option value="EMAIL" ${fPrefGuia === 'EMAIL' ? 'selected' : ''}>✉️ Prefere E-mail</option>
                        <option value="NAO_DEFINIDO" ${fPrefGuia === 'NAO_DEFINIDO' ? 'selected' : ''}>⚪ Sem preferência definida</option>
                      </select>
                    </div>
                  ` : ''}
                  <div class="flex items-end gap-1.5">
                    <button onclick="ZGestorApp.openModalApuracaoIrpjCsll(null, 'TRANSMITIR')" title="Apurar IRPJ e CSLL Trimestral (Quota Única ou até 3 Quotas)" class="flex-1 py-1.5 px-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-xs cursor-pointer">
                      <i data-lucide="layers" class="w-3.5 h-3.5"></i> IRPJ/CSLL Quotas
                    </button>
                    <button onclick="ZGestorApp.openModalGuiaImposto()" class="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-xs cursor-pointer shrink-0">
                      <i data-lucide="plus" class="w-3.5 h-3.5"></i> Nova Guia
                    </button>
                  </div>
                </div>

                <!-- Barra de Ação em Lote (Office Boy / WhatsApp / E-mail) -->
                <div class="bg-slate-900 text-white p-3.5 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                  <div class="flex items-center gap-3">
                    <label class="inline-flex items-center gap-2 cursor-pointer font-bold select-none">
                      <input
                        type="checkbox"
                        ${todasPendMarcadas ? 'checked' : ''}
                        onchange="ZGestorApp.selecionarTodasGuiasPendentes(${JSON.stringify(idsPendentes)})"
                        class="w-4 h-4 rounded text-indigo-500"
                      />
                      <span>Selecionar Pendentes (${idsPendentes.length})</span>
                    </label>
                    <span class="px-2.5 py-0.5 rounded-full bg-indigo-500/30 border border-indigo-400/40 font-bold text-indigo-200">
                      ${selecionadas.length} selecionada(s)
                    </span>
                  </div>

                  <div class="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onclick="ZGestorApp.gerarProtocoloOfficeBoySelecionadas()"
                      class="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs">
                      <i data-lucide="printer" class="w-3.5 h-3.5"></i>
                      <span>Imprimir & Gerar Protocolo Office Boy (${selecionadas.length})</span>
                    </button>
                    <button
                      type="button"
                      onclick="ZGestorApp.openModalEnvioDigitalGuias('WHATSAPP')"
                      class="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs">
                      <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
                      <span>Enviada WhatsApp (${selecionadas.length})</span>
                    </button>
                    <button
                      type="button"
                      onclick="ZGestorApp.openModalEnvioDigitalGuias('EMAIL')"
                      class="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs">
                      <i data-lucide="mail" class="w-3.5 h-3.5"></i>
                      <span>Enviada E-mail (${selecionadas.length})</span>
                    </button>
                  </div>
                </div>

                <!-- Lista Limpa de Guias para Envio -->
                <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div class="overflow-x-auto w-full">
                    <table class="w-full min-w-[780px] text-left border-collapse text-xs">
                      <thead>
                        <tr class="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                          <th class="py-3 px-3 w-10 text-center">Sel.</th>
                          <th class="py-3 px-3">Empresa</th>
                          <th class="py-3 px-3">Guia / Imposto</th>
                          <th class="py-3 px-3">Vencimento</th>
                          <th class="py-3 px-3">Status & Protocolo</th>
                          <th class="py-3 px-3 text-right">Ações Rápidas</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-100">
                        ${listaGuiasAtivas.length === 0 ? `
                          <tr>
                            <td colspan="6" class="py-8 text-center text-slate-400">
                              Nenhuma guia pendente ou em rota para os filtros selecionados. Guias já arquivadas ficam na seção separada abaixo.
                            </td>
                          </tr>
                        ` : listaGuiasAtivas.map(g => {
                          const emp = this.obterEmp(db, g.empresa_id, g);
                          const marcado = selecionadas.includes(g.id);
                          const pend = ehPendente(g);
                          const ehAvulsoReal = Boolean(!emp && g.cliente_avulso);
                          return `
                            <tr class="hover:bg-slate-50 ${marcado ? 'bg-indigo-50/50' : ''}">
                              <td class="py-3 px-3 text-center">
                                <input
                                  type="checkbox"
                                  ${marcado ? 'checked' : ''}
                                  onchange="ZGestorApp.toggleSelecaoGuia('${g.id}')"
                                  class="w-4 h-4 rounded text-indigo-600 cursor-pointer"
                                />
                              </td>
                              <td class="py-3 px-3">
                                <div class="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                                  <span>${this.escapeHtml(this.nomeEmp(emp, { comCodigo: true, fallbackObj: g }))}</span>
                                  ${ehAvulsoReal ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">Avulso</span>` : ''}
                                </div>
                                <div class="text-[11px] text-slate-500">${emp ? `${emp.cnpj} • ${emp.regime_tributario}` : this.escapeHtml(g.documento || (ehAvulsoReal ? 'Parcelamento Avulso' : ''))}</div>
                                ${emp ? `<div class="mt-1">${this.renderBadgePreferenciaEnvio(emp, comp, true)}</div>` : ''}
                              </td>
                              <td class="py-3 px-3">
                                <div class="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                                  <span>${this.escapeHtml(g.tipo_guia || 'Guia')}</span>
                                  <span class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-mono">Comp. ${g.competencia}</span>
                                </div>
                                ${g.observacoes ? `<div class="text-[11px] text-slate-500 mt-0.5">${this.escapeHtml(g.observacoes)}</div>` : ''}
                              </td>
                              <td class="py-3 px-3 whitespace-nowrap">
                                <div class="font-bold text-slate-800">${this.formatDate(g.data_vencimento)}</div>
                              </td>
                              <td class="py-3 px-3">
                                <div>${statusGuiaImpBadge(g.status_envio, g)}</div>
                                ${g.protocolo_codigo ? `
                                  <div class="text-[11px] font-mono font-bold text-blue-700 mt-1">${g.protocolo_codigo}</div>
                                ` : g.data_envio ? `
                                  <div class="text-[11px] text-slate-600 mt-1">
                                    <strong>${this.formatDate(g.data_envio)}</strong> • ${g.canal_envio || ''}
                                    ${(g.enviado_por || g.responsavel_nome) ? `<div>Por: <strong>${this.escapeHtml(g.enviado_por || g.responsavel_nome)}</strong></div>` : ''}
                                  </div>
                                ` : ''}
                              </td>
                              <td class="py-3 px-3 text-right whitespace-nowrap">
                                <div class="inline-flex items-center justify-end gap-1">
                                  ${pend ? `
                                    <button type="button" onclick="ZGestorApp.gerarProtocoloOfficeBoySelecionadas('${g.id}')" class="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-[10px] font-bold cursor-pointer" title="Imprimir e Gerar Protocolo Office Boy">Office Boy</button>
                                    <button type="button" onclick="ZGestorApp.openModalEnvioDigitalGuias('WHATSAPP', '${g.id}')" class="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold cursor-pointer" title="Marcar Enviada via WhatsApp">WhatsApp</button>
                                    <button type="button" onclick="ZGestorApp.openModalEnvioDigitalGuias('EMAIL', '${g.id}')" class="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10px] font-bold cursor-pointer" title="Marcar Enviada via E-mail">E-mail</button>
                                  ` : ''}
                                  <button onclick="ZGestorApp.openModalGuiaImposto('${g.id}')" class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 cursor-pointer" title="Editar"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                                  <button onclick="ZGestorApp.excluirGuiaImposto('${g.id}')" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer" title="Excluir"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                                </div>
                              </td>
                            </tr>
                          `;
                        }).join('')}
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- ARQUIVO DE PROTOCOLOS DO MÊS (OFFICE BOY) -->
                <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div class="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h3 class="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <i data-lucide="archive" class="w-4 h-4 text-indigo-600"></i>
                        <span>Arquivo de Protocolos de Office Boy — Competência ${comp}</span>
                      </h3>
                      <p class="text-[11px] text-slate-500">Todos os lotes impressos ficam arquivados juntos aqui para conferência e baixa após assinatura.</p>
                    </div>
                    <span class="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700">
                      ${protocolosComp.length} protocolo(s)
                    </span>
                  </div>

                  ${protocolosComp.length === 0 ? `
                    <div class="p-6 text-center text-xs text-slate-400 italic">
                      Nenhum protocolo de Office Boy gerado nesta competência ainda. Selecione as guias acima e clique em "Imprimir & Gerar Protocolo Office Boy".
                    </div>
                  ` : `
                    <div class="divide-y divide-slate-100">
                      ${protocolosComp.map(prot => {
                        const arquivado = prot.status === 'ARQUIVADO_ASSINADO';
                        return `
                          <div class="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70">
                            <div class="space-y-1">
                              <div class="flex items-center gap-2 flex-wrap">
                                <span class="font-mono font-extrabold text-xs text-indigo-800 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-200">${prot.codigo}</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ${arquivado ? 'bg-teal-100 text-teal-900 border-teal-300' : 'bg-blue-100 text-blue-900 border-blue-300'}">
                                  ${arquivado ? `✓ Assinado e Arquivado em ${this.formatDate(prot.data_arquivamento)}` : '🖨️ Em Rota (Aguardando Retorno Assinado)'}
                                </span>
                                <span class="text-xs font-bold text-slate-600">• ${(prot.guia_ids || []).length} guia(s)</span>
                              </div>
                              <div class="text-[11px] text-slate-600">
                                <strong>Empresas:</strong> ${(prot.itens || []).map(it => it.empresa_nome).join(', ')}
                              </div>
                              <div class="text-[10px] text-slate-400">
                                Emitido em ${this.formatDate(prot.data_saida)} por ${prot.responsavel_emissao || 'Escritório'}
                              </div>
                            </div>

                            <div class="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onclick="ZGestorReports.imprimirProtocoloOfficeBoy('${prot.id}')"
                                class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer">
                                <i data-lucide="printer" class="w-3.5 h-3.5"></i>
                                <span>Reimprimir Folha</span>
                              </button>
                              ${!arquivado ? `
                                <button
                                  type="button"
                                  onclick="ZGestorApp.arquivarProtocoloAssinado('${prot.id}')"
                                  class="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer">
                                  <i data-lucide="folder-check" class="w-3.5 h-3.5"></i>
                                  <span>Arquivar Assinado</span>
                                </button>
                              ` : ''}
                              <button
                                type="button"
                                onclick="ZGestorApp.openModalExcluirProtocolo('${prot.id}')"
                                class="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition cursor-pointer"
                                title="Excluir Protocolo (com confirmação)">
                                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                              </button>
                            </div>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  `}
                </div>

                <!-- SEÇÃO SEPARADA: GUIAS JÁ ASSINADAS E ARQUIVADAS -->
                ${listaGuiasArquivadas.length > 0 ? `
                  <div class="bg-white rounded-2xl border border-teal-200 shadow-xs overflow-hidden">
                    <div class="p-4 bg-teal-50/70 border-b border-teal-200 flex items-center justify-between">
                      <div>
                        <h3 class="text-sm font-bold text-teal-950 flex items-center gap-2">
                          <i data-lucide="folder-check" class="w-4 h-4 text-teal-700"></i>
                          <span>Guias Assinadas e Arquivadas (${listaGuiasArquivadas.length})</span>
                        </h3>
                        <p class="text-[11px] text-teal-800/80">Guias já entregues e arquivadas separadamente da lista de pendências.</p>
                      </div>
                    </div>
                    <div class="divide-y divide-slate-100">
                      ${listaGuiasArquivadas.map(g => {
                        const emp = this.obterEmp(db, g.empresa_id, g);
                        const canalBadge = g.canal_envio && ['WhatsApp', 'E-mail'].includes(g.canal_envio)
                          ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${g.canal_envio === 'WhatsApp' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-indigo-100 text-indigo-900 border border-indigo-300'}">${g.canal_envio === 'WhatsApp' ? '💬 WhatsApp' : '✉️ E-mail'}</span>`
                          : '';
                        return `
                          <div class="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-slate-50">
                            <div class="flex items-center gap-2 flex-wrap">
                              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-900 border border-teal-300">✓ Arquivada</span>
                              ${canalBadge}
                              <span class="font-bold text-slate-900">${this.escapeHtml(this.nomeEmp(emp, { comCodigo: true, fallbackObj: g }))}</span>
                              <span class="text-slate-600">• ${this.escapeHtml(g.tipo_guia || '')}</span>
                              <span class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-mono">Comp. ${g.competencia}</span>
                            </div>
                            <div class="flex items-center gap-3 text-[11px] text-slate-500 shrink-0 flex-wrap">
                              ${g.data_envio ? `<span>Envio: <strong>${this.formatDate(g.data_envio)}</strong>${(g.enviado_por || g.responsavel_nome) ? ` (${this.escapeHtml(g.enviado_por || g.responsavel_nome)})` : ''}</span>` : ''}
                              <span>Venc: <strong>${this.formatDate(g.data_vencimento)}</strong></span>
                              ${g.protocolo_codigo ? `<span class="font-mono font-bold text-teal-700">${g.protocolo_codigo}</span>` : ''}
                              <button onclick="ZGestorApp.excluirGuiaImposto('${g.id}')" class="p-1 rounded text-slate-400 hover:text-rose-600 cursor-pointer" title="Excluir Guia"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                            </div>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  </div>
                ` : ''}
              </div>
            `;
          })()}
        `}
      </div>
    `;
  },

  // ===========================================================================
  // 3. ABA ESPECIAL: CONTROLE DE GUIAS DE PARCELAMENTOS ATIVOS
  //    - RETIRADA A OPÇÃO DE CONFIRMAÇÃO DE PAGAMENTO (SOMENTE EMITIDA E ENVIADA)
  //    - CAMPO <SELECT> PARA SELECIONAR O STATUS DO PARCELAMENTO:
  //      ATIVO, ATIVO EM ATRASO, ENCERRADO POR FALTA DE PAGAMENTO, ENCERRADO POR OPÇÃO
  // ===========================================================================
  renderParcelamentos(appState) {
    const db = window.zgestorDB;
    const comp = appState.competencia;
    const sub = db.obterMesSubsequente(comp);
    const subTab = appState.subTabParcelamentos || 'guias'; // 'guias' | 'cadastros'

    db.sincronizarPendenciasParcelamento(comp);

    const parcelamentos = db.data.parcelamentos || [];
    const guiasMes = (db.data.parcelamento_guias || []).filter(g => g.competencia === comp);
    const guiasComPendenciaAnterior = guiasMes.filter(g => Number(g.parcelas_anteriores_abertas || 0) > 0);
    const fBuscaParc = (appState.filtroParcelamentoBusca || '').trim().toLowerCase();
    const fStatusParc = appState.filtroParcelamentoStatus || 'TODOS';

    const qtdAtivosEmDia = parcelamentos.filter(p => p.status === 'ATIVO').length;
    const qtdEmAtraso = parcelamentos.filter(p => p.status === 'EM_ATRASO').length;
    const qtdGuiasEnviadas = guiasMes.filter(g => g.status_guia === 'ENVIADA_CLIENTE' || g.status_guia === 'EMITIDA').length;
    const totalPrevistoMes = guiasMes.reduce((acc, g) => acc + Number(g.valor_guia || 0), 0);

    const matchBuscaParc = (nome, doc, orgao, mod) => {
      if (!fBuscaParc) return true;
      return `${nome} ${doc} ${orgao} ${mod}`.toLowerCase().includes(fBuscaParc);
    };
    const matchStatusParc = (parc, guia = null) => {
      if (fStatusParc === 'TODOS') return true;
      if (fStatusParc === 'PENDENTES_EMISSAO') {
        if (guia) return !guia.status_guia || guia.status_guia === 'PENDENTE_EMISSAO';
        const gParc = parc ? guiasMes.find(gm => gm.parcelamento_id === parc.id) : null;
        return !gParc || !gParc.status_guia || gParc.status_guia === 'PENDENTE_EMISSAO';
      }
      if (fStatusParc === 'EMITIDAS') {
        if (guia) return guia.status_guia === 'EMITIDA';
        const gParc = parc ? guiasMes.find(gm => gm.parcelamento_id === parc.id) : null;
        return Boolean(gParc && gParc.status_guia === 'EMITIDA');
      }
      if (fStatusParc === 'ENVIADAS') {
        if (guia) return guia.status_guia === 'ENVIADA_CLIENTE';
        const gParc = parc ? guiasMes.find(gm => gm.parcelamento_id === parc.id) : null;
        return Boolean(gParc && gParc.status_guia === 'ENVIADA_CLIENTE');
      }
      if (fStatusParc === 'ATIVOS') return parc && (parc.status === 'ATIVO' || parc.status === 'EM_ATRASO');
      if (fStatusParc === 'EM_ATRASO') return parc && parc.status === 'EM_ATRASO';
      if (fStatusParc === 'ENCERRADOS') return parc && (parc.status === 'ENCERRADO_FALTA_PAGAMENTO' || parc.status === 'ENCERRADO_OPCAO');
      return true;
    };

    const guiasMesFiltradas = guiasMes.filter(g => {
      const emp = g.empresa_id ? db.data.empresas.find(e => e.id === g.empresa_id) : null;
      const parc = parcelamentos.find(p => p.id === g.parcelamento_id);
      const nome = emp ? emp.nome_fantasia : (parc?.nome_cliente || g.nome_cliente || '');
      const doc = emp ? emp.cnpj : (parc?.documento || g.documento || '');
      return matchStatusParc(parc, g) && matchBuscaParc(nome, doc, parc?.orgao || '', parc?.modalidade || '');
    });

    const parcelamentosFiltrados = parcelamentos.filter(p => {
      const emp = p.empresa_id ? db.data.empresas.find(e => e.id === p.empresa_id) : null;
      const nome = emp ? emp.nome_fantasia : (p.nome_cliente || '');
      const doc = emp ? emp.cnpj : (p.documento || '');
      return matchStatusParc(p) && matchBuscaParc(nome, doc, p.orgao || '', p.modalidade || '');
    });

    const statusGuiaBadge = (st) => {
      if (st === 'ENVIADA_CLIENTE') {
        return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <i data-lucide="send" class="w-3 h-3"></i> 2. Enviada ao Cliente
        </span>`;
      }
      if (st === 'EMITIDA') {
        return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
          <i data-lucide="file-check" class="w-3 h-3"></i> 1. Guia Emitida (Enviar)
        </span>`;
      }
      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
        <i data-lucide="clock" class="w-3 h-3"></i> Pendente de Emissão
      </span>`;
    };

    const renderSelectStatusParcelamento = (parc) => {
      if (!parc) return '—';
      const stInfo = this.statusParcelamentoLabel(parc.status);
      return `
        <select
          onchange="ZGestorApp.alterarStatusParcelamentoRapido('${parc.id}', this.value)"
          class="w-full rounded-xl border px-2 py-1.5 text-[11px] font-bold cursor-pointer focus:outline-none ${stInfo.cls}">
          <option value="ATIVO" ${parc.status === 'ATIVO' ? 'selected' : ''}>🟢 Ativo (Em Dia)</option>
          <option value="EM_ATRASO" ${parc.status === 'EM_ATRASO' ? 'selected' : ''}>🔴 Ativo em Atraso</option>
          <option value="ENCERRADO_FALTA_PAGAMENTO" ${parc.status === 'ENCERRADO_FALTA_PAGAMENTO' ? 'selected' : ''}>⚠️ Encerrado p/ Falta de Pagamento</option>
          <option value="ENCERRADO_OPCAO" ${parc.status === 'ENCERRADO_OPCAO' ? 'selected' : ''}>⚪ Encerrado p/ Opção / Quitação</option>
        </select>
      `;
    };

    return `
      <div class="space-y-4">
        <!-- Cabeçalho -->
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <div class="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-600 mb-0.5">
              <i data-lucide="layers" class="w-4 h-4"></i> Parcelamentos Tributários e Previdenciários
            </div>
            <h1 class="text-lg font-bold text-slate-900">Controle de Parcelamentos — Comp. ${comp}</h1>
            <p class="text-xs text-slate-500">
              Acordos marcados como <strong>Ativo</strong> ou <strong>Ativo em Atraso</strong> entram automaticamente na aba de Protocolos de Guias.
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button onclick="ZGestorReports.emitirRelatorioAba('parcelamentos', ZGestorApp.state)" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm">
              <i data-lucide="printer" class="w-3.5 h-3.5"></i> Relatório
            </button>
            <button onclick="ZGestorApp.gerarGuiasParcelamentoMes()" class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs flex items-center gap-1.5">
              <i data-lucide="refresh-cw" class="w-3.5 h-3.5 text-indigo-600"></i> Sincronizar Guias (${comp})
            </button>
            <button onclick="ZGestorApp.openModalParcelamento()" class="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm">
              <i data-lucide="plus" class="w-3.5 h-3.5"></i> Novo Parcelamento
            </button>
          </div>
        </div>

        <!-- 4 KPIs Modernos de Parcelamentos -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="bg-white p-3.5 rounded-2xl border border-emerald-200 shadow-2xs">
            <div class="text-[11px] font-bold text-emerald-700 uppercase">Ativos (Em Dia)</div>
            <div class="text-2xl font-black text-emerald-600 mt-1">${qtdAtivosEmDia}</div>
            <div class="text-[10px] text-slate-500">Geram guia no protocolo</div>
          </div>
          <div class="bg-white p-3.5 rounded-2xl border border-rose-200 shadow-2xs">
            <div class="text-[11px] font-bold text-rose-700 uppercase">Ativos em Atraso</div>
            <div class="text-2xl font-black text-rose-600 mt-1">${qtdEmAtraso}</div>
            <div class="text-[10px] text-slate-500">Exigem atenção e protocolo</div>
          </div>
          <div class="bg-white p-3.5 rounded-2xl border border-indigo-200 shadow-2xs">
            <div class="text-[11px] font-bold text-indigo-700 uppercase">Emitidas / Enviadas</div>
            <div class="text-2xl font-black text-indigo-600 mt-1">${qtdGuiasEnviadas}/${guiasMes.length}</div>
            <div class="text-[10px] text-slate-500">Guias na competência ${comp}</div>
          </div>
          <div class="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <div class="text-[11px] font-bold text-slate-500 uppercase">Total Previsto (${comp})</div>
            <div class="text-xl sm:text-2xl font-black text-slate-900 mt-1">${this.formatCurrency(totalPrevistoMes)}</div>
            <div class="text-[10px] text-slate-500">Soma das parcelas do mês</div>
          </div>
        </div>

        <!-- Navegação de Sub-Abas + Busca/Filtro -->
        <div class="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          <div class="flex flex-wrap items-center gap-2">
            <button
              onclick="ZGestorApp.setFiltro('subTabParcelamentos', 'guias')"
              class="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${subTab === 'guias' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}">
              <i data-lucide="calendar-check" class="w-4 h-4"></i>
              <span>Guias do Mês (${guiasMes.length})</span>
              ${guiasComPendenciaAnterior.length > 0 ? `<span class="px-2 py-0.5 rounded-full text-[10px] bg-rose-500 text-white">${guiasComPendenciaAnterior.length}</span>` : ''}
            </button>
            <button
              onclick="ZGestorApp.setFiltro('subTabParcelamentos', 'cadastros')"
              class="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${subTab === 'cadastros' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}">
              <i data-lucide="folder-kanban" class="w-4 h-4"></i>
              <span>Acordos Cadastrados (${parcelamentos.length})</span>
            </button>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <input
              type="text"
              id="input-filtro-parcelamento-busca"
              value="${this.escapeHtml(appState.filtroParcelamentoBusca || '')}"
              oninput="ZGestorApp.setFiltro('filtroParcelamentoBusca', this.value)"
              placeholder="Buscar empresa, órgão ou modalidade..."
              class="w-full sm:w-56 rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
            />
            <select
              onchange="ZGestorApp.setFiltro('filtroParcelamentoStatus', this.value)"
              class="rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white">
              <option value="TODOS" ${fStatusParc === 'TODOS' ? 'selected' : ''}>Todos os Status</option>
              <option value="PENDENTES_EMISSAO" ${fStatusParc === 'PENDENTES_EMISSAO' ? 'selected' : ''}>⏳ Pendentes de Emissão</option>
              <option value="EMITIDAS" ${fStatusParc === 'EMITIDAS' ? 'selected' : ''}>📄 1. Guia Emitida</option>
              <option value="ENVIADAS" ${fStatusParc === 'ENVIADAS' ? 'selected' : ''}>✅ 2. Enviada ao Cliente</option>
              <option value="ATIVOS" ${fStatusParc === 'ATIVOS' ? 'selected' : ''}>🟢 Somente Ativos (No Protocolo)</option>
              <option value="EM_ATRASO" ${fStatusParc === 'EM_ATRASO' ? 'selected' : ''}>🔴 Somente Em Atraso</option>
              <option value="ENCERRADOS" ${fStatusParc === 'ENCERRADOS' ? 'selected' : ''}>⚪ Encerrados / Quitados</option>
            </select>
          </div>
        </div>

        ${subTab === 'guias' ? `
          <!-- ABA 1: CONTROLE MENSAL DE EMISSÃO E ENVIO DAS GUIAS + STATUS DO PARCELAMENTO -->
          ${guiasComPendenciaAnterior.length > 0 ? `
            <div class="bg-rose-50 border border-rose-300 rounded-2xl p-3.5 flex items-start gap-3">
              <div class="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                <i data-lucide="alert-octagon" class="w-4 h-4"></i>
              </div>
              <div>
                <h3 class="text-xs font-extrabold text-rose-900">Alerta de Competência Anterior / Parcelamento em Atraso</h3>
                <p class="text-xs text-rose-800">
                  O sistema transportou automaticamente <strong>${guiasComPendenciaAnterior.length} alerta(s)</strong> de parcelamento em atraso ou guia pendente da competência anterior para a competência <strong>${comp}</strong>.
                </p>
              </div>
            </div>
          ` : ''}

          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 class="text-sm font-bold text-slate-900">Controle de Emissão e Envio de Guias de Parcelamentos — Competência ${comp}</h2>
                <p class="text-xs text-slate-500">Marque as guias como <strong>1. Emitida</strong> ou <strong>2. Enviada</strong> e selecione diretamente o <strong>Status do Parcelamento</strong>.</p>
              </div>
              <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">${guiasMes.length} guia(s)</span>
            </div>

            <div class="overflow-x-auto w-full">
              <table class="w-full min-w-[780px] text-left border-collapse">
              <thead>
                <tr class="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500 bg-white">
                  <th class="py-3 px-3 w-[18%]">Cliente</th>
                  <th class="py-3 px-2.5 w-[18%]">Órgão & Modalidade</th>
                  <th class="py-3 px-2.5 w-[18%]">Histórico / Comp. Anterior</th>
                  <th class="py-3 px-2.5 w-[11%]">Venc. & Valor</th>
                  <th class="py-3 px-2.5 w-[18%]">Status do Parcelamento</th>
                  <th class="py-3 px-3 w-[17%] text-right">Guia (Emitida / Enviada)</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-xs">
                ${guiasMesFiltradas.map(g => {
      const emp = g.empresa_id ? this.obterEmp(db, g.empresa_id, g) : null;
      const parc = db.data.parcelamentos.find(p => p.id === g.parcelamento_id);
      const isAvulso = Boolean((parc && parc.cliente_avulso) || g.cliente_avulso);
      const nomeCliente = isAvulso ? ((parc && parc.nome_cliente) || g.nome_cliente || 'Cliente Avulso') : this.nomeEmp(emp, { comCodigo: true, fallbackObj: parc || g });
      const docCliente = isAvulso ? ((parc && parc.documento) || g.documento || '') : (emp ? emp.cnpj : '');
      const temPendenciaAnt = Number(g.parcelas_anteriores_abertas || 0) > 0;
      const emAlerta = (parc && (parc.status === 'EM_ATRASO' || parc.status === 'ENCERRADO_FALTA_PAGAMENTO')) || temPendenciaAnt;
      return `
                    <tr class="hover:bg-slate-50 ${emAlerta ? 'bg-rose-50/30' : ''}">
                      <td class="py-3 px-3">
                        <div class="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>${nomeCliente}</span>
                          ${isAvulso ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200">Avulso</span>` : ''}
                        </div>
                        <div class="text-[11px] text-slate-500 font-mono">${docCliente}</div>
                      </td>
                      <td class="py-3 px-2.5">
                        <div class="font-bold text-slate-800">${parc ? parc.orgao : '—'}</div>
                        <div class="text-[11px] text-slate-500">${parc ? parc.modalidade : ''}</div>
                      </td>
                      <td class="py-3 px-2.5">
                        ${temPendenciaAnt ? `
                          <div class="p-1.5 rounded-lg bg-rose-100 border border-rose-300 text-rose-900 text-[11px] font-bold">
                            ⚠️ ${g.detalhe_pendencia_anterior}
                          </div>
                        ` : `
                          <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                            <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i> Sem pendência anterior
                          </span>
                        `}
                      </td>
                      <td class="py-3 px-2.5">
                        <div class="font-semibold text-slate-800">${this.formatDate(g.data_vencimento)}</div>
                        <div class="font-extrabold text-slate-900 mt-0.5">${this.formatCurrency(g.valor_guia)}</div>
                      </td>
                      <td class="py-3 px-2.5">
                        ${renderSelectStatusParcelamento(parc)}
                      </td>
                      <td class="py-3 px-3 text-right">
                        <div class="flex flex-col items-end gap-1.5">
                          ${statusGuiaBadge(g.status_guia)}
                          <div class="inline-flex flex-wrap items-center justify-end gap-1">
                            <button
                              onclick="ZGestorApp.avancarGuiaParcelamento('${g.id}', 'EMITIDA')"
                              class="px-2 py-1 rounded-lg text-[11px] font-bold transition ${g.status_guia === 'EMITIDA' ? 'bg-amber-600 text-white' : 'bg-amber-100 hover:bg-amber-200 text-amber-900'}">
                              1. Emitida
                            </button>
                            <button
                              onclick="ZGestorApp.avancarGuiaParcelamento('${g.id}', 'ENVIADA_CLIENTE')"
                              class="px-2 py-1 rounded-lg text-[11px] font-bold transition ${g.status_guia === 'ENVIADA_CLIENTE' ? 'bg-emerald-600 text-white' : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900'}">
                              2. Enviada
                            </button>
                            ${parc ? `
                              <button onclick="ZGestorApp.openModalParcelamento('${parc.id}')" class="p-1 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100" title="Editar Cadastro deste Parcelamento">
                                <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                              </button>
                            ` : ''}
                          </div>
                          ${g.data_envio_cliente ? `<div class="text-[10px] text-emerald-700 font-semibold">Enviada em ${this.formatDate(g.data_envio_cliente)}</div>` : ''}
                        </div>
                      </td>
                    </tr>
                  `;
    }).join('') || `
                  <tr>
                    <td colspan="6" class="py-8 text-center text-slate-400">
                      Nenhuma guia gerada para a competência ${comp}. Clique em "Gerar / Sincronizar Guias (${comp})" acima.
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
            </div>
          </div>
        ` : `
          <!-- ABA 2: CADASTROS DE PARCELAMENTOS (VERIFICAR E EDITAR PRÉ-CADASTRADOS COM 2ª CONFIRMAÇÃO) -->
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="p-3.5 bg-amber-50/70 border-b border-amber-200 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 class="text-sm font-bold text-slate-900">Cadastros de Parcelamentos (Acordos Pré-Cadastrados e Novos)</h2>
                <p class="text-xs text-slate-600">
                  Altere o status diretamente na lista ou clique em <strong>Editar Cadastro</strong> (com 2ª confirmação de segurança).
                </p>
              </div>
              <button onclick="ZGestorApp.openModalParcelamento()" class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm">
                <i data-lucide="plus" class="w-3.5 h-3.5"></i> + Cadastrar Novo Parcelamento
              </button>
            </div>

            <div class="overflow-x-auto w-full">
              <table class="w-full min-w-[750px] text-left border-collapse">
              <thead>
                <tr class="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                  <th class="py-3 px-3 w-[22%]">Empresa Cliente</th>
                  <th class="py-3 px-2.5 w-[28%]">Órgão, Modalidade & Processo</th>
                  <th class="py-3 px-2.5 w-[20%]">Consolidado & Guia</th>
                  <th class="py-3 px-2.5 w-[18%]">Status do Parcelamento</th>
                  <th class="py-3 px-3 w-[12%] text-right">Ações</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-xs">
                ${parcelamentosFiltrados.map(p => {
      const isAvulso = Boolean(p.cliente_avulso || !p.empresa_id);
      const emp = !isAvulso ? this.obterEmp(db, p.empresa_id, p) : null;
      const nomeCliente = isAvulso ? (p.nome_cliente || 'Cliente Avulso') : this.nomeEmp(emp, { comCodigo: true, fallbackObj: p });
      const docCliente = isAvulso ? (p.documento || '') : (emp ? emp.cnpj : '');
      return `
                    <tr class="hover:bg-slate-50">
                      <td class="py-3.5 px-3">
                        <div class="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>${nomeCliente}</span>
                          ${isAvulso ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200">Avulso</span>` : ''}
                        </div>
                        <div class="text-[11px] text-slate-500 font-mono">${docCliente}</div>
                      </td>
                      <td class="py-3.5 px-2.5">
                        <div class="font-bold text-slate-900">${p.orgao}</div>
                        <div class="text-[11px] text-slate-600">${p.modalidade} • Proc: <span class="font-mono">${p.numero_processo || '—'}</span></div>
                        ${p.observacoes ? `<div class="text-[11px] text-slate-500 mt-0.5 italic">${p.observacoes}</div>` : ''}
                      </td>
                      <td class="py-3.5 px-2.5">
                        <div class="text-[11px] text-slate-500">Total: <strong class="text-slate-800">${this.formatCurrency(p.valor_consolidado)}</strong></div>
                        <div class="font-bold text-indigo-700 mt-0.5">Guia: ${this.formatCurrency(p.valor_parcela_estimado)} (Dia ${p.dia_vencimento})</div>
                      </td>
                      <td class="py-3.5 px-2.5">
                        ${renderSelectStatusParcelamento(p)}
                      </td>
                      <td class="py-3.5 px-3 text-right">
                        <div class="inline-flex items-center gap-1">
                          <button onclick="ZGestorApp.openModalParcelamento('${p.id}')" class="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold inline-flex items-center gap-1 shadow-xs">
                            <i data-lucide="pencil" class="w-3 h-3"></i> Editar
                          </button>
                          <button onclick="ZGestorApp.excluirCadastroParcelamento('${p.id}')" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Excluir Parcelamento">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
    }).join('')}
              </tbody>
            </table>
            </div>
          </div>
        `}
      </div>
    `;
  },

  // ===========================================================================
  // 4. NOVA ABA: CONTROLE DE CNDs (CERTIDÕES NEGATIVAS DE DÉBITOS)
  // ===========================================================================
  renderCNDs(appState) {
    const db = window.zgestorDB;
    const fCliente = appState.filtroCNDCliente || 'TODOS';
    const fOrgao = appState.filtroCNDOrgao || 'TODOS';
    const fStatus = appState.filtroCNDStatus || 'TODOS';

    const todasCNDs = db.getCNDs();
    let lista = [...todasCNDs];

    if (fCliente !== 'TODOS') lista = lista.filter(c => c.empresa_id === fCliente);
    if (fOrgao !== 'TODOS') lista = lista.filter(c => c.orgao === fOrgao);
    if (fStatus !== 'TODOS') {
      lista = lista.filter(c => {
        const st = db.calcularStatusValidadeCND(c);
        if (fStatus === 'VIGENTES') return st.codigo === 'VIGENTE';
        if (fStatus === 'VENCENDO') return st.codigo === 'VENCENDO';
        if (fStatus === 'VENCIDAS_PENDENTES') return st.codigo === 'VENCIDA' || st.codigo === 'PENDENCIA';
        return true;
      });
    }

    // Ordena deixando as vencidas/com pendência e vencendo no topo
    lista.sort((a, b) => (a.data_vencimento || '').localeCompare(b.data_vencimento || ''));

    const totalVigentes = todasCNDs.filter(c => db.calcularStatusValidadeCND(c).codigo === 'VIGENTE').length;
    const totalVencendo = todasCNDs.filter(c => db.calcularStatusValidadeCND(c).codigo === 'VENCENDO').length;
    const totalCriticas = todasCNDs.filter(c => {
      const cod = db.calcularStatusValidadeCND(c).codigo;
      return cod === 'VENCIDA' || cod === 'PENDENCIA';
    }).length;

    const badgeValidadeCND = (cnd) => {
      const info = db.calcularStatusValidadeCND(cnd);
      const map = {
        VIGENTE: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        VENCENDO: 'bg-amber-100 text-amber-900 border-amber-300',
        VENCIDA: 'bg-rose-100 text-rose-800 border-rose-300',
        PENDENCIA: 'bg-rose-100 text-rose-900 border-rose-400',
        SEM_DATA: cnd.situacao === 'PENDENTE' ? 'bg-amber-50 text-amber-800 border-amber-300' : 'bg-slate-100 text-slate-600 border-slate-300'
      };
      return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${map[info.codigo] || map.SEM_DATA}">${info.label}</span>`;
    };

    return `
      <div class="space-y-4">
        <!-- Cabeçalho -->
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <div class="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-600 mb-0.5">
              <i data-lucide="file-badge" class="w-4 h-4"></i> Monitoramento de Regularidade Fiscal e Trabalhista
            </div>
            <h1 class="text-lg font-bold text-slate-900">Controle de CNDs (Certidões Negativas de Débitos)</h1>
            <p class="text-xs text-slate-500">
              Acompanhe a validade das certidões Federal (RFB/PGFN), Estadual (ICMS), Municipal (ISS), FGTS (CRF) e Trabalhista (CNDT) dos clientes.
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button onclick="ZGestorReports.emitirRelatorioAba('cnds', ZGestorApp.state)" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm">
              <i data-lucide="printer" class="w-3.5 h-3.5"></i> Relatório de CNDs
            </button>
            <button onclick="ZGestorApp.sincronizarTodasCNDsAPI()" class="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm" title="Consultar e sincronizar todas as certidões via API Integra Contador">
              <i data-lucide="cpu" class="w-3.5 h-3.5"></i> Sincronizar API Integra Contador
            </button>
            <button onclick="ZGestorApp.gerarGradeCNDs()" class="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-semibold text-xs flex items-center gap-1.5">
              <i data-lucide="sparkles" class="w-3.5 h-3.5 text-teal-600"></i> Gerar Grade Padrão p/ Empresas
            </button>
            <button onclick="ZGestorApp.openModalCND()" class="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm">
              <i data-lucide="plus" class="w-3.5 h-3.5"></i> + Cadastrar / Renovar CND
            </button>
          </div>
        </div>

        <!-- KPIs de CNDs -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span class="text-[11px] font-bold uppercase text-slate-500">Total Monitoradas</span>
            <div class="text-2xl font-extrabold text-slate-900 mt-1">${todasCNDs.length}</div>
            <span class="text-[11px] text-slate-500">Certidões cadastradas</span>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm">
            <span class="text-[11px] font-bold uppercase text-emerald-700">Vigentes / Regulares</span>
            <div class="text-2xl font-extrabold text-emerald-600 mt-1">${totalVigentes}</div>
            <span class="text-[11px] text-slate-500">Apta p/ licitações e bancos</span>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm">
            <span class="text-[11px] font-bold uppercase text-amber-700">Vencendo em até 15 dias</span>
            <div class="text-2xl font-extrabold text-amber-600 mt-1">${totalVencendo}</div>
            <span class="text-[11px] text-slate-500">Programar renovação</span>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-rose-200 shadow-sm">
            <span class="text-[11px] font-bold uppercase text-rose-700">Vencidas ou c/ Pendência</span>
            <div class="text-2xl font-extrabold text-rose-600 mt-1">${totalCriticas}</div>
            <span class="text-[11px] text-slate-500">Exige regularização imediata</span>
          </div>
        </div>

        <!-- Filtros -->
        <div class="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label class="block text-[10px] font-bold uppercase text-slate-500 mb-1">Filtrar por Empresa Cliente</label>
            ${this.renderSeletorEmpresaBusca({
              uid: 'cnd-filtro-emp',
              inputId: 'f-cnd-filtro-emp',
              selectedId: fCliente,
              placeholder: 'Todas as Empresas (digite cód., razão ou CNPJ)...',
              onChangeFn: "ZGestorApp.setFiltro('filtroCNDCliente', val)",
              allowAllOption: true,
              allOptionValue: 'TODOS',
              allOptionLabel: 'Todas as Empresas'
            })}
          </div>
          <div>
            <label class="block text-[10px] font-bold uppercase text-slate-500 mb-1">Órgão / Tipo de Certidão</label>
            <select onchange="ZGestorApp.setFiltro('filtroCNDOrgao', this.value)" class="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-800">
              <option value="TODOS" ${fOrgao === 'TODOS' ? 'selected' : ''}>Todas as Certidões</option>
              ${(window.ZGESTOR_MODELS.tiposCND || []).map(tc => {
      const nome = typeof tc === 'string' ? tc : tc.nome;
      return `<option value="${nome}" ${fOrgao === nome ? 'selected' : ''}>${nome}</option>`;
    }).join('')}
            </select>
          </div>
          <div>
            <label class="block text-[10px] font-bold uppercase text-slate-500 mb-1">Situação de Validade</label>
            <select onchange="ZGestorApp.setFiltro('filtroCNDStatus', this.value)" class="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-800">
              <option value="TODOS" ${fStatus === 'TODOS' ? 'selected' : ''}>Todas as Situações</option>
              <option value="VIGENTES" ${fStatus === 'VIGENTES' ? 'selected' : ''}>Somente Vigentes (Em Dia)</option>
              <option value="VENCENDO" ${fStatus === 'VENCENDO' ? 'selected' : ''}>Vencendo nos Próximos 15 Dias</option>
              <option value="VENCIDAS_PENDENTES" ${fStatus === 'VENCIDAS_PENDENTES' ? 'selected' : ''}>Vencidas ou Positivas c/ Pendência</option>
            </select>
          </div>
        </div>

        <!-- Tabela de CNDs (Estruturada por Esferas e Preparada para API) -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="overflow-x-auto w-full">
            <table class="w-full min-w-[780px] text-left border-collapse">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                <th class="py-3 px-3 w-[20%]">Empresa Cliente</th>
                <th class="py-3 px-2.5 w-[22%]">Certidão / Esfera Fiscal</th>
                <th class="py-3 px-2.5 w-[18%]">Resultado & Nº Controle</th>
                <th class="py-3 px-2.5 w-[14%]">Emissão & Validade</th>
                <th class="py-3 px-2.5 w-[14%]">Status de Vigência</th>
                <th class="py-3 px-3 w-[12%] text-right">Ações</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-xs">
              ${lista.map(c => {
      const emp = db.data.empresas.find(e => e.id === c.empresa_id);
      const stInfo = db.calcularStatusValidadeCND(c);
      const isCritica = stInfo.codigo === 'VENCIDA' || stInfo.codigo === 'PENDENCIA';
      const esfera = c.esfera || (
        (c.orgao || '').includes('Federal') || (c.orgao || '').includes('PGFN') ? 'FEDERAL' :
          (c.orgao || '').includes('FGTS') || (c.orgao || '').includes('CRF') ? 'FGTS' :
            (c.orgao || '').includes('Trabalhista') || (c.orgao || '').includes('CNDT') ? 'TRABALHISTA' :
              (c.orgao || '').includes('Estadual') || (c.orgao || '').includes('SEFAZ') ? 'ESTADUAL' :
                (c.orgao || '').includes('Municipal') || (c.orgao || '').includes('Prefeitura') ? 'MUNICIPAL' : 'FEDERAL'
      );
      return `
                  <tr
                    data-cnd-id="${c.id}"
                    data-cnd-esfera="${esfera}"
                    data-cnd-status="${stInfo.codigo}"
                    data-cnd-vencimento="${c.data_vencimento || ''}"
                    data-cnd-cnpj="${emp ? emp.cnpj : ''}"
                    data-api-ready="true"
                    class="hover:bg-slate-50 ${isCritica ? 'bg-rose-50/30' : ''}">
                    <td class="py-3 px-3">
                      <div class="font-bold text-slate-900">${this.escapeHtml(this.nomeEmp(emp, { comCodigo: true, fallbackObj: c }))}</div>
                      <div class="text-[11px] text-slate-500 font-mono">${emp ? `${emp.cnpj}` : ''}</div>
                    </td>
                    <td class="py-3 px-2.5">
                      <div class="font-bold text-slate-900">${c.orgao}</div>
                      <div class="flex items-center gap-1.5 mt-0.5">
                        <span class="text-[9.5px] px-1.5 py-0.2 rounded font-extrabold uppercase bg-slate-100 text-slate-700 border border-slate-200">${esfera}</span>
                        ${c.observacoes ? `<span class="text-[11px] text-slate-500 truncate max-w-[180px]">${c.observacoes}</span>` : ''}
                      </div>
                    </td>
                    <td class="py-3 px-2.5">
                      <span class="px-2 py-0.5 rounded text-[11px] font-bold ${c.situacao === 'NEGATIVA' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
          c.situacao === 'POSITIVA_EFEITO_NEGATIVA' ? 'bg-sky-50 text-sky-800 border border-sky-200' :
            c.situacao === 'PENDENTE' ? 'bg-amber-50 text-amber-800 border border-amber-300' :
              'bg-rose-100 text-rose-800 border border-rose-300'
        }">
                        ${c.situacao === 'NEGATIVA' ? 'Negativa' : c.situacao === 'POSITIVA_EFEITO_NEGATIVA' ? 'Positiva c/ Efeito Negativa' : c.situacao === 'PENDENTE' ? 'Pendente de Emissão' : 'Positiva / Com Pendência'}
                      </span>
                      <div class="text-[11px] font-mono text-slate-500 mt-1">Cód: ${c.numero_controle || '—'}</div>
                    </td>
                    <td class="py-3 px-2.5">
                      ${(!c.data_emissao && !c.data_vencimento) ? `
                        <span class="text-[11px] text-amber-700 font-semibold italic">A definir ao anexar</span>
                      ` : `
                        <div class="text-[11px] text-slate-500">Emissão: ${this.formatDate(c.data_emissao)}</div>
                        <div class="font-bold text-slate-900 mt-0.5">Vence: ${this.formatDate(c.data_vencimento)}</div>
                      `}
                    </td>
                    <td class="py-3 px-2.5">
                      ${badgeValidadeCND(c)}
                      ${c.origem_emissao === 'API_INTEGRA_CONTADOR' ? `
                        <div class="text-[10px] text-teal-700 font-bold flex items-center gap-1 mt-1" title="Sincronizada via API do Integra Contador">
                          <i data-lucide="check-circle" class="w-3 h-3 text-teal-600"></i> API Integra Contador
                        </div>
                      ` : `
                        <div class="text-[10px] text-teal-700 font-semibold flex items-center gap-1 mt-1" title="Estrutura de campos preparada para sincronização via API">
                          <i data-lucide="cpu" class="w-3 h-3 text-teal-600"></i> API Ready
                        </div>
                      `}
                    </td>
                    <td class="py-3 px-3 text-right">
                      <div class="inline-flex items-center justify-end gap-1.5">
                        ${c.arquivo_pdf_nome ? `
                          <button onclick="ZGestorApp.visualizarOuBaixarPDFCND('${c.id}')" class="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold inline-flex items-center gap-1 border border-emerald-300 shadow-xs" title="Visualizar / Baixar Certidão em PDF (${c.arquivo_pdf_nome})">
                            <i data-lucide="file-text" class="w-3 h-3 text-emerald-600"></i> Ver PDF
                          </button>
                        ` : `
                          <button onclick="ZGestorApp.abrirModalAnexarPDFCND('${c.id}')" class="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 border border-slate-300" title="Anexar arquivo PDF da Certidão">
                            <i data-lucide="paperclip" class="w-3 h-3 text-slate-500"></i> Anexar PDF
                          </button>
                        `}
                        <button onclick="ZGestorApp.clicarRenovarCND('${c.id}')" class="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold inline-flex items-center gap-1 shadow-xs" title="Renovar via API Integra Contador ou Anexar Novo PDF">
                          <i data-lucide="refresh-cw" class="w-3 h-3"></i> Renovar
                        </button>
                        <button onclick="ZGestorApp.openModalCND('${c.id}')" class="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100" title="Editar dados da CND">
                          <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                        </button>
                        <button onclick="ZGestorApp.excluirCND('${c.id}')" class="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Excluir CND">
                          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
    }).join('') || `
                <tr>
                  <td colspan="6" class="py-8 text-center text-slate-400">
                    Nenhuma certidão encontrada para os filtros selecionados.
                  </td>
                </tr>
              `}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    `;
  },

  // ===========================================================================
  // 5. CENTRAL DO CLIENTE — PORTAL DIGITAL DO CLIENTE (ARQUIVOS DA EMPRESA,
  //    DOCUMENTOS CONSTITUTIVOS, ENVIO DE GUIAS E SOLICITAÇÕES P/ A CONTABILIDADE)
  // ===========================================================================
  renderCentralCliente(appState) {
    const db = window.zgestorDB;
    const comp = appState.competencia;
    const sub = db.obterMesSubsequente(comp);
    const user = db.getCurrentUser();
    const isCliente = user && user.cargo === 'CLIENTE';
    const canSeeHon = db.canAccessModule('honorarios', user);

    const empresas = db.data.empresas;
    const empSelId = (isCliente && user.empresa_id)
      ? user.empresa_id
      : (appState.empresaCentralId && empresas.some(e => e.id === appState.empresaCentralId)
        ? appState.empresaCentralId
        : (empresas[0] ? empresas[0].id : null));
    const emp = empresas.find(e => e.id === empSelId);

    if (!emp) {
      return `<div class="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-500">Nenhuma empresa cadastrada.</div>`;
    }

    const modoPortalCliente = isCliente || Boolean(appState.modoSimulacaoCliente);
    const subTabPortal = appState.subTabCentralCliente || 'arquivos_portal'; // 'arquivos_portal' | 'solicitacoes_portal' | 'visao_360'
    const fPasta = appState.filtroPastaPortal || 'TODAS';

    // Arquivos disponíveis no Portal da Empresa
    const pastasModelosRaw = (window.ZGESTOR_MODELS && window.ZGESTOR_MODELS.pastasPortalCliente) || [
      { id: 'CONSTITUTIVOS', label: '1. Documentos Constitutivos & Societários', nome: 'Documentos Constitutivos & Societários', icone: 'folder-key', cor: 'indigo', descricao: 'Contrato Social, Alterações, Cartão CNPJ, Inscrições e Alvarás' },
      { id: 'GUIAS_IMPOSTOS', label: '2. Guias de Impostos Mensais & Parcelamentos', nome: 'Guias de Impostos & Parcelamentos', icone: 'receipt', cor: 'emerald', descricao: 'Guias apuradas pela contabilidade para pagamento no mês' },
      { id: 'CONTABIL_BALANCETES', label: '3. Contábil — Balancetes e Demonstrações', nome: 'Balancetes e Demonstrações', icone: 'book-open-check', cor: 'blue', descricao: 'Demonstrações contábeis assinadas, relatórios de faturamento e IRPJ' },
      { id: 'PESSOAL_FOLHA', label: '4. Departamento Pessoal — Pró-Labore e Folha CLT', nome: 'Pró-Labore e Folha CLT', icone: 'users', cor: 'purple', descricao: 'Recibos de Pró-Labore, Holerites, Rescisões e Encargos' },
      { id: 'CERTIDOES_CND', label: '5. Certidões Negativas (CNDs)', nome: 'Certidões Negativas (CNDs)', icone: 'shield-check', cor: 'teal', descricao: 'Certidões Federal, Estadual, Municipal, FGTS e Trabalhista' }
    ];
    const pastasModelos = pastasModelosRaw.map(p => ({
      ...p,
      label: p.label || p.nome || p.id,
      nome: p.nome || p.label || p.id
    }));

    const todosArquivosEmp = db.getArquivosPortalCliente(emp.id, 'TODAS');
    const arquivosFiltrados = fPasta === 'TODAS'
      ? todosArquivosEmp
      : todosArquivosEmp.filter(a => a.pasta === fPasta);

    // Solicitações do Cliente para a Contabilidade
    const fCat = appState.filtroCentralCategoria || 'TODOS';
    let registros = db.getRegistrosCentralCliente(emp.id);
    if (fCat !== 'TODOS') registros = registros.filter(r => r.categoria === fCat);

    // Dados 360° da Empresa Selecionada
    const tarefasEmp = db.data.tarefas.filter(t => t.empresa_id === emp.id && t.competencia === comp);
    const tarefasConcluidas = tarefasEmp.filter(t => Boolean(t.data_entrega));
    const guiasImpEmp = db.getGuiasImpostos(comp).filter(g => g.empresa_id === emp.id);
    const guiasImpEnviadas = guiasImpEmp.filter(g => g.status_envio === 'ENVIADA_CLIENTE');
    const parcsEmp = db.data.parcelamentos.filter(p => p.empresa_id === emp.id);
    const cndsEmp = db.getCNDs(emp.id);
    const honEmp = db.data.honorarios.find(h => h.empresa_id === emp.id && h.competencia === comp);

    const pastaBadge = (pastaId) => {
      const map = {
        CONSTITUTIVOS: { label: 'Documentos Constitutivos', cls: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
        GUIAS_IMPOSTOS: { label: 'Guias de Impostos', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
        CONTABIL_BALANCETES: { label: 'Balancetes / Contábil', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
        PESSOAL_FOLHA: { label: 'Pró-Labore / Folha DP', cls: 'bg-purple-100 text-purple-800 border-purple-200' },
        CERTIDOES_CND: { label: 'Certidões (CNDs)', cls: 'bg-teal-100 text-teal-800 border-teal-200' }
      };
      const item = map[pastaId] || map.CONSTITUTIVOS;
      return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${item.cls}">${item.label}</span>`;
    };

    const statusSolicitacaoBadge = (st) => {
      if (st === 'CONCLUIDO') {
        return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          ✓ Atendida / Concluída
        </span>`;
      }
      if (st === 'EM_ANDAMENTO') {
        return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
          🔄 Em Andamento na Contabilidade
        </span>`;
      }
      return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
        ⏳ Aguardando Atendimento
      </span>`;
    };

    return `
      <div class="space-y-4">
        <!-- BARRA SUPERIOR DO PORTAL DO CLIENTE: SELETOR DE EMPRESA + MODO ESCRITÓRIO vs VISÃO DO CLIENTE -->
        <div class="${modoPortalCliente ? 'bg-gradient-to-r from-indigo-950 via-indigo-900 to-slate-900 text-white border-indigo-800' : 'bg-white text-slate-900 border-slate-200'} p-4 rounded-2xl border shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 transition">
          <div class="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
            <div>
              <div class="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${modoPortalCliente ? 'text-emerald-300' : 'text-indigo-600'}">
                <i data-lucide="globe" class="w-4 h-4"></i>
                ${modoPortalCliente ? 'AMBIENTE EXTERNO — VISÃO DO CLIENTE NO PORTAL' : 'CENTRAL & PORTAL DIGITAL DO CLIENTE'}
              </div>
              <h1 class="text-lg font-bold ${modoPortalCliente ? 'text-white' : 'text-slate-900'}">
                ${modoPortalCliente ? `Portal Digital: ${emp.nome_fantasia} (${emp.cnpj})` : 'Portal de Arquivos da Empresa, Envio de Guias e Solicitações'}
              </h1>
              <p class="text-xs ${modoPortalCliente ? 'text-indigo-200' : 'text-slate-500'}">
                Disponibilize <strong>Documentos Constitutivos</strong>, <strong>Guias de Impostos</strong>, <strong>Balancetes/CNDs</strong> e receba <strong>Solicitações do Cliente para a Contabilidade</strong>.
              </p>
            </div>

            <div class="sm:ml-3 flex-1 max-w-md">
              <label class="block text-[10px] font-bold uppercase ${modoPortalCliente ? 'text-indigo-200' : 'text-slate-500'} mb-0.5">Empresa Selecionada no Portal:</label>
              ${isCliente ? `
                <div class="w-full rounded-xl border border-emerald-400 bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-950 flex items-center justify-between shadow-2xs">
                  <div class="flex items-center gap-1.5 truncate">
                    <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span class="truncate">${this.escapeHtml(this.nomeEmp(emp, { comCodigo: true }))} (${emp.cnpj})</span>
                  </div>
                  <span class="text-[10px] bg-emerald-200/80 text-emerald-900 px-1.5 py-0.5 rounded font-black shrink-0">RLS Isolado</span>
                </div>
              ` : `
              ${this.renderSeletorEmpresaBusca({
                uid: 'central-emp',
                inputId: 'f-central-emp-sel',
                selectedId: emp.id,
                placeholder: 'Buscar empresa no Portal por código, razão ou CNPJ...',
                onChangeFn: 'ZGestorApp.selecionarEmpresaCentral(val)'
              })}
              `}
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            ${!isCliente ? `
              <button onclick="ZGestorApp.openModalArquivoPortal('${emp.id}')" class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm">
                <i data-lucide="upload-cloud" class="w-3.5 h-3.5"></i> + Enviar Arquivo / Guia ao Portal
              </button>
            ` : ''}
            <button onclick="ZGestorApp.openModalSolicitacaoPortal('${emp.id}')" class="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm">
              <i data-lucide="message-square-plus" class="w-3.5 h-3.5"></i> + Nova Solicitação p/ Contabilidade
            </button>
            ${!isCliente ? `
              <button onclick="ZGestorReports.emitirRelatorioAba('central_cliente', ZGestorApp.state)" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm">
                <i data-lucide="printer" class="w-3.5 h-3.5"></i> Extrato do Portal
              </button>
            ` : ''}
          </div>
        </div>

        <!-- RESUMO RÁPIDO DO PORTAL DO CLIENTE -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div onclick="ZGestorApp.setFiltro('subTabCentralCliente', 'arquivos_portal'); ZGestorApp.setFiltro('filtroPastaPortal', 'CONSTITUTIVOS')" class="cursor-pointer bg-white p-4 rounded-2xl border border-indigo-200 shadow-sm hover:shadow-md transition">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold uppercase text-indigo-700">Documentos Constitutivos</span>
              <div class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><i data-lucide="folder-key" class="w-4 h-4"></i></div>
            </div>
            <div class="text-2xl font-extrabold text-slate-900 mt-1.5">${todosArquivosEmp.filter(a => a.pasta === 'CONSTITUTIVOS').length} arq.</div>
            <div class="text-[11px] text-slate-500 mt-0.5">Contrato Social, CNPJ, Alvarás</div>
          </div>

          <div onclick="ZGestorApp.setFiltro('subTabCentralCliente', 'arquivos_portal'); ZGestorApp.setFiltro('filtroPastaPortal', 'GUIAS_IMPOSTOS')" class="cursor-pointer bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm hover:shadow-md transition">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold uppercase text-emerald-700">Guias Disponíveis no Portal</span>
              <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><i data-lucide="receipt" class="w-4 h-4"></i></div>
            </div>
            <div class="text-2xl font-extrabold text-emerald-600 mt-1.5">${todosArquivosEmp.filter(a => a.pasta === 'GUIAS_IMPOSTOS').length} guias</div>
            <div class="text-[11px] text-slate-500 mt-0.5">DAS, DAE ICMS, DARF, FGTS</div>
          </div>

          <div onclick="ZGestorApp.setFiltro('subTabCentralCliente', 'arquivos_portal'); ZGestorApp.setFiltro('filtroPastaPortal', 'CONTABIL_BALANCETES')" class="cursor-pointer bg-white p-4 rounded-2xl border border-blue-200 shadow-sm hover:shadow-md transition">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold uppercase text-blue-700">Balancetes, Folha & CNDs</span>
              <div class="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><i data-lucide="file-text" class="w-4 h-4"></i></div>
            </div>
            <div class="text-2xl font-extrabold text-blue-700 mt-1.5">${todosArquivosEmp.filter(a => a.pasta !== 'CONSTITUTIVOS' && a.pasta !== 'GUIAS_IMPOSTOS').length} docs</div>
            <div class="text-[11px] text-slate-500 mt-0.5">Balancetes, Pró-Labore e Certidões</div>
          </div>

          <div onclick="ZGestorApp.setFiltro('subTabCentralCliente', 'solicitacoes_portal')" class="cursor-pointer bg-white p-4 rounded-2xl border border-amber-200 shadow-sm hover:shadow-md transition">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold uppercase text-amber-800">Solicitações p/ Contabilidade</span>
              <div class="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><i data-lucide="inbox" class="w-4 h-4"></i></div>
            </div>
            <div class="text-2xl font-extrabold text-amber-600 mt-1.5">${registros.length} chamados</div>
            <div class="text-[11px] text-slate-500 mt-0.5">${registros.filter(r => r.status !== 'CONCLUIDO').length} aguardando resposta</div>
          </div>
        </div>

        <!-- NAVEGAÇÃO DE SUB-ABAS DO PORTAL DO CLIENTE -->
        <div class="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <button
              onclick="ZGestorApp.setFiltro('subTabCentralCliente', 'arquivos_portal')"
              class="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${subTabPortal === 'arquivos_portal' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}">
              <i data-lucide="folder-open" class="w-4 h-4"></i>
              <span>1. Cofre Digital de Arquivos da Empresa — Documentos Constitutivos, Guias e Balancetes (${todosArquivosEmp.length})</span>
            </button>
            <button
              onclick="ZGestorApp.setFiltro('subTabCentralCliente', 'solicitacoes_portal')"
              class="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${subTabPortal === 'solicitacoes_portal' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}">
              <i data-lucide="message-square-text" class="w-4 h-4"></i>
              <span>2. Solicitações do Cliente para a Contabilidade & Retornos (${registros.length})</span>
            </button>
            <button
              onclick="ZGestorApp.setFiltro('subTabCentralCliente', 'visao_360')"
              class="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${subTabPortal === 'visao_360' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}">
              <i data-lucide="layout-grid" class="w-4 h-4"></i>
              <span>3. Ficha Cadastral 360° da Empresa, Parcelamentos e CNDs</span>
            </button>
          </div>
        </div>

        ${subTabPortal === 'arquivos_portal' ? `
          <!-- SUB-ABA 1: COFRE DIGITAL DE ARQUIVOS DA EMPRESA (DOCUMENTOS CONSTITUTIVOS, GUIAS, BALANCETES, CNDs) -->
          <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <h2 class="text-sm font-bold text-slate-900">
                  Arquivos Disponíveis no Portal de ${emp.nome_fantasia} (${emp.razao_social})
                </h2>
                <p class="text-xs text-slate-500">
                  Armazene os documentos constitutivos da empresa e disponibilize guias mensais de impostos, balancetes e certidões para acesso imediato do cliente.
                </p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                ${!modoPortalCliente ? `
                  <button onclick="ZGestorApp.openModalUploadLoteGuias()" class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm" title="Upload inteligente de múltiplos PDFs de guias com leitura de CNPJ">
                    <i data-lucide="layers" class="w-4 h-4"></i> ⚡ Upload em Lote de Guias (Inteligente)
                  </button>
                ` : ''}
                <button onclick="ZGestorApp.openModalArquivoPortal('${emp.id}', '${fPasta !== 'TODAS' ? fPasta : 'CONSTITUTIVOS'}')" class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm">
                  <i data-lucide="upload-cloud" class="w-4 h-4"></i> + Anexar / Disponibilizar Novo Arquivo ou Guia
                </button>
              </div>
            </div>

            ${!modoPortalCliente ? `
              <!-- Área de Arrastar e Soltar Múltiplos PDFs (Upload Inteligente em Lote) -->
              <div
                ondragover="event.preventDefault(); this.classList.add('border-indigo-500', 'bg-indigo-50/50')"
                ondragleave="this.classList.remove('border-indigo-500', 'bg-indigo-50/50')"
                ondrop="event.preventDefault(); this.classList.remove('border-indigo-500', 'bg-indigo-50/50'); ZGestorApp.handleLoteGuiasSelected(event.dataTransfer.files)"
                onclick="ZGestorApp.openModalUploadLoteGuias()"
                class="p-4 bg-gradient-to-r from-indigo-50/60 via-slate-50 to-emerald-50/60 rounded-2xl border-2 border-dashed border-indigo-200 hover:border-indigo-400 flex flex-col sm:flex-row items-center justify-between gap-3 cursor-pointer transition">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <i data-lucide="cloud-upload" class="w-5 h-5"></i>
                  </div>
                  <div>
                    <strong class="text-xs text-slate-900 block font-bold">Área de Upload Inteligente em Lote (Arrastar e Soltar múltiplos PDFs de Guias)</strong>
                    <span class="text-[11px] text-slate-600">Arraste múltiplos arquivos de guias (DAS, DAE ICMS, DARF, FGTS) de uma só vez. O sistema lê o CNPJ e a competência e vincula automaticamente cada guia ao Portal do Cliente correspondente.</span>
                  </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <span class="px-3.5 py-1.5 rounded-xl bg-white border border-indigo-300 text-indigo-700 font-bold text-xs shadow-2xs flex items-center gap-1.5">
                    <i data-lucide="file-up" class="w-3.5 h-3.5"></i> Arraste aqui ou clique para abrir
                  </span>
                </div>
              </div>
            ` : ''}

            <!-- Filtro de Pastas do Portal -->
            <div class="flex flex-wrap items-center gap-1.5">
              <button
                onclick="ZGestorApp.setFiltro('filtroPastaPortal', 'TODAS')"
                class="px-3 py-1.5 rounded-xl text-xs font-bold transition ${fPasta === 'TODAS' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">
                📁 Todas as Pastas (${todosArquivosEmp.length})
              </button>
              ${pastasModelos.map(p => {
      const count = todosArquivosEmp.filter(a => a.pasta === p.id).length;
      return `
                  <button
                    onclick="ZGestorApp.setFiltro('filtroPastaPortal', '${p.id}')"
                    class="px-3 py-1.5 rounded-xl text-xs font-bold transition ${fPasta === p.id ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">
                    ${String(p.label || p.nome || p.id).split('—')[0]} (${count})
                  </button>
                `;
    }).join('')}
            </div>

            <!-- Tabela de Arquivos Disponibilizados no Portal -->
            <div class="border border-slate-200 rounded-2xl overflow-hidden">
              <div class="overflow-x-auto w-full">
                <table class="w-full min-w-[750px] text-left border-collapse">
                <thead>
                  <tr class="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                    <th class="py-3 px-3 w-[20%]">Pasta do Portal</th>
                    <th class="py-3 px-3 w-[33%]">Documento / Guia & Nome do Arquivo</th>
                    <th class="py-3 px-2.5 w-[13%]">Comp. & Venc.</th>
                    <th class="py-3 px-2.5 w-[18%]">Publicação & Leitura Cliente</th>
                    <th class="py-3 px-3 w-[16%] text-right">Acesso do Cliente / Ações</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 text-xs">
                  ${arquivosFiltrados.map(arq => `
                    <tr class="hover:bg-slate-50">
                      <td class="py-3 px-3">
                        ${pastaBadge(arq.pasta)}
                        <div class="text-[10px] text-slate-400 mt-1">Tam: ${arq.tamanho || '180 KB'}</div>
                      </td>
                      <td class="py-3 px-3">
                        ${(() => {
                          const meta = (window.ZGestorApp && window.ZGestorApp.obterIconeEBadgeArquivo)
                            ? window.ZGestorApp.obterIconeEBadgeArquivo(arq.nome_arquivo)
                            : { icone: 'file-text', corTexto: 'text-indigo-600', corBg: 'bg-indigo-50', corBorder: 'border-indigo-200', tipoLabel: 'DOC' };
                          return `
                            <div class="font-bold text-slate-900 flex items-center gap-1.5">
                              <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${meta.corBg} ${meta.corTexto} border ${meta.corBorder}">
                                ${meta.tipoLabel}
                              </span>
                              <span>${arq.titulo}</span>
                            </div>
                            <div class="text-[11px] font-mono text-slate-600 mt-0.5 flex items-center gap-1">
                              <i data-lucide="${meta.icone}" class="w-3.5 h-3.5 ${meta.corTexto} shrink-0"></i>
                              <span>${arq.nome_arquivo}</span>
                            </div>
                          `;
                        })()}
                        ${arq.observacoes ? `<div class="text-[11px] text-slate-500 mt-0.5">${arq.observacoes}</div>` : ''}
                      </td>
                      <td class="py-3 px-2.5">
                        <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold text-[11px]">${arq.competencia || 'Permanente'}</span>
                        ${arq.data_vencimento ? `<div class="text-[11px] font-bold text-rose-600 mt-1">Venc: ${this.formatDate(arq.data_vencimento)}</div>` : ''}
                        ${Number(arq.valor) > 0 ? `<div class="text-[11px] font-extrabold text-slate-900">${this.formatCurrency(arq.valor)}</div>` : ''}
                      </td>
                      <td class="py-3 px-2.5">
                        <div class="font-semibold text-slate-800 flex items-center gap-1">
                          <i data-lucide="calendar" class="w-3 h-3 text-slate-400 shrink-0"></i>
                          <span>Anexado em: ${this.formatDate(arq.data_upload || new Date().toISOString().slice(0, 10))}</span>
                        </div>
                        <div class="text-[11px] text-slate-500 mt-0.5">Por: <strong>${arq.enviado_por || 'Escritório'}</strong></div>
                        <div class="mt-1.5">
                          ${(arq.visualizado && arq.cliente_confirmou_leitura) ? `
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200" title="Visualizado/Baixado em ${arq.visualizado_em_fmt || ''} por ${arq.visualizado_por || 'Cliente'}">
                              <i data-lucide="check-check" class="w-3 h-3 text-teal-600"></i>
                              <span>✓ 100% Visualizado pelo Cliente</span>
                            </span>
                            <div class="text-[10px] text-teal-700 font-semibold mt-0.5">${arq.visualizado_em_fmt ? `Em: ${arq.visualizado_em_fmt}` : ''}</div>
                            ${arq.visualizado_por ? `<div class="text-[10px] text-slate-500">Por: <strong>${arq.visualizado_por}</strong></div>` : ''}
                          ` : `
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200" title="Aguardando abertura ou download pelo cliente no Portal">
                              <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                              <span>Pendente de Leitura do Cliente</span>
                            </span>
                            <div class="text-[10px] text-slate-400 mt-0.5">Disponível no Portal</div>
                          `}
                        </div>
                      </td>
                      <td class="py-3 px-3 text-right">
                        <div class="inline-flex items-center justify-end gap-1">
                          <button
                            onclick="ZGestorApp.visualizarOuBaixarArquivoPortal('${arq.id}')"
                            class="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold inline-flex items-center gap-1 shadow-xs">
                            <i data-lucide="download" class="w-3 h-3"></i> Abrir / Baixar
                          </button>
                          ${!modoPortalCliente ? `
                            <button
                              onclick="ZGestorApp.excluirArquivoPortal('${arq.id}')"
                              class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              title="Remover Arquivo do Portal">
                              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                            </button>
                          ` : ''}
                        </div>
                      </td>
                    </tr>
                  `).join('') || `
                    <tr>
                      <td colspan="5" class="py-8 text-center text-slate-400">
                        Nenhum arquivo disponibilizado nesta pasta ainda. Clique em "+ Anexar / Disponibilizar Novo Arquivo ou Guia" acima!
                      </td>
                    </tr>
                  `}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        ` : subTabPortal === 'solicitacoes_portal' ? `
          <!-- SUB-ABA 2: SOLICITAÇÕES DO CLIENTE PARA A CONTABILIDADE -->
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="p-4 bg-amber-50/60 border-b border-amber-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 class="text-sm font-bold text-slate-900">
                  Canal de Solicitações do Cliente para a Contabilidade — ${emp.nome_fantasia}
                </h2>
                <p class="text-xs text-slate-600">
                  Pedidos abertos pelo cliente no Portal (ex: 2ª via de guia, admissão/rescisão, relação de faturamento, alteração contratual) com integração automática às Tarefas Avulsas.
                </p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <button onclick="ZGestorApp.openModalSolicitacaoPortal('${emp.id}')" class="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm">
                  <i data-lucide="send" class="w-3.5 h-3.5"></i> + Abrir Nova Solicitação para a Contabilidade
                </button>
              </div>
            </div>

            <div class="overflow-x-auto w-full">
              <table class="w-full min-w-[720px] text-left border-collapse">
              <thead>
                <tr class="bg-white border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                  <th class="py-3 px-3 w-[13%]">Data & Origem</th>
                  <th class="py-3 px-2.5 w-[15%]">Setor Destino</th>
                  <th class="py-3 px-3 w-[42%]">Solicitação do Cliente & Resposta da Contabilidade</th>
                  <th class="py-3 px-2.5 w-[15%]">Situação & Resp.</th>
                  <th class="py-3 px-3 w-[15%] text-right">Ações</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-xs">
                ${registros.map(r => `
                  <tr class="hover:bg-slate-50">
                    <td class="py-3 px-3">
                      <div class="font-bold text-slate-900">${this.formatDate(r.data_registro)}</div>
                      <div class="text-[11px] text-slate-500">${r.canal || 'Portal do Cliente'}</div>
                      ${r.solicitante_cliente ? `<div class="text-[10px] font-semibold text-indigo-700 mt-0.5">Por: ${r.solicitante_cliente}</div>` : ''}
                    </td>
                    <td class="py-3 px-2.5">
                      ${this.deptBadge(r.departamento || 'CONTABIL')}
                      ${r.prazo_desejado ? `<div class="text-[11px] text-slate-600 font-semibold mt-1">Prazo: ${this.formatDate(r.prazo_desejado)}</div>` : ''}
                    </td>
                    <td class="py-3 px-3">
                      <div class="font-bold text-slate-900">${this.escapeHtml(r.titulo)}</div>
                      <div class="text-slate-600 mt-0.5">${this.escapeHtml(r.descricao || '')}</div>
                      ${r.anexo_nome ? `
                        <div class="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onclick="ZGestorApp.baixarAnexoSolicitacao('${r.id}')"
                            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-bold cursor-pointer transition">
                            <i data-lucide="paperclip" class="w-3.5 h-3.5 text-indigo-600"></i>
                            <span>Anexo: ${this.escapeHtml(r.anexo_nome)}</span>
                            <span class="text-[10px] text-indigo-500 font-normal">(${r.anexo_tamanho || 'Anexo'})</span>
                          </button>
                        </div>
                      ` : ''}
                      ${r.resposta_contabilidade ? `
                        <div class="mt-2 p-2 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-950 text-[11px]">
                          <strong class="block text-[10px] uppercase text-emerald-800">↪ Resposta / Retorno da Contabilidade:</strong>
                          ${this.escapeHtml(r.resposta_contabilidade)}
                        </div>
                      ` : `
                        <div class="mt-1.5 text-[11px] text-amber-700 italic">Aguardando posicionamento/resposta da contabilidade.</div>
                      `}
                    </td>
                    <td class="py-3 px-2.5">
                      <div>${statusSolicitacaoBadge(r.status)}</div>
                      <div class="text-[11px] text-slate-500 mt-1">Resp: <strong>${r.responsavel_nome || 'A distribuir'}</strong></div>
                    </td>
                    <td class="py-3 px-3 text-right">
                      <div class="inline-flex flex-wrap items-center justify-end gap-1">
                        <button
                          onclick="ZGestorApp.openModalResponderSolicitacaoPortal('${r.id}')"
                          class="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold">
                          Responder / Status
                        </button>
                        <button onclick="ZGestorApp.openModalSolicitacaoPortal('${emp.id}', '${r.id}')" class="p-1 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100" title="Editar">
                          <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                        </button>
                        <button onclick="ZGestorApp.excluirRegistroCentral('${r.id}')" class="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Excluir">
                          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                `).join('') || `
                  <tr>
                    <td colspan="5" class="py-8 text-center text-slate-400">
                      Nenhuma solicitação registrada para esta empresa ainda. Clique em "+ Abrir Nova Solicitação para a Contabilidade"!
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
            </div>
          </div>
        ` : `
          <!-- SUB-ABA 3: VISÃO 360° DA EMPRESA (FICHA CADASTRAL, PRÓ-LABORE x FUNCIONÁRIOS, PARCELAMENTOS, CNDs E HONORÁRIOS) -->
          <div class="grid grid-cols-1 md:grid-cols-2 ${(modoPortalCliente ? 'xl:grid-cols-3' : (canSeeHon ? 'xl:grid-cols-4' : 'xl:grid-cols-3'))} gap-3.5">
            <!-- 1. Dados Cadastrais e Fiscais -->
            <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1.5 text-xs">
              <div class="flex items-center justify-between pb-1.5 border-b border-slate-100">
                <span class="font-bold uppercase text-[10px] text-slate-500">1. Ficha Cadastral & Fiscal</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">${emp.regime_tributario}</span>
              </div>
              <div class="font-bold text-slate-900 text-sm">${emp.razao_social}</div>
              <div class="text-slate-600"><strong>CNPJ:</strong> <span class="font-mono">${emp.cnpj}</span></div>
              <div class="text-slate-600"><strong>IE:</strong> ${emp.inscricao_estadual || 'Isento'} • <strong>IM:</strong> ${emp.inscricao_municipal || '—'}</div>
              <div class="text-slate-600"><strong>Responsável:</strong> ${emp.responsavel_legal || '—'}</div>
              <div class="text-slate-600"><strong>Contato:</strong> ${emp.telefone || '—'} | ${emp.email || '—'}</div>
              <div class="pt-1 flex flex-wrap gap-1">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${emp.possui_pro_labore !== false ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-500'}">
                  Pró-Labore: ${emp.possui_pro_labore !== false ? 'Sim (DARF INSS/IRRF)' : 'Não'}
                </span>
                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${emp.possui_funcionarios ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-500'}">
                  Funcionários CLT: ${emp.possui_funcionarios ? 'Sim (FGTS)' : 'Não'}
                </span>
              </div>
            </div>

            <!-- 2. Obrigações e Guias na Competência Ativa (OCULTO NA VISÃO CLIENTE) -->
            ${!modoPortalCliente ? `
              <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2 text-xs">
                <div class="flex items-center justify-between pb-1.5 border-b border-slate-100">
                  <span class="font-bold uppercase text-[10px] text-slate-500">2. Rotina Mensal (${comp} → ${sub.label})</span>
                  <button onclick="ZGestorApp.setFiltro('filtroTarefaCliente', '${emp.id}'); ZGestorApp.navigate('tarefas')" class="text-[11px] font-bold text-indigo-600 hover:underline">Ver Tarefas →</button>
                </div>
                <div class="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <span>Obrigações / Tarefas Entregues:</span>
                  <strong class="text-sm text-indigo-700">${tarefasConcluidas.length} / ${tarefasEmp.length}</strong>
                </div>
                <div class="flex items-center justify-between bg-emerald-50/60 p-2 rounded-xl border border-emerald-100">
                  <span>Guias de Impostos Enviadas:</span>
                  <strong class="text-sm text-emerald-700">${guiasImpEnviadas.length} / ${guiasImpEmp.length}</strong>
                </div>
              </div>
            ` : ''}

            <!-- 3. Parcelamentos & Certidões (CNDs) -->
            <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2 text-xs">
              <div class="flex items-center justify-between pb-1.5 border-b border-slate-100">
                <span class="font-bold uppercase text-[10px] text-slate-500">${modoPortalCliente ? '2.' : '3.'} Parcelamentos & CNDs</span>
                ${!modoPortalCliente ? `
                  <button onclick="ZGestorApp.setFiltro('filtroCNDCliente', '${emp.id}'); ZGestorApp.navigate('cnds')" class="text-[11px] font-bold text-teal-600 hover:underline">Ver CNDs →</button>
                ` : ''}
              </div>
              <div class="space-y-1">
                <div class="font-semibold text-slate-800">Parcelamentos (${parcsEmp.length}):</div>
                ${parcsEmp.slice(0, 2).map(p => {
      const st = this.statusParcelamentoLabel(p.status);
      return `<div class="flex items-center justify-between text-[11px]"><span class="truncate mr-1">${p.orgao}</span><span class="px-1.5 py-0.5 rounded font-bold text-[10px] ${st.cls}">${st.label}</span></div>`;
    }).join('') || `<div class="text-[11px] text-slate-400">Nenhum parcelamento cadastrado.</div>`}
              </div>
              <div class="pt-1 border-t border-slate-100 space-y-1">
                <div class="font-semibold text-slate-800">Certidões Monitoradas (${cndsEmp.length}):</div>
                ${cndsEmp.slice(0, 2).map(c => {
      const st = db.calcularStatusValidadeCND(c);
      return `<div class="flex items-center justify-between text-[11px]"><span class="truncate mr-1">${c.orgao}</span><span class="font-bold ${st.codigo === 'VIGENTE' ? 'text-emerald-700' : 'text-rose-600'}">${st.label}</span></div>`;
    }).join('') || `<div class="text-[11px] text-slate-400">Nenhuma CND cadastrada.</div>`}
              </div>
            </div>

            <!-- 4. Financeiro / Honorários (Visão Escritório Completa vs. Visão Cliente Simplificada) -->
            ${!modoPortalCliente ? (
        canSeeHon ? `
                <div class="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm space-y-2 text-xs">
                  <div class="flex items-center justify-between pb-1.5 border-b border-slate-100">
                    <span class="font-bold uppercase text-[10px] text-emerald-700">4. Financeiro / Honorários (${comp})</span>
                    <button onclick="ZGestorApp.navigate('honorarios')" class="text-[11px] font-bold text-emerald-700 hover:underline">Ver Honorários →</button>
                  </div>
                  ${honEmp ? `
                    <div class="flex justify-between"><span>Honorário Mensal:</span><strong>${this.formatCurrency(honEmp.valor_mensal)}</strong></div>
                    <div class="flex justify-between text-amber-800"><span>Saldo Mês Anterior:</span><strong>+ ${this.formatCurrency(honEmp.saldo_anterior || 0)}</strong></div>
                    <div class="flex justify-between text-emerald-700"><span>Pago no Mês:</span><strong>${this.formatCurrency(honEmp.valor_pago)}</strong></div>
                    <div class="flex justify-between text-rose-600 pt-1 border-t border-slate-100 font-bold text-sm">
                      <span>Saldo em Aberto:</span>
                      <span>${this.formatCurrency(honEmp.saldo_aberto)}</span>
                    </div>
                    <button onclick="ZGestorReports.imprimirReciboHonorarioPix('${honEmp.id}')" class="w-full mt-1 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] flex items-center justify-center gap-1">
                      <i data-lucide="printer" class="w-3 h-3"></i> Imprimir Recibo PIX
                    </button>
                  ` : `
                    <div class="text-slate-500 py-2">Honorário padrão: <strong>${this.formatCurrency(emp.valor_honorario_padrao)}</strong> (Vence dia ${emp.dia_vencimento_honorario})</div>
                  `}
                </div>
              ` : ''
      ) : `
              <!-- Visão Cliente Simplificada: Resumo Enxuto de Honorários -->
              <div class="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm space-y-3 text-xs">
                <div class="flex items-center justify-between pb-1.5 border-b border-slate-100">
                  <span class="font-bold uppercase text-[10px] text-emerald-700">3. Financeiro / Honorários (${comp})</span>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${(honEmp && Number(honEmp.saldo_aberto) <= 0) ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}">
                    ${(honEmp && Number(honEmp.saldo_aberto) <= 0) ? '✓ Pago' : '⏳ Em Aberto'}
                  </span>
                </div>
                <div class="flex items-baseline justify-between py-1">
                  <span class="text-slate-600 font-medium">Valor do Mês:</span>
                  <span class="text-base font-extrabold text-slate-900">${this.formatCurrency(honEmp ? honEmp.valor_mensal : emp.valor_honorario_padrao)}</span>
                </div>
                <div class="flex items-center justify-between py-1 border-t border-slate-100 text-[11px]">
                  <span class="text-slate-500">Situação:</span>
                  <span class="font-bold ${(honEmp && Number(honEmp.saldo_aberto) <= 0) ? 'text-emerald-700' : 'text-amber-700'}">
                    ${(honEmp && Number(honEmp.saldo_aberto) <= 0) ? 'Totalmente Quitado' : 'Em Aberto'}
                  </span>
                </div>
                <button
                  onclick="ZGestorReports.imprimirReciboHonorarioPix('${honEmp ? honEmp.id : emp.id}')"
                  class="w-full mt-2 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition">
                  <i data-lucide="printer" class="w-3.5 h-3.5"></i> Imprimir Recibo
                </button>
              </div>
            `}
          </div>
        `}
      </div>
    `;
  },

  // ===========================================================================
  // 6. CADASTRO DE EMPRESAS DO ESCRITÓRIO (COM PRÓ-LABORE SEPARADO DE FUNCIONÁRIOS CLT)
  // ===========================================================================
  renderEmpresas(appState) {
    const db = window.zgestorDB;
    const user = db.getCurrentUser();
    const isAdmin = db.isAdmin();
    const subTabEmp = isAdmin ? (appState.subTabEmpresas || 'lista') : 'lista';
    const canSeeHon = db.canAccessModule('honorarios', user);
    const busca = (appState.filtroEmpresaBusca || '').toLowerCase().trim();
    const regime = appState.filtroEmpresaRegime || 'TODOS';

    let empresas = [...db.data.empresas];
    if (regime !== 'TODOS') {
      empresas = empresas.filter(e => e.regime_tributario === regime);
    }
    if (busca) {
      empresas = empresas.filter(e =>
        e.razao_social.toLowerCase().includes(busca) ||
        (e.nome_fantasia || '').toLowerCase().includes(busca) ||
        e.cnpj.toLowerCase().includes(busca) ||
        (e.codigo_interno || '').toLowerCase().includes(busca)
      );
    }

    const previewImp = appState.importacaoEmpresasPreview;

    return `
      <div class="space-y-4">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h1 class="text-lg font-bold text-slate-900">Cadastro de Empresas do Escritório</h1>
            <p class="text-xs text-slate-500">
              Gerencie os dados cadastrais, regime tributário, Inscrição Estadual e configurações de folha.
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button onclick="ZGestorReports.emitirRelatorioAba('empresas', ZGestorApp.state)" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm">
              <i data-lucide="printer" class="w-3.5 h-3.5"></i> Relatório de Empresas
            </button>
            <button onclick="ZGestorApp.openModalEmpresa()" class="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm">
              <i data-lucide="building" class="w-3.5 h-3.5"></i> + Cadastrar Nova Empresa
            </button>
          </div>
        </div>

        ${isAdmin ? `
          <div class="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-2">
            <button
              onclick="ZGestorApp.setFiltro('subTabEmpresas', 'lista')"
              class="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${subTabEmp === 'lista' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}">
              <i data-lucide="building-2" class="w-4 h-4"></i>
              <span>Empresas Cadastradas (${db.data.empresas.length})</span>
            </button>
            <button
              onclick="ZGestorApp.setFiltro('subTabEmpresas', 'importar_lote')"
              class="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${subTabEmp === 'importar_lote' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}">
              <i data-lucide="file-spreadsheet" class="w-4 h-4"></i>
              <span>Importar Empresas em Lote (Excel)</span>
            </button>
          </div>
        ` : ''}

        ${subTabEmp === 'importar_lote' && isAdmin ? `
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 text-xs">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <h2 class="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <i data-lucide="file-spreadsheet" class="w-4 h-4 text-emerald-600"></i>
                  Importação em Lote de Empresas via Planilha Excel (.xlsx / .xls / .csv)
                </h2>
                <p class="text-xs text-slate-500 mt-0.5">
                  Baixe o modelo pronto, preencha as colunas abaixo e envie a planilha para cadastrar ou atualizar empresas automaticamente.
                </p>
              </div>
              <button
                type="button"
                onclick="ZGestorApp.baixarModeloPlanilhaEmpresas()"
                class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer">
                <i data-lucide="download" class="w-4 h-4"></i>
                Baixar Planilha Modelo (.xlsx)
              </button>
            </div>

            <!-- Definição das Colunas -->
            <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div class="font-bold text-slate-800 mb-2">Colunas da Planilha Excel (cabeçalho exato na linha 1):</div>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-[11px]">
                <div><code class="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-bold text-indigo-700">razao_social</code> * <span class="text-slate-500">Razão Social completa</span></div>
                <div><code class="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-bold text-indigo-700">cnpj</code> * <span class="text-slate-500">CNPJ (com ou sem pontos)</span></div>
                <div><code class="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-bold text-slate-700">codigo_interno</code> <span class="text-slate-500">Ex: 062 (auto se vazio)</span></div>
                <div><code class="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-bold text-slate-700">nome_fantasia</code> <span class="text-slate-500">Nome curto (opcional)</span></div>
                <div><code class="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-bold text-slate-700">inscricao_estadual</code> <span class="text-slate-500">Número I.E. ou ISENTO</span></div>
                <div><code class="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-bold text-slate-700">regime_tributario</code> <span class="text-slate-500">Simples Nacional, Lucro Presumido, Lucro Real, MEI</span></div>
                <div><code class="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-bold text-slate-700">possui_folha</code> <span class="text-slate-500">SIM ou NAO</span></div>
                <div><code class="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-bold text-slate-700">responsavel_legal</code> <span class="text-slate-500">Nome do sócio</span></div>
                <div><code class="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-bold text-slate-700">email</code> <span class="text-slate-500">E-mail de contato</span></div>
                <div><code class="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-bold text-slate-700">telefone</code> <span class="text-slate-500">WhatsApp / Telefone</span></div>
                <div><code class="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-bold text-slate-700">valor_honorario_padrao</code> <span class="text-slate-500">Ex: 1200.00</span></div>
                <div><code class="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-bold text-slate-700">dia_vencimento_honorario</code> <span class="text-slate-500">Dia 1 a 28 (Ex: 10)</span></div>
                <div><code class="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-bold text-slate-700">cidade</code> <span class="text-slate-500">Cidade</span></div>
                <div><code class="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-bold text-slate-700">uf</code> <span class="text-slate-500">Sigla UF (Ex: MG)</span></div>
                <div><code class="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-bold text-slate-700">status</code> <span class="text-slate-500">ATIVA ou INATIVA</span></div>
              </div>
            </div>

            <!-- Upload da Planilha -->
            <div class="p-5 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/40 text-center space-y-2">
              <input id="f-import-empresas-excel" type="file" accept=".xlsx,.xls,.csv" onchange="ZGestorApp.lerPlanilhaEmpresasLote(event)" class="hidden" />
              <label for="f-import-empresas-excel" class="cursor-pointer inline-flex flex-col items-center">
                <div class="w-11 h-11 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2">
                  <i data-lucide="upload-cloud" class="w-5 h-5"></i>
                </div>
                <span class="font-bold text-emerald-950 text-sm">Clique para selecionar sua planilha Excel (.xlsx, .xls ou .csv)</span>
                <span class="text-[11px] text-slate-500 mt-0.5">Você poderá revisar todas as empresas antes de confirmar a gravação</span>
              </label>
            </div>

            ${previewImp && Array.isArray(previewImp.linhas) ? `
              <div class="space-y-3 pt-2">
                <div class="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-indigo-50 border border-indigo-200">
                  <div class="font-bold text-indigo-950">
                    Pré-visualização: ${previewImp.linhas.length} linha(s) lida(s) do arquivo "${this.escapeHtml(previewImp.nomeArquivo || '')}"
                    (${previewImp.novas} nova(s) • ${previewImp.existentes} já cadastrada(s))
                  </div>
                  <label class="inline-flex items-center gap-2 font-semibold text-indigo-900 cursor-pointer">
                    <input type="checkbox" ${appState.importacaoEmpresasAtualizar !== false ? 'checked' : ''} onchange="ZGestorApp.setFiltro('importacaoEmpresasAtualizar', this.checked)" class="w-4 h-4 rounded text-indigo-600" />
                    <span>Atualizar dados das empresas já existentes (pelo CNPJ)</span>
                  </label>
                </div>

                <div class="overflow-x-auto max-h-[340px] border border-slate-200 rounded-xl">
                  <table class="w-full min-w-[700px] text-left border-collapse text-xs">
                    <thead class="sticky top-0 bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                      <tr>
                        <th class="py-2 px-3">Cód.</th>
                        <th class="py-2 px-3">Razão Social / Fantasia</th>
                        <th class="py-2 px-3">CNPJ</th>
                        <th class="py-2 px-3">I.E.</th>
                        <th class="py-2 px-3">Regime</th>
                        <th class="py-2 px-3">Situação</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                      ${previewImp.linhas.slice(0, 100).map(l => `
                        <tr>
                          <td class="py-2 px-3 font-mono">${this.escapeHtml(l.codigo_interno || 'Auto')}</td>
                          <td class="py-2 px-3 font-bold text-slate-900">${this.escapeHtml(l.razao_social || '—')}</td>
                          <td class="py-2 px-3 font-mono">${this.escapeHtml(l.cnpj || '—')}</td>
                          <td class="py-2 px-3 font-mono">${this.escapeHtml(l.inscricao_estadual || 'ISENTO')}</td>
                          <td class="py-2 px-3">${this.escapeHtml(l.regime_tributario || 'Simples Nacional')}</td>
                          <td class="py-2 px-3">
                            ${l._valida === false
                              ? '<span class="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px]">Falta Razão/CNPJ</span>'
                              : l._existe
                                ? '<span class="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">Já Cadastrada</span>'
                                : '<span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">Nova Empresa</span>'}
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>

                <div class="flex justify-end gap-2">
                  <button type="button" onclick="ZGestorApp.limparPreviewImportacaoEmpresas()" class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer">Limpar</button>
                  <button type="button" onclick="ZGestorApp.confirmarImportacaoEmpresasLote()" class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow cursor-pointer">Confirmar Importação em Lote</button>
                </div>
              </div>
            ` : ''}
          </div>
        ` : `
        <!-- Filtros -->
        <div class="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-3">
          <div class="md:col-span-2">
            <label class="block text-[10px] font-bold uppercase text-slate-500 mb-1">Buscar por Razão Social, Nome Fantasia, Código ou CNPJ</label>
            <input
              type="text"
              id="input-filtro-empresa-busca"
              autocomplete="off"
              value="${this.escapeHtml(appState.filtroEmpresaBusca || '')}"
              oninput="ZGestorApp.setFiltro('filtroEmpresaBusca', this.value)"
              placeholder="Ex: TechNova, 34.512.890/0001-45..."
              class="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label class="block text-[10px] font-bold uppercase text-slate-500 mb-1">Regime Tributário</label>
            <select onchange="ZGestorApp.setFiltro('filtroEmpresaRegime', this.value)" class="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-800">
              <option value="TODOS" ${regime === 'TODOS' ? 'selected' : ''}>Todos os Regimes</option>
              ${window.ZGESTOR_MODELS.regimesTributarios.map(r => `
                <option value="${r}" ${regime === r ? 'selected' : ''}>${r}</option>
              `).join('')}
            </select>
          </div>
        </div>

        <!-- Lista de Empresas (Responsiva com rolagem horizontal) -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="overflow-x-auto w-full">
            <table class="w-full min-w-[800px] text-left border-collapse">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                <th class="py-3 px-3 ${canSeeHon ? 'w-[18%]' : 'w-[20%]'}">Cód / Empresa</th>
                <th class="py-3 px-2.5 ${canSeeHon ? 'w-[16%]' : 'w-[18%]'}">CNPJ & Município</th>
                <th class="py-3 px-2.5 ${canSeeHon ? 'w-[18%]' : 'w-[20%]'}">Regime, Pró-Labore & CLT</th>
                <th class="py-3 px-2.5 ${canSeeHon ? 'w-[15%]' : 'w-[16%]'}">Certificado & Proc.</th>
                <th class="py-3 px-2.5 ${canSeeHon ? 'w-[12%]' : 'w-[14%]'}">Responsável & Contato</th>
                ${canSeeHon ? `<th class="py-3 px-2.5 w-[9%]">Honorário</th>` : ''}
                <th class="py-3 px-3 w-[12%] text-right">Status & Ações</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-xs">
              ${empresas.map(e => {
      const temProLabore = e.possui_pro_labore !== false;
      const temFunc = Boolean(e.possui_funcionarios);
      const statusCert = this.calcularStatusCertificado(e.validade_certificado);
      const codChamada = this.codLimpo(e.codigo_interno);
      const municipioExib = e.municipio_uf || (e.cidade ? `${e.cidade.toUpperCase()}/${(e.uf || '').toUpperCase()}` : '—');
      return `
                  <tr class="hover:bg-slate-50">
                    <td class="py-3 px-3">
                      <div class="flex items-start gap-2">
                        <span class="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200 font-mono text-[11px] font-extrabold shrink-0" title="Código de Chamada">${this.escapeHtml(codChamada || '—')}</span>
                        <div class="min-w-0">
                          <div class="font-bold text-slate-900 leading-snug">${this.escapeHtml(e.razao_social || e.nome_fantasia)}</div>
                          <div class="text-[11px] text-slate-500 mt-0.5">Fantasia: ${this.escapeHtml(e.nome_fantasia || '—')}</div>
                        </div>
                      </div>
                    </td>
                    <td class="py-3 px-2.5">
                      <div class="font-mono font-semibold text-slate-800">${e.cnpj}</div>
                      <div class="text-[11px] font-medium text-slate-600 flex items-center gap-1 mt-0.5">
                        <i data-lucide="map-pin" class="w-3 h-3 text-slate-400"></i>
                        <span>${this.escapeHtml(municipioExib)}</span>
                      </div>
                      <div class="text-[10px] text-slate-500 mt-1 flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onclick="ZGestorApp.alternarIEEmpresa('${e.id}')"
                          title="Clique para marcar/desmarcar ou informar Inscrição Estadual (controla ICMS, DeSTDA e EFD-ICMS)"
                          class="px-1.5 py-0.5 rounded font-bold border transition cursor-pointer ${db.empresaPossuiIE(e) ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}">
                          IE: ${db.empresaPossuiIE(e) ? this.escapeHtml(e.inscricao_estadual || 'Ativa') : 'Sem I.E. (+ Ativar)'}
                        </button>
                        <span>IM: ${e.inscricao_municipal || '—'}</span>
                      </div>
                    </td>
                    <td class="py-3 px-2.5">
                      <div>
                        <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          ${e.regime_tributario}
                        </span>
                      </div>
                      <div class="flex flex-wrap gap-1 mt-1.5">
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${temProLabore ? 'bg-blue-50 text-blue-800 border-blue-200' : 'bg-slate-100 text-slate-500 border-slate-200'}">
                          ${temProLabore ? '✓ Pró-Labore (DARF)' : 'Sem Pró-Labore'}
                        </span>
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${temFunc ? 'bg-purple-50 text-purple-800 border-purple-200' : 'bg-slate-100 text-slate-500 border-slate-200'}">
                          ${temFunc ? '✓ CLT (FGTS)' : 'Sem CLT'}
                        </span>
                      </div>
                    </td>
                    <td class="py-3 px-2.5">
                      <div class="space-y-1">
                        <div>
                          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusCert.cls}" title="${statusCert.dias !== undefined ? `${statusCert.dias} dias para o vencimento` : ''}">
                            ${statusCert.alerta ? `<i data-lucide="alert-triangle" class="w-3 h-3 ${statusCert.status === 'VENCIDO' ? 'text-rose-600' : 'text-amber-600'}"></i>` : `<i data-lucide="shield-check" class="w-3 h-3 text-emerald-600"></i>`}
                            <span>${statusCert.label}</span>
                          </span>
                        </div>
                        <div class="text-[10px] text-slate-500 flex items-center gap-1 font-medium">
                          <i data-lucide="file-check" class="w-3 h-3 text-slate-400"></i>
                          <span>Proc. e-CAC / SEFAZ: Ativa</span>
                        </div>
                      </div>
                    </td>
                    <td class="py-3 px-2.5">
                      <div class="font-medium text-slate-800">${e.responsavel_legal || '—'}</div>
                      <div class="text-[11px] text-slate-500">${e.telefone || ''}</div>
                      <div class="mt-1">${this.renderBadgePreferenciaEnvio(e, appState.competencia, true)}</div>
                    </td>
                    ${canSeeHon ? `
                      <td class="py-3 px-2.5">
                        <div class="font-bold text-slate-900">${this.formatCurrency(e.valor_honorario_padrao)}</div>
                        <div class="text-[10px] text-slate-500">Vence dia ${e.dia_vencimento_honorario}</div>
                      </td>
                    ` : ''}
                    <td class="py-3 px-3 text-right">
                      <div class="flex flex-col items-end gap-1">
                        <span class="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap min-w-[95px] text-center ${e.status === 'ATIVA' ? 'bg-emerald-100 text-emerald-800' :
          e.status === 'EM_ONBOARDING' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'
        }">
                          ${e.status === 'EM_ONBOARDING' ? 'EM ONBOARDING' : e.status}
                        </span>
                        <div class="inline-flex items-center gap-1 mt-1">
                          <button onclick="ZGestorApp.selecionarEmpresaCentral('${e.id}'); ZGestorApp.navigate('central_cliente')" class="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-semibold whitespace-nowrap" title="Abrir Portal do Cliente">
                            Portal
                          </button>
                          <button onclick="ZGestorApp.verOnboardingEmpresa('${e.id}')" class="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-semibold whitespace-nowrap min-w-[76px] text-center" title="Acompanhar Onboarding">
                            Onboarding
                          </button>
                          <button onclick="ZGestorApp.openModalEmpresa('${e.id}')" class="p-1 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100" title="Editar Empresa">
                            <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                `;
    }).join('')}
            </tbody>
          </table>
          </div>
        </div>
        `}
      </div>
    `;
  },

  // ===========================================================================
  // 7. ONBOARDING DE NOVOS CLIENTES
  // ===========================================================================
  renderOnboarding(appState) {
    const db = window.zgestorDB;
    const somentePendentes = appState.filtroOnboardingSomentePendentes !== false;
    const somenteItensPendentes = Boolean(appState.filtroOnboardingItensPendentes);

    const todasComOnboarding = db.data.empresas.filter(e =>
      e.status === 'EM_ONBOARDING' || db.data.onboarding_itens.some(i => i.empresa_id === e.id)
    );

    const empresasPendentes = todasComOnboarding.filter(e => {
      const prog = db.obterProgressoOnboarding(e.id);
      return !prog.completo && e.status === 'EM_ONBOARDING';
    });

    const empresasConcluidas = todasComOnboarding.filter(e => {
      const prog = db.obterProgressoOnboarding(e.id);
      return prog.completo || e.status === 'ATIVA';
    });

    const empresasVisiveis = somentePendentes ? empresasPendentes : todasComOnboarding;

    let selecionadaId = appState.empresaOnboardingId;
    if (!empresasVisiveis.some(e => e.id === selecionadaId)) {
      selecionadaId = (empresasVisiveis[0] && empresasVisiveis[0].id) || null;
    }

    const empSel = db.data.empresas.find(e => e.id === selecionadaId);
    const itensEmp = db.data.onboarding_itens
      .filter(i => i.empresa_id === selecionadaId)
      .sort((a, b) => a.ordem - b.ordem);

    const progSel = empSel ? db.obterProgressoOnboarding(empSel.id) : { total: 0, concluidos: 0, percentual: 0, completo: false };

    return `
      <div class="space-y-4">
        <!-- Cabeçalho -->
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <div class="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 mb-0.5">
              <i data-lucide="rocket" class="w-4 h-4"></i> Implantação e Entrada de Novos Clientes
            </div>
            <h1 class="text-lg font-bold text-slate-900">Onboarding de Novos Clientes no Escritório</h1>
            <p class="text-xs text-slate-500">
              Empresas que atingem <strong>100%</strong> são ocultadas automaticamente no modo "Somente Pendentes à Vista".
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button onclick="ZGestorReports.emitirRelatorioAba('onboarding', ZGestorApp.state)" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm">
              <i data-lucide="printer" class="w-3.5 h-3.5"></i> Relatório de Onboarding
            </button>
            <button onclick="ZGestorApp.openModalEmpresa(null, true)" class="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm">
              <i data-lucide="user-plus" class="w-3.5 h-3.5"></i> + Novo Cliente em Onboarding
            </button>
          </div>
        </div>

        <!-- Barra de Filtro: Deixar Somente Empresas Pendentes à Vista (< 100%) -->
        <div class="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs font-bold uppercase text-slate-500 mr-1">Visualização:</span>
            <button
              onclick="ZGestorApp.setFiltroOnboardingPendentes(true)"
              class="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${somentePendentes ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">
              <i data-lucide="filter" class="w-3.5 h-3.5"></i>
              Somente Empresas Pendentes à Vista (${empresasPendentes.length})
            </button>
            <button
              onclick="ZGestorApp.setFiltroOnboardingPendentes(false)"
              class="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${!somentePendentes ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">
              <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i>
              Mostrar Todas / Incluir 100% Concluídas (${todasComOnboarding.length})
            </button>
          </div>

          <label class="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <input
              type="checkbox"
              ${somenteItensPendentes ? 'checked' : ''}
              onchange="ZGestorApp.setFiltro('filtroOnboardingItensPendentes', this.checked)"
              class="w-4 h-4 rounded text-indigo-600"
            />
            <span>No checklist, mostrar apenas etapas não concluídas</span>
          </label>
        </div>

        <!-- Seletor de Clientes em Onboarding -->
        ${empresasVisiveis.length > 0 ? `
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            ${empresasVisiveis.map(emp => {
      const pr = db.obterProgressoOnboarding(emp.id);
      const isSelected = emp.id === selecionadaId;
      return `
                <div
                  onclick="ZGestorApp.selecionarEmpresaOnboarding('${emp.id}')"
                  class="p-4 rounded-2xl border cursor-pointer transition ${isSelected ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20' : 'border-slate-200 bg-white hover:border-slate-300'}">
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <span class="text-[10px] font-bold uppercase text-slate-500">Entrada: ${this.formatDate(emp.data_entrada)}</span>
                      <h3 class="font-bold text-slate-900 text-sm">${emp.razao_social}</h3>
                      <p class="text-xs text-slate-500">${emp.cnpj} • ${emp.regime_tributario}</p>
                      <div class="flex items-center gap-1.5 mt-1.5">
                        <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${emp.modelo_onboarding === 'TROCA_CONTABILIDADE' ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-blue-100 text-blue-800 border border-blue-200'}">
                          ${emp.modelo_onboarding === 'TROCA_CONTABILIDADE' ? '🔄 Troca de Contab.' : '🚀 Abertura Empresa'}
                        </span>
                        <span class="text-[10px] text-slate-500 font-medium">${emp.municipio_uf || ''}</span>
                      </div>
                    </div>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${pr.completo ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
                      ${pr.completo ? '100% Concluído' : `${pr.pendentes} pendente(s)`}
                    </span>
                  </div>
                  <div class="mt-3">
                    <div class="flex items-center justify-between text-xs mb-1">
                      <span class="text-slate-600">${pr.concluidos}/${pr.total} etapas concluídas</span>
                      <span class="font-bold ${pr.completo ? 'text-emerald-700' : 'text-indigo-700'}">${pr.percentual}%</span>
                    </div>
                    <div class="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div class="h-full ${pr.completo ? 'bg-emerald-600' : 'bg-indigo-600'} rounded-full" style="width: ${pr.percentual}%"></div>
                    </div>
                  </div>
                </div>
              `;
    }).join('')}
          </div>
        ` : `
          <div class="bg-white rounded-2xl border border-emerald-200 p-6 text-center shadow-sm">
            <h3 class="text-sm font-bold text-slate-900">Nenhuma empresa pendente de Onboarding no momento!</h3>
            <p class="text-xs text-slate-500 mt-1">
              Todas as empresas em implantação já atingiram 100% de conclusão (${empresasConcluidas.length} concluída(s)).
            </p>
            <button onclick="ZGestorApp.setFiltroOnboardingPendentes(false)" class="mt-3 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold">
              Ver Empresas com Onboarding 100% Concluído
            </button>
          </div>
        `}

        ${empSel ? `
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <h2 class="text-base font-bold text-slate-900">${empSel.razao_social} (${empSel.nome_fantasia})</h2>
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${empSel.modelo_onboarding === 'TROCA_CONTABILIDADE' ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-blue-100 text-blue-800 border border-blue-200'}">
                    ${empSel.modelo_onboarding === 'TROCA_CONTABILIDADE' ? '🔄 Modelo: Troca de Contabilidade' : '🚀 Modelo: Abertura de Empresa'}
                  </span>
                </div>
                <p class="text-xs text-slate-500 mt-0.5">
                  Município: <strong>${empSel.municipio_uf || '—'}</strong> • Responsável: ${empSel.responsavel_legal || '—'} • Progresso Geral: <strong>${progSel.percentual}% (${progSel.concluidos}/${progSel.total})</strong>
                </p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                ${itensEmp.length === 0 ? `
                  <button onclick="ZGestorApp.gerarChecklistEmpresa('${empSel.id}', 'ABERTURA_EMPRESA')" class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm">
                    <i data-lucide="file-plus-2" class="w-3.5 h-3.5"></i> Checklist: Abertura de Empresa
                  </button>
                  <button onclick="ZGestorApp.gerarChecklistEmpresa('${empSel.id}', 'TROCA_CONTABILIDADE')" class="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm">
                    <i data-lucide="repeat" class="w-3.5 h-3.5"></i> Checklist: Troca de Contabilidade
                  </button>
                ` : `
                  <button onclick="ZGestorApp.abrirModalTrocarModeloOnboarding('${empSel.id}')" class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1" title="Alternar modelo de checklist">
                    <i data-lucide="layers" class="w-3.5 h-3.5"></i> Alternar Modelo
                  </button>
                `}
                <button onclick="ZGestorApp.openModalItemOnboarding('${empSel.id}')" class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1">
                  <i data-lucide="plus" class="w-3.5 h-3.5"></i> Adicionar Etapa
                </button>
                ${!progSel.completo || empSel.status === 'EM_ONBOARDING' ? `
                  <button onclick="ZGestorApp.finalizarOnboarding('${empSel.id}')" class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shadow-sm">
                    <i data-lucide="check-check" class="w-3.5 h-3.5"></i> Concluir 100% Onboarding
                  </button>
                ` : ''}
              </div>
            </div>

            <div class="space-y-4">
              ${window.ZGESTOR_MODELS.etapasOnboarding.map(etapa => {
      const todosDaEtapa = itensEmp.filter(i => i.etapa === etapa.id);
      const itensDaEtapa = somenteItensPendentes ? todosDaEtapa.filter(i => !i.concluido) : todosDaEtapa;
      if (somenteItensPendentes && itensDaEtapa.length === 0) return '';
      return `
                  <div class="border border-slate-200 rounded-xl overflow-hidden">
                    <div class="bg-slate-50 px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between">
                      <div>
                        <h3 class="text-xs font-bold text-slate-900">${etapa.titulo}</h3>
                        <p class="text-[11px] text-slate-500">${etapa.descricao}</p>
                      </div>
                      <span class="text-xs font-bold text-slate-600">
                        ${todosDaEtapa.filter(i => i.concluido).length}/${todosDaEtapa.length}
                      </span>
                    </div>
                    <div class="divide-y divide-slate-100">
                      ${itensDaEtapa.map(item => `
                        <div class="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/70 ${item.concluido ? 'bg-emerald-50/20' : ''}">
                          <label class="flex items-start gap-2.5 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              ${item.concluido ? 'checked' : ''}
                              onchange="ZGestorApp.toggleItemOnboarding('${item.id}', this.checked)"
                              class="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600"
                            />
                            <div class="text-xs">
                              <div class="font-semibold ${item.concluido ? 'line-through text-slate-500' : 'text-slate-900'}">${item.titulo}</div>
                              <div class="flex flex-wrap items-center gap-2 mt-0.5">
                                ${this.deptBadge(item.departamento)}
                                ${item.concluido ? `<span class="text-[11px] text-emerald-700 font-medium">✓ Concluído em ${this.formatDate(item.data_conclusao)}</span>` : ''}
                              </div>
                            </div>
                          </label>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                `;
    }).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  },

  // ===========================================================================
  // 8. ABA DE CONTROLE DE HONORÁRIOS (COMPACTA SEM ROLAGEM LATERAL)
  // ===========================================================================
  renderHonorarios(appState) {
    const db = window.zgestorDB;
    const user = db.getCurrentUser();

    if (!db.canAccessModule('honorarios', user)) {
      return `
        <div class="bg-white rounded-2xl border border-rose-200 p-8 text-center max-w-xl mx-auto my-8 shadow-sm">
          <h2 class="text-base font-bold text-slate-900">Acesso Restrito pela Política de Segurança (RLS)</h2>
          <p class="text-xs text-slate-600 mt-2">
            Apenas perfis <strong>ADMIN (Contador/Sócio)</strong> ou do departamento <strong>FINANCEIRO</strong> têm acesso ao módulo de Honorários.
          </p>
        </div>
      `;
    }

    const comp = appState.competencia;
    const sub = db.obterMesSubsequente(comp);
    const compAnt = db.obterCompetenciaAnterior(comp);

    db.sincronizarSaldosAnterioresHonorarios(comp);

    const listaHonBase = db.data.honorarios.filter(h => h.competencia === comp);
    const fBuscaHon = String(appState.filtroHonorarioBusca || '').toLowerCase().trim();
    const fBuscaHonNum = fBuscaHon.replace(/\D/g, '');
    const fStatusHon = appState.filtroHonorarioStatus || 'TODOS';
    const fTipoHon = appState.filtroHonorarioTipo || 'TODOS';
    const fVencHon = appState.filtroHonorarioVencimento || 'TODOS';
    const fCanalHon = appState.filtroHonorarioCanal || 'TODOS';
    const fPrefHon = appState.filtroHonorarioPreferencia || 'TODOS';
    const temFiltroHonAtivo = Boolean(fBuscaHon || fStatusHon !== 'TODOS' || fTipoHon !== 'TODOS' || fVencHon !== 'TODOS' || fCanalHon !== 'TODOS' || fPrefHon !== 'TODOS');

    const qtdAtrasadosBase = listaHonBase.filter(h => h.status === 'ATRASADO').length;
    const qtdAbertosBase = listaHonBase.filter(h => h.status === 'ABERTO' || h.status === 'PARCIAL').length;
    const qtdPagosBase = listaHonBase.filter(h => h.status === 'PAGO').length;

    const listaHon = listaHonBase.filter(h => {
      const emp = h.empresa_id ? this.obterEmp(db, h.empresa_id, h) : null;
      if (fBuscaHon) {
        const cod = emp ? this.codLimpo(emp.codigo_interno).toLowerCase() : '';
        const razao = emp ? String(emp.razao_social || '').toLowerCase() : String(h.nome_cliente || '').toLowerCase();
        const fantasia = emp ? String(emp.nome_fantasia || '').toLowerCase() : '';
        const cnpjFmt = emp ? String(emp.cnpj || '').toLowerCase() : String(h.documento_cliente || '').toLowerCase();
        const descCob = String(h.descricao_cobranca || '').toLowerCase();
        const cnpjNum = cnpjFmt.replace(/\D/g, '');
        const matchTexto = cod.includes(fBuscaHon) || razao.includes(fBuscaHon) || fantasia.includes(fBuscaHon) || cnpjFmt.includes(fBuscaHon) || descCob.includes(fBuscaHon);
        const matchNum = fBuscaHonNum.length >= 2 && (cnpjNum.includes(fBuscaHonNum) || cod === fBuscaHonNum);
        if (!matchTexto && !matchNum) return false;
      }
      if (fTipoHon !== 'TODOS') {
        const tpLanc = h.tipo_lancamento || 'MENSAL';
        if (fTipoHon !== tpLanc) return false;
      }
      if (fStatusHon !== 'TODOS') {
        if (fStatusHon === 'PENDENTES') {
          if (!['ABERTO', 'ATRASADO', 'PARCIAL'].includes(h.status) || Number(h.saldo_aberto || 0) <= 0) return false;
        } else if (fStatusHon === 'COM_SALDO_ANT') {
          if (Number(h.saldo_anterior || 0) <= 0) return false;
        } else if (h.status !== fStatusHon) {
          return false;
        }
      }
      if (fVencHon !== 'TODOS') {
        const diaStr = String(h.data_vencimento || '').slice(-2);
        const diaBase = Number(h.dia_base_vencimento || (emp && emp.dia_vencimento_honorario) || diaStr);
        if (fVencHon === 'DIA_10' && diaBase !== 10 && diaStr !== '10') return false;
        if (fVencHon === 'DIA_20' && diaBase !== 20 && diaStr !== '20') return false;
        if (fVencHon === 'OUTROS' && (diaBase === 10 || diaBase === 20 || diaStr === '10' || diaStr === '20')) return false;
      }
      if (fCanalHon !== 'TODOS') {
        const canalEmp = h.canal_pagamento || (emp && emp.canal_pagamento_padrao) || 'PIX_PRINCIPAL';
        if (canalEmp !== fCanalHon) return false;
      }
      if (fPrefHon !== 'TODOS' && db.ehOperadorInterno && db.ehOperadorInterno()) {
        const pref = emp ? db.obterPreferenciaEnvioEmpresa(emp, comp) : null;
        const canalPref = pref ? pref.canal : 'NAO_DEFINIDO';
        if (canalPref !== fPrefHon) return false;
      }
      return true;
    });

    const totalSaldoAnteriorTransportado = listaHon.reduce((acc, h) => acc + Number(h.saldo_anterior || 0), 0);
    const totalContratado = listaHon.reduce((acc, h) => acc + Math.max(0, Number(h.valor_mensal) + Number(h.saldo_anterior || 0) + Number(h.servicos_extras) - Number(h.desconto)), 0);
    const totalRecebidoMes = listaHon.reduce((acc, h) => acc + Number(h.valor_pago), 0);
    const totalSaldoAberto = listaHon.reduce((acc, h) => acc + Number(h.saldo_aberto), 0);

    const statusHonBadge = (st) => {
      const map = {
        PAGO: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        PARCIAL: 'bg-amber-100 text-amber-800 border-amber-300',
        ABERTO: 'bg-sky-100 text-sky-800 border-sky-200',
        ATRASADO: 'bg-rose-100 text-rose-800 border-rose-200'
      };
      const labels = {
        PAGO: 'Quitado',
        PARCIAL: 'Parcial',
        ABERTO: 'Em Aberto',
        ATRASADO: 'Em Atraso'
      };
      return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${map[st] || map.ABERTO}">${labels[st] || st}</span>`;
    };

    return `
      <div class="space-y-4">
        <!-- Cabeçalho -->
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <div class="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-600 mb-0.5">
              <i data-lucide="wallet" class="w-4 h-4"></i> Competência ${comp} → Vencimento dos Honorários em ${sub.label}
            </div>
            <h1 class="text-lg font-bold text-slate-900">Honorários Contábeis & Cobrança (Comp. ${comp})</h1>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button onclick="ZGestorApp.navigate('escritorio')" class="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-semibold text-xs flex items-center gap-1.5 border border-indigo-200 shadow-xs" title="Cadastrar dados oficiais do escritório e anexar QR Code real">
              <i data-lucide="landmark" class="w-3.5 h-3.5 text-indigo-600"></i> Dados do Escritório & QR Codes
            </button>
            <button onclick="ZGestorApp.openModalConfigPix()" class="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs">
              <i data-lucide="qr-code" class="w-3.5 h-3.5 text-emerald-600"></i> Configurar PIX & Anexar QR Code
            </button>
            <button onclick="ZGestorReports.emitirRelatorioNFSe('${comp}')" class="px-3 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm">
              <i data-lucide="file-spreadsheet" class="w-3.5 h-3.5"></i> Relatório para Emissão de NFS-e
            </button>
            <button onclick="ZGestorReports.imprimirLoteRecibosPixMes('${comp}', ${temFiltroHonAtivo ? JSON.stringify(listaHon.map(h => h.id)).replace(/"/g, "'") : 'null'})" class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm">
              <i data-lucide="printer" class="w-3.5 h-3.5"></i> ${temFiltroHonAtivo ? `Imprimir Recibos Filtrados (${comp})` : `Imprimir Todos Recibos PIX (${comp})`}
            </button>
            <button onclick="ZGestorReports.emitirRelatorioAba('honorarios', ZGestorApp.state)" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm">
              <i data-lucide="file-text" class="w-3.5 h-3.5"></i> Relatório Financeiro
            </button>
            <button onclick="ZGestorApp.openModalHonorarioAvulso()" class="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer" title="Lançar recibo ou cobrança avulsa para empresa pendente/cadastrada ou cliente avulso">
              <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i> + Cobrança / Recibo Avulso
            </button>
            <button onclick="ZGestorApp.openModalHonorario13()" class="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer" title="Gerar 13º Honorário em 2 parcelas (1ª Dezembro e 2ª Janeiro)">
              <i data-lucide="calendar-plus" class="w-3.5 h-3.5"></i> + 13º Honorário (Dez/Jan)
            </button>
            <button onclick="ZGestorApp.gerarHonorariosMesAtual()" class="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer">
              <i data-lucide="sparkles" class="w-3.5 h-3.5"></i> Gerar Honorários ${comp}
            </button>
          </div>
        </div>

        <!-- Resumo Financeiro -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span class="text-[11px] font-bold uppercase text-slate-500">Total a Cobrar (${comp})</span>
            <div class="text-xl font-extrabold text-slate-900 mt-1">${this.formatCurrency(totalContratado)}</div>
            <p class="text-[11px] text-slate-500">Mensal + Saldo Ant. + Extras - Desc.</p>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm">
            <span class="text-[11px] font-bold uppercase text-amber-800">Saldo Vindo de ${compAnt}</span>
            <div class="text-xl font-extrabold text-amber-600 mt-1">+ ${this.formatCurrency(totalSaldoAnteriorTransportado)}</div>
            <p class="text-[11px] text-slate-500">Complemento automático</p>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm">
            <span class="text-[11px] font-bold uppercase text-emerald-700">Total Pago no Mês</span>
            <div class="text-xl font-extrabold text-emerald-600 mt-1">${this.formatCurrency(totalRecebidoMes)}</div>
            <p class="text-[11px] text-slate-500">Pagamentos recebidos</p>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-rose-200 shadow-sm">
            <span class="text-[11px] font-bold uppercase text-rose-700">Restante em Aberto</span>
            <div class="text-xl font-extrabold text-rose-600 mt-1">${this.formatCurrency(totalSaldoAberto)}</div>
            <p class="text-[11px] text-slate-500">${temFiltroHonAtivo ? `Soma dos ${listaHon.length} registros filtrados` : 'Passa p/ próxima competência'}</p>
          </div>
        </div>

        <!-- Barra Prática de Filtros de Honorários & Cobrança -->
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex flex-wrap items-center gap-1.5 text-xs">
              <button type="button" onclick="ZGestorApp.setFiltro('filtroHonorarioStatus', 'TODOS')" class="px-3 py-1 rounded-full font-bold border transition cursor-pointer ${fStatusHon === 'TODOS' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'}">
                Todos (${listaHonBase.length})
              </button>
              <button type="button" onclick="ZGestorApp.setFiltro('filtroHonorarioStatus', 'PENDENTES')" class="px-3 py-1 rounded-full font-bold border transition cursor-pointer ${fStatusHon === 'PENDENTES' ? 'bg-amber-600 text-white border-amber-600' : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'}">
                Pendentes de Recebimento (${qtdAtrasadosBase + qtdAbertosBase})
              </button>
              <button type="button" onclick="ZGestorApp.setFiltro('filtroHonorarioStatus', 'ATRASADO')" class="px-3 py-1 rounded-full font-bold border transition cursor-pointer ${fStatusHon === 'ATRASADO' ? 'bg-rose-600 text-white border-rose-600' : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'}">
                Em Atraso (${qtdAtrasadosBase})
              </button>
              <button type="button" onclick="ZGestorApp.setFiltro('filtroHonorarioStatus', 'ABERTO')" class="px-3 py-1 rounded-full font-bold border transition cursor-pointer ${fStatusHon === 'ABERTO' ? 'bg-sky-600 text-white border-sky-600' : 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100'}">
                Em Aberto (${qtdAbertosBase})
              </button>
              <button type="button" onclick="ZGestorApp.setFiltro('filtroHonorarioStatus', 'PAGO')" class="px-3 py-1 rounded-full font-bold border transition cursor-pointer ${fStatusHon === 'PAGO' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'}">
                Quitados (${qtdPagosBase})
              </button>
            </div>
            <div class="flex items-center gap-2 text-xs">
              <span class="text-[11px] font-semibold text-slate-500">
                Exibindo <strong>${listaHon.length}</strong> de <strong>${listaHonBase.length}</strong> lançamento(s)
              </span>
              ${temFiltroHonAtivo ? `
                <button type="button" onclick="ZGestorApp.limparFiltrosHonorarios()" class="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] cursor-pointer">
                  ✕ Limpar Filtros
                </button>
              ` : ''}
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
            <div>
              <label class="block text-[10px] font-bold uppercase text-slate-500 mb-1">Buscar Cliente, Código ou CNPJ</label>
              <input
                type="text"
                id="input-filtro-honorario-busca"
                value="${this.escapeHtml(appState.filtroHonorarioBusca || '')}"
                oninput="ZGestorApp.setFiltro('filtroHonorarioBusca', this.value)"
                placeholder="Ex: 625, Razão, Avulso..."
                class="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label class="block text-[10px] font-bold uppercase text-slate-500 mb-1">Tipo de Lançamento</label>
              <select onchange="ZGestorApp.setFiltro('filtroHonorarioTipo', this.value)" class="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-800 bg-white">
                <option value="TODOS" ${fTipoHon === 'TODOS' ? 'selected' : ''}>Todos os Tipos</option>
                <option value="MENSAL" ${fTipoHon === 'MENSAL' ? 'selected' : ''}>📄 Honorário Mensal</option>
                <option value="DECIMO_TERCEIRO" ${fTipoHon === 'DECIMO_TERCEIRO' ? 'selected' : ''}>🎄 13º Honorário (Dez/Jan)</option>
                <option value="AVULSO" ${fTipoHon === 'AVULSO' ? 'selected' : ''}>⚡ Cobrança / Recibo Avulso</option>
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-bold uppercase text-slate-500 mb-1">Status de Cobrança</label>
              <select onchange="ZGestorApp.setFiltro('filtroHonorarioStatus', this.value)" class="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-800 bg-white">
                <option value="TODOS" ${fStatusHon === 'TODOS' ? 'selected' : ''}>Todos os Status</option>
                <option value="PENDENTES" ${fStatusHon === 'PENDENTES' ? 'selected' : ''}>⏳ Todos Pendentes (Aberto + Atraso)</option>
                <option value="ATRASADO" ${fStatusHon === 'ATRASADO' ? 'selected' : ''}>🔴 Em Atraso</option>
                <option value="ABERTO" ${fStatusHon === 'ABERTO' ? 'selected' : ''}>🔵 Em Aberto</option>
                <option value="PARCIAL" ${fStatusHon === 'PARCIAL' ? 'selected' : ''}>🟡 Pago Parcial</option>
                <option value="PAGO" ${fStatusHon === 'PAGO' ? 'selected' : ''}>🟢 Pago / Quitado</option>
                <option value="COM_SALDO_ANT" ${fStatusHon === 'COM_SALDO_ANT' ? 'selected' : ''}>🟠 Com Saldo Mês Anterior</option>
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-bold uppercase text-slate-500 mb-1">Dia de Vencimento</label>
              <select onchange="ZGestorApp.setFiltro('filtroHonorarioVencimento', this.value)" class="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-800 bg-white">
                <option value="TODOS" ${fVencHon === 'TODOS' ? 'selected' : ''}>Todos os Vencimentos</option>
                <option value="DIA_10" ${fVencHon === 'DIA_10' ? 'selected' : ''}>Dia 10/${sub.label} (ou prorrog.)</option>
                <option value="DIA_20" ${fVencHon === 'DIA_20' ? 'selected' : ''}>Dia 20/${sub.label} (ou prorrog.)</option>
                <option value="OUTROS" ${fVencHon === 'OUTROS' ? 'selected' : ''}>Outros Dias</option>
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-bold uppercase text-slate-500 mb-1">Canal de Recebimento (PIX)</label>
              <select onchange="ZGestorApp.setFiltro('filtroHonorarioCanal', this.value)" class="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-800 bg-white">
                <option value="TODOS" ${fCanalHon === 'TODOS' ? 'selected' : ''}>Todos os Canais</option>
                <option value="PIX_PRINCIPAL" ${fCanalHon === 'PIX_PRINCIPAL' ? 'selected' : ''}>PIX Principal (Conta PJ)</option>
                <option value="PIX_SECUNDARIO" ${fCanalHon === 'PIX_SECUNDARIO' ? 'selected' : ''}>PIX Secundário</option>
                <option value="PIX_AUTONOMO" ${fCanalHon === 'PIX_AUTONOMO' ? 'selected' : ''}>PIX Autônomo</option>
                <option value="DINHEIRO" ${fCanalHon === 'DINHEIRO' ? 'selected' : ''}>Dinheiro</option>
              </select>
            </div>
            ${db.ehOperadorInterno && db.ehOperadorInterno() ? `
              <div>
                <label class="block text-[10px] font-bold uppercase text-indigo-700 mb-1">Preferência de Envio (Operador)</label>
                <select onchange="ZGestorApp.setFiltro('filtroHonorarioPreferencia', this.value)" class="w-full rounded-xl border border-indigo-200 bg-indigo-50/30 px-2.5 py-1.5 text-xs font-semibold text-slate-800">
                  <option value="TODOS" ${fPrefHon === 'TODOS' ? 'selected' : ''}>Todas as Preferências</option>
                  <option value="IMPRESSO" ${fPrefHon === 'IMPRESSO' ? 'selected' : ''}>🖨️ Prefere Impresso</option>
                  <option value="WHATSAPP" ${fPrefHon === 'WHATSAPP' ? 'selected' : ''}>💬 Prefere WhatsApp</option>
                  <option value="EMAIL" ${fPrefHon === 'EMAIL' ? 'selected' : ''}>✉️ Prefere E-mail</option>
                  <option value="NAO_DEFINIDO" ${fPrefHon === 'NAO_DEFINIDO' ? 'selected' : ''}>⚪ Sem preferência definida</option>
                </select>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Tabela Principal de Honorários (Responsiva com rolagem horizontal) -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="overflow-x-auto w-full">
            <table class="w-full min-w-[820px] text-left border-collapse">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                <th class="py-3 px-3 w-[20%]">Cliente & Vencimento</th>
                <th class="py-3 px-2.5 w-[15%]">Mensal & Extras</th>
                <th class="py-3 px-2.5 w-[14%]">Saldo Mês Ant.</th>
                <th class="py-3 px-2.5 w-[13%]">Total a Pagar</th>
                <th class="py-3 px-2.5 w-[14%]">Pagamentos</th>
                <th class="py-3 px-2.5 w-[11%]">Em Aberto</th>
                <th class="py-3 px-3 w-[13%] text-right">Recibo PIX & Ações</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-xs">
              ${listaHon.length === 0 ? `
                <tr>
                  <td colspan="7" class="py-8 text-center text-slate-400">
                    Nenhum lançamento de honorário encontrado para os filtros aplicados.
                  </td>
                </tr>
              ` : (() => {
      const pagsPorHon = new Map();
      const todosPags = db.data.honorario_pagamentos || [];
      for (let i = 0; i < todosPags.length; i++) {
        const pg = todosPags[i];
        if (!pg || !pg.honorario_id) continue;
        let arrPg = pagsPorHon.get(pg.honorario_id);
        if (!arrPg) {
          arrPg = [];
          pagsPorHon.set(pg.honorario_id, arrPg);
        }
        arrPg.push(pg);
      }
      const svgPrint = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>';
      const svgSliders = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/></svg>';
      const svgTrashHon = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>';

      return listaHon.map(h => {
        const emp = h.empresa_id ? this.obterEmp(db, h.empresa_id, h) : null;
        const codHon = emp ? this.codLimpo(emp.codigo_interno) : '';
        const pags = pagsPorHon.get(h.id) || [];
        const saldoAnt = Number(h.saldo_anterior || 0);
        const compRefAnt = h.competencia_saldo_anterior || compAnt;
        const totalLiquido = Math.max(0, Number(h.valor_mensal) + saldoAnt + Number(h.servicos_extras) - Number(h.desconto));
        const tpLanc = h.tipo_lancamento || 'MENSAL';
        const docLinha = emp ? emp.cnpj : (h.documento_cliente || '');
        return `
                  <tr class="hover:bg-slate-50 ${saldoAnt > 0 ? 'bg-amber-50/20' : tpLanc === 'DECIMO_TERCEIRO' ? 'bg-rose-50/20' : ''}">
                    <td class="py-3 px-3">
                      <div class="font-bold text-slate-900 flex flex-wrap items-center gap-1">
                        ${codHon ? `<span class="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 font-mono text-[10px] font-extrabold">${this.escapeHtml(codHon)}</span>` : ''}
                        ${h.cliente_avulso ? `<span class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[9.5px] font-extrabold">Não Cliente</span>` : ''}
                        ${tpLanc === 'AVULSO' && !h.cliente_avulso ? `<span class="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[9.5px] font-extrabold">Avulso</span>` : ''}
                        ${tpLanc === 'DECIMO_TERCEIRO' ? `<span class="px-1.5 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300 text-[9.5px] font-extrabold">🎄 13º (${h.parcela_13 || 1}/${h.total_parcelas_13 || 2})</span>` : ''}
                        <span>${this.escapeHtml(emp ? this.nomeEmp(emp, { fallbackObj: h }) : (h.nome_cliente || 'Cliente Avulso'))}</span>
                      </div>
                      ${docLinha ? `<div class="text-[10px] text-slate-500 font-mono mt-0.5">${this.escapeHtml(docLinha)}</div>` : ''}
                      ${h.descricao_cobranca && h.descricao_cobranca !== 'HONORÁRIO MENSAL' ? `<div class="text-[10.5px] font-bold text-slate-700 mt-0.5">${this.escapeHtml(h.descricao_cobranca)}${h.competencia_referencia && h.competencia_referencia !== h.competencia ? ` (Ref. ${this.escapeHtml(h.competencia_referencia)})` : ''}</div>` : (h.competencia_referencia && h.competencia_referencia !== h.competencia ? `<div class="text-[10.5px] font-bold text-amber-800 mt-0.5">Ref. Competência ${this.escapeHtml(h.competencia_referencia)}</div>` : '')}
                      <div class="text-[11px] text-indigo-700 font-semibold">Venc: ${this.formatDate(h.data_vencimento)}</div>
                      <div class="mt-1 flex flex-wrap items-center gap-1">
                        ${(() => {
                          const c = h.canal_pagamento || (emp && emp.canal_pagamento_padrao) || 'PIX_PRINCIPAL';
                          const map = {
                            PIX_PRINCIPAL: { label: 'PIX Principal', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
                            PIX_SECUNDARIO: { label: 'PIX Secundário', cls: 'bg-blue-50 text-blue-800 border-blue-200' },
                            PIX_AUTONOMO: { label: 'PIX Autônomo', cls: 'bg-purple-50 text-purple-800 border-purple-200' },
                            DINHEIRO: { label: 'Dinheiro', cls: 'bg-amber-50 text-amber-800 border-amber-200' }
                          };
                          const item = map[c] || map.PIX_PRINCIPAL;
                          return `<span class="inline-flex items-center px-1.5 py-0.2 rounded text-[9.5px] font-bold border ${item.cls}" title="Canal de Recebimento">${item.label}</span>`;
                        })()}
                        ${emp ? this.renderBadgePreferenciaEnvio(emp, comp, true) : (h.contato_cliente && db.ehOperadorInterno && db.ehOperadorInterno() ? `<span class="text-[10px] text-slate-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-medium">Contato: ${this.escapeHtml(h.contato_cliente)}</span>` : '')}
                      </div>
                      ${h.observacoes ? `<div class="text-[10px] text-slate-500 mt-0.5 italic">"${this.escapeHtml(h.observacoes)}"</div>` : ''}
                    </td>
                    <td class="py-3 px-2.5">
                      <div class="font-bold text-slate-800">${this.formatCurrency(h.valor_mensal)}</div>
                      ${Number(h.servicos_extras) > 0 ? `<div class="text-[11px] text-indigo-700">+ ${this.formatCurrency(h.servicos_extras)} extra</div>` : ''}
                      ${Number(h.desconto) > 0 ? `<div class="text-[11px] text-amber-700">- ${this.formatCurrency(h.desconto)} desc.</div>` : ''}
                    </td>
                    <td class="py-3 px-2.5">
                      ${saldoAnt > 0 ? `
                        <div class="font-extrabold text-amber-800">+ ${this.formatCurrency(saldoAnt)}</div>
                        <span class="text-[10px] font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded">De ${compRefAnt}</span>
                      ` : `<span class="text-slate-400">R$ 0,00</span>`}
                    </td>
                    <td class="py-3 px-2.5 font-extrabold text-slate-900">
                      ${this.formatCurrency(totalLiquido)}
                    </td>
                    <td class="py-3 px-2.5">
                      <div class="font-bold text-emerald-700">${this.formatCurrency(h.valor_pago)}</div>
                      ${pags.map(p => `
                        <div class="flex items-center justify-between gap-1 text-[10px] bg-emerald-50 text-emerald-900 px-1.5 py-0.5 rounded border border-emerald-200 mt-0.5" title="${p.conta_destino || 'Conta PJ Principal (Itaú)'} • ${p.forma_pagamento}">
                          <span class="truncate">${this.formatDate(p.data_pagamento)}: ${this.formatCurrency(p.valor)} <span class="text-[9px] text-emerald-700 font-bold">(${p.conta_destino ? p.conta_destino.split('(')[0].trim() : 'Conta PJ'})</span></span>
                          <button onclick="ZGestorApp.estornarPagamento('${p.id}')" class="text-rose-600 font-bold hover:text-rose-800" title="Estornar">×</button>
                        </div>
                      `).join('')}
                    </td>
                    <td class="py-3 px-2.5">
                      <div class="font-extrabold ${Number(h.saldo_aberto) > 0 ? 'text-rose-600' : 'text-emerald-600'}">
                        ${this.formatCurrency(h.saldo_aberto)}
                      </div>
                      <div class="mt-0.5">${statusHonBadge(h.status)}</div>
                    </td>
                    <td class="py-3 px-3 text-right">
                      <div class="inline-flex flex-wrap items-center justify-end gap-1">
                        <button onclick="ZGestorReports.imprimirReciboHonorarioPix('${h.id}')" class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-semibold inline-flex items-center gap-1">
                          ${svgPrint} PIX
                        </button>
                        ${Number(h.saldo_aberto) > 0 ? `
                          <button onclick="ZGestorApp.openModalPagamentoHonorario('${h.id}')" class="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold">
                            Baixar
                          </button>
                        ` : ''}
                        <button onclick="ZGestorApp.openModalEditarHonorario('${h.id}')" class="p-1 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 cursor-pointer" title="Ajustar">
                          ${svgSliders}
                        </button>
                        ${Number(h.valor_pago || 0) <= 0 ? `
                          <button onclick="ZGestorApp.excluirHonorarioConfirmado('${h.id}')" class="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer" title="Excluir lançamento">
                            ${svgTrashHon}
                          </button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `;
      }).join('');
    })()}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    `;
  },

  // ===========================================================================
  // 9. USUÁRIOS, POLÍTICAS DE SEGURANÇA (RLS) E CONEXÃO SUPABASE
  // ===========================================================================
  renderSeguranca(appState) {
    const db = window.zgestorDB;
    const user = db.getCurrentUser();
    const cfg = db.supabaseConfig || {};
    const subTab = appState.subTabSeguranca || 'colaboradores'; // 'colaboradores' | 'clientes' | 'convites'

    // SEGURANÇA: Apenas Administrador tem permissão para visualizar e gerenciar este módulo
    if (!user || user.cargo !== 'ADMIN') {
      return `
        <div class="p-8 bg-white rounded-2xl border border-slate-200 text-center max-w-lg mx-auto my-12 shadow-sm">
          <div class="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-200">
            <i data-lucide="shield-alert" class="w-7 h-7"></i>
          </div>
          <h2 class="text-base font-bold text-slate-900 mb-1">Acesso Restrito ao Administrador</h2>
          <p class="text-xs text-slate-500 mb-6 leading-relaxed">
            Apenas usuários com perfil de Administrador têm autorização para gerenciar colaboradores, permissões de acesso e convites do escritório.
          </p>
          <button onclick="ZGestorApp.navigate('dashboard')" class="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition shadow-sm">
            Voltar para a Visão Geral
          </button>
        </div>
      `;
    }

    const todosProfiles = db.data.profiles || [];
    const colaboradores = todosProfiles.filter(p => p.cargo !== 'CLIENTE');
    const clientes = todosProfiles.filter(p => p.cargo === 'CLIENTE');
    const convites = db.data.convites || [];
    const convitesPendentes = convites.filter(c => c.status === 'PENDENTE');

    return `
      <div class="space-y-4">
        <!-- Topo com Título e Ações Administrativas -->
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <div class="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 mb-0.5">
              <i data-lucide="shield-check" class="w-4 h-4"></i> Governança, Controle de Acesso & RLS
            </div>
            <h1 class="text-lg font-bold text-slate-900">Gestão de Usuários, Convites e Permissões</h1>
            <p class="text-xs text-slate-500">
              Gerencie colaboradores da equipe, envie convites de cadastro, edite permissões e controle os acessos de clientes ao Portal com segurança de nível de linha (RLS).
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button onclick="ZGestorReports.emitirRelatorioAba('seguranca', ZGestorApp.state)" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm">
              <i data-lucide="printer" class="w-3.5 h-3.5"></i> Relatório de Auditoria
            </button>
            <button onclick="ZGestorApp.openModalNovoConvite()" class="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm">
              <i data-lucide="user-plus" class="w-3.5 h-3.5"></i> + Convidar Usuário / Criar Acesso
            </button>
          </div>
        </div>

        <!-- Barra de Sub-Abas -->
        <div class="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs text-xs font-bold">
          <button
            onclick="ZGestorApp.setFiltro('subTabSeguranca', 'colaboradores')"
            class="px-4 py-2 rounded-xl flex items-center gap-2 transition ${subTab === 'colaboradores' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}">
            <i data-lucide="users" class="w-4 h-4"></i>
            <span>Equipe & Colaboradores</span>
            <span class="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${subTab === 'colaboradores' ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-700'}">
              ${colaboradores.length}
            </span>
          </button>

          <button
            onclick="ZGestorApp.setFiltro('subTabSeguranca', 'clientes')"
            class="px-4 py-2 rounded-xl flex items-center gap-2 transition ${subTab === 'clientes' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}">
            <i data-lucide="globe" class="w-4 h-4"></i>
            <span>Clientes do Portal (RLS)</span>
            <span class="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${subTab === 'clientes' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700'}">
              ${clientes.length}
            </span>
          </button>

          <button
            onclick="ZGestorApp.setFiltro('subTabSeguranca', 'convites')"
            class="px-4 py-2 rounded-xl flex items-center gap-2 transition ${subTab === 'convites' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}">
            <i data-lucide="mail" class="w-4 h-4"></i>
            <span>Convites Enviados & Links</span>
            ${convitesPendentes.length > 0 ? `
              <span class="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400 text-amber-950">
                ${convitesPendentes.length} pendente${convitesPendentes.length > 1 ? 's' : ''}
              </span>
            ` : `
              <span class="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700">
                ${convites.length}
              </span>
            `}
          </button>
        </div>

        <!-- CONTEÚDO DA SUB-ABA ATIVA -->
        ${subTab === 'colaboradores' ? `
          <!-- TAB 1: COLABORADORES DA EQUIPE -->
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 class="text-sm font-bold text-slate-900">Funcionários e Administradores do Escritório</h2>
                <p class="text-xs text-slate-500">Configure as permissões de acesso por setor de cada membro da equipe.</p>
              </div>
            </div>

            <div class="overflow-x-auto w-full">
              <table class="w-full min-w-[650px] text-left border-collapse">
                <thead>
                  <tr class="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                    <th class="py-2.5 px-3">Colaborador</th>
                    <th class="py-2.5 px-2.5">Cargo & Setor</th>
                    <th class="py-2.5 px-2.5">Módulos Liberados</th>
                    <th class="py-2.5 px-2.5 text-center">Status</th>
                    <th class="py-2.5 px-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 text-xs">
                  ${colaboradores.map(p => {
      const isAtivoSession = p.id === user.id;
      const perms = p.permissoes || {};
      const modulosAtivos = [];
      if (perms.dashboard !== false) modulosAtivos.push('Dashboard');
      if (perms.tarefas !== false) modulosAtivos.push('Tarefas');
      if (perms.guias !== false) modulosAtivos.push('Guias');
      if (perms.parcelamentos) modulosAtivos.push('Parcelamentos');
      if (perms.cnds !== false) modulosAtivos.push('CNDs');
      if (perms.empresas) modulosAtivos.push('Empresas');
      if (perms.honorarios) modulosAtivos.push('Honorários');

      return `
                      <tr class="${isAtivoSession ? 'bg-indigo-50/60' : 'hover:bg-slate-50'}">
                        <td class="py-3 px-3">
                          <div class="flex items-center gap-2.5">
                            <div class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center text-xs shrink-0">
                              ${p.nome.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div class="font-bold text-slate-900 flex items-center gap-1.5">
                                <span>${p.nome}</span>
                                ${isAtivoSession ? '<span class="text-[9px] bg-indigo-600 text-white px-1.5 py-0.2 rounded-full font-bold">Você</span>' : ''}
                              </div>
                              <div class="text-[11px] text-slate-500">${p.email}</div>
                            </div>
                          </div>
                        </td>
                        <td class="py-3 px-2.5">
                          <div class="font-bold ${p.cargo === 'ADMIN' ? 'text-indigo-950 font-black' : 'text-slate-700'}">
                            ${p.cargo === 'ADMIN' ? '👑 Administrador' : (p.cargo === 'SUPERVISOR' ? '⭐ Supervisor' : '👤 Colaborador')}
                          </div>
                          <div class="mt-0.5">${this.deptBadge(p.departamento)}</div>
                        </td>
                        <td class="py-3 px-2.5">
                          <div class="flex flex-wrap gap-1 max-w-xs">
                            ${p.cargo === 'ADMIN' ? `
                              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                                🌐 Acesso Total Irrestrito
                              </span>
                            ` : modulosAtivos.map(m => `
                              <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                ${m}
                              </span>
                            `).join('')}
                          </div>
                        </td>
                        <td class="py-3 px-2.5 text-center">
                          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${p.ativo ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}">
                            <span class="w-1.5 h-1.5 rounded-full ${p.ativo ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
                            ${p.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td class="py-3 px-3 text-right">
                          <div class="inline-flex items-center gap-1.5 justify-end">
                            <button
                              onclick="ZGestorApp.openModalEditarPermissoes('${p.id}')"
                              class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition"
                              title="Editar permissões de acesso deste colaborador">
                              Editar
                            </button>
                            ${!isAtivoSession ? `
                              <button
                                onclick="ZGestorApp.trocarUsuarioSessao('${p.id}')"
                                class="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold transition"
                                title="Simular visão do sistema com o perfil deste usuário">
                                Testar RLS
                              </button>
                              <button
                                onclick="ZGestorApp.toggleStatusUsuario('${p.id}')"
                                class="px-2 py-1 rounded-lg text-[11px] font-bold transition ${p.ativo ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-700 hover:bg-emerald-50'}"
                                title="${p.ativo ? 'Desativar usuário' : 'Ativar usuário'}">
                                ${p.ativo ? 'Desativar' : 'Ativar'}
                              </button>
                            ` : ''}
                          </div>
                        </td>
                      </tr>
                    `;
    }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : subTab === 'clientes' ? `
          <!-- TAB 2: CLIENTES DO PORTAL COM RLS BLINDADO -->
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="p-3.5 bg-emerald-50/60 border-b border-emerald-200 flex items-center justify-between">
              <div>
                <div class="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                  <i data-lucide="shield-check" class="w-4 h-4 text-emerald-600"></i>
                  Isolamento Total de Dados no Portal do Cliente (Row-Level Security)
                </div>
                <p class="text-xs text-slate-600 mt-0.5">
                  Cada cliente acessa apenas e exclusivamente os dados, guias e documentos vinculados à sua respectiva empresa.
                </p>
              </div>
              <button
                onclick="ZGestorApp.openModalNovoConvite('CLIENTE')"
                class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs">
                <i data-lucide="user-plus" class="w-3.5 h-3.5"></i> + Liberar Acesso para Cliente
              </button>
            </div>

            <div class="overflow-x-auto w-full">
              <table class="w-full min-w-[650px] text-left border-collapse">
                <thead>
                  <tr class="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                    <th class="py-2.5 px-3">Cliente / Contato</th>
                    <th class="py-2.5 px-2.5">Empresa Cliente Vinculada</th>
                    <th class="py-2.5 px-2.5">Módulos do Portal</th>
                    <th class="py-2.5 px-2.5 text-center">Status</th>
                    <th class="py-2.5 px-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 text-xs">
                  ${clientes.length === 0 ? `
                    <tr>
                      <td colspan="5" class="py-8 text-center text-slate-400">
                        Nenhum cliente cadastrado ainda. Clique no botão acima para liberar o primeiro acesso!
                      </td>
                    </tr>
                  ` : clientes.map(cli => {
      const emp = db.data.empresas.find(e => e.id === cli.empresa_id);
      const isAtivoSession = cli.id === user.id;

      return `
                      <tr class="${isAtivoSession ? 'bg-emerald-50/60' : 'hover:bg-slate-50'}">
                        <td class="py-3 px-3">
                          <div class="flex items-center gap-2.5">
                            <div class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-extrabold flex items-center justify-center text-xs shrink-0">
                              ${cli.nome.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div class="font-bold text-slate-900">${cli.nome}</div>
                              <div class="text-[11px] text-slate-500">${cli.email}</div>
                            </div>
                          </div>
                        </td>
                        <td class="py-3 px-2.5">
                          ${emp ? `
                            <div class="font-bold text-slate-900">${this.escapeHtml(this.nomeEmp(emp, { comCodigo: true }))}</div>
                            <div class="text-[10px] text-slate-500 font-mono">${emp.cnpj} • ${emp.regime_tributario}</div>
                          ` : '<span class="italic text-rose-500 font-semibold">Sem empresa vinculada</span>'}
                        </td>
                        <td class="py-3 px-2.5">
                          <div class="flex flex-wrap gap-1 max-w-xs">
                            <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">Guias de Impostos</span>
                            <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">CNDs</span>
                            <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">Parcelamentos</span>
                            <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">Documentos</span>
                          </div>
                        </td>
                        <td class="py-3 px-2.5 text-center">
                          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cli.ativo ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}">
                            <span class="w-1.5 h-1.5 rounded-full ${cli.ativo ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
                            ${cli.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td class="py-3 px-3 text-right">
                          <div class="inline-flex items-center gap-1.5 justify-end">
                            <button
                              onclick="ZGestorApp.iniciarSimulacaoCliente('${cli.id}')"
                              class="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                              title="Testar e simular a visão exclusiva do Portal do Cliente">
                              <i data-lucide="external-link" class="w-3 h-3"></i> Testar Portal
                            </button>
                            <button
                              onclick="ZGestorApp.openModalEditarPermissoes('${cli.id}')"
                              class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition">
                              Editar
                            </button>
                            <button
                              onclick="ZGestorApp.toggleStatusUsuario('${cli.id}')"
                              class="px-2 py-1 rounded-lg text-[11px] font-bold transition ${cli.ativo ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-700 hover:bg-emerald-50'}">
                              ${cli.ativo ? 'Desativar' : 'Ativar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    `;
    }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : `
          <!-- TAB 3: CONVITES ENVIADOS & LINKS DE ATIVAÇÃO -->
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 class="text-sm font-bold text-slate-900">Convites Gerados e Links de Ativação</h2>
                <p class="text-xs text-slate-500">Copie o link de ativação e envie para o colaborador ou cliente concluir o cadastro.</p>
              </div>
              <button
                onclick="ZGestorApp.openModalNovoConvite()"
                class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs">
                <i data-lucide="plus" class="w-3.5 h-3.5"></i> Novo Convite
              </button>
            </div>

            <div class="overflow-x-auto w-full">
              <table class="w-full min-w-[650px] text-left border-collapse">
                <thead>
                  <tr class="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                    <th class="py-2.5 px-3">Destinatário</th>
                    <th class="py-2.5 px-2.5">Tipo & Vínculo</th>
                    <th class="py-2.5 px-2.5">Data & Expiração</th>
                    <th class="py-2.5 px-2.5 text-center">Status</th>
                    <th class="py-2.5 px-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 text-xs">
                  ${convites.length === 0 ? `
                    <tr>
                      <td colspan="5" class="py-8 text-center text-slate-400">
                        Nenhum convite gerado ainda. Clique no botão acima para criar o primeiro!
                      </td>
                    </tr>
                  ` : convites.map(c => {
      const emp = c.empresa_id ? db.data.empresas.find(e => e.id === c.empresa_id) : null;
      const isPendente = c.status === 'PENDENTE';

      return `
                      <tr class="hover:bg-slate-50">
                        <td class="py-3 px-3">
                          <div class="font-bold text-slate-900">${c.nome}</div>
                          <div class="text-[11px] text-slate-500 font-mono">${c.email}</div>
                        </td>
                        <td class="py-3 px-2.5">
                          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${c.tipo === 'CLIENTE' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-indigo-50 text-indigo-800 border border-indigo-200'}">
                            ${c.tipo === 'CLIENTE' ? '🏢 Cliente do Portal' : `👥 Colaborador (${c.departamento})`}
                          </span>
                          ${emp ? `<div class="text-[10px] text-slate-500 font-semibold mt-0.5 truncate">Empresa: ${emp.nome_fantasia}</div>` : ''}
                        </td>
                        <td class="py-3 px-2.5">
                          <div class="text-[11px] text-slate-700">Criado: ${new Date(c.criado_em).toLocaleDateString('pt-BR')}</div>
                          <div class="text-[10px] text-slate-400">Expira: ${new Date(c.expira_em).toLocaleDateString('pt-BR')}</div>
                        </td>
                        <td class="py-3 px-2.5 text-center">
                          <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${c.status === 'PENDENTE' ? 'bg-amber-100 text-amber-800 border border-amber-200' : (c.status === 'ACEITO' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-500')}">
                            ${c.status === 'PENDENTE' ? '⏳ Pendente' : (c.status === 'ACEITO' ? '✓ Aceito' : '✕ Revogado')}
                          </span>
                        </td>
                        <td class="py-3 px-3 text-right">
                          <div class="inline-flex items-center gap-1.5 justify-end">
                            ${isPendente ? `
                              <button
                                onclick="ZGestorApp.copiarLinkConvite('${c.token}')"
                                class="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold transition flex items-center gap-1"
                                title="Copiar link de convite com token">
                                <i data-lucide="copy" class="w-3 h-3"></i> Copiar Link
                              </button>
                              <button
                                onclick="ZGestorApp.abrirTelaAtivacaoConta('${c.token}')"
                                class="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold transition flex items-center gap-1"
                                title="Cadastrar nova senha e ativar esta conta">
                                <i data-lucide="key" class="w-3 h-3"></i> Ativar Conta
                              </button>
                              <button
                                onclick="ZGestorApp.revogarConvite('${c.id}')"
                                class="px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 text-[11px] font-bold transition"
                                title="Revogar este convite">
                                Revogar
                              </button>
                            ` : `
                              <span class="text-[11px] text-slate-400 italic">Concluído</span>
                            `}
                          </div>
                        </td>
                      </tr>
                    `;
    }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `}

        <!-- Painel Retrátil de Integração Supabase & Backup -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-xs">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200">
            <div class="font-bold text-slate-900 flex items-center gap-1.5">
              <i data-lucide="database" class="w-4 h-4 text-slate-600"></i>
              Integração com Supabase (PostgreSQL Nuvem) & Backup
            </div>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${db.statusNuvem === 'CONECTADO' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : db.statusNuvem === 'ERRO' ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-amber-100 text-amber-800 border border-amber-300'}">
              ${db.statusNuvem === 'CONECTADO' ? '🟢 Nuvem Ativa' : db.statusNuvem === 'ERRO' ? '🔴 Verifique o SQL no Supabase' : (db.supabaseConnected ? '🟡 Pronto p/ Sincronizar' : '⚪ Modo Local')}
            </span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div>
              <label class="block font-semibold text-slate-700 mb-0.5">Project URL do Supabase</label>
              <input id="cfg-supa-url" type="text" value="${cfg.url || ''}" placeholder="https://seu-projeto.supabase.co" class="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs" />
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-0.5">Anon / Public Key</label>
              <input id="cfg-supa-key" type="password" value="${cfg.anonKey || ''}" placeholder="eyJhbGciOiJIUzI1NiIsInR5..." class="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs" />
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2 pt-3">
            <button onclick="ZGestorApp.salvarConfigSupabase()" class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-2xs cursor-pointer">
              Salvar & Conectar
            </button>
            <button onclick="ZGestorApp.enviarTudoParaNuvem()" class="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-2xs cursor-pointer">
              ⬆ Enviar Dados Locais p/ Nuvem
            </button>
            <button onclick="ZGestorApp.baixarTudoDaNuvem()" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shadow-2xs cursor-pointer">
              ⬇ Baixar Dados da Nuvem
            </button>
            <button onclick="ZGestorApp.exportarBackupJSON()" class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs cursor-pointer">
              ⬇ Exportar Backup (.JSON)
            </button>
            <label class="px-3.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold cursor-pointer">
              ⬆ Restaurar Backup (.JSON)
              <input type="file" accept=".json" onchange="ZGestorApp.importarBackupJSON(event)" class="hidden" />
            </label>
          </div>
          ${db.ultimoErroNuvem ? `
            <div class="mt-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px]">
              <strong>Último aviso da nuvem:</strong> ${this.escapeHtml(db.ultimoErroNuvem)}
            </div>
          ` : ''}
          <div class="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
            <div><strong>Modo Nuvem Ativo:</strong> Toda alteração feita por qualquer colaborador sincroniza automaticamente com o Supabase (quando as tabelas <code class="px-1 bg-white rounded border">zgestor_registros</code> e <code class="px-1 bg-white rounded border">zgestor_config</code> estiverem criadas no SQL Editor do Supabase).</div>
            <div><strong>Primeira ativação:</strong> Após rodar o <code class="px-1 bg-white rounded border">supabase/schema.sql</code> no Supabase, clique em <strong>⬆ Enviar Dados Locais p/ Nuvem</strong> no seu computador principal. Nos demais computadores, basta abrir o sistema (ou clicar em <strong>⬇ Baixar Dados da Nuvem</strong>).</div>
          </div>
        </div>
      </div>
    `;
  },

  // ===========================================================================
  // TELA DE LOGIN / AUTENTICAÇÃO DE COLABORADORES E CLIENTES
  // ===========================================================================
  renderLogin(appState) {
    const db = window.zgestorDB;
    const esc = db.getEscritorioConfig() || {};

    return `
      <div class="zg-auth-wrap w-full max-w-md mx-auto my-auto animate-in fade-in zoom-in duration-200">
        <div class="zg-auth-card bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200">
          <!-- Logo Oficial do Escritório & Cabeçalho -->
          <div class="zg-auth-header text-center mb-6">
            <div class="zg-auth-logo-box p-3 bg-[#012147] rounded-2xl border border-slate-800 shadow-xl inline-block max-w-[260px] w-full mx-auto">
              <img
                src="${esc.logo_customizada || './assets/logo-zioto.png'}"
                alt="Zioto Contabilidade"
                height="64"
                style="height:64px;max-height:64px;width:auto;max-width:210px;display:block;margin:0 auto;object-fit:contain;"
                class="zg-auth-logo-img h-16 w-auto mx-auto object-contain drop-shadow-md"
                onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
              />
              <div style="display:none;" class="flex flex-col items-center justify-center py-2 text-white">
                <span class="font-black text-xl tracking-wider text-amber-400">ZIOTO</span>
                <span class="text-[10px] tracking-widest text-slate-300 font-bold uppercase">Contabilidade</span>
              </div>
            </div>
            <h1 class="zg-auth-title text-xl font-black text-slate-900 tracking-tight mt-3">Portal & Gestão Contábil</h1>
            <p class="zg-auth-subtitle text-xs text-slate-500 font-medium mt-0.5">Acesso Exclusivo para Clientes e Equipe do Escritório</p>
            <div class="zg-auth-badge inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 mt-2.5">
              <span class="zg-auth-dot w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Ambiente Seguro com Isolamento RLS
            </div>
          </div>

          <!-- Formulário de Login -->
          <form onsubmit="ZGestorApp.submitLogin(event)" class="zg-auth-form space-y-4 text-xs">
            <div>
              <label for="login-email" class="zg-auth-label block font-bold text-slate-700 mb-1">E-mail de Acesso *</label>
              <div class="zg-auth-input-wrap relative">
                <div class="zg-auth-icon-left absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                </div>
                <input
                  id="login-email"
                  type="email"
                  required
                  placeholder="seu.email@ziotocontabilidade.com.br"
                  value=""
                  class="zg-auth-input w-full rounded-xl bg-slate-50 border border-slate-300 pl-9 pr-3 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-indigo-600 focus:bg-white transition"
                />
              </div>
            </div>

            <div>
              <div class="zg-auth-label-row flex items-center justify-between mb-1">
                <label for="login-senha" class="zg-auth-label block font-bold text-slate-700" style="margin-bottom:0;">Senha *</label>
                <span class="text-[11px] text-slate-400 font-medium" style="font-size:11px;color:#94a3b8;">
                  Digite sua senha
                </span>
              </div>
              <div class="zg-auth-input-wrap relative">
                <div class="zg-auth-icon-left absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <input
                  id="login-senha"
                  type="password"
                  required
                  placeholder="••••••••"
                  value=""
                  style="padding-right:2.5rem;"
                  class="zg-auth-input w-full rounded-xl bg-slate-50 border border-slate-300 pl-9 pr-10 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-indigo-600 focus:bg-white transition font-mono"
                />
                <button
                  type="button"
                  onclick="ZGestorApp.toggleVerSenha()"
                  title="Mostrar ou ocultar senha"
                  class="zg-auth-eye-btn absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition">
                  <i id="icon-ver-senha" data-lucide="eye" class="w-4 h-4"></i>
                </button>
              </div>
            </div>

            <button
              type="submit"
              class="zg-auth-submit w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-2 mt-3">
              <span>Entrar no Sistema</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </button>
          </form>

          <!-- Link para Ativação de Convite com Cadastro de Senha -->
          <div class="zg-auth-invite mt-6 pt-5 border-t border-slate-100 text-center text-xs text-slate-500">
            Recebeu um convite de acesso?
            <button
              type="button"
              onclick="ZGestorApp.abrirPromptAtivacao()"
              class="zg-auth-link-btn font-bold text-indigo-600 hover:underline ml-1">
              Ativar conta e cadastrar senha
            </button>
          </div>

          <div class="zg-auth-footer mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>ZGestor Enterprise PWA</span>
            <span class="zg-auth-version inline-flex items-center gap-1 font-mono font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              <span class="zg-auth-dot w-1.5 h-1.5 rounded-full bg-emerald-500" style="width:6px;height:6px;"></span> v1.4.5
            </span>
          </div>
        </div>
      </div>
    `;
  },

  // ===========================================================================
  // TELA DE CADASTRO DO ESCRITÓRIO & CHAVES PIX / QR CODE OFICIAL
  // ===========================================================================
  renderEscritorio(appState) {
    const db = window.zgestorDB;
    const esc = db.getEscritorioConfig();
    const user = db.getCurrentUser();
    const isAdmin = Boolean(user && (user.cargo === 'ADMIN' || db.isAdmin(user)));

    const pPrinc = esc.pix_principal || {
      nome: 'Conta PJ Principal (CNPJ Principal)',
      banco: esc.banco_pix || 'Banco Inter (077) / Itaú Empresas',
      tipo_chave: esc.tipo_chave_pix || 'CNPJ',
      chave_pix: esc.chave_pix || esc.cnpj_escritorio,
      favorecido: esc.favorecido_pix || esc.nome_escritorio,
      qrcode_img: esc.qrcode_img || ''
    };

    const pSec = esc.pix_secundario || {
      nome: 'Conta PJ Secundária (CNPJ Secundário / Filial)',
      banco: 'Sicoob / Nubank PJ',
      tipo_chave: 'CNPJ',
      chave_pix: '98.765.432/0001-10',
      favorecido: 'ZIOTO CONTABILIDADE FILIAL LTDA',
      qrcode_img: ''
    };

    const pAut = esc.pix_autonomo || {
      nome: 'Conta Autônomo / Sócio (Pessoa Física)',
      banco: 'Santander / Inter PF',
      tipo_chave: 'CPF',
      chave_pix: '123.456.789-00',
      favorecido: 'Luis Filipe Ferreira (Contador Sócio)',
      qrcode_img: ''
    };

    const apiConfig = esc.api_integra_contador || {
      ativo: true,
      status: 'CONECTADO',
      client_id: 'IC-SERPRO-ZIOTO-2026-PROD',
      endpoint: 'https://apigateway.serpro.gov.br/integra-contador/v1',
      ultima_sincronizacao: '2026-11-14 19:30:00',
      renovacao_automatica: true
    };

    return `
      <div class="space-y-5">
        <!-- Topo com Título e Ações Rápidas -->
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <div class="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 mb-0.5">
              <i data-lucide="landmark" class="w-4 h-4"></i> Identidade & Configurações Oficiais
            </div>
            <h1 class="text-lg font-bold text-slate-900">Cadastro do Escritório & Chaves PIX</h1>
            <p class="text-xs text-slate-500 mt-0.5">
              Gerencie os dados cadastrais, canais bancários de recebimento, anexe o QR Code PIX oficial para os recibos e configure a API do Integra Contador.
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button onclick="ZGestorApp.testarConexaoAPIIntegraContador()" type="button" class="px-3.5 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-bold text-xs flex items-center gap-1.5 transition">
              <i data-lucide="cpu" class="w-3.5 h-3.5 text-teal-600"></i> Testar API Integra Contador
            </button>
            <button onclick="document.getElementById('form-cadastro-escritorio').requestSubmit()" type="button" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer">
              <i data-lucide="save" class="w-3.5 h-3.5"></i> Salvar Dados do Escritório
            </button>
          </div>
        </div>

        <form id="form-cadastro-escritorio" onsubmit="ZGestorApp.salvarDadosEscritorio(event)" class="space-y-5">
          <!-- CARD 0: LOGOTIPO OFICIAL DO ESCRITÓRIO -->
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-slate-100">
              <div class="flex items-center gap-2.5">
                <div class="p-2 rounded-xl bg-indigo-50 text-indigo-700">
                  <i data-lucide="image" class="w-5 h-5"></i>
                </div>
                <div>
                  <h2 class="text-sm font-bold text-slate-900">Logotipo Oficial do Escritório</h2>
                  <p class="text-[11px] text-slate-500">Exibido na tela de login, cabeçalhos do sistema e nos Recibos de Honorários em PDF</p>
                </div>
              </div>
              ${esc.logo_customizada ? `
                <span class="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200">
                  Logotipo Personalizado Ativo
                </span>
              ` : `
                <span class="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold">
                  Logo Padrão ZIOTO
                </span>
              `}
            </div>

            <div class="flex flex-col sm:flex-row items-center gap-4">
              <div id="preview-box-logo" class="w-36 h-24 rounded-2xl bg-[#0f172a] border border-slate-300 flex items-center justify-center p-2 overflow-hidden shrink-0 shadow-sm">
                <img src="${esc.logo_customizada || './assets/logo-contabil.svg'}" class="max-w-full max-h-full object-contain" alt="Logo Escritório" />
              </div>
              <div class="space-y-2 flex-1 text-xs">
                <p class="text-slate-600">
                  Formatos aceitos: <strong>PNG, JPG, JPEG, SVG, WebP</strong> (até <strong>15 MB</strong>). Recomenda-se imagem com fundo transparente ou escuro para melhor legibilidade.
                </p>
                <div class="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onclick="ZGestorApp.acionarInputArquivo('input-file-logo-escritorio')"
                    class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition">
                    <i data-lucide="upload" class="w-3.5 h-3.5"></i>
                    <span>${esc.logo_customizada ? 'Trocar Logotipo' : 'Enviar Novo Logotipo'}</span>
                  </button>
                  <input id="input-file-logo-escritorio" type="file" accept="image/*" onchange="ZGestorApp.handleLogoUpload(event)" style="position:fixed;left:-9999px;width:1px;height:1px;opacity:0;" />
                  ${esc.logo_customizada ? `
                    <button type="button" onclick="ZGestorApp.removerLogoEscritorio()" class="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs border border-rose-200 transition cursor-pointer">
                      Restaurar Padrão
                    </button>
                  ` : ''}
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Título da Barra Lateral (Linha 1)</label>
                <input id="f-esc-marca-titulo" type="text" value="${this.escapeHtml(esc.marca_titulo || 'ZIOTO')}" placeholder="Ex: ZIOTO ou ZGESTOR" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-black text-slate-900" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Subtítulo da Barra Lateral (Linha 2)</label>
                <input id="f-esc-marca-subtitulo" type="text" value="${this.escapeHtml(esc.marca_subtitulo || 'CONTABILIDADE')}" placeholder="Ex: CONTABILIDADE ou GESTÃO CONTÁBIL" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold text-amber-700 uppercase" />
              </div>
            </div>
          </div>

          <!-- CARD 1: DADOS CADASTRAIS DO PRÓPRIO ESCRITÓRIO -->
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div class="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div class="p-2 rounded-xl bg-indigo-50 text-indigo-700">
                <i data-lucide="building-2" class="w-5 h-5"></i>
              </div>
              <div>
                <h2 class="text-sm font-bold text-slate-900">1. Dados Cadastrais & Contatos do Escritório</h2>
                <p class="text-[11px] text-slate-500">Informações oficiais que identificam o escritório nos cabeçalhos, recibos e relatórios</p>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              <div class="sm:col-span-2">
                <label class="block font-bold text-slate-700 mb-1">Razão Social Oficial *</label>
                <input id="f-esc-razao" type="text" required value="${esc.razao_social || esc.nome_escritorio}" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold text-slate-900" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Nome Fantasia *</label>
                <input id="f-esc-fantasia" type="text" required value="${esc.nome_fantasia || 'ZIOTO CONTABILIDADE'}" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label class="block font-bold text-slate-700 mb-1">CNPJ Principal *</label>
                <input id="f-esc-cnpj" type="text" required value="${esc.cnpj_escritorio}" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono font-bold" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Registro no CRC *</label>
                <input id="f-esc-crc" type="text" value="${esc.crc_escritorio}" placeholder="Ex: CRC/SP 2SP098765/O-0" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">CEP</label>
                <input id="f-esc-cep" type="text" value="${esc.cep || '01310-100'}" placeholder="00000-000" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono" />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div class="sm:col-span-2">
                <label class="block font-bold text-slate-700 mb-1">Logradouro / Endereço</label>
                <input id="f-esc-logradouro" type="text" value="${esc.logradouro || esc.endereco_escritorio || 'Av. Paulista'}" placeholder="Ex: Av. Paulista" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Número</label>
                <input id="f-esc-numero" type="text" value="${esc.numero || '1000'}" placeholder="Ex: 1000" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Complemento / Sala</label>
                <input id="f-esc-comp" type="text" value="${esc.complemento || 'Sala 804'}" placeholder="Ex: Sala 804" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Bairro</label>
                <input id="f-esc-bairro" type="text" value="${esc.bairro || 'Bela Vista'}" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Município / Cidade *</label>
                <input id="f-esc-municipio" type="text" required value="${esc.municipio || 'São Paulo'}" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">UF (Estado) *</label>
                <input id="f-esc-uf" type="text" required value="${esc.uf || 'SP'}" maxlength="2" class="w-full rounded-xl border border-slate-300 px-3 py-2 uppercase font-bold" />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Telefone Fixo</label>
                <input id="f-esc-tel" type="text" value="${esc.telefone_escritorio || '(11) 3344-5566'}" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">WhatsApp Oficial</label>
                <input id="f-esc-whatsapp" type="text" value="${esc.whatsapp_escritorio || '(11) 99888-7766'}" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold text-emerald-800" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">E-mail de Contato Geral</label>
                <input id="f-esc-email" type="email" value="${esc.email_escritorio}" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">E-mail do Financeiro</label>
                <input id="f-esc-email-fin" type="email" value="${esc.email_financeiro || 'financeiro@ziotocontabilidade.com.br'}" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Instrução / Mensagem Padrão no Recibo de Honorários</label>
              <textarea id="f-esc-msg" rows="2" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs">${esc.mensagem_recibo}</textarea>
            </div>
          </div>

          <!-- CARD 2: CONTAS BANCÁRIAS & UPLOAD DO QR CODE PIX REAL -->
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-slate-100">
              <div class="flex items-center gap-2.5">
                <div class="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                  <i data-lucide="qr-code" class="w-5 h-5"></i>
                </div>
                <div>
                  <h2 class="text-sm font-bold text-slate-900">2. Contas Bancárias & Upload dos QR Codes PIX Reais</h2>
                  <p class="text-[11px] text-slate-500">Configure as 3 opções de conta e anexe o QR Code oficial para substituir o genérico nos recibos</p>
                </div>
              </div>
            </div>

            <div class="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2.5">
              <i data-lucide="info" class="w-4 h-4 text-emerald-700 shrink-0 mt-0.5"></i>
              <div>
                <strong>Como funciona o QR Code PIX Real:</strong> Ao fazer o upload da imagem (PNG ou JPG) do QR Code da sua conta bancária, ela é salva de forma permanente e sai impressa com alta definição nos Recibos em PDF de cobrança, permitindo que os clientes façam a leitura direta pelo celular.
              </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <!-- CONTA 1: PIX PRINCIPAL -->
              <div class="p-4 rounded-xl border-2 border-emerald-300 bg-emerald-50/30 space-y-3 flex flex-col justify-between">
                <div class="space-y-2.5 text-xs">
                  <div class="flex items-center justify-between">
                    <span class="px-2 py-0.5 rounded font-extrabold text-[10px] bg-emerald-100 text-emerald-800 uppercase">Conta 1: Principal</span>
                    <span class="text-[10px] text-slate-500 font-semibold">Padrão da maioria</span>
                  </div>
                  <div>
                    <label class="block font-bold text-slate-800 mb-0.5">Identificação da Conta</label>
                    <input id="f-p1-nome" type="text" value="${pPrinc.nome}" class="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white font-semibold" />
                  </div>
                  <div>
                    <label class="block font-bold text-slate-800 mb-0.5">Banco / Instituição</label>
                    <input id="f-p1-banco" type="text" value="${pPrinc.banco}" class="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white" />
                  </div>
                  <div class="grid grid-cols-3 gap-2">
                    <div>
                      <label class="block font-bold text-slate-800 mb-0.5">Tipo</label>
                      <select id="f-p1-tipo" class="w-full rounded-lg border border-slate-300 px-2 py-1.5 bg-white font-semibold">
                        <option value="CNPJ" ${pPrinc.tipo_chave === 'CNPJ' ? 'selected' : ''}>CNPJ</option>
                        <option value="E-mail" ${pPrinc.tipo_chave === 'E-mail' ? 'selected' : ''}>E-mail</option>
                        <option value="Telefone" ${pPrinc.tipo_chave === 'Telefone' ? 'selected' : ''}>Telefone</option>
                        <option value="Aleatória" ${pPrinc.tipo_chave === 'Aleatória' ? 'selected' : ''}>Aleatória</option>
                      </select>
                    </div>
                    <div class="col-span-2">
                      <label class="block font-bold text-slate-800 mb-0.5">Chave PIX Principal *</label>
                      <input id="f-p1-chave" type="text" required value="${pPrinc.chave_pix}" class="w-full rounded-lg border border-emerald-400 px-2.5 py-1.5 bg-white font-mono font-bold text-emerald-950" />
                    </div>
                  </div>
                  <div>
                    <label class="block font-bold text-slate-800 mb-0.5">Favorecido / Titular</label>
                    <input id="f-p1-fav" type="text" value="${pPrinc.favorecido}" class="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white" />
                  </div>
                </div>

                <!-- Preview e Upload de QR Code da Conta 1 -->
                <div class="pt-2 border-t border-emerald-200">
                  <label class="block font-bold text-slate-800 text-xs mb-1.5">Imagem do QR Code PIX (Conta 1)</label>
                  <div class="flex items-center gap-3">
                    <div id="preview-box-pix_principal" class="w-20 h-20 rounded-xl bg-white border border-slate-300 flex items-center justify-center p-1 overflow-hidden shrink-0 shadow-xs">
                      ${pPrinc.qrcode_img ? `
                        <img src="${pPrinc.qrcode_img}" class="w-full h-full object-contain" alt="QR Code Conta 1" />
                      ` : `
                        <div class="text-center text-slate-400 text-[10px]">
                          <i data-lucide="image" class="w-6 h-6 mx-auto mb-0.5"></i> Sem QR Code
                        </div>
                      `}
                    </div>
                    <div class="space-y-1.5 flex-1">
                      <button
                        type="button"
                        onclick="ZGestorApp.acionarInputArquivo('input-qr-esc-pix_principal')"
                        class="w-full px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold text-center shadow-2xs cursor-pointer transition">
                        📎 ${pPrinc.qrcode_img ? 'Trocar QR Code' : 'Anexar QR Code'}
                      </button>
                      <input id="input-qr-esc-pix_principal" type="file" accept="image/*" onchange="ZGestorApp.handleQRCodeUpload('pix_principal', event)" style="position:fixed;left:-9999px;width:1px;height:1px;opacity:0;" />
                      ${pPrinc.qrcode_img ? `
                        <button type="button" onclick="ZGestorApp.removerQRCodePix('pix_principal')" class="w-full px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-semibold border border-rose-200 transition cursor-pointer">
                          Remover Imagem
                        </button>
                      ` : ''}
                    </div>
                  </div>
                </div>
              </div>

              <!-- CONTA 2: PIX SECUNDÁRIO -->
              <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3 flex flex-col justify-between">
                <div class="space-y-2.5 text-xs">
                  <div class="flex items-center justify-between">
                    <span class="px-2 py-0.5 rounded font-extrabold text-[10px] bg-blue-100 text-blue-800 uppercase">Conta 2: Secundária</span>
                    <span class="text-[10px] text-slate-500 font-semibold">Filial / Backup</span>
                  </div>
                  <div>
                    <label class="block font-bold text-slate-800 mb-0.5">Identificação da Conta</label>
                    <input id="f-p2-nome" type="text" value="${pSec.nome}" class="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white font-semibold" />
                  </div>
                  <div>
                    <label class="block font-bold text-slate-800 mb-0.5">Banco / Instituição</label>
                    <input id="f-p2-banco" type="text" value="${pSec.banco}" class="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white" />
                  </div>
                  <div class="grid grid-cols-3 gap-2">
                    <div>
                      <label class="block font-bold text-slate-800 mb-0.5">Tipo</label>
                      <select id="f-p2-tipo" class="w-full rounded-lg border border-slate-300 px-2 py-1.5 bg-white font-semibold">
                        <option value="CNPJ" ${pSec.tipo_chave === 'CNPJ' ? 'selected' : ''}>CNPJ</option>
                        <option value="E-mail" ${pSec.tipo_chave === 'E-mail' ? 'selected' : ''}>E-mail</option>
                        <option value="Telefone" ${pSec.tipo_chave === 'Telefone' ? 'selected' : ''}>Telefone</option>
                        <option value="Aleatória" ${pSec.tipo_chave === 'Aleatória' ? 'selected' : ''}>Aleatória</option>
                      </select>
                    </div>
                    <div class="col-span-2">
                      <label class="block font-bold text-slate-800 mb-0.5">Chave PIX Secundária</label>
                      <input id="f-p2-chave" type="text" value="${pSec.chave_pix}" class="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white font-mono font-bold text-slate-900" />
                    </div>
                  </div>
                  <div>
                    <label class="block font-bold text-slate-800 mb-0.5">Favorecido / Titular</label>
                    <input id="f-p2-fav" type="text" value="${pSec.favorecido}" class="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white" />
                  </div>
                </div>

                <!-- Preview e Upload de QR Code da Conta 2 -->
                <div class="pt-2 border-t border-slate-200">
                  <label class="block font-bold text-slate-800 text-xs mb-1.5">Imagem do QR Code PIX (Conta 2)</label>
                  <div class="flex items-center gap-3">
                    <div id="preview-box-pix_secundario" class="w-20 h-20 rounded-xl bg-white border border-slate-300 flex items-center justify-center p-1 overflow-hidden shrink-0 shadow-xs">
                      ${pSec.qrcode_img ? `
                        <img src="${pSec.qrcode_img}" class="w-full h-full object-contain" alt="QR Code Conta 2" />
                      ` : `
                        <div class="text-center text-slate-400 text-[10px]">
                          <i data-lucide="image" class="w-6 h-6 mx-auto mb-0.5"></i> Sem QR Code
                        </div>
                      `}
                    </div>
                    <div class="space-y-1.5 flex-1">
                      <button
                        type="button"
                        onclick="ZGestorApp.acionarInputArquivo('input-qr-esc-pix_secundario')"
                        class="w-full px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold text-center shadow-2xs cursor-pointer transition">
                        📎 ${pSec.qrcode_img ? 'Trocar QR Code' : 'Anexar QR Code'}
                      </button>
                      <input id="input-qr-esc-pix_secundario" type="file" accept="image/*" onchange="ZGestorApp.handleQRCodeUpload('pix_secundario', event)" style="position:fixed;left:-9999px;width:1px;height:1px;opacity:0;" />
                      ${pSec.qrcode_img ? `
                        <button type="button" onclick="ZGestorApp.removerQRCodePix('pix_secundario')" class="w-full px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-semibold border border-rose-200 transition cursor-pointer">
                          Remover Imagem
                        </button>
                      ` : ''}
                    </div>
                  </div>
                </div>
              </div>

              <!-- CONTA 3: PIX AUTÔNOMO / SÓCIO -->
              <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3 flex flex-col justify-between">
                <div class="space-y-2.5 text-xs">
                  <div class="flex items-center justify-between">
                    <span class="px-2 py-0.5 rounded font-extrabold text-[10px] bg-purple-100 text-purple-800 uppercase">Conta 3: Autônomo / Sócio</span>
                    <span class="text-[10px] text-slate-500 font-semibold">Pessoa Física</span>
                  </div>
                  <div>
                    <label class="block font-bold text-slate-800 mb-0.5">Identificação da Conta</label>
                    <input id="f-p3-nome" type="text" value="${pAut.nome}" class="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white font-semibold" />
                  </div>
                  <div>
                    <label class="block font-bold text-slate-800 mb-0.5">Banco / Instituição</label>
                    <input id="f-p3-banco" type="text" value="${pAut.banco}" class="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white" />
                  </div>
                  <div class="grid grid-cols-3 gap-2">
                    <div>
                      <label class="block font-bold text-slate-800 mb-0.5">Tipo</label>
                      <select id="f-p3-tipo" class="w-full rounded-lg border border-slate-300 px-2 py-1.5 bg-white font-semibold">
                        <option value="CPF" ${pAut.tipo_chave === 'CPF' ? 'selected' : ''}>CPF</option>
                        <option value="E-mail" ${pAut.tipo_chave === 'E-mail' ? 'selected' : ''}>E-mail</option>
                        <option value="Telefone" ${pAut.tipo_chave === 'Telefone' ? 'selected' : ''}>Telefone</option>
                        <option value="Aleatória" ${pAut.tipo_chave === 'Aleatória' ? 'selected' : ''}>Aleatória</option>
                      </select>
                    </div>
                    <div class="col-span-2">
                      <label class="block font-bold text-slate-800 mb-0.5">Chave PIX (CPF)</label>
                      <input id="f-p3-chave" type="text" value="${pAut.chave_pix}" class="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white font-mono font-bold text-slate-900" />
                    </div>
                  </div>
                  <div>
                    <label class="block font-bold text-slate-800 mb-0.5">Favorecido / Sócio</label>
                    <input id="f-p3-fav" type="text" value="${pAut.favorecido}" class="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white" />
                  </div>
                </div>

                <!-- Preview e Upload de QR Code da Conta 3 -->
                <div class="pt-2 border-t border-slate-200">
                  <label class="block font-bold text-slate-800 text-xs mb-1.5">Imagem do QR Code PIX (Conta 3)</label>
                  <div class="flex items-center gap-3">
                    <div id="preview-box-pix_autonomo" class="w-20 h-20 rounded-xl bg-white border border-slate-300 flex items-center justify-center p-1 overflow-hidden shrink-0 shadow-xs">
                      ${pAut.qrcode_img ? `
                        <img src="${pAut.qrcode_img}" class="w-full h-full object-contain" alt="QR Code Conta 3" />
                      ` : `
                        <div class="text-center text-slate-400 text-[10px]">
                          <i data-lucide="image" class="w-6 h-6 mx-auto mb-0.5"></i> Sem QR Code
                        </div>
                      `}
                    </div>
                    <div class="space-y-1.5 flex-1">
                      <button
                        type="button"
                        onclick="ZGestorApp.acionarInputArquivo('input-qr-esc-pix_autonomo')"
                        class="w-full px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold text-center shadow-2xs cursor-pointer transition">
                        📎 ${pAut.qrcode_img ? 'Trocar QR Code' : 'Anexar QR Code'}
                      </button>
                      <input id="input-qr-esc-pix_autonomo" type="file" accept="image/*" onchange="ZGestorApp.handleQRCodeUpload('pix_autonomo', event)" style="position:fixed;left:-9999px;width:1px;height:1px;opacity:0;" />
                      ${pAut.qrcode_img ? `
                        <button type="button" onclick="ZGestorApp.removerQRCodePix('pix_autonomo')" class="w-full px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-semibold border border-rose-200 transition cursor-pointer">
                          Remover Imagem
                        </button>
                      ` : ''}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- CARD 3: INTEGRAÇÃO COM API INTEGRA CONTADOR (SERPRO / RECEITA FEDERAL) -->
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div class="flex items-center gap-2.5">
                <div class="p-2 rounded-xl bg-teal-50 text-teal-700">
                  <i data-lucide="cpu" class="w-5 h-5"></i>
                </div>
                <div>
                  <h2 class="text-sm font-bold text-slate-900">3. Integração com API Integra Contador (SERPRO / Receita Federal)</h2>
                  <p class="text-[11px] text-slate-500">Permite consulta em lote e renovação automática instantânea de Certidões Negativas (CNDs)</p>
                </div>
              </div>
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${apiConfig.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}">
                <span class="w-2 h-2 rounded-full ${apiConfig.ativo ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}"></span>
                ${apiConfig.ativo ? 'API Conectada & Operacional' : 'Integração Desativada'}
              </span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Status da Integração</label>
                <select id="f-api-ativo" class="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white font-bold text-slate-800">
                  <option value="true" ${apiConfig.ativo ? 'selected' : ''}>🟢 Ativo (Renovação via API Liberada)</option>
                  <option value="false" ${!apiConfig.ativo ? 'selected' : ''}>⚪ Inativo (Apenas Anexo Manual de PDF)</option>
                </select>
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Client ID / Chave da API</label>
                <input id="f-api-client" type="text" value="${apiConfig.client_id || 'IC-SERPRO-ZIOTO-2026-PROD'}" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Gateway Endpoint</label>
                <input id="f-api-endpoint" type="text" value="${apiConfig.endpoint || 'https://apigateway.serpro.gov.br/integra-contador/v1'}" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs text-slate-600" />
              </div>
            </div>

            <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div class="text-slate-600">
                Última sincronização com base do SERPRO/Receita: <strong>${apiConfig.ultima_sincronizacao || 'Hoje às 19:30'}</strong>
              </div>
              <button onclick="ZGestorApp.testarConexaoAPIIntegraContador()" type="button" class="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 transition">
                <i data-lucide="refresh-cw" class="w-3 h-3"></i> Testar Conexão Agora
              </button>
            </div>
          </div>

          <!-- BOTÃO FIXO/FINAL DE SALVAR -->
          <div class="flex justify-end gap-3 pt-2">
            <button type="button" onclick="ZGestorApp.navigate('honorarios')" class="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition">
              Voltar aos Honorários
            </button>
            <button type="submit" class="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-600/20 flex items-center gap-2 transition cursor-pointer">
              <i data-lucide="save" class="w-4 h-4"></i> Salvar Todas as Alterações do Escritório
            </button>
          </div>
        </form>
      </div>
    `;
  }
,

  // ===========================================================================
  // 9.5. CONTROLE DE ALVARÁS E LICENÇAS OPERACIONAIS
  // ===========================================================================
  renderAlvaras(appState) {
    const db = window.zgestorDB;
    db.garantirAlvarasPadrao();
    const fEmpresa = appState.filtroAlvaraEmpresa || 'TODAS';
    const fTipo = appState.filtroAlvaraTipo || 'TODOS';
    const fStatus = appState.filtroAlvaraStatus || 'TODOS';
    const busca = (appState.filtroAlvaraBusca || '').toLowerCase().trim();

    const empresas = db.data.empresas || [];
    let todosAlvaras = db.getAlvaras();

    // Filtros
    let lista = [...todosAlvaras];
    if (fEmpresa !== 'TODAS') {
      lista = lista.filter(a => a.empresa_id === fEmpresa);
    }
    if (fTipo !== 'TODOS') {
      lista = lista.filter(a => a.tipo === fTipo);
    }
    if (fStatus !== 'TODOS') {
      lista = lista.filter(a => {
        const st = db.calcularStatusAlvara(a);
        return st.codigo === fStatus || a.status === fStatus;
      });
    }
    if (busca) {
      lista = lista.filter(a => {
        const emp = empresas.find(e => e.id === a.empresa_id);
        const empNome = emp ? (emp.nome_fantasia + ' ' + emp.razao_social + ' ' + emp.cnpj) : '';
        return (
          (a.nome || '').toLowerCase().includes(busca) ||
          (a.orgao_emissor || '').toLowerCase().includes(busca) ||
          (a.numero_documento || '').toLowerCase().includes(busca) ||
          (a.protocolo_renovacao || '').toLowerCase().includes(busca) ||
          empNome.toLowerCase().includes(busca)
        );
      });
    }

    // Contadores para KPIs
    let vigentesCount = 0;
    let vencendoCount = 0;
    let vencidosCount = 0;
    let renovacaoCount = 0;

    todosAlvaras.forEach(a => {
      const st = db.calcularStatusAlvara(a);
      if (st.codigo === 'VENCIDO') vencidosCount++;
      else if (st.codigo === 'VENCENDO' || st.codigo === 'ATENCAO') vencendoCount++;
      else if (st.codigo === 'EM_RENOVACAO') renovacaoCount++;
      else vigentesCount++;
    });

    const tipoLabels = {
      FUNCIONAMENTO: { label: 'Alvará de Funcionamento', badge: 'bg-blue-50 text-blue-700 border-blue-200', icon: 'building-2' },
      SANITARIO: { label: 'Vigilância Sanitária', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'shield-plus' },
      PESCA: { label: 'Petrecho de Pesca', badge: 'bg-cyan-50 text-cyan-800 border-cyan-200', icon: 'anchor' },
      BOMBEIROS: { label: 'Corpo de Bombeiros (AVCB)', badge: 'bg-rose-50 text-rose-700 border-rose-200', icon: 'flame' },
      AMBIENTAL: { label: 'Licença Ambiental', badge: 'bg-green-50 text-green-800 border-green-200', icon: 'trees' },
      OUTRO: { label: 'Outro / Específico', badge: 'bg-purple-50 text-purple-700 border-purple-200', icon: 'file-text' }
    };

    return `
      <div class="space-y-6">
        <!-- Topo: Título e Ação de Adicionar -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                Regularidade Operacional
              </span>
              <span class="text-xs text-slate-400">•</span>
              <span class="text-xs text-slate-500 font-semibold">${todosAlvaras.length} alvarás ativos no escritório</span>
            </div>
            <h1 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2">
              <i data-lucide="file-check" class="w-6 h-6 text-indigo-600"></i>
              Controle de Alvarás & Licenças
            </h1>
            <p class="text-xs text-slate-500 mt-0.5">
              Gestão preventiva de Alvará de Funcionamento, Vigilância Sanitária, Petrechos de Pesca, Bombeiros (AVCB) e Licenças Ambientais
            </p>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              onclick="ZGestorApp.openModalNovoAlvara()"
              class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-600/20 flex items-center gap-2 transition cursor-pointer">
              <i data-lucide="plus-circle" class="w-4 h-4"></i>
              <span>+ Novo Alvará / Licença</span>
            </button>
          </div>
        </div>

        <!-- 4 Cards de Resumo Executivo / KPIs -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div class="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Total Monitorado</span>
              <i data-lucide="layers" class="w-4 h-4 text-slate-400"></i>
            </div>
            <div class="text-2xl font-black text-slate-900 mt-2">${todosAlvaras.length}</div>
            <div class="text-[11px] text-slate-400 mt-0.5">Alvarás de todas as empresas</div>
          </div>

          <div class="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs">
            <div class="flex items-center justify-between text-emerald-700 text-xs font-semibold">
              <span>Alvarás Vigentes</span>
              <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-600"></i>
            </div>
            <div class="text-2xl font-black text-emerald-600 mt-2">${vigentesCount}</div>
            <div class="text-[11px] text-emerald-600 mt-0.5">Dentro do prazo de validade</div>
          </div>

          <div class="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs">
            <div class="flex items-center justify-between text-amber-700 text-xs font-semibold">
              <span>Vencendo em até 60 dias</span>
              <i data-lucide="alert-triangle" class="w-4 h-4 text-amber-600"></i>
            </div>
            <div class="text-2xl font-black text-amber-600 mt-2">${vencendoCount}</div>
            <div class="text-[11px] text-amber-600 mt-0.5">Exigem protocolo de renovação</div>
          </div>

          <div class="bg-white p-4 rounded-2xl border ${vencidosCount > 0 ? 'border-rose-300 bg-rose-50/30' : 'border-slate-200'} shadow-xs">
            <div class="flex items-center justify-between text-rose-700 text-xs font-semibold">
              <span>Vencidos / Expirados</span>
              <i data-lucide="alert-octagon" class="w-4 h-4 text-rose-600"></i>
            </div>
            <div class="text-2xl font-black text-rose-600 mt-2">${vencidosCount}</div>
            <div class="text-[11px] text-rose-600 mt-0.5">${vencidosCount > 0 ? 'Risco de autuação municipal' : 'Nenhum alvará vencido'}</div>
          </div>
        </div>

        <!-- Barra de Filtros e Busca -->
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Filtrar por Empresa</label>
              ${this.renderSeletorEmpresaBusca({
                uid: 'alvara-filtro-emp',
                inputId: 'f-alvara-filtro-emp',
                selectedId: fEmpresa,
                placeholder: `Todas as Empresas (${empresas.length})...`,
                onChangeFn: 'ZGestorApp.setFiltroAlvaraEmpresa(val)',
                allowAllOption: true,
                allOptionValue: 'TODAS',
                allOptionLabel: `Todas as Empresas (${empresas.length})`
              })}
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Tipo de Licença / Alvará</label>
              <select
                onchange="ZGestorApp.setFiltroAlvaraTipo(this.value)"
                class="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white font-medium focus:outline-none focus:border-indigo-500">
                <option value="TODOS" ${fTipo === 'TODOS' ? 'selected' : ''}>Todos os Tipos</option>
                <option value="FUNCIONAMENTO" ${fTipo === 'FUNCIONAMENTO' ? 'selected' : ''}>Alvará de Funcionamento (Prefeitura)</option>
                <option value="SANITARIO" ${fTipo === 'SANITARIO' ? 'selected' : ''}>Vigilância Sanitária</option>
                <option value="PESCA" ${fTipo === 'PESCA' ? 'selected' : ''}>Certificado de Petrecho de Pesca</option>
                <option value="BOMBEIROS" ${fTipo === 'BOMBEIROS' ? 'selected' : ''}>Corpo de Bombeiros (AVCB / CLCB)</option>
                <option value="AMBIENTAL" ${fTipo === 'AMBIENTAL' ? 'selected' : ''}>Licença Ambiental</option>
                <option value="OUTRO" ${fTipo === 'OUTRO' ? 'selected' : ''}>Outras Licenças Específicas</option>
              </select>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Status de Validade</label>
              <select
                onchange="ZGestorApp.setFiltroAlvaraStatus(this.value)"
                class="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white font-medium focus:outline-none focus:border-indigo-500">
                <option value="TODOS" ${fStatus === 'TODOS' ? 'selected' : ''}>Todos os Status</option>
                <option value="VIGENTE" ${fStatus === 'VIGENTE' ? 'selected' : ''}>Vigentes / Válidos</option>
                <option value="VENCENDO" ${fStatus === 'VENCENDO' ? 'selected' : ''}>Vencendo em até 30 dias</option>
                <option value="VENCIDO" ${fStatus === 'VENCIDO' ? 'selected' : ''}>Vencidos / Expirados</option>
                <option value="EM_RENOVACAO" ${fStatus === 'EM_RENOVACAO' ? 'selected' : ''}>Em Renovação / Protocolados</option>
                <option value="DISPENSADO" ${fStatus === 'DISPENSADO' ? 'selected' : ''}>Indeterminados / Dispensados</option>
              </select>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Buscar por Palavra-Chave</label>
              <div class="relative">
                <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3 top-2.5"></i>
                <input
                  type="text"
                  id="input-filtro-alvara-busca"
                  placeholder="Nome, órgão ou nº do alvará..."
                  value="${this.escapeHtml(appState.filtroAlvaraBusca || '')}"
                  oninput="ZGestorApp.setFiltroAlvaraBusca(this.value)"
                  class="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-xs font-medium focus:outline-none focus:border-indigo-500" />
              </div>
            </div>
          </div>
        </div>

        <!-- Tabela / Cards de Alvarás -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          ${lista.length === 0 ? `
            <div class="p-12 text-center">
              <i data-lucide="file-x" class="w-12 h-12 text-slate-300 mx-auto mb-3"></i>
              <h3 class="text-sm font-bold text-slate-700">Nenhum alvará ou licença encontrado com os filtros aplicados</h3>
              <p class="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Tente alterar os filtros de empresa ou status, ou adicione uma nova licença.</p>
              <button
                type="button"
                onclick="ZGestorApp.openModalNovoAlvara()"
                class="mt-4 px-4 py-2 rounded-xl bg-indigo-50 text-indigo-700 font-bold text-xs hover:bg-indigo-100 transition inline-flex items-center gap-1.5 cursor-pointer">
                <i data-lucide="plus-circle" class="w-4 h-4"></i>
                Cadastrar Alvará
              </button>
            </div>
          ` : `
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs">
                <thead class="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th class="py-3 px-4">Empresa</th>
                    <th class="py-3 px-4">Alvará / Licença</th>
                    <th class="py-3 px-4">Órgão Emissor</th>
                    <th class="py-3 px-4">Nº Documento / Inscrição</th>
                    <th class="py-3 px-4">Validade / Vencimento</th>
                    <th class="py-3 px-4">Status</th>
                    <th class="py-3 px-4">Protocolo de Renovação</th>
                    <th class="py-3 px-4 text-center">Arquivo</th>
                    <th class="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  ${lista.map(alv => {
                    const emp = empresas.find(e => e.id === alv.empresa_id);
                    const st = db.calcularStatusAlvara(alv);
                    const tipoInfo = tipoLabels[alv.tipo] || tipoLabels.OUTRO;

                    return `
                      <tr class="hover:bg-slate-50/80 transition">
                        <td class="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                          ${emp ? `
                            <div class="font-bold text-slate-900">${this.escapeHtml(this.nomeEmp(emp, { comCodigo: true }))}</div>
                            <div class="text-[11px] text-slate-400 font-normal">CNPJ: ${this.escapeHtml(emp.cnpj)}</div>
                          ` : 'Cadastro não localizado'}
                        </td>
                        <td class="py-3.5 px-4 whitespace-nowrap">
                          <div class="font-bold text-slate-800">${this.escapeHtml(alv.nome)}</div>
                          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border mt-0.5 ${tipoInfo.badge}">
                            <i data-lucide="${tipoInfo.icon}" class="w-3 h-3"></i>
                            ${tipoInfo.label}
                          </span>
                        </td>
                        <td class="py-3.5 px-4 text-slate-600 font-medium whitespace-nowrap">
                          ${this.escapeHtml(alv.orgao_emissor || 'Prefeitura')}
                        </td>
                        <td class="py-3.5 px-4 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                          ${this.escapeHtml(alv.numero_documento || 'Não informado')}
                        </td>
                        <td class="py-3.5 px-4 whitespace-nowrap">
                          ${alv.indeterminado ? `
                            <span class="text-emerald-700 font-semibold">Indeterminado / Isento</span>
                          ` : alv.data_vencimento ? `
                            <div class="font-bold text-slate-800">${alv.data_vencimento.split('-').reverse().join('/')}</div>
                            <div class="text-[10px] ${st.codigo === 'VENCIDO' ? 'text-rose-600 font-bold' : st.codigo === 'VENCENDO' ? 'text-amber-600 font-bold' : 'text-slate-400'}">
                              ${st.label}
                            </div>
                          ` : '<span class="text-slate-400">Sem data</span>'}
                        </td>
                        <td class="py-3.5 px-4 whitespace-nowrap">
                          <span class="px-2.5 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1.5 w-fit
                            ${st.codigo === 'VIGENTE' || st.codigo === 'DISPENSADO' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : ''}
                            ${st.codigo === 'VENCENDO' || st.codigo === 'ATENCAO' ? 'bg-amber-50 text-amber-800 border-amber-300' : ''}
                            ${st.codigo === 'VENCIDO' ? 'bg-rose-50 text-rose-800 border-rose-300 font-extrabold' : ''}
                            ${st.codigo === 'EM_RENOVACAO' ? 'bg-blue-50 text-blue-800 border-blue-300' : ''}
                            ${st.codigo === 'SEM_DATA' ? 'bg-slate-50 text-slate-700 border-slate-300' : ''}
                          ">
                            <span class="w-1.5 h-1.5 rounded-full
                              ${st.codigo === 'VIGENTE' || st.codigo === 'DISPENSADO' ? 'bg-emerald-500' : ''}
                              ${st.codigo === 'VENCENDO' || st.codigo === 'ATENCAO' ? 'bg-amber-500' : ''}
                              ${st.codigo === 'VENCIDO' ? 'bg-rose-500' : ''}
                              ${st.codigo === 'EM_RENOVACAO' ? 'bg-blue-500' : ''}
                              ${st.codigo === 'SEM_DATA' ? 'bg-slate-400' : ''}
                            "></span>
                            ${st.codigo === 'VIGENTE' ? 'Vigente' : st.codigo === 'VENCENDO' ? 'A Vencer' : st.codigo === 'VENCIDO' ? 'Vencido' : st.codigo === 'EM_RENOVACAO' ? 'Em Renovação' : st.label}
                          </span>
                        </td>
                        <td class="py-3.5 px-4 whitespace-nowrap">
                          ${alv.protocolo_renovacao ? `
                            <div class="flex items-center gap-1.5">
                              <span class="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                                Prot: ${this.escapeHtml(alv.protocolo_renovacao)}
                              </span>
                              ${alv.data_protocolo ? `
                                <span class="text-[10px] text-slate-400">(${alv.data_protocolo.split('-').reverse().join('/')})</span>
                              ` : ''}
                            </div>
                          ` : `
                            <button
                              type="button"
                              onclick="ZGestorApp.abrirModalProtocoloAlvara('${alv.id}')"
                              class="text-[11px] text-slate-500 hover:text-indigo-600 font-semibold flex items-center gap-1 hover:underline cursor-pointer">
                              <i data-lucide="plus" class="w-3 h-3"></i> Registrar Protocolo
                            </button>
                          `}
                        </td>
                        <td class="py-3.5 px-4 text-center whitespace-nowrap">
                          ${alv.anexo_base64 ? `
                            <button
                              type="button"
                              onclick="ZGestorApp.baixarArquivoAlvara('${alv.id}')"
                              title="Baixar ou visualizar arquivo anexado"
                              class="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold transition inline-flex items-center gap-1 text-[11px] cursor-pointer">
                              <i data-lucide="download" class="w-3.5 h-3.5"></i>
                              <span>PDF</span>
                            </button>
                          ` : `
                            <span class="text-slate-300 text-xs">—</span>
                          `}
                        </td>
                        <td class="py-3.5 px-4 text-right whitespace-nowrap">
                          <div class="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onclick="ZGestorApp.abrirModalProtocoloAlvara('${alv.id}')"
                              title="Registrar / Atualizar Protocolo de Renovação"
                              class="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition cursor-pointer">
                              <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
                            </button>
                            <button
                              type="button"
                              onclick="ZGestorApp.openModalNovoAlvara('${alv.id}')"
                              title="Editar Alvará"
                              class="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer">
                              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                            </button>
                            <button
                              type="button"
                              onclick="ZGestorApp.excluirAlvara('${alv.id}')"
                              title="Excluir Alvará"
                              class="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition cursor-pointer">
                              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </div>
    `;
  },

  // ===========================================================================
  // 10. MÓDULO DE INTELIGÊNCIA ARTIFICIAL & ASSISTENTE CONTÁBIL (Z-IA)
  // ===========================================================================
  renderInteligenciaIA(appState) {
    const db = window.zgestorDB;
    const esc = db.getEscritorioConfig();
    const iaConfig = esc.ia_config || {
      provedor: 'gemini',
      gemini_api_key: '',
      openai_api_key: '',
      api_key: '',
      gemini_modelo: 'gemini-1.5-flash',
      openai_modelo: 'gpt-4o-mini',
      ativo: false
    };

    const provedorAtivo = iaConfig.provedor || 'gemini';
    const geminiKey = iaConfig.gemini_api_key || iaConfig.api_key || '';
    const openaiKey = iaConfig.openai_api_key || '';
    const hasGemini = Boolean(geminiKey && geminiKey.trim());
    const hasOpenAI = Boolean(openaiKey && openaiKey.trim());
    const hasKey = hasGemini || hasOpenAI;

    const subTab = appState.subTabIA || 'diagnostico';
    const comp = appState.competencia || '10/2026';
    const sub = db.obterMesSubsequente(comp);

    const empresas = db.data.empresas || [];
    const tarefasComp = (db.data.tarefas || []).filter(t => t.competencia === comp);
    const tarefasConcluidas = tarefasComp.filter(t => t.status === 'CONCLUIDA' || t.data_entrega);
    const tarefasPendentes = tarefasComp.filter(t => t.status !== 'CONCLUIDA' && !t.data_entrega);
    const cnds = db.getCNDs ? db.getCNDs() : [];
    const cndsAlertas = cnds.filter(c => {
      const st = db.calcularStatusValidadeCND(c).codigo;
      return st === 'VENCIDA' || st === 'PENDENCIA' || st === 'VENCENDO';
    });
    const honorariosAbertos = (db.data.honorarios || []).filter(h => Number(h.saldo_aberto) > 0);
    const totalAberto = honorariosAbertos.reduce((sum, h) => sum + Number(h.saldo_aberto || 0), 0);
    const solicitacoes = db.getRegistrosCentralCliente ? db.getRegistrosCentralCliente() : (db.data.central_cliente_registros || []);
    const chamadosAbertos = solicitacoes.filter(s => s.status === 'PENDENTE' || s.status === 'EM_ANDAMENTO');

    // Taxa de conformidade
    const taxaObrigacoes = tarefasComp.length > 0 ? Math.round((tarefasConcluidas.length / tarefasComp.length) * 100) : 100;

    return `
      <div class="space-y-5">
        <!-- Topo: Identidade do Assistente IA & Status de Conexão -->
        <div class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 rounded-3xl shadow-xl border border-indigo-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 flex items-center gap-1.5">
                <i data-lucide="sparkles" class="w-3 h-3 text-indigo-300"></i>
                Z-IA Contábil • v1.3.0
              </span>
              <span class="text-xs text-slate-400">|</span>
              <span class="text-xs text-indigo-200 font-medium">Competência de Análise: <strong>${comp} (${sub.label})</strong></span>
            </div>
            <h1 class="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>Inteligência Artificial & Auditoria Contábil</span>
            </h1>
            <p class="text-xs text-indigo-200/80 max-w-xl">
              Diagnóstico preditivo de obrigações, consultor tributário especializado, gerador de cobranças cordiais com PIX e respostas de suporte para clientes.
            </p>
          </div>

          <!-- Status dos Provedores IA Conectados -->
          <div class="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 bg-white/5 p-3 rounded-2xl border border-white/10 backdrop-blur-xs">
            <div class="space-y-1 text-xs">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full ${hasGemini ? 'bg-emerald-400 ring-4 ring-emerald-400/20' : 'bg-slate-500'}"></span>
                <span class="text-[11px] font-semibold text-slate-300">Google Gemini:</span>
                <span class="font-bold ${hasGemini ? 'text-emerald-300' : 'text-slate-400'}">${hasGemini ? 'Conectado' : 'Sem Chave'}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full ${hasOpenAI ? 'bg-emerald-400 ring-4 ring-emerald-400/20' : 'bg-slate-500'}"></span>
                <span class="text-[11px] font-semibold text-slate-300">OpenAI (ChatGPT):</span>
                <span class="font-bold ${hasOpenAI ? 'text-emerald-300' : 'text-slate-400'}">${hasOpenAI ? 'Conectado' : 'Sem Chave'}</span>
              </div>
              <div class="text-[10px] text-indigo-300 pt-0.5">
                Provedor Ativo: <strong class="text-white uppercase">${provedorAtivo === 'openai' ? 'OpenAI (ChatGPT)' : 'Google Gemini'}</strong>
              </div>
            </div>

            <button
              type="button"
              onclick="ZGestorApp.toggleCardConfigIA()"
              class="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap">
              <i data-lucide="settings-2" class="w-3.5 h-3.5"></i>
              <span>Gerenciar Chaves</span>
            </button>
          </div>
        </div>

        <!-- PAINEL RETRÁTIL DE CONFIGURAÇÃO DE CHAVES DE IA (DUAL: OPENAI + GOOGLE GEMINI) -->
        <div id="card-config-ia" class="${hasKey ? 'hidden' : 'block'} bg-white p-5 rounded-2xl border border-indigo-200 shadow-sm space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
            <div class="flex items-center gap-2.5">
              <div class="p-2 rounded-xl bg-indigo-50 text-indigo-700">
                <i data-lucide="cpu" class="w-5 h-5"></i>
              </div>
              <div>
                <h2 class="text-sm font-bold text-slate-900">Configuração de APIs de Inteligência Artificial</h2>
                <p class="text-[11px] text-slate-500">Conecte sua chave da OpenAI (ChatGPT) ou do Google Gemini para alimentar as análises tributárias e diagnósticos</p>
              </div>
            </div>
            
            <!-- Seletor de Provedor Preferencial Ativo -->
            <div class="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onclick="ZGestorApp.setProvedorIA('gemini')"
                class="px-3 py-1.5 rounded-lg transition cursor-pointer ${provedorAtivo === 'gemini' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}">
                Google Gemini
              </button>
              <button
                type="button"
                onclick="ZGestorApp.setProvedorIA('openai')"
                class="px-3 py-1.5 rounded-lg transition cursor-pointer ${provedorAtivo === 'openai' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}">
                OpenAI (ChatGPT)
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <!-- COLUNA 1: GOOGLE GEMINI -->
            <div class="p-4 rounded-xl border ${provedorAtivo === 'gemini' ? 'border-indigo-300 bg-indigo-50/20' : 'border-slate-200 bg-white'} space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-xs">G</span>
                  <div>
                    <h3 class="font-bold text-slate-800 text-xs">Google Gemini API</h3>
                    <span class="text-[10px] text-slate-400">Modelo ultra-rápido do Google</span>
                  </div>
                </div>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${hasGemini ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}">
                  ${hasGemini ? 'Configurado' : 'Pendente'}
                </span>
              </div>

              <form onsubmit="ZGestorApp.salvarChaveIA(event)" class="space-y-3 text-xs">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Chave de API Gemini (API Key)</label>
                  <div class="relative">
                    <input
                      id="f-ia-apikey"
                      type="password"
                      value="${geminiKey}"
                      placeholder="Cole a chave (AIzaSy...)"
                      class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-9 font-mono text-xs focus:border-indigo-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onclick="ZGestorApp.toggleVerChaveIA()"
                      class="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer">
                      <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                    </button>
                  </div>
                </div>

                <div>
                  <label class="block font-bold text-slate-700 mb-1">Modelo Gemini</label>
                  <select id="f-ia-modelo" class="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold">
                    <option value="gemini-2.5-flash" ${(!iaConfig.gemini_modelo || iaConfig.gemini_modelo.startsWith('gemini-1.5-') || iaConfig.gemini_modelo === 'gemini-2.5-flash') ? 'selected' : ''}>gemini-2.5-flash (Recomendado — Rápido)</option>
                    <option value="gemini-2.0-flash" ${iaConfig.gemini_modelo === 'gemini-2.0-flash' ? 'selected' : ''}>gemini-2.0-flash (Estável & Veloz)</option>
                    <option value="gemini-2.5-pro" ${iaConfig.gemini_modelo === 'gemini-2.5-pro' ? 'selected' : ''}>gemini-2.5-pro (Raciocínio Avançado)</option>
                  </select>
                </div>

                <div class="flex items-center justify-between pt-1 gap-2">
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    class="text-[11px] font-bold text-indigo-600 hover:underline inline-flex items-center gap-1">
                    <i data-lucide="external-link" class="w-3 h-3"></i>
                    Obter no Google AI Studio
                  </a>
                  <div class="flex items-center gap-1.5">
                    <button
                      type="button"
                      onclick="ZGestorApp.testarConexaoIA()"
                      class="px-2.5 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-[11px] border border-teal-200 transition cursor-pointer">
                      Testar
                    </button>
                    <button
                      type="submit"
                      class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] shadow-xs transition cursor-pointer">
                      Salvar Gemini
                    </button>
                  </div>
                </div>
              </form>
            </div>

            <!-- COLUNA 2: OPENAI (CHATGPT) -->
            <div class="p-4 rounded-xl border ${provedorAtivo === 'openai' ? 'border-indigo-300 bg-indigo-50/20' : 'border-slate-200 bg-white'} space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-xs">O</span>
                  <div>
                    <h3 class="font-bold text-slate-800 text-xs">OpenAI API (ChatGPT)</h3>
                    <span class="text-[10px] text-slate-400">Modelos GPT-4o Mini e GPT-4o</span>
                  </div>
                </div>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${hasOpenAI ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}">
                  ${hasOpenAI ? 'Configurado' : 'Pendente'}
                </span>
              </div>

              <form onsubmit="ZGestorApp.salvarChaveOpenAI(event)" class="space-y-3 text-xs">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Chave de API OpenAI (sk-...)</label>
                  <div class="relative">
                    <input
                      id="f-ia-openaikey"
                      type="password"
                      value="${openaiKey}"
                      placeholder="Cole sua chave OpenAI (sk-...)"
                      class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-9 font-mono text-xs focus:border-indigo-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onclick="ZGestorApp.toggleVerChaveOpenAI()"
                      class="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer">
                      <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                    </button>
                  </div>
                </div>

                <div>
                  <label class="block font-bold text-slate-700 mb-1">Modelo ChatGPT</label>
                  <select id="f-ia-openai-modelo" class="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold">
                    <option value="gpt-4o-mini" ${(iaConfig.openai_modelo || 'gpt-4o-mini') === 'gpt-4o-mini' ? 'selected' : ''}>gpt-4o-mini (Recomendado - Rápido e Econômico)</option>
                    <option value="gpt-4o" ${iaConfig.openai_modelo === 'gpt-4o' ? 'selected' : ''}>gpt-4o (Mais Inteligente e Completo)</option>
                    <option value="gpt-3.5-turbo" ${iaConfig.openai_modelo === 'gpt-3.5-turbo' ? 'selected' : ''}>gpt-3.5-turbo (Clássico)</option>
                  </select>
                </div>

                <div class="flex items-center justify-between pt-1 gap-2">
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    class="text-[11px] font-bold text-emerald-600 hover:underline inline-flex items-center gap-1">
                    <i data-lucide="external-link" class="w-3 h-3"></i>
                    Obter na OpenAI Platform
                  </a>
                  <div class="flex items-center gap-1.5">
                    <button
                      type="button"
                      onclick="ZGestorApp.testarConexaoOpenAI()"
                      class="px-2.5 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-[11px] border border-teal-200 transition cursor-pointer">
                      Testar
                    </button>
                    <button
                      type="submit"
                      class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs transition cursor-pointer">
                      Salvar OpenAI
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>

          <div class="flex justify-end pt-2">
            <button
              type="button"
              onclick="ZGestorApp.toggleCardConfigIA()"
              class="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer">
              Fechar Painel de Configuração
            </button>
          </div>
        </div>

        <!-- NAVEGAÇÃO DE SUB-ABAS DE IA (4 FERRAMENTAS) -->
        <div class="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-2 text-xs">
          <div class="flex flex-wrap items-center gap-1.5">
            <button
              onclick="ZGestorApp.setSubTabIA('diagnostico')"
              class="px-3.5 py-2 rounded-xl font-bold flex items-center gap-2 transition ${subTab === 'diagnostico' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}">
              <i data-lucide="activity" class="w-4 h-4"></i>
              <span>1. Diagnóstico da Competência (${comp})</span>
            </button>
            <button
              onclick="ZGestorApp.setSubTabIA('chat')"
              class="px-3.5 py-2 rounded-xl font-bold flex items-center gap-2 transition ${subTab === 'chat' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}">
              <i data-lucide="messages-square" class="w-4 h-4"></i>
              <span>2. Consultor Tributário (Chat IA)</span>
            </button>
            <button
              onclick="ZGestorApp.setSubTabIA('comunicados')"
              class="px-3.5 py-2 rounded-xl font-bold flex items-center gap-2 transition ${subTab === 'comunicados' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}">
              <i data-lucide="send" class="w-4 h-4"></i>
              <span>3. Redator de Cobrança & Mensagens</span>
            </button>
            <button
              onclick="ZGestorApp.setSubTabIA('chamados')"
              class="px-3.5 py-2 rounded-xl font-bold flex items-center gap-2 transition ${subTab === 'chamados' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}">
              <i data-lucide="life-buoy" class="w-4 h-4"></i>
              <span>4. Respostas de Chamados (${chamadosAbertos.length})</span>
            </button>
          </div>
        </div>

        <!-- CONTEÚDO DA SUB-ABA SELECIONADA -->
        ${subTab === 'diagnostico' ? `
          <!-- ABA 1: DIAGNÓSTICO E AUDITORIA PREVENTIVA -->
          <div class="space-y-4">
            <!-- KPIs da Competência Atual -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span class="text-[11px] font-bold uppercase text-slate-500">Empresas Monitoradas</span>
                <div class="text-2xl font-black text-slate-900 mt-1">${empresas.length}</div>
                <span class="text-[11px] text-slate-500">Cadastradas no escritório</span>
              </div>
              <div class="bg-white p-4 rounded-2xl border border-indigo-200 shadow-sm">
                <span class="text-[11px] font-bold uppercase text-indigo-700">Conformidade das Obrigações</span>
                <div class="text-2xl font-black text-indigo-600 mt-1">${taxaObrigacoes}%</div>
                <span class="text-[11px] text-slate-500">${tarefasConcluidas.length} entregues de ${tarefasComp.length}</span>
              </div>
              <div class="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm">
                <span class="text-[11px] font-bold uppercase text-amber-700">CNDs em Risco / Atenção</span>
                <div class="text-2xl font-black text-amber-600 mt-1">${cndsAlertas.length}</div>
                <span class="text-[11px] text-slate-500">Vencendo ou com pendência</span>
              </div>
              <div class="bg-white p-4 rounded-2xl border border-rose-200 shadow-sm">
                <span class="text-[11px] font-bold uppercase text-rose-700">Honorários em Aberto</span>
                <div class="text-2xl font-black text-rose-600 mt-1">${this.formatCurrency(totalAberto)}</div>
                <span class="text-[11px] text-slate-500">${honorariosAbertos.length} cliente(s) pendente(s)</span>
              </div>
            </div>

            <!-- Painel de Execução do Diagnóstico -->
            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 class="text-sm font-bold text-slate-900">Relatório Executivo de Auditoria & Riscos Fiscais</h3>
                  <p class="text-xs text-slate-500">A IA analisa o banco de dados do escritório e cruza prazos, certidões e pagamentos</p>
                </div>
                <button
                  onclick="ZGestorApp.gerarDiagnosticoIA()"
                  id="btn-executar-diagnostico"
                  class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition cursor-pointer shrink-0">
                  <i data-lucide="sparkles" class="w-4 h-4 text-amber-300"></i>
                  <span>Executar Diagnóstico com IA</span>
                </button>
              </div>

              <div id="diagnostico-ia-conteudo" class="space-y-4 text-xs">
                ${appState.iaDiagnosticoResultado || `
                  <div class="p-6 rounded-2xl bg-indigo-50/50 border border-indigo-100 text-center space-y-2">
                    <div class="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center mx-auto">
                      <i data-lucide="cpu" class="w-6 h-6"></i>
                    </div>
                    <h4 class="font-bold text-indigo-950 text-sm">Auditoria Pronta para Execução</h4>
                    <p class="text-slate-600 max-w-md mx-auto text-xs">
                      Clique no botão acima para a IA auditar todas as empresas, apontar os riscos de multas tributárias e sugerir o plano de ação da semana.
                    </p>
                  </div>
                `}
              </div>
            </div>
          </div>
        ` : subTab === 'chat' ? `
          <!-- ABA 2: CONSULTOR TRIBUTÁRIO & FISCAL (CHAT IA) -->
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[calc(100dvh-230px)] min-h-[420px] max-h-[650px] overflow-hidden">
            <div class="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <i data-lucide="bot" class="w-4 h-4"></i>
                </div>
                <div>
                  <h3 class="text-xs font-bold text-slate-900">Consultor Tributário & Legislação Brasileira</h3>
                  <p class="text-[10px] text-slate-500">Tira-dúvidas sobre Simples Nacional, Lucro Presumido, DCTFWeb, EFD-Reinf e FGTS Digital</p>
                </div>
              </div>
              <button
                onclick="ZGestorApp.limparChatIA()"
                class="px-2.5 py-1 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-100 text-[11px] font-semibold transition cursor-pointer">
                Limpar Conversa
              </button>
            </div>

            <!-- Sugestões de Dúvidas Rápidas -->
            <div class="p-3 bg-indigo-50/50 border-b border-indigo-100 flex items-center gap-2 overflow-x-auto text-xs">
              <span class="text-[11px] font-bold text-indigo-900 shrink-0">Dúvidas Frequentes:</span>
              <button onclick="ZGestorApp.enviarPerguntaSugeridaIA('Quais são os prazos de entrega e vencimento da DCTFWeb e EFD-Reinf na competência atual?')" class="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-[11px] font-semibold shrink-0 cursor-pointer transition">
                📅 Prazos DCTFWeb & Reinf
              </button>
              <button onclick="ZGestorApp.enviarPerguntaSugeridaIA('Como calcular e comprovar o Fator R no Simples Nacional para tributar no Anexo III em vez do Anexo V?')" class="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-[11px] font-semibold shrink-0 cursor-pointer transition">
                📊 Regras do Fator R (Simples)
              </button>
              <button onclick="ZGestorApp.enviarPerguntaSugeridaIA('Quais certidões negativas (CNDs) são estritamente obrigatórias para homologação em licitações públicas federais?')" class="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-[11px] font-semibold shrink-0 cursor-pointer transition">
                🏛️ CNDs para Licitações
              </button>
              <button onclick="ZGestorApp.enviarPerguntaSugeridaIA('Qual o procedimento correto para emitir a guia DARF de parcelamento rescindido ou em atraso na PGFN/Regularize?')" class="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-[11px] font-semibold shrink-0 cursor-pointer transition">
                📑 Parcelamento PGFN Atrasado
              </button>
            </div>

            <!-- Mensagens do Chat -->
            <div id="chat-ia-mensagens" class="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/50 text-xs">
              ${(appState.iaChatHistorico && appState.iaChatHistorico.length > 0) ? appState.iaChatHistorico.map(m => `
                <div class="flex items-start gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}">
                  ${m.role === 'assistant' ? `
                    <div class="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                      <i data-lucide="bot" class="w-3.5 h-3.5"></i>
                    </div>
                  ` : ''}
                  <div class="max-w-[85%] sm:max-w-[75%] p-3.5 rounded-2xl ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-xs shadow-xs' : 'bg-white text-slate-800 rounded-tl-xs border border-slate-200 shadow-xs'} space-y-1">
                    <div class="font-bold text-[10px] uppercase tracking-wider ${m.role === 'user' ? 'text-indigo-200' : 'text-indigo-600'}">
                      ${m.role === 'user' ? 'Você (Contador)' : 'Assistente Z-IA'}
                    </div>
                    <div class="whitespace-pre-line leading-relaxed text-xs">
                      ${this.escapeHtml(m.content || '')}
                    </div>
                  </div>
                  ${m.role === 'user' ? `
                    <div class="w-7 h-7 rounded-lg bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                      <i data-lucide="user" class="w-3.5 h-3.5"></i>
                    </div>
                  ` : ''}
                </div>
              `).join('') : `
                <div class="text-center py-12 space-y-2 text-slate-400">
                  <div class="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                    <i data-lucide="messages-square" class="w-6 h-6"></i>
                  </div>
                  <h4 class="font-bold text-slate-700 text-sm">Olá! Sou o Assistente IA do ZGESTOR</h4>
                  <p class="text-xs max-w-md mx-auto text-slate-500">
                    Faça qualquer pergunta técnica sobre obrigações acessórias, regimes tributários, prazos de guias ou parcelamentos fiscais.
                  </p>
                </div>
              `}
            </div>

            <!-- Caixa de Envio -->
            <form autocomplete="off" onsubmit="ZGestorApp.enviarMensagemChatIA(event)" class="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
              <input
                id="f-chat-ia-input"
                type="text"
                autocomplete="off"
                required
                placeholder="Digite sua dúvida contábil ou fiscal (ex: Prazo de entrega da EFD-Reinf sem movimento)..."
                class="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none font-medium"
              />
              <button
                type="submit"
                id="btn-enviar-chat-ia"
                class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition cursor-pointer shrink-0">
                <span>Enviar</span>
                <i data-lucide="send" class="w-3.5 h-3.5"></i>
              </button>
            </form>
          </div>
        ` : subTab === 'comunicados' ? `
          <!-- ABA 3: GERADOR DE COMUNICADOS & COBRANÇA -->
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div class="pb-3 border-b border-slate-100">
              <h3 class="text-sm font-bold text-slate-900">Gerador Inteligente de Comunicados & Cobranças</h3>
              <p class="text-xs text-slate-500">Crie mensagens personalizadas com 1 clique para WhatsApp e E-mail com dados reais do cliente</p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Finalidade da Mensagem *</label>
                <select id="f-comunicado-tipo" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold text-slate-800 bg-white">
                  <option value="COBRANCA">Lembrete Amigável de Honorários (PIX)</option>
                  <option value="GUIAS">Aviso de Disponibilização de Guias do Mês</option>
                  <option value="DOCUMENTOS">Solicitação de Documentos Mensais (Extratos/Notas)</option>
                  <option value="CND">Comunicado de Regularidade & Certidão Negativa</option>
                </select>
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1">Empresa Destinatária *</label>
                ${this.renderSeletorEmpresaBusca({
                  uid: 'ia-comunicado-emp',
                  inputId: 'f-comunicado-empresa',
                  selectedId: empresas[0] ? empresas[0].id : '',
                  placeholder: 'Digite código, razão social ou CNPJ...'
                })}
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1">Canal de Envio</label>
                <select id="f-comunicado-canal" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-semibold text-slate-800 bg-white">
                  <option value="WHATSAPP">WhatsApp (Formatação com negrito)</option>
                  <option value="EMAIL">E-mail Formal do Escritório</option>
                </select>
              </div>
            </div>

            <div class="flex justify-end pt-1">
              <button
                type="button"
                onclick="ZGestorApp.gerarComunicadoIA()"
                class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition cursor-pointer">
                <i data-lucide="sparkles" class="w-4 h-4 text-amber-300"></i>
                <span>Redigir Mensagem com IA</span>
              </button>
            </div>

            <!-- Caixa com o Texto Gerado -->
            <div class="space-y-2 pt-2 border-t border-slate-100 text-xs">
              <div class="flex items-center justify-between">
                <label class="font-bold text-slate-700">Texto Gerado (Editável):</label>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    onclick="ZGestorApp.copiarTextoComunicadoIA()"
                    class="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] border border-indigo-200 flex items-center gap-1 transition cursor-pointer">
                    <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                    <span>Copiar Mensagem</span>
                  </button>
                  <button
                    type="button"
                    onclick="ZGestorApp.abrirWhatsAppComunicadoIA()"
                    class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 transition cursor-pointer shadow-xs">
                    <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
                    <span>Enviar no WhatsApp</span>
                  </button>
                </div>
              </div>
              <textarea
                id="f-comunicado-resultado"
                rows="8"
                placeholder="Selecione os parâmetros e clique em 'Redigir Mensagem com IA' para gerar o texto automaticamente..."
                class="w-full rounded-2xl border border-slate-300 p-3.5 font-mono text-xs text-slate-800 bg-slate-50 focus:bg-white focus:border-indigo-600 focus:outline-none">${this.escapeHtml(appState.comunicadoIAGerado?.texto || '')}</textarea>
            </div>
          </div>
        ` : `
          <!-- ABA 4: RESPOSTAS INTELIGENTES PARA CHAMADOS DO PORTAL -->
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div class="pb-3 border-b border-slate-100">
              <h3 class="text-sm font-bold text-slate-900">Assistente de Respostas para Chamados do Portal</h3>
              <p class="text-xs text-slate-500">A IA elabora respostas técnicas, cordiais e fundamentadas para os pedidos abertos pelos clientes</p>
            </div>

            ${chamadosAbertos.length === 0 ? `
              <div class="p-8 text-center text-slate-400 text-xs">
                <i data-lucide="check-circle" class="w-8 h-8 text-emerald-500 mx-auto mb-2"></i>
                Nenhum chamado pendente no momento. Todos os atendimentos do Portal estão em dia!
              </div>
            ` : `
              <div class="space-y-3 text-xs">
                ${chamadosAbertos.map(ch => {
                  const emp = empresas.find(e => e.id === ch.empresa_id);
                  return `
                    <div class="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2.5">
                      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span class="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">${ch.departamento} • ${this.formatDate(ch.data_registro)}</span>
                          <h4 class="font-bold text-slate-900 text-sm mt-0.5">${this.escapeHtml(ch.titulo)}</h4>
                          <span class="text-[11px] text-slate-500">Cliente: <strong>${emp ? emp.nome_fantasia : '—'}</strong> • Solicitante: ${this.escapeHtml(ch.solicitante_cliente || '—')}</span>
                        </div>
                        <button
                          type="button"
                          onclick="ZGestorApp.gerarRespostaChamadoIA('${ch.id}')"
                          class="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer shrink-0">
                          <i data-lucide="sparkles" class="w-3.5 h-3.5 text-amber-300"></i>
                          <span>Gerar Minuta de Resposta</span>
                        </button>
                      </div>
                      <div class="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs">
                        ${this.escapeHtml(ch.descricao || 'Sem descrição')}
                      </div>
                      ${ch.resposta_contabilidade ? `
                        <div class="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs">
                          <strong>Resposta Atual da Contabilidade:</strong> ${this.escapeHtml(ch.resposta_contabilidade)}
                        </div>
                      ` : ''}
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>
        `}
      </div>
    `;
  }

};
