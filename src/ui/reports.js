// =============================================================================
// ZGESTOR - Motor de Emissão de Relatórios Gerenciais (Todas as Abas, incluindo
// Controle de CNDs e Central do Cliente 360°) e Impressão de Recibos PIX
// - Paginação A4 individual: 1 recibo por página A4 com break-after: page
//   e break-inside: avoid para nunca cortar ou misturar recibos.
// =============================================================================

window.ZGestorReports = {
  abrirJanelaImpressao(tituloJanela, conteudoHtml) {
    const win = window.open('', '_blank', 'width=1060,height=840');
    if (!win) {
      window.ZGestorApp.showToast('Permita pop-ups no navegador para abrir a tela de impressão.', 'error');
      return;
    }

    const htmlCompleto = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>${tituloJanela}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-family: 'Inter', sans-serif; color: #0f172a; background: #f1f5f9; margin: 0; }
          .recibo-card {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .print-sheet {
            break-after: page;
            page-break-after: always;
          }
          .print-sheet:last-child {
            break-after: auto;
            page-break-after: auto;
          }
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }
          @media print {
            html, body {
              background: #ffffff !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .no-print { display: none !important; }
            .print-page {
              box-shadow: none !important;
              border: none !important;
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
            }
            .recibo-card {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
              margin-bottom: 6mm !important;
            }
            .print-sheet {
              break-after: page !important;
              page-break-after: always !important;
              break-inside: avoid !important;
              page-break-inside: avoid !important;
              padding-top: 2mm;
            }
            .print-sheet:last-child {
              break-after: auto !important;
              page-break-after: auto !important;
            }
            tr {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
          }
        </style>
      </head>
      <body class="p-4 md:p-6">
        <!-- Barra de Ações (Não sai na impressão) -->
        <div class="no-print max-w-4xl mx-auto mb-5 bg-slate-900 text-white p-4 rounded-2xl shadow-lg flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="text-xs font-bold uppercase text-indigo-400">Visualização de Impressão A4 / PDF — ZGESTOR</div>
            <div class="text-sm font-bold">${tituloJanela}</div>
            <div class="text-[11px] text-slate-300 mt-0.5">Paginação protegida: nenhum recibo ou bloco é cortado ao meio na troca de página.</div>
          </div>
          <div class="flex items-center gap-2.5">
            <button onclick="window.print()" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow cursor-pointer">
              🖨️ Imprimir / Salvar em PDF
            </button>
            <button onclick="window.close()" class="px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold cursor-pointer">
              Fechar
            </button>
          </div>
        </div>

        <!-- Conteúdo Imprimível -->
        <div class="print-page max-w-4xl mx-auto bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          ${conteudoHtml}
        </div>
      </body>
      </html>
    `;

    win.document.open();
    win.document.write(htmlCompleto);
    win.document.close();
  },

  formatarEnderecoRecibo(esc) {
    if (window.zgestorDB && typeof window.zgestorDB.formatarEnderecoCompletoEscritorio === 'function') {
      return window.zgestorDB.formatarEnderecoCompletoEscritorio(esc);
    }
    return `${esc.endereco_escritorio || ''} — ${esc.cidade_uf || ''}`;
  },

  cabecalhoPadraoRelatorio(tituloRelatorio, subtitulo) {
    const esc = window.zgestorDB.getEscritorioConfig();
    const agora = new Date().toLocaleString('pt-BR');
    const user = window.zgestorDB.getCurrentUser();

    return `
      <div class="border-b-2 border-slate-800 pb-4 mb-5 flex justify-between items-start gap-4">
        <div>
          <div class="text-xs font-extrabold uppercase tracking-wider text-indigo-700">${esc.nome_escritorio}</div>
          <div class="text-[11px] text-slate-500">CNPJ: ${esc.cnpj_escritorio} • ${esc.crc_escritorio} • ${esc.telefone_escritorio}</div>
          <div class="text-[10.5px] text-slate-500">${this.formatarEnderecoRecibo(esc)}</div>
          <h1 class="text-lg font-extrabold text-slate-900 mt-1.5">${tituloRelatorio}</h1>
          <p class="text-xs text-slate-600 font-medium">${subtitulo}</p>
        </div>
        <div class="text-right text-[11px] text-slate-500 shrink-0">
          <div><strong>Emissão:</strong> ${agora}</div>
          <div><strong>Emitido por:</strong> ${user.nome}</div>
        </div>
      </div>
    `;
  },

  // ===========================================================================
  // RECIBO DE COBRANÇA DE HONORÁRIOS VIA PIX (INDIVIDUAL E EM LOTE)
  // ===========================================================================
  gerarBlocoReciboPix(hon, emp, esc, numeroRecibo) {
    const V = window.ZGestorViews;
    esc = esc || window.zgestorDB.getEscritorioConfig();
    if (emp === undefined && hon.empresa_id) {
      emp = window.zgestorDB.obterEmpresaSegura ? window.zgestorDB.obterEmpresaSegura(hon.empresa_id, hon) : window.zgestorDB.data.empresas.find(e => e.id === hon.empresa_id);
    }
    numeroRecibo = numeroRecibo || `${String(hon.competencia || '').replace('/', '')}-01`;
    const saldoAnterior = Number(hon.saldo_anterior || 0);
    const compAnterior = hon.competencia_saldo_anterior || window.zgestorDB.obterCompetenciaAnterior(hon.competencia);
    const compExibicao = hon.competencia_referencia || hon.competencia;
    const descricaoItem = String(hon.descricao_cobranca || 'HONORÁRIO MENSAL').trim() || 'HONORÁRIO MENSAL';
    const totalBruto = Math.max(0, Number(hon.valor_mensal || 0) + saldoAnterior + Number(hon.servicos_extras || 0) - Number(hon.desconto || 0));
    const valorCobrar = (hon.status === 'PAGO') ? 0 : Math.max(0, Number(hon.saldo_aberto !== undefined ? hon.saldo_aberto : totalBruto));
    const pags = window.zgestorDB.data.honorario_pagamentos.filter(p => p.honorario_id === hon.id);

    // Canal de recebimento definido no lançamento ou para a empresa (PIX Principal, Secundário ou Autônomo)
    const canal = hon.canal_pagamento || (emp && emp.canal_pagamento_padrao) || 'PIX_PRINCIPAL';
    let contaPix = esc.pix_principal || {
      nome: 'Conta PJ Principal',
      banco: esc.banco_pix || 'Banco Inter / Itaú Empresas',
      tipo_chave: esc.tipo_chave_pix || 'CNPJ',
      chave_pix: esc.chave_pix || esc.cnpj_escritorio,
      favorecido: esc.favorecido_pix || esc.nome_escritorio,
      qrcode_img: esc.qrcode_img || ''
    };

    if (canal === 'PIX_SECUNDARIO' && esc.pix_secundario) {
      contaPix = esc.pix_secundario;
    } else if (canal === 'PIX_AUTONOMO' && esc.pix_autonomo) {
      contaPix = esc.pix_autonomo;
    }

    const qrImageSrc = contaPix.qrcode_img || (canal === 'PIX_PRINCIPAL' ? (esc.qrcode_img || '') : '');
    const nomeTomador = emp ? emp.razao_social : (hon.nome_cliente || 'Cliente Avulso');
    const subtituloTomador = emp
      ? `Fantasia: ${emp.nome_fantasia || '—'} • Resp.: ${emp.responsavel_legal || '—'}`
      : 'Cobrança / Recibo Avulso';
    const docTomador = emp ? emp.cnpj : (hon.documento_cliente || '—');
    const regimeTomador = emp ? emp.regime_tributario : (hon.cliente_avulso ? 'Avulso' : '');

    return `
      <div class="recibo-card border-2 border-slate-800 rounded-xl p-4 mb-4 bg-white">
        <div class="flex justify-between items-start border-b border-slate-300 pb-2.5 gap-3">
          <div>
            <div class="text-xs font-extrabold text-slate-900 uppercase tracking-tight">${esc.nome_escritorio}</div>
            <div class="text-[11px] text-slate-600">CNPJ: ${esc.cnpj_escritorio} • Registro: ${esc.crc_escritorio}</div>
            <div class="text-[11px] text-slate-500">${V.escapeHtml(this.formatarEnderecoRecibo(esc))}</div>
            <div class="text-[11px] text-slate-500">Tel/WhatsApp: ${esc.telefone_escritorio} | ${esc.email_escritorio}</div>
          </div>
          <div class="text-right bg-slate-100 px-3 py-2 rounded-lg border border-slate-300 min-w-[205px]">
            <div class="text-[10px] font-bold uppercase text-slate-500">Recibo / Cobrança Nº ${numeroRecibo}</div>
            <div class="text-[11px] font-bold text-slate-800">Competência: <span class="text-indigo-700">${V.escapeHtml(compExibicao)}</span></div>
            <div class="text-[11px] font-bold text-rose-700">Vencimento: ${V.formatDate(hon.data_vencimento)}</div>
            <div class="text-sm font-extrabold text-slate-900 mt-1 pt-1 border-t border-slate-300">
              Total a Pagar: ${V.formatCurrency(valorCobrar)}
            </div>
          </div>
        </div>

        <div class="mt-2.5 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-[11px] grid grid-cols-3 gap-2">
          <div class="col-span-2">
            <span class="text-slate-500 uppercase font-bold text-[9px] block">Cliente / Empresa:</span>
            <strong class="text-slate-900 text-xs">${V.escapeHtml(nomeTomador)}</strong>
            <span class="text-slate-600 block">${V.escapeHtml(subtituloTomador)}</span>
          </div>
          <div>
            <span class="text-slate-500 uppercase font-bold text-[9px] block">CPF/CNPJ / Regime:</span>
            <strong class="text-slate-900 font-mono">${V.escapeHtml(docTomador)}</strong>
            <span class="text-slate-600 block">${V.escapeHtml(regimeTomador)}</span>
          </div>
        </div>

        <div class="mt-2.5">
          <table class="w-full text-[11px] border-collapse">
            <thead>
              <tr class="border-b border-slate-300 text-slate-600 uppercase text-[9px]">
                <th class="py-1 text-left">Descrição da Cobrança Contábil</th>
                <th class="py-1 text-center">Competência</th>
                <th class="py-1 text-center">Vencimento</th>
                <th class="py-1 text-right">Valor</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${Number(hon.valor_mensal || 0) === 0 && saldoAnterior > 0 ? `
                <tr>
                  <td class="py-1.5 font-bold text-slate-800">
                    ${V.escapeHtml(descricaoItem)}
                    <span class="block text-[9.5px] font-semibold text-amber-800">Saldo remanescente em aberto ref. competência ${V.escapeHtml(hon.competencia_referencia || compAnterior)}</span>
                  </td>
                  <td class="py-1.5 text-center font-bold">${V.escapeHtml(compExibicao)}</td>
                  <td class="py-1.5 text-center">${V.formatDate(hon.data_vencimento)}</td>
                  <td class="py-1.5 text-right font-semibold">${V.formatCurrency(saldoAnterior)}</td>
                </tr>
              ` : `
                <tr>
                  <td class="py-1.5 font-bold text-slate-800">${V.escapeHtml(descricaoItem)}</td>
                  <td class="py-1.5 text-center font-bold">${V.escapeHtml(compExibicao)}</td>
                  <td class="py-1.5 text-center">${V.formatDate(hon.data_vencimento)}</td>
                  <td class="py-1.5 text-right font-semibold">${V.formatCurrency(hon.valor_mensal)}</td>
                </tr>
                ${saldoAnterior > 0 ? `
                  <tr class="bg-amber-50/70">
                    <td class="py-1.5 font-bold text-amber-900">(+) Saldo Remanescente em Aberto do Mês Anterior (Comp. ${compAnterior})</td>
                    <td class="py-1.5 text-center font-bold text-amber-900">${compAnterior}</td>
                    <td class="py-1.5 text-center text-amber-800">Acumulado</td>
                    <td class="py-1.5 text-right font-bold text-amber-900">+ ${V.formatCurrency(saldoAnterior)}</td>
                  </tr>
                ` : ''}
              `}
              ${Number(hon.servicos_extras) > 0 ? `
                <tr>
                  <td class="py-1.5 text-slate-700">(+) Serviços Extras / Taxas / Solicitações Avulsas no Mês</td>
                  <td class="py-1.5 text-center">${hon.competencia}</td>
                  <td class="py-1.5 text-center">${V.formatDate(hon.data_vencimento)}</td>
                  <td class="py-1.5 text-right font-semibold text-indigo-700">+ ${V.formatCurrency(hon.servicos_extras)}</td>
                </tr>
              ` : ''}
              ${Number(hon.desconto) > 0 ? `
                <tr>
                  <td class="py-1.5 text-slate-700">(-) Desconto Concedido na Competência</td>
                  <td class="py-1.5 text-center">${hon.competencia}</td>
                  <td class="py-1.5 text-center">—</td>
                  <td class="py-1.5 text-right font-semibold text-emerald-700">- ${V.formatCurrency(hon.desconto)}</td>
                </tr>
              ` : ''}
              ${Number(hon.valor_pago) > 0 && Number(hon.saldo_aberto) > 0 ? `
                <tr>
                  <td class="py-1.5 text-emerald-800 font-medium">(-) Pagamentos Parciais Recebidos (${pags.map(p => `${V.formatDate(p.data_pagamento)}: ${V.formatCurrency(p.valor)}`).join('; ')})</td>
                  <td class="py-1.5 text-center">${hon.competencia}</td>
                  <td class="py-1.5 text-center">Abatido</td>
                  <td class="py-1.5 text-right font-bold text-emerald-700">- ${V.formatCurrency(hon.valor_pago)}</td>
                </tr>
              ` : ''}
            </tbody>
            <tfoot>
              <tr class="border-t-2 border-slate-800 bg-slate-50 font-extrabold text-xs">
                <td colspan="3" class="py-1.5 px-2 text-right uppercase">Valor Total Líquido a Pagar até ${V.formatDate(hon.data_vencimento)}:</td>
                <td class="py-1.5 px-2 text-right text-sm text-slate-900">${V.formatCurrency(valorCobrar)}</td>
              </tr>
            </tfoot>
          </table>
          ${hon.observacoes ? `<div class="mt-1 text-[10px] text-slate-600"><strong>Observações:</strong> ${hon.observacoes}</div>` : ''}
        </div>

        <div class="mt-2.5 px-3.5 py-2.5 rounded-lg bg-emerald-50 border border-emerald-600 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <!-- Espaço e Imagem do QR Code PIX Oficial do Escritório -->
            <div class="w-24 h-24 bg-white p-1 rounded-lg border border-emerald-400 flex flex-col items-center justify-center shrink-0 shadow-xs overflow-hidden">
              ${qrImageSrc ? `
                <img src="${qrImageSrc}" style="image-rendering:crisp-edges;image-rendering:pixelated;" class="w-20 h-20 object-contain" alt="QR Code PIX Oficial" />
                <span class="text-[7px] font-extrabold text-emerald-900 tracking-tighter uppercase mt-0.5">PIX OFICIAL</span>
              ` : `
                <svg class="w-16 h-16" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100" height="100" fill="white"/>
                  <!-- Top-left finder pattern -->
                  <rect x="10" y="10" width="24" height="24" rx="2" fill="#065f46"/>
                  <rect x="14" y="14" width="16" height="16" fill="white"/>
                  <rect x="18" y="18" width="8" height="8" rx="1" fill="#065f46"/>
                  <!-- Top-right finder pattern -->
                  <rect x="66" y="10" width="24" height="24" rx="2" fill="#065f46"/>
                  <rect x="70" y="14" width="16" height="16" fill="white"/>
                  <rect x="74" y="18" width="8" height="8" rx="1" fill="#065f46"/>
                  <!-- Bottom-left finder pattern -->
                  <rect x="10" y="66" width="24" height="24" rx="2" fill="#065f46"/>
                  <rect x="14" y="70" width="16" height="16" fill="white"/>
                  <rect x="18" y="74" width="8" height="8" rx="1" fill="#065f46"/>
                  <!-- Pix modules -->
                  <rect x="40" y="12" width="6" height="6" fill="#047857"/>
                  <rect x="52" y="12" width="6" height="6" fill="#047857"/>
                  <rect x="44" y="22" width="10" height="6" fill="#047857"/>
                  <rect x="12" y="42" width="8" height="6" fill="#047857"/>
                  <rect x="26" y="44" width="6" height="8" fill="#047857"/>
                  <rect x="40" y="38" width="20" height="20" rx="3" fill="#059669"/>
                  <!-- Center Pix emblem -->
                  <path d="M47 50L50 47L53 50L50 53Z" fill="white"/>
                  <rect x="68" y="42" width="6" height="10" fill="#047857"/>
                  <rect x="80" y="42" width="8" height="6" fill="#047857"/>
                  <rect x="40" y="68" width="8" height="6" fill="#047857"/>
                  <rect x="54" y="68" width="6" height="10" fill="#047857"/>
                  <rect x="68" y="68" width="6" height="6" fill="#047857"/>
                  <rect x="80" y="76" width="8" height="8" fill="#047857"/>
                  <rect x="44" y="82" width="18" height="6" fill="#047857"/>
                </svg>
                <span class="text-[7.5px] font-extrabold text-emerald-900 tracking-tighter uppercase">PIX QR CODE</span>
              `}
            </div>
            <div class="space-y-0.5">
              <div class="text-[10px] font-extrabold uppercase text-emerald-900">
                💠 PAGAMENTO EXCLUSIVO VIA CHAVE PIX (QR CODE OU CHAVE ${contaPix.tipo_chave || 'CNPJ'})
              </div>
              <div class="text-xs font-bold text-slate-900">
                Chave PIX (${contaPix.tipo_chave || 'CNPJ'}): <span class="font-mono text-sm bg-white px-2 py-0.5 rounded border border-emerald-400 text-emerald-900 font-extrabold">${contaPix.chave_pix}</span>
                <span class="text-[10px] text-emerald-800 font-semibold ml-1">(${contaPix.nome || 'Conta Oficial'})</span>
              </div>
              <div class="text-[11px] text-slate-700">
                <strong>Favorecido:</strong> ${contaPix.favorecido || esc.favorecido_pix} • <strong>Instituição:</strong> ${contaPix.banco || esc.banco_pix}
              </div>
              <div class="text-[10px] text-slate-600">${esc.mensagem_recibo}</div>
            </div>
          </div>
          <div class="text-right shrink-0 border-l border-emerald-300 pl-3">
            <div class="text-[9px] font-bold uppercase text-emerald-800">Transferência PIX</div>
            <div class="text-base font-extrabold text-emerald-900">${V.formatCurrency(valorCobrar)}</div>
            <div class="text-[10px] text-slate-600">Venc.: ${V.formatDate(hon.data_vencimento)}</div>
          </div>
        </div>

        <div class="mt-2.5 pt-2 border-t border-dashed border-slate-400 flex items-end justify-between gap-4 text-[10px] text-slate-600">
          <div>
            Recebi(emos) o recibo de cobrança ref. à competência <strong>${V.escapeHtml(compExibicao)}</strong> (Venc. <strong>${V.formatDate(hon.data_vencimento)}</strong>).
          </div>
          <div class="flex gap-4 shrink-0">
            <div>Data: ____/____/______</div>
            <div>Assinatura: ______________________________________</div>
          </div>
        </div>
      </div>
    `;
  },

  imprimirReciboHonorarioPix(honorarioId) {
    const db = window.zgestorDB;
    db.sincronizarSaldosAnterioresHonorarios(window.ZGestorApp?.state?.competencia);
    const hon = db.data.honorarios.find(h => h.id === honorarioId);
    if (!hon) return;
    const saldoAberto = Number(hon.saldo_aberto !== undefined ? hon.saldo_aberto : hon.valor_mensal);
    if (saldoAberto <= 0 || hon.status === 'PAGO') {
      if (window.ZGestorApp?.showToast) {
        window.ZGestorApp.showToast('Este honorário já se encontra quitado (sem saldo em aberto a cobrar).', 'info');
      }
      return;
    }
    const emp = hon.empresa_id ? (db.obterEmpresaSegura ? db.obterEmpresaSegura(hon.empresa_id, hon) : db.data.empresas.find(e => e.id === hon.empresa_id)) : null;
    const esc = db.getEscritorioConfig();
    const codLimpo = emp ? String(emp.codigo_interno || '').replace(/^#+/, '').trim() : 'AVULSO';
    const sufixo13 = hon.tipo_lancamento === 'DECIMO_TERCEIRO' ? `-13P${hon.parcela_13 || 1}` : '';
    const num = `${hon.competencia.replace('/', '')}-${codLimpo || '01'}${sufixo13}`;
    const nomeTitulo = emp ? (emp.razao_social || emp.nome_fantasia) : (hon.nome_cliente || 'Cliente Avulso');

    const html = `<div class="print-sheet">${this.gerarBlocoReciboPix(hon, emp, esc, num)}</div>`;
    this.abrirJanelaImpressao(`Recibo de Cobrança PIX - ${nomeTitulo} (${hon.competencia_referencia || hon.competencia})`, html);
  },

  imprimirLoteRecibosPixMes(competencia, idsFiltrados = null) {
    const db = window.zgestorDB;
    db.sincronizarSaldosAnterioresHonorarios(competencia);
    const esc = db.getEscritorioConfig();
    const setFiltro = Array.isArray(idsFiltrados) ? new Set(idsFiltrados) : null;
    const listaAlvo = db.data.honorarios.filter(
      h => h.competencia === competencia && Number(h.saldo_aberto) > 0 && (!setFiltro || setFiltro.has(h.id))
    );

    if (listaAlvo.length === 0) {
      if (window.ZGestorApp?.showToast) {
        window.ZGestorApp.showToast(`Nenhum honorário com saldo em aberto para emitir na competência ${competencia}.`, 'info');
      }
      return;
    }

    // Emite estritamente 1 recibo por página A4 (.print-sheet individual por cliente)
    const paginasHtml = listaAlvo.map((hon, idx) => {
      const emp = hon.empresa_id ? (db.obterEmpresaSegura ? db.obterEmpresaSegura(hon.empresa_id, hon) : db.data.empresas.find(e => e.id === hon.empresa_id)) : null;
      const cod = emp ? String(emp.codigo_interno || '').replace(/^#+/, '').trim() : 'AV';
      const sufixo13 = hon.tipo_lancamento === 'DECIMO_TERCEIRO' ? `-13P${hon.parcela_13 || 1}` : '';
      const num = `${hon.competencia.replace('/', '')}-${cod || String(idx + 1).padStart(2, '0')}${sufixo13}`;
      return `<div class="print-sheet">${this.gerarBlocoReciboPix(hon, emp, esc, num)}</div>`;
    });

    this.abrirJanelaImpressao(`Lote de Recibos de Cobrança PIX — Competência ${competencia} (${listaAlvo.length} recibo(s), 1 por página)`, paginasHtml.join(''));
  },

  // ===========================================================================
  // RELATÓRIOS GERENCIAIS PARA TODAS AS ABAS DO SISTEMA
  // ===========================================================================
  emitirRelatorioAba(aba, appState) {
    const db = window.zgestorDB;
    const V = window.ZGestorViews;
    const comp = appState.competencia;
    const sub = db.obterMesSubsequente(comp);
    const user = db.getCurrentUser();
    const canSeeHon = db.canAccessModule('honorarios', user);

    // 1. RELATÓRIO DO DASHBOARD EXECUTIVO
    if (aba === 'dashboard') {
      const tComp = db.data.tarefas.filter(t => t.competencia === comp);
      const tPrazo = tComp.filter(t => t.data_entrega && t.data_entrega <= t.prazo_entrega);
      const tAtraso = tComp.filter(t => t.data_entrega && t.data_entrega > t.prazo_entrega);
      const tPend = tComp.filter(t => !t.data_entrega);
      const honComp = db.data.honorarios.filter(h => h.competencia === comp);
      const totPrev = honComp.reduce((s, h) => s + (Number(h.valor_mensal) + Number(h.saldo_anterior || 0) + Number(h.servicos_extras) - Number(h.desconto)), 0);
      const totPago = honComp.reduce((s, h) => s + Number(h.valor_pago), 0);
      const totAberto = honComp.reduce((s, h) => s + Number(h.saldo_aberto), 0);

      const html = `
        ${this.cabecalhoPadraoRelatorio(`Relatório Gerencial Executivo — Competência ${comp}`, `Obrigações e Guias referentes a ${comp} com vencimento/entrega em ${sub.label}`)}
        <div class="grid ${canSeeHon ? 'grid-cols-3' : 'grid-cols-2'} gap-4 mb-6 text-xs">
          <div class="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div class="font-bold text-slate-500 uppercase">Empresas na Carteira</div>
            <div class="text-xl font-extrabold mt-1">${db.data.empresas.length} Clientes</div>
            <div class="text-slate-600 mt-1">${db.data.empresas.filter(e => e.status === 'ATIVA').length} Ativas • ${db.data.empresas.filter(e => e.status === 'EM_ONBOARDING').length} em Onboarding</div>
          </div>
          <div class="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div class="font-bold text-slate-500 uppercase">Entregas da Competência ${comp}</div>
            <div class="text-xl font-extrabold mt-1">${tPrazo.length + tAtraso.length} / ${tComp.length} Concluídas</div>
            <div class="text-slate-600 mt-1">${tPrazo.length} no prazo • ${tAtraso.length} c/ atraso • ${tPend.length} pendentes</div>
          </div>
          ${canSeeHon ? `
            <div class="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div class="font-bold text-slate-500 uppercase">Honorários (${comp} -> Venc. ${sub.label})</div>
              <div class="text-xl font-extrabold text-rose-700 mt-1">Em Aberto: ${V.formatCurrency(totAberto)}</div>
              <div class="text-slate-600 mt-1">Previsto Total: ${V.formatCurrency(totPrev)} | Recebido: ${V.formatCurrency(totPago)}</div>
            </div>
          ` : ''}
        </div>

        <h3 class="text-sm font-bold text-slate-900 mb-2">Resumo de Tarefas por Departamento (Competência ${comp})</h3>
        <table class="w-full text-xs border-collapse mb-6">
          <thead>
            <tr class="bg-slate-100 border-y border-slate-300 text-left">
              <th class="py-2 px-3">Departamento</th>
              <th class="py-2 px-3">Total de Tarefas</th>
              <th class="py-2 px-3">Entregues no Prazo</th>
              <th class="py-2 px-3">Entregues c/ Atraso</th>
              <th class="py-2 px-3">Pendentes</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            ${['FISCAL', 'CONTABIL', 'PESSOAL', 'FINANCEIRO', 'SOCIETARIO'].map(d => {
              const all = tComp.filter(t => t.departamento === d);
              const ok = all.filter(t => t.data_entrega && t.data_entrega <= t.prazo_entrega).length;
              const late = all.filter(t => t.data_entrega && t.data_entrega > t.prazo_entrega).length;
              const pend = all.filter(t => !t.data_entrega).length;
              return `
                <tr>
                  <td class="py-2 px-3 font-bold">${d}</td>
                  <td class="py-2 px-3">${all.length}</td>
                  <td class="py-2 px-3 text-emerald-700 font-semibold">${ok}</td>
                  <td class="py-2 px-3 text-amber-700 font-semibold">${late}</td>
                  <td class="py-2 px-3 text-rose-700 font-semibold">${pend}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
      this.abrirJanelaImpressao(`Relatório Executivo - Competência ${comp}`, html);
      return;
    }

    // 2. RELATÓRIO DE GESTÃO DE TAREFAS E ENVIO DE GUIAS DE IMPOSTOS
    if (aba === 'tarefas') {
      const fCliente = appState.filtroTarefaCliente || 'TODOS';
      const fDept = appState.filtroTarefaDept || 'TODOS';
      let lista = db.getTarefasVisiveis(true).filter(t => t.competencia === comp);
      if (fCliente !== 'TODOS') lista = lista.filter(t => t.empresa_id === fCliente);
      if (fDept !== 'TODOS') lista = lista.filter(t => t.departamento === fDept);
      lista.sort((a, b) => a.prazo_entrega.localeCompare(b.prazo_entrega));

      let guiasImp = db.getGuiasImpostos(comp);
      if (fCliente !== 'TODOS') guiasImp = guiasImp.filter(g => g.empresa_id === fCliente);

      const html = `
        ${this.cabecalhoPadraoRelatorio(`Relatório de Tarefas, Solicitações e Envio de Guias — Competência ${comp}`, `Prazos de Entrega no Mês Subsequente (${sub.label}) • Setor: ${fDept}`)}
        <h3 class="text-sm font-bold text-slate-900 mb-2">1. Obrigações Mensais e Solicitações Avulsas (${lista.length})</h3>
        <table class="w-full text-xs border-collapse mb-6">
          <thead>
            <tr class="bg-slate-100 border-y border-slate-300 text-left">
              <th class="py-2 px-2">Cliente</th>
              <th class="py-2 px-2">Setor / Tipo</th>
              <th class="py-2 px-2">Obrigação / Tarefa</th>
              <th class="py-2 px-2">Responsável Delegado</th>
              <th class="py-2 px-2">Prazo Limite</th>
              <th class="py-2 px-2">Entrega Efetiva</th>
              <th class="py-2 px-2">Situação</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            ${lista.map(t => {
              const emp = db.obterEmpresaSegura ? db.obterEmpresaSegura(t.empresa_id, t) : db.data.empresas.find(e => e.id === t.empresa_id);
              const sit = t.data_entrega
                ? (t.data_entrega <= t.prazo_entrega ? 'ENTREGUE NO PRAZO' : 'ENTREGUE C/ ATRASO')
                : 'PENDENTE';
              return `
                <tr>
                  <td class="py-2 px-2 font-bold">${V.escapeHtml(V.nomeEmp ? V.nomeEmp(emp, { comCodigo: true, fallbackObj: t }) : (emp ? emp.razao_social : '—'))}</td>
                  <td class="py-2 px-2">${t.departamento} (${t.tipo})</td>
                  <td class="py-2 px-2">${t.titulo}</td>
                  <td class="py-2 px-2">${t.responsavel_nome || '—'}</td>
                  <td class="py-2 px-2 font-semibold">${V.formatDate(t.prazo_entrega)}</td>
                  <td class="py-2 px-2 font-semibold">${V.formatDate(t.data_entrega)}</td>
                  <td class="py-2 px-2 font-bold">${sit}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <h3 class="text-sm font-bold text-slate-900 mb-2">2. Controle de Envio de Guias de Impostos (${guiasImp.length})</h3>
        <table class="w-full text-xs border-collapse">
          <thead>
            <tr class="bg-slate-100 border-y border-slate-300 text-left">
              <th class="py-2 px-2">Cliente</th>
              <th class="py-2 px-2">Guia / Tributo (Simples, DAE ICMS, etc.)</th>
              <th class="py-2 px-2">Vencimento</th>
              <th class="py-2 px-2 text-right">Valor</th>
              <th class="py-2 px-2">Status de Envio</th>
              <th class="py-2 px-2">Data / Canal de Envio</th>
              <th class="py-2 px-2">Responsável</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            ${guiasImp.map(g => {
              const emp = db.obterEmpresaSegura ? db.obterEmpresaSegura(g.empresa_id, g) : db.data.empresas.find(e => e.id === g.empresa_id);
              return `
                <tr>
                  <td class="py-2 px-2 font-bold">${V.escapeHtml(V.nomeEmp ? V.nomeEmp(emp, { comCodigo: true, fallbackObj: g }) : (emp ? emp.razao_social : '—'))}</td>
                  <td class="py-2 px-2 font-semibold">${g.tipo_guia}</td>
                  <td class="py-2 px-2">${V.formatDate(g.data_vencimento)}</td>
                  <td class="py-2 px-2 text-right font-bold">${V.formatCurrency(g.valor)}</td>
                  <td class="py-2 px-2 font-bold">${g.status_envio}</td>
                  <td class="py-2 px-2">${g.data_envio ? `${V.formatDate(g.data_envio)} (${g.canal_envio || ''})` : 'Não enviada'}</td>
                  <td class="py-2 px-2">${g.responsavel_nome || '—'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
      this.abrirJanelaImpressao(`Relatório de Tarefas e Guias - Competência ${comp}`, html);
      return;
    }

    // 3. RELATÓRIO DE PARCELAMENTOS ATIVOS E GUIAS
    if (aba === 'parcelamentos') {
      db.sincronizarPendenciasParcelamento(comp);
      const guias = db.data.parcelamento_guias.filter(g => g.competencia === comp);
      const parcs = db.data.parcelamentos;
      const html = `
        ${this.cabecalhoPadraoRelatorio(`Relatório de Parcelamentos e Controle de Guias (${comp})`, `Acompanhamento de emissão e envio de guias (Emitida / Enviada) e Status dos Acordos`)}
        <h3 class="text-sm font-bold text-slate-900 mb-2">1. Controle de Guias da Competência ${comp} (Vencimento em ${sub.label})</h3>
        <table class="w-full text-xs border-collapse mb-6">
          <thead>
            <tr class="bg-slate-100 border-y border-slate-300 text-left">
              <th class="py-2 px-2">Empresa</th>
              <th class="py-2 px-2">Órgão / Modalidade</th>
              <th class="py-2 px-2">Parcela</th>
              <th class="py-2 px-2">Vencimento</th>
              <th class="py-2 px-2">Valor Guia</th>
              <th class="py-2 px-2">Status da Guia</th>
              <th class="py-2 px-2">Status do Parcelamento</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            ${guias.map(g => {
              const emp = g.empresa_id ? db.data.empresas.find(e => e.id === g.empresa_id) : null;
              const p = parcs.find(x => x.id === g.parcelamento_id);
              const stParc = p ? V.statusParcelamentoLabel(p.status).label : '—';
              const isAvulso = Boolean((p && p.cliente_avulso) || g.cliente_avulso || (!emp && (g.nome_cliente || (p && p.nome_cliente))));
              const nomeCliente = isAvulso ? (((p && p.nome_cliente) || g.nome_cliente || 'Avulso') + ' (Avulso)') : (emp ? emp.nome_fantasia : '—');
              return `
                <tr>
                  <td class="py-2 px-2 font-bold">${nomeCliente}</td>
                  <td class="py-2 px-2">${p ? `${p.orgao} (${p.modalidade})` : '—'}</td>
                  <td class="py-2 px-2 font-semibold">${g.numero_parcela}/${p ? p.total_parcelas : '?'}</td>
                  <td class="py-2 px-2">${V.formatDate(g.data_vencimento)}</td>
                  <td class="py-2 px-2 font-bold">${V.formatCurrency(g.valor_guia)}</td>
                  <td class="py-2 px-2 font-semibold">${g.status_guia === 'ENVIADA_CLIENTE' ? 'ENVIADA AO CLIENTE' : g.status_guia === 'EMITIDA' ? 'EMITIDA' : 'PENDENTE'}</td>
                  <td class="py-2 px-2 font-bold">${stParc}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <h3 class="text-sm font-bold text-slate-900 mb-2">2. Cadastro Geral de Acordos de Parcelamento</h3>
        <table class="w-full text-xs border-collapse">
          <thead>
            <tr class="bg-slate-100 border-y border-slate-300 text-left">
              <th class="py-2 px-2">Empresa</th>
              <th class="py-2 px-2">Órgão</th>
              <th class="py-2 px-2">Nº Processo</th>
              <th class="py-2 px-2">Andamento</th>
              <th class="py-2 px-2">Dívida Consolidada</th>
              <th class="py-2 px-2">Status do Parcelamento</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            ${parcs.map(p => {
              const isAvulso = Boolean(p.cliente_avulso || !p.empresa_id);
              const emp = !isAvulso ? db.data.empresas.find(e => e.id === p.empresa_id) : null;
              const nomeCliente = isAvulso ? `${p.nome_cliente || 'Cliente Avulso'} (Avulso)` : (emp ? emp.nome_fantasia : '—');
              return `
                <tr>
                  <td class="py-2 px-2 font-bold">${nomeCliente}</td>
                  <td class="py-2 px-2">${p.orgao}</td>
                  <td class="py-2 px-2 font-mono">${p.numero_processo || '—'}</td>
                  <td class="py-2 px-2 font-bold">${p.parcelas_pagas}/${p.total_parcelas}</td>
                  <td class="py-2 px-2">${V.formatCurrency(p.valor_consolidado)}</td>
                  <td class="py-2 px-2 font-bold">${V.statusParcelamentoLabel(p.status).label}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
      this.abrirJanelaImpressao(`Relatório de Parcelamentos - ${comp}`, html);
      return;
    }

    // 4. RELATÓRIO DE CONTROLE DE CNDs
    if (aba === 'cnds') {
      const cnds = db.getCNDs();
      const html = `
        ${this.cabecalhoPadraoRelatorio(`Relatório de Monitoramento de CNDs (Certidões Negativas de Débitos)`, `Situação de regularidade fiscal Federal, Estadual, Municipal, FGTS e Trabalhista (${cnds.length} certidões)`)}
        <table class="w-full text-xs border-collapse">
          <thead>
            <tr class="bg-slate-100 border-y border-slate-300 text-left">
              <th class="py-2 px-2">Empresa / CNPJ</th>
              <th class="py-2 px-2">Órgão / Tipo de CND</th>
              <th class="py-2 px-2">Resultado</th>
              <th class="py-2 px-2">Código Controle</th>
              <th class="py-2 px-2">Emissão</th>
              <th class="py-2 px-2">Vencimento</th>
              <th class="py-2 px-2">Status Vigência</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            ${cnds.map(c => {
              const emp = db.data.empresas.find(e => e.id === c.empresa_id);
              const st = db.calcularStatusValidadeCND(c);
              return `
                <tr>
                  <td class="py-2 px-2"><strong>${emp ? emp.nome_fantasia : '—'}</strong><br/><span class="text-slate-500 font-mono">${emp ? emp.cnpj : ''}</span></td>
                  <td class="py-2 px-2 font-semibold">${c.orgao}</td>
                  <td class="py-2 px-2">${c.situacao}</td>
                  <td class="py-2 px-2 font-mono">${c.numero_controle || '—'}</td>
                  <td class="py-2 px-2">${V.formatDate(c.data_emissao)}</td>
                  <td class="py-2 px-2 font-bold">${V.formatDate(c.data_vencimento)}</td>
                  <td class="py-2 px-2 font-bold ${st.codigo === 'VIGENTE' ? 'text-emerald-700' : 'text-rose-700'}">${st.label}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
      this.abrirJanelaImpressao('Relatório de Controle de CNDs', html);
      return;
    }

    // 5. RELATÓRIO / EXTRATO 360° DA CENTRAL DO CLIENTE
    if (aba === 'central_cliente') {
      const empresas = db.data.empresas;
      const empId = appState.empresaCentralId || (empresas[0] && empresas[0].id);
      const emp = empresas.find(e => e.id === empId);
      if (!emp) return;

      const tarefasEmp = db.data.tarefas.filter(t => t.empresa_id === emp.id && t.competencia === comp);
      const guiasImpEmp = db.getGuiasImpostos(comp).filter(g => g.empresa_id === emp.id);
      const parcsEmp = db.data.parcelamentos.filter(p => p.empresa_id === emp.id);
      const cndsEmp = db.getCNDs(emp.id);
      const registros = db.getRegistrosCentralCliente(emp.id);

      const html = `
        ${this.cabecalhoPadraoRelatorio(`Extrato 360° da Central do Cliente — ${emp.razao_social}`, `CNPJ: ${emp.cnpj} • Regime: ${emp.regime_tributario} • Competência Ativa: ${comp} (Venc. ${sub.label})`)}

        <div class="grid grid-cols-2 gap-4 mb-5 text-xs">
          <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div class="font-bold uppercase text-slate-500 text-[10px]">Dados Cadastrais e Contato</div>
            <div class="mt-1"><strong>Nome Fantasia:</strong> ${emp.nome_fantasia}</div>
            <div><strong>Inscrições:</strong> IE: ${emp.inscricao_estadual || 'Isento'} | IM: ${emp.inscricao_municipal || '—'}</div>
            <div><strong>Responsável Legal:</strong> ${emp.responsavel_legal || '—'}</div>
            <div><strong>Contato:</strong> ${emp.telefone || '—'} • ${emp.email || '—'}</div>
          </div>
          <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div class="font-bold uppercase text-slate-500 text-[10px]">Resumo da Competência ${comp}</div>
            <div class="mt-1"><strong>Tarefas Concluídas:</strong> ${tarefasEmp.filter(t => Boolean(t.data_entrega)).length} de ${tarefasEmp.length}</div>
            <div><strong>Guias de Impostos Enviadas:</strong> ${guiasImpEmp.filter(g => g.status_envio === 'ENVIADA_CLIENTE').length} de ${guiasImpEmp.length}</div>
            <div><strong>Parcelamentos Monitorados:</strong> ${parcsEmp.length} acordo(s)</div>
            <div><strong>Certidões (CNDs) Cadastradas:</strong> ${cndsEmp.length} certidão(ões)</div>
          </div>
        </div>

        <h3 class="text-sm font-bold text-slate-900 mb-2">1. Obrigações e Guias da Competência ${comp}</h3>
        <table class="w-full text-xs border-collapse mb-5">
          <thead>
            <tr class="bg-slate-100 border-y border-slate-300 text-left">
              <th class="py-1.5 px-2">Tipo</th>
              <th class="py-1.5 px-2">Descrição da Obrigação / Guia</th>
              <th class="py-1.5 px-2">Prazo / Vencimento</th>
              <th class="py-1.5 px-2">Situação</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            ${tarefasEmp.map(t => `
              <tr>
                <td class="py-1.5 px-2 font-semibold">${t.departamento}</td>
                <td class="py-1.5 px-2">${t.titulo}</td>
                <td class="py-1.5 px-2">${V.formatDate(t.prazo_entrega)}</td>
                <td class="py-1.5 px-2 font-bold">${t.data_entrega ? `Entregue em ${V.formatDate(t.data_entrega)}` : 'Pendente'}</td>
              </tr>
            `).join('')}
            ${guiasImpEmp.map(g => `
              <tr>
                <td class="py-1.5 px-2 font-semibold">GUIA IMPOSTO</td>
                <td class="py-1.5 px-2">${g.tipo_guia} (${V.formatCurrency(g.valor)})</td>
                <td class="py-1.5 px-2">${V.formatDate(g.data_vencimento)}</td>
                <td class="py-1.5 px-2 font-bold">${g.status_envio === 'ENVIADA_CLIENTE' ? `Enviada em ${V.formatDate(g.data_envio)}` : g.status_envio}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h3 class="text-sm font-bold text-slate-900 mb-2">2. Histórico de Atendimentos, Solicitações e Documentos (${registros.length})</h3>
        <table class="w-full text-xs border-collapse">
          <thead>
            <tr class="bg-slate-100 border-y border-slate-300 text-left">
              <th class="py-1.5 px-2">Data</th>
              <th class="py-1.5 px-2">Categoria</th>
              <th class="py-1.5 px-2">Assunto e Descrição</th>
              <th class="py-1.5 px-2">Responsável</th>
              <th class="py-1.5 px-2">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            ${registros.map(r => `
              <tr>
                <td class="py-1.5 px-2">${V.formatDate(r.data_registro)}</td>
                <td class="py-1.5 px-2 font-semibold">${r.categoria}</td>
                <td class="py-1.5 px-2"><strong>${r.titulo}</strong> — ${r.descricao || ''}</td>
                <td class="py-1.5 px-2">${r.responsavel_nome || '—'}</td>
                <td class="py-1.5 px-2 font-bold">${r.status}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      this.abrirJanelaImpressao(`Extrato 360° - ${emp.nome_fantasia}`, html);
      return;
    }

    // 6. RELATÓRIO DE EMPRESAS CADASTRADAS
    if (aba === 'empresas') {
      const emps = db.data.empresas;
      const html = `
        ${this.cabecalhoPadraoRelatorio(`Relatório Geral de Empresas da Carteira`, `Total de ${emps.length} empresas cadastradas`)}
        <table class="w-full text-xs border-collapse">
          <thead>
            <tr class="bg-slate-100 border-y border-slate-300 text-left">
              <th class="py-2 px-2">Cód.</th>
              <th class="py-2 px-2">Razão Social / Fantasia</th>
              <th class="py-2 px-2">CNPJ</th>
              <th class="py-2 px-2">Regime Tributário</th>
              <th class="py-2 px-2">Responsável / Contato</th>
              <th class="py-2 px-2">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            ${emps.map(e => `
              <tr>
                <td class="py-2 px-2 font-mono font-bold">${V.escapeHtml(V.codLimpo ? V.codLimpo(e.codigo_interno) : (e.codigo_interno || ''))}</td>
                <td class="py-2 px-2"><strong>${e.razao_social}</strong><br/><span class="text-slate-500">${e.nome_fantasia}</span></td>
                <td class="py-2 px-2 font-mono">${e.cnpj}</td>
                <td class="py-2 px-2 font-semibold">${e.regime_tributario}</td>
                <td class="py-2 px-2">${e.responsavel_legal || '—'}<br/>${e.telefone || ''}</td>
                <td class="py-2 px-2 font-bold">${e.status}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      this.abrirJanelaImpressao('Relatório da Carteira de Empresas', html);
      return;
    }

    // 7. RELATÓRIO DE ONBOARDING DE CLIENTES
    if (aba === 'onboarding') {
      const empresasOnb = db.data.empresas.filter(e =>
        e.status === 'EM_ONBOARDING' || db.data.onboarding_itens.some(i => i.empresa_id === e.id)
      );
      const html = `
        ${this.cabecalhoPadraoRelatorio(`Relatório de Onboarding e Implantação de Novos Clientes`, `Checklist de Documentação, Certificado Digital/Procurações, Sistemas e Alinhamento`)}
        ${empresasOnb.map(emp => {
          const prog = db.obterProgressoOnboarding(emp.id);
          const itens = db.data.onboarding_itens.filter(i => i.empresa_id === emp.id).sort((a, b) => a.ordem - b.ordem);
          return `
            <div class="mb-6 border border-slate-300 rounded-xl p-4">
              <div class="flex justify-between items-center border-b border-slate-200 pb-2 mb-3">
                <div>
                  <h3 class="font-bold text-sm text-slate-900">${emp.razao_social} (${emp.cnpj})</h3>
                  <p class="text-xs text-slate-600">Regime: ${emp.regime_tributario} • Entrada: ${V.formatDate(emp.data_entrada)}</p>
                </div>
                <div class="text-right">
                  <span class="text-sm font-extrabold text-indigo-700">${prog.percentual}% Concluído (${prog.concluidos}/${prog.total})</span>
                </div>
              </div>
              <table class="w-full text-xs border-collapse">
                <thead>
                  <tr class="bg-slate-50 border-b border-slate-200 text-left">
                    <th class="py-1.5 px-2">Setor</th>
                    <th class="py-1.5 px-2">Item do Checklist</th>
                    <th class="py-1.5 px-2">Situação</th>
                    <th class="py-1.5 px-2">Data / Responsável</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  ${itens.map(i => `
                    <tr>
                      <td class="py-1.5 px-2 font-semibold">${i.departamento}</td>
                      <td class="py-1.5 px-2">${i.titulo}</td>
                      <td class="py-1.5 px-2 font-bold ${i.concluido ? 'text-emerald-700' : 'text-rose-600'}">${i.concluido ? 'CONCLUÍDO' : 'PENDENTE'}</td>
                      <td class="py-1.5 px-2">${i.concluido ? `${V.formatDate(i.data_conclusao)} (${i.responsavel_nome || ''})` : (i.observacao || '—')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `;
        }).join('')}
      `;
      this.abrirJanelaImpressao('Relatório de Onboarding de Clientes', html);
      return;
    }

    // 8. RELATÓRIO FINANCEIRO DE HONORÁRIOS E SALDOS EM ABERTO
    if (aba === 'honorarios') {
      if (!canSeeHon) {
        window.ZGestorApp.showToast('Acesso restrito a Honorários.', 'error');
        return;
      }
      db.sincronizarSaldosAnterioresHonorarios(comp);
      const lista = db.data.honorarios.filter(h => h.competencia === comp);
      const totPrev = lista.reduce((s, h) => s + (Number(h.valor_mensal) + Number(h.saldo_anterior || 0) + Number(h.servicos_extras) - Number(h.desconto)), 0);
      const totPago = lista.reduce((s, h) => s + Number(h.valor_pago), 0);
      const totAberto = lista.reduce((s, h) => s + Number(h.saldo_aberto), 0);

      const html = `
        ${this.cabecalhoPadraoRelatorio(`Relatório Financeiro de Honorários Contábeis — Competência ${comp}`, `Honorários de ${comp} com vencimento em ${sub.label} • Total c/ Saldo Anterior: ${V.formatCurrency(totPrev)} | Recebido: ${V.formatCurrency(totPago)} | Saldo em Aberto: ${V.formatCurrency(totAberto)}`)}
        <table class="w-full text-xs border-collapse">
          <thead>
            <tr class="bg-slate-100 border-y border-slate-300 text-left">
              <th class="py-2 px-2">Cliente</th>
              <th class="py-2 px-2">Vencimento</th>
              <th class="py-2 px-2 text-right">Valor Mensal</th>
              <th class="py-2 px-2 text-right">Saldo Mês Ant.</th>
              <th class="py-2 px-2 text-right">Extras/Desc.</th>
              <th class="py-2 px-2 text-right">Total a Pagar</th>
              <th class="py-2 px-2 text-right">Valor Pago</th>
              <th class="py-2 px-2 text-right">Saldo em Aberto</th>
              <th class="py-2 px-2 text-center">Situação</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            ${lista.map(h => {
              const emp = db.obterEmpresaSegura ? db.obterEmpresaSegura(h.empresa_id, h) : db.data.empresas.find(e => e.id === h.empresa_id);
              const saldoAnt = Number(h.saldo_anterior || 0);
              const liq = Math.max(0, Number(h.valor_mensal) + saldoAnt + Number(h.servicos_extras) - Number(h.desconto));
              const extDesc = Number(h.servicos_extras) - Number(h.desconto);
              return `
                <tr>
                  <td class="py-2 px-2 font-bold">${V.escapeHtml(V.nomeEmp ? V.nomeEmp(emp, { comCodigo: true, fallbackObj: h }) : (emp ? emp.razao_social : '—'))}</td>
                  <td class="py-2 px-2">${V.formatDate(h.data_vencimento)}</td>
                  <td class="py-2 px-2 text-right">${V.formatCurrency(h.valor_mensal)}</td>
                  <td class="py-2 px-2 text-right ${saldoAnt > 0 ? 'font-bold text-amber-800' : 'text-slate-400'}">${saldoAnt > 0 ? `+ ${V.formatCurrency(saldoAnt)}` : '—'}</td>
                  <td class="py-2 px-2 text-right">${extDesc !== 0 ? V.formatCurrency(extDesc) : '—'}</td>
                  <td class="py-2 px-2 text-right font-bold">${V.formatCurrency(liq)}</td>
                  <td class="py-2 px-2 text-right font-bold text-emerald-700">${V.formatCurrency(h.valor_pago)}</td>
                  <td class="py-2 px-2 text-right font-extrabold ${Number(h.saldo_aberto) > 0 ? 'text-rose-700' : 'text-emerald-700'}">${V.formatCurrency(h.saldo_aberto)}</td>
                  <td class="py-2 px-2 text-center font-bold">${h.status}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
          <tfoot>
            <tr class="border-t-2 border-slate-800 bg-slate-50 font-extrabold">
              <td colspan="5" class="py-2.5 px-2 text-right uppercase">Totais da Competência ${comp}:</td>
              <td class="py-2.5 px-2 text-right">${V.formatCurrency(totPrev)}</td>
              <td class="py-2.5 px-2 text-right text-emerald-700">${V.formatCurrency(totPago)}</td>
              <td class="py-2.5 px-2 text-right text-rose-700">${V.formatCurrency(totAberto)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      `;
      this.abrirJanelaImpressao(`Relatório de Honorários - Competência ${comp}`, html);
      return;
    }

    // 9. RELATÓRIO DE SEGURANÇA E AUDITORIA
    if (aba === 'seguranca') {
      const html = `
        ${this.cabecalhoPadraoRelatorio(`Relatório de Usuários, Políticas RLS e Auditoria de Ações`, `Governança e segurança de dados do escritório contábil`)}
        <h3 class="text-sm font-bold text-slate-900 mb-2">1. Usuários Ativos e Perfis de Acesso por Setor</h3>
        <table class="w-full text-xs border-collapse mb-6">
          <thead>
            <tr class="bg-slate-100 border-y border-slate-300 text-left">
              <th class="py-2 px-2">Nome</th>
              <th class="py-2 px-2">E-mail</th>
              <th class="py-2 px-2">Cargo</th>
              <th class="py-2 px-2">Departamento (Escopo RLS)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            ${db.data.profiles.map(p => `
              <tr>
                <td class="py-2 px-2 font-bold">${p.nome}</td>
                <td class="py-2 px-2">${p.email}</td>
                <td class="py-2 px-2 font-semibold">${p.cargo}</td>
                <td class="py-2 px-2 font-semibold">${p.departamento}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h3 class="text-sm font-bold text-slate-900 mb-2">2. Últimos Registros de Auditoria</h3>
        <table class="w-full text-xs border-collapse">
          <thead>
            <tr class="bg-slate-100 border-y border-slate-300 text-left">
              <th class="py-2 px-2">Data/Hora</th>
              <th class="py-2 px-2">Usuário</th>
              <th class="py-2 px-2">Módulo</th>
              <th class="py-2 px-2">Detalhes da Operação</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            ${db.data.audit_logs.slice(0, 40).map(l => `
              <tr>
                <td class="py-1.5 px-2">${new Date(l.created_at).toLocaleString('pt-BR')}</td>
                <td class="py-1.5 px-2 font-semibold">${l.usuario_nome}</td>
                <td class="py-1.5 px-2 font-bold">${l.modulo}</td>
                <td class="py-1.5 px-2">${l.detalhes}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      this.abrirJanelaImpressao('Relatório de Segurança e Auditoria', html);
    }
  },

  // ===========================================================================
  // RELATÓRIO PARA EMISSÃO DE NOTA FISCAL DE SERVIÇOS (NFS-e)
  // Filtra apenas os pagamentos baixados na competência nas contas bancárias PJ/exigíveis
  // ===========================================================================
  emitirRelatorioNFSe(competencia) {
    const db = window.zgestorDB;
    const V = window.ZGestorViews;
    const esc = db.getEscritorioConfig();

    // Obtém todos os honorários da competência
    const honorariosMes = db.data.honorarios.filter(h => h.competencia === competencia);
    const honIds = new Set(honorariosMes.map(h => h.id));

    // Obtém todos os pagamentos baixados vinculados a esses honorários
    const todosPags = (db.data.honorario_pagamentos || []).filter(p => honIds.has(p.honorario_id));

    // Filtra apenas pagamentos que entraram em contas PJ / exigíveis (exclui contas de pessoa física/sócio)
    const pagamentosPJ = todosPags.filter(p => {
      const c = (p.conta_destino || '').toLowerCase();
      if (c.includes('pessoa física') || c.includes('sócio') || c.includes('autônomo')) {
        return false;
      }
      return true; // Conta PJ Principal, Conta PJ Secundária ou padrão PJ
    });

    if (pagamentosPJ.length === 0) {
      window.ZGestorApp.showToast(`Nenhum pagamento baixado em contas PJ encontrado na competência ${competencia} para emissão de NFS-e.`, 'info');
      return;
    }

    const totalFaturado = pagamentosPJ.reduce((acc, p) => acc + Number(p.valor || 0), 0);
    const empresasUnicas = new Set(pagamentosPJ.map(p => p.empresa_id)).size;

    const linhasHtml = pagamentosPJ.map((p, idx) => {
      const honRef = honorariosMes.find(h => h.id === p.honorario_id);
      const emp = p.empresa_id ? (db.obterEmpresaSegura ? db.obterEmpresaSegura(p.empresa_id, honRef) : db.data.empresas.find(e => e.id === p.empresa_id)) : null;
      const nomeTom = emp ? emp.razao_social : (honRef?.nome_cliente || 'Cliente Avulso');
      const fantasiaTom = emp ? emp.nome_fantasia : (honRef?.descricao_cobranca || 'Cobrança Avulsa');
      const docTom = emp ? emp.cnpj : (honRef?.documento_cliente || '—');
      const contaNome = p.conta_destino ? p.conta_destino.split('(')[0].trim() : 'Conta PJ Principal';
      return `
        <tr class="hover:bg-slate-50">
          <td class="py-2.5 px-2 text-center text-slate-500 font-mono">${idx + 1}</td>
          <td class="py-2.5 px-2">
            <div class="font-bold text-slate-900">${V.escapeHtml(nomeTom)}</div>
            <div class="text-[11px] text-slate-500">${V.escapeHtml(fantasiaTom)}</div>
          </td>
          <td class="py-2.5 px-2 font-mono text-slate-800 text-[11px] font-semibold">${V.escapeHtml(docTom)}</td>
          <td class="py-2.5 px-2 text-slate-700 text-[11px]">${emp ? `${emp.municipio || 'Mutum'}/${emp.uf || 'MG'}` : '—'}</td>
          <td class="py-2.5 px-2 text-slate-800 text-center font-medium">${V.formatDate(p.data_pagamento)}</td>
          <td class="py-2.5 px-2 text-slate-700 text-[11px]">
            <span class="inline-block px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 font-semibold border border-indigo-200">${contaNome}</span>
          </td>
          <td class="py-2.5 px-2 text-slate-600 text-[11px] text-center">${p.forma_pagamento || 'PIX'}</td>
          <td class="py-2.5 px-2 text-right font-extrabold text-slate-900 text-sm">${V.formatCurrency(p.valor)}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <div class="print-sheet p-6">
        ${this.cabecalhoPadraoRelatorio(
          `Relatório para Emissão de Notas Fiscais (NFS-e) — Competência ${competencia}`,
          `Filtro exclusivo de pagamentos baixados em contas bancárias PJ para faturamento oficial do escritório Zioto Contabilidade`
        )}

        <!-- KPIs Resumo -->
        <div class="grid grid-cols-3 gap-3 my-4">
          <div class="p-3 rounded-xl bg-purple-50 border border-purple-200">
            <span class="text-[10px] font-bold uppercase text-purple-800">Total Faturado em Contas PJ (Base NFS-e)</span>
            <div class="text-xl font-black text-purple-900 mt-0.5">${V.formatCurrency(totalFaturado)}</div>
            <span class="text-[10px] text-purple-700">Somatório de baixas bancárias PJ</span>
          </div>
          <div class="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span class="text-[10px] font-bold uppercase text-slate-600">Total de Pagamentos Baixados</span>
            <div class="text-xl font-black text-slate-900 mt-0.5">${pagamentosPJ.length} recebimento(s)</div>
            <span class="text-[10px] text-slate-500">Recibos quitados na competência</span>
          </div>
          <div class="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <span class="text-[10px] font-bold uppercase text-emerald-800">Empresas Tomadoras</span>
            <div class="text-xl font-black text-emerald-900 mt-0.5">${empresasUnicas} cliente(s)</div>
            <span class="text-[10px] text-emerald-700">Notas de Serviços a emitir</span>
          </div>
        </div>

        <!-- Tabela das Notas a Emitir -->
        <table class="w-full text-xs border-collapse mt-2">
          <thead>
            <tr class="bg-slate-100 border-y border-slate-300 text-left text-[11px] font-bold uppercase text-slate-600">
              <th class="py-2 px-2 text-center w-8">#</th>
              <th class="py-2 px-2">Razão Social do Tomador</th>
              <th class="py-2 px-2">CNPJ</th>
              <th class="py-2 px-2">Município / UF</th>
              <th class="py-2 px-2 text-center">Data Pagamento</th>
              <th class="py-2 px-2">Conta Destino</th>
              <th class="py-2 px-2 text-center">Forma</th>
              <th class="py-2 px-2 text-right">Valor Pago (R$)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            ${linhasHtml}
          </tbody>
          <tfoot>
            <tr class="bg-slate-50 border-t-2 border-slate-700 font-extrabold text-xs">
              <td colspan="7" class="py-2 px-2 text-right uppercase">Total Faturado em Contas PJ (Base de Cálculo NFS-e):</td>
              <td class="py-2 px-2 text-right text-purple-900 text-sm">${V.formatCurrency(totalFaturado)}</td>
            </tr>
          </tfoot>
        </table>

        <!-- Enquadramento Fiscal do Escritório -->
        <div class="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
          <div class="font-bold text-slate-800">📌 Dados de Enquadramento Fiscal para Emissão da NFS-e:</div>
          <div><strong>Atividade / Item LC 116/2003:</strong> 01.07 — Serviços de contabilidade, auditoria e assessoria fiscal e contábil.</div>
          <div><strong>CNAE Principal:</strong> 6920-6/01 — Atividades de contabilidade • <strong>Prestador:</strong> ${esc.razao_social || 'Zioto Contabilidade Ltda'} (CNPJ: ${esc.cnpj || '—'}).</div>
        </div>
      </div>
    `;

    this.abrirJanelaImpressao(`Relatório para Emissão de NFS-e — Competência ${competencia}`, html);
  },

  imprimirProtocoloOfficeBoy(protocoloId) {
    const db = window.zgestorDB;
    const V = window.ZGestorViews;
    const prot = (db.data.protocolos_guias || []).find(p => p.id === protocoloId);
    if (!prot) return;

    const itens = prot.itens || [];

    // Aglutina todas as guias por empresa para o cliente assinar apenas UMA VEZ!
    const porEmpresaMap = new Map();
    itens.forEach(it => {
      const key = it.empresa_id || it.cnpj || it.empresa_nome;
      if (!porEmpresaMap.has(key)) {
        porEmpresaMap.set(key, {
          empresa_nome: it.empresa_nome,
          razao_social: it.razao_social || it.empresa_nome,
          cnpj: it.cnpj || '—',
          guias: []
        });
      }
      porEmpresaMap.get(key).guias.push(it);
    });

    const gruposEmpresas = Array.from(porEmpresaMap.values());
    const linhas = gruposEmpresas.map((grupo, idx) => {
      const guiasListaHtml = grupo.guias.map(it => `
        <div class="py-1.5 border-b last:border-b-0 border-slate-200/80 flex items-center justify-between gap-3">
          <div class="text-[11px] leading-snug">
            <strong class="text-slate-900">• ${it.tipo_guia}</strong>
            ${it.competencia_guia ? `<span class="text-[10px] text-slate-600 ml-1 whitespace-nowrap">(Comp. ${it.competencia_guia})</span>` : ''}
          </div>
          <span class="font-bold text-slate-800 whitespace-nowrap text-[11px]">Venc: ${V.formatDate(it.data_vencimento)}</span>
        </div>
      `).join('');

      return `
        <tr class="border-b border-slate-300">
          <td class="py-3 px-2 text-center font-mono text-xs text-slate-500 align-top">${idx + 1}</td>
          <td class="py-3 px-2 align-top">
            <div class="font-bold text-slate-900 text-xs">${grupo.razao_social}</div>
            <div class="text-[11px] text-slate-600 font-mono">CNPJ: ${grupo.cnpj}</div>
          </td>
          <td class="py-2 px-2 text-xs align-top">${guiasListaHtml}</td>
          <td class="py-3 px-2 text-center text-xs text-slate-500 align-bottom">____/____/____</td>
          <td class="py-3 px-2 align-bottom">
            <div class="border-b border-slate-400 h-7"></div>
            <div class="text-[9px] text-slate-400 mt-0.5">Nome legível e assinatura única do recebedor</div>
          </td>
        </tr>
      `;
    }).join('');

    const subEntrega = db.obterMesSubsequente(prot.competencia);
    const html = `
      <div class="space-y-4">
        ${this.cabecalhoPadraoRelatorio(`Protocolo de Entrega de Guias — ${prot.codigo}`, `Entrega em ${subEntrega.label} • ${gruposEmpresas.length} empresa(s) • ${itens.length} guia(s) aglutinadas`)}

        <div class="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
          <div><span class="text-slate-500">Nº Protocolo:</span> <strong class="font-mono text-indigo-800">${prot.codigo}</strong></div>
          <div><span class="text-slate-500">Data de Saída:</span> <strong>${V.formatDate(prot.data_saida)}</strong></div>
          <div><span class="text-slate-500">Emitido por:</span> <strong>${prot.responsavel_emissao || 'Escritório'}</strong></div>
        </div>

        <table class="w-full text-left border-collapse border border-slate-300">
          <thead>
            <tr class="bg-slate-100 border-b-2 border-slate-400 text-[10px] font-bold uppercase text-slate-700">
              <th class="py-2 px-2 w-[5%] text-center">#</th>
              <th class="py-2 px-2 w-[26%]">Empresa / CNPJ</th>
              <th class="py-2 px-2 w-[37%]">Guias Entregues (Aglutinadas por Empresa)</th>
              <th class="py-2 px-2 w-[11%] text-center">Data Entrega</th>
              <th class="py-2 px-2 w-[21%]">Assinatura Única do Cliente</th>
            </tr>
          </thead>
          <tbody>
            ${linhas}
          </tbody>
        </table>

        <div class="mt-6 grid grid-cols-2 gap-8 pt-6 text-xs text-slate-700">
          <div class="text-center">
            <div class="border-t border-slate-400 pt-1.5 font-bold">Assinatura do Office Boy / Portador</div>
            <div class="text-[10px] text-slate-400">Conferência de saída das guias impressas</div>
          </div>
          <div class="text-center">
            <div class="border-t border-slate-400 pt-1.5 font-bold">Conferência / Arquivamento (Escritório)</div>
            <div class="text-[10px] text-slate-400">Recebido e arquivado em ____/____/______</div>
          </div>
        </div>
      </div>
    `;

    this.abrirJanelaImpressao(`Protocolo Office Boy ${prot.codigo}`, html);
  }
};