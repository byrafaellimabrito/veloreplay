/* Vélore Pay — conversor PIX → Dólar / Guarani */
(function () {
  const C = window.VELORE_CONFIG;
  const $ = (id) => document.getElementById(id);
  let atualizadoEm = null;
  let online = false;

  const fmt = (v, casas) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
  const parseNum = (s) => {
    s = String(s || "").replace(/[^\d,.]/g, "");
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    else if ((s.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, "");
    const n = parseFloat(s);
    return isFinite(n) ? n : 0;
  };

  const converter = (brl) => ({
    usd: C.cotacao.usd > 0 ? Math.floor((brl / C.cotacao.usd) * 100) / 100 : 0,
    pyg: Math.floor(brl * C.cotacao.pyg)
  });

  function render() {
    const brl = parseNum($("valorBRL").value);
    const r = converter(brl);
    $("outUSD").textContent = "US$ " + fmt(r.usd, 2);
    $("outPYG").textContent = "Gs. " + fmt(r.pyg, 0);
    $("taxaUSD").textContent = "US$ 1 = R$ " + fmt(C.cotacao.usd, 2);
    $("taxaPYG").textContent = "R$ 1 = Gs. " + fmt(C.cotacao.pyg, 0);
    $("btnPedido").disabled = !(brl > 0);
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
    } catch (e) { online = false; }
    aplicarConfig(); render(); renderStatus();
  }

  function aplicarConfig() {
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
  $("btnPedido").addEventListener("click", () => { folha.hidden = false; resumo(); setTimeout(() => $("nome").focus(), 50); });
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
      m === "usd"
        ? "Quero receber: US$ " + fmt(r.usd, 2) + " (US$ 1 = R$ " + fmt(C.cotacao.usd, 2) + ")"
        : "Quero receber: Gs. " + fmt(r.pyg, 0) + " (R$ 1 = Gs. " + fmt(C.cotacao.pyg, 0) + ")",
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
