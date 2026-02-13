import type { AppRole } from "@/types/roles";
import type { AnagraficaTypeSlug } from "@/config/anagrafiche.types.public";
import type { AulaTypeSlug } from "@/config/aule.types.public";
import type { EventoTypeSlug } from "@/config/eventi.types.public";
import { ICON_NAMES, type IconName } from "@/components/Layouts/sidebar/icons";

/* -------------------------------------------------------------------------- */
/*                      LISTA NOMI ICONE DISPONIBILI (iconName)              */
/* -------------------------------------------------------------------------- */
/**
 * Puoi usare uno di questi valori per:
 *  - iconName
 *  - groupIconName
 *  - perSlugIconName[slug]
 *
 * {ICON_NAMES.join(" | ")}
 *
 * /**
 *  * ICONE DISPONIBILI (iconName / groupIconName / perSlugIconName)
 *  *
 *  *  - "HomeIcon"        → icona home / area principale
 *  *  - "Calendar"        → icona calendario / pianificazione
 *  *  - "User"            → icona utente / persona / anagrafica
 *  *  - "Alphabet"        → icona elenco / testo / catalogo
 *  *  - "Table"           → icona tabella / liste dati
 *  *  - "PieChart"        → icona grafico / statistiche
 *  *  - "FourCircle"      → icona griglia / moduli / app
 *  *  - "Authentication"  → icona login / sicurezza / accesso
 *  *  - "ArrowLeftIcon"   → icona freccia indietro / ritorno
 *  *  - "DashboardIcon"   → icona dashboard / pannello di controllo
 *  *  - "SettingsIcon"    → icona impostazioni / configurazione
 *  *  - "DocumentIcon"    → icona documento / file / scheda
 *  *  - "FileTextIcon"    → icona documento testuale / report
 *  *  - "BellIcon"        → icona campanella / notifiche / avvisi
 *  *  - "SearchIcon"      → icona lente / ricerca
 *  *  - "FilterIcon"      → icona filtri / raffinazione risultati
 *  *  - "TagIcon"         → icona tag / categorie / articoli
 *  *  - "LinkIcon"        → icona link / collegamenti
 *  *  - "PlusCircleIcon"  → icona più / nuovo / aggiungi
 *  *  - "EditIcon"        → icona matita / modifica
 *  *  - "TrashIcon"       → icona cestino / elimina
 *  *  - "DownloadIcon"    → icona download / esporta
 *  *  - "UploadIcon"      → icona upload / importa / allega
 *  *  - "LockIcon"        → icona lucchetto chiuso / protetto
 *  *  - "UnlockIcon"      → icona lucchetto aperto / accesso
 *  *  - "ChatIcon"        → icona chat / conversazioni / commenti
 *  *  - "MailIcon"        → icona mail / comunicazioni
 *  *  - "MapPinIcon"      → icona pin / indirizzo / posizione
 *  *  - "PhoneIcon"       → icona telefono / contatti
 *  *  - "StarIcon"        → icona stella / preferiti / evidenza
 *  */

export type NavSectionId = "SITE" | "DASHBOARD" | "GESTIONE" | "LINKS";

export interface NavSectionAccess {
  id: NavSectionId;
  /**
   * Etichetta visibile nella sidebar (header della sezione)
   */
  label: string;

  /**
   * Se valorizzato: solo questi ruoli vedono la sezione.
   * Se omitted: tutti i ruoli autenticati la vedono.
   */
  roles?: AppRole[];
}

export type NavItemKind = "static" | "anagrafiche" | "aule" | "eventi";

export type NavGroupLayout = "group" | "flat";

export interface NavItemAccess {
  /**
   * Identificatore interno della voce di menu.
   * Può essere qualunque stringa, ma alcuni id sono “speciali”
   * e hanno un comportamento predefinito:
   * - "home"      → /
   * - "calendar"  → /calendar
   * - "admin"     → /admin
   *
   * Per voci custom puoi usare un id qualsiasi, es. "preventivatore".
   */
  id: string;

  kind: NavItemKind;
  sectionId: NavSectionId;

  /**
   * Etichetta della voce di menu (per static, o per "flat").
   * Per layout "group", questa è l'etichetta della voce padre
   * SOLO se non è impostata groupLabel.
   */
  label?: string;

  /**
   * Etichetta della voce padre quando layout === "group"
   * (es. "Anagrafiche", "Gruppi", "Eventi").
   */
  groupLabel?: string;

  /**
   * Ruoli che vedono l'ITEM nel suo complesso (prima del filtro per slug).
   * Se omitted: tutti i ruoli autenticati possono vedere l'item.
   */
  roles?: AppRole[];

  /**
   * Config per singolo slug (anagrafiche / aule / eventi).
   *
   * Chiave = slug (es. "clienti","conferme-ordine","agenti","avvisi_preventivo")
   * Valore:
   *  - array di ruoli  → SOLO quei ruoli vedono quello slug
   *  - [] (array vuoto) → NESSUNO vede quello slug
   *  - undefined (slug non presente nella mappa) → eredita cfg.roles
   */
  perSlugRoles?: Partial<
    Record<
      AnagraficaTypeSlug | AulaTypeSlug | EventoTypeSlug | string,
      AppRole[]
    >
  >;

  /**
   * Se valorizzato: limita gli slug mostrati per quell'item
   * SOLO a quelli esplicitamente elencati.
   */
  includeSlugs?: (AnagraficaTypeSlug | AulaTypeSlug | EventoTypeSlug | string)[];

  /**
   * Layout per gli item dinamici (anagrafiche / aule / eventi):
   *  - "flat": ogni slug diventa una voce separata nel menu
   *  - "group": una voce padre + sottomenu
   */
  layout?: NavGroupLayout;

