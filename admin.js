import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const C = window.VELORE_CONFIG;
const sb = createClient(C.supabaseUrl, C.supabaseKey);
const $ = (id) => document.getElementById(id);

let dados = null; // conteúdo da coluna settings.data

/* ---------- utilidades ---------- */
const parseNum = (s) => {
  if (s == null || s === "") return NaN;
  s = String(s).replace(/[^\d,.-]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if ((s.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, "");
  return parseFloat(s);
};
const br = (v, casas = 2) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const msg = (id, texto, tipo) => { const el = $(id); el.textContent = texto; el.className = "msg " + (tipo || ""); };
const tela = (qual) => {
  $("telaLogin").hidden = qual !== "login";
  $("telaPainel").hidden = qual !== "painel";
  $("telaSemAcesso").hidden = qual !== "sem";
  $("userBox").hidden = qual === "login";
};

/* ---------- autenticação ---------- */
async function verificarSessao() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return tela("login");
  $("userEmail").textContent = session.user.email;
  const { data: ehAdmin } = await sb.rpc("is_admin");
  if (!ehAdmin) return tela("sem");
  tela("painel");
  await carregar();
}

$("btnEntrar").onclick = async () => {
  msg("msgLogin", "Entrando…");
  const { error } = await sb.auth.signInWithPassword({ email: $("loginEmail").value.trim(), password: $("loginSenha").value });
  if (error) return msg("msgLogin", error.message.includes("Invalid") ? "E-mail ou senha incorretos." : error.message.includes("confirm") ? "Confirme seu e-mail pelo link enviado antes de entrar." : error.message, "err");
  msg("msgLogin", "");
  verificarSessao();
};
$("loginSenha").addEventListener("keydown", (e) => e.key === "Enter" && $("btnEntrar").click());

$("btnCriar").onclick = async () => {
  const email = $("loginEmail").value.trim(), password = $("loginSenha").value;
  if (!email || password.length < 8) return msg("msgLogin", "Digite seu e-mail e uma senha com pelo menos 8 caracteres e clique de novo.", "err");
  const { error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.href.split("#")[0] } });
  if (error) return msg("msgLogin", error.message, "err");
  msg("msgLogin", "Pronto! Enviamos um link de confirmação para " + email + ". Confirme e depois entre aqui.", "ok");
};

$("btnEsqueci").onclick = async () => {
  const email = $("loginEmail").value.trim();
  if (!email) return msg("msgLogin", "Digite seu e-mail e clique em \"Esqueci a senha\".", "err");
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.href.split("#")[0] });
  msg("msgLogin", error ? error.message : "Link de redefinição enviado para " + email + ".", error ? "err" : "ok");
};

sb.auth.onAuthStateChange(async (ev) => {
  if (ev === "PASSWORD_RECOVERY") {
    const nova = prompt("Digite a nova senha (mínimo 8 caracteres):");
    if (nova && nova.length >= 8) {
      const { error } = await sb.auth.updateUser({ password: nova });
      alert(error ? "Erro: " + error.message : "Senha alterada!");
    }
    verificarSessao();
  }
});

$("btnSair").onclick = async () => { await sb.auth.signOut(); tela("login"); };

/* ---------- carregar e preencher ---------- */
async function carregar() {
  const { data, error } = await sb.from("settings").select("data, updated_at, updated_by").eq("id", 1).single();
  if (error) return msg("msgCot", "Erro ao carregar: " + error.message, "err");
  dados = data.data;
  $("ultimaAtualizacao").textContent = "Última atualização: " + new Date(data.updated_at).toLocaleString("pt-BR") + (data.updated_by ? " · " + data.updated_by : "");

  document.querySelector(`input[name="modo"][value="${dados.modoCotacao || "manual"}"]`).checked = true;
  $("precoUSD").value = dados.cotacaoManual?.USD ? br(1 / dados.cotacaoManual.USD, 2) : "";
  $("cotPYGin").value = dados.cotacaoManual?.PYG ? br(dados.cotacaoManual.PYG, 0) : "";
  $("spreadUSD").value = br(dados.spreadPercentual?.USD ?? 0, 1);
  $("spreadPYG").value = br(dados.spreadPercentual?.PYG ?? 0, 1);
  $("taxaEntrega").value = br(dados.taxaEntrega ?? 0);
  $("whatsapp").value = dados.whatsapp || "";
  $("whatsapp2").value = dados.whatsappSecundario || "";
  $("aviso").value = dados.aviso || "";
  $("pontos").value = (dados.pontosRetirada || []).join("\n");

  $("horariosEdit").innerHTML = (dados.horarios || []).map((h) =>
    `<div><input value="${esc(h.dia)}" data-h="dia" /><input value="${esc(h.hora)}" data-h="hora" /></div>`).join("");

  renderFaixas(dados.faixasTaxa || []);
  atualizarModo(); atualizarConv();
  carregarHistorico();
  mercado();
}
const esc = (s) => String(s ?? "").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function renderFaixas(faixas) {
  $("tblFaixas").querySelector("tbody").innerHTML = faixas.map((f) =>
    `<tr><td><input data-f="ate" inputmode="decimal" value="${f.ate == null ? "" : br(f.ate)}" placeholder="acima de…" /></td>
     <td><input data-f="taxa" inputmode="decimal" value="${br(f.taxa)}" /></td>
     <td><button class="del" title="Remover">×</button></td></tr>`).join("");
  $("tblFaixas").querySelectorAll(".del").forEach((b) => (b.onclick = () => b.closest("tr").remove()));
}
$("btnAddFaixa").onclick = () => {
  const linhas = lerFaixas(true);
  linhas.push({ ate: null, taxa: 0 });
  renderFaixas(linhas);
};
function lerFaixas(semValidar) {
  const out = [];
  $("tblFaixas").querySelectorAll("tbody tr").forEach((tr) => {
    const ate = parseNum(tr.querySelector('[data-f="ate"]').value);
    const taxa = parseNum(tr.querySelector('[data-f="taxa"]').value);
    out.push({ ate: isNaN(ate) ? null : ate, taxa: isNaN(taxa) ? 0 : taxa });
  });
  if (semValidar) return out;
  out.sort((a, b) => (a.ate ?? Infinity) - (b.ate ?? Infinity));
  return out;
}

