/* Vélore Pay — configuração base.
   A cotação, o WhatsApp, o aviso e os horários são alterados pelo painel (/admin.html)
   e ficam salvos no banco. Os valores abaixo só aparecem se o banco estiver fora do ar. */
window.VELORE_CONFIG = {
  supabaseUrl: "https://rmvuggmfoouvldgjyqxy.supabase.co",
  supabaseKey: "sb_publishable_jEfQ91jvUeUWBk2U9DiWOw_Qe__bOIi",

  cotacao: { usd: 5.56, pyg: 1160 }, // usd = R$ por US$ 1 · pyg = Gs. por R$ 1
  whatsapp: "5575983604904",
  whatsappSecundario: "",
  aviso: "",
  horarios: [
    { dia: "Seg a Sex", hora: "09h às 17h" },
    { dia: "Sábado", hora: "09h às 13h" },
    { dia: "Domingo", hora: "Fechado" }
  ],
  atualizarACadaSegundos: 30
};
