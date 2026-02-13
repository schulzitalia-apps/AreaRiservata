// src/config/access/access-resources.config.ts
import type { AppRole } from "@/types/roles";
import type { AnagraficaTypeSlug } from "@/config/anagrafiche.types.public";
import type { FieldKey } from "@/config/anagrafiche.fields.catalog";
import type { AulaTypeSlug } from "@/config/aule.types.public";
import type { EventoTypeSlug } from "@/config/eventi.types.public";

/* -------------------------------------------------------------------------- */
/*  CRUD / AZIONI                                                             */
/* -------------------------------------------------------------------------- */

export type CrudAction = "view" | "create" | "edit" | "delete";

export interface ActionRule {
  roles?: AppRole[];
  ownOnlyRoles?: AppRole[];
}

/* -------------------------------------------------------------------------- */
/*  KEY FILTERS                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Tipo di "scope" su cui vivono le chiavi.
 *
 * Esteso:
 * - "anagrafica": keys su record anagrafici (es. clienti specifici)
 * - "aula":       keys su record aula (es. un'aula "agenti" specifica)
 *
 * Nota: il motore KEY si estende facilmente ad altri kind in futuro.
 */
export type KeyScopeKind = "anagrafica" | "aula";

/**
 * Riferimento allo scope da cui leggere le key.
 *
 * Nota: tipizziamo slug come string per tenere semplice il motore,
 * dato che AuthContext.keyScopes è già generico (Record<string, ...>).
 */
export interface KeyScopeRef {
  kind: KeyScopeKind; // "anagrafica" | "aula"
  slug: string;       // es: "clienti" oppure "agenti" (tipo aula)
}

/**
 * Modalità di applicazione delle key per filtrare la risorsa.
 *
 * - "self":           applica le key su _id (stessa anagrafica)
 * - "byReference":    applica le key su data.<referenceFieldKey> (reference a un'altra anagrafica)
 * - "byAulaMembership": applica le key su aule.aulaId (membership nel campo core `aule`)
 */
export type KeyFilterMode = "self" | "byReference" | "byAulaMembership";

/**
 * Regola che dice come usare le chiavi (KEY) per filtrare una risorsa.
 *
 * Importante:
 * - byAulaMembership realizza esattamente la logica che vuoi:
 *   "se hai KEY su una certa Aula ⇒ vedi tutte le anagrafiche partecipanti a quell’Aula".
 */
export interface KeyFilterRule {
  scope: KeyScopeRef; // da quale "bucket" di chiavi leggere
  mode: KeyFilterMode;
  roles: AppRole[];
  enabled?: boolean;

  /**
   * Se mode === "byReference", nome del campo (fieldKey) che è un reference
   * nel registry di questa anagrafica (es. "codiceCliente").
   */
  referenceFieldKey?: FieldKey;

  /**
   * Se mode === "byAulaMembership", è fortemente consigliato specificare anche
   * il tipo aula, per evitare collisioni tra tipi diversi e mantenere query più pulite.
   */
  aulaTypeSlug?: AulaTypeSlug;
}

/* -------------------------------------------------------------------------- */
/*  RESOURCE CONFIG PER SINGOLO SLUG                                          */
/* -------------------------------------------------------------------------- */

export interface ResourceConfig {
  label: string;
  actions: Partial<Record<CrudAction, ActionRule>>;
  keyFilters?: KeyFilterRule[];
}

/* -------------------------------------------------------------------------- */
/*  DOMINI DI RISORSA                                                         */
/* -------------------------------------------------------------------------- */

export type ResourceDomain = "anagrafica" | "aula" | "evento";

export type AnagraficaResourcesConfig = Record<AnagraficaTypeSlug, ResourceConfig>;
export type AulaResourcesConfig = Record<AulaTypeSlug, ResourceConfig>;
export type EventoResourcesConfig = Record<EventoTypeSlug, ResourceConfig>;

export interface ResourcesConfigMap {
  anagrafica: AnagraficaResourcesConfig;
  aula: AulaResourcesConfig;
  evento: EventoResourcesConfig;
}

/* -------------------------------------------------------------------------- */
/*  CONFIG ATTUALE                                                            */
/* -------------------------------------------------------------------------- */

