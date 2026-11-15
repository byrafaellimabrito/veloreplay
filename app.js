/* Vélore Pay — conversor PIX → Dólar / Guarani */
(function () {
  const C = window.VELORE_CONFIG;
  const $ = (id) => document.getElementById(id);
  let atualizadoEm = null;
  let online = false;
  let automatica = false;

  const fmt = (v, casas) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
  const parseNum = (s) => {
    s = String(s || "").replace(/[^\d,.]/g, "");
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    else if ((s.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, "");
    const n = parseFloat(s);
    return isFinite(n) ? n : 0;
  };

  const opc = () => ({
    taxas: C.taxas && C.taxas.ativo ? C.taxas : null,
    entrega: C.entrega && C.entrega.ativo ? C.entrega : null,
    arred: C.arredondarGuarani && C.arredondarGuarani.ativo && C.arredondarGuarani.multiplo > 1 ? C.arredondarGuarani.multiplo : 0
  });
  const forma = () => (document.querySelector('input[name="forma"]:checked') || {}).value || "retirada";
  const taxaPorFaixa = (brl, faixas) => {
    for (const f of faixas || []) if (f.ate == null || brl <= f.ate) return +f.taxa || 0;
    return 0;
  };
  function converter(brl) {
    const o = opc();
    const taxa = o.taxas && brl > 0 ? taxaPorFaixa(brl, o.taxas.faixas) : 0;
    const entrega = o.entrega && forma() === "entrega" && brl > 0 ? +o.entrega.taxa || 0 : 0;
    const base = Math.max(brl - taxa - entrega, 0);
    let pyg = Math.floor(base * C.cotacao.pyg);
    if (o.arred) pyg = Math.floor(pyg / o.arred) * o.arred;
    return {
      brl, taxa, entrega, base,
      usd: C.cotacao.usd > 0 ? Math.floor((base / C.cotacao.usd) * 100) / 100 : 0,
      pyg
    };
  }

  function render() {
    const brl = parseNum($("valorBRL").value);
    const r = converter(brl);
    $("outUSD").textContent = "US$ " + fmt(r.usd, 2);
    $("outPYG").textContent = "Gs. " + fmt(r.pyg, 0);
    $("taxaUSD").textContent = "US$ 1 = R$ " + fmt(C.cotacao.usd, 2);
    $("taxaPYG").textContent = "R$ 1 = Gs. " + fmt(C.cotacao.pyg, 0);
    $("notasPYG").hidden = !opc().arred;
    $("notasPYG").textContent = opc().arred ? "Em notas de " + fmt(opc().arred, 0) : "";
    const d = $("descontos");
    d.hidden = !(r.taxa || r.entrega);
    d.innerHTML = (r.taxa ? `<dt>Taxa de serviço</dt><dd>− R$ ${fmt(r.taxa, 2)}</dd>` : "") +
      (r.entrega ? `<dt>Entrega</dt><dd>− R$ ${fmt(r.entrega, 2)}</dd>` : "") +
      `<dt class="total">Valor convertido</dt><dd class="total">R$ ${fmt(r.base, 2)}</dd>`;
    $("btnPedido").disabled = !(r.base > 0);
    $("opUSD").innerHTML = "Dólar<small>US$ " + fmt(r.usd, 2) + "</small>";
    $("opPYG").innerHTML = "Guarani<small>Gs. " + fmt(r.pyg, 0) + "</small>";
    resumo();
  }

  function renderStatus() {
    $("ponto").className = "ponto " + (online ? "ok" : "erro");
    if (!online) { $("status").textContent = "Não foi possível atualizar. Confirme a cotação no WhatsApp."; return; }
    const d = atualizadoEm, hoje = new Date();
    const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const mesmoDia = d.toDateString() === hoje.toDateString();
    $("status").textContent = "Cotação atualizada " + (mesmoDia ? "hoje às " + hora : "em " + d.toLocaleDateString("pt-BR") + " às " + hora);
  }

  async function carregar() {
    try {
      const r = await fetch(C.supabaseUrl + "/rest/v1/settings?id=eq.1&select=data,updated_at", { headers: { apikey: C.supabaseKey }, cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      const [row] = await r.json();
      Object.assign(C, row.data || {});
      atualizadoEm = new Date(row.updated_at);
      online = true;
      automatica = false;
      if (C.modo === "auto") {
        try {
          const m = await window.buscarMercado();
          C.cotacao = window.cotacaoComMargem(m, C.auto);
          atualizadoEm = m.quando;
          automatica = true;
        } catch (e) { /* mercado fora do ar: usa a cotação manual do painel */ }
      }
    } catch (e) { online = false; }
    aplicarConfig(); render(); renderStatus();
  }

  function aplicarConfig() {
    const o = opc();
    $("forma").hidden = !o.entrega;
    if (o.entrega) $("lblEntrega").textContent = +o.entrega.taxa ? "+ R$ " + fmt(+o.entrega.taxa, 2) : "Sem custo";
    const pontos = (o.entrega && o.entrega.pontos) || [];
    $("pontoRetirada").innerHTML = pontos.map((p) => `<option>${esc(p)}</option>`).join("");
    $("notaTaxa").hidden = !o.taxas;
    $("notaTaxa").textContent = o.taxas ? "A taxa de serviço é descontada do valor do PIX e varia conforme o valor enviado." : "";
    const zap = "https://wa.me/" + C.whatsapp + "?text=" + encodeURIComponent("Olá! Quero fazer um câmbio pela Vélore Pay.");
    $("linkZap").href = zap;
    $("aviso").hidden = !C.aviso; $("aviso").textContent = C.aviso || "";
    $("horarios").innerHTML = (C.horarios || []).map((h) => `<dt>${esc(h.dia)}</dt><dd>${esc(h.hora)}</dd>`).join("");
  }
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* entrada */
  const input = $("valorBRL");
  input.addEventListener("input", render);
  input.addEventListener("blur", () => { const v = parseNum(input.value); input.value = v ? fmt(v, 2) : ""; });
  input.addEventListener("focus", () => { const v = parseNum(input.value); input.value = v ? String(v).replace(".", ",") : ""; });
  document.querySelectorAll(".atalhos button").forEach((b) => b.addEventListener("click", () => { input.value = fmt(+b.dataset.v, 2); render(); }));

  /* pedido */
  const folha = $("folha");
  const moedaEscolhida = () => document.querySelector('input[name="moeda"]:checked').value;
  function resumo() {
    const brl = parseNum(input.value), r = converter(brl), m = moedaEscolhida();
    $("resumo").innerHTML = `PIX de <b>R$ ${fmt(brl, 2)}</b> para receber <b>${m === "usd" ? "US$ " + fmt(r.usd, 2) : "Gs. " + fmt(r.pyg, 0)}</b>`;
  }
  document.querySelectorAll('input[name="forma"]').forEach((r) => r.addEventListener("change", render));
  $("btnPedido").addEventListener("click", () => {
    const o = opc(), ent = o.entrega && forma() === "entrega";
    $("campoEndereco").hidden = !ent;
    $("campoPonto").hidden = !(o.entrega && !ent && $("pontoRetirada").options.length);
    folha.hidden = false; resumo(); setTimeout(() => $("nome").focus(), 50); });
  folha.querySelectorAll("[data-fechar]").forEach((el) => el.addEventListener("click", () => (folha.hidden = true)));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") folha.hidden = true; });
  document.querySelectorAll('input[name="moeda"]').forEach((r) => r.addEventListener("change", resumo));

  $("formPedido").addEventListener("submit", (e) => {
    e.preventDefault();
    const nome = $("nome").value.trim();
    if (!nome) return $("nome").focus();
    const brl = parseNum(input.value), r = converter(brl), m = moedaEscolhida();
    const texto = [
      "Olá! Quero fazer um câmbio pela Vélore Pay.",
      "",
      "Nome: " + nome,
      "Vou enviar no PIX: R$ " + fmt(brl, 2),
      ...(r.taxa ? ["Taxa de serviço: R$ " + fmt(r.taxa, 2)] : []),
      ...(r.entrega ? ["Entrega: R$ " + fmt(r.entrega, 2)] : []),
      ...(r.taxa || r.entrega ? ["Valor convertido: R$ " + fmt(r.base, 2)] : []),
      m === "usd"
        ? "Quero receber: US$ " + fmt(r.usd, 2) + " (US$ 1 = R$ " + fmt(C.cotacao.usd, 2) + ")"
        : "Quero receber: Gs. " + fmt(r.pyg, 0) + " (R$ 1 = Gs. " + fmt(C.cotacao.pyg, 0) + ")",
      ...(opc().entrega ? ["", forma() === "entrega" ? "Entrega em: " + ($("endereco").value.trim() || "(vou informar)") : "Retirada" + ($("pontoRetirada").value ? ": " + $("pontoRetirada").value : "")] : []),
      "",
      "Aguardo a confirmação para fazer o PIX."
    ].join("\n");
    const abrir = (num) => window.open("https://wa.me/" + num + "?text=" + encodeURIComponent(texto), "_blank");
    abrir(C.whatsapp);
    if (C.whatsappSecundario) setTimeout(() => abrir(C.whatsappSecundario), 600);
    folha.hidden = true;
  });

  aplicarConfig(); render();
  carregar();
  setInterval(carregar, (C.atualizarACadaSegundos || 30) * 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) carregar(); });
})();
