import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const C = window.VELORE_CONFIG;
const sb = createClient(C.supabaseUrl, C.supabaseKey);
const $ = (id) => document.getElementById(id);
let dados = null;

const parseNum = (s) => {
  s = String(s ?? "").replace(/[^\d,.]/g, "");
  if (!s) return NaN;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if ((s.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, "");
  return parseFloat(s);
};
const fmt = (v, casas) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const msg = (id, texto, tipo = "") => { $(id).textContent = texto; $(id).className = "msg " + tipo; };
const quando = (iso) => {
  const d = new Date(iso), hoje = new Date();
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return d.toDateString() === hoje.toDateString() ? "Hoje, " + hora : d.toLocaleDateString("pt-BR") + ", " + hora;
};

function tela(qual) {
  $("telaLogin").hidden = qual !== "login";
  $("telaPainel").hidden = qual !== "painel";
  $("telaSemAcesso").hidden = qual !== "sem";
  $("conta").hidden = qual === "login";
}

async function verificar() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return tela("login");
  $("userEmail").textContent = session.user.email;
  const { data: ok } = await sb.rpc("is_admin");
  if (!ok) return tela("sem");
  tela("painel");
  carregar();
}

$("telaLogin").addEventListener("submit", async (e) => {
  e.preventDefault();
  msg("msgLogin", "Entrando…");
  const { error } = await sb.auth.signInWithPassword({ email: $("loginEmail").value.trim(), password: $("loginSenha").value });
  if (error) return msg("msgLogin", /invalid/i.test(error.message) ? "E-mail ou senha incorretos." : error.message, "erro");
  msg("msgLogin", "");
  verificar();
});
$("btnSair").addEventListener("click", async () => { await sb.auth.signOut(); tela("login"); });

async function carregar() {
  const { data, error } = await sb.from("settings").select("data, updated_at, updated_by").eq("id", 1).single();
  if (error) return msg("msgCot", "Não foi possível carregar: " + error.message, "erro");
  dados = data.data;
  $("ultima").textContent = "Última alteração: " + quando(data.updated_at).toLowerCase() + (data.updated_by ? ", por " + data.updated_by : "");
  document.querySelector(`input[name="modo"][value="${dados.modo === "auto" ? "auto" : "manual"}"]`).checked = true;
  $("margemUsd").value = fmt(dados.auto?.margemUsd ?? 3, 1);
  $("margemPyg").value = fmt(dados.auto?.margemPyg ?? 3, 1);
  mostrarModo();
  $("usd").value = fmt(dados.cotacao?.usd ?? 0, 2);
  $("pyg").value = fmt(dados.cotacao?.pyg ?? 0, 0);
  $("whatsapp").value = dados.whatsapp || "";
  $("whatsapp2").value = dados.whatsappSecundario || "";
  $("aviso").value = dados.aviso || "";
  const horas = dados.horarios?.length ? dados.horarios : [{ dia: "", hora: "" }];
  $("horasEdit").innerHTML = horas.map((h) =>
    `<div><input aria-label="Dia" value="${esc(h.dia)}" placeholder="Seg a Sex" /><input aria-label="Horário" value="${esc(h.hora)}" placeholder="09h às 17h" /></div>`).join("");
  // opcionais
  const t = dados.taxas || {}, en = dados.entrega || {}, ar = dados.arredondarGuarani || {};
  $("detalhesAtivo").checked = dados.exibirDetalhes !== false;
  $("taxasAtivo").checked = !!t.ativo;
  renderFaixas(t.faixas?.length ? t.faixas : [{ ate: 100, taxa: 5 }, { ate: 500, taxa: 10 }, { ate: null, taxa: 20 }]);
  $("entregaAtivo").checked = !!en.ativo;
  $("taxaEntrega").value = en.taxa != null ? fmt(en.taxa, 2) : "";
  $("pontos").value = (en.pontos || []).join("\n");
  $("arredAtivo").checked = !!ar.ativo;
  $("multiplo").value = fmt(ar.multiplo || 50000, 0);
  mostrarOpcoes();
  previa();
  historico();
}

