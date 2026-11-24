// =============================================================================
// ZGESTOR - Controlador Principal da Aplicação, Modais e Eventos
// - Honorários visível na Tela Inicial e no Menu SOMENTE para quem tem acesso
// - Delegação de Responsável em Lista Suspensa (<select>) nas Solicitações Avulsas/Tarefas
// - Seleção de Regime Tributário da Empresa nos Modelos Recorrentes (Criação e Edição)
// - Controle de Envio de Guias de Impostos (DAS Simples Nacional, DAE ICMS, DARF, FGTS)
// - Parcelamentos: Apenas Emitida e Enviada + Seletor de Status do Parcelamento
//   (Ativo, Ativo em Atraso, Encerrado por Falta de Pagamento, Encerrado por Opção)
// - Controle de CNDs (Certidões Negativas de Débitos) e Central do Cliente 360°
// =============================================================================

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

window.ZGestorApp = {
  state: {
    currentTab: 'dashboard',
    competencia: '10/2026', // Competência 10/2026 -> Entrega e Vencimento em 11/2026
    calendarioCompetenciaAberto: false,
    anoCalendarioHeader: 2026,
    subTabTarefas: 'obrigacoes', // 'obrigacoes' | 'fechamentos_geral' | 'guias_impostos'
    anoFechamentoContabil: 2026,
    filtroSetorFechamento: 'CONTABIL',
    filtroStatusGeralAnual: 'TODOS',
    subTabParcelamentos: 'guias', // 'guias' | 'cadastros'
    subTabCentralCliente: 'arquivos_portal', // 'arquivos_portal' | 'solicitacoes_portal' | 'visao_360'
    modoVisaoPortalCliente: false,
    filtroPastaPortal: 'TODAS',
    filtroTarefaCliente: 'TODOS',
    filtroTarefaDept: 'TODOS',
    filtroTarefaModalidade: 'TODOS',
    filtroTarefaStatus: 'TODOS',
    filtroTarefaBusca: '',
    filtroGuiaImpostoTipo: 'TODOS',
    filtroGuiaImpostoStatus: 'TODOS',
    filtroCNDCliente: 'TODOS',
    filtroCNDOrgao: 'TODOS',
    filtroCNDStatus: 'TODOS',
    filtroAlvaraEmpresa: 'TODAS',
    filtroAlvaraTipo: 'TODOS',
    filtroAlvaraStatus: 'TODOS',
    filtroAlvaraBusca: '',
    empresaCentralId: 'emp-01',
    filtroCentralCategoria: 'TODOS',
    filtroEmpresaBusca: '',
    filtroEmpresaRegime: 'TODOS',
    empresaOnboardingId: null,
    filtroOnboardingSomentePendentes: true,
    filtroOnboardingItensPendentes: false,
    rlsFiltroSetor: true,
    parcelamentoPendenteEdicao: null,
    arquivoPortalLeituraTemp: null,
    // Propriedades da Visão Notion Hub de Tarefas
    notionFiltroView: 'TODOS', // 'TODOS' | 'SIMPLES' | 'PRESUMIDO' | 'FISCAL' | 'CONTABIL' | 'PESSOAL'
    notionGruposColapsados: {}, // { 'NAO_INICIADA': false, 'PENDENTE': false, ... }
    notionSidePeekTarefaId: null,
    // Modo de Simulação do Portal do Cliente para Administradores
    modoSimulacaoCliente: null,
    // Inteligência Artificial & Z-IA
    subTabIA: 'diagnostico',
    chatIAHistorico: [],
    comunicadoIAGerado: null,
    diagnosticoIAResultado: null
  },

  init() {
    window.zgestorDB.sincronizarSaldosAnterioresHonorarios(this.state.competencia);
    window.zgestorDB.sincronizarPendenciasParcelamento(this.state.competencia);

    // Remove qualquer resquício de sessão antiga em localStorage para garantir tela de login na abertura
    try {
      localStorage.removeItem('zgestor_current_user_id_v1');
    } catch (_) {}

    const db = window.zgestorDB;
    const user = db.getCurrentUser();

    // Se o usuário logado for CLIENTE, trava estritamente em central_cliente
    if (user && user.cargo === 'CLIENTE') {
      this.state.currentTab = 'central_cliente';
    } else if (this.state.currentTab === 'seguranca' && (!user || user.cargo !== 'ADMIN')) {
      this.state.currentTab = 'dashboard';
    }

    // Processa ativação de convite via URL (?convite=TOKEN ou #convite=TOKEN)
    try {
      const urlParams = new URLSearchParams(window.location.search);
      let tokenConvite = urlParams.get('convite');
      if (!tokenConvite && window.location.hash) {
        const hashMatch = window.location.hash.match(/convite=([^&]+)/);
        if (hashMatch) tokenConvite = hashMatch[1];
      }
      if (tokenConvite) {
        setTimeout(() => {
          this.abrirTelaAtivacaoConta(tokenConvite);
        }, 150);
      }
    } catch (_) {}

    document.addEventListener('click', (ev) => {
      if (this.state.calendarioCompetenciaAberto && !ev.target.closest('#competencia-calendar-wrapper')) {
        this.state.calendarioCompetenciaAberto = false;
        this.renderHeader();
      }
      if (!ev.target.closest('#wrapper-filtro-empresa')) {
        this.fecharDropdownEmpresaFiltro();
      }
    });
    this.renderAll();
  },

  navigate(tab) {
    this.fecharMenuMobile();
    const db = window.zgestorDB;
    const user = db.getCurrentUser();

    // Se for CLIENTE ou se estiver em MODO SIMULAÇÃO DE CLIENTE:
    // Bloqueia qualquer rota interna e mantém no Portal do Cliente
    if ((user && user.cargo === 'CLIENTE') || this.state.modoSimulacaoCliente) {
      if (tab !== 'central_cliente') {
        this.showToast('Acesso restrito exclusivamente ao Portal do Cliente.', 'error');
        this.state.currentTab = 'central_cliente';
        this.renderAll();
        return;
      }
    }

    if (tab === 'honorarios' && !db.canAccessModule('honorarios', user)) {
      this.showToast('Acesso restrito: apenas Admin ou Financeiro podem acessar Honorários.', 'error');
      return;
    }
    if (tab === 'seguranca' && (!user || user.cargo !== 'ADMIN')) {
      this.showToast('Acesso restrito: apenas Administradores podem acessar Gestão de Usuários.', 'error');
      return;
    }
    this.state.currentTab = tab;
    this.renderAll();
  },

  irParaTarefa(tarefaId, empresaId) {
    const db = window.zgestorDB;
    this.state.currentTab = 'tarefas';
    this.state.subTabTarefas = 'obrigacoes';
    if (empresaId) {
      this.state.filtroTarefaCliente = empresaId;
    }
    this.renderAll();
    const emp = db.data.empresas.find(e => e.id === empresaId);
    const nome = emp ? emp.nome_fantasia : '';
    this.showToast(`Redirecionado para as tarefas ${nome ? 'de ' + nome : ''}`, 'info');
  },

  setCompetencia(novaComp) {
    this.state.competencia = novaComp;
    const partes = String(novaComp || '10/2026').split('/');
    if (partes[1]) {
      this.state.anoCalendarioHeader = Number(partes[1]);
      this.state.anoFechamentoContabil = Number(partes[1]);
    }
    this.state.calendarioCompetenciaAberto = false;
    window.zgestorDB.sincronizarSaldosAnterioresHonorarios(novaComp);
    window.zgestorDB.sincronizarPendenciasParcelamento(novaComp);
    this.renderAll();
  },

  toggleCalendarioCompetencia(ev) {
    if (ev) ev.stopPropagation();
    const [m, y] = String(this.state.competencia || '10/2026').split('/');
    if (!this.state.calendarioCompetenciaAberto && y) {
      this.state.anoCalendarioHeader = Number(y);
    }
    this.state.calendarioCompetenciaAberto = !this.state.calendarioCompetenciaAberto;
    this.renderHeader();
  },

  mudarAnoCalendario(delta, ev) {
    if (ev) ev.stopPropagation();
    this.state.anoCalendarioHeader = Number(this.state.anoCalendarioHeader || 2026) + Number(delta);
    this.renderHeader();
  },

  selecionarMesCalendario(mesNum, ano, ev) {
    if (ev) ev.stopPropagation();
    const novaComp = `${String(mesNum).padStart(2, '0')}/${ano}`;
    this.setCompetencia(novaComp);
    this.showToast(`Competência alterada para ${window.zgestorDB.formatarNomeCompetencia(novaComp)} (${novaComp})!`, 'info');
  },

  passoCompetencia(deltaMes) {
    const [mStr, yStr] = String(this.state.competencia || '10/2026').split('/');
    let m = parseInt(mStr, 10) + Number(deltaMes);
    let y = parseInt(yStr, 10);
    if (m > 12) {
      m = 1;
      y += 1;
    } else if (m < 1) {
      m = 12;
      y -= 1;
    }
    const novaComp = `${String(m).padStart(2, '0')}/${y}`;
    this.setCompetencia(novaComp);
  },

  setFiltro(chave, valor) {
    this.state[chave] = valor;
    this.renderContentOnly();
  },

  setFiltroOnboardingPendentes(somentePendentes) {
    this.state.filtroOnboardingSomentePendentes = Boolean(somentePendentes);
    this.renderAll();
  },

  trocarUsuarioSessao(userId) {
    const db = window.zgestorDB;
    if (!db.isAdmin()) {
      this.showToast('Apenas Administradores podem alternar perfis de usuário.', 'error');
      throw new Error('Acesso não autorizado para troca de usuário.');
    }
    db.setCurrentUser(userId);
    const user = db.getCurrentUser();
    if (this.state.currentTab === 'honorarios' && !db.canAccessModule('honorarios', user)) {
      this.state.currentTab = 'dashboard';
    }
    this.showToast(`Sessão alterada para ${user.nome} (${user.departamento}).`, 'info');
    this.renderAll();
  },

  showToast(msg, tipo = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const colors = {
      success: 'bg-emerald-600 text-white',
      error: 'bg-rose-600 text-white',
      info: 'bg-slate-900 text-white'
    };
    const el = document.createElement('div');
    el.className = `px-4 py-3 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 transition-all duration-300 ${colors[tipo] || colors.info}`;
    el.innerHTML = `<span>${msg}</span>`;
    container.appendChild(el);
    setTimeout(() => {
      if (el && el.style) el.style.opacity = '0';
      setTimeout(() => { if (el && typeof el.remove === 'function') el.remove(); }, 300);
    }, 4200);
  },

  renderAll() {
    const db = window.zgestorDB;
    const user = db.getCurrentUser();
    const authScreen = document.getElementById('app-auth-screen');
    const authWrapper = document.getElementById('app-authenticated');
    const sidebar = document.getElementById('main-sidebar');
    const bannerContainer = document.getElementById('simulacao-portal-banner');

    if (!user) {
      if (authWrapper) authWrapper.classList.add('hidden');
      if (bannerContainer) bannerContainer.innerHTML = '';
      if (authScreen) {
        authScreen.classList.remove('hidden');
        authScreen.innerHTML = window.ZGestorViews.renderLogin(this.state);
        if (window.lucide) window.lucide.createIcons();
      }
      return;
    }

    if (authScreen) authScreen.classList.add('hidden');
    if (authWrapper) authWrapper.classList.remove('hidden');

    const isCliente = user.cargo === 'CLIENTE';
    const isSimulacao = Boolean(this.state.modoSimulacaoCliente && this.state.modoSimulacaoCliente.ativo);

    // Se o perfil for "Cliente" ou estiver em Modo Simulação:
    // 1. Redireciona exclusivamente para o Portal do Cliente
    // 2. Oculta COMPLETAMENTE o menu lateral interno do escritório
    if (isCliente || isSimulacao) {
      this.state.currentTab = 'central_cliente';
      if (sidebar) sidebar.classList.add('hidden');
    } else {
      if (sidebar) sidebar.classList.remove('hidden');
    }

    // Renderiza banner discreto de simulação no topo se estiver ativo
    if (bannerContainer) {
      if (isSimulacao) {
        const sim = this.state.modoSimulacaoCliente;
        bannerContainer.innerHTML = `
          <div class="bg-amber-500 text-slate-950 px-4 py-2.5 flex items-center justify-between shadow-md text-xs font-bold w-full border-b border-amber-600 sticky top-0 z-50">
            <div class="flex items-center gap-2.5">
              <div class="w-6 h-6 rounded-lg bg-slate-950 text-amber-400 flex items-center justify-center font-bold text-[11px] shrink-0">
                <i data-lucide="eye" class="w-3.5 h-3.5"></i>
              </div>
              <span>Modo Simulação: Visualizando como <strong>${sim.clienteNome}</strong> (${sim.empresaNome})</span>
            </div>
            <button
              type="button"
              onclick="ZGestorApp.encerrarSimulacaoCliente()"
              class="px-3.5 py-1.5 bg-slate-950 hover:bg-slate-900 text-amber-400 hover:text-amber-300 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 shadow-sm cursor-pointer">
              <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
              <span>Voltar para Administração</span>
            </button>
          </div>
        `;
      } else {
        bannerContainer.innerHTML = '';
      }
    }

    if (!isCliente && !isSimulacao) {
      this.renderSidebar();
    }
    this.renderHeader();
    this.renderContentOnly();
  },

  submitLogin(e) {
    e.preventDefault();
    try {
      const email = document.getElementById('login-email').value.trim();
      const senha = document.getElementById('login-senha').value.trim();
      const user = window.zgestorDB.login(email, senha);
      this.showToast(`Bem-vindo(a), ${user.nome}!`, 'success');

      // Roteamento pós-login:
      // Se for Cliente: redireciona diretamente e exclusivamente para o Portal do Cliente
      // Se for Escritório (Admin/Colaborador): redireciona para a Visão Geral (dashboard)
      if (user.cargo === 'CLIENTE') {
        this.state.currentTab = 'central_cliente';
      } else {
        this.state.currentTab = 'dashboard';
      }

      this.renderAll();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  logout() {
    this.state.modoSimulacaoCliente = null;
    window.zgestorDB.logout();
    this.showToast('Sessão encerrada com segurança.', 'info');
    this.renderAll();
  },

  iniciarSimulacaoCliente(clienteId) {
    const db = window.zgestorDB;
    const adminAtual = db.getCurrentUser();
    if (!adminAtual || adminAtual.cargo !== 'ADMIN') {
      this.showToast('Apenas Administradores podem testar o Portal do Cliente.', 'error');
      return;
    }
    const cli = (db.data.profiles || []).find(p => p.id === clienteId && p.cargo === 'CLIENTE');
    if (!cli) {
      this.showToast('Perfil do cliente não encontrado.', 'error');
      return;
    }
    const emp = db.data.empresas.find(e => e.id === cli.empresa_id);

    this.state.modoSimulacaoCliente = {
      ativo: true,
      adminOriginalId: adminAtual.id,
      clienteId: cli.id,
      clienteNome: cli.nome,
      empresaNome: emp ? emp.nome_fantasia : 'Empresa Vinculada'
    };

    // Altera a sessão para o cliente com RLS ativado
    db.setCurrentUser(cli.id);
    this.state.currentTab = 'central_cliente';
    this.showToast(`Modo Simulação ativado: visualizando como ${cli.nome}`, 'info');
    this.renderAll();
  },

  encerrarSimulacaoCliente() {
    if (!this.state.modoSimulacaoCliente) return;
    const adminId = this.state.modoSimulacaoCliente.adminOriginalId;
    const db = window.zgestorDB;
    this.state.modoSimulacaoCliente = null;
    db.setCurrentUser(adminId, true);
    this.state.currentTab = 'seguranca';
    this.state.subTabSeguranca = 'clientes';
    this.showToast('Modo Simulação encerrado. Painel administrativo restaurado.', 'success');
    this.renderAll();
  },

  preencherLoginDemo(email, senha = '123456') {
    const emailEl = document.getElementById('login-email');
    const senhaEl = document.getElementById('login-senha');
    if (emailEl) emailEl.value = email;
    if (senhaEl) senhaEl.value = senha;
    this.showToast(`Credencial preenchida: ${email}`, 'info');
  },

  toggleVerSenha() {
    const senhaEl = document.getElementById('login-senha');
    const iconEl = document.getElementById('icon-ver-senha');
    if (!senhaEl) return;
    if (senhaEl.type === 'password') {
      senhaEl.type = 'text';
      if (iconEl) iconEl.setAttribute('data-lucide', 'eye-off');
    } else {
      senhaEl.type = 'password';
      if (iconEl) iconEl.setAttribute('data-lucide', 'eye');
    }
    if (window.lucide) window.lucide.createIcons();
  },

  toggleSidebar() {
    this.state.sidebarCollapsed = !this.state.sidebarCollapsed;
    this.renderSidebar();
  },

  abrirMenuMobile() {
    const sb = document.getElementById('main-sidebar');
    const backdrop = document.getElementById('mobile-sidebar-backdrop');
    if (sb) {
      sb.classList.remove('-translate-x-full');
      sb.classList.add('translate-x-0');
    }
    if (backdrop) backdrop.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  },

  fecharMenuMobile() {
    const sb = document.getElementById('main-sidebar');
    const backdrop = document.getElementById('mobile-sidebar-backdrop');
    if (sb) {
      sb.classList.add('-translate-x-full');
      sb.classList.remove('translate-x-0');
    }
    if (backdrop) backdrop.classList.add('hidden');
  },

  // Validação centralizada de arquivos de upload (extensões e limite de 15 MB)
  validarArquivoUpload(file, formatosPermitidos, maxMb = 15) {
    if (!file) return { valido: false, erro: 'Nenhum arquivo selecionado.' };
    const maxBytes = maxMb * 1024 * 1024;
    if (file.size > maxBytes) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      return {
        valido: false,
        erro: `O arquivo "${file.name}" possui ${mb} MB e ultrapassa o limite máximo permitido de ${maxMb} MB.`
      };
    }
    const ext = '.' + (file.name || '').split('.').pop().toLowerCase();
    const permitidos = formatosPermitidos.map(f => f.toLowerCase());
    if (!permitidos.includes(ext)) {
      return {
        valido: false,
        erro: `Formato de arquivo "${ext}" não suportado. Formatos aceitos: ${formatosPermitidos.join(', ')}.`
      };
    }
    return { valido: true, extensao: ext };
  },

  // Identificador visual e ícones para arquivos por extensão
  obterIconeEBadgeArquivo(nomeOuExt) {
    const ext = (nomeOuExt || '').split('.').pop().toLowerCase();
    if (ext === 'pdf') {
      return {
        icone: 'file-text',
        corTexto: 'text-rose-600',
        corBg: 'bg-rose-50',
        corBorder: 'border-rose-200',
        tipoLabel: 'PDF',
        mime: 'application/pdf'
      };
    }
    if (ext === 'xml') {
      return {
        icone: 'file-code',
        corTexto: 'text-amber-600',
        corBg: 'bg-amber-50',
        corBorder: 'border-amber-200',
        tipoLabel: 'XML',
        mime: 'application/xml'
      };
    }
    if (['xlsx', 'xls', 'csv'].includes(ext)) {
      return {
        icone: 'file-spreadsheet',
        corTexto: 'text-emerald-600',
        corBg: 'bg-emerald-50',
        corBorder: 'border-emerald-200',
        tipoLabel: ext.toUpperCase(),
        mime: 'application/vnd.ms-excel'
      };
    }
    if (['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext)) {
      return {
        icone: 'image',
        corTexto: 'text-blue-600',
        corBg: 'bg-blue-50',
        corBorder: 'border-blue-200',
        tipoLabel: ext.toUpperCase(),
        mime: 'image/' + (ext === 'jpg' ? 'jpeg' : ext)
      };
    }
    return {
      icone: 'file',
      corTexto: 'text-slate-600',
      corBg: 'bg-slate-50',
      corBorder: 'border-slate-200',
      tipoLabel: ext ? ext.toUpperCase() : 'DOC',
      mime: 'application/octet-stream'
    };
  },

  renderSidebar() {
    const sb = document.getElementById('sidebar-nav');
    if (!sb) return;
    const db = window.zgestorDB;
    const user = db.getCurrentUser();
    const canSeeHon = db.canAccessModule('honorarios', user);
    const isAdmin = Boolean(user && (user.cargo === 'ADMIN' || db.isAdmin(user)));
    const tab = this.state.currentTab;
    const collapsed = Boolean(this.state.sidebarCollapsed);

    // Ajusta a largura e classes visuais da Sidebar
    const sidebarEl = document.getElementById('main-sidebar');
    const brandTexts = (typeof document.querySelectorAll === 'function') ? document.querySelectorAll('.sidebar-brand-text') : [];
    const toggleBtnEl = document.getElementById('sidebar-toggle-btn');
    const toggleIconEl = document.getElementById('sidebar-toggle-icon');

    if (sidebarEl) {
      if (collapsed) {
        sidebarEl.classList.remove('lg:w-56', 'xl:w-60');
        sidebarEl.classList.add('lg:w-20');
      } else {
        sidebarEl.classList.remove('lg:w-20');
        sidebarEl.classList.add('lg:w-56', 'xl:w-60');
      }
    }

    if (brandTexts && brandTexts.forEach) {
      brandTexts.forEach(el => {
        if (collapsed) el.classList.add('hidden');
        else el.classList.remove('hidden');
      });
    }

    if (toggleBtnEl) {
      toggleBtnEl.title = collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral';
    }
    if (toggleIconEl && typeof toggleIconEl.setAttribute === 'function') {
      toggleIconEl.setAttribute('data-lucide', collapsed ? 'chevrons-right' : 'chevrons-left');
    }

    // Rodapé técnico: exibido SOMENTE para Administrador
    const footerEl = document.getElementById('sidebar-technical-footer');
    if (footerEl) {
      if (!isAdmin) {
        if (footerEl.style) footerEl.style.display = 'none';
        else footerEl.hidden = true;
      } else {
        if (footerEl.style) footerEl.style.display = 'block';
        else footerEl.hidden = false;
        const footerTexts = (footerEl.querySelectorAll && typeof footerEl.querySelectorAll === 'function') ? footerEl.querySelectorAll('.sidebar-footer-text') : [];
        if (footerTexts && footerTexts.forEach) {
          footerTexts.forEach(el => {
            if (collapsed) el.classList.add('hidden');
            else el.classList.remove('hidden');
          });
        }
      }
    }

    // Alertas numéricos REAIS (badges visuais APENAS para contagens de alertas)
    const pendentesOnbCount = db.data.empresas ? db.data.empresas.filter(e => {
      const prog = db.obterProgressoOnboarding(e.id);
      return e.status === 'EM_ONBOARDING' && !prog.completo;
    }).length : 0;

    const cndsAlertas = db.getCNDs().filter(c => {
      const cod = db.calcularStatusValidadeCND(c).codigo;
      return cod === 'VENCIDA' || cod === 'PENDENCIA' || cod === 'VENCENDO';
    }).length;

    const parcAlertas = db.data.parcelamentos ? db.data.parcelamentos.filter(p =>
      p.status === 'EM_ATRASO' || p.status === 'ENCERRADO_FALTA_PAGAMENTO'
    ).length : 0;

    const alvarasAlertas = (db.data.alvaras || []).filter(a => {
      const cod = db.calcularStatusAlvara(a).codigo;
      return cod === 'VENCIDO' || cod === 'VENCENDO' || cod === 'ATENCAO';
    }).length;

    const chamadosPendentes = db.data.solicitacoes_portal ? db.data.solicitacoes_portal.filter(s =>
      s.status === 'ABERTA' || s.status === 'EM_ANDAMENTO'
    ).length : 0;

    // 4 BLOCOS COM SUBTÍTULOS DISCRETOS EM CAIXA ALTA
    const blocos = [
      {
        titulo: 'PRINCIPAL',
        itens: [
          { id: 'dashboard', label: 'Visão Geral', icon: 'layout-dashboard', badge: null },
          { id: 'inteligencia_ia', label: 'Assistente IA & Análises', icon: 'sparkles', badge: 'Novo' },
          { id: 'tarefas', label: 'Tarefas & Fechamentos', icon: 'check-square', badge: null }
        ]
      },
      {
        titulo: 'PORTAL & ATENDIMENTO',
        itens: [
          {
            id: 'central_cliente',
            label: 'Portal do Cliente',
            icon: 'globe',
            badge: chamadosPendentes > 0 ? chamadosPendentes : null,
            badgeCls: 'bg-amber-500 text-white'
          }
        ]
      },
      {
        titulo: 'FISCAL & REGULARIDADE',
        itens: [
          {
            id: 'parcelamentos',
            label: 'Parcelamentos',
            icon: 'layers',
            badge: parcAlertas > 0 ? parcAlertas : null,
            badgeCls: 'bg-rose-500 text-white'
          },
          {
            id: 'cnds',
            label: 'Controle de CNDs',
            icon: 'file-badge',
            badge: cndsAlertas > 0 ? cndsAlertas : null,
            badgeCls: 'bg-amber-500 text-white'
          },
          {
            id: 'alvaras',
            label: 'Alvarás & Licenças',
            icon: 'file-check',
            badge: alvarasAlertas > 0 ? alvarasAlertas : null,
            badgeCls: 'bg-rose-500 text-white'
          }
        ]
      },
      {
        titulo: 'GESTÃO & CADASTROS',
        itens: [
          { id: 'empresas', label: 'Minhas Empresas', icon: 'building-2', badge: null },
          {
            id: 'onboarding',
            label: 'Onboarding Clientes',
            icon: 'rocket',
            badge: pendentesOnbCount > 0 ? pendentesOnbCount : null,
            badgeCls: 'bg-amber-500 text-white'
          },
          ...(canSeeHon ? [{ id: 'honorarios', label: 'Honorários', icon: 'wallet', badge: null }] : []),
          ...(isAdmin || canSeeHon ? [{ id: 'escritorio', label: 'Dados do Escritório', icon: 'landmark', badge: null }] : []),
          ...(isAdmin ? [{ id: 'seguranca', label: 'Equipe & Acessos', icon: 'shield-check', badge: null }] : [])
        ]
      }
    ];

    sb.innerHTML = blocos.map(b => {
      return `
        <div class="space-y-1">
          ${!collapsed ? `
            <div class="text-[9.5px] font-extrabold uppercase tracking-wider text-slate-500 px-2.5 pt-1.5 pb-0.5">
              ${b.titulo}
            </div>
          ` : `
            <div class="w-8 mx-auto border-t border-slate-800 my-1"></div>
          `}
          ${b.itens.map(it => {
            const active = tab === it.id;
            return `
              <button
                onclick="ZGestorApp.navigate('${it.id}')"
                title="${it.label}${it.badge ? ' (' + it.badge + ' pendentes)' : ''}"
                class="w-full flex items-center ${collapsed ? 'justify-center p-2.5 relative' : 'justify-between px-3 py-2'} rounded-xl text-xs font-semibold transition cursor-pointer ${
                  active
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }">
                <span class="flex items-center gap-2.5 truncate">
                  <i data-lucide="${it.icon}" class="${collapsed ? 'w-5 h-5' : 'w-4 h-4'} shrink-0"></i>
                  ${!collapsed ? `<span class="truncate">${it.label}</span>` : ''}
                </span>
                ${it.badge ? (
                  collapsed
                    ? `<span class="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-extrabold flex items-center justify-center ${it.badgeCls || 'bg-rose-500 text-white'}">${it.badge}</span>`
                    : `<span class="px-1.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${it.badgeCls || 'bg-rose-500 text-white'}">${it.badge}</span>`
                ) : ''}
              </button>
            `;
          }).join('')}
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  },

  renderHeader() {
    const hdr = document.getElementById('top-header');
    if (!hdr) return;
    const db = window.zgestorDB;
    const user = db.getCurrentUser();
    if (!user) return;

    const isCliente = user.cargo === 'CLIENTE';
    const isSimulacao = Boolean(this.state.modoSimulacaoCliente && this.state.modoSimulacaoCliente.ativo);

    // Se for CLIENTE ou Modo Simulação de Cliente:
    // Exibe cabeçalho exclusivo do Portal do Cliente (sem botões de competência ou relatórios internos do escritório)
    if (isCliente || isSimulacao) {
      const emp = user.empresa_id ? db.data.empresas.find(e => e.id === user.empresa_id) : null;
      const nomeEmpresa = emp ? emp.nome_fantasia : (this.state.modoSimulacaoCliente ? this.state.modoSimulacaoCliente.empresaNome : 'Empresa Vinculada');

      hdr.innerHTML = `
        <div class="flex items-center justify-between w-full">
          <!-- Logo Oficial & Título da Central do Cliente -->
          <div class="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onclick="ZGestorApp.abrirMenuMobile()"
              class="md:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 hover:text-indigo-600 border border-slate-200 transition shrink-0 cursor-pointer"
              title="Abrir Menu">
              <i data-lucide="menu" class="w-5 h-5"></i>
            </button>
            <div class="w-10 h-10 rounded-xl bg-[#012147] border border-slate-700/80 p-1 flex items-center justify-center shrink-0 shadow-sm">
              <img
                src="./assets/icone-zioto.png"
                alt="Zioto Contabilidade"
                class="w-full h-full object-contain"
                onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
              />
              <span style="display:none;" class="font-extrabold text-amber-400 text-xs">ZC</span>
            </div>
            <div>
              <div class="font-black text-sm text-slate-900 tracking-tight leading-tight">ZIOTO CONTABILIDADE</div>
              <div class="text-[11px] text-indigo-700 font-bold flex items-center gap-1 leading-tight">
                <i data-lucide="globe" class="w-3 h-3 text-indigo-600"></i>
                Portal do Cliente • Documentos & Guias
              </div>
            </div>
          </div>

          <!-- Identidade do Cliente & Ações -->
          <div class="flex items-center gap-2">
            <div class="flex items-center gap-2.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs">
              <div class="w-8 h-8 rounded-lg bg-emerald-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-xs">
                ${(user.avatar_iniciais || (user.nome || 'CL').slice(0, 2)).toUpperCase()}
              </div>
              <div class="flex flex-col text-left">
                <span class="text-xs font-bold text-slate-900 leading-tight truncate max-w-[200px]" title="${user.nome}">
                  ${user.nome}
                </span>
                <span class="text-[10px] text-emerald-700 font-bold leading-tight">
                  🏢 ${nomeEmpresa}
                </span>
              </div>
            </div>

            ${isSimulacao ? `
              <button
                type="button"
                onclick="ZGestorApp.encerrarSimulacaoCliente()"
                class="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                title="Sair do modo simulação e voltar para a administração">
                <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
                <span class="hidden sm:inline">Voltar Admin</span>
              </button>
            ` : `
              <button
                type="button"
                onclick="ZGestorApp.logout()"
                class="px-3 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                title="Encerrar sessão com segurança">
                <i data-lucide="log-out" class="w-3.5 h-3.5 text-rose-600"></i>
                <span class="hidden sm:inline">Sair</span>
              </button>
            `}
          </div>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const comp = this.state.competencia;
    const sub = db.obterMesSubsequente(comp);
    const nomeComp = db.formatarNomeCompetencia(comp);
    const calAberto = Boolean(this.state.calendarioCompetenciaAberto);
    const anoCal = Number(this.state.anoCalendarioHeader || comp.split('/')[1] || 2026);
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
    const meses = mesesRaw.map(m => ({
      ...m,
      curto: m.curto || m.abrev || (m.nome && m.nome.slice(0, 3)) || ''
    }));

    hdr.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 w-full">
        <div class="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onclick="ZGestorApp.abrirMenuMobile()"
            class="md:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 hover:text-indigo-600 border border-slate-200 transition shrink-0 cursor-pointer"
            title="Abrir Menu">
            <i data-lucide="menu" class="w-5 h-5"></i>
          </button>
          <!-- SELETOR DE COMPETÊNCIA EM FORMATO DE CALENDÁRIO DE MESES -->
          <div id="competencia-calendar-wrapper" class="relative flex items-center gap-1 bg-indigo-50 p-1 rounded-xl border border-indigo-200 shadow-xs">
            <button
              type="button"
              onclick="ZGestorApp.passoCompetencia(-1)"
              title="Mês Anterior"
              class="px-2 py-1.5 rounded-lg hover:bg-white text-indigo-700 font-extrabold text-xs transition">
              ◀
            </button>

            <button
              type="button"
              onclick="ZGestorApp.toggleCalendarioCompetencia(event)"
              class="px-3 py-1.5 rounded-lg bg-white hover:bg-indigo-600 hover:text-white text-indigo-900 border border-indigo-200 font-extrabold text-xs flex items-center gap-2 transition shadow-2xs">
              <i data-lucide="calendar-days" class="w-4 h-4 text-indigo-600"></i>
              <span>Competência: <strong>${nomeComp} (${comp})</strong></span>
              <span class="hidden md:inline text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                Vence em ${sub.label}
              </span>
              <i data-lucide="chevron-down" class="w-3.5 h-3.5"></i>
            </button>

            <button
              type="button"
              onclick="ZGestorApp.passoCompetencia(1)"
              title="Próximo Mês"
              class="px-2 py-1.5 rounded-lg hover:bg-white text-indigo-700 font-extrabold text-xs transition">
              ▶
            </button>

            ${calAberto ? `
              <!-- POPOVER DO CALENDÁRIO DE MESES (JAN A DEZ) -->
              <div onclick="event.stopPropagation()" class="absolute left-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border-2 border-indigo-500 p-4 z-50">
                <div class="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                  <button
                    type="button"
                    onclick="ZGestorApp.mudarAnoCalendario(-1, event)"
                    class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-100 text-slate-700 font-bold text-xs">
                    ◀ ${anoCal - 1}
                  </button>
                  <div class="text-center">
                    <div class="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Calendário de Competência</div>
                    <div class="text-sm font-extrabold text-slate-900">Exercício ${anoCal}</div>
                  </div>
                  <button
                    type="button"
                    onclick="ZGestorApp.mudarAnoCalendario(1, event)"
                    class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-100 text-slate-700 font-bold text-xs">
                    ${anoCal + 1} ▶
                  </button>
                </div>

                <div class="grid grid-cols-3 gap-2">
                  ${meses.map(m => {
                    const compItem = `${m.num}/${anoCal}`;
                    const selecionado = compItem === comp;
                    const qtdTar = (db.data.tarefas || []).filter(t => t.competencia === compItem).length;
                    const qtdEntregues = (db.data.tarefas || []).filter(t => t.competencia === compItem && Boolean(t.data_entrega)).length;
                    return `
                      <button
                        type="button"
                        onclick="ZGestorApp.selecionarMesCalendario('${m.num}', ${anoCal}, event)"
                        class="p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                          selecionado
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-md ring-2 ring-indigo-500/30'
                            : 'bg-slate-50 hover:bg-indigo-50 text-slate-800 border-slate-200 hover:border-indigo-300'
                        }">
                        <div class="flex items-center justify-between w-full">
                          <span class="text-xs font-extrabold">${m.curto || m.abrev || (m.nome && m.nome.slice(0, 3)) || ''}</span>
                          <span class="text-[10px] font-mono ${selecionado ? 'text-indigo-200' : 'text-slate-400'}">${m.num}/${String(anoCal).slice(-2)}</span>
                        </div>
                        <div class="text-[11px] font-medium truncate mt-0.5 ${selecionado ? 'text-white' : 'text-slate-600'}">${m.nome}</div>
                        <div class="mt-1.5 flex items-center justify-between text-[10px]">
                          ${qtdTar > 0
                            ? `<span class="px-1.5 py-0.5 rounded font-bold ${
                                selecionado
                                  ? 'bg-white/20 text-white'
                                  : (qtdEntregues === qtdTar ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800')
                              }">${qtdEntregues}/${qtdTar}</span>`
                            : `<span class="${selecionado ? 'text-indigo-200' : 'text-slate-400'}">Selecionar</span>`}
                        </div>
                      </button>
                    `;
                  }).join('')}
                </div>

                <div class="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Clique em um mês para alternar a competência</span>
                  <button type="button" onclick="ZGestorApp.selecionarMesCalendario('10', 2026, event)" class="font-bold text-indigo-600 hover:underline">
                    Ir p/ Outubro/2026
                  </button>
                </div>
              </div>
            ` : ''}
          </div>

          <button onclick="ZGestorReports.emitirRelatorioAba(ZGestorApp.state.currentTab, ZGestorApp.state)" class="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white shadow-xs transition">
            <i data-lucide="printer" class="w-3.5 h-3.5"></i>
            Relatório da Aba Atual
          </button>
        </div>

        <div class="flex items-center gap-2">
          <!-- BADGE DE IDENTIDADE DO USUÁRIO LOGADO (SEM SELETOR PÚBLICO) -->
          <div class="flex items-center gap-2.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs">
            <div class="w-8 h-8 rounded-lg bg-indigo-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-xs">
              ${(user.avatar_iniciais || (user.nome || 'US').split(' ').map(n => n[0]).slice(0, 2).join('')).toUpperCase()}
            </div>
            <div class="flex flex-col text-left">
              <span class="text-xs font-bold text-slate-900 leading-tight truncate max-w-[200px]" title="${user.nome || ''}">
                ${user.nome || 'Usuário'}
              </span>
              <span class="text-[10px] text-slate-500 font-semibold leading-tight flex items-center gap-1">
                ${user.cargo === 'ADMIN' 
                  ? '<span class="text-indigo-600 font-bold">👑 Administrador</span>' 
                  : (user.cargo === 'CLIENTE' 
                      ? '<span class="text-emerald-600 font-bold">🏢 Cliente do Portal</span>' 
                      : `<span class="text-slate-600">Setor: <strong>${user.departamento || 'Geral'}</strong></span>`)}
              </span>
            </div>
          </div>

          <button
            onclick="ZGestorApp.logout()"
            class="px-3 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
            title="Encerrar sessão com segurança">
            <i data-lucide="log-out" class="w-3.5 h-3.5 text-rose-600"></i>
            <span class="hidden sm:inline">Sair</span>
          </button>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  },

  renderContentOnly() {
    const main = document.getElementById('main-view');
    if (!main) return;

    // Preserva foco e posição do cursor caso o usuário esteja digitando em um input (ex: filtros de busca)
    const activeEl = document.activeElement;
    const activeId = activeEl && activeEl.id ? activeEl.id : null;
    const selStart = activeEl && typeof activeEl.selectionStart === 'number' ? activeEl.selectionStart : null;
    const selEnd = activeEl && typeof activeEl.selectionEnd === 'number' ? activeEl.selectionEnd : null;

    let t = this.state.currentTab;
    const db = window.zgestorDB;
    const user = db.getCurrentUser();
    if (t === 'seguranca' && (!user || user.cargo !== 'ADMIN')) {
      this.state.currentTab = 'dashboard';
      t = 'dashboard';
    }
    const V = window.ZGestorViews;

    if (t === 'dashboard') main.innerHTML = V.renderDashboard(this.state);
    else if (t === 'central_cliente') main.innerHTML = V.renderCentralCliente(this.state);
    else if (t === 'tarefas') main.innerHTML = V.renderTarefas(this.state);
    else if (t === 'parcelamentos') main.innerHTML = V.renderParcelamentos(this.state);
    else if (t === 'cnds') main.innerHTML = V.renderCNDs(this.state);
    else if (t === 'alvaras') main.innerHTML = V.renderAlvaras(this.state);
    else if (t === 'empresas') main.innerHTML = V.renderEmpresas(this.state);
    else if (t === 'onboarding') main.innerHTML = V.renderOnboarding(this.state);
    else if (t === 'honorarios') main.innerHTML = V.renderHonorarios(this.state);
    else if (t === 'escritorio') main.innerHTML = V.renderEscritorio(this.state);
    else if (t === 'seguranca') main.innerHTML = V.renderSeguranca(this.state);
    else if (t === 'inteligencia_ia') main.innerHTML = V.renderInteligenciaIA(this.state);

    if (window.lucide) window.lucide.createIcons();

    if (activeId) {
      const restoredEl = document.getElementById(activeId);
      if (restoredEl && typeof restoredEl.focus === 'function') {
        restoredEl.focus();
        if (selStart !== null && selEnd !== null && typeof restoredEl.setSelectionRange === 'function') {
          try { restoredEl.setSelectionRange(selStart, selEnd); } catch (_) {}
        }
      }
    }
  },

  // ===========================================================================
  // AÇÕES RÁPIDAS DE ROTINA MENSAL
  // ===========================================================================
  gerarRotinaCompletaMes() {
    try {
      const comp = this.state.competencia;
      const sub = window.zgestorDB.obterMesSubsequente(comp);
      const tCriadas = window.zgestorDB.gerarTarefasCompetencia(comp);
      const giCriadas = window.zgestorDB.gerarGuiasImpostosCompetencia(comp);
      const gCriadas = window.zgestorDB.gerarGuiasParcelamentoCompetencia(comp);
      let hCriados = 0;
      if (window.zgestorDB.canAccessModule('honorarios')) {
        hCriados = window.zgestorDB.gerarHonorariosCompetencia(comp);
      }
      this.showToast(`Competência ${comp} (Venc. em ${sub.label}): ${tCriadas} tarefas, ${giCriadas} guias de impostos e ${gCriadas} parcelamentos gerados!`, 'success');
      this.renderAll();
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  },

  gerarTarefasMesAtual() {
    const comp = this.state.competencia;
    const sub = window.zgestorDB.obterMesSubsequente(comp);
    const qtd = window.zgestorDB.gerarTarefasCompetencia(comp);
    if (qtd > 0) {
      this.showToast(`${qtd} novas tarefas da competência ${comp} geradas respeitando o regime tributário (prazo em ${sub.label})!`, 'success');
    } else {
      this.showToast(`Todas as tarefas mensais padrão da competência ${comp} já foram geradas.`, 'info');
    }
    this.renderAll();
  },

  gerarGuiasImpostosMesAtual() {
    const comp = this.state.competencia;
    const sub = window.zgestorDB.obterMesSubsequente(comp);
    const qtd = window.zgestorDB.gerarGuiasImpostosCompetencia(comp);
    if (qtd > 0) {
      this.showToast(`${qtd} guias de impostos da competência ${comp} geradas com vencimento em ${sub.label}!`, 'success');
    } else {
      this.showToast(`As guias padrão de impostos para a competência ${comp} já foram geradas.`, 'info');
    }
    this.renderAll();
  },

  gerarGuiasParcelamentoMes() {
    const comp = this.state.competencia;
    const sub = window.zgestorDB.obterMesSubsequente(comp);
    const qtd = window.zgestorDB.gerarGuiasParcelamentoCompetencia(comp);
    window.zgestorDB.sincronizarPendenciasParcelamento(comp);
    if (qtd > 0) {
      this.showToast(`${qtd} guias de parcelamentos da competência ${comp} (vencimento em ${sub.label}) geradas!`, 'success');
    } else {
      this.showToast(`Guias e pendências anteriores de parcelamentos da competência ${comp} sincronizadas.`, 'info');
    }
    this.renderAll();
  },

  gerarHonorariosMesAtual() {
    try {
      const comp = this.state.competencia;
      const sub = window.zgestorDB.obterMesSubsequente(comp);
      const qtd = window.zgestorDB.gerarHonorariosCompetencia(comp);
      window.zgestorDB.sincronizarSaldosAnterioresHonorarios(comp);
      if (qtd > 0) {
        this.showToast(`${qtd} honorários da competência ${comp} gerados com vencimento em ${sub.label}!`, 'success');
      } else {
        this.showToast(`Honorários e saldos anteriores da competência ${comp} sincronizados.`, 'info');
      }
      this.renderAll();
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  },

  // ===========================================================================
  // MODAIS DE TAREFAS E SOLICITAÇÕES AVULSAS
  // ===========================================================================
  closeModal() {
    const modal = document.getElementById('modal-root');
    if (modal) modal.innerHTML = '';
  },

  openModalTarefa(tipoPadrao = 'AVULSA', tarefaExistente = null) {
    const db = window.zgestorDB;
    const user = db.getCurrentUser();
    const empList = db.data.empresas;
    const perfisEquipe = db.data.profiles || [];
    const comp = this.state.competencia;
    const sub = db.obterMesSubsequente(comp);
    const defaultPrazo = db.calcularDataMesSubsequente(comp, 18);

    const t = tarefaExistente || {
      id: '',
      empresa_id: empList[0] ? empList[0].id : '',
      competencia: comp,
      departamento: user.departamento !== 'TODOS' ? user.departamento : 'FISCAL',
      tipo: tipoPadrao,
      titulo: '',
      descricao: '',
      solicitante: tipoPadrao === 'AVULSA' ? 'Solicitação do Cliente' : 'Rotina Mensal',
      prazo_entrega: defaultPrazo,
      data_entrega: '',
      status: 'PENDENTE',
      responsavel_nome: user.nome,
      protocolo_observacao: ''
    };

    const stSimples = db.obterStatusSimplesTarefa(t);
    const nomesPerfis = perfisEquipe.map(p => p.nome);
    const responsavelForaDaLista = t.responsavel_nome && !nomesPerfis.includes(t.responsavel_nome);

    const modal = document.getElementById('modal-root');
    if (!modal) return;
    modal.innerHTML = `
      <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 class="text-base font-bold text-slate-900">
                ${t.id ? 'Editar Tarefa / Solicitação' : (t.tipo === 'AVULSA' ? 'Nova Solicitação Avulsa (Delegar para Responsável)' : 'Nova Tarefa Mensal')}
              </h3>
              <p class="text-[11px] text-indigo-700 font-semibold">Regra Contábil: Competência ${comp} → Prazo de Entrega sugerido em ${sub.label}</p>
            </div>
            <button onclick="ZGestorApp.closeModal()" class="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
          </div>

          <form onsubmit="ZGestorApp.submitFormTarefa(event)" class="space-y-4 mt-4 text-xs">
            <input type="hidden" id="f-tar-id" value="${t.id || ''}" />

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Empresa / Cliente *</label>
                <select id="f-tar-empresa" required class="w-full rounded-xl border border-slate-300 px-3 py-2">
                  ${empList.map(e => `<option value="${e.id}" ${e.id === t.empresa_id ? 'selected' : ''}>${e.nome_fantasia} (${e.regime_tributario})</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Competência (Mês/Ano) *</label>
                <input id="f-tar-comp" type="text" required value="${t.competencia}" placeholder="MM/AAAA" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold" />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Tipo de Tarefa (Departamento) *</label>
                <select id="f-tar-dept" required class="w-full rounded-xl border border-slate-300 px-3 py-2">
                  <option value="FISCAL" ${t.departamento === 'FISCAL' ? 'selected' : ''}>Fiscal</option>
                  <option value="CONTABIL" ${t.departamento === 'CONTABIL' ? 'selected' : ''}>Contábil</option>
                  <option value="PESSOAL" ${t.departamento === 'PESSOAL' ? 'selected' : ''}>Pessoal (DP)</option>
                  <option value="FINANCEIRO" ${t.departamento === 'FINANCEIRO' ? 'selected' : ''}>Financeiro</option>
                  <option value="SOCIETARIO" ${t.departamento === 'SOCIETARIO' ? 'selected' : ''}>Societário</option>
                </select>
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Modalidade *</label>
                <select id="f-tar-tipo" required class="w-full rounded-xl border border-slate-300 px-3 py-2">
                  <option value="MENSAL" ${t.tipo === 'MENSAL' ? 'selected' : ''}>Mensal Recorrente</option>
                  <option value="AVULSA" ${t.tipo === 'AVULSA' ? 'selected' : ''}>Avulsa (Solicitação do Cliente)</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Título da Tarefa / Solicitação Avulsa *</label>
              <input id="f-tar-titulo" type="text" required value="${escapeHtml(t.titulo)}" placeholder="Ex: Recálculo de Guia / Balancete p/ Licitação / Admissão urgente" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-indigo-50/70 border border-indigo-200">
              <div>
                <label class="block font-bold text-indigo-950 mb-1">Delegar para Responsável (Lista Suspensa) *</label>
                <select id="f-tar-resp" required class="w-full rounded-xl border border-indigo-300 px-3 py-2 bg-white font-bold text-indigo-900">
                  ${perfisEquipe.map(p => `
                    <option value="${p.nome}" ${p.nome === t.responsavel_nome ? 'selected' : ''}>
                      👤 ${p.nome} — Setor: ${p.departamento}
                    </option>
                  `).join('')}
                  ${responsavelForaDaLista ? `<option value="${t.responsavel_nome}" selected>👤 ${t.responsavel_nome}</option>` : ''}
                </select>
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Solicitante (Cliente ou Rotina)</label>
                <input id="f-tar-solic" type="text" value="${t.solicitante || ''}" placeholder="Ex: Sócio Henrique via WhatsApp" class="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white" />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <label class="block font-bold text-slate-800 mb-1">Status da Tarefa *</label>
                <select id="f-tar-status" class="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white font-bold">
                  <option value="NAO_INICIADA" ${stSimples === 'NAO_INICIADA' ? 'selected' : ''}>⚪ Não Iniciada</option>
                  <option value="PENDENTE" ${stSimples === 'PENDENTE' ? 'selected' : ''}>⏳ Pendente</option>
                  <option value="EM_ANDAMENTO" ${stSimples === 'EM_ANDAMENTO' ? 'selected' : ''}>🔄 Em Andamento</option>
                  <option value="ENTREGUE" ${stSimples === 'ENTREGUE' ? 'selected' : ''}>✅ Entregue</option>
                </select>
              </div>
              <div>
                <label class="block font-bold text-slate-800 mb-1">Prazo Limite *</label>
                <input id="f-tar-prazo" type="date" required value="${t.prazo_entrega}" class="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white font-semibold" />
              </div>
              <div>
                <label class="block font-bold text-emerald-800 mb-1">Data Entregue (Se Entregue)</label>
                <input id="f-tar-entrega" type="date" value="${t.data_entrega || ''}" class="w-full rounded-xl border border-emerald-300 px-3 py-2 bg-white" />
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Observação da Situação (Pendente / Em Andamento / Entregue)</label>
              <textarea id="f-tar-obs" rows="2" placeholder="Anote o motivo de estar pendente, o que está em andamento ou o protocolo de entrega..." class="w-full rounded-xl border border-indigo-300 px-3 py-2">${t.protocolo_observacao || ''}</textarea>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Descrição / Instruções Padrão</label>
              <textarea id="f-tar-desc" rows="2" class="w-full rounded-xl border border-slate-300 px-3 py-2">${escapeHtml(t.descricao || '')}</textarea>
            </div>

            <div class="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button type="button" onclick="ZGestorApp.closeModal()" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold">Cancelar</button>
              <button type="submit" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow">Salvar & Delegar Tarefa</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  openModalEditarTarefa(id) {
    const t = window.zgestorDB.data.tarefas.find(item => item.id === id);
    if (t) this.openModalTarefa(t.tipo, t);
  },

  submitFormTarefa(e) {
    e.preventDefault();
    try {
      const respNome = document.getElementById('f-tar-resp').value.trim();
      const perfil = (window.zgestorDB.data.profiles || []).find(p => p.nome === respNome);
      const statusSel = document.getElementById('f-tar-status').value;
      const hoje = new Date().toISOString().slice(0, 10);
      const dataEnt = document.getElementById('f-tar-entrega').value;
      const dados = {
        id: document.getElementById('f-tar-id').value || null,
        empresa_id: document.getElementById('f-tar-empresa').value,
        competencia: document.getElementById('f-tar-comp').value.trim(),
        departamento: document.getElementById('f-tar-dept').value,
        tipo: document.getElementById('f-tar-tipo').value,
        titulo: document.getElementById('f-tar-titulo').value.trim(),
        solicitante: document.getElementById('f-tar-solic').value.trim(),
        responsavel_id: perfil ? perfil.id : null,
        responsavel_nome: respNome,
        status: statusSel,
        prazo_entrega: document.getElementById('f-tar-prazo').value,
        data_entrega: statusSel === 'ENTREGUE' ? (dataEnt || hoje) : null,
        descricao: document.getElementById('f-tar-desc').value.trim(),
        protocolo_observacao: document.getElementById('f-tar-obs').value.trim()
      };
      window.zgestorDB.salvarTarefa(dados);
      this.closeModal();
      this.showToast(`Tarefa salva com status "${statusSel === 'ENTREGUE' ? 'Entregue' : statusSel === 'EM_ANDAMENTO' ? 'Em Andamento' : 'Pendente'}"!`, 'success');
      this.renderAll();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  // ===========================================================================
  // MODAL DE STATUS DA TAREFA (PENDENTE | EM ANDAMENTO | ENTREGUE) + OBSERVAÇÕES
  // ===========================================================================
  openModalStatusTarefa(tarefaId, statusInicial = null) {
    const db = window.zgestorDB;
    const t = db.data.tarefas.find(item => item.id === tarefaId);
    if (!t) return;
    const emp = db.data.empresas.find(e => e.id === t.empresa_id);
    const hoje = new Date().toISOString().slice(0, 10);
    const stSelecionado = statusInicial || db.obterStatusSimplesTarefa(t);

    const placeholdersObs = {
      NAO_INICIADA: 'Ex: Aguardando abertura do período contábil ou início dos trabalhos...',
      PENDENTE: 'Ex: Aguardando cliente enviar extrato bancário / XMLs de notas fiscais para iniciar...',
      EM_ANDAMENTO: 'Ex: Em conciliação contábil das contas de fornecedores; falta conferência final...',
      ENTREGUE: 'Ex: Fechamento concluído e entregue ao cliente via Portal / WhatsApp (Protocolo nº...)'
    };

    const modal = document.getElementById('modal-root');
    if (!modal) return;
    modal.innerHTML = `
      <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <span class="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Controle de Status e Observações da Tarefa</span>
              <h3 class="text-base font-bold text-slate-900">Atualizar Situação & Observações</h3>
            </div>
            <button onclick="ZGestorApp.closeModal()" class="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
          </div>

          <form onsubmit="ZGestorApp.submitStatusTarefa(event, '${t.id}')" class="space-y-4 mt-4 text-xs">
            <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div class="font-bold text-slate-900 text-sm">${escapeHtml(t.titulo)}</div>
              <div class="text-slate-600 mt-0.5">
                Empresa: <strong>${emp ? emp.nome_fantasia : '—'}</strong> • Competência: <strong>${t.competencia}</strong>
              </div>
              <div class="text-[11px] text-indigo-700 font-semibold mt-1">
                Prazo Limite: ${window.ZGestorViews.formatDate(t.prazo_entrega)} • Resp: ${t.responsavel_nome || '—'}
              </div>
            </div>

            <!-- Seletor das 4 Opções: Não Iniciada, Pendente, Em Andamento, Entregue -->
            <div>
              <label class="block font-bold text-slate-800 mb-2">Selecione a Opção de Situação da Tarefa *</label>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <label class="cursor-pointer">
                  <input
                    type="radio"
                    name="f-st-opcao"
                    value="NAO_INICIADA"
                    ${stSelecionado === 'NAO_INICIADA' ? 'checked' : ''}
                    onchange="ZGestorApp.aoAlternarOpcaoStatusModal(this.value)"
                    class="sr-only peer"
                  />
                  <div class="p-2.5 rounded-xl border-2 text-center transition peer-checked:border-slate-500 peer-checked:bg-slate-100 border-slate-200 hover:border-slate-300">
                    <div class="font-extrabold text-slate-700 text-xs">⚪ Não Iniciada</div>
                    <div class="text-[10px] text-slate-500 mt-0.5">Aguardando período</div>
                  </div>
                </label>

                <label class="cursor-pointer">
                  <input
                    type="radio"
                    name="f-st-opcao"
                    value="PENDENTE"
                    ${stSelecionado === 'PENDENTE' ? 'checked' : ''}
                    onchange="ZGestorApp.aoAlternarOpcaoStatusModal(this.value)"
                    class="sr-only peer"
                  />
                  <div class="p-2.5 rounded-xl border-2 text-center transition peer-checked:border-amber-500 peer-checked:bg-amber-50 border-slate-200 hover:border-amber-300">
                    <div class="font-extrabold text-amber-800 text-xs">⏳ Pendente</div>
                    <div class="text-[10px] text-slate-500 mt-0.5">Aguardando docs</div>
                  </div>
                </label>

                <label class="cursor-pointer">
                  <input
                    type="radio"
                    name="f-st-opcao"
                    value="EM_ANDAMENTO"
                    ${stSelecionado === 'EM_ANDAMENTO' ? 'checked' : ''}
                    onchange="ZGestorApp.aoAlternarOpcaoStatusModal(this.value)"
                    class="sr-only peer"
                  />
                  <div class="p-2.5 rounded-xl border-2 text-center transition peer-checked:border-sky-600 peer-checked:bg-sky-50 border-slate-200 hover:border-sky-300">
                    <div class="font-extrabold text-sky-800 text-xs">🔄 Em Andamento</div>
                    <div class="text-[10px] text-slate-500 mt-0.5">Em execução</div>
                  </div>
                </label>

                <label class="cursor-pointer">
                  <input
                    type="radio"
                    name="f-st-opcao"
                    value="ENTREGUE"
                    ${stSelecionado === 'ENTREGUE' ? 'checked' : ''}
                    onchange="ZGestorApp.aoAlternarOpcaoStatusModal(this.value)"
                    class="sr-only peer"
                  />
                  <div class="p-2.5 rounded-xl border-2 text-center transition peer-checked:border-emerald-600 peer-checked:bg-emerald-50 border-slate-200 hover:border-emerald-300">
                    <div class="font-extrabold text-emerald-800 text-xs">✅ Entregue</div>
                    <div class="text-[10px] text-slate-500 mt-0.5">Concluída</div>
                  </div>
                </label>
              </div>
            </div>
              </div>
            </div>

            <!-- Campo de Data de Entrega (Exibido quando Entregue está marcado) -->
            <div id="box-data-entrega-status" class="${stSelecionado === 'ENTREGUE' ? '' : 'hidden'} p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <label class="block font-bold text-emerald-900 mb-1">Data Efetivamente Entregue / Concluída *</label>
              <input
                id="f-st-data-entrega"
                type="date"
                value="${t.data_entrega || hoje}"
                class="w-full rounded-xl border border-emerald-300 px-3 py-2 bg-white font-bold text-emerald-950"
              />
            </div>

            <!-- Campo de Observações disponível para QUALQUER UMA das 3 opções -->
            <div class="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-200">
              <label id="lbl-obs-status" class="block font-bold text-indigo-950 mb-1">
                📝 Observações sobre a situação (${stSelecionado === 'ENTREGUE' ? 'Entregue' : stSelecionado === 'EM_ANDAMENTO' ? 'Em Andamento' : 'Pendente'}):
              </label>
              <textarea
                id="f-st-obs"
                rows="3"
                placeholder="${placeholdersObs[stSelecionado]}"
                class="w-full rounded-xl border border-indigo-300 px-3 py-2 bg-white text-slate-900 font-medium">${t.protocolo_observacao || ''}</textarea>
              <p class="text-[11px] text-indigo-700 mt-1">
                Você pode registrar ou atualizar observações tanto em <strong>Pendente</strong>, quanto em <strong>Em Andamento</strong> ou <strong>Entregue</strong>.
              </p>
            </div>

            <div class="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button type="button" onclick="ZGestorApp.closeModal()" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold">Cancelar</button>
              <button type="submit" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow">
                Salvar Status & Observação
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  aoAlternarOpcaoStatusModal(novoSt) {
    const boxData = document.getElementById('box-data-entrega-status');
    const lblObs = document.getElementById('lbl-obs-status');
    const txtObs = document.getElementById('f-st-obs');
    if (boxData) {
      if (novoSt === 'ENTREGUE') boxData.classList.remove('hidden');
      else boxData.classList.add('hidden');
    }
    if (lblObs) {
      const mapNome = { NAO_INICIADA: 'Não Iniciada', PENDENTE: 'Pendente', EM_ANDAMENTO: 'Em Andamento', ENTREGUE: 'Entregue' };
      lblObs.textContent = `📝 Observações sobre a situação (${mapNome[novoSt] || novoSt}):`;
    }
    if (txtObs) {
      const mapPh = {
        NAO_INICIADA: 'Ex: Aguardando abertura do período contábil ou início dos trabalhos...',
        PENDENTE: 'Ex: Aguardando cliente enviar extrato bancário / XMLs de notas fiscais para iniciar...',
        EM_ANDAMENTO: 'Ex: Em conciliação contábil das contas de fornecedores; falta conferência final...',
        ENTREGUE: 'Ex: Fechamento concluído e entregue ao cliente via Portal / WhatsApp (Protocolo nº...)'
      };
      txtObs.placeholder = mapPh[novoSt] || '';
    }
  },

  submitStatusTarefa(e, tarefaId) {
    e.preventDefault();
    try {
      const radio = document.querySelector('input[name="f-st-opcao"]:checked');
      const novoStatus = radio ? radio.value : 'NAO_INICIADA';
      const obs = document.getElementById('f-st-obs').value.trim();
      const dataEnt = document.getElementById('f-st-data-entrega') ? document.getElementById('f-st-data-entrega').value : null;

      window.zgestorDB.atualizarStatusObservacaoTarefa(tarefaId, novoStatus, obs, dataEnt);
      this.closeModal();
      const mapNome = { NAO_INICIADA: 'Não Iniciada', PENDENTE: 'Pendente', EM_ANDAMENTO: 'Em Andamento', ENTREGUE: 'Entregue' };
      this.showToast(`Tarefa atualizada para "${mapNome[novoStatus] || novoStatus}" com observação salva!`, 'success');
      this.renderAll();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  openModalBaixaTarefa(tarefaId) {
    this.openModalStatusTarefa(tarefaId, 'ENTREGUE');
  },

  // ===========================================================================
  // MÉTODOS DO NOTION HUB DE TAREFAS & SIDE PEEK
  // ===========================================================================
  setNotionDept(dept) {
    this.state.filtroTarefaDept = dept;
    this.renderContentOnly();
  },

  setNotionRegime(regime) {
    this.state.filtroEmpresaRegime = regime;
    this.renderContentOnly();
  },

  setNotionView(viewKey) {
    this.state.notionFiltroView = viewKey;
    if (viewKey === 'SIMPLES') {
      this.state.filtroEmpresaRegime = 'Simples Nacional';
    } else if (viewKey === 'PRESUMIDO') {
      this.state.filtroEmpresaRegime = 'Lucro Presumido';
    } else if (viewKey === 'FISCAL') {
      this.state.filtroTarefaDept = 'FISCAL';
    } else if (viewKey === 'CONTABIL') {
      this.state.filtroTarefaDept = 'CONTABIL';
    } else if (viewKey === 'PESSOAL') {
      this.state.filtroTarefaDept = 'PESSOAL';
    } else {
      this.state.filtroTarefaDept = 'TODOS';
      this.state.filtroEmpresaRegime = 'TODOS';
    }
    this.renderContentOnly();
  },

  toggleNotionGrupo(statusKey) {
    if (!this.state.notionGruposColapsados) this.state.notionGruposColapsados = {};
    this.state.notionGruposColapsados[statusKey] = !this.state.notionGruposColapsados[statusKey];
    this.renderContentOnly();
  },

  abrirNotionSidePeek(tarefaId) {
    this.state.notionSidePeekTarefaId = tarefaId;
    this.renderContentOnly();
  },

  fecharNotionSidePeek() {
    this.state.notionSidePeekTarefaId = null;
    this.renderContentOnly();
  },

  atualizarStatusRapidoNotion(tarefaId, novoStatus) {
    try {
      const db = window.zgestorDB;
      const t = db.data.tarefas.find(item => item.id === tarefaId);
      if (!t) return;
      const obs = t.protocolo_observacao || '';
      const dataEnt = (novoStatus === 'ENTREGUE') ? (t.data_entrega || new Date().toISOString().slice(0, 10)) : null;
      db.atualizarStatusObservacaoTarefa(tarefaId, novoStatus, obs, dataEnt);
      const mapNome = { NAO_INICIADA: 'Não Iniciada', PENDENTE: 'Pendente', EM_ANDAMENTO: 'Em Andamento', ENTREGUE: 'Entregue' };
      this.showToast(`Notion: Tarefa alterada para "${mapNome[novoStatus] || novoStatus}"!`, 'success');
      this.renderContentOnly();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  salvarNotionSidePeek(e, tarefaId) {
    e.preventDefault();
    try {
      const radio = document.querySelector('input[name="notion-sp-status"]:checked');
      const novoStatus = radio ? radio.value : 'NAO_INICIADA';
      const obsEl = document.getElementById('notion-sp-obs');
      const obs = obsEl ? obsEl.value.trim() : '';
      const dataEntEl = document.getElementById('notion-sp-data-entrega');
      const dataEnt = (novoStatus === 'ENTREGUE' && dataEntEl) ? dataEntEl.value : null;

      window.zgestorDB.atualizarStatusObservacaoTarefa(tarefaId, novoStatus, obs, dataEnt);
      const mapNome = { NAO_INICIADA: 'Não Iniciada', PENDENTE: 'Pendente', EM_ANDAMENTO: 'Em Andamento', ENTREGUE: 'Entregue' };
      this.showToast(`Notion: Tarefa salva como "${mapNome[novoStatus] || novoStatus}"!`, 'success');
      this.renderContentOnly();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  // ===========================================================================
  // MODAL DA MATRIZ ANUAL DE FECHAMENTOS CONTÁBEIS (JAN A DEZ)
  // ===========================================================================
  openModalFechamentoMes(empresaId, competencia, departamento = 'CONTABIL') {
    const db = window.zgestorDB;
    const emp = db.data.empresas.find(e => e.id === empresaId);
    if (!emp) return;
    const hoje = new Date().toISOString().slice(0, 10);

    const tarefasMes = db.data.tarefas.filter(
      t => t.empresa_id === empresaId && t.competencia === competencia && (departamento === 'TODOS' || t.departamento === departamento)
    );
    const principal = tarefasMes[0] || null;
    const stAtual = principal ? db.obterStatusSimplesTarefa(principal) : 'PENDENTE';
    const obsAtual = principal ? (principal.protocolo_observacao || '') : '';
    const dataEntAtual = principal && principal.data_entrega ? principal.data_entrega : hoje;

    const modal = document.getElementById('modal-root');
    if (!modal) return;
    modal.innerHTML = `
      <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-purple-200 max-h-[92vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <span class="text-[10px] font-bold uppercase tracking-wider text-purple-700">Matriz Geral de Fechamentos Contábeis</span>
              <h3 class="text-base font-bold text-slate-900">
                ${emp.nome_fantasia} — Competência ${competencia} (${db.formatarNomeCompetencia(competencia)})
              </h3>
            </div>
            <button onclick="ZGestorApp.closeModal()" class="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
          </div>

          <form onsubmit="ZGestorApp.submitFechamentoMes(event, '${empresaId}', '${competencia}', '${departamento}')" class="space-y-4 mt-4 text-xs">
            ${tarefasMes.length > 0 ? `
              <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div class="font-bold text-slate-700 uppercase text-[10px]">Obrigações / Rotinas vinculadas neste mês (${tarefasMes.length}):</div>
                ${tarefasMes.map(tm => `
                  <div class="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-slate-200">
                    <span class="font-semibold text-slate-900">${tm.titulo}</span>
                    ${window.ZGestorViews.statusTarefaBadge(tm)}
                  </div>
                `).join('')}
              </div>
            ` : `
              <div class="p-3 rounded-xl bg-purple-50 border border-purple-200 text-purple-900">
                Ainda não havia tarefa gerada para <strong>${competencia}</strong> no setor <strong>${departamento}</strong>. Ao salvar abaixo, o registro de fechamento será criado automaticamente!
              </div>
            `}

            <div>
              <label class="block font-bold text-slate-800 mb-2">Situação do Fechamento de ${competencia} *</label>
              <div class="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <label class="cursor-pointer">
                  <input type="radio" name="f-fech-st" value="NAO_INICIADA" ${stAtual === 'NAO_INICIADA' ? 'checked' : ''} onchange="document.getElementById('box-fech-data').classList.add('hidden')" class="sr-only peer" />
                  <div class="p-2.5 rounded-xl border-2 text-center transition peer-checked:border-slate-500 peer-checked:bg-slate-100 border-slate-200">
                    <div class="font-extrabold text-slate-700 text-xs">⚪ Não Inic.</div>
                    <div class="text-[10px] text-slate-500">Aguardando</div>
                  </div>
                </label>
                <label class="cursor-pointer">
                  <input type="radio" name="f-fech-st" value="PENDENTE" ${stAtual === 'PENDENTE' ? 'checked' : ''} onchange="document.getElementById('box-fech-data').classList.add('hidden')" class="sr-only peer" />
                  <div class="p-2.5 rounded-xl border-2 text-center transition peer-checked:border-amber-500 peer-checked:bg-amber-50 border-slate-200">
                    <div class="font-extrabold text-amber-800 text-xs">⏳ Pendente</div>
                    <div class="text-[10px] text-slate-500">Falta docs</div>
                  </div>
                </label>
                <label class="cursor-pointer">
                  <input type="radio" name="f-fech-st" value="EM_ANDAMENTO" ${stAtual === 'EM_ANDAMENTO' ? 'checked' : ''} onchange="document.getElementById('box-fech-data').classList.add('hidden')" class="sr-only peer" />
                  <div class="p-2.5 rounded-xl border-2 text-center transition peer-checked:border-sky-600 peer-checked:bg-sky-50 border-slate-200">
                    <div class="font-extrabold text-sky-800 text-xs">🔄 Em Andam.</div>
                    <div class="text-[10px] text-slate-500">Conciliação</div>
                  </div>
                </label>
                <label class="cursor-pointer">
                  <input type="radio" name="f-fech-st" value="ENTREGUE" ${stAtual === 'ENTREGUE' ? 'checked' : ''} onchange="document.getElementById('box-fech-data').classList.remove('hidden')" class="sr-only peer" />
                  <div class="p-2.5 rounded-xl border-2 text-center transition peer-checked:border-emerald-600 peer-checked:bg-emerald-50 border-slate-200">
                    <div class="font-extrabold text-emerald-800 text-xs">✅ Fechado</div>
                    <div class="text-[10px] text-slate-500">Lançado</div>
                  </div>
                </label>
                <label class="cursor-pointer">
                  <input type="radio" name="f-fech-st" value="CONFERIDO" ${stAtual === 'CONFERIDO' ? 'checked' : ''} onchange="document.getElementById('box-fech-data').classList.remove('hidden')" class="sr-only peer" />
                  <div class="p-2.5 rounded-xl border-2 text-center transition peer-checked:border-indigo-600 peer-checked:bg-indigo-50 border-slate-200">
                    <div class="font-extrabold text-indigo-900 text-xs">⭐ Conferido</div>
                    <div class="text-[10px] text-indigo-700">Auditado & Validado</div>
                  </div>
                </label>
              </div>
            </div>

            <div id="box-fech-data" class="${stAtual === 'ENTREGUE' || stAtual === 'CONFERIDO' ? '' : 'hidden'} p-3 rounded-xl bg-indigo-50/70 border border-indigo-200">
              <label class="block font-bold text-indigo-950 mb-1">Data de Conclusão / Conferência *</label>
              <input id="f-fech-data" type="date" value="${dataEntAtual}" class="w-full rounded-xl border border-indigo-300 px-3 py-2 bg-white font-bold" />
            </div>

            <div>
              <label class="block font-bold text-slate-800 mb-1">📝 Observações do Fechamento / Pendências do Mês (${competencia})</label>
              <textarea
                id="f-fech-obs"
                rows="3"
                placeholder="Ex: Balancete conciliado e fechado; ou pendente extrato do Banco Itaú..."
                class="w-full rounded-xl border border-purple-300 px-3 py-2 font-medium">${obsAtual}</textarea>
            </div>

            <div class="flex items-center justify-between pt-3 border-t border-slate-200">
              <button
                type="button"
                onclick="ZGestorApp.closeModal(); ZGestorApp.setCompetencia('${competencia}'); ZGestorApp.setFiltro('subTabTarefas', 'obrigacoes');"
                class="text-xs font-bold text-indigo-600 hover:underline">
                Abrir Competência ${competencia} na Visão Mensal →
              </button>
              <div class="flex gap-2">
                <button type="button" onclick="ZGestorApp.closeModal()" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold">Cancelar</button>
                <button type="submit" class="px-5 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold shadow">
                  Salvar Fechamento (${competencia})
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  submitFechamentoMes(e, empresaId, competencia, departamento) {
    e.preventDefault();
    try {
      const radio = document.querySelector('input[name="f-fech-st"]:checked');
      const status = radio ? radio.value : 'PENDENTE';
      const obs = document.getElementById('f-fech-obs').value.trim();
      const dataEnt = document.getElementById('f-fech-data') ? document.getElementById('f-fech-data').value : null;

      window.zgestorDB.registrarOuAtualizarFechamentoMes(empresaId, competencia, departamento, status, obs, dataEnt);
      this.closeModal();
      const mapNome = { NAO_INICIADA: 'Não Iniciado', PENDENTE: 'Pendente', EM_ANDAMENTO: 'Em Andamento', ENTREGUE: 'Fechado', CONFERIDO: 'Fechado e Conferido' };
      this.showToast(`Fechamento da competência ${competencia} salvo como "${mapNome[status] || status}"!`, 'success');
      this.renderAll();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  abrirDropdownEmpresaFiltro() {
    const dropdown = document.getElementById('dropdown-menu-empresas');
    if (!dropdown) return;
    dropdown.classList.remove('hidden');
    const input = document.getElementById('input-filtro-empresa');
    const termo = input ? input.value : '';
    const db = window.zgestorDB;
    const empAtual = db.data.empresas.find(e => e.id === this.state.filtroTarefaCliente);
    const textoEmpAtual = empAtual ? `#${empAtual.codigo_interno} - ${empAtual.nome_fantasia}` : '';
    // Se o texto no input for o nome da empresa já selecionada, lista todas as opções para fácil seleção de outra
    const termoBusca = (termo === textoEmpAtual) ? '' : termo;
    this.renderizarListaOpcoesEmpresas(termoBusca);
  },

  fecharDropdownEmpresaFiltro() {
    const dropdown = document.getElementById('dropdown-menu-empresas');
    if (dropdown && !dropdown.classList.contains('hidden')) {
      dropdown.classList.add('hidden');
    }
    // Restaura o texto original da empresa selecionada se o usuário saiu sem selecionar
    const input = document.getElementById('input-filtro-empresa');
    if (input) {
      const db = window.zgestorDB;
      const fCliente = this.state.filtroTarefaCliente || 'TODOS';
      const emp = db.data.empresas.find(e => e.id === fCliente);
      input.value = emp ? `#${emp.codigo_interno} - ${emp.nome_fantasia}` : '';
    }
  },

  toggleDropdownEmpresaFiltro() {
    const dropdown = document.getElementById('dropdown-menu-empresas');
    if (!dropdown) return;
    if (dropdown.classList.contains('hidden')) {
      this.abrirDropdownEmpresaFiltro();
      const input = document.getElementById('input-filtro-empresa');
      if (input) {
        input.focus();
        input.select();
      }
    } else {
      this.fecharDropdownEmpresaFiltro();
    }
  },

  aoDigitarFiltroEmpresaLista(termo) {
    const dropdown = document.getElementById('dropdown-menu-empresas');
    if (dropdown && dropdown.classList.contains('hidden')) {
      dropdown.classList.remove('hidden');
    }
    this.renderizarListaOpcoesEmpresas(termo);
  },

  aoDigitarEmpresaFiltro(val) {
    this.aoDigitarFiltroEmpresaLista(val);
  },

  renderizarListaOpcoesEmpresas(termo) {
    const listaEl = document.getElementById('lista-opcoes-empresas');
    if (!listaEl) return;
    const db = window.zgestorDB;
    const t = (termo || '').toLowerCase().trim();
    const tNumerico = t.replace(/\D/g, '');
    const fCliente = this.state.filtroTarefaCliente || 'TODOS';

    let empresas = db.data.empresas;
    if (t) {
      empresas = empresas.filter(e => {
        const cod = (e.codigo_interno || '').toLowerCase();
        const nome = (e.nome_fantasia || '').toLowerCase();
        const razao = (e.razao_social || '').toLowerCase();
        const cnpjNum = (e.cnpj || '').replace(/\D/g, '');

        // 1. Busca direta por Código Interno, Nome Fantasia ou Razão Social
        if (cod.includes(t) || nome.includes(t) || razao.includes(t)) return true;

        // 2. Busca por CNPJ ativada com 5+ dígitos numéricos ou caracteres de formatação
        if (tNumerico.length >= 5 || t.includes('.') || t.includes('/')) {
          if (cnpjNum.includes(tNumerico) || (e.cnpj || '').toLowerCase().includes(t)) return true;
        }

        return false;
      });
    }

    let html = `
      <div
        onclick="ZGestorApp.selecionarEmpresaFiltro('TODOS')"
        class="px-3 py-2 cursor-pointer flex items-center justify-between transition ${fCliente === 'TODOS' ? 'bg-indigo-50/80 font-bold text-indigo-900' : 'hover:bg-slate-50 text-slate-700'}">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full ${fCliente === 'TODOS' ? 'bg-indigo-600' : 'bg-slate-300'}"></span>
          <span>🌐 <strong>Todas as Empresas</strong> (Visão Consolidada)</span>
        </div>
        ${fCliente === 'TODOS' ? '<span class="text-xs text-indigo-600 font-bold">✓ Selecionada</span>' : ''}
      </div>
    `;

    if (empresas.length === 0) {
      html += `
        <div class="p-3 text-center text-slate-400">
          <p class="font-medium">Nenhuma empresa encontrada para "${termo}"</p>
          <p class="text-[10px] text-slate-400 mt-0.5">Tente buscar por outro código ou razão social</p>
        </div>
      `;
    } else {
      html += empresas.map(e => {
        const selecionada = fCliente === e.id;
        return `
          <div
            onclick="ZGestorApp.selecionarEmpresaFiltro('${e.id}')"
            class="px-3 py-2 cursor-pointer transition ${selecionada ? 'bg-indigo-50 font-bold text-indigo-950 border-l-4 border-indigo-600' : 'hover:bg-slate-50 text-slate-800'}">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-1.5 truncate">
                <span class="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">#${e.codigo_interno}</span>
                <span class="font-bold truncate">${e.nome_fantasia}</span>
              </div>
              <span class="text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${e.regime_tributario === 'Simples Nacional' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}">
                ${e.regime_tributario}
              </span>
            </div>
            <div class="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 font-normal truncate">
              <span class="truncate">${e.razao_social}</span>
              <span class="shrink-0">• CNPJ: ${e.cnpj}</span>
            </div>
          </div>
        `;
      }).join('');
    }

    listaEl.innerHTML = html;
  },

  selecionarEmpresaFiltro(empresaId) {
    this.state.filtroTarefaCliente = empresaId;
    this.fecharDropdownEmpresaFiltro();
    this.renderContentOnly();
  },

  aoTeclarFiltroEmpresa(e) {
    if (e.key === 'Escape') {
      this.fecharDropdownEmpresaFiltro();
      return;
    }
    if (e.key === 'Enter') {
      const input = document.getElementById('input-filtro-empresa');
      const termo = (input ? input.value : '').toLowerCase().trim();
      const db = window.zgestorDB;
      if (!termo || termo === 'todas as empresas' || termo === 'todos') {
        this.selecionarEmpresaFiltro('TODOS');
        return;
      }
      const encontrada = db.data.empresas.find(emp =>
        emp.codigo_interno.toLowerCase() === termo ||
        emp.nome_fantasia.toLowerCase().includes(termo) ||
        emp.razao_social.toLowerCase().includes(termo) ||
        (emp.cnpj || '').includes(termo)
      );
      if (encontrada) {
        this.selecionarEmpresaFiltro(encontrada.id);
      }
    }
  },

  openModalEncerramentoExercicio(empresaId, ano) {
    const db = window.zgestorDB;
    const emp = db.data.empresas.find(e => e.id === empresaId);
    if (!emp) return;
    const enc = db.getEncerramentoExercicio(empresaId, ano) || {
      status: 'PENDENTE',
      data_encerramento: `${ano}-12-31`,
      responsavel_nome: db.getCurrentUser().nome,
      observacoes: ''
    };
    const isEncerrado = enc.status === 'ENCERRADO';

    const modal = document.getElementById('modal-root');
    if (!modal) return;
    modal.innerHTML = `
      <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-purple-200 max-h-[92vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <span class="text-[10px] font-bold uppercase tracking-wider text-purple-700">Setor Contábil — Balanço & DRE Anual</span>
              <h3 class="text-base font-bold text-slate-900">
                Encerramento do Exercício ${ano} — ${emp.nome_fantasia}
              </h3>
            </div>
            <button onclick="ZGestorApp.closeModal()" class="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
          </div>

          <form onsubmit="ZGestorApp.submitEncerramentoExercicio(event, '${empresaId}', ${ano})" class="space-y-4 mt-4 text-xs">
            <div class="p-3 rounded-xl bg-purple-50 border border-purple-200 text-purple-950">
              <div class="font-bold text-xs">${emp.razao_social}</div>
              <div class="text-[11px] text-purple-800 mt-0.5">CNPJ: ${emp.cnpj} • Regime: <strong>${emp.regime_tributario}</strong></div>
              <div class="text-[11px] text-purple-700 mt-1">O encerramento do exercício formaliza o zeramento das contas de resultado (Receitas x Despesas), apuração do lucro líquido/prejuízo e consolidação do Balanço Patrimonial e DRE para ECD/ECF e IRPJ.</div>
            </div>

            <div>
              <label class="block font-bold text-slate-800 mb-2">Situação do Exercício Contábil ${ano} *</label>
              <div class="grid grid-cols-2 gap-3">
                <label class="cursor-pointer">
                  <input type="radio" name="f-enc-st" value="PENDENTE" ${!isEncerrado ? 'checked' : ''} class="sr-only peer" />
                  <div class="p-3 rounded-xl border-2 text-center transition peer-checked:border-amber-500 peer-checked:bg-amber-50 border-slate-200">
                    <div class="font-extrabold text-amber-900 text-xs">⏳ Em Aberto / Pendente</div>
                    <div class="text-[10px] text-slate-500 mt-0.5">Ajustes e conciliações pendentes</div>
                  </div>
                </label>
                <label class="cursor-pointer">
                  <input type="radio" name="f-enc-st" value="ENCERRADO" ${isEncerrado ? 'checked' : ''} class="sr-only peer" />
                  <div class="p-3 rounded-xl border-2 text-center transition peer-checked:border-emerald-600 peer-checked:bg-emerald-50 border-slate-200">
                    <div class="font-extrabold text-emerald-900 text-xs">✅ Exercício Oficialmente Encerrado</div>
                    <div class="text-[10px] text-slate-500 mt-0.5">Balanço e DRE auditados e fechados</div>
                  </div>
                </label>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-800 mb-1">Data do Encerramento do Balanço *</label>
                <input id="f-enc-data" type="date" required value="${enc.data_encerramento || `${ano}-12-31`}" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold text-slate-900" />
              </div>
              <div>
                <label class="block font-bold text-slate-800 mb-1">Responsável Técnico / Contador</label>
                <input id="f-enc-resp" type="text" value="${enc.responsavel_nome || db.getCurrentUser().nome}" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-semibold" />
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-800 mb-1">Termo / Observações do Encerramento Contábil</label>
              <textarea
                id="f-enc-obs"
                rows="3"
                placeholder="Ex: Livro Diário nº 05 emitido; Lucro Líquido apurado distribuído aos sócios conforme ata; Demonstrações assinadas com certificado ICP-Brasil."
                class="w-full rounded-xl border border-slate-300 px-3 py-2 font-medium">${enc.observacoes || ''}</textarea>
            </div>

            <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button type="button" onclick="ZGestorApp.closeModal()" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold">Cancelar</button>
              <button type="submit" class="px-5 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold shadow">
                Salvar Encerramento do Exercício ${ano}
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  submitEncerramentoExercicio(e, empresaId, ano) {
    e.preventDefault();
    try {
      const radio = document.querySelector('input[name="f-enc-st"]:checked');
      const status = radio ? radio.value : 'PENDENTE';
      const dataEnc = document.getElementById('f-enc-data').value;
      const resp = document.getElementById('f-enc-resp').value.trim();
      const obs = document.getElementById('f-enc-obs').value.trim();

      window.zgestorDB.salvarEncerramentoExercicio({
        empresa_id: empresaId,
        ano: Number(ano),
        status,
        data_encerramento: dataEnc,
        responsavel_nome: resp,
        observacoes: obs
      });
      this.closeModal();
      this.showToast(status === 'ENCERRADO' ? `Exercício ${ano} oficialmente encerrado com sucesso!` : `Status do exercício ${ano} salvo como Em Aberto/Pendente.`, 'success');
      this.renderAll();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  reabrirTarefa(id) {
    try {
      window.zgestorDB.reabrirTarefa(id);
      this.showToast('Tarefa alterada para Em Andamento.', 'info');
      this.renderAll();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  excluirTarefa(id) {
    try {
      window.zgestorDB.excluirTarefa(id);
      this.showToast('Tarefa removida.', 'info');
      this.renderAll();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  // ===========================================================================
  // CONTROLE DE ENVIO DE GUIAS DE IMPOSTOS
  // ===========================================================================
  openModalGuiaImposto(guiaId = null) {
    const db = window.zgestorDB;
    const comp = this.state.competencia || '10/2026';
    const sub = db.obterMesSubsequente(comp);
    const user = db.getCurrentUser();
    const existente = guiaId ? (db.data.guias_impostos || []).find(g => g.id === guiaId) : null;
    const modelosRaw = ((window.ZGESTOR_MODELS && window.ZGESTOR_MODELS.tiposGuiasImpostos) || [
      { sigla: 'DAS - Simples Nacional', departamento: 'FISCAL', dia_vencimento_padrao: 20 },
      { sigla: 'DAS - SIMEI (MEI)', departamento: 'FISCAL', dia_vencimento_padrao: 20 },
      { sigla: 'DAE / DARE - ICMS (Antecipação / DIFAL / ST)', departamento: 'FISCAL', dia_vencimento_padrao: 20 },
      { sigla: 'DARF - DCTFWeb / INSS / IRRF (Pró-Labore / Folha)', departamento: 'PESSOAL', dia_vencimento_padrao: 20 },
      { sigla: 'FGTS Digital - Guia Mensal (Funcionários CLT)', departamento: 'PESSOAL', dia_vencimento_padrao: 20 },
      { sigla: 'DARF - PIS / COFINS', departamento: 'FISCAL', dia_vencimento_padrao: 25 },
      { sigla: 'DARF - IRPJ / CSLL', departamento: 'FISCAL', dia_vencimento_padrao: 30 },
      { sigla: 'DAM / Guia ISS Municipal', departamento: 'FISCAL', dia_vencimento_padrao: 15 }
    ]);
    const tiposGuias = modelosRaw.map(tg =>
      typeof tg === 'string' ? { sigla: tg, departamento: 'FISCAL', dia_vencimento_padrao: 20 } : tg
    );
    if (!tiposGuias.some(tg => tg.sigla.includes('MEI') || tg.sigla.includes('SIMEI'))) {
      tiposGuias.push({ sigla: 'DAS - SIMEI (MEI)', departamento: 'FISCAL', dia_vencimento_padrao: 20 });
    }

    const empInicialId = (this.state.filtroTarefaCliente && this.state.filtroTarefaCliente !== 'TODOS')
      ? this.state.filtroTarefaCliente
      : (this.state.empresaCentralId || (db.data.empresas[0] ? db.data.empresas[0].id : ''));

    const empInicial = db.data.empresas.find(e => e.id === empInicialId);
    let defaultTipo = 'DAS - Simples Nacional';
    let defaultDept = 'FISCAL';
    if (empInicial && empInicial.regime_tributario === 'MEI') {
      defaultTipo = 'DAS - SIMEI (MEI)';
    } else if (empInicial && (empInicial.regime_tributario === 'Lucro Presumido' || empInicial.regime_tributario === 'Lucro Real')) {
      defaultTipo = 'DARF - PIS / COFINS';
    }

    const g = existente || {
      id: '',
      empresa_id: empInicialId,
      competencia: comp,
      tipo_guia: defaultTipo,
      departamento: defaultDept,
      data_vencimento: db.calcularDataMesSubsequente(comp, 20),
      valor: 0,
      status_envio: 'GERADA_AGUARDANDO_ENVIO',
      data_geracao: new Date().toISOString().slice(0, 10),
      data_envio: '',
      canal_envio: 'WhatsApp + E-mail',
      responsavel_nome: user.nome,
      observacoes: ''
    };

    const modal = document.getElementById('modal-root');
    if (!modal) return;
    modal.innerHTML = `
      <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 class="text-base font-bold text-slate-900">${g.id ? 'Editar Guia de Imposto' : 'Lançar Controle de Envio de Guia de Imposto'}</h3>
              <p class="text-[11px] text-emerald-700 font-semibold">Ex: DAS Simples Nacional, DAS-SIMEI (MEI), DAE ICMS, DARF PIS/COFINS, FGTS Digital (${comp} → Venc. ${sub.label})</p>
            </div>
            <button onclick="ZGestorApp.closeModal()" class="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
          </div>

          <form onsubmit="ZGestorApp.submitFormGuiaImposto(event)" class="space-y-4 mt-4 text-xs">
            <input type="hidden" id="f-gi-id" value="${g.id || ''}" />

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="sm:col-span-2">
                <label class="block font-bold text-slate-700 mb-1">Empresa Cliente *</label>
                <select id="f-gi-emp" onchange="ZGestorApp.aoMudarEmpresaModalGuia(this.value)" required class="w-full rounded-xl border border-slate-300 px-3 py-2">
                  ${db.data.empresas.map(e => `<option value="${e.id}" ${e.id === g.empresa_id ? 'selected' : ''}>${e.nome_fantasia} (${e.regime_tributario})</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Competência *</label>
                <input id="f-gi-comp" type="text" required value="${g.competencia}" placeholder="MM/AAAA (ex: 10/2026)" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold" />
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Tipo de Guia / Imposto *</label>
              <select id="f-gi-tipo-sel" onchange="ZGestorApp.aoMudarTipoGuiaPreset(this.value)" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-semibold">
                ${tiposGuias.map(tg => `<option value="${tg.sigla}" ${tg.sigla === g.tipo_guia ? 'selected' : ''}>${tg.sigla}</option>`).join('')}
                <option value="OUTRA" ${!tiposGuias.some(tg => tg.sigla === g.tipo_guia) ? 'selected' : ''}>Outra Guia Específica (Digitar nome)</option>
              </select>
              <input id="f-gi-tipo" type="text" required value="${g.tipo_guia}" placeholder="Ex: DAS - Simples Nacional, DAS - SIMEI (MEI), DAE ICMS Antecipação..." class="w-full rounded-xl border border-slate-300 px-3 py-2 mt-2 font-bold text-slate-900" />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Setor</label>
                <select id="f-gi-dept" class="w-full rounded-xl border border-slate-300 px-3 py-2">
                  <option value="FISCAL" ${g.departamento === 'FISCAL' ? 'selected' : ''}>Fiscal</option>
                  <option value="PESSOAL" ${g.departamento === 'PESSOAL' ? 'selected' : ''}>Pessoal (DP)</option>
                  <option value="FINANCEIRO" ${g.departamento === 'FINANCEIRO' ? 'selected' : ''}>Financeiro</option>
                </select>
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Vencimento (${sub.label}) *</label>
                <input id="f-gi-venc" type="date" required value="${g.data_vencimento}" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-semibold" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Valor da Guia (R$)</label>
                <input id="f-gi-valor" type="number" step="0.01" value="${g.valor || 0}" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold" />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <div>
                <label class="block font-bold text-emerald-950 mb-1">Status do Controle de Envio *</label>
                <select id="f-gi-status" class="w-full rounded-xl border border-emerald-300 px-3 py-2 bg-white font-semibold">
                  <option value="PENDENTE_GERACAO" ${g.status_envio === 'PENDENTE_GERACAO' ? 'selected' : ''}>1. Pendente de Geração</option>
                  <option value="GERADA_AGUARDANDO_ENVIO" ${g.status_envio === 'GERADA_AGUARDANDO_ENVIO' ? 'selected' : ''}>2. Guia Gerada (Falta Enviar)</option>
                  <option value="ENVIADA_CLIENTE" ${g.status_envio === 'ENVIADA_CLIENTE' ? 'selected' : ''}>3. Enviada ao Cliente</option>
                </select>
              </div>
              <div>
                <label class="block font-bold text-emerald-950 mb-1">Data de Envio ao Cliente</label>
                <input id="f-gi-data-envio" type="date" value="${g.data_envio || ''}" class="w-full rounded-xl border border-emerald-300 px-3 py-2 bg-white" />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Canal de Envio</label>
                <select id="f-gi-canal" class="w-full rounded-xl border border-slate-300 px-3 py-2">
                  <option value="WhatsApp + E-mail" ${g.canal_envio === 'WhatsApp + E-mail' ? 'selected' : ''}>WhatsApp + E-mail</option>
                  <option value="E-mail" ${g.canal_envio === 'E-mail' ? 'selected' : ''}>E-mail</option>
                  <option value="WhatsApp" ${g.canal_envio === 'WhatsApp' ? 'selected' : ''}>WhatsApp</option>
                  <option value="Portal do Cliente / Impresso" ${g.canal_envio === 'Portal do Cliente / Impresso' ? 'selected' : ''}>Portal do Cliente / Impresso</option>
                </select>
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Responsável pelo Envio</label>
                <select id="f-gi-resp" class="w-full rounded-xl border border-slate-300 px-3 py-2">
                  ${(db.data.profiles || []).map(p => `<option value="${p.nome}" ${p.nome === g.responsavel_nome ? 'selected' : ''}>${p.nome} (${p.departamento})</option>`).join('')}
                </select>
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Observações / Protocolo</label>
              <input id="f-gi-obs" type="text" value="${g.observacoes || ''}" placeholder="Ex: DAS e extrato enviados para o financeiro do cliente..." class="w-full rounded-xl border border-slate-300 px-3 py-2" />
            </div>

            <div class="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button type="button" onclick="ZGestorApp.closeModal()" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold">Cancelar</button>
              <button type="submit" class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow">Salvar Controle de Guia</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  aoMudarEmpresaModalGuia(empId) {
    const db = window.zgestorDB;
    const emp = db.data.empresas.find(e => e.id === empId);
    if (!emp) return;
    const tipoInput = document.getElementById('f-gi-tipo');
    const tipoSel = document.getElementById('f-gi-tipo-sel');
    const deptSel = document.getElementById('f-gi-dept');
    const comp = document.getElementById('f-gi-comp')?.value || this.state.competencia || '10/2026';
    if (!tipoInput || !tipoSel) return;

    if (emp.regime_tributario === 'MEI') {
      tipoInput.value = 'DAS - SIMEI (MEI)';
      tipoSel.value = 'DAS - SIMEI (MEI)';
      if (deptSel) deptSel.value = 'FISCAL';
      document.getElementById('f-gi-venc').value = db.calcularDataMesSubsequente(comp, 20);
    } else if (emp.regime_tributario === 'Simples Nacional') {
      tipoInput.value = 'DAS - Simples Nacional';
      tipoSel.value = 'DAS - Simples Nacional';
      if (deptSel) deptSel.value = 'FISCAL';
      document.getElementById('f-gi-venc').value = db.calcularDataMesSubsequente(comp, 20);
    } else if (emp.regime_tributario === 'Lucro Presumido' || emp.regime_tributario === 'Lucro Real') {
      tipoInput.value = 'DARF - PIS / COFINS';
      tipoSel.value = 'DARF - PIS / COFINS';
      if (deptSel) deptSel.value = 'FISCAL';
      document.getElementById('f-gi-venc').value = db.calcularDataMesSubsequente(comp, 25);
    }
  },

  aoMudarTipoGuiaPreset(val) {
    if (val === 'OUTRA') {
      document.getElementById('f-gi-tipo').value = '';
      document.getElementById('f-gi-tipo').focus();
      return;
    }
    document.getElementById('f-gi-tipo').value = val;
    const modelosRaw = ((window.ZGESTOR_MODELS && window.ZGESTOR_MODELS.tiposGuiasImpostos) || []);
    const tiposGuias = modelosRaw.map(tg =>
      typeof tg === 'string' ? { sigla: tg, departamento: 'FISCAL', dia_vencimento_padrao: 20 } : tg
    );
    const tg = tiposGuias.find(item => item.sigla === val);
    if (tg) {
      document.getElementById('f-gi-dept').value = tg.departamento;
      const comp = document.getElementById('f-gi-comp').value || this.state.competencia;
      document.getElementById('f-gi-venc').value = window.zgestorDB.calcularDataMesSubsequente(comp, tg.dia_vencimento_padrao);
    }
  },

  submitFormGuiaImposto(e) {
    e.preventDefault();
    const status = document.getElementById('f-gi-status').value;
    const dataEnvioInput = document.getElementById('f-gi-data-envio').value;
    const hoje = new Date().toISOString().slice(0, 10);
    const compInput = document.getElementById('f-gi-comp').value.trim();
    const compNorm = window.zgestorDB.normalizarCompetencia(compInput);

    window.zgestorDB.salvarGuiaImposto({
      id: document.getElementById('f-gi-id').value || null,
      empresa_id: document.getElementById('f-gi-emp').value,
      competencia: compNorm,
      tipo_guia: document.getElementById('f-gi-tipo').value.trim(),
      departamento: document.getElementById('f-gi-dept').value,
      data_vencimento: document.getElementById('f-gi-venc').value,
      valor: Number(document.getElementById('f-gi-valor').value || 0),
      status_envio: status,
      data_envio: status === 'ENVIADA_CLIENTE' ? (dataEnvioInput || hoje) : (dataEnvioInput || null),
      canal_envio: document.getElementById('f-gi-canal').value,
      responsavel_nome: document.getElementById('f-gi-resp').value,
      observacoes: document.getElementById('f-gi-obs').value.trim()
    });
    this.state.subTabTarefas = 'guias_impostos';
    if (compNorm && compNorm !== this.state.competencia) {
      this.state.competencia = compNorm;
    }
    this.closeModal();
    this.showToast('Controle de guia de imposto salvo com sucesso!', 'success');
    this.renderAll();
  },

  openModalEnvioGuiaImposto(guiaId) {
    const db = window.zgestorDB;
    const g = (db.data.guias_impostos || []).find(item => item.id === guiaId);
    if (!g) return;
    const emp = db.data.empresas.find(e => e.id === g.empresa_id);
    const hoje = new Date().toISOString().slice(0, 10);

    const modal = document.getElementById('modal-root');
    if (!modal) return;
    modal.innerHTML = `
      <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 class="text-base font-bold text-slate-900">Confirmar Envio de Guia ao Cliente</h3>
            <button onclick="ZGestorApp.closeModal()" class="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
          </div>
          <form onsubmit="ZGestorApp.confirmarEnvioGuiaImposto(event, '${g.id}')" class="space-y-4 mt-4 text-xs">
            <div class="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <div class="font-bold text-emerald-950 text-sm">${g.tipo_guia}</div>
              <div class="text-slate-600 mt-0.5">Empresa: <strong>${emp ? emp.nome_fantasia : '—'}</strong> • Venc.: <strong>${window.ZGestorViews.formatDate(g.data_vencimento)}</strong></div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Valor Apurado na Guia (R$)</label>
                <input id="f-envgi-val" type="number" step="0.01" value="${g.valor || 0}" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Data do Envio *</label>
                <input id="f-envgi-data" type="date" required value="${g.data_envio || hoje}" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-semibold" />
              </div>
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Canal Utilizado</label>
              <select id="f-envgi-canal" class="w-full rounded-xl border border-slate-300 px-3 py-2">
                <option value="WhatsApp + E-mail">WhatsApp + E-mail</option>
                <option value="E-mail">E-mail</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Impresso / Protocolo">Impresso / Protocolo</option>
              </select>
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Observação / Confirmação</label>
              <input id="f-envgi-obs" type="text" value="${g.observacoes || ''}" placeholder="Ex: Recebido pelo cliente via WhatsApp..." class="w-full rounded-xl border border-slate-300 px-3 py-2" />
            </div>
            <div class="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button type="button" onclick="ZGestorApp.closeModal()" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold">Cancelar</button>
              <button type="submit" class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow">Confirmar Envio</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  confirmarEnvioGuiaImposto(e, guiaId) {
    e.preventDefault();
    const val = document.getElementById('f-envgi-val').value;
    const dt = document.getElementById('f-envgi-data').value;
    const canal = document.getElementById('f-envgi-canal').value;
    const obs = document.getElementById('f-envgi-obs').value.trim();
    window.zgestorDB.marcarGuiaImpostoEnviada(guiaId, dt, canal, val, obs);
    this.closeModal();
    this.showToast('Envio da guia ao cliente registrado com sucesso!', 'success');
    this.renderAll();
  },

  excluirGuiaImposto(guiaId) {
    window.zgestorDB.excluirGuiaImposto(guiaId);
    this.showToast('Guia de imposto removida.', 'info');
    this.renderAll();
  },

  // ===========================================================================
  // MODAL DE EMPRESAS E ONBOARDING
  // ===========================================================================
  openModalEmpresa(empresaId = null, forcarOnboarding = false) {
    const db = window.zgestorDB;
    const emp = empresaId ? db.data.empresas.find(e => e.id === empresaId) : null;
    const d = emp || {
      id: '',
      codigo_interno: String(db.data.empresas.length + 1).padStart(3, '0'),
      razao_social: '',
      nome_fantasia: '',
      cnpj: '',
      municipio_uf: '',
      validade_certificado: '',
      competencia_inicial: '11/2026',
      modelo_onboarding: 'ABERTURA_EMPRESA',
      regime_tributario: 'Simples Nacional',
      inscricao_estadual: 'Isento',
      inscricao_municipal: '',
      responsavel_legal: '',
      telefone: '',
      email: '',
      status: forcarOnboarding ? 'EM_ONBOARDING' : 'EM_ONBOARDING',
      valor_honorario_padrao: 1500.00,
      dia_vencimento_honorario: 10,
      canal_pagamento_padrao: 'PIX_PRINCIPAL',
      possui_pro_labore: true, // Padrão = true (gera DARF INSS/IRRF)
      possui_funcionarios: false, // Separado (somente quem tem funcionário gera FGTS)
      observacoes: ''
    };

    const temProLabore = d.possui_pro_labore !== false;
    const temFuncionarios = Boolean(d.possui_funcionarios);

    const modal = document.getElementById('modal-root');
    if (!modal) return;
    modal.innerHTML = `
      <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 class="text-base font-bold text-slate-900">${d.id ? 'Editar Cadastro da Empresa' : 'Cadastrar Nova Empresa Cliente'}</h3>
            <button onclick="ZGestorApp.closeModal()" class="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
          </div>
          <form onsubmit="ZGestorApp.submitFormEmpresa(event)" class="space-y-4 mt-4 text-xs">
            <input type="hidden" id="f-emp-id" value="${d.id || ''}" />

            <!-- 1. TOPO: CÓDIGO INTERNO + CNPJ * COM BUSCA AUTOMÁTICA VIA API PÚBLICA -->
            <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Código Interno</label>
                <input id="f-emp-cod" type="text" value="${d.codigo_interno || ''}" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs font-bold" />
              </div>
              <div class="sm:col-span-3">
                <label class="block font-bold text-slate-700 mb-1">CNPJ *</label>
                <div class="flex gap-2">
                  <input id="f-emp-cnpj" type="text" required value="${d.cnpj}" placeholder="00.000.000/0001-00" class="flex-1 rounded-xl border border-slate-300 px-3 py-2 font-mono font-semibold text-slate-800 text-xs focus:ring-2 focus:ring-indigo-500" />
                  <button type="button" onclick="ZGestorApp.buscarDadosCNPJ()" id="btn-busca-cnpj" class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm whitespace-nowrap transition cursor-pointer">
                    <i data-lucide="search" class="w-3.5 h-3.5"></i>
                    <span>Buscar CNPJ</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- 2. RAZÃO SOCIAL E NOME FANTASIA -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Razão Social *</label>
                <input id="f-emp-razao" type="text" required value="${d.razao_social}" placeholder="Ex: Alfa Comércio e Serviços Ltda" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Nome Fantasia *</label>
                <input id="f-emp-fantasia" type="text" required value="${d.nome_fantasia}" placeholder="Ex: Alfa Soluções" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
            </div>

            <!-- 3. MUNICÍPIO/UF, INSCRIÇÃO ESTADUAL E INSCRIÇÃO MUNICIPAL -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Município / UF *</label>
                <input id="f-emp-municipio-uf" type="text" value="${d.municipio_uf || ''}" placeholder="Ex: Belo Horizonte/MG" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Inscrição Estadual</label>
                <input id="f-emp-ie" type="text" value="${d.inscricao_estadual || ''}" placeholder="Ex: Isento ou 000.000.000" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Inscrição Municipal</label>
                <input id="f-emp-im" type="text" value="${d.inscricao_municipal || ''}" placeholder="Ex: 000000-0" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
            </div>

            <!-- 4. REGIME TRIBUTÁRIO, RESPONSÁVEL E CONTATO -->
            <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Regime Tributário *</label>
                <select id="f-emp-regime" class="w-full rounded-xl border border-slate-300 px-3 py-2">
                  ${window.ZGESTOR_MODELS.regimesTributarios.map(r => `<option value="${r}" ${r === d.regime_tributario ? 'selected' : ''}>${r}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Responsável Legal</label>
                <input id="f-emp-resp" type="text" value="${d.responsavel_legal || ''}" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Telefone / WhatsApp</label>
                <input id="f-emp-tel" type="text" value="${d.telefone || ''}" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">E-mail</label>
                <input id="f-emp-email" type="email" value="${d.email || ''}" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
            </div>

            <!-- 5. PARÂMETROS FINANCEIROS, COMPETÊNCIA INICIAL, CERTIFICADO DIGITAL E STATUS AMPLIADO -->
            <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label class="block font-bold text-slate-800 mb-1">Honorário Mensal (R$) *</label>
                  <input id="f-emp-hon" type="number" step="0.01" required value="${d.valor_honorario_padrao}" class="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white" />
                </div>
                <div>
                  <label class="block font-bold text-slate-800 mb-1">Dia Vencimento *</label>
                  <input id="f-emp-venc" type="number" min="1" max="31" required value="${d.dia_vencimento_honorario}" class="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white" />
                </div>
                <div>
                  <label class="block font-bold text-slate-800 mb-1">Competência Inicial *</label>
                  <input id="f-emp-comp-inicial" type="text" placeholder="MM/AAAA (ex: 11/2026)" value="${db.normalizarCompetencia(d.competencia_inicial || '11/2026')}" class="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white font-mono" title="Mês e ano a partir do qual o sistema gera honorários e rotinas" />
                </div>
                <div>
                  <label class="block font-bold text-slate-800 mb-1 whitespace-nowrap">Validade Certificado (e-CNPJ)</label>
                  <input id="f-emp-val-cert" type="date" value="${d.validade_certificado || ''}" class="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white text-xs" />
                </div>
              </div>

              <!-- STATUS INICIAL COM LARGURA AMPLIADA E ESCOLHA DE MODELO DE CHECKLIST -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2.5 border-t border-slate-200/80">
                <div>
                  <label class="block font-bold text-slate-800 mb-1">Status Inicial da Empresa *</label>
                  <select id="f-emp-status" onchange="ZGestorApp.aoMudarStatusInicialEmpresa(this.value)" class="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500">
                    <option value="EM_ONBOARDING" ${d.status === 'EM_ONBOARDING' ? 'selected' : ''}>Em Onboarding (Novo Cliente)</option>
                    <option value="ATIVA" ${d.status === 'ATIVA' ? 'selected' : ''}>Ativa na Carteira</option>
                    <option value="SUSPENSA" ${d.status === 'SUSPENSA' ? 'selected' : ''}>Suspensa / Inativa</option>
                  </select>
                </div>
                <div id="box-modelo-onboarding" class="${d.status === 'EM_ONBOARDING' ? '' : 'hidden'}">
                  <label class="block font-bold text-amber-900 mb-1">Modelo de Checklist de Onboarding *</label>
                  <select id="f-emp-modelo-onboarding" class="w-full rounded-xl border border-amber-300 bg-amber-50/80 px-3 py-2 text-xs font-bold text-amber-950 focus:ring-2 focus:ring-amber-500">
                    <option value="ABERTURA_EMPRESA" ${d.modelo_onboarding === 'ABERTURA_EMPRESA' ? 'selected' : ''}>🚀 Abertura de Empresa (Viabilidade, Junta, CNPJ, Inscrições)</option>
                    <option value="TROCA_CONTABILIDADE" ${d.modelo_onboarding === 'TROCA_CONTABILIDADE' ? 'selected' : ''}>🔄 Troca de Contabilidade (CRCTransf, Procurações, Balancete)</option>
                  </select>
                </div>
              </div>

              <!-- DESTINO DO PAGAMENTO / CANAL PIX (PRINCIPAL, SECUNDÁRIO, AUTÔNOMO) -->
              <div class="pt-2.5 border-t border-slate-200/80">
                <label class="block font-bold text-slate-800 mb-1">Conta / Destino do Pagamento de Honorários (Chave PIX) *</label>
                <select id="f-emp-canal-pix" class="w-full rounded-xl border border-emerald-400 bg-emerald-50/50 px-3 py-2 text-xs font-bold text-emerald-950 focus:ring-2 focus:ring-emerald-500">
                  <option value="PIX_PRINCIPAL" ${(d.canal_pagamento_padrao || 'PIX_PRINCIPAL') === 'PIX_PRINCIPAL' ? 'selected' : ''}>🏢 PIX Principal do Escritório (CNPJ Principal)</option>
                  <option value="PIX_SECUNDARIO" ${d.canal_pagamento_padrao === 'PIX_SECUNDARIO' ? 'selected' : ''}>🏦 PIX do CNPJ Secundário / Filial</option>
                  <option value="PIX_AUTONOMO" ${d.canal_pagamento_padrao === 'PIX_AUTONOMO' ? 'selected' : ''}>👤 PIX Autônomo / Sócio (Pessoa Física - CPF)</option>
                  <option value="DINHEIRO" ${d.canal_pagamento_padrao === 'DINHEIRO' ? 'selected' : ''}>💵 Dinheiro / Caixa Espécie</option>
                </select>
                <p class="text-[10px] text-slate-500 mt-0.5">Define automaticamente qual chave PIX e QR Code oficial saem impressos no recibo de cobrança desta empresa.</p>
              </div>
            </div>

            <!-- SEPARAÇÃO DE PRÓ-LABORE (PADRÃO) E FUNCIONÁRIOS CLT (FGTS) -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label class="flex items-start gap-2.5 p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 cursor-pointer hover:border-indigo-400">
                <input id="f-emp-prolabore" type="checkbox" ${temProLabore ? 'checked' : ''} class="mt-0.5 w-4 h-4 rounded text-indigo-600" />
                <div>
                  <span class="font-bold text-indigo-950 block">1. Possui Pró-Labore dos Sócios (Padrão)</span>
                  <span class="text-[11px] text-indigo-800 block mt-0.5">
                    Marcado como padrão. Gera automaticamente a rotina de <strong>Pró-Labore, DCTFWeb e DARF de INSS / IRRF</strong>.
                  </span>
                </div>
              </label>

              <label class="flex items-start gap-2.5 p-3.5 rounded-xl bg-purple-50/70 border border-purple-200 cursor-pointer hover:border-purple-400">
                <input id="f-emp-func" type="checkbox" ${temFuncionarios ? 'checked' : ''} class="mt-0.5 w-4 h-4 rounded text-purple-600" />
                <div>
                  <span class="font-bold text-purple-950 block">2. Possui Funcionários CLT Registrados</span>
                  <span class="text-[11px] text-purple-800 block mt-0.5">
                    Marque somente quando a empresa tiver empregados. Gera a <strong>Folha CLT e a Guia de FGTS Digital</strong>.
                  </span>
                </div>
              </label>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Particularidades / Observações Fiscais e Contábeis</label>
              <textarea id="f-emp-obs" rows="2" class="w-full rounded-xl border border-slate-300 px-3 py-2">${d.observacoes || ''}</textarea>
            </div>

            <div class="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button type="button" onclick="ZGestorApp.closeModal()" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold cursor-pointer">Cancelar</button>
              <button type="submit" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow cursor-pointer">Salvar Empresa</button>
            </div>
          </form>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  },

  aoMudarStatusInicialEmpresa(status) {
    const box = document.getElementById('box-modelo-onboarding');
    if (box) {
      if (status === 'EM_ONBOARDING') {
        box.classList.remove('hidden');
      } else {
        box.classList.add('hidden');
      }
    }
  },

  async buscarDadosCNPJ() {
    const inputCnpj = document.getElementById('f-emp-cnpj');
    const btn = document.getElementById('btn-busca-cnpj');
    if (!inputCnpj) return;
    const cnpjPuro = inputCnpj.value.replace(/\D/g, '');
    if (cnpjPuro.length !== 14) {
      this.showToast('Por favor, informe um CNPJ com 14 dígitos para consultar na Receita Federal.', 'error');
      inputCnpj.focus();
      return;
    }

    const textoOriginal = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i> <span>Buscando...</span>`;
      if (window.lucide) window.lucide.createIcons();
    }

    try {
      let data = null;
      // 1. Tenta consulta via BrasilAPI pública
      try {
        const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjPuro}`);
        if (resp.ok) {
          data = await resp.json();
        }
      } catch (errApi) {
        console.warn('BrasilAPI não respondeu, tentando serviço alternativo...', errApi);
      }

      // 2. Se não conseguiu pela BrasilAPI, tenta MinhaReceita
      if (!data) {
        try {
          const respFallback = await fetch(`https://minhareceita.org/${cnpjPuro}`);
          if (respFallback.ok) {
            data = await respFallback.json();
          }
        } catch (_) {}
      }

      if (data && (data.razao_social || data.nome_fantasia)) {
        const razaoInput = document.getElementById('f-emp-razao');
        const fantasiaInput = document.getElementById('f-emp-fantasia');
        const munInput = document.getElementById('f-emp-municipio-uf');
        const telInput = document.getElementById('f-emp-tel');
        const emailInput = document.getElementById('f-emp-email');

        if (razaoInput) razaoInput.value = data.razao_social || '';
        if (fantasiaInput) fantasiaInput.value = data.nome_fantasia || data.razao_social || '';

        const cidade = data.municipio || data.cidade || '';
        const uf = data.uf || data.estado || '';
        if (munInput && (cidade || uf)) {
          munInput.value = `${cidade}/${uf}`;
        }

        if (telInput && !telInput.value && (data.ddd_telefone_1 || data.telefone)) {
          telInput.value = data.ddd_telefone_1 || data.telefone || '';
        }
        if (emailInput && !emailInput.value && data.email) {
          emailInput.value = String(data.email).toLowerCase();
        }

        // Aplica máscara formatada de CNPJ no campo
        inputCnpj.value = cnpjPuro.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

        this.showToast(`Dados da empresa "${data.razao_social || 'CNPJ'}" obtidos com sucesso!`, 'success');
      } else {
        this.showToast('CNPJ não localizado na base pública da Receita Federal. Preencha os campos manualmente.', 'warning');
      }
    } catch (e) {
      console.error(e);
      this.showToast('Não foi possível consultar a API pública no momento. Preencha os dados manualmente.', 'warning');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = textoOriginal;
        if (window.lucide) window.lucide.createIcons();
      }
    }
  },

  submitFormEmpresa(e) {
    e.preventDefault();
    const dados = {
      id: document.getElementById('f-emp-id').value || null,
      codigo_interno: document.getElementById('f-emp-cod').value.trim(),
      razao_social: document.getElementById('f-emp-razao').value.trim(),
      nome_fantasia: document.getElementById('f-emp-fantasia').value.trim(),
      cnpj: document.getElementById('f-emp-cnpj').value.trim(),
      municipio_uf: (document.getElementById('f-emp-municipio-uf')?.value || '').trim(),
      regime_tributario: document.getElementById('f-emp-regime').value,
      inscricao_estadual: document.getElementById('f-emp-ie').value.trim(),
      inscricao_municipal: document.getElementById('f-emp-im').value.trim(),
      responsavel_legal: document.getElementById('f-emp-resp').value.trim(),
      telefone: document.getElementById('f-emp-tel').value.trim(),
      email: document.getElementById('f-emp-email').value.trim(),
      valor_honorario_padrao: Number(document.getElementById('f-emp-hon').value || 0),
      dia_vencimento_honorario: Number(document.getElementById('f-emp-venc').value || 10),
      competencia_inicial: window.zgestorDB.normalizarCompetencia(document.getElementById('f-emp-comp-inicial')?.value || '11/2026'),
      validade_certificado: (document.getElementById('f-emp-val-cert')?.value || '').trim(),
      canal_pagamento_padrao: document.getElementById('f-emp-canal-pix')?.value || 'PIX_PRINCIPAL',
      status: document.getElementById('f-emp-status').value,
      modelo_onboarding: document.getElementById('f-emp-modelo-onboarding')?.value || 'ABERTURA_EMPRESA',
      possui_pro_labore: document.getElementById('f-emp-prolabore').checked,
      possui_funcionarios: document.getElementById('f-emp-func').checked,
      observacoes: document.getElementById('f-emp-obs').value.trim()
    };
    if (dados.email) {
      const chk = window.zgestorDB.validarEmailReal(dados.email);
      if (!chk.valido) {
        this.showToast(chk.erro, 'error');
        return;
      }
      dados.email = chk.email;
    }
    const salva = window.zgestorDB.salvarEmpresa(dados, true);
    this.state.empresaOnboardingId = salva.id;
    this.state.empresaCentralId = salva.id;
    this.closeModal();
    this.showToast(`Empresa ${salva.nome_fantasia} salva com sucesso!`, 'success');
    this.renderAll();
  },

  verOnboardingEmpresa(empresaId) {
    window.zgestorDB.gerarChecklistPadraoEmpresa(empresaId);
    const prog = window.zgestorDB.obterProgressoOnboarding(empresaId);
    if (prog.completo) {
      this.state.filtroOnboardingSomentePendentes = false;
    }
    this.state.empresaOnboardingId = empresaId;
    this.navigate('onboarding');
  },

  selecionarEmpresaOnboarding(empresaId) {
    this.state.empresaOnboardingId = empresaId;
    this.renderContentOnly();
  },

  gerarChecklistEmpresa(empresaId, tipoModelo = 'ABERTURA_EMPRESA', forcarRecriar = false) {
    window.zgestorDB.gerarChecklistPadraoEmpresa(empresaId, tipoModelo, forcarRecriar);
    const modNome = tipoModelo === 'TROCA_CONTABILIDADE' ? 'Troca de Contabilidade' : 'Abertura de Empresa';
    this.showToast(`Checklist do modelo "${modNome}" gerado com sucesso!`, 'success');
    this.renderContentOnly();
  },

  abrirModalTrocarModeloOnboarding(empresaId) {
    const db = window.zgestorDB;
    const emp = db.data.empresas.find(e => e.id === empresaId);
    if (!emp) return;

    const modal = document.getElementById('modal-root');
    if (!modal) return;
    modal.innerHTML = `
      <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 class="text-base font-bold text-slate-900">Modelo de Checklist de Onboarding</h3>
            <button onclick="ZGestorApp.closeModal()" class="text-slate-400 hover:text-slate-600 text-xl font-bold cursor-pointer">×</button>
          </div>
          <div class="space-y-4 mt-4 text-xs">
            <p class="text-slate-600">
              Selecione o modelo de checklist desejado para a implantação de <strong>${emp.nome_fantasia}</strong>:
            </p>
            <div class="space-y-2">
              <button onclick="ZGestorApp.aplicarNovoModeloOnboarding('${emp.id}', 'ABERTURA_EMPRESA')" class="w-full p-3 rounded-xl border border-indigo-200 hover:bg-indigo-50/80 text-left transition flex items-start gap-3 cursor-pointer">
                <span class="text-xl">🚀</span>
                <div>
                  <div class="font-bold text-slate-900 text-sm">1. Abertura de Empresa</div>
                  <div class="text-[11px] text-slate-500 mt-0.5">Viabilidade, Junta Comercial, DBE/CNPJ, Inscrições e Certificado Digital.</div>
                </div>
              </button>
              <button onclick="ZGestorApp.aplicarNovoModeloOnboarding('${emp.id}', 'TROCA_CONTABILIDADE')" class="w-full p-3 rounded-xl border border-purple-200 hover:bg-purple-50/80 text-left transition flex items-start gap-3 cursor-pointer">
                <span class="text-xl">🔄</span>
                <div>
                  <div class="font-bold text-slate-900 text-sm">2. Troca de Contabilidade</div>
                  <div class="text-[11px] text-slate-500 mt-0.5">Termo de transferência (CRCTransf), procurações e-CAC/SEFAZ, importação de balancete e histórico fiscal.</div>
                </div>
              </button>
            </div>
            <div class="flex justify-end pt-2">
              <button type="button" onclick="ZGestorApp.closeModal()" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold cursor-pointer">Fechar</button>
            </div>
          </div>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  },

  aplicarNovoModeloOnboarding(empresaId, tipoModelo) {
    window.zgestorDB.gerarChecklistPadraoEmpresa(empresaId, tipoModelo, true);
    this.closeModal();
    const modNome = tipoModelo === 'TROCA_CONTABILIDADE' ? 'Troca de Contabilidade' : 'Abertura de Empresa';
    this.showToast(`Modelo de checklist "${modNome}" aplicado com sucesso!`, 'success');
    this.renderAll();
  },

  toggleItemOnboarding(itemId, checked) {
    try {
      const res = window.zgestorDB.alternarItemOnboarding(itemId, checked);
      if (res && res.progresso && res.progresso.completo) {
        this.showToast('🎉 Onboarding atingiu 100%! Empresa alterada automaticamente para "Ativa" e rotinas mensais liberadas na carteira!', 'success');
      } else {
        this.showToast(checked ? 'Etapa de Onboarding concluída!' : 'Etapa reaberta.', 'success');
      }
      this.renderAll();
    } catch (err) {
      this.showToast(err.message, 'error');
      this.renderContentOnly();
    }
  },

  openModalItemOnboarding(empresaId) {
    const modal = document.getElementById('modal-root');
    if (!modal) return;
    modal.innerHTML = `
      <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
          <h3 class="text-base font-bold text-slate-900 pb-3 border-b border-slate-200">Adicionar Item ao Checklist de Onboarding</h3>
          <form onsubmit="ZGestorApp.submitItemOnboarding(event, '${empresaId}')" class="space-y-4 mt-4 text-xs">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Fase do Onboarding</label>
              <select id="f-onb-etapa" class="w-full rounded-xl border border-slate-300 px-3 py-2">
                ${window.ZGESTOR_MODELS.etapasOnboarding.map(e => `<option value="${e.id}">${e.titulo}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Departamento Responsável</label>
              <select id="f-onb-dept" class="w-full rounded-xl border border-slate-300 px-3 py-2">
                <option value="SOCIETARIO">Societário</option>
                <option value="FISCAL">Fiscal</option>
                <option value="PESSOAL">Pessoal (DP)</option>
                <option value="CONTABIL">Contábil</option>
                <option value="FINANCEIRO">Financeiro</option>
              </select>
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Descrição da Etapa *</label>
              <input id="f-onb-titulo" type="text" required placeholder="Ex: Cadastro no Portal de Licitações / Alvará Sanitário" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Observação</label>
              <input id="f-onb-obs" type="text" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
            </div>
            <div class="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button type="button" onclick="ZGestorApp.closeModal()" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold">Cancelar</button>
              <button type="submit" class="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold">Adicionar</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  submitItemOnboarding(e, empresaId) {
    e.preventDefault();
    const etapa = document.getElementById('f-onb-etapa').value;
    const dept = document.getElementById('f-onb-dept').value;
    const titulo = document.getElementById('f-onb-titulo').value.trim();
    const obs = document.getElementById('f-onb-obs').value.trim();
    window.zgestorDB.adicionarItemOnboardingCustomizado(empresaId, etapa, titulo, dept, obs);
    this.closeModal();
    this.showToast('Item adicionado ao Onboarding!', 'success');
    this.renderAll();
  },

  finalizarOnboarding(empresaId) {
    window.zgestorDB.concluirOnboardingEmpresa(empresaId, this.state.competencia);
    this.showToast('🎉 Onboarding concluído com 100%! Empresa alterada para "Ativa" e rotinas mensais liberadas na carteira.', 'success');
    this.renderAll();
  },

  // ===========================================================================
  // MODAL E AÇÕES DE PARCELAMENTOS ATIVOS
  // - APENAS EMITIDA E ENVIADA NAS GUIAS
  // - SELETOR DE STATUS DO PARCELAMENTO:
  //   ATIVO, ATIVO EM ATRASO, ENCERRADO POR FALTA DE PAGAMENTO, ENCERRADO POR OPÇÃO
  // ===========================================================================
  alterarStatusParcelamentoRapido(parcelamentoId, novoStatus) {
    window.zgestorDB.atualizarStatusParcelamento(parcelamentoId, novoStatus);
    window.zgestorDB.sincronizarPendenciasParcelamento(this.state.competencia);
    const label = window.ZGestorViews.statusParcelamentoLabel(novoStatus).label;
    this.showToast(`Status do parcelamento atualizado para: ${label}!`, 'success');
    this.renderAll();
  },

  openModalParcelamento(parcelamentoId = null, dadosEmRevisao = null) {
    const db = window.zgestorDB;
    const existente = parcelamentoId ? db.data.parcelamentos.find(p => p.id === parcelamentoId) : null;
    const p = dadosEmRevisao || existente || {
      id: '',
      empresa_id: db.data.empresas[0] ? db.data.empresas[0].id : '',
      cliente_avulso: false,
      nome_cliente: '',
      documento: '',
      orgao: 'Simples Nacional / Receita Federal',
      modalidade: '',
      numero_processo: '',
      total_parcelas: 60,
      parcelas_pagas: 0,
      valor_consolidado: 0.00,
      valor_parcela_estimado: 500.00,
      dia_vencimento: 28,
      status: 'ATIVO',
      observacoes: ''
    };

    const isAvulso = Boolean(p.cliente_avulso);

    const orgaosPadrao = [
      'Simples Nacional / Receita Federal',
      'PGFN / Regularize (Dívida Ativa)',
      'Receita Federal (e-CAC / Previdenciário)',
      'SEFAZ Estadual (ICMS)',
      'Prefeitura Municipal (ISS)',
      'FGTS / Caixa Econômica'
    ];
    const orgaoCustom = p.orgao && !orgaosPadrao.includes(p.orgao);

    const modal = document.getElementById('modal-root');
    if (!modal) return;
    modal.innerHTML = `
      <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 class="text-base font-bold text-slate-900">
                ${p.id ? 'Editar Parcelamento Cadastrado' : 'Cadastrar Novo Parcelamento Ativo'}
              </h3>
              ${p.id ? `<p class="text-[11px] text-amber-700 font-semibold">⚠️ A edição de acordo já cadastrado exigirá uma 2ª confirmação ao salvar.</p>` : ''}
            </div>
            <button onclick="ZGestorApp.closeModal()" class="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
          </div>
          <form onsubmit="ZGestorApp.submitFormParcelamento(event)" class="space-y-4 mt-4 text-xs">
            <input type="hidden" id="f-parc-id" value="${p.id || ''}" />

            <!-- Vínculo do Cliente: Empresa da Carteira vs Cliente Avulso -->
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <label class="block font-bold text-slate-700 mb-1.5">Vínculo do Cliente *</label>
              <div class="grid grid-cols-2 gap-2">
                <label class="flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs ${!isAvulso ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-bold' : 'bg-white border-slate-200 text-slate-700'}">
                  <input type="radio" name="parc_tipo_cliente" value="carteira" ${!isAvulso ? 'checked' : ''} onchange="ZGestorApp.toggleTipoClienteParcelamento('carteira')" class="accent-indigo-600">
                  <span>Empresa da Carteira</span>
                </label>
                <label class="flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs ${isAvulso ? 'bg-purple-50 border-purple-300 text-purple-950 font-bold' : 'bg-white border-slate-200 text-slate-700'}">
                  <input type="radio" name="parc_tipo_cliente" value="avulso" ${isAvulso ? 'checked' : ''} onchange="ZGestorApp.toggleTipoClienteParcelamento('avulso')" class="accent-purple-600">
                  <span>Cliente Avulso</span>
                </label>
              </div>

              <!-- Empresa Cadastrada -->
              <div id="wrapper-parc-carteira" class="${isAvulso ? 'hidden' : 'block'} mt-2.5">
                <label class="block font-bold text-slate-700 mb-1">Empresa Cliente *</label>
                <select id="f-parc-emp" class="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white">
                  ${db.data.empresas.map(e => `<option value="${e.id}" ${e.id === p.empresa_id ? 'selected' : ''}>${e.nome_fantasia} (${e.cnpj})</option>`).join('')}
                </select>
              </div>

              <!-- Cliente Avulso -->
              <div id="wrapper-parc-avulso" class="${isAvulso ? 'block' : 'hidden'} mt-2.5 space-y-2">
                <div class="text-[11px] text-purple-800 bg-purple-50 p-2 rounded-lg border border-purple-200">
                  💡 <strong>Cliente Avulso:</strong> Não cria cadastro na base de empresas recorrentes nem gera rotinas mensais.
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label class="block font-bold text-slate-700 mb-1">Nome / Razão Social *</label>
                    <input id="f-parc-avulso-nome" type="text" value="${p.nome_cliente || ''}" placeholder="Nome ou Razão Social" class="w-full rounded-xl border border-purple-300 px-3 py-2 bg-white" />
                  </div>
                  <div>
                    <label class="block font-bold text-slate-700 mb-1">CPF ou CNPJ *</label>
                    <input id="f-parc-avulso-doc" type="text" value="${p.documento || ''}" placeholder="000.000.000-00 ou CNPJ" class="w-full rounded-xl border border-purple-300 px-3 py-2 bg-white font-mono" />
                  </div>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Órgão Credor *</label>
                <select id="f-parc-orgao" class="w-full rounded-xl border border-slate-300 px-3 py-2">
                  ${orgaosPadrao.map(o => `<option value="${o}" ${o === p.orgao ? 'selected' : ''}>${o}</option>`).join('')}
                  ${orgaoCustom ? `<option value="${p.orgao}" selected>${p.orgao}</option>` : ''}
                </select>
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Modalidade *</label>
                <input id="f-parc-mod" type="text" required value="${p.modalidade || ''}" placeholder="Ex: Ordinário / RELP / Transação" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Nº Processo / Recibo</label>
                <input id="f-parc-proc" type="text" value="${p.numero_processo || ''}" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Total de Parcelas *</label>
                <input id="f-parc-total" type="number" min="1" required value="${p.total_parcelas}" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Parcelas Já Pagas *</label>
                <input id="f-parc-pagas" type="number" min="0" required value="${p.parcelas_pagas}" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Dívida Consolidada (R$)</label>
                <input id="f-parc-cons" type="number" step="0.01" value="${p.valor_consolidado}" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Valor Guia Mensal (R$) *</label>
                <input id="f-parc-val" type="number" step="0.01" required value="${p.valor_parcela_estimado}" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Dia Vencimento</label>
                <input id="f-parc-dia" type="number" min="1" max="31" value="${p.dia_vencimento}" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Status do Parcelamento *</label>
              <select id="f-parc-status" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold">
                <option value="ATIVO" ${p.status === 'ATIVO' ? 'selected' : ''}>🟢 Ativo (Em Dia)</option>
                <option value="EM_ATRASO" ${p.status === 'EM_ATRASO' ? 'selected' : ''}>🔴 Ativo em Atraso</option>
                <option value="ENCERRADO_FALTA_PAGAMENTO" ${p.status === 'ENCERRADO_FALTA_PAGAMENTO' ? 'selected' : ''}>⚠️ Encerrado por Falta de Pagamento</option>
                <option value="ENCERRADO_OPCAO" ${p.status === 'ENCERRADO_OPCAO' ? 'selected' : ''}>⚪ Encerrado por Opção / Quitação</option>
              </select>
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Observações de Emissão</label>
              <input id="f-parc-obs" type="text" value="${p.observacoes || ''}" placeholder="Ex: Emitir todo dia 20 no portal e-CAC..." class="w-full rounded-xl border border-slate-300 px-3 py-2" />
            </div>
            <div class="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button type="button" onclick="ZGestorApp.closeModal()" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold">Cancelar</button>
              <button type="submit" class="px-5 py-2 rounded-xl ${p.id ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white font-bold shadow">
                ${p.id ? 'Avançar para 2ª Confirmação →' : 'Salvar Parcelamento'}
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  toggleTipoClienteParcelamento(tipo) {
    const wCarteira = document.getElementById('wrapper-parc-carteira');
    const wAvulso = document.getElementById('wrapper-parc-avulso');
    if (wCarteira && wAvulso) {
      if (tipo === 'avulso') {
        wCarteira.classList.add('hidden');
        wCarteira.classList.remove('block');
        wAvulso.classList.remove('hidden');
        wAvulso.classList.add('block');
      } else {
        wCarteira.classList.remove('hidden');
        wCarteira.classList.add('block');
        wAvulso.classList.add('hidden');
        wAvulso.classList.remove('block');
      }
    }
  },

  submitFormParcelamento(e) {
    e.preventDefault();
    const idExistente = document.getElementById('f-parc-id').value || null;
    const tipoCliente = document.querySelector('input[name="parc_tipo_cliente"]:checked')?.value || 'carteira';
    const isAvulso = tipoCliente === 'avulso';

    let empresaId = null;
    let nomeAvulso = '';
    let docAvulso = '';

    if (isAvulso) {
      nomeAvulso = (document.getElementById('f-parc-avulso-nome')?.value || '').trim();
      docAvulso = (document.getElementById('f-parc-avulso-doc')?.value || '').trim();
      if (!nomeAvulso) {
        this.showToast('Informe o Nome ou Razão Social do cliente avulso.', 'error');
        return;
      }
    } else {
      const empSelect = document.getElementById('f-parc-emp');
      empresaId = empSelect ? empSelect.value : null;
    }

    const dados = {
      id: idExistente,
      cliente_avulso: isAvulso,
      nome_cliente: isAvulso ? nomeAvulso : '',
      documento: isAvulso ? docAvulso : '',
      empresa_id: isAvulso ? null : empresaId,
      orgao: document.getElementById('f-parc-orgao').value,
      modalidade: document.getElementById('f-parc-mod').value.trim(),
      numero_processo: document.getElementById('f-parc-proc').value.trim(),
      total_parcelas: Number(document.getElementById('f-parc-total').value || 60),
      parcelas_pagas: Number(document.getElementById('f-parc-pagas').value || 0),
      valor_consolidado: Number(document.getElementById('f-parc-cons').value || 0),
      valor_parcela_estimado: Number(document.getElementById('f-parc-val').value || 0),
      dia_vencimento: Number(document.getElementById('f-parc-dia').value || 28),
      status: document.getElementById('f-parc-status').value,
      observacoes: document.getElementById('f-parc-obs').value.trim()
    };

    if (idExistente) {
      this.state.parcelamentoPendenteEdicao = dados;
      this.abrirSegundaConfirmacaoParcelamento(dados);
      return;
    }

    window.zgestorDB.salvarParcelamento(dados, this.state.competencia);
    this.closeModal();
    this.showToast('Novo parcelamento cadastrado e guia da competência gerada!', 'success');
    this.renderAll();
  },

  abrirSegundaConfirmacaoParcelamento(dados) {
    const db = window.zgestorDB;
    const V = window.ZGestorViews;
    const emp = dados.cliente_avulso ? null : db.data.empresas.find(e => e.id === dados.empresa_id);
    const original = db.data.parcelamentos.find(p => p.id === dados.id);
    const nomeEmpresa = dados.cliente_avulso ? `${dados.nome_cliente} (Cliente Avulso)` : (emp ? emp.nome_fantasia : '—');

    const modal = document.getElementById('modal-root');
    if (!modal) return;
    modal.innerHTML = `
      <div class="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border-2 border-amber-500">
          <div class="flex items-center gap-3 pb-3 border-b border-slate-200">
            <div class="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <i data-lucide="shield-alert" class="w-6 h-6"></i>
            </div>
            <div>
              <span class="text-[10px] font-extrabold uppercase tracking-wider text-amber-700">2ª Confirmação Obrigatória de Segurança</span>
              <h3 class="text-base font-bold text-slate-900">Confirmar Alteração de Parcelamento Já Cadastrado?</h3>
            </div>
          </div>

          <div class="mt-4 space-y-3 text-xs">
            <p class="text-slate-600">
              Você está alterando os dados de um parcelamento já cadastrado para <strong>${nomeEmpresa}</strong>. Revise os novos dados:
            </p>

            <div class="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5">
              <div><strong>Órgão / Modalidade:</strong> ${dados.orgao} — ${dados.modalidade}</div>
              <div><strong>Nº Processo:</strong> ${dados.numero_processo || '—'}</div>
              <div>
                <strong>Andamento das Parcelas:</strong>
                ${original ? `<span class="line-through text-slate-400 mr-1">${original.parcelas_pagas}/${original.total_parcelas}</span> →` : ''}
                <strong class="text-indigo-800">${dados.parcelas_pagas}/${dados.total_parcelas}</strong>
              </div>
              <div>
                <strong>Valor da Guia Mensal:</strong>
                ${original ? `<span class="line-through text-slate-400 mr-1">${V.formatCurrency(original.valor_parcela_estimado)}</span> →` : ''}
                <strong class="text-emerald-800">${V.formatCurrency(dados.valor_parcela_estimado)}</strong> (Venc. dia ${dados.dia_vencimento})
              </div>
              <div><strong>Status:</strong> <span class="font-bold">${V.statusParcelamentoLabel(dados.status).label}</span></div>
            </div>
          </div>

          <div class="flex justify-end gap-2 mt-5 pt-3 border-t border-slate-200 text-xs">
            <button type="button" onclick="ZGestorApp.voltarEdicaoParcelamento()" class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold">
              ← Voltar e Revisar
            </button>
            <button type="button" onclick="ZGestorApp.confirmarSegundaEtapaParcelamento()" class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow">
              ✓ Sim, Confirmar e Salvar (2ª Confirmação)
            </button>
          </div>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  },

  voltarEdicaoParcelamento() {
    const pendente = this.state.parcelamentoPendenteEdicao;
    if (!pendente) {
      this.closeModal();
      return;
    }
    this.openModalParcelamento(pendente.id, pendente);
  },

  confirmarSegundaEtapaParcelamento() {
    const dados = this.state.parcelamentoPendenteEdicao;
    if (!dados) return;
    window.zgestorDB.salvarParcelamento(dados, this.state.competencia);
    this.state.parcelamentoPendenteEdicao = null;
    this.closeModal();
    this.showToast('Alterações do parcelamento confirmadas em 2 etapas e salvas com sucesso!', 'success');
    this.renderAll();
  },

  excluirCadastroParcelamento(parcelamentoId) {
    window.zgestorDB.excluirParcelamento(parcelamentoId);
    this.showToast('Cadastro de parcelamento removido.', 'info');
    this.renderAll();
  },

  avancarGuiaParcelamento(guiaId, novoStatus) {
    window.zgestorDB.atualizarStatusGuiaParcelamento(guiaId, novoStatus);
    window.zgestorDB.sincronizarPendenciasParcelamento(this.state.competencia);
    const label = novoStatus === 'ENVIADA_CLIENTE' ? 'Enviada ao Cliente' : 'Guia Emitida';
    this.showToast(`Guia marcada como: ${label}!`, 'success');
    this.renderAll();
  },

  // ===========================================================================
  // CONTROLE DE CNDs (CERTIDÕES NEGATIVAS DE DÉBITOS)
  // ===========================================================================
  gerarGradeCNDs() {
    const qtd = window.zgestorDB.gerarGradePadraoCNDs();
    if (qtd > 0) {
      this.showToast(`${qtd} novas certidões adicionadas à grade de monitoramento das empresas!`, 'success');
    } else {
      this.showToast('A grade padrão de CNDs (Federal, Estadual, FGTS e Trabalhista) já está completa.', 'info');
    }
    this.renderAll();
  },

  openModalCND(cndId = null) {
    const db = window.zgestorDB;
    const user = db.getCurrentUser();
    const hoje = new Date().toISOString().slice(0, 10);
    const daqui180 = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const existente = cndId ? db.getCNDs().find(c => c.id === cndId) : null;
    const tiposCNDRaw = window.ZGESTOR_MODELS.tiposCND || [
      'CND Federal / PGFN (RFB / PGFN / INSS)',
      'CRF - Regularidade do FGTS (Caixa Econômica)',
      'CNDT - Certidão Trabalhista (TST)',
      'CND Estadual (SEFAZ MG / SEFAZ ES)',
      'CND Municipal (Prefeitura ISS MG / ES)'
    ];
    const tiposCND = tiposCNDRaw.map(t => typeof t === 'string' ? t : t.nome);

    const c = existente || {
      id: '',
      empresa_id: db.data.empresas[0] ? db.data.empresas[0].id : '',
      orgao: tiposCND[0],
      situacao: 'NEGATIVA',
      numero_controle: '',
      data_emissao: hoje,
      data_vencimento: daqui180,
      responsavel_nome: user.nome,
      observacoes: ''
    };

    const modal = document.getElementById('modal-root');
    if (!modal) return;
    modal.innerHTML = `
      <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 class="text-base font-bold text-slate-900">${c.id ? 'Renovar / Editar Certidão (CND)' : 'Cadastrar Nova Certidão Negativa (CND)'}</h3>
              <p class="text-xs text-slate-500">Informe a emissão e a validade para o cálculo automático de vigência</p>
            </div>
            <button onclick="ZGestorApp.closeModal()" class="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
          </div>

          <form onsubmit="ZGestorApp.submitFormCND(event)" class="space-y-4 mt-4 text-xs">
            <input type="hidden" id="f-cnd-id" value="${c.id || ''}" />

            <div>
              <label class="block font-bold text-slate-700 mb-1">Empresa Cliente *</label>
              <select id="f-cnd-emp" required class="w-full rounded-xl border border-slate-300 px-3 py-2">
                ${db.data.empresas.map(e => `<option value="${e.id}" ${e.id === c.empresa_id ? 'selected' : ''}>${e.nome_fantasia} (${e.cnpj})</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Órgão / Tipo de Certidão *</label>
              <select id="f-cnd-orgao" required class="w-full rounded-xl border border-slate-300 px-3 py-2 font-semibold">
                ${tiposCND.map(tc => `<option value="${tc}" ${tc === c.orgao ? 'selected' : ''}>${tc}</option>`).join('')}
              </select>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Resultado da Certidão *</label>
                <select id="f-cnd-sit" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold">
                  <option value="NEGATIVA" ${c.situacao === 'NEGATIVA' ? 'selected' : ''}>🟢 Certidão Negativa</option>
                  <option value="POSITIVA_EFEITO_NEGATIVA" ${c.situacao === 'POSITIVA_EFEITO_NEGATIVA' ? 'selected' : ''}>🔵 Positiva com Efeito de Negativa</option>
                  <option value="POSITIVA_COM_PENDENCIA" ${c.situacao === 'POSITIVA_COM_PENDENCIA' ? 'selected' : ''}>🔴 Positiva / Com Pendência</option>
                </select>
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Código de Controle / Autenticação</label>
                <input id="f-cnd-num" type="text" value="${c.numero_controle || ''}" placeholder="Ex: 8F92.A104.C329.7711" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono" />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-teal-50/70 border border-teal-200">
              <div>
                <label class="block font-bold text-teal-950 mb-1">Data de Emissão *</label>
                <input id="f-cnd-emis" type="date" required value="${c.data_emissao}" class="w-full rounded-xl border border-teal-300 px-3 py-2 bg-white font-semibold" />
              </div>
              <div>
                <label class="block font-bold text-teal-950 mb-1">Data de Vencimento / Validade *</label>
                <input id="f-cnd-venc" type="date" required value="${c.data_vencimento}" class="w-full rounded-xl border border-teal-300 px-3 py-2 bg-white font-bold" />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Responsável pela Emissão</label>
                <select id="f-cnd-resp" class="w-full rounded-xl border border-slate-300 px-3 py-2">
                  ${(db.data.profiles || []).map(p => `<option value="${p.nome}" ${p.nome === c.responsavel_nome ? 'selected' : ''}>${p.nome}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Observações / Pendência</label>
                <input id="f-cnd-obs" type="text" value="${c.observacoes || ''}" placeholder="Ex: Necessária para licitação..." class="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
            </div>

            <!-- ÁREA DE ANEXAR CERTIDÃO -->
            <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <label class="block font-bold text-slate-800 mb-1 flex items-center justify-between">
                <span>Anexo da Certidão (PDF, XML, Planilha ou Imagem)</span>
                <span class="text-[11px] font-semibold text-indigo-700">Até 15 MB</span>
              </label>
              <div class="flex items-center gap-2 mt-1.5">
                <input id="f-cnd-pdf-file" type="file" accept=".pdf,.xml,.xlsx,.xls,.csv,.png,.jpg,.jpeg" onchange="ZGestorApp.handleCNDPDFSelected(event)" class="text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer" />
              </div>
              <div id="f-cnd-pdf-status" class="mt-1 text-[11px] text-slate-600">
                ${c.arquivo_pdf_nome ? `<span class="text-emerald-700 font-semibold">✓ Arquivo atual: ${c.arquivo_pdf_nome}</span>` : '<span class="text-slate-400">Nenhum arquivo anexado ainda</span>'}
              </div>
              <input type="hidden" id="f-cnd-pdf-nome" value="${c.arquivo_pdf_nome || ''}" />
              <input type="hidden" id="f-cnd-pdf-base64" value="${c.arquivo_pdf_base64 || ''}" />
            </div>

            <div class="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button type="button" onclick="ZGestorApp.closeModal()" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold">Cancelar</button>
              <button type="submit" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow">Salvar CND</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  handleCNDPDFSelected(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const permitidos = ['.pdf', '.xml', '.xlsx', '.xls', '.csv', '.png', '.jpg', '.jpeg'];
    const val = this.validarArquivoUpload(file, permitidos, 15);
    if (!val.valido) {
      this.showToast(val.erro, 'error');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const b64 = evt.target.result;
      const nomeInput = document.getElementById('f-cnd-pdf-nome');
      const b64Input = document.getElementById('f-cnd-pdf-base64');
      const statusSpan = document.getElementById('f-cnd-pdf-status');
      if (nomeInput) nomeInput.value = file.name;
      if (b64Input) b64Input.value = b64;
      if (statusSpan) statusSpan.innerHTML = `<span class="text-emerald-700 font-bold">✓ Arquivo Selecionado: ${file.name} (${(file.size / 1024).toFixed(1)} KB)</span>`;
      this.showToast(`Arquivo "${file.name}" anexado à CND com sucesso!`, 'info');
    };
    reader.readAsDataURL(file);
  },

  submitFormCND(e) {
    e.preventDefault();
    const nomePdf = document.getElementById('f-cnd-pdf-nome')?.value || '';
    const base64Pdf = document.getElementById('f-cnd-pdf-base64')?.value || '';
    window.zgestorDB.salvarCND({
      id: document.getElementById('f-cnd-id').value || null,
      empresa_id: document.getElementById('f-cnd-emp').value,
      orgao: document.getElementById('f-cnd-orgao').value,
      situacao: document.getElementById('f-cnd-sit').value,
      numero_controle: document.getElementById('f-cnd-num').value.trim(),
      data_emissao: document.getElementById('f-cnd-emis').value,
      data_vencimento: document.getElementById('f-cnd-venc').value,
      responsavel_nome: document.getElementById('f-cnd-resp').value,
      observacoes: document.getElementById('f-cnd-obs').value.trim(),
      arquivo_pdf_nome: nomePdf,
      arquivo_pdf_base64: base64Pdf,
      origem_emissao: nomePdf ? 'MANUAL_PDF' : 'MANUAL'
    });
    this.closeModal();
    this.showToast('Certidão (CND) salva e validade recalculada!', 'success');
    this.renderAll();
  },

  excluirCND(cndId) {
    window.zgestorDB.excluirCND(cndId);
    this.showToast('Certidão removida do controle.', 'info');
    this.renderAll();
  },

  clicarRenovarCND(cndId) {
    const db = window.zgestorDB;
    const cnd = (db.data.cnds || []).find(c => c.id === cndId);
    if (!cnd) return;
    const cfg = db.getEscritorioConfig();
    const isApiAtiva = Boolean(cfg.api_integra_contador && cfg.api_integra_contador.ativo);

    if (isApiAtiva) {
      this.abrirModalRenovacaoCND(cndId);
    } else {
      this.abrirModalAnexarPDFCND(cndId);
    }
  },

  abrirModalRenovacaoCND(cndId) {
    const db = window.zgestorDB;
    const cnd = (db.data.cnds || []).find(c => c.id === cndId);
    if (!cnd) return;
    const emp = db.data.empresas.find(e => e.id === cnd.empresa_id);

    const modal = document.getElementById('modal-root');
    if (!modal) return;
    modal.innerHTML = `
      <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <div class="flex items-center gap-1.5 text-teal-700 text-xs font-bold uppercase tracking-wider">
                <span class="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                <span>API Integra Contador (SERPRO / RFB) Ativa</span>
              </div>
              <h3 class="text-base font-bold text-slate-900 mt-0.5">Renovação de Certidão (CND)</h3>
            </div>
            <button onclick="ZGestorApp.closeModal()" class="text-slate-400 hover:text-slate-600 text-xl font-bold cursor-pointer">×</button>
          </div>

          <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 mt-4 space-y-1 text-xs">
            <div class="font-bold text-slate-900 text-sm">${emp ? emp.nome_fantasia : 'Empresa Cliente'}</div>
            <div class="text-slate-600">CNPJ: <span class="font-mono font-bold">${emp ? emp.cnpj : ''}</span></div>
            <div class="text-indigo-900 font-semibold">${cnd.orgao}</div>
            <div class="text-slate-500">Validade Atual: <strong class="text-slate-700">${cnd.data_vencimento || cnd.data_validade || '—'}</strong></div>
          </div>

          <div class="mt-5 space-y-3">
            <div class="p-4 rounded-xl border-2 border-teal-500 bg-teal-50/50 hover:bg-teal-50 transition cursor-pointer" onclick="ZGestorApp.executarRenovacaoAPI('${cnd.id}')">
              <div class="flex items-start gap-3">
                <div class="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0">
                  ⚡
                </div>
                <div class="flex-1">
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-bold text-teal-950">Renovar Automaticamente via API</span>
                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-teal-200 text-teal-800 font-bold uppercase">Recomendado</span>
                  </div>
                  <p class="text-xs text-teal-800 mt-1 leading-relaxed">
                    Consulta a base oficial em tempo real (SERPRO/Receita/Caixa), gera novo protocolo autenticado e estende a vigência sem necessidade de upload manual.
                  </p>
                  <div class="mt-2.5">
                    <button type="button" class="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs cursor-pointer">
                      ⚡ Executar Consulta & Renovar Agora
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition cursor-pointer" onclick="ZGestorApp.abrirModalAnexarPDFCND('${cnd.id}')">
              <div class="flex items-start gap-3">
                <div class="w-9 h-9 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-base shrink-0">
                  📄
                </div>
                <div class="flex-1">
                  <span class="text-sm font-bold text-slate-800 block">Anexar Nova Certidão em PDF</span>
                  <p class="text-xs text-slate-500 mt-1 leading-relaxed">
                    Caso tenha emitido o PDF diretamente pelo portal do órgão ou prefeitura e queira arquivar o arquivo com nova data de validade.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div class="flex justify-end pt-4 mt-4 border-t border-slate-200">
            <button type="button" onclick="ZGestorApp.closeModal()" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs cursor-pointer">Cancelar</button>
          </div>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  },

  executarRenovacaoAPI(cndId) {
    try {
      const db = window.zgestorDB;
      const cnd = db.renovarCNDViaAPIIntegraContador(cndId);
      this.closeModal();
      this.showToast(`Certidão "${cnd.orgao}" renovada com sucesso via API Integra Contador! Nova validade: ${cnd.data_validade} (Protocolo: ${cnd.numero_controle})`, 'success');
      this.renderAll();
    } catch (err) {
      this.showToast(`Integração com API indisponível: ${err.message}`, 'error');
    }
  },

  sincronizarTodasCNDsAPI() {
    const db = window.zgestorDB;
    const cfg = db.getEscritorioConfig();
    if (!cfg.api_integra_contador || !cfg.api_integra_contador.ativo) {
      this.showToast('A API Integra Contador não está ativada. Ative na tela "Dados do Escritório" para sincronização automática.', 'warning');
      return;
    }
    const cnds = db.getCNDs();
    let count = 0;
    let falhas = 0;
    cnds.forEach(c => {
      const dias = db.calcularDiasRestantes(c.data_vencimento || c.data_validade);
      if (dias <= 45) {
        try {
          db.renovarCNDViaAPIIntegraContador(c.id);
          count++;
        } catch (e) {
          falhas++;
        }
      }
    });
    if (falhas > 0 && count === 0) {
      this.showToast(`Sincronização via API indisponível: o serviço oficial do Integra Contador não respondeu (${falhas} certidões mantidas intactas).`, 'warning');
    } else if (falhas > 0) {
      this.showToast(`Sincronização parcial: ${count} certidões renovadas, ${falhas} indisponíveis no momento.`, 'info');
    } else {
      this.showToast(`Sincronização em Lote concluída! ${count} certidões com vigência próxima foram renovadas e atualizadas via API SERPRO / RFB.`, 'success');
    }
    this.renderAll();
  },

  abrirModalAnexarPDFCND(cndId) {
    const db = window.zgestorDB;
    const cnd = (db.data.cnds || []).find(c => c.id === cndId);
    if (!cnd) return;
    const emp = db.data.empresas.find(e => e.id === cnd.empresa_id);
    const hoje = new Date().toISOString().slice(0, 10);

    let dias = 180;
    const esf = (cnd.esfera || '').toUpperCase();
    if (esf === 'FGTS') dias = 30;
    else if (esf === 'ESTADUAL' || esf === 'MUNICIPAL') dias = 90;
    const dataVencSugerida = new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    this.state.cndAnexoTemp = {
      nome: cnd.arquivo_pdf_nome || '',
      base64: cnd.arquivo_pdf_base64 || ''
    };

    const modal = document.getElementById('modal-root');
    if (!modal) return;
    modal.innerHTML = `
      <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <span class="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Controle de Certidões Negativas</span>
              <h3 class="text-base font-bold text-slate-900">Anexar Arquivo PDF da Certidão (CND)</h3>
            </div>
            <button onclick="ZGestorApp.closeModal()" class="text-slate-400 hover:text-slate-600 text-xl font-bold cursor-pointer">×</button>
          </div>

          <form onsubmit="ZGestorApp.submitAnexarPDFCND(event, '${cnd.id}')" class="space-y-4 mt-4 text-xs">
            <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div class="font-bold text-slate-900 text-sm">${emp ? emp.nome_fantasia : 'Cliente'} (${emp ? emp.cnpj : ''})</div>
              <div class="font-semibold text-indigo-900">${cnd.orgao}</div>
              <div class="text-slate-500">Validade anterior: ${cnd.data_vencimento || cnd.data_validade || '—'}</div>
            </div>

            <div class="p-4 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50/40 text-center">
              <input id="f-cnd-modal-file" type="file" accept=".pdf,.xml,.xlsx,.xls,.csv,.png,.jpg,.jpeg" onchange="ZGestorApp.handleCNDModalPDFSelected(event)" class="hidden" />
              <label for="f-cnd-modal-file" class="cursor-pointer block">
                <div class="w-12 h-12 mx-auto rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg mb-2">
                  📎
                </div>
                <span class="font-bold text-indigo-950 block text-sm">Clique para selecionar o arquivo da Certidão</span>
                <span class="text-slate-500 text-[11px] block mt-0.5">Formatos suportados: PDF, XML, Planilha ou Imagem (até 15 MB)</span>
              </label>
              <div id="cnd-modal-pdf-preview" class="mt-2.5 font-bold text-xs text-indigo-900">
                ${cnd.arquivo_pdf_nome ? `📄 Arquivo Atual: ${cnd.arquivo_pdf_nome}` : 'Nenhum novo arquivo selecionado'}
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Data de Emissão da Nova CND *</label>
                <input id="f-cnd-anexo-emis" type="date" required value="${hoje}" class="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Nova Data de Validade / Vencimento *</label>
                <input id="f-cnd-anexo-venc" type="date" required value="${dataVencSugerida}" class="w-full rounded-xl border border-indigo-400 px-3 py-2 bg-white font-bold text-indigo-900" />
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Código de Controle / Autenticação (opcional)</label>
              <input id="f-cnd-anexo-cod" type="text" value="${cnd.numero_controle || ''}" placeholder="Ex: 8F92.A104.C329.7711" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono" />
            </div>

            <div class="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button type="button" onclick="ZGestorApp.closeModal()" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold cursor-pointer">Cancelar</button>
              <button type="submit" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow cursor-pointer">Salvar Certidão & Anexo</button>
            </div>
          </form>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  },

  handleCNDModalPDFSelected(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const permitidos = ['.pdf', '.xml', '.xlsx', '.xls', '.csv', '.png', '.jpg', '.jpeg'];
    const val = this.validarArquivoUpload(file, permitidos, 15);
    if (!val.valido) {
      this.showToast(val.erro, 'error');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      this.state.cndAnexoTemp = {
        nome: file.name,
        base64: evt.target.result
      };
      const preview = document.getElementById('cnd-modal-pdf-preview');
      if (preview) {
        preview.innerHTML = `<span class="text-emerald-700 font-bold">✓ Arquivo Selecionado: ${file.name} (${(file.size / 1024).toFixed(1)} KB)</span>`;
      }
      this.showToast(`Arquivo "${file.name}" carregado com sucesso!`, 'info');
    };
    reader.readAsDataURL(file);
  },

  submitAnexarPDFCND(e, cndId) {
    e.preventDefault();
    const dataEmis = document.getElementById('f-cnd-anexo-emis').value;
    const dataVenc = document.getElementById('f-cnd-anexo-venc').value;
    const numCod = document.getElementById('f-cnd-anexo-cod').value.trim();
    const anexo = this.state.cndAnexoTemp || {};

    const nome = anexo.nome || 'Certidao_Negativa.pdf';
    const b64 = anexo.base64 || '';

    window.zgestorDB.anexarPDFCND(cndId, nome, b64, dataEmis, dataVenc, numCod);
    this.closeModal();
    this.showToast(`Certidão renovada e arquivo PDF "${nome}" anexado com sucesso!`, 'success');
    this.renderAll();
  },

  visualizarOuBaixarPDFCND(cndId) {
    const db = window.zgestorDB;
    const cnd = (db.data.cnds || []).find(c => c.id === cndId);
    if (!cnd) return;
    const emp = db.data.empresas.find(e => e.id === cnd.empresa_id);

    const modal = document.getElementById('modal-root');
    if (!modal) return;
    modal.innerHTML = `
      <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200">
            <div class="flex items-center gap-2">
              <span class="text-xl">📄</span>
              <div>
                <h3 class="text-base font-bold text-slate-900">Visualização de Certidão Negativa (CND)</h3>
                <p class="text-xs text-slate-500">${cnd.arquivo_pdf_nome || 'Certidao.pdf'}</p>
              </div>
            </div>
            <button onclick="ZGestorApp.closeModal()" class="text-slate-400 hover:text-slate-600 text-xl font-bold cursor-pointer">×</button>
          </div>

          <div class="mt-4 p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <div class="border-2 border-slate-300 rounded-xl p-5 bg-white shadow-xs">
              <div class="text-center pb-3 border-b border-slate-200">
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">República Federativa do Brasil</span>
                <h4 class="text-sm font-extrabold text-slate-900 uppercase mt-0.5">${cnd.orgao}</h4>
                <div class="inline-block px-3 py-1 rounded-full text-xs font-bold mt-2 ${cnd.situacao === 'NEGATIVA' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-blue-100 text-blue-800 border border-blue-300'}">
                  ${cnd.situacao === 'NEGATIVA' ? '✓ CERTIDÃO NEGATIVA DE DÉBITOS' : '✓ POSITIVA COM EFEITO DE NEGATIVA'}
                </div>
              </div>

              <div class="pt-4 space-y-2 text-xs">
                <div><span class="text-slate-500">Razão Social:</span> <strong class="text-slate-900">${emp ? emp.razao_social : '—'}</strong></div>
                <div><span class="text-slate-500">Nome Fantasia:</span> <strong class="text-slate-900">${emp ? emp.nome_fantasia : '—'}</strong></div>
                <div><span class="text-slate-500">CNPJ:</span> <span class="font-mono font-bold text-slate-800">${emp ? emp.cnpj : '—'}</span></div>
                <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  <div><span class="text-slate-500">Emissão:</span> <strong class="text-slate-800">${cnd.data_emissao || '—'}</strong></div>
                  <div><span class="text-slate-500">Validade:</span> <strong class="text-emerald-700">${cnd.data_vencimento || cnd.data_validade || '—'}</strong></div>
                </div>
                <div class="pt-1"><span class="text-slate-500">Código de Controle / Autenticação:</span> <code class="bg-slate-100 px-2 py-0.5 rounded font-mono text-[11px] text-slate-800">${cnd.numero_controle || cnd.codigo_controle || 'IC-VALID-2026'}</code></div>
                <div class="pt-1 text-[11px] text-slate-500 italic">Origem: ${cnd.origem_emissao === 'API_INTEGRA_CONTADOR' ? 'Emissão Automática via API Integra Contador (SERPRO / RFB)' : 'Documento anexado manualmente em formato PDF'}</div>
              </div>
            </div>
          </div>

          <div class="flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5 pt-4 mt-4 border-t border-slate-200">
            <span class="text-xs text-slate-500">Arquivo pronto para download ou visualização</span>
            <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
              <button type="button" onclick="ZGestorApp.visualizarPDFCNDNavegador('${cnd.id}')" class="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center gap-1.5 border border-indigo-200 cursor-pointer">
                <i data-lucide="eye" class="w-4 h-4"></i> Visualizar no Navegador
              </button>
              <button type="button" onclick="ZGestorApp.baixarPDFCND('${cnd.id}')" class="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer">
                <i data-lucide="download" class="w-4 h-4"></i> Baixar Arquivo
              </button>
              <button type="button" onclick="ZGestorApp.closeModal()" class="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-200 text-slate-700 font-semibold text-xs cursor-pointer">Fechar</button>
            </div>
          </div>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  },

  visualizarPDFCNDNavegador(cndId) {
    const db = window.zgestorDB;
    const cnd = (db.data.cnds || []).find(c => c.id === cndId);
    if (!cnd || !cnd.arquivo_pdf_base64) {
      this.showToast('Nenhum arquivo digital disponível para pré-visualização.', 'warning');
      return;
    }
    try {
      const parts = cnd.arquivo_pdf_base64.split(';base64,');
      let contentType = 'application/pdf';
      if (parts[0] && parts[0].includes(':')) {
        contentType = parts[0].split(':')[1];
      }
      const b64Data = parts[1] || '';
      const byteCharacters = atob(b64Data);
      const byteArrays = [];
      for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
        }
        byteArrays.push(new Uint8Array(byteNumbers));
      }
      const blob = new Blob(byteArrays, { type: contentType });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      this.showToast('Visualização da certidão aberta em nova aba!', 'info');
    } catch (e) {
      window.open(cnd.arquivo_pdf_base64, '_blank');
    }
  },

  baixarPDFCND(cndId) {
    const db = window.zgestorDB;
    const cnd = (db.data.cnds || []).find(c => c.id === cndId);
    if (!cnd) return;
    const nome = cnd.arquivo_pdf_nome || 'Certidao_Negativa.pdf';
    
    const conteudo = cnd.arquivo_pdf_base64 && cnd.arquivo_pdf_base64.startsWith('data:') 
      ? cnd.arquivo_pdf_base64 
      : 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXr...';
    const a = document.createElement('a');
    a.href = conteudo;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    this.showToast(`Download da certidão "${nome}" iniciado!`, 'success');
  },

  // ===========================================================================
  // PORTAL DO CLIENTE (ARQUIVOS DA EMPRESA, GUIAS E SOLICITAÇÕES P/ CONTABILIDADE)
  // ===========================================================================
  selecionarEmpresaCentral(empresaId) {
    this.state.empresaCentralId = empresaId;
    this.renderContentOnly();
  },

  openModalArquivoPortal(empresaId, pastaPadrao = 'CONSTITUTIVOS') {
    const db = window.zgestorDB;
    const emp = db.data.empresas.find(e => e.id === empresaId) || db.data.empresas[0];
    const comp = this.state.competencia;
    const pastasRaw = (window.ZGESTOR_MODELS && window.ZGESTOR_MODELS.pastasPortalCliente) || [
      { id: 'CONSTITUTIVOS', label: '1. Documentos Constitutivos & Societários' },
      { id: 'GUIAS_IMPOSTOS', label: '2. Guias de Impostos Mensais & Parcelamentos' },
      { id: 'CONTABIL_FOLHA', label: '3. Balancetes, Demonstrações & Folha/Pró-Labore' },
      { id: 'CERTIDOES_CND', label: '4. Certidões Negativas (CNDs)' }
    ];
    const pastas = pastasRaw.map(p => ({
      ...p,
      label: p.label || p.nome || p.id
    }));

    this.state.arquivoPortalLeituraTemp = null;

    const modal = document.getElementById('modal-root');
    if (!modal) return;
    modal.innerHTML = `
      <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Cofre Digital — Portal do Cliente</span>
              <h3 class="text-base font-bold text-slate-900">Disponibilizar Arquivo ou Guia no Portal do Cliente</h3>
            </div>
            <button onclick="ZGestorApp.closeModal()" class="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
          </div>

          <form onsubmit="ZGestorApp.submitFormArquivoPortal(event)" class="space-y-4 mt-4 text-xs">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="sm:col-span-2">
                <label class="block font-bold text-slate-700 mb-1">Empresa Cliente *</label>
                <select id="f-ap-emp" required class="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold">
                  ${db.data.empresas.map(e => `<option value="${e.id}" ${emp && e.id === emp.id ? 'selected' : ''}>${e.nome_fantasia} (${e.cnpj})</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Competência</label>
                <input id="f-ap-comp" type="text" value="${pastaPadrao === 'CONSTITUTIVOS' ? 'Permanente' : comp}" placeholder="10/2026 ou Permanente" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold" />
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Pasta de Destino no Portal do Cliente *</label>
              <select id="f-ap-pasta" onchange="if(this.value==='CONSTITUTIVOS'){document.getElementById('f-ap-comp').value='Permanente';}else{document.getElementById('f-ap-comp').value='${comp}';}" class="w-full rounded-xl border border-indigo-300 bg-indigo-50/40 px-3 py-2 font-bold text-indigo-950">
                ${pastas.map(p => `<option value="${p.id}" ${p.id === pastaPadrao ? 'selected' : ''}>${p.label}</option>`).join('')}
              </select>
            </div>

            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="block font-bold text-slate-700">Selecionar Arquivo *</label>
                <span class="text-[10px] text-emerald-700 font-bold">PDF, XML, XLSX, CSV, Imagens (até 15 MB)</span>
              </div>
              <input
                type="file"
                id="f-ap-file-input"
                accept=".pdf,.xml,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
                onchange="ZGestorApp.aoSelecionarArquivoInputPortal(this)"
                class="w-full rounded-xl border border-dashed border-emerald-400 bg-emerald-50/40 px-3 py-2.5 text-xs cursor-pointer"
              />
              <p class="text-[10px] text-slate-500 mt-1">Ao escolher um arquivo do seu computador ou celular, o nome, extensão e tamanho são preenchidos automaticamente.</p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="sm:col-span-2">
                <label class="block font-bold text-slate-700 mb-1">Título do Documento / Guia no Portal *</label>
                <input id="f-ap-titulo" type="text" required placeholder="Ex: Contrato Social Consolidado / Guia DAS 10/2026 / Balancete" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-semibold" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Nome do Arquivo *</label>
                <input id="f-ap-nome-arq" type="text" required placeholder="Documento.pdf" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono" />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Data de Vencimento (Se for Guia ou CND)</label>
                <input id="f-ap-venc" type="date" class="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Valor da Guia (R$ - Opcional)</label>
                <input id="f-ap-valor" type="number" step="0.01" placeholder="0,00" class="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white font-bold" />
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Observações / Instruções para o Cliente</label>
              <textarea id="f-ap-obs" rows="2" placeholder="Ex: Documento constitutivo autenticado pela Junta Comercial / Pagar até a data de vencimento..." class="w-full rounded-xl border border-slate-300 px-3 py-2"></textarea>
            </div>

            <div class="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button type="button" onclick="ZGestorApp.closeModal()" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold">Cancelar</button>
              <button type="submit" class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow">
                Publicar no Portal do Cliente
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  aoSelecionarArquivoInputPortal(input) {
    const file = input && input.files && input.files[0];
    if (!file) return;

    // Validação de formato e tamanho máximo (até 15 MB)
    const permitidos = ['.pdf', '.xml', '.xlsx', '.xls', '.csv', '.png', '.jpg', '.jpeg'];
    const val = this.validarArquivoUpload(file, permitidos, 15);
    if (!val.valido) {
      this.showToast(val.erro, 'error');
      input.value = '';
      return;
    }

    const nomeInput = document.getElementById('f-ap-nome-arq');
    const tituloInput = document.getElementById('f-ap-titulo');
    if (nomeInput) nomeInput.value = file.name;
    if (tituloInput && !tituloInput.value.trim()) {
      tituloInput.value = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
    }
    const kb = Math.max(1, Math.round(file.size / 1024));
    const tamanhoStr = kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;

    const reader = new FileReader();
    reader.onload = (ev) => {
      this.state.arquivoPortalLeituraTemp = {
        nome: file.name,
        tamanho: tamanhoStr,
        tipo_mime: file.type || 'application/octet-stream',
        dataUrl: ev.target.result
      };
      this.showToast(`Arquivo "${file.name}" (${tamanhoStr}) pronto para envio!`, 'info');
    };
    reader.readAsDataURL(file);
  },

  submitFormArquivoPortal(e) {
    e.preventDefault();
    const empId = document.getElementById('f-ap-emp').value;
    const pasta = document.getElementById('f-ap-pasta').value;
    const temp = this.state.arquivoPortalLeituraTemp;

    window.zgestorDB.salvarArquivoPortalCliente({
      empresa_id: empId,
      pasta,
      competencia: document.getElementById('f-ap-comp').value.trim() || 'Permanente',
      titulo: document.getElementById('f-ap-titulo').value.trim(),
      nome_arquivo: document.getElementById('f-ap-nome-arq').value.trim(),
      tamanho: temp ? temp.tamanho : '215 KB',
      data_vencimento: document.getElementById('f-ap-venc').value || null,
      valor: Number(document.getElementById('f-ap-valor').value || 0),
      observacoes: document.getElementById('f-ap-obs').value.trim(),
      conteudo_base64: temp ? temp.dataUrl : null
    });

    this.state.arquivoPortalLeituraTemp = null;
    this.state.empresaCentralId = empId;
    this.state.subTabCentralCliente = 'arquivos_portal';
    this.closeModal();
    this.showToast('Arquivo publicado com sucesso no Portal do Cliente!', 'success');
    this.renderAll();
  },

  openModalUploadLoteGuias() {
    this.state.loteGuiasPendentes = [];
    this.renderModalUploadLoteGuias();
  },

  renderModalUploadLoteGuias() {
    const db = window.zgestorDB;
    const items = this.state.loteGuiasPendentes || [];
    const validos = items.filter(i => i.empresa_id);

    const modal = document.getElementById('modal-root');
    if (!modal) return;
    modal.innerHTML = `
      <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <span class="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Automação Inteligente de Guias</span>
              <h3 class="text-base font-bold text-slate-900">Upload Inteligente em Lote de Guias (PDFs)</h3>
            </div>
            <button onclick="ZGestorApp.closeModal()" class="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
          </div>

          <div class="space-y-4 mt-4 text-xs">
            <!-- Dropzone -->
            <input type="file" id="f-lote-guias-input" multiple accept=".pdf,.xml,.xlsx,.xls,.csv,.png,.jpg,.jpeg" class="hidden" onchange="ZGestorApp.handleLoteGuiasSelected(this.files)" />
            <div
              ondragover="event.preventDefault(); this.classList.add('border-indigo-600', 'bg-indigo-50')"
              ondragleave="this.classList.remove('border-indigo-600', 'bg-indigo-50')"
              ondrop="event.preventDefault(); this.classList.remove('border-indigo-600', 'bg-indigo-50'); ZGestorApp.handleLoteGuiasSelected(event.dataTransfer.files)"
              onclick="document.getElementById('f-lote-guias-input').click()"
              class="border-2 border-dashed border-indigo-300 hover:border-indigo-500 rounded-2xl p-6 text-center cursor-pointer bg-slate-50/60 transition group">
              <div class="w-12 h-12 mx-auto rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center mb-3 group-hover:scale-105 transition shadow-xs">
                <i data-lucide="cloud-upload" class="w-6 h-6"></i>
              </div>
              <strong class="block text-sm font-bold text-slate-800">Arraste múltiplos arquivos (.PDF, .XML, Planilhas ou Imagens) aqui ou clique para selecionar</strong>
              <p class="text-slate-500 text-xs mt-1 max-w-md mx-auto">
                O sistema aceita arquivos até <strong>15 MB</strong> e lê automaticamente o <strong>CNPJ</strong>, o <strong>mês/ano de competência</strong> e o <strong>tipo de guia (DAS, DAE ICMS, DARF, FGTS)</strong> para vincular cada guia à empresa correspondente.
              </p>
            </div>

            <!-- Lista de Arquivos Processados / Reconhecidos -->
            ${items.length > 0 ? `
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <span class="font-bold text-slate-700">Arquivos Reconhecidos (${items.length}):</span>
                  <span class="text-[11px] font-bold text-emerald-700">${validos.length} prontos para vinculação automática</span>
                </div>
                <div class="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-60 overflow-y-auto">
                  ${items.map((it, idx) => `
                    <div class="p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50">
                      <div class="min-w-0 flex-1">
                        <div class="font-bold text-slate-900 truncate flex items-center gap-1.5">
                          <i data-lucide="file-text" class="w-3.5 h-3.5 text-indigo-600 shrink-0"></i>
                          <span class="truncate">${it.nome_arquivo}</span>
                          <span class="text-[10px] text-slate-400">(${it.tamanho})</span>
                        </div>
                        <div class="flex flex-wrap items-center gap-2 mt-1">
                          <select onchange="ZGestorApp.atualizarItemLoteGuias(${idx}, 'empresa_id', this.value)" class="text-[11px] font-bold rounded-lg border ${it.empresa_id ? 'border-emerald-300 bg-emerald-50/40 text-emerald-950' : 'border-rose-300 bg-rose-50 text-rose-800'} px-2 py-0.5">
                            <option value="">-- Selecione a Empresa --</option>
                            ${db.data.empresas.map(e => `<option value="${e.id}" ${e.id === it.empresa_id ? 'selected' : ''}>${e.nome_fantasia} (${e.cnpj})</option>`).join('')}
                          </select>
                          <input type="text" value="${it.competencia}" placeholder="10/2026" onchange="ZGestorApp.atualizarItemLoteGuias(${idx}, 'competencia', this.value)" class="w-20 text-[11px] font-bold px-1.5 py-0.5 rounded-lg border border-slate-300 text-center" />
                          <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">${it.tipo_guia}</span>
                        </div>
                      </div>
                      <div class="flex items-center gap-2 shrink-0">
                        ${it.empresa_id ? `
                          <span class="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                            <i data-lucide="check-circle" class="w-3.5 h-3.5"></i> Identificado
                          </span>
                        ` : `
                          <span class="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                            <i data-lucide="alert-circle" class="w-3.5 h-3.5"></i> Pendente Empresa
                          </span>
                        `}
                        <button type="button" onclick="ZGestorApp.removerArquivoLoteGuias(${idx})" class="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Remover">
                          <i data-lucide="x" class="w-3.5 h-3.5"></i>
                        </button>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <div class="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button type="button" onclick="ZGestorApp.closeModal()" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold">Cancelar</button>
              <button
                type="button"
                ${validos.length === 0 ? 'disabled' : ''}
                onclick="ZGestorApp.confirmarPublicacaoLoteGuias()"
                class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold shadow flex items-center gap-1.5">
                <i data-lucide="send" class="w-4 h-4"></i>
                Vincular & Publicar ${validos.length} Guia(s) nos Portais
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    this.renderContentOnly();
    if (window.lucide) window.lucide.createIcons();
  },

  handleLoteGuiasSelected(files) {
    if (!files || files.length === 0) return;
    const db = window.zgestorDB;
    const empresas = db.data.empresas || [];
    const compPadrao = this.state.competencia || (db.data && db.data.competencia_ativa) || '10/2026';
    const permitidos = ['.pdf', '.xml', '.xlsx', '.xls', '.csv', '.png', '.jpg', '.jpeg'];

    const fileList = Array.from(files);
    this.state.loteGuiasPendentes = this.state.loteGuiasPendentes || [];

    fileList.forEach(file => {
      const val = this.validarArquivoUpload(file, permitidos, 15);
      if (!val.valido) {
        this.showToast(val.erro, 'warning');
        return;
      }

      const nome = file.name;
      const nomeLower = nome.toLowerCase();
      const kb = Math.max(1, Math.round(file.size / 1024));
      const tamanhoStr = kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
      const cleanDigits = nome.replace(/\D/g, '');

      // 1. Identificar Empresa pelo CNPJ (14 dígitos) com prioridade máxima
      let matchedEmp = null;

      // P1: Match exato dos 14 dígitos do CNPJ contra a sequência de dígitos do nome
      for (const emp of empresas) {
        const empCnpjDigitos = (emp.cnpj || '').replace(/\D/g, '');
        if (empCnpjDigitos.length === 14 && cleanDigits.includes(empCnpjDigitos)) {
          matchedEmp = emp;
          break;
        }
      }

      // P2: Se não bateu CNPJ por dígitos contínuos, tenta Razão Social ou Nome Fantasia completo
      if (!matchedEmp) {
        for (const emp of empresas) {
          const nomeLimpo = (emp.nome_fantasia || '').toLowerCase().trim();
          if (nomeLimpo.length >= 4 && nomeLower.includes(nomeLimpo)) {
            matchedEmp = emp;
            break;
          }
          const razaoLimpa = (emp.razao_social || '').toLowerCase().trim();
          if (razaoLimpa.length >= 4 && nomeLower.includes(razaoLimpa)) {
            matchedEmp = emp;
            break;
          }
        }
      }

      // P3: Código interno como identificador tokenizado (ex: #01, #001, emp_01)
      if (!matchedEmp) {
        for (const emp of empresas) {
          if (emp.codigo_interno) {
            const cod = emp.codigo_interno.toLowerCase().trim();
            const regexCod = new RegExp(`(?:^|[^0-9a-zA-Z])(?:emp[-_]?)?#?0*${cod}(?:[^0-9a-zA-Z]|$)`, 'i');
            if (regexCod.test(nome)) {
              matchedEmp = emp;
              break;
            }
          }
        }
      }

      // Fallback seguro: somente usa empresaCentralId se NÃO houver dígitos de CNPJ no arquivo
      if (!matchedEmp && !/\d{14}/.test(cleanDigits) && this.state.empresaCentralId) {
        matchedEmp = empresas.find(e => e.id === this.state.empresaCentralId) || null;
      }

      // 2. Identificar Competência (ex: 10_2026, 10-2026, 10/2026, 2026-10, 102026)
      let matchedComp = compPadrao;
      const compRegex1 = /(0[1-9]|1[0-2])[-_./](20\d{2})/;
      const compRegex2 = /(20\d{2})[-_./](0[1-9]|1[0-2])/;
      const compRegexCompacta = /(?:^|[^0-9])(0[1-9]|1[0-2])(20\d{2})(?:[^0-9]|$)/;

      const m1 = nome.match(compRegex1);
      const m2 = nome.match(compRegex2);
      const m3 = nome.match(compRegexCompacta);

      if (m1) {
        matchedComp = `${m1[1]}/${m1[2]}`;
      } else if (m2) {
        matchedComp = `${m2[2]}/${m2[1]}`;
      } else if (m3) {
        matchedComp = `${m3[1]}/${m3[2]}`;
      }

      // 3. Identificar Tipo de Guia
      let tipoGuia = 'Guia de Imposto Mensal';
      let pasta = 'GUIAS_IMPOSTOS';
      const isMEI = (matchedEmp && matchedEmp.regime_tributario === 'MEI') ||
                    nomeLower.includes('pgmei') ||
                    nomeLower.includes('simei');

      if (isMEI && (nomeLower.includes('das') || nomeLower.includes('pgmei') || nomeLower.includes('simei') || nomeLower.includes('mei'))) {
        tipoGuia = 'DAS - SIMEI (MEI)';
      } else if (nomeLower.includes('pgdas') || (nomeLower.includes('das') && !isMEI) || nomeLower.includes('simples')) {
        tipoGuia = 'DAS - Simples Nacional';
      } else if (nomeLower.includes('icms') || nomeLower.includes('dae') || nomeLower.includes('dare')) {
        tipoGuia = 'DAE / DARE - ICMS (Antecipação / DIFAL / ST)';
      } else if (nomeLower.includes('fgts') || nomeLower.includes('digital')) {
        tipoGuia = 'FGTS Digital - Guia Mensal (Funcionários CLT)';
      } else if (nomeLower.includes('darf') || nomeLower.includes('inss') || nomeLower.includes('irrf') || nomeLower.includes('pro-labore') || nomeLower.includes('pro_labore')) {
        tipoGuia = 'DARF - DCTFWeb / INSS / IRRF (Pró-Labore / Folha)';
      } else if (nomeLower.includes('parcela') || nomeLower.includes('parc')) {
        tipoGuia = 'Guia de Parcelamento Fiscal';
      } else if (nomeLower.includes('balancete') || nomeLower.includes('dre')) {
        tipoGuia = 'Balancete Contábil Assinado';
        pasta = 'CONTABIL_BALANCETES';
      }

      let vencimentoEstimado = db.calcularDataMesSubsequente(matchedComp, 20);
      if (pasta !== 'GUIAS_IMPOSTOS') {
        vencimentoEstimado = null;
      }

      const reader = new FileReader();
      const novoItem = {
        id: 'lote-arq-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        nome_arquivo: file.name,
        titulo: `${tipoGuia} — Comp. ${matchedComp}`,
        tamanho: tamanhoStr,
        empresa_id: matchedEmp ? matchedEmp.id : '',
        competencia: matchedComp,
        tipo_guia: tipoGuia,
        pasta,
        valor: 0,
        data_vencimento: vencimentoEstimado,
        dataUrl: null
      };

      reader.onload = (ev) => {
        novoItem.dataUrl = ev.target.result;
      };
      reader.readAsDataURL(file);

      this.state.loteGuiasPendentes.push(novoItem);
    });

    this.renderModalUploadLoteGuias();
  },

  removerArquivoLoteGuias(index) {
    if (!this.state.loteGuiasPendentes) return;
    this.state.loteGuiasPendentes.splice(index, 1);
    this.renderModalUploadLoteGuias();
  },

  atualizarItemLoteGuias(index, campo, valor) {
    if (!this.state.loteGuiasPendentes || !this.state.loteGuiasPendentes[index]) return;
    this.state.loteGuiasPendentes[index][campo] = valor;
    this.renderModalUploadLoteGuias();
  },

  confirmarPublicacaoLoteGuias() {
    const db = window.zgestorDB;
    const todosItens = this.state.loteGuiasPendentes || [];
    const validos = todosItens.filter(i => i.empresa_id);
    const pendentesSemEmpresa = todosItens.filter(i => !i.empresa_id);

    if (validos.length === 0) {
      this.showToast('Nenhuma guia pronta para vinculação (selecione as empresas).', 'error');
      return;
    }

    const hoje = new Date().toISOString().slice(0, 10);
    const user = db.getCurrentUser() || { nome: 'Escritório', cargo: 'ADMIN' };
    let count = 0;
    const itensFalha = [];

    for (const it of validos) {
      try {
        // 1. Salva arquivo no Portal do Cliente correspondente
        db.salvarArquivoPortalCliente({
          empresa_id: it.empresa_id,
          pasta: it.pasta,
          competencia: it.competencia,
          titulo: it.titulo,
          nome_arquivo: it.nome_arquivo,
          tamanho: it.tamanho,
          data_vencimento: it.data_vencimento,
          valor: it.valor,
          data_upload: hoje,
          enviado_por: user.nome,
          observacoes: 'Guia importada e vinculada automaticamente via Upload Inteligente em Lote.',
          conteudo_base64: it.dataUrl
        });

        // 2. Atualiza ou cria na rotina de guias_impostos
        if (it.pasta === 'GUIAS_IMPOSTOS') {
          if (!Array.isArray(db.data.guias_impostos)) db.data.guias_impostos = [];

          let guiaMatch = db.data.guias_impostos.find(g =>
            g.empresa_id === it.empresa_id &&
            g.competencia === it.competencia &&
            (g.tipo_guia === it.tipo_guia ||
             (it.tipo_guia && it.tipo_guia.includes('DAS') && g.tipo_guia && g.tipo_guia.includes('DAS')) ||
             (it.tipo_guia && it.tipo_guia.includes('ICMS') && g.tipo_guia && g.tipo_guia.includes('ICMS')) ||
             (it.tipo_guia && it.tipo_guia.includes('FGTS') && g.tipo_guia && g.tipo_guia.includes('FGTS')) ||
             (it.tipo_guia && it.tipo_guia.includes('DARF') && g.tipo_guia && g.tipo_guia.includes('DARF')))
          );

          if (!guiaMatch) {
            db.salvarGuiaImposto({
              empresa_id: it.empresa_id,
              competencia: it.competencia,
              tipo_guia: it.tipo_guia,
              departamento: (it.tipo_guia && (it.tipo_guia.includes('FGTS') || it.tipo_guia.includes('DARF'))) ? 'PESSOAL' : 'FISCAL',
              data_vencimento: it.data_vencimento || db.calcularDataMesSubsequente(it.competencia, 20),
              valor: it.valor || 0,
              status_envio: 'ENVIADA_CLIENTE',
              data_envio: hoje,
              canal_envio: 'Portal do Cliente (Upload Inteligente em Lote)',
              responsavel_nome: user.nome || 'Escritório',
              observacoes: `Guia vinculada via Upload em Lote (${it.nome_arquivo})`
            });
          } else {
            guiaMatch.status_envio = 'ENVIADA_CLIENTE';
            guiaMatch.data_envio = hoje;
            guiaMatch.canal_envio = 'Portal do Cliente (Upload Inteligente em Lote)';
            guiaMatch.responsavel_nome = user.nome || 'Escritório';
            if (it.valor) guiaMatch.valor = it.valor;
            if (it.tipo_guia) guiaMatch.tipo_guia = it.tipo_guia;
            db.salvarGuiaImposto(guiaMatch);
          }
        }

        count++;
        // Remove com sucesso da fila imediatamente
        this.state.loteGuiasPendentes = (this.state.loteGuiasPendentes || []).filter(p => p !== it);
      } catch (err) {
        console.warn(`Erro ao publicar ${it.nome_arquivo} no lote:`, err);
        it.erro = err.message || 'Falha ao salvar no armazenamento local.';
        itensFalha.push(it);
      }
    }

    if (count > 0) {
      db.registrarLog('UPLOAD_LOTE_GUIAS', 'Central do Cliente', `${count} guias foram processadas, vinculadas aos CNPJs e disponibilizadas nos Portais dos Clientes.`);
    }

    this.state.loteGuiasPendentes = [...pendentesSemEmpresa, ...itensFalha];

    if (itensFalha.length > 0) {
      this.showToast(`${count} guia(s) vinculada(s). ${itensFalha.length} arquivo(s) falharam na gravação e continuam pendentes.`, 'warning');
      this.renderModalUploadLoteGuias();
    } else if (pendentesSemEmpresa.length > 0) {
      this.showToast(`${count} guia(s) vinculada(s). ${pendentesSemEmpresa.length} arquivo(s) permanecem na fila sem empresa vinculada.`, 'info');
      this.renderModalUploadLoteGuias();
    } else {
      this.closeModal();
      this.showToast(`${count} guias vinculadas e disponibilizadas com sucesso nos Portais dos Clientes!`, 'success');
    }
    this.renderAll();
  },

  visualizarOuBaixarArquivoPortal(arquivoId) {
    const db = window.zgestorDB;
    const user = db.getCurrentUser();
    if (!user) {
      throw new Error('Acesso negado: sessão obrigatória.');
    }
    const isSimulacao = Boolean(this.state.modoSimulacaoCliente);
    const item = (db.data.portal_arquivos || []).find(a => a.id === arquivoId);
    if (!item) return;

    if (user.cargo === 'CLIENTE' && !isSimulacao) {
      if (item.empresa_id !== user.empresa_id) {
        throw new Error('Acesso não autorizado para visualizar arquivo de outra empresa.');
      }
    }

    const arq = db.marcarArquivoPortalVisualizado(arquivoId);
    if (!arq) return;
    const emp = db.data.empresas.find(e => e.id === arq.empresa_id);
    const V = window.ZGestorViews;

    const modal = document.getElementById('modal-root');
    if (!modal) return;
    modal.innerHTML = `
      <div class="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <span class="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Visualizador do Portal do Cliente</span>
              <h3 class="text-base font-bold text-slate-900">${arq.titulo}</h3>
            </div>
            <button onclick="ZGestorApp.closeModal()" class="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
          </div>

          <!-- Comprovante de Leitura / Baixa Registrado -->
          ${(arq.visualizado && arq.cliente_confirmou_leitura) ? `
            <div class="mt-3 p-3.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 text-xs flex items-start gap-2.5">
              <i data-lucide="shield-check" class="w-5 h-5 text-teal-600 shrink-0 mt-0.5"></i>
              <div>
                <strong class="block text-teal-950 font-bold">Protocolo 100% Confirmado — Visualizado pelo Cliente</strong>
                <span class="text-[11px] text-teal-800">
                  Acesso confirmado em <strong>${arq.visualizado_em_fmt || 'agora'}</strong> por <strong>${arq.visualizado_por || 'Cliente'}</strong> (${arq.visualizado_email || 'Portal do Cliente'}). Baixa automática registrada no escritório.
                </span>
              </div>
            </div>
          ` : `
            <div class="mt-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
              <i data-lucide="clock" class="w-5 h-5 text-amber-600 shrink-0 mt-0.5"></i>
              <div>
                <strong class="block text-amber-950 font-bold">Pendente de Leitura do Cliente</strong>
                <span class="text-[11px] text-amber-800">
                  Documento disponibilizado no Portal em <strong>${V.formatDate(arq.data_upload || new Date().toISOString().slice(0, 10))}</strong> por <strong>${arq.enviado_por || 'Escritório'}</strong>. O protocolo de confirmação de leitura 100% será emitido automaticamente assim que o cliente acessar o documento.
                </span>
              </div>
            </div>
          `}

          <div class="mt-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <div class="flex items-center justify-between">
              <span class="text-slate-500">Empresa:</span>
              <strong class="text-slate-900">${emp ? `${emp.razao_social} (${emp.cnpj})` : '—'}</strong>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500">Nome do Arquivo:</span>
              <span class="font-mono font-bold text-indigo-700">${arq.nome_arquivo} (${arq.tamanho || '180 KB'})</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500">Data em que foi Anexado:</span>
              <strong class="text-slate-800">${V.formatDate(arq.data_upload || new Date().toISOString().slice(0, 10))}</strong>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500">Competência / Referência:</span>
              <strong class="text-slate-800">${arq.competencia || 'Permanente'}</strong>
            </div>
            ${arq.data_vencimento ? `
              <div class="flex items-center justify-between">
                <span class="text-slate-500">Data de Vencimento:</span>
                <strong class="text-rose-600">${V.formatDate(arq.data_vencimento)}</strong>
              </div>
            ` : ''}
            ${Number(arq.valor) > 0 ? `
              <div class="flex items-center justify-between">
                <span class="text-slate-500">Valor do Documento / Guia:</span>
                <strong class="text-emerald-700 text-sm">${V.formatCurrency(arq.valor)}</strong>
              </div>
            ` : ''}
            <div class="pt-2 border-t border-slate-200 text-slate-700">
              <strong class="block text-[10px] uppercase text-slate-500 mb-0.5">Descrição / Observações do Arquivo:</strong>
              ${arq.observacoes || 'Documento oficial disponibilizado pelo escritório contábil no Portal do Cliente.'}
            </div>
          </div>

          <div class="flex flex-col-reverse sm:flex-row justify-end gap-2 mt-5 pt-3 border-t border-slate-200 text-xs">
            <button type="button" onclick="ZGestorApp.closeModal()" class="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer">Fechar</button>
            <button type="button" onclick="ZGestorApp.visualizarArquivoNavegador('${arq.id}')" class="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center gap-1.5 border border-indigo-200 cursor-pointer">
              <i data-lucide="eye" class="w-4 h-4"></i> Visualizar no Navegador
            </button>
            <button type="button" onclick="ZGestorApp.baixarConteudoArquivoPortal('${arq.id}')" class="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow flex items-center justify-center gap-1.5 cursor-pointer">
              <i data-lucide="download" class="w-4 h-4"></i> Baixar Arquivo
            </button>
          </div>
        </div>
      </div>
    `;
    this.renderContentOnly();
    if (window.lucide) window.lucide.createIcons();
  },

  visualizarArquivoNavegador(arquivoId) {
    const db = window.zgestorDB;
    const user = db.getCurrentUser();
    if (!user) {
      throw new Error('Acesso negado: sessão obrigatória para visualizar documentos.');
    }
    const isSimulacao = Boolean(this.state.modoSimulacaoCliente);
    const arq = (db.data.portal_arquivos || []).find(a => a.id === arquivoId);
    if (!arq) return;

    if (user.cargo === 'CLIENTE' && !isSimulacao) {
      if (arq.empresa_id !== user.empresa_id) {
        this.showToast('Acesso não autorizado para visualizar documento de outra empresa.', 'error');
        throw new Error('Acesso não autorizado ao arquivo de outra empresa.');
      }
    }

    if (!arq.conteudo_base64) {
      this.showToast('Conteúdo do arquivo não disponível para pré-visualização no navegador.', 'warning');
      return;
    }

    try {
      const parts = arq.conteudo_base64.split(';base64,');
      let contentType = 'application/pdf';
      if (parts[0] && parts[0].includes(':')) {
        contentType = parts[0].split(':')[1];
      }
      const b64Data = parts[1] || '';
      const byteCharacters = atob(b64Data);
      const byteArrays = [];
      for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
        }
        byteArrays.push(new Uint8Array(byteNumbers));
      }
      const blob = new Blob(byteArrays, { type: contentType });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      this.showToast('Visualização aberta em nova aba do navegador!', 'info');
    } catch (e) {
      window.open(arq.conteudo_base64, '_blank');
    }
  },

  baixarConteudoArquivoPortal(arquivoId) {
    const db = window.zgestorDB;
    const user = db.getCurrentUser();
    if (!user) {
      throw new Error('Acesso negado: sessão obrigatória para download de documentos.');
    }
    const isSimulacao = Boolean(this.state.modoSimulacaoCliente);
    const arq = (db.data.portal_arquivos || []).find(a => a.id === arquivoId);
    if (!arq) return;

    if (user.cargo === 'CLIENTE' && !isSimulacao) {
      if (arq.empresa_id !== user.empresa_id) {
        this.showToast('Acesso não autorizado para baixar documento de outra empresa.', 'error');
        throw new Error('Acesso não autorizado ao arquivo de outra empresa.');
      }
    }

    if (arq.conteudo_base64) {
      const a = document.createElement('a');
      a.href = arq.conteudo_base64;
      a.download = arq.nome_arquivo || `${arq.titulo.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      a.click();
      this.showToast(`Download de ${arq.nome_arquivo || arq.titulo} concluído!`, 'success');
      return;
    }

    // Registros sem conteúdo em base64: exige reenvio do PDF pelo escritório
    this.showToast('O arquivo PDF deste documento não foi localizado na base e precisa ser reenviado pelo escritório.', 'warning');
  },

  excluirArquivoPortal(arquivoId) {
    window.zgestorDB.excluirArquivoPortalCliente(arquivoId);
    this.showToast('Arquivo removido do Portal do Cliente.', 'info');
    this.renderContentOnly();
  },

  openModalSolicitacaoPortal(empresaId, registroId = null) {
    const db = window.zgestorDB;
    const user = db.getCurrentUser();
    const isCliente = user.role === 'CLIENTE' || Boolean(this.state.modoSimulacaoCliente);
    const hoje = new Date().toISOString().slice(0, 10);
    const defaultPrazo = db.calcularDataMesSubsequente(this.state.competencia, 15);
    const existente = registroId ? db.getRegistrosCentralCliente().find(r => r.id === registroId) : null;
    const emp = db.data.empresas.find(e => e.id === (empresaId || this.state.empresaCentralId)) || db.data.empresas[0];

    const r = existente || {
      id: '',
      empresa_id: emp ? emp.id : '',
      data_registro: hoje,
      categoria: 'SOLICITACAO',
      titulo: '',
      descricao: '',
      departamento: 'CONTABIL',
      responsavel_nome: user.nome,
      solicitante_cliente: isCliente ? user.nome : (emp ? `${emp.responsavel_legal || emp.nome_fantasia} (Portal do Cliente)` : 'Cliente via Portal'),
      prazo_desejado: defaultPrazo,
      canal: 'Portal do Cliente',
      status: 'PENDENTE',
      resposta_contabilidade: '',
      anexo_nome: null,
      anexo_tamanho: null,
      anexo_base64: null
    };

    this.state.solicitacaoAnexoTemp = r.anexo_base64 ? {
      nome: r.anexo_nome,
      tamanho: r.anexo_tamanho,
      base64: r.anexo_base64
    } : null;

    const modal = document.getElementById('modal-root');
    if (!modal) return;
    modal.innerHTML = `
      <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <span class="text-[10px] font-bold uppercase tracking-wider text-amber-600">Canal Direto Cliente ↔ Contabilidade</span>
              <h3 class="text-base font-bold text-slate-900">
                ${r.id ? 'Editar Solicitação do Portal' : 'Nova Solicitação do Cliente para a Contabilidade'}
              </h3>
            </div>
            <button onclick="ZGestorApp.closeModal()" class="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
          </div>

          <form onsubmit="ZGestorApp.submitFormSolicitacaoPortal(event)" class="space-y-4 mt-4 text-xs">
            <input type="hidden" id="f-cc-id" value="${r.id || ''}" />

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="sm:col-span-2">
                <label class="block font-bold text-slate-700 mb-1">Empresa Cliente *</label>
                ${isCliente ? `
                  <div class="w-full rounded-xl bg-slate-100 border border-slate-300 px-3 py-2 font-bold text-slate-800">
                    ${emp ? emp.nome_fantasia : 'Sua Empresa'} (${emp ? emp.cnpj : ''})
                  </div>
                  <input type="hidden" id="f-cc-emp" value="${emp ? emp.id : ''}" />
                ` : `
                  <select id="f-cc-emp" required class="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold">
                    ${db.data.empresas.map(e => `<option value="${e.id}" ${e.id === r.empresa_id ? 'selected' : ''}>${e.nome_fantasia} (${e.cnpj})</option>`).join('')}
                  </select>
                `}
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Data do Pedido *</label>
                <input id="f-cc-data" type="date" required value="${r.data_registro}" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-semibold" />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Setor da Contabilidade Destino *</label>
                <select id="f-cc-dept" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold">
                  <option value="CONTABIL" ${r.departamento === 'CONTABIL' ? 'selected' : ''}>Contábil (Balancete / Faturamento / IRPJ)</option>
                  <option value="FISCAL" ${r.departamento === 'FISCAL' ? 'selected' : ''}>Fiscal (Guias / Notas Fiscais / ICMS / DAS)</option>
                  <option value="PESSOAL" ${r.departamento === 'PESSOAL' ? 'selected' : ''}>Pessoal / DP (Admissão / Férias / Pró-Labore / FGTS)</option>
                  <option value="SOCIETARIO" ${r.departamento === 'SOCIETARIO' ? 'selected' : ''}>Societário (Contrato Social / CNPJ / Alvará / CND)</option>
                  <option value="FINANCEIRO" ${r.departamento === 'FINANCEIRO' ? 'selected' : ''}>Financeiro (Honorários / Recibos)</option>
                </select>
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Prazo Desejado para Retorno</label>
                <input id="f-cc-prazo" type="date" value="${r.prazo_desejado || defaultPrazo}" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-semibold" />
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Nome do Solicitante na Empresa Cliente *</label>
              <input id="f-cc-solicitante" type="text" required value="${r.solicitante_cliente || ''}" placeholder="Ex: Sócio Henrique / Financeiro da Empresa" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Assunto da Solicitação *</label>
              <input id="f-cc-titulo" type="text" required value="${escapeHtml(r.titulo)}" placeholder="Ex: Solicitação de Relação de Faturamento Assinada / Admissão de Funcionário / 2ª Via de Guia" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold" />
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Detalhamento do Pedido para a Contabilidade *</label>
              <textarea id="f-cc-desc" rows="3" required class="w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Descreva os dados e o que o cliente precisa que a contabilidade providencie...">${escapeHtml(r.descricao || '')}</textarea>
            </div>

            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="block font-bold text-slate-700">Anexo do Chamado / Documento (Opcional)</label>
                <span class="text-[10px] text-indigo-700 font-bold">PDF, XML, XLSX, CSV, Imagens (até 15 MB)</span>
              </div>
              <input
                type="file"
                id="f-cc-anexo-file"
                accept=".pdf,.xml,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
                onchange="ZGestorApp.handleAnexoSolicitacao(event)"
                class="w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs cursor-pointer"
              />
              <div id="f-cc-anexo-preview" class="text-[11px] text-slate-500 mt-1">
                ${r.anexo_nome ? `<span class="text-emerald-700 font-bold">✓ Anexo atual: ${escapeHtml(r.anexo_nome)} (${r.anexo_tamanho || ''})</span>` : 'Nenhum arquivo anexado'}
              </div>
            </div>

            ${!isCliente ? `
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-indigo-50/70 border border-indigo-200">
                <div>
                  <label class="block font-bold text-indigo-950 mb-1">Delegar p/ Colaborador do Escritório</label>
                  <select id="f-cc-resp" class="w-full rounded-xl border border-indigo-300 px-3 py-2 bg-white font-bold">
                    ${(db.data.profiles || []).map(p => `<option value="${p.nome}" ${p.nome === r.responsavel_nome ? 'selected' : ''}>${p.nome} (${p.departamento})</option>`).join('')}
                  </select>
                </div>
                <div>
                  <label class="block font-bold text-indigo-950 mb-1">Situação do Chamado</label>
                  <select id="f-cc-status" class="w-full rounded-xl border border-indigo-300 px-3 py-2 bg-white font-bold">
                    <option value="PENDENTE" ${r.status === 'PENDENTE' ? 'selected' : ''}>⏳ Aguardando Atendimento</option>
                    <option value="EM_ANDAMENTO" ${r.status === 'EM_ANDAMENTO' ? 'selected' : ''}>🔄 Em Andamento</option>
                    <option value="CONCLUIDO" ${r.status === 'CONCLUIDO' ? 'selected' : ''}>✓ Atendida / Concluída</option>
                  </select>
                </div>
              </div>
            ` : `
              <div class="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-950 flex items-center gap-2.5">
                <i data-lucide="sparkles" class="w-4 h-4 text-indigo-600 shrink-0"></i>
                <span class="text-xs">
                  Sua solicitação é integrada instantaneamente às Tarefas do setor responsável e monitorada pelo time contábil até a conclusão.
                </span>
              </div>
            `}

            ${(!r.id && !isCliente) ? `
              <label class="inline-flex items-center gap-2 cursor-pointer bg-amber-50 px-3 py-2 rounded-xl border border-amber-200 w-full">
                <input type="checkbox" id="f-cc-gerar-tarefa" checked class="w-4 h-4 rounded text-amber-600" />
                <span class="font-bold text-amber-950">Criar automaticamente como Solicitação Avulsa na aba de Tarefas para a equipe executar</span>
              </label>
            ` : ''}

            <div class="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 border-t border-slate-200">
              <button type="button" onclick="ZGestorApp.closeModal()" class="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer">Cancelar</button>
              <button type="submit" class="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold shadow cursor-pointer">
                Enviar Solicitação para a Contabilidade
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  openModalRegistroCentral(empresaId, registroId = null) {
    this.openModalSolicitacaoPortal(empresaId, registroId);
  },

  handleAnexoSolicitacao(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const permitidos = ['.pdf', '.xml', '.xlsx', '.xls', '.csv', '.png', '.jpg', '.jpeg'];
    const val = this.validarArquivoUpload(file, permitidos, 15);
    if (!val.valido) {
      this.showToast(val.erro, 'error');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const b64 = e.target.result;
      const mb = (file.size / (1024 * 1024)).toFixed(2);
      const kb = Math.round(file.size / 1024);
      const tamFormatado = file.size >= 1024 * 1024 ? `${mb} MB` : `${kb} KB`;
      this.state.solicitacaoAnexoTemp = {
        nome: file.name,
        tamanho: tamFormatado,
        base64: b64
      };
      const preview = document.getElementById('f-cc-anexo-preview');
      if (preview) {
        preview.innerHTML = `<span class="text-emerald-700 font-bold">✓ Arquivo anexado: ${escapeHtml(file.name)} (${tamFormatado})</span>`;
      }
      this.showToast(`Arquivo "${file.name}" anexado com sucesso!`, 'success');
    };
    reader.readAsDataURL(file);
  },

  baixarAnexoSolicitacao(registroId) {
    const db = window.zgestorDB;
    const r = (db.getRegistrosCentralCliente() || []).find(item => item.id === registroId);
    if (!r || !r.anexo_base64) {
      this.showToast('Nenhum anexo disponível para este chamado.', 'warning');
      return;
    }

    try {
      const a = document.createElement('a');
      a.href = r.anexo_base64;
      a.download = r.anexo_nome || 'anexo_solicitacao';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      this.showToast(`Download de "${r.anexo_nome}" iniciado!`, 'success');
    } catch (err) {
      window.open(r.anexo_base64, '_blank');
    }
  },

  submitFormSolicitacaoPortal(e) {
    e.preventDefault();
    const db = window.zgestorDB;
    const user = db.getCurrentUser();
    const isCliente = user.role === 'CLIENTE' || Boolean(this.state.modoSimulacaoCliente);
    const empId = document.getElementById('f-cc-emp').value;
    const gerarTarEl = document.getElementById('f-cc-gerar-tarefa');
    const criarTarefa = isCliente ? true : (gerarTarEl ? gerarTarEl.checked : true);
    const respEl = document.getElementById('f-cc-resp');
    const statusEl = document.getElementById('f-cc-status');
    const anexoTemp = this.state.solicitacaoAnexoTemp;
    const idExistente = document.getElementById('f-cc-id').value || null;
    const existente = idExistente ? (db.getRegistrosCentralCliente() || []).find(x => x.id === idExistente) : null;

    window.zgestorDB.salvarRegistroCentralCliente({
      id: idExistente,
      empresa_id: empId,
      data_registro: document.getElementById('f-cc-data').value,
      categoria: 'SOLICITACAO',
      departamento: document.getElementById('f-cc-dept').value,
      prazo_desejado: document.getElementById('f-cc-prazo').value,
      solicitante_cliente: document.getElementById('f-cc-solicitante').value.trim(),
      canal: 'Portal do Cliente',
      titulo: document.getElementById('f-cc-titulo').value.trim(),
      descricao: document.getElementById('f-cc-desc').value.trim(),
      responsavel_nome: respEl ? respEl.value : '',
      status: statusEl ? statusEl.value : 'PENDENTE',
      criar_tarefa_avulsa: criarTarefa,
      competencia: this.state.competencia || '10/2026',
      anexo_nome: anexoTemp ? anexoTemp.nome : (existente ? existente.anexo_nome : null),
      anexo_tamanho: anexoTemp ? anexoTemp.tamanho : (existente ? existente.anexo_tamanho : null),
      anexo_base64: anexoTemp ? anexoTemp.base64 : (existente ? existente.anexo_base64 : null)
    }, criarTarefa);
    this.state.solicitacaoAnexoTemp = null;
    this.state.empresaCentralId = empId;
    this.state.subTabCentralCliente = 'solicitacoes_portal';
    this.closeModal();
    this.showToast(criarTarefa ? 'Solicitação aberta e gerada automaticamente como Tarefa da equipe contábil!' : 'Solicitação salva no Portal do Cliente!', 'success');
    this.renderAll();
  },

  openModalResponderSolicitacaoPortal(registroId) {
    const db = window.zgestorDB;
    const r = db.getRegistrosCentralCliente().find(item => item.id === registroId);
    if (!r) return;
    const emp = db.data.empresas.find(e => e.id === r.empresa_id);

    const modal = document.getElementById('modal-root');
    if (!modal) return;
    modal.innerHTML = `
      <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 shadow-2xl border border-slate-200">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <span class="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Retorno da Contabilidade no Portal do Cliente</span>
              <h3 class="text-base font-bold text-slate-900">Responder Solicitação do Cliente</h3>
            </div>
            <button onclick="ZGestorApp.closeModal()" class="text-slate-400 hover:text-slate-600 text-xl font-bold cursor-pointer">×</button>
          </div>

          <form onsubmit="ZGestorApp.submitRespostaSolicitacaoPortal(event, '${r.id}')" class="space-y-4 mt-4 text-xs">
            <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div class="font-bold text-slate-900 text-sm">${escapeHtml(r.titulo)}</div>
              <div class="text-slate-600">${escapeHtml(r.descricao || '')}</div>
              <div class="text-[11px] text-indigo-700 font-semibold pt-1">
                Cliente: ${emp ? escapeHtml(emp.nome_fantasia) : '—'} • Solicitante: ${escapeHtml(r.solicitante_cliente || '—')}
              </div>
              ${r.anexo_nome ? `
                <div class="pt-2 mt-1 border-t border-slate-200 flex items-center justify-between">
                  <span class="text-[11px] text-slate-600 font-bold flex items-center gap-1">
                    <i data-lucide="paperclip" class="w-3.5 h-3.5 text-indigo-600"></i>
                    ${escapeHtml(r.anexo_nome)} (${r.anexo_tamanho || 'Anexo'})
                  </span>
                  <button
                    type="button"
                    onclick="ZGestorApp.baixarAnexoSolicitacao('${r.id}')"
                    class="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] border border-indigo-200 cursor-pointer">
                    Baixar Anexo
                  </button>
                </div>
              ` : ''}
            </div>

            <div>
              <label class="block font-bold text-slate-800 mb-1">Atualizar Status da Solicitação *</label>
              <select id="f-resp-status" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold">
                <option value="PENDENTE" ${r.status === 'PENDENTE' ? 'selected' : ''}>⏳ Pendente (Aguardando análise/documentos)</option>
                <option value="EM_ANDAMENTO" ${r.status === 'EM_ANDAMENTO' ? 'selected' : ''}>🔄 Em Andamento na Contabilidade</option>
                <option value="CONCLUIDO" ${r.status === 'CONCLUIDO' ? 'selected' : ''}>✅ Concluída / Atendida (Disponível no Portal)</option>
              </select>
            </div>

            <div>
              <label class="block font-bold text-slate-800 mb-1">Resposta / Orientação da Contabilidade para o Cliente *</label>
              <textarea
                id="f-resp-texto"
                rows="3"
                required
                placeholder="Ex: Solicitação atendida! O documento/guia já foi publicado na pasta correspondente do seu Portal do Cliente..."
                class="w-full rounded-xl border border-indigo-300 px-3 py-2 font-medium">${r.resposta_contabilidade || ''}</textarea>
            </div>

            <div class="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 border-t border-slate-200">
              <button type="button" onclick="ZGestorApp.closeModal()" class="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer">Cancelar</button>
              <button type="submit" class="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow cursor-pointer">
                Salvar Resposta & Atualizar Status
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  submitRespostaSolicitacaoPortal(e, registroId) {
    e.preventDefault();
    const status = document.getElementById('f-resp-status').value;
    const resposta = document.getElementById('f-resp-texto').value.trim();
    window.zgestorDB.alterarStatusRegistroCentral(registroId, status, resposta);
    this.closeModal();
    this.showToast('Resposta da contabilidade registrada e sincronizada!', 'success');
    this.renderAll();
  },

  alterarStatusRegistroCentral(registroId, novoStatus) {
    window.zgestorDB.alterarStatusRegistroCentral(registroId, novoStatus);
    this.showToast('Status da solicitação atualizado!', 'info');
    this.renderContentOnly();
  },

  excluirRegistroCentral(registroId) {
    window.zgestorDB.excluirRegistroCentralCliente(registroId);
    this.showToast('Solicitação removida do Portal.', 'info');
    this.renderContentOnly();
  },

  // ===========================================================================
  // MODAIS DE HONORÁRIOS E CONFIGURAÇÃO DE CHAVE PIX
  // ===========================================================================
  openModalConfigPix() {
    const esc = window.zgestorDB.getEscritorioConfig();
    const modal = document.getElementById('modal-root');
    if (!modal) return;
    modal.innerHTML = `
      <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 class="text-base font-bold text-slate-900">Configurar Dados do Escritório & Chave PIX dos Recibos</h3>
              <p class="text-xs text-slate-500">Esses dados saem impressos no Recibo Mensal de Cobrança de Honorários</p>
            </div>
            <button onclick="ZGestorApp.closeModal()" class="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
          </div>
          <form onsubmit="ZGestorApp.submitConfigPix(event)" class="space-y-3.5 mt-4 text-xs">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Nome / Razão Social do Escritório Contábil *</label>
              <input id="f-pix-esc" type="text" required value="${esc.nome_escritorio}" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold" />
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">CNPJ do Escritório *</label>
                <input id="f-pix-cnpj" type="text" required value="${esc.cnpj_escritorio}" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Registro CRC</label>
                <input id="f-pix-crc" type="text" value="${esc.crc_escritorio}" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Telefone / WhatsApp Financeiro</label>
                <input id="f-pix-tel" type="text" value="${esc.telefone_escritorio}" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Cidade / UF</label>
                <input id="f-pix-cid" type="text" value="${esc.cidade_uf}" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
            </div>

            <div class="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 space-y-3">
              <div class="font-bold text-emerald-900 uppercase text-[11px]">Dados para Pagamento por PIX no Recibo (Sem Boleto)</div>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label class="block font-bold text-emerald-900 mb-1">Tipo da Chave</label>
                  <select id="f-pix-tipo" class="w-full rounded-xl border border-emerald-400 px-3 py-2 bg-white">
                    <option value="CNPJ" ${esc.tipo_chave_pix === 'CNPJ' ? 'selected' : ''}>CNPJ</option>
                    <option value="E-mail" ${esc.tipo_chave_pix === 'E-mail' ? 'selected' : ''}>E-mail</option>
                    <option value="Celular" ${esc.tipo_chave_pix === 'Celular' ? 'selected' : ''}>Telefone / Celular</option>
                    <option value="CPF" ${esc.tipo_chave_pix === 'CPF' ? 'selected' : ''}>CPF</option>
                    <option value="Aleatória" ${esc.tipo_chave_pix === 'Aleatória' ? 'selected' : ''}>Chave Aleatória</option>
                  </select>
                </div>
                <div class="sm:col-span-2">
                  <label class="block font-bold text-emerald-900 mb-1">Chave PIX Principal *</label>
                  <input id="f-pix-chave" type="text" required value="${esc.chave_pix}" class="w-full rounded-xl border border-emerald-400 px-3 py-2 bg-white font-mono font-bold text-emerald-900" />
                </div>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-emerald-900 mb-1">Nome do Favorecido PIX *</label>
                  <input id="f-pix-fav" type="text" required value="${esc.favorecido_pix}" class="w-full rounded-xl border border-emerald-300 px-3 py-2 bg-white" />
                </div>
                <div>
                  <label class="block font-bold text-emerald-900 mb-1">Banco / Instituição</label>
                  <input id="f-pix-banco" type="text" value="${esc.banco_pix}" class="w-full rounded-xl border border-emerald-300 px-3 py-2 bg-white" />
                </div>
              </div>
              <div>
                <label class="block font-bold text-emerald-900 mb-1">Instrução no Recibo</label>
                <input id="f-pix-msg" type="text" value="${esc.mensagem_recibo}" class="w-full rounded-xl border border-emerald-300 px-3 py-2 bg-white" />
              </div>
            </div>

            <div class="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button type="button" onclick="ZGestorApp.closeModal()" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold">Cancelar</button>
              <button type="submit" class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow">Salvar Dados PIX</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  submitConfigPix(e) {
    e.preventDefault();
    window.zgestorDB.salvarEscritorioConfig({
      nome_escritorio: document.getElementById('f-pix-esc').value.trim(),
      cnpj_escritorio: document.getElementById('f-pix-cnpj').value.trim(),
      crc_escritorio: document.getElementById('f-pix-crc').value.trim(),
      telefone_escritorio: document.getElementById('f-pix-tel').value.trim(),
      cidade_uf: document.getElementById('f-pix-cid').value.trim(),
      tipo_chave_pix: document.getElementById('f-pix-tipo').value,
      chave_pix: document.getElementById('f-pix-chave').value.trim(),
      favorecido_pix: document.getElementById('f-pix-fav').value.trim(),
      banco_pix: document.getElementById('f-pix-banco').value.trim(),
      mensagem_recibo: document.getElementById('f-pix-msg').value.trim()
    });
    this.closeModal();
    this.showToast('Dados do escritório e Chave PIX atualizados!', 'success');
    this.renderAll();
  },

  salvarDadosEscritorio(e) {
    if (e) e.preventDefault();
    const db = window.zgestorDB;
    const atual = db.getEscritorioConfig();

    const dadosAtualizados = {
      ...atual,
      razao_social: (document.getElementById('f-esc-razao')?.value || atual.razao_social || atual.nome_escritorio).trim(),
      nome_escritorio: (document.getElementById('f-esc-razao')?.value || atual.razao_social || atual.nome_escritorio).trim(),
      nome_fantasia: (document.getElementById('f-esc-fantasia')?.value || atual.nome_fantasia || 'ZIOTO CONTABILIDADE').trim(),
      cnpj_escritorio: (document.getElementById('f-esc-cnpj')?.value || atual.cnpj_escritorio).trim(),
      crc_escritorio: (document.getElementById('f-esc-crc')?.value || atual.crc_escritorio).trim(),
      cep: (document.getElementById('f-esc-cep')?.value || atual.cep || '').trim(),
      logradouro: (document.getElementById('f-esc-logradouro')?.value || atual.logradouro || '').trim(),
      endereco_escritorio: (document.getElementById('f-esc-logradouro')?.value || atual.endereco_escritorio || '').trim(),
      numero: (document.getElementById('f-esc-numero')?.value || atual.numero || '').trim(),
      complemento: (document.getElementById('f-esc-comp')?.value || atual.complemento || '').trim(),
      bairro: (document.getElementById('f-esc-bairro')?.value || atual.bairro || '').trim(),
      municipio: (document.getElementById('f-esc-municipio')?.value || atual.municipio || '').trim(),
      uf: (document.getElementById('f-esc-uf')?.value || atual.uf || 'SP').trim().toUpperCase(),
      cidade_uf: `${document.getElementById('f-esc-municipio')?.value || atual.municipio || ''}/${document.getElementById('f-esc-uf')?.value || atual.uf || ''}`,
      telefone_escritorio: (document.getElementById('f-esc-tel')?.value || atual.telefone_escritorio || '').trim(),
      whatsapp_escritorio: (document.getElementById('f-esc-whatsapp')?.value || atual.whatsapp_escritorio || '').trim(),
      email_escritorio: (document.getElementById('f-esc-email')?.value || atual.email_escritorio || '').trim(),
      email_financeiro: (document.getElementById('f-esc-email-fin')?.value || atual.email_financeiro || '').trim(),
      mensagem_recibo: (document.getElementById('f-esc-msg')?.value || atual.mensagem_recibo || '').trim(),
      
      pix_principal: {
        ...(atual.pix_principal || {}),
        nome: (document.getElementById('f-p1-nome')?.value || atual.pix_principal?.nome || 'Conta PJ Principal').trim(),
        banco: (document.getElementById('f-p1-banco')?.value || atual.pix_principal?.banco || 'Itaú Unibanco').trim(),
        tipo_chave: document.getElementById('f-p1-tipo')?.value || atual.pix_principal?.tipo_chave || 'CNPJ',
        chave_pix: (document.getElementById('f-p1-chave')?.value || atual.pix_principal?.chave_pix || '').trim(),
        favorecido: (document.getElementById('f-p1-fav')?.value || atual.pix_principal?.favorecido || '').trim(),
        qrcode_img: atual.pix_principal?.qrcode_img || ''
      },
      pix_secundario: {
        ...(atual.pix_secundario || {}),
        nome: (document.getElementById('f-p2-nome')?.value || atual.pix_secundario?.nome || 'Conta PJ Secundária').trim(),
        banco: (document.getElementById('f-p2-banco')?.value || atual.pix_secundario?.banco || 'Banco Inter').trim(),
        tipo_chave: document.getElementById('f-p2-tipo')?.value || atual.pix_secundario?.tipo_chave || 'CNPJ',
        chave_pix: (document.getElementById('f-p2-chave')?.value || atual.pix_secundario?.chave_pix || '').trim(),
        favorecido: (document.getElementById('f-p2-fav')?.value || atual.pix_secundario?.favorecido || '').trim(),
        qrcode_img: atual.pix_secundario?.qrcode_img || ''
      },
      pix_autonomo: {
        ...(atual.pix_autonomo || {}),
        nome: (document.getElementById('f-p3-nome')?.value || atual.pix_autonomo?.nome || 'Conta Autônomo / Sócio').trim(),
        banco: (document.getElementById('f-p3-banco')?.value || atual.pix_autonomo?.banco || 'Nubank').trim(),
        tipo_chave: document.getElementById('f-p3-tipo')?.value || atual.pix_autonomo?.tipo_chave || 'CPF',
        chave_pix: (document.getElementById('f-p3-chave')?.value || atual.pix_autonomo?.chave_pix || '').trim(),
        favorecido: (document.getElementById('f-p3-fav')?.value || atual.pix_autonomo?.favorecido || '').trim(),
        qrcode_img: atual.pix_autonomo?.qrcode_img || ''
      },
      api_integra_contador: {
        ...(atual.api_integra_contador || {}),
        ativo: document.getElementById('f-api-ativo')?.value === 'true',
        client_id: (document.getElementById('f-api-client')?.value || atual.api_integra_contador?.client_id || '').trim(),
        endpoint: (document.getElementById('f-api-endpoint')?.value || atual.api_integra_contador?.endpoint || '').trim()
      }
    };

    dadosAtualizados.chave_pix = dadosAtualizados.pix_principal.chave_pix;
    dadosAtualizados.banco_pix = dadosAtualizados.pix_principal.banco;
    dadosAtualizados.favorecido_pix = dadosAtualizados.pix_principal.favorecido;

    db.salvarEscritorioConfig(dadosAtualizados);
    this.showToast('Dados do escritório, canais bancários e chaves PIX salvos com sucesso!', 'success');
    this.renderAll();
  },

  handleQRCodeUpload(tipoConta, event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const permitidos = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];
    const val = this.validarArquivoUpload(file, permitidos, 15);
    if (!val.valido) {
      this.showToast(val.erro, 'error');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const db = window.zgestorDB;
      const cfg = db.getEscritorioConfig();
      if (!cfg[tipoConta]) cfg[tipoConta] = {};
      cfg[tipoConta].qrcode_img = dataUrl;
      db.salvarEscritorioConfig(cfg);

      const previewBox = document.getElementById(`preview-box-${tipoConta}`);
      if (previewBox) {
        previewBox.innerHTML = `<img src="${dataUrl}" class="w-full h-full object-contain" alt="QR Code ${tipoConta}" />`;
      }
      this.showToast(`Imagem do QR Code da conta salva com sucesso! Os recibos de cobrança já utilizarão essa imagem oficial.`, 'success');
      this.renderAll();
    };
    reader.readAsDataURL(file);
  },

  handleLogoUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const permitidos = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];
    const val = this.validarArquivoUpload(file, permitidos, 15);
    if (!val.valido) {
      this.showToast(val.erro, 'error');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const db = window.zgestorDB;
      const cfg = db.getEscritorioConfig();
      cfg.logo_customizada = dataUrl;
      db.salvarEscritorioConfig(cfg);

      const previewBox = document.getElementById('preview-box-logo');
      if (previewBox) {
        previewBox.innerHTML = `<img src="${dataUrl}" class="w-full h-full object-contain" alt="Logo Escritório" />`;
      }
      this.showToast('Logotipo oficial do escritório atualizado com sucesso!', 'success');
      this.renderAll();
    };
    reader.readAsDataURL(file);
  },

  removerLogoEscritorio() {
    const db = window.zgestorDB;
    const cfg = db.getEscritorioConfig();
    delete cfg.logo_customizada;
    db.salvarEscritorioConfig(cfg);
    this.showToast('Logotipo do escritório restaurado para a marca padrão.', 'info');
    this.renderAll();
  },

  removerQRCodePix(tipoConta) {
    const db = window.zgestorDB;
    const cfg = db.getEscritorioConfig();
    if (cfg[tipoConta]) {
      cfg[tipoConta].qrcode_img = '';
      db.salvarEscritorioConfig(cfg);
    }
    this.showToast('QR Code customizado removido. O sistema voltará a utilizar o código padrão.', 'info');
    this.renderAll();
  },

  testarConexaoAPIIntegraContador() {
    const db = window.zgestorDB;
    const cfg = db.getEscritorioConfig();
    const isAtivo = document.getElementById('f-api-ativo')?.value === 'true' || cfg.api_integra_contador?.ativo;
    if (!isAtivo) {
      this.showToast('A API Integra Contador está inativa no momento. Altere o status para "Ativo" e teste novamente.', 'warning');
      return;
    }
    const endpoint = (cfg.api_integra_contador && cfg.api_integra_contador.endpoint) || 'https://indisponivel.example.test';
    this.showToast('Conectando ao gateway SERPRO / Receita Federal...', 'info');

    try {
      if (typeof fetch === 'function') {
        const promise = fetch(endpoint, { method: 'HEAD' });
        if (promise && typeof promise.then === 'function') {
          promise.then(res => {
            if (res && res.ok) {
              const contentType = (res.headers && typeof res.headers.get === 'function') ? (res.headers.get('content-type') || '') : '';
              if (contentType.toLowerCase().includes('application/json')) {
                this.showToast('✓ Conexão com o serviço da API Integra Contador validada com sucesso!', 'success');
              } else {
                this.showToast('Disponibilidade do endereço confirmada (HTTP 200 na rede). Serviço oficial da API não validado.', 'info');
              }
            } else {
              this.showToast(`Falha na resposta da API Integra Contador: ${res ? res.status : 'Erro de comunicação'}`, 'error');
            }
          }).catch(err => {
            this.showToast(`Falha ao conectar com o endpoint da API Integra Contador: ${err.message}`, 'error');
          });
          return;
        }
      }
      this.showToast('Ambiente sem suporte a chamadas de rede para validar endpoint da API.', 'warning');
    } catch (err) {
      this.showToast(`Falha ao conectar com o endpoint da API Integra Contador: ${err.message}`, 'error');
    }
  },

  openModalPagamentoHonorario(honorarioId) {
    const db = window.zgestorDB;
    const hon = db.data.honorarios.find(h => h.id === honorarioId);
    if (!hon) return;
    const emp = db.data.empresas.find(e => e.id === hon.empresa_id);
    const hoje = new Date().toISOString().slice(0, 10);
    const V = window.ZGestorViews;
    const saldoAnt = Number(hon.saldo_anterior || 0);
    const totalMes = Math.max(0, Number(hon.valor_mensal) + saldoAnt + Number(hon.servicos_extras) - Number(hon.desconto));

    let contaSugerida = 'Conta PJ Principal (Itaú)';
    if (emp && emp.canal_pagamento_padrao === 'PIX_SECUNDARIO') contaSugerida = 'Conta PJ Secundária (Inter / Nubank PJ)';
    else if (emp && emp.canal_pagamento_padrao === 'PIX_AUTONOMO') contaSugerida = 'Conta Autônomo / Sócio (Pessoa Física)';
    else if (emp && emp.canal_pagamento_padrao === 'DINHEIRO') contaSugerida = 'Dinheiro / Espécie (Caixa Físico)';

    const modal = document.getElementById('modal-root');
    if (!modal) return;
    modal.innerHTML = `
      <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 class="text-base font-bold text-slate-900">Informar Pagamento de Honorário (${hon.competencia})</h3>
            <button onclick="ZGestorApp.closeModal()" class="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
          </div>
          <form onsubmit="ZGestorApp.submitPagamentoHonorario(event, '${hon.id}')" class="space-y-4 mt-4 text-xs">
            <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div class="font-bold text-slate-900 text-sm">${emp ? emp.nome_fantasia : 'Cliente'}</div>
              <div class="flex justify-between text-slate-600">
                <span>Valor Mensal (${hon.competencia}):</span>
                <strong>${V.formatCurrency(hon.valor_mensal)}</strong>
              </div>
              ${saldoAnt > 0 ? `
                <div class="flex justify-between text-amber-800">
                  <span>(+) Saldo Anterior (${hon.competencia_saldo_anterior || 'Mês Ant.'}):</span>
                  <strong>+ ${V.formatCurrency(saldoAnt)}</strong>
                </div>
              ` : ''}
              <div class="flex justify-between text-slate-800 pt-1 border-t border-slate-200">
                <span>Total c/ Complemento:</span>
                <strong>${V.formatCurrency(totalMes)}</strong>
              </div>
              <div class="flex justify-between text-emerald-700">
                <span>Já Pago durante o mês:</span>
                <strong>${V.formatCurrency(hon.valor_pago)}</strong>
              </div>
              <div class="flex justify-between text-rose-600 pt-1 border-t border-slate-200 text-sm">
                <span class="font-bold">Saldo Atual em Aberto:</span>
                <strong class="font-extrabold">${V.formatCurrency(hon.saldo_aberto)}</strong>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-800 mb-1">Valor Pago Agora (R$) *</label>
                <input id="f-pag-valor" type="number" step="0.01" min="0.01" required value="${Number(hon.saldo_aberto).toFixed(2)}" oninput="ZGestorApp.atualizarPreviaSaldo('${hon.saldo_aberto}', this.value)" class="w-full rounded-xl border border-emerald-400 px-3 py-2 text-sm font-bold text-emerald-800" />
              </div>
              <div>
                <label class="block font-bold text-slate-800 mb-1">Data do Pagamento *</label>
                <input id="f-pag-data" type="date" required value="${hoje}" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
            </div>

            <div class="p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
              <span class="font-semibold text-amber-900">Valor que ficará em aberto (passa p/ próx. mês):</span>
              <span id="previa-saldo-aberto" class="font-extrabold text-sm text-amber-900">R$ 0,00</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Forma de Pagamento *</label>
                <select id="f-pag-forma" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-medium">
                  <option value="PIX">PIX (Chave do Escritório)</option>
                  <option value="Transferência">TED / Transferência</option>
                  <option value="Dinheiro">Espécie / Dinheiro</option>
                  <option value="Boleto">Boleto Bancário</option>
                </select>
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Conta / Destino do Recebimento *</label>
                <select id="f-pag-conta" class="w-full rounded-xl border border-indigo-300 px-3 py-2 font-semibold bg-white text-indigo-950">
                  <option value="Conta PJ Principal (Itaú)" ${contaSugerida === 'Conta PJ Principal (Itaú)' ? 'selected' : ''}>Conta PJ Principal (Itaú)</option>
                  <option value="Conta PJ Secundária (Inter / Nubank PJ)" ${contaSugerida === 'Conta PJ Secundária (Inter / Nubank PJ)' ? 'selected' : ''}>Conta PJ Secundária (Inter / Nubank PJ)</option>
                  <option value="Conta Autônomo / Sócio (Pessoa Física)" ${contaSugerida === 'Conta Autônomo / Sócio (Pessoa Física)' ? 'selected' : ''}>Conta Autônomo / Sócio (Pessoa Física)</option>
                  <option value="Dinheiro / Espécie (Caixa Físico)" ${contaSugerida === 'Dinheiro / Espécie (Caixa Físico)' ? 'selected' : ''}>Dinheiro / Espécie (Caixa Físico)</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Observação do Recebimento</label>
              <input id="f-pag-obs" type="text" placeholder="Ex: Comprovante PIX enviado via WhatsApp..." class="w-full rounded-xl border border-slate-300 px-3 py-2" />
            </div>

            <div class="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button type="button" onclick="ZGestorApp.closeModal()" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold">Cancelar</button>
              <button type="submit" class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow">Salvar Pagamento & Saldo</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  atualizarPreviaSaldo(saldoAtual, valorDigitado) {
    const el = document.getElementById('previa-saldo-aberto');
    if (!el) return;
    const rest = Math.max(0, Number(saldoAtual || 0) - Number(valorDigitado || 0));
    el.textContent = window.ZGestorViews.formatCurrency(rest);
  },

  submitPagamentoHonorario(e, honorarioId) {
    e.preventDefault();
    try {
      const val = document.getElementById('f-pag-valor').value;
      const data = document.getElementById('f-pag-data').value;
      const forma = document.getElementById('f-pag-forma').value;
      const conta = document.getElementById('f-pag-conta') ? document.getElementById('f-pag-conta').value : 'Conta PJ Principal (Itaú)';
      const obs = document.getElementById('f-pag-obs').value.trim();
      const hon = window.zgestorDB.registrarPagamentoHonorario(honorarioId, val, data, forma, obs, conta);
      this.closeModal();
      this.showToast(`Pagamento registrado na ${conta}! Valor em aberto salvo: ${window.ZGestorViews.formatCurrency(hon.saldo_aberto)}.`, 'success');
      this.renderAll();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  estornarPagamento(pagId) {
    window.zgestorDB.excluirPagamentoHonorario(pagId);
    this.showToast('Pagamento estornado e saldos recalculados.', 'info');
    this.renderAll();
  },

  openModalEditarHonorario(honorarioId) {
    const hon = window.zgestorDB.data.honorarios.find(h => h.id === honorarioId);
    if (!hon) return;
    const emp = window.zgestorDB.data.empresas.find(e => e.id === hon.empresa_id);
    const compAnt = hon.competencia_saldo_anterior || window.zgestorDB.obterCompetenciaAnterior(hon.competencia);

    const modal = document.getElementById('modal-root');
    if (!modal) return;
    modal.innerHTML = `
      <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 class="text-base font-bold text-slate-900">Ajustar Honorário Mensal (${emp ? emp.nome_fantasia : ''})</h3>
            <button onclick="ZGestorApp.closeModal()" class="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
          </div>
          <form onsubmit="ZGestorApp.submitEditarHonorario(event, '${hon.id}')" class="space-y-4 mt-4 text-xs">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Valor Mensal que o Cliente Paga (R$) *</label>
                <input id="f-hon-mensal" type="number" step="0.01" required value="${hon.valor_mensal}" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Vencimento (Mês Seguinte) *</label>
                <input id="f-hon-venc" type="date" required value="${hon.data_vencimento}" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
            </div>
            <div class="p-3 rounded-xl bg-amber-50 border border-amber-200">
              <label class="block font-bold text-amber-900 mb-1">Saldo em Aberto do Mês Anterior (${compAnt}) (R$)</label>
              <input id="f-hon-saldo-ant" type="number" step="0.01" value="${Number(hon.saldo_anterior || 0)}" class="w-full rounded-xl border border-amber-300 px-3 py-2 bg-white font-bold text-amber-900" />
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Serviços Extras no Mês (R$)</label>
                <input id="f-hon-extras" type="number" step="0.01" value="${hon.servicos_extras}" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Desconto Concedido (R$)</label>
                <input id="f-hon-desc" type="number" step="0.01" value="${hon.desconto}" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Observações do Honorário (Sai no Recibo PIX)</label>
              <input id="f-hon-obs" type="text" value="${hon.observacoes || ''}" class="w-full rounded-xl border border-slate-300 px-3 py-2" />
            </div>
            <div class="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button type="button" onclick="ZGestorApp.closeModal()" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold">Cancelar</button>
              <button type="submit" class="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold">Salvar Alterações</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  submitEditarHonorario(e, honorarioId) {
    e.preventDefault();
    window.zgestorDB.salvarHonorario({
      id: honorarioId,
      valor_mensal: document.getElementById('f-hon-mensal').value,
      saldo_anterior: document.getElementById('f-hon-saldo-ant').value,
      data_vencimento: document.getElementById('f-hon-venc').value,
      servicos_extras: document.getElementById('f-hon-extras').value,
      desconto: document.getElementById('f-hon-desc').value,
      observacoes: document.getElementById('f-hon-obs').value.trim()
    });
    this.closeModal();
    this.showToast('Valores do honorário atualizados!', 'success');
    this.renderAll();
  },

  // ===========================================================================
  // USUÁRIOS, SEGURANÇA E MODELOS RECORRENTES (COM SELEÇÃO DE REGIME TRIBUTÁRIO)
  // ===========================================================================
  // =========================================================================
  // SISTEMA DE CONVITES, ATIVAÇÃO E EDIÇÃO DE PERMISSÕES GRANULARES
  // =========================================================================
  openModalUsuario() {
    this.openModalNovoConvite('COLABORADOR');
  },

  openModalNovoConvite(tipoInicial = 'COLABORADOR') {
    const db = window.zgestorDB;
    if (!db.isAdmin()) {
      this.showToast('Apenas Administradores podem gerar convites de acesso.', 'error');
      return;
    }
    const modal = document.getElementById('modal-root');
    const empresas = db.data.empresas || [];

    modal.innerHTML = `
      <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <div class="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Segurança & Controle de Acesso</div>
              <h3 class="text-base font-bold text-slate-900">Novo Convite de Acesso</h3>
            </div>
            <button onclick="ZGestorApp.closeModal()" class="text-slate-400 hover:text-slate-600 text-lg font-bold">✕</button>
          </div>

          <!-- Seletor de Tipo de Convite (Colaborador vs Cliente) -->
          <div class="grid grid-cols-2 gap-2 mt-4 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onclick="document.getElementById('sec-conv-colab').classList.remove('hidden'); document.getElementById('sec-conv-cliente').classList.add('hidden'); this.className='py-2 rounded-lg font-bold text-xs bg-white text-indigo-700 shadow-xs'; document.getElementById('btn-tab-cli').className='py-2 rounded-lg font-semibold text-xs text-slate-600 hover:text-slate-900';"
              class="${tipoInicial === 'COLABORADOR' ? 'py-2 rounded-lg font-bold text-xs bg-white text-indigo-700 shadow-xs' : 'py-2 rounded-lg font-semibold text-xs text-slate-600 hover:text-slate-900'}">
              👥 Colaborador da Equipe
            </button>
            <button
              id="btn-tab-cli"
              type="button"
              onclick="document.getElementById('sec-conv-colab').classList.add('hidden'); document.getElementById('sec-conv-cliente').classList.remove('hidden'); this.className='py-2 rounded-lg font-bold text-xs bg-white text-emerald-700 shadow-xs'; this.previousElementSibling.className='py-2 rounded-lg font-semibold text-xs text-slate-600 hover:text-slate-900';"
              class="${tipoInicial === 'CLIENTE' ? 'py-2 rounded-lg font-bold text-xs bg-white text-emerald-700 shadow-xs' : 'py-2 rounded-lg font-semibold text-xs text-slate-600 hover:text-slate-900'}">
              🏢 Cliente (Portal do Cliente)
            </button>
          </div>

          <!-- FORMULÁRIO 1: CONVITE PARA COLABORADOR -->
          <form id="sec-conv-colab" onsubmit="ZGestorApp.submitNovoConvite(event, 'COLABORADOR')" class="space-y-4 mt-4 text-xs ${tipoInicial === 'COLABORADOR' ? '' : 'hidden'}">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Nome Completo do Colaborador *</label>
              <input id="f-colab-nome" type="text" required placeholder="Ex: Rodrigo Mendonça (Analista Fiscal)" class="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">E-mail Profissional para Envio do Convite *</label>
              <input id="f-colab-email" type="email" required placeholder="rodrigo@zgestor.com.br" class="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Cargo *</label>
                <select id="f-colab-cargo" class="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white">
                  <option value="COLABORADOR">Colaborador / Analista</option>
                  <option value="SUPERVISOR">Supervisor de Setor</option>
                  <option value="ADMIN">Administrador / Sócio</option>
                </select>
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Departamento Principal *</label>
                <select id="f-colab-dept" class="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white">
                  <option value="FISCAL">Fiscal</option>
                  <option value="CONTABIL">Contábil</option>
                  <option value="PESSOAL">Pessoal (DP)</option>
                  <option value="FINANCEIRO">Financeiro</option>
                  <option value="SOCIETARIO">Societário</option>
                  <option value="TODOS">Todos os Setores</option>
                </select>
              </div>
            </div>

            <!-- Grade de Permissões Granulares -->
            <div class="pt-2">
              <label class="block font-bold text-slate-800 mb-1.5">Permissões de Acesso por Módulo:</label>
              <div class="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <label class="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                  <input type="checkbox" id="perm-colab-dashboard" checked class="rounded text-indigo-600 focus:ring-indigo-500" />
                  <span>Visão Geral (Dashboard)</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                  <input type="checkbox" id="perm-colab-tarefas" checked class="rounded text-indigo-600 focus:ring-indigo-500" />
                  <span>Tarefas & Fechamentos</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                  <input type="checkbox" id="perm-colab-parcelamentos" checked class="rounded text-indigo-600 focus:ring-indigo-500" />
                  <span>Parcelamentos</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                  <input type="checkbox" id="perm-colab-cnds" checked class="rounded text-indigo-600 focus:ring-indigo-500" />
                  <span>Controle de CNDs</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                  <input type="checkbox" id="perm-colab-empresas" checked class="rounded text-indigo-600 focus:ring-indigo-500" />
                  <span>Minhas Empresas</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                  <input type="checkbox" id="perm-colab-central" checked class="rounded text-indigo-600 focus:ring-indigo-500" />
                  <span>Central do Cliente</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                  <input type="checkbox" id="perm-colab-onboarding" class="rounded text-indigo-600 focus:ring-indigo-500" />
                  <span>Onboarding Clientes</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                  <input type="checkbox" id="perm-colab-honorarios" class="rounded text-indigo-600 focus:ring-indigo-500" />
                  <span class="text-indigo-900 font-bold">Honorários</span>
                </label>
              </div>
            </div>

            <div class="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button type="button" onclick="ZGestorApp.closeModal()" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200">Cancelar</button>
              <button type="submit" class="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-sm flex items-center gap-1.5">
                <i data-lucide="send" class="w-3.5 h-3.5"></i> Gerar Convite p/ Colaborador
              </button>
            </div>
          </form>

          <!-- FORMULÁRIO 2: CONVITE PARA CLIENTE (PORTAL COM RLS BLINDADO) -->
          <form id="sec-conv-cliente" onsubmit="ZGestorApp.submitNovoConvite(event, 'CLIENTE')" class="space-y-4 mt-4 text-xs ${tipoInicial === 'CLIENTE' ? '' : 'hidden'}">
            <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900">
              <div class="font-bold flex items-center gap-1.5">
                <i data-lucide="shield-check" class="w-4 h-4 text-emerald-600"></i>
                Isolamento Total de Dados (Row-Level Security)
              </div>
              <p class="text-[11px] text-emerald-800 mt-1">
                O cliente terá acesso <strong>exclusivamente</strong> às informações, guias, certidões e balancetes da empresa selecionada abaixo.
              </p>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Empresa Cliente Vinculada *</label>
              <select id="f-cli-empresa" required class="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white font-semibold">
                <option value="">Selecione a empresa...</option>
                ${empresas.map(e => `
                  <option value="${e.id}">#${e.codigo_interno} — ${e.nome_fantasia} (CNPJ: ${e.cnpj})</option>
                `).join('')}
              </select>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Nome do Contato / Sócio Responsável *</label>
              <input id="f-cli-nome" type="text" required placeholder="Ex: Henrique Moreira (Diretor Executivo)" class="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-emerald-500 focus:outline-none" />
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">E-mail de Acesso do Cliente *</label>
              <input id="f-cli-email" type="email" required placeholder="contato@empresa.com.br" class="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-emerald-500 focus:outline-none" />
            </div>

            <div class="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button type="button" onclick="ZGestorApp.closeModal()" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200">Cancelar</button>
              <button type="submit" class="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-sm flex items-center gap-1.5">
                <i data-lucide="shield-check" class="w-3.5 h-3.5"></i> Gerar Acesso Seguro do Cliente
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  },

  submitNovoConvite(e, tipo) {
    e.preventDefault();
    try {
      const db = window.zgestorDB;
      let dados;
      if (tipo === 'CLIENTE') {
        const empId = document.getElementById('f-cli-empresa').value;
        if (!empId) throw new Error('Selecione uma empresa para o cliente.');
        dados = {
          tipo: 'CLIENTE',
          empresa_id: empId,
          nome: document.getElementById('f-cli-nome').value.trim(),
          email: document.getElementById('f-cli-email').value.trim()
        };
      } else {
        dados = {
          tipo: 'COLABORADOR',
          nome: document.getElementById('f-colab-nome').value.trim(),
          email: document.getElementById('f-colab-email').value.trim(),
          cargo: document.getElementById('f-colab-cargo').value,
          departamento: document.getElementById('f-colab-dept').value,
          permissoes: {
            dashboard: document.getElementById('perm-colab-dashboard').checked,
            tarefas: document.getElementById('perm-colab-tarefas').checked,
            parcelamentos: document.getElementById('perm-colab-parcelamentos').checked,
            cnds: document.getElementById('perm-colab-cnds').checked,
            empresas: document.getElementById('perm-colab-empresas').checked,
            central_cliente: document.getElementById('perm-colab-central').checked,
            onboarding: document.getElementById('perm-colab-onboarding').checked,
            honorarios: document.getElementById('perm-colab-honorarios').checked,
            seguranca: false
          }
        };
      }

      const convite = db.gerarConvite(dados);
      this.closeModal();
      this.copiarLinkConvite(convite.token);
      this.showToast(`Convite gerado com sucesso para ${convite.nome}! Link copiado.`, 'success');
      this.state.subTabSeguranca = 'convites';
      this.renderAll();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  copiarLinkConvite(token) {
    const link = window.location.origin + window.location.pathname + '?convite=' + encodeURIComponent(token);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).catch(() => {});
    }
    this.showToast('Link de ativação copiado! Envie ao usuário para cadastrar a nova senha.', 'success');
  },

  abrirTelaAtivacaoConta(token) {
    const db = window.zgestorDB;
    const conv = db.buscarConvitePorToken ? db.buscarConvitePorToken(token) : (db.data.convites || []).find(c => c.token === token);
    const modal = document.getElementById('modal-root');
    if (!modal) return;

    if (!conv) {
      modal.innerHTML = `
        <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center">
            <div class="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3 border border-rose-200">
              <i data-lucide="alert-triangle" class="w-6 h-6"></i>
            </div>
            <h3 class="text-base font-bold text-slate-900 mb-1">Convite Não Encontrado</h3>
            <p class="text-xs text-slate-500 mb-5 leading-relaxed">
              O link de convite utilizado é inválido ou expirou. Solicite um novo link à Administração do escritório.
            </p>
            <button onclick="ZGestorApp.closeModal(); ZGestorApp.logout();" class="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition shadow-sm">
              Ir para Tela de Login
            </button>
          </div>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    if (conv.expira_em) {
      const expTime = new Date(conv.expira_em).getTime();
      if (!isNaN(expTime) && expTime < Date.now()) {
        modal.innerHTML = `
          <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center">
              <div class="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3 border border-rose-200">
                <i data-lucide="alert-triangle" class="w-6 h-6"></i>
              </div>
              <h3 class="text-base font-bold text-slate-900 mb-1">Convite Expirado</h3>
              <p class="text-xs text-slate-500 mb-5 leading-relaxed">
                Este link de convite expirou. Solicite um novo link à Administração do escritório.
              </p>
              <button onclick="ZGestorApp.closeModal(); ZGestorApp.logout();" class="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition shadow-sm">
                Ir para Tela de Login
              </button>
            </div>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
      }
    }

    if (conv.status !== 'PENDENTE') {
      modal.innerHTML = `
        <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center">
            <div class="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 border border-amber-200">
              <i data-lucide="info" class="w-6 h-6"></i>
            </div>
            <h3 class="text-base font-bold text-slate-900 mb-1">Convite Já ${conv.status === 'ACEITO' ? 'Ativado' : 'Revogado'}</h3>
            <p class="text-xs text-slate-500 mb-5 leading-relaxed">
              ${conv.status === 'ACEITO'
                ? 'Este convite já foi utilizado e a senha já está cadastrada. Entre com seu e-mail e senha no sistema.'
                : 'Este convite de acesso foi cancelado pela Administração do escritório.'}
            </p>
            <button onclick="ZGestorApp.closeModal(); ZGestorApp.logout();" class="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition shadow-sm">
              Ir para Tela de Login
            </button>
          </div>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const emp = conv.empresa_id ? db.data.empresas.find(e => e.id === conv.empresa_id) : null;

    modal.innerHTML = `
      <div class="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <div class="text-[10px] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1">
                <i data-lucide="sparkles" class="w-3.5 h-3.5"></i> Ativação de Acesso & Nova Senha
              </div>
              <h3 class="text-base font-bold text-slate-900">Cadastre sua Senha no ZGestor</h3>
            </div>
            <button onclick="ZGestorApp.closeModal()" class="text-slate-400 hover:text-slate-600 text-lg font-bold">✕</button>
          </div>

          <div class="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs text-slate-700">
            <div class="flex items-center justify-between">
              <span class="text-slate-500">Destinatário:</span>
              <span class="font-bold text-slate-900">${conv.nome}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500">E-mail de Login:</span>
              <span class="font-mono font-semibold text-slate-800">${conv.email}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500">Tipo de Acesso:</span>
              <span class="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200 text-[11px]">
                ${conv.tipo === 'CLIENTE' ? `Cliente: ${emp ? emp.nome_fantasia : 'Portal'}` : `Colaborador: ${conv.departamento}`}
              </span>
            </div>
          </div>

          <form onsubmit="ZGestorApp.submitAtivarConvite(event, '${encodeURIComponent(token)}')" class="space-y-3.5 mt-4 text-xs">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Confirmar Nome de Exibição *</label>
              <input id="f-ativ-nome" type="text" value="${conv.nome}" required class="w-full rounded-xl border border-slate-300 px-3 py-2 font-medium focus:border-indigo-600 focus:outline-none" />
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Crie sua Nova Senha *</label>
              <div class="relative">
                <input id="f-ativ-senha" type="password" required minlength="6" placeholder="Mínimo 6 caracteres" class="w-full rounded-xl border border-slate-300 px-3 py-2 pr-10 font-mono text-xs focus:border-indigo-600 focus:outline-none" />
                <button type="button" onclick="ZGestorApp.toggleVerInput('f-ativ-senha', 'icon-ativ-1')" class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600">
                  <i id="icon-ativ-1" data-lucide="eye" class="w-4 h-4"></i>
                </button>
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Confirme a Nova Senha *</label>
              <div class="relative">
                <input id="f-ativ-senha2" type="password" required minlength="6" placeholder="Digite a mesma senha novamente" class="w-full rounded-xl border border-slate-300 px-3 py-2 pr-10 font-mono text-xs focus:border-indigo-600 focus:outline-none" />
                <button type="button" onclick="ZGestorApp.toggleVerInput('f-ativ-senha2', 'icon-ativ-2')" class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600">
                  <i id="icon-ativ-2" data-lucide="eye" class="w-4 h-4"></i>
                </button>
              </div>
              <span class="text-[10px] text-slate-400 mt-1 block">A senha deve ter no mínimo 6 caracteres.</span>
            </div>

            <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button type="button" onclick="ZGestorApp.closeModal()" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200">Cancelar</button>
              <button type="submit" class="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-md flex items-center gap-1.5">
                <i data-lucide="check" class="w-3.5 h-3.5"></i> Cadastrar Senha & Entrar
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  },

  simularAtivacaoConvite(token) {
    this.abrirTelaAtivacaoConta(token);
  },

  abrirPromptAtivacao() {
    const modal = document.getElementById('modal-root');
    if (!modal) return;
    modal.innerHTML = `
      <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <div class="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Ativação de Cadastro</div>
              <h3 class="text-base font-bold text-slate-900">Inserir Código / Token do Convite</h3>
            </div>
            <button onclick="ZGestorApp.closeModal()" class="text-slate-400 hover:text-slate-600 text-lg font-bold">✕</button>
          </div>
          <form onsubmit="event.preventDefault(); const t = document.getElementById('f-token-manual').value.trim(); if(t){ ZGestorApp.abrirTelaAtivacaoConta(t); }" class="space-y-4 mt-4 text-xs">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Cole o Token ou Código do Convite *</label>
              <input id="f-token-manual" type="text" required placeholder="Ex: tk_colab_..." class="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs focus:border-indigo-600 focus:outline-none" />
              <span class="text-[10px] text-slate-400 mt-1 block">Você também pode clicar diretamente no link completo de ativação que recebeu.</span>
            </div>
            <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button type="button" onclick="ZGestorApp.closeModal()" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200">Cancelar</button>
              <button type="submit" class="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-sm">Continuar Ativação</button>
            </div>
          </form>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  },

  toggleVerInput(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (!input) return;
    if (input.type === 'password') {
      input.type = 'text';
      if (icon) icon.setAttribute('data-lucide', 'eye-off');
    } else {
      input.type = 'password';
      if (icon) icon.setAttribute('data-lucide', 'eye');
    }
    if (window.lucide) window.lucide.createIcons();
  },

  submitAtivarConvite(e, token) {
    e.preventDefault();
    try {
      const db = window.zgestorDB;
      const nome = document.getElementById('f-ativ-nome').value.trim();
      const senha = document.getElementById('f-ativ-senha').value;
      const senha2 = document.getElementById('f-ativ-senha2').value;

      if (!nome) {
        throw new Error('Informe seu nome completo para ativação.');
      }
      if (!senha || senha.length < 6) {
        throw new Error('A senha deve conter no mínimo 6 caracteres.');
      }
      if (senha !== senha2) {
        throw new Error('As senhas digitadas não coincidem. Digite novamente.');
      }

      const cleanToken = decodeURIComponent(token);
      const novoUsr = db.aceitarConvite(cleanToken, { nome, senha });
      this.closeModal();

      // Limpa os parâmetros de convite da URL mantendo o histórico limpo
      if (window.history && window.history.replaceState) {
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }

      // Efetua login automático com as credenciais recém criadas
      db.login(novoUsr.email, senha);

      this.showToast(`Conta ativada com sucesso! Bem-vindo(a) ao ZGestor, ${novoUsr.nome}!`, 'success');
      this.renderAll();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  openModalEditarPermissoes(userId) {
    const db = window.zgestorDB;
    if (!db.isAdmin()) {
      this.showToast('Apenas Administradores podem editar permissões.', 'error');
      return;
    }
    const prof = (db.data.profiles || []).find(p => p.id === userId);
    if (!prof) return;

    const modal = document.getElementById('modal-root');
    const empresas = db.data.empresas || [];
    const isCliente = prof.cargo === 'CLIENTE';
    const perms = prof.permissoes || {};

    modal.innerHTML = `
      <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <div class="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Governança & RLS</div>
              <h3 class="text-base font-bold text-slate-900">Editar Permissões: ${prof.nome}</h3>
            </div>
            <button onclick="ZGestorApp.closeModal()" class="text-slate-400 hover:text-slate-600 text-lg font-bold">✕</button>
          </div>

          <form onsubmit="ZGestorApp.submitEditarPermissoes(event, '${prof.id}')" class="space-y-4 mt-4 text-xs">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Cargo / Função *</label>
                <select id="f-edit-cargo" class="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white">
                  <option value="COLABORADOR" ${prof.cargo === 'COLABORADOR' ? 'selected' : ''}>Colaborador</option>
                  <option value="SUPERVISOR" ${prof.cargo === 'SUPERVISOR' ? 'selected' : ''}>Supervisor</option>
                  <option value="ADMIN" ${prof.cargo === 'ADMIN' ? 'selected' : ''}>Administrador (Total)</option>
                  ${isCliente ? `<option value="CLIENTE" selected>Cliente do Portal</option>` : ''}
                </select>
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Setor / Departamento *</label>
                <select id="f-edit-dept" class="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white">
                  <option value="FISCAL" ${prof.departamento === 'FISCAL' ? 'selected' : ''}>Fiscal</option>
                  <option value="CONTABIL" ${prof.departamento === 'CONTABIL' ? 'selected' : ''}>Contábil</option>
                  <option value="PESSOAL" ${prof.departamento === 'PESSOAL' ? 'selected' : ''}>Pessoal (DP)</option>
                  <option value="FINANCEIRO" ${prof.departamento === 'FINANCEIRO' ? 'selected' : ''}>Financeiro</option>
                  <option value="SOCIETARIO" ${prof.departamento === 'SOCIETARIO' ? 'selected' : ''}>Societário</option>
                  <option value="TODOS" ${prof.departamento === 'TODOS' ? 'selected' : ''}>Todos os Setores</option>
                  ${isCliente ? `<option value="CLIENTE" selected>Cliente do Portal</option>` : ''}
                </select>
              </div>
            </div>

            ${isCliente ? `
              <div>
                <label class="block font-bold text-slate-700 mb-1">Empresa Vinculada (Isolamento RLS) *</label>
                <select id="f-edit-empresa" class="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white font-semibold">
                  ${empresas.map(e => `
                    <option value="${e.id}" ${e.id === prof.empresa_id ? 'selected' : ''}>#${e.codigo_interno} — ${e.nome_fantasia} (${e.cnpj})</option>
                  `).join('')}
                </select>
              </div>
            ` : `
              <div>
                <label class="block font-bold text-slate-800 mb-1.5">Módulos Liberados no Sistema:</label>
                <div class="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <label class="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input type="checkbox" id="p-dashboard" ${perms.dashboard !== false ? 'checked' : ''} class="rounded text-indigo-600" />
                    <span>Visão Geral (Dashboard)</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input type="checkbox" id="p-tarefas" ${perms.tarefas !== false ? 'checked' : ''} class="rounded text-indigo-600" />
                    <span>Tarefas & Fechamentos</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input type="checkbox" id="p-parcelamentos" ${perms.parcelamentos ? 'checked' : ''} class="rounded text-indigo-600" />
                    <span>Parcelamentos</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input type="checkbox" id="p-cnds" ${perms.cnds !== false ? 'checked' : ''} class="rounded text-indigo-600" />
                    <span>Controle de CNDs</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input type="checkbox" id="p-empresas" ${perms.empresas ? 'checked' : ''} class="rounded text-indigo-600" />
                    <span>Minhas Empresas</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input type="checkbox" id="p-central" ${perms.central_cliente !== false ? 'checked' : ''} class="rounded text-indigo-600" />
                    <span>Central do Cliente</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input type="checkbox" id="p-onboarding" ${perms.onboarding ? 'checked' : ''} class="rounded text-indigo-600" />
                    <span>Onboarding Clientes</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input type="checkbox" id="p-honorarios" ${perms.honorarios ? 'checked' : ''} class="rounded text-indigo-600" />
                    <span class="text-indigo-900 font-bold">Honorários</span>
                  </label>
                </div>
              </div>
            `}

            <div class="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button type="button" onclick="ZGestorApp.closeModal()" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200">Cancelar</button>
              <button type="submit" class="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-sm">Salvar Alterações</button>
            </div>
          </form>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  },

  submitEditarPermissoes(e, userId) {
    e.preventDefault();
    try {
      const db = window.zgestorDB;
      const prof = (db.data.profiles || []).find(p => p.id === userId);
      const isCliente = prof && prof.cargo === 'CLIENTE';

      const cargo = document.getElementById('f-edit-cargo').value;
      const dept = document.getElementById('f-edit-dept').value;
      let empId = undefined;
      let perms = undefined;

      if (isCliente) {
        empId = document.getElementById('f-edit-empresa').value;
      } else {
        perms = {
          dashboard: document.getElementById('p-dashboard').checked,
          tarefas: document.getElementById('p-tarefas').checked,
          parcelamentos: document.getElementById('p-parcelamentos').checked,
          cnds: document.getElementById('p-cnds').checked,
          empresas: document.getElementById('p-empresas').checked,
          central_cliente: document.getElementById('p-central').checked,
          onboarding: document.getElementById('p-onboarding').checked,
          honorarios: document.getElementById('p-honorarios').checked,
          seguranca: cargo === 'ADMIN'
        };
      }

      db.atualizarPermissoesUsuario(userId, perms, cargo, dept, empId);
      this.closeModal();
      this.showToast('Permissões e perfil atualizados com sucesso!', 'success');
      this.renderAll();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  toggleStatusUsuario(userId) {
    try {
      const db = window.zgestorDB;
      const prof = db.toggleStatusUsuario(userId);
      this.showToast(`Usuário ${prof.nome} foi ${prof.ativo ? 'ativado' : 'desativado'}.`, 'info');
      this.renderAll();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  revogarConvite(conviteId) {
    try {
      const db = window.zgestorDB;
      db.revogarConvite(conviteId);
      this.showToast('Convite revogado com sucesso.', 'info');
      this.renderAll();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  async salvarConfigSupabase() {
    const url = document.getElementById('inp-sb-url').value;
    const key = document.getElementById('inp-sb-key').value;
    const ok = window.zgestorDB.saveSupabaseConfig(url, key, true);
    if (ok) {
      const sync = await window.zgestorDB.syncFromSupabase();
      this.showToast(sync.message, sync.ok ? 'success' : 'info');
    } else {
      this.showToast('Modo local ativo.', 'info');
    }
    this.renderAll();
  },

  exportarBackupJSON() {
    const db = window.zgestorDB;
    if (!db.isAdmin()) {
      this.showToast('Apenas o Administrador pode exportar backups de dados.', 'error');
      throw new Error('Acesso não autorizado para exportação de dados.');
    }
    const exportData = JSON.parse(JSON.stringify(db.data));
    if (Array.isArray(exportData.profiles)) {
      exportData.profiles.forEach(p => {
        delete p.senha;
        delete p.senha_hash;
        delete p.senha_salt;
      });
    }
    if (Array.isArray(exportData.convites)) {
      exportData.convites.forEach(c => {
        delete c.token;
        delete c.token_hash;
      });
    }
    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zgestor_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Backup do banco de dados exportado com sucesso (sem credenciais)!', 'success');
  },

  // ===========================================================================
  // MODELOS DE TAREFAS RECORRENTES COM SELETOR DE REGIME TRIBUTÁRIO DA EMPRESA
  // ===========================================================================
  openModalModelosTarefas(modeloEditarId = null) {
    const modelos = window.zgestorDB.getModelosTarefas();
    const V = window.ZGestorViews;
    const todosRegimes = window.ZGESTOR_MODELS.regimesTributarios || ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI', 'Imune/Isenta'];
    const modEdit = modeloEditarId ? modelos.find(m => m.id === modeloEditarId) : null;

    const formValues = modEdit || {
      id: '',
      titulo: '',
      dia_prazo_padrao: 15,
      departamento: 'FISCAL',
      descricao: '',
      regimes_aplicaveis: ['Simples Nacional'],
      exige_funcionarios: false
    };

    const modal = document.getElementById('modal-root');
    if (!modal) return;
    modal.innerHTML = `
      <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 class="text-base font-bold text-slate-900">Modelos de Rotinas e Obrigações Mensais Recorrentes</h3>
              <p class="text-xs text-slate-500">Selecione para quais <strong>Regimes Tributários</strong> cada obrigação se aplica (Ex: DeSTDA somente para Simples Nacional)</p>
            </div>
            <button onclick="ZGestorApp.closeModal()" class="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
          </div>

          <div class="mt-4 space-y-2 max-h-56 overflow-y-auto pr-1">
            ${modelos.map(m => `
              <div class="p-3 rounded-xl border ${modEdit && modEdit.id === m.id ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 bg-slate-50/70'} flex items-center justify-between gap-3 text-xs">
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    ${V.deptBadge(m.departamento)}
                    <span class="font-bold text-slate-900">${m.titulo}</span>
                    <span class="text-indigo-700 font-semibold">(Prazo: Dia ${m.dia_prazo_padrao} do mês seguinte)</span>
                  </div>
                  <div class="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span class="text-[11px] font-bold text-slate-500">Regimes:</span>
                    ${(m.regimes_aplicaveis || []).map(reg => `
                      <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white border border-slate-300 text-slate-800">${reg}</span>
                    `).join('')}
                    ${m.exige_funcionarios ? `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800">Requer Folha/Funcionários</span>` : ''}
                  </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <button onclick="ZGestorApp.openModalModelosTarefas('${m.id}')" class="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold">
                    Editar Regime/Modelo
                  </button>
                  <button onclick="ZGestorApp.excluirModeloRecorrente('${m.id}')" class="text-rose-500 hover:text-rose-700 font-semibold px-2 py-1">
                    Remover
                  </button>
                </div>
              </div>
            `).join('')}
          </div>

          <form onsubmit="ZGestorApp.submitNovoModeloTarefa(event)" class="mt-5 pt-4 border-t border-slate-200 space-y-3.5 text-xs">
            <input type="hidden" id="f-mod-id" value="${formValues.id || ''}" />
            <div class="flex items-center justify-between">
              <h4 class="font-bold text-slate-900 text-sm">
                ${formValues.id ? `✏️ Editando Modelo Recorrente: ${formValues.titulo}` : '+ Adicionar Novo Modelo de Obrigação Mensal'}
              </h4>
              ${formValues.id ? `
                <button type="button" onclick="ZGestorApp.openModalModelosTarefas()" class="text-xs text-slate-500 hover:text-slate-800 underline">
                  Cancelar edição e criar novo
                </button>
              ` : ''}
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="sm:col-span-2">
                <label class="block font-bold text-slate-700 mb-1">Nome da Obrigação / Tarefa *</label>
                <input id="f-mod-titulo" type="text" required value="${formValues.titulo}" placeholder="Ex: DeSTDA / SEDIF-SN, EFD-Reinf, Balancete..." class="w-full rounded-xl border border-slate-300 px-3 py-2 font-semibold" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Dia Limite no Mês Seguinte *</label>
                <input id="f-mod-dia" type="number" min="1" max="31" required value="${formValues.dia_prazo_padrao}" class="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold" />
              </div>
            </div>

            <div class="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-2">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <label class="font-bold text-indigo-950">Regime(s) Tributário(s) da Empresa para esta Rotina *</label>
                <div class="flex flex-wrap gap-1.5">
                  <button type="button" onclick="ZGestorApp.selecionarRegimesPreset(['Simples Nacional'])" class="px-2 py-0.5 rounded bg-white hover:bg-indigo-100 text-indigo-800 border border-indigo-300 text-[10px] font-bold">
                    Somente Simples Nacional
                  </button>
                  <button type="button" onclick="ZGestorApp.selecionarRegimesPreset(['Lucro Presumido', 'Lucro Real'])" class="px-2 py-0.5 rounded bg-white hover:bg-indigo-100 text-indigo-800 border border-indigo-300 text-[10px] font-bold">
                    Lucro Presumido + Real
                  </button>
                  <button type="button" onclick="ZGestorApp.selecionarRegimesPreset(['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI', 'Imune/Isenta'])" class="px-2 py-0.5 rounded bg-white hover:bg-indigo-100 text-slate-700 border border-slate-300 text-[10px] font-bold">
                    Marcar Todos
                  </button>
                </div>
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                ${todosRegimes.map(reg => {
                  const checked = (formValues.regimes_aplicaveis || []).includes(reg);
                  return `
                    <label class="flex items-center gap-2 p-2 rounded-lg bg-white border border-indigo-200 cursor-pointer hover:border-indigo-400">
                      <input type="checkbox" name="f-mod-regime" value="${reg}" ${checked ? 'checked' : ''} class="w-4 h-4 rounded text-indigo-600" />
                      <span class="font-semibold text-slate-800 text-[11px]">${reg}</span>
                    </label>
                  `;
                }).join('')}
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Departamento *</label>
                <select id="f-mod-dept" class="w-full rounded-xl border border-slate-300 px-3 py-2">
                  <option value="FISCAL" ${formValues.departamento === 'FISCAL' ? 'selected' : ''}>Fiscal</option>
                  <option value="CONTABIL" ${formValues.departamento === 'CONTABIL' ? 'selected' : ''}>Contábil</option>
                  <option value="PESSOAL" ${formValues.departamento === 'PESSOAL' ? 'selected' : ''}>Pessoal (DP)</option>
                  <option value="FINANCEIRO" ${formValues.departamento === 'FINANCEIRO' ? 'selected' : ''}>Financeiro</option>
                  <option value="SOCIETARIO" ${formValues.departamento === 'SOCIETARIO' ? 'selected' : ''}>Societário</option>
                </select>
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Descrição Curta</label>
                <input id="f-mod-desc" type="text" value="${formValues.descricao || ''}" placeholder="Instruções padrão da obrigação..." class="w-full rounded-xl border border-slate-300 px-3 py-2" />
              </div>
            </div>

            <div class="flex items-center justify-between pt-2">
              <label class="inline-flex items-center gap-2 cursor-pointer">
                <input id="f-mod-func" type="checkbox" ${formValues.exige_funcionarios ? 'checked' : ''} class="w-4 h-4 rounded text-indigo-600" />
                <span class="font-semibold text-slate-700">Aplicar somente para empresas que possuem Folha/Funcionários</span>
              </label>

              <div class="flex gap-2">
                <button type="button" onclick="ZGestorApp.closeModal()" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold">Fechar</button>
                <button type="submit" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow">
                  ${formValues.id ? 'Salvar Alterações do Modelo' : '+ Salvar Modelo Recorrente'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  selecionarRegimesPreset(listaRegimes) {
    const checkboxes = document.querySelectorAll('input[name="f-mod-regime"]');
    checkboxes.forEach(cb => {
      cb.checked = listaRegimes.includes(cb.value);
    });
  },

  submitNovoModeloTarefa(e) {
    e.preventDefault();
    const regimesSelecionados = Array.from(document.querySelectorAll('input[name="f-mod-regime"]:checked')).map(cb => cb.value);
    if (regimesSelecionados.length === 0) {
      this.showToast('Selecione pelo menos um Regime Tributário para o modelo recorrente!', 'error');
      return;
    }

    const idMod = document.getElementById('f-mod-id').value || null;
    window.zgestorDB.salvarModeloTarefa({
      id: idMod,
      titulo: document.getElementById('f-mod-titulo').value.trim(),
      dia_prazo_padrao: Number(document.getElementById('f-mod-dia').value || 15),
      departamento: document.getElementById('f-mod-dept').value,
      descricao: document.getElementById('f-mod-desc').value.trim(),
      regimes_aplicaveis: regimesSelecionados,
      exige_funcionarios: document.getElementById('f-mod-func').checked
    });
    this.showToast(idMod ? 'Modelo recorrente atualizado com os regimes selecionados!' : 'Novo modelo recorrente adicionado!', 'success');
    this.openModalModelosTarefas();
    this.renderContentOnly();
  },

  excluirModeloRecorrente(modId) {
    window.zgestorDB.excluirModeloTarefa(modId);
    this.showToast('Modelo recorrente removido.', 'info');
    this.openModalModelosTarefas();
  },

  // ===========================================================================
  // MÓDULO INTELIGÊNCIA ARTIFICIAL & ASSISTENTE CONTÁBIL (Z-IA)
  // ===========================================================================
  setSubTabIA(tab) {
    this.state.subTabIA = tab;
    this.renderContentOnly();
  },

  toggleCardConfigIA() {
    const card = document.getElementById('card-config-ia');
    if (card) card.classList.toggle('hidden');
  },

  setProvedorIA(provedor) {
    const db = window.zgestorDB;
    const esc = db.getEscritorioConfig();
    db.salvarEscritorioConfig({
      ia_config: {
        ...(esc.ia_config || {}),
        provedor
      }
    });
    this.showToast(`Provedor de IA ativo alterado para: ${provedor === 'openai' ? 'OpenAI (ChatGPT)' : 'Google Gemini'}`, 'info');
    this.renderContentOnly();
  },

  salvarChaveIA(e) {
    if (e && e.preventDefault) e.preventDefault();
    const input = document.getElementById('f-ia-apikey');
    const modelo = document.getElementById('f-ia-modelo')?.value || 'gemini-1.5-flash';
    const chave = input ? input.value.trim() : '';
    if (!chave) {
      this.showToast('Informe uma chave de API Google Gemini válida para salvar.', 'error');
      return;
    }
    const db = window.zgestorDB;
    const esc = db.getEscritorioConfig();
    db.salvarEscritorioConfig({
      ia_config: {
        ...(esc.ia_config || {}),
        gemini_api_key: chave,
        api_key: chave,
        gemini_modelo: modelo,
        ativo: true,
        atualizado_em: new Date().toISOString()
      }
    });
    this.showToast('Chave Google Gemini salva com sucesso!', 'success');
    this.renderContentOnly();
  },

  removerChaveIA() {
    if (!confirm('Deseja realmente remover a Chave de API Google Gemini?')) return;
    const db = window.zgestorDB;
    const esc = db.getEscritorioConfig();
    db.salvarEscritorioConfig({
      ia_config: {
        ...(esc.ia_config || {}),
        gemini_api_key: '',
        api_key: '',
        atualizado_em: new Date().toISOString()
      }
    });
    this.showToast('Chave Google Gemini desvinculada.', 'info');
    this.renderContentOnly();
  },

  toggleVerChaveIA() {
    const input = document.getElementById('f-ia-apikey');
    if (input) input.type = input.type === 'password' ? 'text' : 'password';
  },

  salvarChaveOpenAI(e) {
    if (e && e.preventDefault) e.preventDefault();
    const input = document.getElementById('f-ia-openaikey');
    const modelo = document.getElementById('f-ia-openai-modelo')?.value || 'gpt-4o-mini';
    const chave = input ? input.value.trim() : '';
    if (!chave) {
      this.showToast('Informe uma chave de API OpenAI válida (iniciando com sk-).', 'error');
      return;
    }
    const db = window.zgestorDB;
    const esc = db.getEscritorioConfig();
    db.salvarEscritorioConfig({
      ia_config: {
        ...(esc.ia_config || {}),
        openai_api_key: chave,
        openai_modelo: modelo,
        ativo: true,
        atualizado_em: new Date().toISOString()
      }
    });
    this.showToast('Chave da OpenAI (ChatGPT) salva com sucesso!', 'success');
    this.renderContentOnly();
  },

  removerChaveOpenAI() {
    if (!confirm('Deseja realmente remover a Chave de API OpenAI?')) return;
    const db = window.zgestorDB;
    const esc = db.getEscritorioConfig();
    db.salvarEscritorioConfig({
      ia_config: {
        ...(esc.ia_config || {}),
        openai_api_key: '',
        atualizado_em: new Date().toISOString()
      }
    });
    this.showToast('Chave OpenAI desvinculada.', 'info');
    this.renderContentOnly();
  },

  toggleVerChaveOpenAI() {
    const input = document.getElementById('f-ia-openaikey');
    if (input) input.type = input.type === 'password' ? 'text' : 'password';
  },

  async testarConexaoIA() {
    const db = window.zgestorDB;
    const esc = db.getEscritorioConfig();
    const apiKey = (esc.ia_config && (esc.ia_config.gemini_api_key || esc.ia_config.api_key)) ? (esc.ia_config.gemini_api_key || esc.ia_config.api_key).trim() : '';
    if (!apiKey) {
      this.showToast('Cadastre uma chave de API Gemini antes de testar a conexão.', 'error');
      return;
    }
    this.showToast('Testando conexão com a Google Gemini API...', 'info');
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Responda apenas: OK' }] }]
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Erro HTTP ${res.status}`);
      }
      this.showToast('Conexão com Google Gemini API realizada com sucesso! Z-IA 100% operacional.', 'success');
    } catch (err) {
      this.showToast(`Falha ao conectar com o Google Gemini: ${err.message}`, 'error');
    }
  },

  async testarConexaoOpenAI() {
    const db = window.zgestorDB;
    const esc = db.getEscritorioConfig();
    const apiKey = (esc.ia_config && esc.ia_config.openai_api_key) ? esc.ia_config.openai_api_key.trim() : '';
    if (!apiKey) {
      this.showToast('Cadastre uma chave de API OpenAI antes de testar a conexão.', 'error');
      return;
    }
    const modelo = esc.ia_config.openai_modelo || 'gpt-4o-mini';
    this.showToast(`Testando conexão com a OpenAI API (${modelo})...`, 'info');
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelo,
          messages: [{ role: 'user', content: 'Responda apenas: OK' }],
          max_tokens: 10
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Erro HTTP ${res.status}`);
      }
      this.showToast('Conexão com a OpenAI API (ChatGPT) realizada com sucesso!', 'success');
    } catch (err) {
      this.showToast(`Falha ao conectar com a OpenAI: ${err.message}`, 'error');
    }
  },

  async chamarGeminiAPI(prompt, systemInstruction = '') {
    const db = window.zgestorDB;
    const esc = db.getEscritorioConfig();
    const apiKey = (esc.ia_config && (esc.ia_config.gemini_api_key || esc.ia_config.api_key)) ? (esc.ia_config.gemini_api_key || esc.ia_config.api_key).trim() : '';
    if (!apiKey) return null;
    const modelo = esc.ia_config.gemini_modelo || 'gemini-1.5-flash';

    try {
      const body = { contents: [{ parts: [{ text: prompt }] }] };
      if (systemInstruction) body.systemInstruction = { parts: [{ text: systemInstruction }] };
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch (e) {
      console.warn('Erro ao chamar Gemini API:', e);
      return null;
    }
  },

  async chamarOpenAIAPI(prompt, systemInstruction = '') {
    const db = window.zgestorDB;
    const esc = db.getEscritorioConfig();
    const apiKey = (esc.ia_config && esc.ia_config.openai_api_key) ? esc.ia_config.openai_api_key.trim() : '';
    if (!apiKey) return null;
    const modelo = esc.ia_config.openai_modelo || 'gpt-4o-mini';

    try {
      const messages = [];
      if (systemInstruction) {
        messages.push({ role: 'system', content: systemInstruction });
      }
      messages.push({ role: 'user', content: prompt });

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelo,
          messages,
          temperature: 0.7
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.choices?.[0]?.message?.content || null;
    } catch (e) {
      console.warn('Erro ao chamar OpenAI API:', e);
      return null;
    }
  },

  async chamarIA(prompt, systemInstruction = '') {
    const db = window.zgestorDB;
    const esc = db.getEscritorioConfig();
    const provedor = (esc.ia_config && esc.ia_config.provedor) || 'gemini';

    if (provedor === 'openai') {
      const resOpenAI = await this.chamarOpenAIAPI(prompt, systemInstruction);
      if (resOpenAI) return resOpenAI;
      // Fallback para Gemini se disponível
      const resGemini = await this.chamarGeminiAPI(prompt, systemInstruction);
      if (resGemini) return resGemini;
    } else {
      const resGemini = await this.chamarGeminiAPI(prompt, systemInstruction);
      if (resGemini) return resGemini;
      // Fallback para OpenAI se disponível
      const resOpenAI = await this.chamarOpenAIAPI(prompt, systemInstruction);
      if (resOpenAI) return resOpenAI;
    }
    return null;
  },

  async gerarDiagnosticoIA() {
    const db = window.zgestorDB;
    const comp = this.state.competencia || '10/2026';
    const sub = db.obterMesSubsequente(comp);

    const tarefasComp = (db.data.tarefas || []).filter(t => t.competencia === comp);
    const pendentes = tarefasComp.filter(t => t.status !== 'CONCLUIDA' && !t.data_entrega);
    const cnds = db.getCNDs ? db.getCNDs() : [];
    const cndsAlertas = cnds.filter(c => {
      const st = db.calcularStatusValidadeCND(c).codigo;
      return st === 'VENCIDA' || st === 'PENDENCIA' || st === 'VENCENDO';
    });
    const alvaras = db.getAlvaras ? db.getAlvaras() : [];
    const alvarasAlertas = alvaras.filter(a => {
      const st = db.calcularStatusAlvara(a).codigo;
      return st === 'VENCIDO' || st === 'VENCENDO';
    });
    const honorariosAbertos = (db.data.honorarios || []).filter(h => Number(h.saldo_aberto) > 0);
    const totalAberto = honorariosAbertos.reduce((sum, h) => sum + Number(h.saldo_aberto || 0), 0);

    this.showToast('Gerando diagnóstico executivo com Inteligência Artificial...', 'info');

    let recomendacaoIA = '';
    const promptDiag = `Atue como Auditor Contábil e Financeiro Sênior da Zioto Contabilidade. Analise o seguinte panorama da carteira do escritório na competência ${comp} (${sub.label}):
- Tarefas Pendentes no Mês: ${pendentes.length} de ${tarefasComp.length} obrigações totais.
- CNDs com Alertas ou Vencidas: ${cndsAlertas.length} certidões.
- Alvarás / Licenças Vencendo ou Vencidos: ${alvarasAlertas.length} alvarás.
- Honorários em Aberto: R$ ${totalAberto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em ${honorariosAbertos.length} faturas.
Elabore um Plano de Ação Executivo com 3 prioridades operacionais imediatas e 2 recomendações tributárias/financeiras para a liderança. Seja direto, prático e profissional.`;

    const respostaIA = await this.chamarIA(promptDiag);
    if (respostaIA) {
      recomendacaoIA = respostaIA;
    } else {
      recomendacaoIA = `**PLANO DE AÇÃO EXECUTIVO DA CARTEIRA (${comp} - Vencimentos ${sub.label}):**\n\n` +
        `1. **Prioridade Fiscal Imediata**: Focar na transmissão das declarações de apuração do Simples Nacional (PGDAS-D) e emissão das guias DAS até o dia 20 para evitar multas de mora aos clientes.\n` +
        `2. **Regularidade de Certidões e Alvarás**: Identificadas ${cndsAlertas.length} CNDs e ${alvarasAlertas.length} alvarás/licenças que exigem protocolo imediato de renovação para evitar travamento da atividade econômica dos clientes.\n` +
        `3. **Gestão do Contas a Receber**: Existem R$ ${totalAberto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em honorários com saldo em aberto. Recomendamos envio preventivo dos recibos com Chave PIX e cobrança cordial aos clientes com mais de 10 dias de atraso.\n` +
        `4. **Conformidade Trabalhista**: Fechamento tempestivo do eSocial e DCTFWeb antes do dia 15 para emissão do DARF Previdenciário.`;
    }

    this.state.diagnosticoIAResultado = {
      data_geracao: new Date().toISOString(),
      competencia: comp,
      conteudo: recomendacaoIA
    };

    this.showToast('Diagnóstico executivo gerado com sucesso!', 'success');
    this.renderContentOnly();
  },

  async enviarMensagemChatIA(e) {
    if (e && e.preventDefault) e.preventDefault();
    const input = document.getElementById('chat-ia-input');
    const texto = input ? input.value.trim() : '';
    if (!texto) return;

    if (!Array.isArray(this.state.chatIAHistorico)) {
      this.state.chatIAHistorico = [];
    }

    this.state.chatIAHistorico.push({
      autor: 'usuario',
      texto,
      hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    });
    if (input) input.value = '';
    this.renderContentOnly();

    let resposta = '';
    const respostaIA = await this.chamarIA(texto, 'Você é o Consultor Tributário e Contábil Inteligente da Zioto Contabilidade (Z-IA). Forneça orientações precisas, fundamentadas na legislação brasileira (Simples Nacional, Lucro Presumido, CLT, IRPJ/CSLL, DCTFWeb, eSocial, PGDAS e Licenciamento/Alvarás) com clareza executiva.');

    if (respostaIA) {
      resposta = respostaIA;
    } else {
      const t = texto.toLowerCase();
      if (t.includes('fator r')) {
        resposta = `**Fator R no Simples Nacional (Art. 18 da LC 123/2006):**\nO Fator R é a razão entre a folha de pagamento (incluindo pró-labore e encargos) dos últimos 12 meses e a receita bruta acumulada no mesmo período (Folha ÷ Receita Bruta).\n- **Se Fator R ≥ 28%**: A atividade tributa pelo **Anexo III** (alíquota inicial de 6%), resultando em grande economia tributária.\n- **Se Fator R < 28%**: A atividade tributa pelo **Anexo V** (alíquota inicial de 15,5%).\n*Dica ZGESTOR*: Recomendamos simular o aumento do Pró-Labore do sócio para atingir o índice de 28% quando a margem for próxima.`;
      } else if (t.includes('alvará') || t.includes('licença') || t.includes('pesca') || t.includes('sanitário')) {
        resposta = `**Gestão de Alvarás e Licenças Operacionais:**\n- **Alvará de Funcionamento**: Exigido para toda empresa com estabelecimento físico ou virtual, renovado anualmente pela Prefeitura Municipal.\n- **Vigilância Sanitária (VISA)**: Obrigatório para clínicas médicas, distribuidoras de alimentos, restaurantes e indústrias químicas.\n- **Certificado de Petrecho de Pesca**: Licença emitida pelo Ministério da Pesca / IBAMA para embarcações e armadores comerciais, com renovação vinculada a vistorias técnicas e pagamento de taxas anuais.\n*Controle no ZGESTOR*: Registre o protocolo de renovação na aba 'Alvarás & Licenças' para manter a empresa com status 'Em Renovação' e evitar multas.`;
      } else if (t.includes('mei') || t.includes('desenquadramento')) {
        resposta = `**Desenquadramento de MEI para ME (Microempresa):**\nOcorre quando o faturamento anual ultrapassa R$ 81.000,00 ou quando a empresa contrata mais de 1 funcionário ou inclui sócio.\n- **Até 20% de excesso (até R$ 97.200,00)**: O desenquadramento tem efeitos a partir de 1º de janeiro do ano seguinte.\n- **Acima de 20% (mais de R$ 97.200,00)**: O desenquadramento é retroativo a 1º de janeiro do ano do excesso, exigindo recalcular os tributos no Simples Nacional.`;
      } else if (t.includes('inadimplente') || t.includes('cobrança') || t.includes('honorário')) {
        resposta = `**Modelo de Notificação Cordial de Honorários:**\n"Prezado(a) [Nome do Cliente], esperamos que esteja bem!\nIdentificamos em nosso financeiro que a fatura de honorários contábeis ref. à competência [Mês/Ano] com vencimento em [Data] consta em aberto no valor de R$ [Valor].\nPara sua comodidade, você pode efetuar o pagamento diretamente via Chave PIX: [Chave PIX]. Caso já tenha realizado o pagamento, por favor desconsidere este aviso ou nos envie o comprovante. Permanecemos à disposição!\nAtenciosamente, Equipe Zioto Contabilidade."`;
      } else {
        resposta = `**Orientação Z-IA Contábil:**\nRecebemos sua consulta: "*${texto}*".\nPara esta operação, consulte a regularidade cadastral da empresa e certidões na Prefeitura, SEFAZ e e-CAC.\n*Dica*: Configure sua Chave de API da OpenAI (ChatGPT) ou Google Gemini para respostas em tempo real com raciocínio profundo.`;
      }
    }

    this.state.chatIAHistorico.push({
      autor: 'ia',
      texto: resposta,
      hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    });
    this.renderContentOnly();
  },

  enviarPerguntaSugeridaIA(texto) {
    const input = document.getElementById('chat-ia-input');
    if (input) input.value = texto;
    this.enviarMensagemChatIA();
  },

  limparChatIA() {
    this.state.chatIAHistorico = [];
    this.renderContentOnly();
  },

  gerarComunicadoIA() {
    const tipo = document.getElementById('comunicado-tipo')?.value || 'COBRANCA';
    const tom = document.getElementById('comunicado-tom')?.value || 'CORDIAL';
    const empId = document.getElementById('comunicado-empresa')?.value || '';
    const canal = document.getElementById('comunicado-canal')?.value || 'WHATSAPP';
    const db = window.zgestorDB;
    const emp = db.data.empresas.find(e => e.id === empId) || db.data.empresas[0];
    const esc = db.getEscritorioConfig();
    const chavePix = esc.chave_pix_padrao || esc.email_financeiro || 'financeiro@ziotocontabilidade.com.br';

    let msg = '';
    const clienteNome = emp ? (emp.responsavel_legal || emp.nome_fantasia) : 'Cliente';
    const empresaNome = emp ? emp.nome_fantasia : 'Sua Empresa';

    if (tipo === 'COBRANCA') {
      const valorHon = emp ? Number(emp.valor_honorario_padrao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00';
      msg = `Olá, ${clienteNome}! Tudo bem?\n\nPassando para lembrar que a fatura de honorários contábeis da *${empresaNome}* ref. a este mês já está disponível para pagamento no valor de *R$ ${valorHon}*.\n\nPara facilitar, você pode pagar direto via Chave PIX:\n🔑 *${chavePix}*\n\nQualquer dúvida estamos à disposição!\nEquipe ${esc.nome_escritorio}.`;
    } else if (tipo === 'GUIAS') {
      msg = `Prezado(a) ${clienteNome},\n\nInformamos que as guias de impostos (DAS / DARF / FGTS) da empresa *${empresaNome}* relativas à competência atual já foram apuradas e estão disponíveis no seu Portal do Cliente.\n\nLembramos que o vencimento ocorre nos próximos dias. Evite juros e multas efetuando o pagamento até a data limite.\n\nAtenciosamente,\n${esc.nome_escritorio}`;
    } else {
      msg = `Olá, ${clienteNome}!\n\nEstamos realizando o fechamento contábil e fiscal do mês da *${empresaNome}*.\n\nPedimos a gentileza de nos enviar através do Portal do Cliente ou por aqui os extratos bancários (em formato .OFX ou .PDF) e os comprovantes de pagamento do período.\n\nMuito obrigado pela colaboração!\nEquipe ${esc.nome_escritorio}`;
    }

    this.state.comunicadoIAGerado = {
      tipo,
      tom,
      canal,
      telefone: emp ? emp.telefone : '',
      texto: msg
    };
    this.renderContentOnly();
  },

  copiarTextoComunicadoIA() {
    if (!this.state.comunicadoIAGerado || !this.state.comunicadoIAGerado.texto) {
      this.showToast('Nenhum comunicado gerado para copiar.', 'error');
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(this.state.comunicadoIAGerado.texto);
    }
    this.showToast('Texto do comunicado copiado para a área de transferência!', 'success');
  },

  abrirWhatsAppComunicadoIA() {
    if (!this.state.comunicadoIAGerado || !this.state.comunicadoIAGerado.texto) {
      this.showToast('Gere o comunicado antes de abrir no WhatsApp.', 'error');
      return;
    }
    const tel = (this.state.comunicadoIAGerado.telefone || '').replace(/\D/g, '');
    const url = tel ? `https://wa.me/55${tel}?text=${encodeURIComponent(this.state.comunicadoIAGerado.texto)}` : `https://wa.me/?text=${encodeURIComponent(this.state.comunicadoIAGerado.texto)}`;
    window.open(url, '_blank');
  },

  gerarRespostaChamadoIA(registroId) {
    const db = window.zgestorDB;
    const r = (db.data.central_cliente_registros || []).find(x => x.id === registroId);
    if (!r) return;

    let sugestao = '';
    const desc = (r.descricao || '').toLowerCase();
    if (desc.includes('guia') || desc.includes('imposto') || desc.includes('das')) {
      sugestao = `Olá! A guia solicitada já foi verificada e disponibilizada na aba 'Guias de Impostos' do seu Portal com todos os códigos de barras e QR Code PIX para pagamento tempestivo.`;
    } else if (desc.includes('cnd') || desc.includes('certidão')) {
      sugestao = `Olá! Realizamos a emissão e validação da certidão negativa solicitada. O arquivo PDF oficial já se encontra anexado na aba 'Controle de CNDs' do seu Portal.`;
    } else if (desc.includes('alvará') || desc.includes('licença')) {
      sugestao = `Olá! A documentação do alvará solicitado foi localizada e anexada na aba 'Alvarás & Licenças' do seu Portal com a respectiva certidão de regularidade.`;
    } else {
      sugestao = `Prezado(a) cliente, confirmamos o recebimento de sua solicitação referente a "${r.titulo}". Nossa equipe técnica contábil já realizou a análise necessária e o procedimento foi concluído com sucesso.`;
    }

    r.resposta_contabilidade = sugestao;
    r.status = 'CONCLUIDO';
    db.saveLocalData();
    this.showToast('Resposta gerada pela IA aplicada com sucesso!', 'success');
    this.renderContentOnly();
  },

  // ===========================================================================
  // MÓDULO DE ALVARÁS & LICENÇAS OPERACIONAIS
  // ===========================================================================
  setFiltroAlvaraEmpresa(empId) {
    this.state.filtroAlvaraEmpresa = empId;
    this.renderContentOnly();
  },

  setFiltroAlvaraTipo(tipo) {
    this.state.filtroAlvaraTipo = tipo;
    this.renderContentOnly();
  },

  setFiltroAlvaraStatus(status) {
    this.state.filtroAlvaraStatus = status;
    this.renderContentOnly();
  },

  setFiltroAlvaraBusca(busca) {
    this.state.filtroAlvaraBusca = busca;
    this.renderContentOnly();
  },

  openModalNovoAlvara(alvaraId = null, empresaPre = null) {
    const db = window.zgestorDB;
    const empresas = db.data.empresas || [];
    const alv = alvaraId ? (db.data.alvaras || []).find(a => a.id === alvaraId) : null;
    const empPadrao = empresaPre || (alv ? alv.empresa_id : (empresas[0]?.id || ''));

    const modal = document.getElementById('modal-root');
    if (!modal) return;

    modal.innerHTML = `
      <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 class="text-base font-bold text-slate-900">
                ${alv ? 'Editar Alvará / Licença' : 'Cadastrar Novo Alvará ou Licença'}
              </h3>
              <p class="text-xs text-slate-500">Alvarás de funcionamento, vigilância sanitária, petrechos de pesca e licenças</p>
            </div>
            <button onclick="ZGestorApp.closeModal()" class="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
          </div>

          <form onsubmit="ZGestorApp.submitFormAlvara(event)" class="space-y-3.5 mt-4 text-xs">
            <input type="hidden" id="f-alv-id" value="${alv ? alv.id : ''}" />

            <div>
              <label class="block font-bold text-slate-700 mb-1">Empresa Vinculada *</label>
              <select id="f-alv-empresa" required class="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white font-semibold">
                <option value="">Selecione a empresa...</option>
                ${empresas.map(e => `
                  <option value="${e.id}" ${e.id === empPadrao ? 'selected' : ''}>
                    #${e.codigo_interno} — ${e.nome_fantasia} (CNPJ: ${e.cnpj})
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Tipo de Licença *</label>
                <select id="f-alv-tipo" onchange="ZGestorApp.aoTrocarTipoAlvara(this.value)" class="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white font-medium">
                  <option value="FUNCIONAMENTO" ${alv?.tipo === 'FUNCIONAMENTO' ? 'selected' : ''}>Alvará de Funcionamento (Prefeitura)</option>
                  <option value="SANITARIO" ${alv?.tipo === 'SANITARIO' ? 'selected' : ''}>Vigilância Sanitária (VISA)</option>
                  <option value="PESCA" ${alv?.tipo === 'PESCA' ? 'selected' : ''}>Certificado de Petrecho de Pesca</option>
                  <option value="BOMBEIROS" ${alv?.tipo === 'BOMBEIROS' ? 'selected' : ''}>Corpo de Bombeiros (AVCB / CLCB)</option>
                  <option value="AMBIENTAL" ${alv?.tipo === 'AMBIENTAL' ? 'selected' : ''}>Licença Ambiental</option>
                  <option value="OUTRO" ${alv?.tipo === 'OUTRO' || !alv ? 'selected' : ''}>Outra Licença Específica</option>
                </select>
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1">Nome / Identificação do Alvará *</label>
                <input
                  id="f-alv-nome"
                  type="text"
                  required
                  value="${escapeHtml(alv ? alv.nome : 'Alvará de Licença e Funcionamento')}"
                  placeholder="Ex: Certificado de Petrecho de Pesca nº 402"
                  class="w-full rounded-xl border border-slate-300 px-3 py-2 font-semibold"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Órgão Emissor Competente *</label>
                <input
                  id="f-alv-orgao"
                  type="text"
                  required
                  value="${escapeHtml(alv ? alv.orgao_emissor : 'Prefeitura Municipal')}"
                  placeholder="Ex: Ministério da Pesca / IBAMA ou Vigilância Sanitária"
                  class="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1">Nº do Alvará / Inscrição / Processo</label>
                <input
                  id="f-alv-numero"
                  type="text"
                  value="${escapeHtml(alv?.numero_documento || '')}"
                  placeholder="Ex: 2026-ALV-9842"
                  class="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Data de Emissão</label>
                <input
                  id="f-alv-emissao"
                  type="date"
                  value="${alv?.data_emissao || ''}"
                  class="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1">Data de Vencimento / Renovação</label>
                <input
                  id="f-alv-vencimento"
                  type="date"
                  value="${alv?.data_vencimento || ''}"
                  ${alv?.indeterminado ? 'disabled' : ''}
                  class="w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                />
                <label class="inline-flex items-center gap-1.5 mt-1.5 text-[11px] text-slate-600 cursor-pointer">
                  <input
                    id="f-alv-indeterminado"
                    type="checkbox"
                    ${alv?.indeterminado ? 'checked' : ''}
                    onchange="document.getElementById('f-alv-vencimento').disabled = this.checked;"
                    class="rounded text-indigo-600"
                  />
                  <span>Validade Indeterminada / Isento de Renovação Anual</span>
                </label>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Status Operacional</label>
                <select id="f-alv-status" class="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white font-bold">
                  <option value="VIGENTE" ${alv?.status === 'VIGENTE' ? 'selected' : ''}>Vigente / Regular</option>
                  <option value="EM_RENOVACAO" ${alv?.status === 'EM_RENOVACAO' ? 'selected' : ''}>Em Processo de Renovação</option>
                  <option value="VENCENDO" ${alv?.status === 'VENCENDO' ? 'selected' : ''}>Vencendo em breve</option>
                  <option value="VENCIDO" ${alv?.status === 'VENCIDO' ? 'selected' : ''}>Vencido / Expirado</option>
                  <option value="DISPENSADO" ${alv?.status === 'DISPENSADO' ? 'selected' : ''}>Dispensado / Não Aplicável</option>
                </select>
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1">Protocolo de Renovação (se houver)</label>
                <input
                  id="f-alv-protocolo"
                  type="text"
                  value="${escapeHtml(alv?.protocolo_renovacao || '')}"
                  placeholder="Ex: PROT-2026/89412"
                  class="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-blue-700 font-bold"
                />
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Anexar Documento do Alvará (PDF ou Imagem até 15MB)</label>
              <input
                id="f-alv-arquivo"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                class="w-full rounded-xl border border-slate-300 px-3 py-2 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
              />
              ${alv?.anexo_nome ? `
                <div class="mt-1 text-[11px] text-emerald-700 flex items-center gap-1 font-semibold">
                  <i data-lucide="check" class="w-3.5 h-3.5"></i>
                  Arquivo atual anexado: ${escapeHtml(alv.anexo_nome)}
                </div>
              ` : ''}
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Observações e Exigências do Órgão</label>
              <textarea
                id="f-alv-obs"
                rows="2"
                placeholder="Ex: Vistoria anual agendada para novembro. Apresentar laudo técnico e taxa paga."
                class="w-full rounded-xl border border-slate-300 px-3 py-2"
              >${escapeHtml(alv?.observacoes || '')}</textarea>
            </div>

            <div class="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
              <button
                type="button"
                onclick="ZGestorApp.closeModal()"
                class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition cursor-pointer">
                Cancelar
              </button>
              <button
                type="submit"
                class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition cursor-pointer">
                <i data-lucide="save" class="w-4 h-4"></i>
                Salvar Alvará
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  },

  aoTrocarTipoAlvara(tipo) {
    const nomeInput = document.getElementById('f-alv-nome');
    const orgaoInput = document.getElementById('f-alv-orgao');
    if (!nomeInput || !orgaoInput) return;

    if (tipo === 'FUNCIONAMENTO') {
      nomeInput.value = 'Alvará de Licença e Funcionamento';
      orgaoInput.value = 'Prefeitura Municipal';
    } else if (tipo === 'SANITARIO') {
      nomeInput.value = 'Alvará da Vigilância Sanitária (VISA)';
      orgaoInput.value = 'Vigilância Sanitária Municipal/Estadual';
    } else if (tipo === 'PESCA') {
      nomeInput.value = 'Certificado de Registro de Petrecho de Pesca';
      orgaoInput.value = 'Ministério da Pesca e Aquicultura / IBAMA';
    } else if (tipo === 'BOMBEIROS') {
      nomeInput.value = 'Auto de Vistoria do Corpo de Bombeiros (AVCB)';
      orgaoInput.value = 'Corpo de Bombeiros Militar';
    } else if (tipo === 'AMBIENTAL') {
      nomeInput.value = 'Licença Ambiental de Operação (LO)';
      orgaoInput.value = 'Órgão Ambiental Estadual / Municipal';
    }
  },

  async submitFormAlvara(e) {
    e.preventDefault();
    try {
      const db = window.zgestorDB;
      const id = document.getElementById('f-alv-id')?.value || null;
      const empresaId = document.getElementById('f-alv-empresa').value;
      const tipo = document.getElementById('f-alv-tipo').value;
      const nome = document.getElementById('f-alv-nome').value.trim();
      const orgao = document.getElementById('f-alv-orgao').value.trim();
      const numero = document.getElementById('f-alv-numero').value.trim();
      const emissao = document.getElementById('f-alv-emissao').value;
      const vencimento = document.getElementById('f-alv-vencimento').value;
      const indeterminado = document.getElementById('f-alv-indeterminado').checked;
      const status = document.getElementById('f-alv-status').value;
      const protocolo = document.getElementById('f-alv-protocolo').value.trim();
      const obs = document.getElementById('f-alv-obs').value.trim();

      const fileInput = document.getElementById('f-alv-arquivo');
      let anexoNome = null;
      let anexoTamanho = null;
      let anexoBase64 = null;

      if (fileInput && fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        const val = this.validarArquivoUpload(file, ['.pdf', '.png', '.jpg', '.jpeg'], 15);
        if (!val.valido) throw new Error(val.erro);
        anexoNome = file.name;
        anexoTamanho = file.size;
        anexoBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      const dados = {
        id,
        empresa_id: empresaId,
        tipo,
        nome,
        orgao_emissor: orgao,
        numero_documento: numero,
        data_emissao: emissao || null,
        data_vencimento: indeterminado ? null : (vencimento || null),
        indeterminado,
        status,
        protocolo_renovacao: protocolo,
        observacoes: obs
      };

      if (anexoBase64) {
        dados.anexo_nome = anexoNome;
        dados.anexo_tamanho = anexoTamanho;
        dados.anexo_base64 = anexoBase64;
      }

      db.salvarAlvara(dados);
      this.closeModal();
      this.showToast(`Alvará "${nome}" salvo com sucesso!`, 'success');
      this.renderAll();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  excluirAlvara(alvaraId) {
    if (!confirm('Deseja realmente remover este alvará do sistema?')) return;
    window.zgestorDB.excluirAlvara(alvaraId);
    this.showToast('Alvará excluído com sucesso.', 'info');
    this.renderContentOnly();
  },

  abrirModalProtocoloAlvara(alvaraId) {
    const db = window.zgestorDB;
    const alv = (db.data.alvaras || []).find(a => a.id === alvaraId);
    if (!alv) return;

    const modal = document.getElementById('modal-root');
    if (!modal) return;

    modal.innerHTML = `
      <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 class="text-base font-bold text-slate-900">Registrar Protocolo de Renovação</h3>
              <p class="text-xs text-slate-500">${escapeHtml(alv.nome)}</p>
            </div>
            <button onclick="ZGestorApp.closeModal()" class="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
          </div>

          <form onsubmit="ZGestorApp.submitProtocoloAlvara(event, '${alv.id}')" class="space-y-3.5 mt-4 text-xs">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Número do Protocolo do Pedido de Renovação *</label>
              <input
                id="f-prot-num"
                type="text"
                required
                value="${escapeHtml(alv.protocolo_renovacao || '')}"
                placeholder="Ex: 2026-PROT-109283"
                class="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono font-bold text-blue-700"
              />
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Data do Protocolo *</label>
              <input
                id="f-prot-data"
                type="date"
                required
                value="${alv.data_protocolo || new Date().toISOString().slice(0, 10)}"
                class="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Observações da Renovação</label>
              <textarea
                id="f-prot-obs"
                rows="2"
                placeholder="Ex: Protocolo aberto na Prefeitura. Aguardando emissão da DAM."
                class="w-full rounded-xl border border-slate-300 px-3 py-2"
              ></textarea>
            </div>

            <div class="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-[11px]">
              Ao salvar o protocolo, o status do alvará mudará automaticamente para <strong>"Em Renovação"</strong>, resguardando o cliente em caso de fiscalização.
            </div>

            <div class="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onclick="ZGestorApp.closeModal()"
                class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition cursor-pointer">
                Cancelar
              </button>
              <button
                type="submit"
                class="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-600/20 flex items-center gap-1.5 transition cursor-pointer">
                <i data-lucide="check" class="w-4 h-4"></i>
                Salvar Protocolo
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  },

  submitProtocoloAlvara(e, alvaraId) {
    e.preventDefault();
    const protocolo = document.getElementById('f-prot-num').value.trim();
    const dataProt = document.getElementById('f-prot-data').value;
    const obs = document.getElementById('f-prot-obs').value.trim();

    window.zgestorDB.registrarProtocoloAlvara(alvaraId, protocolo, dataProt, obs);
    this.closeModal();
    this.showToast('Protocolo de renovação gravado com sucesso!', 'success');
    this.renderContentOnly();
  },

  baixarArquivoAlvara(alvaraId) {
    const db = window.zgestorDB;
    const alv = (db.data.alvaras || []).find(a => a.id === alvaraId);
    if (!alv || !alv.anexo_base64) {
      this.showToast('Nenhum arquivo anexado a este alvará.', 'error');
      return;
    }

    const link = document.createElement('a');
    link.href = alv.anexo_base64;
    link.download = alv.anexo_nome || `Alvara_${alv.tipo}.pdf`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showToast(`Download iniciado: ${link.download}`, 'success');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  window.ZGestorApp.init();
});
