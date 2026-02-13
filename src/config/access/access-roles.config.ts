// src/config/access/access-roles.config.ts
import type { AppRole } from "@/types/roles";

export interface RoleConfig {
  label: string;
  builtIn: boolean;
  isAdmin?: boolean; // 👈 aggiunto questo, togliamo le permissions
}

export const RolesConfig: Record<AppRole, RoleConfig> = {
  Super: {
    label: "Super Admin",
    builtIn: true,
    isAdmin: true,
  },
  Amministrazione: {
    label: "Amministrazione",
    builtIn: true,
    isAdmin: true,
  },
  Commerciale: {
    label: "Commerciale",
    builtIn: false,
  },
  Tecnico: {
    label: "Tecnico",
    builtIn: false,
  },
  Custcare: {
    label: "Custcare",
    builtIn: false,
  },
  Agente: {
    label: "Agente",
    builtIn: false,
  },
  Cliente: {
    label: "Cliente",
    builtIn: false,
  },
};
