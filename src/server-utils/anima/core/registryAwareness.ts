import { getAnagraficheList } from "@/config/anagrafiche.registry";
import { listAuleDef } from "@/config/aule.registry";
import { getEventiList } from "@/config/eventi.registry";

type RegistryItemAwareness = {
  slug: string;
  label: string;
  aliases: string[];
  note?: string | null;
};

export type AnimaRegistryAwareness = {
  anagrafiche: RegistryItemAwareness[];
  aule: RegistryItemAwareness[];
  eventi: RegistryItemAwareness[];
};

export type AnimaRegistryScope =
  | "all"
  | "anagrafiche"
  | "eventi"
  | "sprint_timeline";

function tokenizeLabel(label: string): string[] {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3);
}

function buildAliases(slug: string, label: string): string[] {
  return Array.from(
    new Set([
      slug,
      slug.replace(/_/g, " "),
      label,
      ...tokenizeLabel(label),
    ]),
  );
}

export function buildRegistryAwareness(): AnimaRegistryAwareness {
  return {
    anagrafiche: getAnagraficheList().map((item) => ({
      slug: item.slug,
      label: item.label,
      aliases: buildAliases(item.slug, item.label),
      note: `Campi preview: ${item.preview.title.join(", ")}${item.preview.subtitle.length ? ` | ${item.preview.subtitle.join(", ")}` : ""}`,
    })),
    aule: listAuleDef().map((item) => ({
      slug: item.slug,
      label: item.label,
      aliases: buildAliases(item.slug, item.label),
      note:
        item.slug === "sprint"
          ? "Gruppo speciale collegato alla SprintTimeline."
          : `Campi preview: ${item.preview.title.join(", ")}${item.preview.subtitle.length ? ` | ${item.preview.subtitle.join(", ")}` : ""}`,
    })),
    eventi: getEventiList().map((item) => ({
      slug: item.slug,
      label: item.label,
      aliases: buildAliases(item.slug, item.label),
      note: `Time kinds: ${item.allowedTimeKinds.join(", ")}`,
    })),
  };
}

export function buildScopedRegistryAwareness(
  scope: AnimaRegistryScope = "all",
): AnimaRegistryAwareness {
  const full = buildRegistryAwareness();

  if (scope === "all") {
    return full;
  }

  if (scope === "anagrafiche") {
    return {
      anagrafiche: full.anagrafiche,
      aule: [],
      eventi: [],
    };
  }

  if (scope === "eventi") {
    return {
      anagrafiche: [],
      aule: [],
      eventi: full.eventi,
    };
  }

  return {
    anagrafiche: [],
    aule: full.aule.filter((item) => item.slug === "sprint"),
    eventi: [],
  };
}