  /**
   * URL custom per le voci statiche NON predefinite.
   *
   * Esempi:
   *  - id: "preventivatore", kind: "static", customUrl: "/preventivi"
   */
  customUrl?: string;

  /**
   * Nome dell'icona principale per l'item.
   */
  iconName?: IconName;

  /**
   * Nome dell'icona per la voce padre quando layout === "group".
   */
  groupIconName?: IconName;

  /**
   * Icona per singolo slug (funziona SOLO in layout === "flat").
   *
   * Esempio:
   *  perSlugIconName: {
   *    clienti: "User",
   *    "conferme-ordine": "DocumentIcon",
   *    preventivi: "FileTextIcon",
   *  }
   */
  perSlugIconName?: Partial<
    Record<
      AnagraficaTypeSlug | AulaTypeSlug | EventoTypeSlug | string,
      IconName
    >
  >;
}

/* ---------------------------- SEZIONI DEL MENU ---------------------------- */

export const NavSectionsAccess: NavSectionAccess[] = [
  {
    id: "LINKS",
    label: "Per Iniziare",
  },
  {
    id: "SITE",
    label: "Strumenti",
  },
  {
    id: "DASHBOARD",
    label: "Documenti",
  },
  {
    id: "GESTIONE",
    label: "Gestione",
    roles: ["Super", "Amministrazione", "Commerciale"],
  },
];

/* --------------------------- VOCI DEL MENU TOP ---------------------------- */

export const NavItemsAccess: NavItemAccess[] = [
  {
    id: "home",
    kind: "static",
    sectionId: "LINKS",
    label: "Benvenuto",
    roles: ["Cliente"]
    // iconName omesso → icona di default
  },
  {
    id: "barcode",
    kind: "static",
    sectionId: "SITE",
    label: "Barcode",
    customUrl: "/barcode",
    roles: ["Super", "Amministrazione", "Tecnico"],
    iconName: "Alphabet",
  },
  {
    id: "calendar",
    kind: "static",
    sectionId: "SITE",
    label: "Calendario",
  },

  /**
   * ANAGRAFICHE
   */
  {
    id: "anagrafiche",
    kind: "anagrafiche",
    sectionId: "DASHBOARD",
    layout: "flat", // se metti "group", perSlugIconName NON viene usato
    includeSlugs: ["clienti", "conferme-ordine", "corsi"], // <-- come richiesto
    roles: [
      "Super",
      "Amministrazione",
      "Commerciale",
      "Agente",
      "Cliente",
      "Custcare",
    ],
    perSlugRoles: {
      clienti: ["Super", "Amministrazione", "Commerciale", "Agente"],
      "conferme-ordine": ["Super", "Amministrazione", "Commerciale", "Custcare", "Agente", "Cliente"],
      corsi: ["Super", "Amministrazione", "Cliente"]
    },
    perSlugIconName: {
      "conferme-ordine": "TagIcon",
      "corsi": "LinkIcon"
    },
  },

  /**
   * AULE / GRUPPI
   */
  {
    id: "aule",
    kind: "aule",
    sectionId: "DASHBOARD",
    label: "Agenti e Cantieri", // per layout "group", titolo voce padre
    layout: "flat",
    roles: [
      "Super",
      "Amministrazione",
      "Commerciale",
    ],
    perSlugRoles: {
      "agenti": ["Super", "Amministrazione", "Commerciale"],
    },
    perSlugIconName: {
      "agenti": "User",
    },
    // includeSlugs omesso → mostra tutti gli slug disponibili per "aule"
    // groupIconName facoltativo (es: "DashboardIcon")
  },

  /**
   * EVENTI
   */
  {
    id: "eventi",
    kind: "eventi",
    sectionId: "DASHBOARD",
    label: "Eventi", // per layout "group", titolo voce padre
    layout: "group",
    roles: ["Super"],
    includeSlugs: ["eventi", "avvisi_taglio", "avvisi_ferramenta", "avvisi_vetraggio", "avvisi_pronto", "consegna_prevista"],
  },

  {
    id: "admin",
    kind: "static",
    sectionId: "GESTIONE",
    label: "Admin",
    roles: ["Super", "Amministrazione"],
    // iconName facoltativo (es: "SettingsIcon")
  },
  {
    id: "mail",
    kind: "static",
    sectionId: "SITE",
    label: "Mail",
    customUrl: "/mail",
    roles: ["Super", "Amministrazione", "Commerciale", "Custcare"],
    iconName: "MailIcon",
  },
  {
    id: "store",
    kind: "static",
    sectionId: "LINKS",
    label: "Schulz Store",
    customUrl: "https://schulzitalia.com/estore/",
    roles: ["Super", "Amministrazione", "Commerciale", "Agente", "Custcare", "Cliente"],
    iconName: "TagIcon",
  },
  {
    id: "apertures",
    kind: "static",
    sectionId: "LINKS",
    label: "Apertures",
    customUrl: "https://schulz-aperturesconnect.azurewebsites.net/",
    roles: ["Super", "Amministrazione", "Commerciale", "Agente", "Custcare", "Cliente"],
    iconName: "LinkIcon",
  },


  {
    id: "documenti",
    kind: "static",
    sectionId: "DASHBOARD",
    label: "Documenti",
    customUrl: "/documenti",
    roles: ["Super", "Amministrazione", "Commerciale", "Agente", "Custcare", "Cliente"],
    iconName: "DocumentIcon",
  },
  {
    id: "whiteboard",
    kind: "static",
    sectionId: "SITE",
    label: "Lavagna",
    customUrl: "/whiteboard",
    roles: ["Super", "Amministrazione", "Commerciale", "Agente", "Custcare", "Cliente"],
    iconName: "SearchIcon",
  },
];
