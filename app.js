/* Vélore Pay — calculadora de câmbio via PIX */
(function () {
  const C = window.VELORE_CONFIG;
  const $ = (id) => document.getElementById(id);

  const estado = {
    modo: "pagar",         // "pagar" (digita R$) | "receber" (digita moeda estrangeira)
    moeda: "USD",          // moeda escolhida para o pedido
    taxas: { ...C.cotacaoManual }, // quanto o cliente recebe por R$ 1
    fonte: "manual",
    ultimo: null
  };

  /* ---------- formatação ---------- */
  const fmtBRL = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtMoeda = (v, m) => {
    const d = C.moedas[m];
    return d.simbolo + " " + v.toLocaleString("pt-BR", { minimumFractionDigits: d.casas, maximumFractionDigits: d.casas });
  };
  const fmtCot = (m) => {
    const v = estado.taxas[m];
    const casas = m === "USD" ? 4 : 0;
    return C.moedas[m].simbolo + " " + v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
  };
  const parseNum = (s) => {
    if (!s) return 0;
    s = String(s).replace(/[^\d,.]/g, "");
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    else if ((s.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, "");
    const n = parseFloat(s);
    return isFinite(n) ? n : 0;
  };
  const arred = (v) => Math.round(v * 100) / 100;

  /* ---------- taxas ---------- */
  const taxaServico = (base) => {
    if (base <= 0) return 0;
    for (const f of C.faixasTaxa) if (base <= f.ate) return f.taxa;
    return C.faixasTaxa[C.faixasTaxa.length - 1].taxa;
  };
  const taxaEntrega = () =>
    document.querySelector('input[name="entrega"]:checked').value === "entrega" ? C.taxaEntrega : 0;

  // Cliente paga B no PIX -> quanto recebe em m
  function calcDoBRL(B, m) {
    const ent = taxaEntrega();
    let base = 0, fee = 0, prev = 0, prevFee = 0;
    for (const f of C.faixasTaxa) {
      const b = B - ent - f.taxa;
      if (b > prev && b <= f.ate) { base = b; fee = f.taxa; break; }
      if (b > 0 && b <= prev) { base = prev; fee = prevFee; break; } // borda entre faixas
      prev = f.ate; prevFee = f.taxa;
    }
    if (base <= 0) return null;
    let recebe = base * estado.taxas[m];
    const mult = C.moedas[m].multiplo;
    let ajustado = false;
    if (mult > 1) {
      const r = Math.floor(recebe / mult) * mult;
      if (r <= 0) return { insuficiente: true, minimo: calcDoEstrangeiro(mult, m) };
      ajustado = r !== recebe;
      recebe = r;
      base = recebe / estado.taxas[m];
      fee = taxaServico(base);
    } else {
      recebe = Math.floor(recebe * 100) / 100;
    }
    return { m, base: arred(base), fee, ent, total: arred(base + fee + ent), recebe, ajustado };
  }

  // Cliente quer receber Y em m -> quanto paga
  function calcDoEstrangeiro(Y, m) {
    const mult = C.moedas[m].multiplo;
    if (mult > 1) Y = Math.ceil(Y / mult) * mult;
    if (Y <= 0) return null;
    const base = Y / estado.taxas[m];
    const fee = taxaServico(base);
    const ent = taxaEntrega();
    return { m, base: arred(base), fee, ent, total: arred(base + fee + ent), recebe: Y, ajustado: false };
  }

  /* ---------- cotação online ---------- */
  async function buscarCotacao() {
    if (C.modoCotacao !== "auto") { estado.fonte = "manual"; renderCot(true); return calcular(); }
    let mercado = null;
    try {
      const r = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL,PYG-BRL", { cache: "no-store" });
      const j = await r.json();
      mercado = { USD: 1 / parseFloat(j.USDBRL.bid), PYG: 1 / parseFloat(j.PYGBRL.bid) };
    } catch (e) {
      try {
        const r = await fetch("https://open.er-api.com/v6/latest/BRL", { cache: "no-store" });
        const j = await r.json();
        mercado = { USD: j.rates.USD, PYG: j.rates.PYG };
      } catch (e2) { mercado = null; }
    }
    if (mercado && isFinite(mercado.USD) && isFinite(mercado.PYG)) {
      for (const m of ["USD", "PYG"]) estado.taxas[m] = mercado[m] * (1 - (C.spreadPercentual[m] || 0) / 100);
      estado.fonte = "online";
      estado.ultimo = new Date();
      renderCot(true);
    } else {
      estado.fonte = "manual";
      renderCot(false);
    }
    calcular();
  }

  function renderCot(ok) {
    $("cotUSD").textContent = fmtCot("USD");
    $("cotPYG").textContent = fmtCot("PYG");
    $("pontoStatus").className = "ponto " + (ok ? "ok" : "err");
    const hora = (estado.ultimo || new Date()).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    $("statusCot").textContent = ok
      ? (estado.fonte === "online" ? "Cotação ao vivo · atualizada em " + hora : "Cotação do dia · atualizada em " + hora)
      : "Sem conexão com a cotação online — usando cotação de referência";
  }

  /* ---------- cálculo + tela ---------- */
  let resultado = null;

  function calcular() {
    const moedas = ["USD", "PYG"];
    let res = {};
    $("dicaMultiplo").textContent = "";

    if (estado.modo === "pagar") {
      const B = parseNum($("valorBRL").value);
      moedas.forEach((m) => (res[m] = B > 0 ? calcDoBRL(B, m) : null));
    } else {
      const m = $("moedaReceber").value;
      estado.moeda = m;
      const Ybruto = parseNum($("valorEstrangeiro").value);
      const r = calcDoEstrangeiro(Ybruto, m);
      res[m] = r;
      const mult = C.moedas[m].multiplo;
      if (mult > 1) {
        $("dicaMultiplo").textContent = r && r.recebe !== Ybruto
          ? `Ajustado para ${fmtMoeda(r.recebe, m)} — trabalhamos com notas de 50.000 e 100.000.`
          : "Valores em múltiplos de 50.000 (notas de 50 mil e 100 mil).";
      }
      const outra = m === "USD" ? "PYG" : "USD";
      res[outra] = r ? calcDoBRL(r.total, outra) : null;
    }

    moedas.forEach((m) => {
      const r = res[m];
      const out = $("out" + m), lbl = $("lbl" + m);
      if (!r) { out.textContent = C.moedas[m].simbolo + " —"; lbl.textContent = "Valor que você receberá"; }
      else if (r.insuficiente) { out.textContent = C.moedas[m].simbolo + " 0"; lbl.textContent = "Mínimo: " + fmtBRL(r.minimo.total) + " no PIX"; }
      else { out.textContent = fmtMoeda(r.recebe, m); lbl.textContent = r.ajustado ? "Arredondado p/ notas de 50 mil" : "Valor que você receberá"; }
      document.querySelector(`.card-moeda[data-moeda="${m}"]`).classList.toggle("selecionado", m === estado.moeda);
    });

    resultado = res[estado.moeda];
    const ok = resultado && !resultado.insuficiente;
    $("rMoeda").textContent = C.moedas[estado.moeda].nome + " (" + estado.moeda + ")";
    $("rCot").textContent = "R$ 1 = " + fmtCot(estado.moeda);
    $("rConv").textContent = ok ? fmtBRL(resultado.base) : "—";
    $("rTaxa").textContent = ok ? fmtBRL(resultado.fee) : "—";
    $("rEnt").textContent = ok ? (resultado.ent ? fmtBRL(resultado.ent) : "Grátis") : "—";
    $("rTotal").textContent = ok ? fmtBRL(resultado.total) : "R$ 0,00";
    $("rRecebe").textContent = ok ? fmtMoeda(resultado.recebe, estado.moeda) : "—";
    $("btnPedido").disabled = !ok;
  }

  /* ---------- WhatsApp ---------- */
  const linkZap = (num, txt) => `https://wa.me/${num}${txt ? "?text=" + encodeURIComponent(txt) : ""}`;

  function mensagem(nome) {
    const r = resultado, m = estado.moeda;
    const ent = document.querySelector('input[name="entrega"]:checked').value;
    const local = ent === "entrega" ? "Entrega: " + ($("endereco").value || "(informar endereço)") : "Retirada: " + $("pontoRetirada").value;
    return [
      "*NOVO PEDIDO — VÉLORE PAY* 🚀",
      "",
      "👤 Nome: " + nome,
      "💱 Moeda: " + C.moedas[m].nome + " (" + m + ")",
      "💵 Vou receber: " + fmtMoeda(r.recebe, m),
      "📈 Cotação: R$ 1 = " + fmtCot(m),
      "",
      "Valor convertido: " + fmtBRL(r.base),
      "Taxa de serviço: " + fmtBRL(r.fee),
      "Taxa de entrega: " + (r.ent ? fmtBRL(r.ent) : "Grátis"),
      "*Total no PIX: " + fmtBRL(r.total) + "*",
      "",
      "📍 " + local,
      "",
      "Aguardo a confirmação da cotação para fazer o PIX."
    ].join("\n");
  }

  /* ---------- eventos ---------- */
  document.querySelectorAll(".modo button").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll(".modo button").forEach((x) => x.classList.toggle("ativo", x === b));
      estado.modo = b.dataset.modo;
      $("campoPagar").hidden = estado.modo !== "pagar";
      $("campoReceber").hidden = estado.modo !== "receber";
      if (estado.modo === "receber") $("moedaReceber").value = estado.moeda;
      calcular();
    })
  );
  document.querySelectorAll(".card-moeda").forEach((c) =>
    c.addEventListener("click", () => {
      estado.moeda = c.dataset.moeda;
      $("moedaReceber").value = estado.moeda;
      calcular();
    })
  );
  ["valorBRL", "valorEstrangeiro"].forEach((id) => $(id).addEventListener("input", calcular));
  $("moedaReceber").addEventListener("change", calcular);
  document.querySelectorAll('input[name="entrega"]').forEach((r) =>
    r.addEventListener("change", () => {
      const e = r.value === "entrega" && r.checked;
      $("endereco").hidden = !e;
      $("pontoRetirada").hidden = e;
      calcular();
    })
  );
  $("valorBRL").addEventListener("blur", (e) => {
    const v = parseNum(e.target.value);
    if (v) e.target.value = v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  });
  $("valorEstrangeiro").addEventListener("blur", (e) => {
    const v = parseNum(e.target.value);
    if (v) e.target.value = v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  });

  $("btnPedido").addEventListener("click", () => { $("modal").hidden = false; $("nomeCliente").focus(); });
  $("btnCancelar").addEventListener("click", () => ($("modal").hidden = true));
  $("modal").addEventListener("click", (e) => { if (e.target.id === "modal") $("modal").hidden = true; });
  $("btnConfirmar").addEventListener("click", () => {
    const nome = $("nomeCliente").value.trim();
    if (!nome) { $("nomeCliente").focus(); $("nomeCliente").style.borderColor = "var(--err)"; return; }
    const txt = mensagem(nome);
    window.open(linkZap(C.whatsapp, txt), "_blank");
    if (C.whatsappSecundario) setTimeout(() => window.open(linkZap(C.whatsappSecundario, txt), "_blank"), 600);
    $("modal").hidden = true;
  });

  /* ---------- configuração do painel (Supabase) ---------- */
  async function carregarConfigOnline() {
    if (!C.supabaseUrl || !C.supabaseKey) return;
    try {
      const r = await fetch(C.supabaseUrl + "/rest/v1/settings?id=eq.1&select=data,updated_at", {
        headers: { apikey: C.supabaseKey }, cache: "no-store"
      });
      const [row] = await r.json();
      if (!row) return;
      const d = row.data || {};
      if (Array.isArray(d.faixasTaxa)) d.faixasTaxa = d.faixasTaxa.map((f) => ({ ate: f.ate == null ? Infinity : +f.ate, taxa: +f.taxa }));
      Object.assign(C, d);
      estado.taxas = { ...C.cotacaoManual };
      estado.ultimo = new Date(row.updated_at);
    } catch (e) { /* mantém config.js */ }
  }

  /* ---------- inicialização ---------- */
  async function init() {
    await carregarConfigOnline();
    if (C.aviso) { $("avisoTexto").textContent = C.aviso; $("aviso").hidden = false; }
    $("slogan").textContent = C.slogan;
    const zap = linkZap(C.whatsapp, "Olá! Vim pelo site da Vélore Pay e quero fazer um câmbio.");
    $("zapTopo").href = zap; $("zapFlut").href = zap;
    $("lblTaxaEntrega").textContent = C.taxaEntrega ? "+ " + fmtBRL(C.taxaEntrega) : "grátis";
    $("pontoRetirada").innerHTML = C.pontosRetirada.map((p) => `<option>${p}</option>`).join("");
    $("horarios").innerHTML = C.horarios.map((h) => `<li><span>${h.dia}</span><span>${h.hora}</span></li>`).join("");
    let prev = 0;
    $("tabelaTaxas").querySelector("tbody").innerHTML = C.faixasTaxa.map((f) => {
      const faixa = f.ate === Infinity ? "Acima de " + fmtBRL(prev) : (prev ? fmtBRL(prev + 0.01) + " a " : "Até ") + fmtBRL(f.ate);
      prev = f.ate;
      return `<tr><td>${faixa}</td><td>${fmtBRL(f.taxa)}</td></tr>`;
    }).join("");
    renderCot(true);
    calcular();
    buscarCotacao();
    setInterval(async () => { await carregarConfigOnline(); buscarCotacao(); }, (C.atualizarACadaSegundos || 60) * 1000);
  }
  init();
})();