function previa() {
  const u = parseNum($("usd").value), g = parseNum($("pyg").value);
  if (!(u > 0) || !(g > 0)) { $("previa").textContent = "Preencha as duas cotações."; return; }
  $("previa").innerHTML = `Com essa cotação, um PIX de <b>R$ 100,00</b> mostra <b>US$ ${fmt(Math.floor(100 / u * 100) / 100, 2)}</b> e <b>Gs. ${fmt(Math.floor(100 * g), 0)}</b>.`;
}
["usd", "pyg"].forEach((id) => $(id).addEventListener("input", previa));

/* modo automático */
let mercado = null;
const modoAtual = () => document.querySelector('input[name="modo"]:checked').value;
function mostrarModo() {
  const auto = modoAtual() === "auto";
  $("blocoAuto").hidden = !auto;
  $("tituloManual").hidden = !auto;
  $("cotas").classList.toggle("reserva", auto);
  $("btnCot").textContent = auto ? "Salvar e usar cotação automática" : "Publicar cotação";
  if (auto && !mercado) atualizarMercado();
  previaAuto();
}
document.querySelectorAll('input[name="modo"]').forEach((r) => r.addEventListener("change", mostrarModo));
["margemUsd", "margemPyg"].forEach((id) => $(id).addEventListener("input", previaAuto));
async function atualizarMercado() {
  try {
    mercado = await window.buscarMercado();
    $("mercado").innerHTML = `Mercado agora (${mercado.fonte}, ${quando(mercado.quando).toLowerCase()}): <b>US$ 1 = R$ ${fmt(mercado.usd, 4)}</b> e <b>R$ 1 = Gs. ${fmt(mercado.pyg, 0)}</b>`;
  } catch (e) {
    mercado = null;
    $("mercado").textContent = "Não foi possível consultar o mercado agora. Enquanto isso, o site usa a cotação manual.";
  }
  previaAuto();
}
function previaAuto() {
  if (!mercado) { $("previaAuto").textContent = ""; return; }
  const c = window.cotacaoComMargem(mercado, { margemUsd: parseNum($("margemUsd").value) || 0, margemPyg: parseNum($("margemPyg").value) || 0 });
  $("previaAuto").innerHTML = `O cliente vai ver <b>US$ 1 = R$ ${fmt(c.usd, 2)}</b> e <b>R$ 1 = Gs. ${fmt(c.pyg, 0)}</b>. Um PIX de R$ 100,00 mostra <b>US$ ${fmt(Math.floor(100 / c.usd * 100) / 100, 2)}</b> e <b>Gs. ${fmt(Math.floor(100 * c.pyg), 0)}</b>.`;
}
setInterval(() => { if (modoAtual() === "auto") atualizarMercado(); }, 60000);

async function salvar(novo, msgId, texto) {
  msg(msgId, "Salvando…");
  const { error } = await sb.from("settings").update({ data: novo }).eq("id", 1);
  if (error) return msg(msgId, "Não foi salvo: " + error.message, "erro");
  await carregar();
  msg(msgId, texto, "ok");
}

$("formCot").addEventListener("submit", (e) => {
  e.preventDefault();
  const u = parseNum($("usd").value), g = parseNum($("pyg").value);
  if (!(u > 0) || !(g > 0)) return msg("msgCot", "Preencha o dólar e o guarani com valores maiores que zero.", "erro");
  const auto = modoAtual() === "auto";
  const mu = parseNum($("margemUsd").value), mp = parseNum($("margemPyg").value);
  salvar({ ...dados, cotacao: { usd: u, pyg: g }, modo: auto ? "auto" : "manual", auto: { margemUsd: isNaN(mu) ? 0 : mu, margemPyg: isNaN(mp) ? 0 : mp } },
    "msgCot", auto ? "Cotação automática ligada. O site já usa o mercado com a margem." : "Cotação publicada. O site já mostra os novos valores.");
});

