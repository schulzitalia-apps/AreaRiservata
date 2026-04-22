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

  spese: {
    variant: "comfortable",
    main: {
      title: fk("tipoSpesa", "servizioAbbonamento"),
      subtitle: fk("descrizione"),
      showOwner: false,
      showDate: "updatedOrCreated",
      referencePills: fk("fornitore", "dipendente"),
    },
    columns: {
      mode: "custom",
      keys: fk(
        "dataSpesa",
        "variantId",
        "fornitore",
        "totaleLordo",
      ),
      showVisibility: true,
    },
    controls: {
      docType: true,
      visibility: false,
      sort: false,
    },
    hoverPreview: false
  },

  "anagrafiche-test": {
    variant: "comfortable",
    main: {
      title: fk("titoloTestAnagrafica"),
      subtitle: fk("flagAttivoTest"),
      showOwner: true,
      showDate: "updatedOrCreated",
      referencePills: false,
    },
    columns: {
      mode: "custom",
      keys: fk(
        "categorieTestMulti",
        "etichetteLibereTest",
        "clientiCollegatiTest",
        "numeriTestArray",
        "rangeNumeroTest",
        "rangeDataTest",
        "posizioneTestGeo",
        "percorsoTestGeo",
        "dimensioniTestPair",
        "specificheTestPairs",
        "metricheTestKeyValue",
        "indirizzoTestStrutturato",
        "noteTestAnagrafica",
      ),
      showVisibility: true,
    },
    controls: {
      docType: true,
      visibility: false,
      sort: true,
    },
    hoverPreview: false,
  },
};

export function getAnagraficheListUIConfig(
  slug: string,
): AnagraficheListConfig | undefined {
  return ANAGRAFICHE_LIST_UI_BY_SLUG[slug as AnagraficaTypeSlug];
}
