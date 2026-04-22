// src/config/anagrafiche.list.ui.ts
import type { FieldKey } from "@/config/anagrafiche.fields.catalog";
import type { AnagraficaTypeSlug } from "@/config/anagrafiche.types.public";
import type { AnagraficheListConfig } from "@/components/AtlasModuli/Anagrafica/AnagraficheList/helpers";

// helper per tipizzare array di FieldKey (evita string[])
const fk = <K extends FieldKey>(...keys: K[]) => keys;

export const ANAGRAFICHE_LIST_UI_BY_SLUG: Partial<
  Record<AnagraficaTypeSlug, AnagraficheListConfig>
> = {
  clienti: {
    variant: "comfortable",
    main: {
      title: fk("ragioneSociale"),
      subtitle: fk("tipoCliente"),
      showOwner: true,
      showDate: "updatedOrCreated",
      referencePills: false,
    },
    columns: {
      mode: "searchIn",
      // extra colonne oltre al searchIn:
      keys: fk("email", "telefonoMobile"),
      showVisibility: true,
    },
    controls: {
      docType: true,
      visibility: false,
      sort: false,
    },
    hoverPreview: false,
  },

};

export function getAnagraficheListUIConfig(
  slug: string,
): AnagraficheListConfig | undefined {
  return ANAGRAFICHE_LIST_UI_BY_SLUG[slug as AnagraficaTypeSlug];
}
