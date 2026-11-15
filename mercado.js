/* Cotação de mercado (usada no modo automático).
   Fonte principal: AwesomeAPI (economia.awesomeapi.com.br).
   Reserva: ExchangeRate-API (open.er-api.com).
   Retorna { usd: R$ por US$ 1, pyg: Gs. por R$ 1, quando: Date, fonte } */
window.buscarMercado = async function () {
  try {
    const r = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL,PYG-BRL", { cache: "no-store" });
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    const usd = parseFloat(j.USDBRL.bid), pygBrl = parseFloat(j.PYGBRL.bid);
    if (!(usd > 0) || !(pygBrl > 0)) throw new Error("valores inválidos");
    const ts = Math.max(+j.USDBRL.timestamp || 0, +j.PYGBRL.timestamp || 0);
    return { usd, pyg: 1 / pygBrl, quando: ts ? new Date(ts * 1000) : new Date(), fonte: "AwesomeAPI" };
  } catch (e) {
    const r = await fetch("https://open.er-api.com/v6/latest/BRL", { cache: "no-store" });
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    if (!(j.rates && j.rates.USD > 0 && j.rates.PYG > 0)) throw new Error("valores inválidos");
    return { usd: 1 / j.rates.USD, pyg: j.rates.PYG, quando: new Date(j.time_last_update_unix * 1000), fonte: "ExchangeRate-API" };
  }
};

/* Aplica a margem da casa: o cliente paga mais reais por dólar e recebe menos guaranis por real. */
window.cotacaoComMargem = function (m, auto) {
  const mu = +(auto && auto.margemUsd) || 0, mp = +(auto && auto.margemPyg) || 0;
  return {
    usd: Math.round(m.usd * (1 + mu / 100) * 100) / 100,
    pyg: Math.round(m.pyg * (1 - mp / 100))
  };
};