$("formGeral").addEventListener("submit", (e) => {
  e.preventDefault();
  const zap = $("whatsapp").value.replace(/\D/g, "");
  if (zap.length < 12) return msg("msgGeral", "Use o número com 55 e DDD, por exemplo 55 75 99999-9999.", "erro");
  const horarios = [...$("horasEdit").children]
    .map((d) => ({ dia: d.children[0].value.trim(), hora: d.children[1].value.trim() }))
    .filter((h) => h.dia);
  salvar({ ...dados, whatsapp: zap, whatsappSecundario: $("whatsapp2").value.replace(/\D/g, ""), aviso: $("aviso").value.trim(), horarios },
    "msgGeral", "Atendimento salvo.");
});

function renderFaixas(faixas) {
  $("faixas").innerHTML = faixas.map((f) =>
    `<tr><td><input aria-label="PIX até" inputmode="decimal" value="${f.ate == null ? "" : fmt(f.ate, 2)}" placeholder="acima disso" /></td>` +
    `<td><input aria-label="Taxa" inputmode="decimal" value="${fmt(f.taxa ?? 0, 2)}" /></td>` +
    `<td><button type="button" class="remover" aria-label="Remover faixa">×</button></td></tr>`).join("");
}
const lerFaixas = () => [...$("faixas").rows].map((tr) => {
  const ate = parseNum(tr.cells[0].querySelector("input").value), taxa = parseNum(tr.cells[1].querySelector("input").value);
  return { ate: isNaN(ate) ? null : ate, taxa: isNaN(taxa) ? 0 : taxa };
});
$("faixas").addEventListener("click", (e) => { if (e.target.classList.contains("remover")) e.target.closest("tr").remove(); });
$("addFaixa").addEventListener("click", () => renderFaixas([...lerFaixas(), { ate: null, taxa: 0 }]));
function mostrarOpcoes() {
  document.querySelectorAll(".opcao-corpo").forEach((el) => (el.hidden = !$(el.dataset.de).checked));
}
["taxasAtivo", "entregaAtivo", "arredAtivo"].forEach((id) => $(id).addEventListener("change", mostrarOpcoes));

$("formOpc").addEventListener("submit", (e) => {
  e.preventDefault();
  const faixas = lerFaixas().sort((a, b) => (a.ate ?? Infinity) - (b.ate ?? Infinity));
  if ($("taxasAtivo").checked && !faixas.length) return msg("msgOpc", "Adicione pelo menos uma faixa de taxa.", "erro");
  const te = parseNum($("taxaEntrega").value), mult = parseNum($("multiplo").value);
  if ($("arredAtivo").checked && !(mult > 1)) return msg("msgOpc", "Informe o múltiplo do arredondamento, por exemplo 50.000.", "erro");
  salvar({
    ...dados,
    exibirDetalhes: $("detalhesAtivo").checked,
    taxas: { ativo: $("taxasAtivo").checked, faixas },
    entrega: { ativo: $("entregaAtivo").checked, taxa: isNaN(te) ? 0 : te, pontos: $("pontos").value.split("\n").map((x) => x.trim()).filter(Boolean) },
    arredondarGuarani: { ativo: $("arredAtivo").checked, multiplo: isNaN(mult) ? 50000 : mult }
  }, "msgOpc", "Opcionais salvos. O site já mostra as mudanças.");
});

async function historico() {
  const { data } = await sb.from("rate_history").select("created_at, usd, pyg, by_email").order("created_at", { ascending: false }).limit(15);
  $("hist").innerHTML = data?.length
    ? data.map((h) => `<tr><td>${quando(h.created_at)}</td><td>R$ ${fmt(h.usd, 2)}</td><td>Gs. ${fmt(h.pyg, 0)}</td><td>${esc(h.by_email || "")}</td></tr>`).join("")
    : `<tr><td colspan="4" class="vazio">As próximas mudanças de cotação aparecem aqui.</td></tr>`;
}

mostrarOpcoes();
verificar();