export const ResourcesConfig: ResourcesConfigMap = {
  /* --------------------------- ANAGRAFICHE --------------------------------- */
  anagrafica: {
    "clienti": {
      label: "Clienti",
      actions: {
        view: {
          roles: [
            "Super",
            "Amministrazione",
            "Commerciale",
            "Tecnico",
            "Custcare",
            "Agente",
            "Cliente",
          ],
        },
        create: {
          roles: ["Super", "Amministrazione", "Commerciale", "Agente"],
        },
        edit: {
          roles: ["Super", "Amministrazione"],
          ownOnlyRoles: ["Commerciale", "Agente"],
        },
        delete: {
          roles: ["Super", "Amministrazione"],
        },
      },
      keyFilters: [
        // KEY → visibilità "solo su se stesso" (clienti)
        {
          scope: { kind: "anagrafica", slug: "clienti" },
          mode: "self",
          roles: ["Agente", "Commerciale", "Cliente"],
          enabled: true,
        },
      ],
    },

    "conferme-ordine": {
      label: "Conferme d'ordine",
      actions: {
        view: {
          roles: [
            "Super",
            "Amministrazione",
            "Commerciale",
            "Tecnico",
            "Custcare",
            "Agente",
            "Cliente",
          ],
        },
        create: {
          roles: ["Super", "Amministrazione", "Commerciale", "Agente"],
        },
        edit: {
          roles: ["Super", "Amministrazione"],
          ownOnlyRoles: ["Commerciale", "Agente"],
        },
        delete: {
          roles: ["Super", "Amministrazione"],
        },
      },
      keyFilters: [
        // KEY su clienti → vedi TUTTE le conferme-ordine che referenziano quei clienti
        {
          scope: { kind: "anagrafica", slug: "clienti" },
          mode: "byReference",
          referenceFieldKey: "codiceCliente",
          roles: ["Agente", "Commerciale", "Cliente"],
          enabled: true,
        },
      ],
    },
  },

  /* ----------------------------- AULE -------------------------------------- */
  aula: {
    // Default conservativi: solo Super / Amministrazione.
    "cantieri": {
      label: "Cantieri",
      actions: {
        view: { roles: ["Super", "Amministrazione", "Agente"] },
        create: { roles: ["Super", "Amministrazione"] },
        edit: { roles: ["Super", "Amministrazione"] },
        delete: { roles: ["Super"] },
      },

    },
    "agenti": {
      label: "Agenti",
      actions: {
        view: { roles: ["Super", "Amministrazione", "Agente"] },
        create: { roles: ["Super", "Amministrazione"] },
        edit: { roles: ["Super", "Amministrazione"] },
        delete: { roles: ["Super"] },
      },
    },
  },

  /* ----------------------------- EVENTI ------------------------------------ */
  evento: {
    eventi: {
      label: "Eventi Schulz",
      actions: {
        view: { roles: ["Super",
            "Amministrazione",
            "Commerciale",
            "Tecnico",
            "Custcare",
            "Agente",
            "Cliente",] },
        create: { roles: ["Super", "Amministrazione"] },
        edit: { roles: ["Super", "Amministrazione"] },
        delete: { roles: ["Super"] },
      },
    },

    avvisi_taglio: {
      label: "Inizio Taglio",
      actions: {
        view: { roles: ["Super",
            "Amministrazione",
            "Commerciale",
            "Tecnico",
            "Custcare",
            "Agente",
            "Cliente",] },
        create: { roles: ["Super", "Amministrazione"] },
        edit: { roles: ["Super", "Amministrazione"] },
        delete: { roles: ["Super"] },
      },
    },

    avvisi_ferramenta: {
      label: "Montaggio Ferramenta",
      actions: {
        view: { roles: ["Super",
            "Amministrazione",
            "Commerciale",
            "Tecnico",
            "Custcare",
            "Agente",
            "Cliente",] },
        create: { roles: ["Super", "Amministrazione"] },
        edit: { roles: ["Super", "Amministrazione"] },
        delete: { roles: ["Super"] },
      },
    },

    avvisi_vetraggio: {
      label: "Vetraggio",
      actions: {
        view: { roles: ["Super",
            "Amministrazione",
            "Commerciale",
            "Tecnico",
            "Custcare",
            "Agente",
            "Cliente",] },
        create: { roles: ["Super", "Amministrazione"] },
        edit: { roles: ["Super", "Amministrazione"] },
        delete: { roles: ["Super"] },
      },
    },

    avvisi_pronto: {
      label: "Pronto a Magazzino",
      actions: {
        view: { roles: ["Super",
            "Amministrazione",
            "Commerciale",
            "Tecnico",
            "Custcare",
            "Agente",
            "Cliente",] },
        create: { roles: ["Super", "Amministrazione"] },
        edit: { roles: ["Super", "Amministrazione"] },
        delete: { roles: ["Super"] },
      },
    },

    consegna_prevista: {
      label: "Consegna Prevista",
      actions: {
        view: { roles: ["Super",
            "Amministrazione",
            "Commerciale",
            "Tecnico",
            "Custcare",
            "Agente",
            "Cliente",] },
        create: { roles: ["Super", "Amministrazione"] },
        edit: { roles: ["Super", "Amministrazione"] },
        delete: { roles: ["Super"] },
      },
    },

    avvisi_speciale: {
      label: "Avviso Commessa",
      actions: {
        view: { roles: ["Super",
            "Amministrazione",
            "Commerciale",
            "Tecnico",
            "Custcare",
            "Agente",
            "Cliente",] },
        create: { roles: ["Super", "Amministrazione"] },
        edit: { roles: ["Super", "Amministrazione"] },
        delete: { roles: ["Super"] },
      },
    },

  },
};
