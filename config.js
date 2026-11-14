/* =========================================================
   VÉLORE PAY — CONFIGURAÇÃO
   Edite este arquivo para mudar cotação, taxas, WhatsApp etc.
   ========================================================= */
window.VELORE_CONFIG = {
  // Banco de dados (Supabase) — o painel /admin.html grava aqui e o site lê.
  // Os valores abaixo deste bloco só são usados se o banco estiver fora do ar.
  supabaseUrl: "https://rmvuggmfoouvldgjyqxy.supabase.co",
  supabaseKey: "sb_publishable_jEfQ91jvUeUWBk2U9DiWOw_Qe__bOIi",

  empresa: "Vélore Pay",
  slogan: "Crédito inteligente. Limite imediato.",

  // WhatsApp que recebe os pedidos (somente números, com DDI 55 + DDD)
  whatsapp: "5575983604904",
  // Segundo WhatsApp opcional (deixe "" para desativar)
  whatsappSecundario: "",

  horarios: [
    { dia: "Seg a Sex", hora: "09h às 17h" },
    { dia: "Sábado", hora: "09h às 13h" },
    { dia: "Domingo", hora: "Fechado" }
  ],

  // Aviso no topo do site (deixe "" para esconder)
  aviso: "Cotação sujeita a confirmação no momento do pedido.",

  /* ---------- COTAÇÃO ----------
     modo "auto": busca a cotação de mercado na internet e aplica o spread.
     modo "manual": usa os valores de cotacaoManual (quanto o cliente recebe por R$ 1).
  */
  modoCotacao: "manual",
  spreadPercentual: { USD: 4.0, PYG: 3.0 }, // margem descontada da cotação de mercado
  cotacaoManual: { USD: 0.18, PYG: 1160 }, // usada no modo manual ou se a API falhar
  atualizarACadaSegundos: 60,

  moedas: {
    USD: { nome: "Dólar", simbolo: "US$", casas: 2, multiplo: 1 },
    // Guarani só em notas de 50.000 e 100.000 -> múltiplos de 50.000 (0 desativa)
    PYG: { nome: "Guarani", simbolo: "Gs.", casas: 0, multiplo: 50000 }
  },

  // Taxa de serviço por faixa (valor em R$ convertido). "ate": limite superior.
  faixasTaxa: [
    { ate: 100, taxa: 5 },
    { ate: 300, taxa: 8 },
    { ate: 500, taxa: 12 },
    { ate: 1000, taxa: 20 },
    { ate: 3000, taxa: 35 },
    { ate: 5000, taxa: 50 },
    { ate: 10000, taxa: 75 },
    { ate: Infinity, taxa: 100 }
  ],

  // Retirada / entrega
  taxaEntrega: 10, // R$ (0 = grátis)
  pontosRetirada: [
    "Escritório Vélore Pay — Centro",
    "Ponto de apoio — combinar pelo WhatsApp"
  ]
};
