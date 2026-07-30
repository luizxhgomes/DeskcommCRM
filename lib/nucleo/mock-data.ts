export const squads = [
  { slug: "sales", name: "Sales", agents: 23, status: "Pronto", focus: "Receita e pipeline", chief_agent_id: null },
  { slug: "cmo", name: "CMO", agents: 22, status: "Pronto", focus: "Estratégia e crescimento", chief_agent_id: null },
  { slug: "copy", name: "Copy", agents: 29, status: "Pronto", focus: "Mensagem e conversão", chief_agent_id: null },
  { slug: "dr", name: "DR", agents: 23, status: "Pronto", focus: "Diagnóstico e pesquisa", chief_agent_id: null },
  { slug: "legal", name: "Legal", agents: 22, status: "Pronto", focus: "Risco e contratos", chief_agent_id: null },
  { slug: "negocios", name: "Negócios", agents: 14, status: "Pronto", focus: "Operação e estratégia", chief_agent_id: null },
  { slug: "seo", name: "SEO", agents: 14, status: "Pronto", focus: "Descoberta orgânica", chief_agent_id: null },
  { slug: "apex", name: "Apex", agents: 24, status: "Pronto", focus: "Execução especializada", chief_agent_id: null },
] as const;

export const costSeries = [
  { day: "Seg", cost: 24 }, { day: "Ter", cost: 37 }, { day: "Qua", cost: 29 },
  { day: "Qui", cost: 52 }, { day: "Sex", cost: 41 }, { day: "Sáb", cost: 18 }, { day: "Dom", cost: 26 },
];
