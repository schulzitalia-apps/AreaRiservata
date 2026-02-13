export const ROLES = [
  "Super",
  "Amministrazione",
  "Commerciale",
  "Tecnico",
  "Custcare",
  "Agente",
  "Cliente",
] as const;

export type AppRole = typeof ROLES[number];