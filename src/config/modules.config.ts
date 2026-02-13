// src/config/modules.config.ts

export const modulesConfig = {
  aule: {
    enabled: true, // se false, nascondi UI e blocchi route aule
  },
} as const;

export type ModulesConfig = typeof modulesConfig;