/* ---------- conversões na tela ---------- */
function atualizarModo() {
  const auto = document.querySelector('input[name="modo"]:checked').value === "auto";
  document.querySelectorAll(".auto-only").forEach((el) => el.classList.toggle("disabled-box", !auto));
  document.querySelectorAll(".cot-edit .input-moeda").forEach((el) => el.classList.toggle("disabled-box", auto));
}
document.querySelectorAll('input[name="modo"]').forEach((r) => r.addEventListener("change", atualizarModo));

function atualizarConv() {
  const p = parseNum($("precoUSD").value);
  $("convUSD").textContent = p > 0 ? `Cliente paga R$ ${br(p)} por US$ 1 → R$ 1 = US$ ${br(1 / p, 4)}` : "";
  const g = parseNum($("cotPYGin").value);
  $("convPYG").textContent = g > 0 ? `R$ 100 = Gs. ${br(g * 100, 0)}` : "";
}
["precoUSD", "cotPYGin"].forEach((id) => $(id).addEventListener("input", atualizarConv));

async function mercado() {
  try {
    const r = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL,PYG-BRL");
    const j = await r.json();
    $("mercUSD").textContent = `Mercado agora: US$ 1 = R$ ${br(parseFloat(j.USDBRL.bid), 4)}`;
    $("mercPYG").textContent = `Mercado agora: R$ 1 = Gs. ${br(1 / parseFloat(j.PYGBRL.bid), 0)}`;
  } catch (e) { /* referência opcional */ }
}

/* ---------- salvar ---------- */
async function salvar(novo, msgId) {
  msg(msgId, "Salvando…");
  const { error } = await sb.from("settings").update({ data: novo }).eq("id", 1);
  if (error) return msg(msgId, "Erro ao salvar: " + error.message, "err");
  msg(msgId, "✔ Salvo! O site já está usando os novos valores.", "ok");
  await carregar();
  msg(msgId, "✔ Salvo! O site já está usando os novos valores.", "ok");
}

$("btnSalvarCot").onclick = () => {
  const p = parseNum($("precoUSD").value), g = parseNum($("cotPYGin").value);
  const modo = document.querySelector('input[name="modo"]:checked').value;
  if (!(p > 0) || !(g > 0)) return msg("msgCot", "Preencha o preço do dólar e a cotação do guarani.", "err");
  const sU = parseNum($("spreadUSD").value), sP = parseNum($("spreadPYG").value);
  salvar({
    ...dados,
    modoCotacao: modo,
    cotacaoManual: { USD: +(1 / p).toFixed(6), PYG: g },
    spreadPercentual: { USD: isNaN(sU) ? 0 : sU, PYG: isNaN(sP) ? 0 : sP }
  }, "msgCot");
};

$("btnSalvarGeral").onclick = () => {
  const faixas = lerFaixas();
  if (!faixas.length) return msg("msgGeral", "Cadastre pelo menos uma faixa de taxa.", "err");
  const zap = $("whatsapp").value.replace(/\D/g, "");
  if (zap.length < 12) return msg("msgGeral", "WhatsApp inválido. Use 55 + DDD + número.", "err");
  const ent = parseNum($("taxaEntrega").value);
  salvar({
    ...dados,
    faixasTaxa: faixas,
    taxaEntrega: isNaN(ent) ? 0 : ent,
    whatsapp: zap,
    whatsappSecundario: $("whatsapp2").value.replace(/\D/g, ""),
    aviso: $("aviso").value.trim(),
    pontosRetirada: $("pontos").value.split("\n").map((s) => s.trim()).filter(Boolean),
    horarios: [...$("horariosEdit").children].map((d) => ({
      dia: d.querySelector('[data-h="dia"]').value.trim(),
      hora: d.querySelector('[data-h="hora"]').value.trim()
    })).filter((h) => h.dia)
  }, "msgGeral");
};

async function carregarHistorico() {
  const { data } = await sb.from("rate_history").select("*").order("created_at", { ascending: false }).limit(20);
  $("tblHist").querySelector("tbody").innerHTML = (data || []).map((h) =>
    `<tr><td>${new Date(h.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td>
     <td>R$ ${br(1 / h.usd)}</td><td>Gs. ${br(h.pyg, 0)}</td><td>${esc(h.by_email || "")}</td></tr>`).join("")
    || `<tr><td colspan="4" class="muted">Nenhuma alteração ainda.</td></tr>`;
}

verificarSessao();
