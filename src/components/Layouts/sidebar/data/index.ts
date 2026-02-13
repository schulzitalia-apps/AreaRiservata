import * as Icons from "../icons";
import { getAnagraficheList } from "@/config/anagrafiche.registry";
import { getAuleList } from "@/config/aule.registry";
import { getEventiList } from "@/config/eventi.registry";
import type { AppRole } from "@/types/roles";
import {
  NavSectionsAccess,
  NavItemsAccess,
  type NavSectionId,
} from "@/config/access/access-nav.config";
import type { IconName } from "../icons";

type IconType = React.ComponentType<any>;

type BuiltMenuItem = {
  title: string;
  url: string;
  icon: IconType;
  items: { title: string; url: string }[];
};

type BuiltSection = {
  label: string;
  items: BuiltMenuItem[];
};

function isAdminRole(role?: AppRole | null): boolean {
  return role === "Super" || role === "Amministrazione";
}

function canSeeSection(sectionId: NavSectionId, role?: AppRole | null): boolean {
  if (!role) return false;
  const cfg = NavSectionsAccess.find((s) => s.id === sectionId);
  if (!cfg) return false;
  if (isAdminRole(role)) return true;
  if (!cfg.roles || cfg.roles.length === 0) return true;
  return cfg.roles.includes(role);
}

function canSeeItem(
  cfg: (typeof NavItemsAccess)[number],
  role?: AppRole | null,
): boolean {
  if (!role) return false;
  if (isAdminRole(role)) return true;
  if (!cfg.roles || cfg.roles.length === 0) return true;
  return cfg.roles.includes(role);
}

/**
 * Controlla se un certo slug (anagrafica/aula/evento) è visibile
 * in base a:
 *  - ruolo
 *  - roles a livello di item
 *  - perSlugRoles[slug]
 */
function canSeeSlug(
  itemCfg: (typeof NavItemsAccess)[number],
  slug: string,
  role?: AppRole | null,
): boolean {
  if (!role) return false;
  if (isAdminRole(role)) {
    if (itemCfg.roles && !itemCfg.roles.includes(role)) return false;
    return true;
  }

  if (itemCfg.roles && !itemCfg.roles.includes(role)) return false;

  const perSlug = itemCfg.perSlugRoles?.[slug];

  if (perSlug === undefined) {
    return !itemCfg.roles || itemCfg.roles.includes(role);
  }

  if (perSlug.length === 0) return false;

  return perSlug.includes(role);
}

/**
 * Dato il nome di un'icona (string) restituisce il componente icona
 * dal modulo ./icons. Se non esiste, usa il fallback.
 */
function resolveIconByName(
  iconName: IconName | undefined,
  fallback: IconType,
): IconType {
  if (!iconName) return fallback;
  const IconFromMap = (Icons as any)[iconName];
  if (!IconFromMap) return fallback;
  return IconFromMap as IconType;
}

/**
 * Costruisce il menu in base al ruolo.
 */
export function buildNavData(role?: AppRole | null): BuiltSection[] {
  if (!role) return [];

  const anags = getAnagraficheList();
  const aule = getAuleList();
  const eventi = getEventiList();

  const sections: BuiltSection[] = [];

  for (const sectionCfg of NavSectionsAccess) {
    if (!canSeeSection(sectionCfg.id, role)) continue;

    const sectionItems: BuiltMenuItem[] = [];

    const itemCfgs = NavItemsAccess.filter(
      (i) => i.sectionId === sectionCfg.id,
    );

    for (const cfg of itemCfgs) {
      if (!canSeeItem(cfg, role)) continue;

      let title: string;
      let url: string;
      let icon: IconType;

      /* ------------------------------ STATICHE ------------------------------ */
      if (cfg.kind === "static") {
        const baseTitle =
          cfg.label ??
          (cfg.id === "home"
            ? "Benvenuto nell'Area Riservata"
            : cfg.id === "calendar"
              ? "Calendario"
              : cfg.id === "admin"
                ? "Admin"
                : cfg.id);

        let defaultUrl: string;
        if (cfg.id === "home") {
          defaultUrl = "/";
        } else if (cfg.id === "calendar") {
          defaultUrl = "/calendar";
        } else if (cfg.id === "admin") {
          defaultUrl = "/admin";
        } else {
          defaultUrl = "/";
        }

        title = baseTitle;
        url = cfg.customUrl ?? defaultUrl;

        let defaultIcon: IconType;
        if (cfg.id === "home") {
          defaultIcon = Icons.Table;
        } else if (cfg.id === "calendar") {
          defaultIcon = Icons.Calendar;
        } else if (cfg.id === "admin") {
          defaultIcon = Icons.HomeIcon;
        } else {
          defaultIcon = Icons.Table;
        }

        icon = resolveIconByName(cfg.iconName, defaultIcon);

        sectionItems.push({ title, url, icon, items: [] });
        continue;
      }

      /* ---------------------------- ANAGRAFICHE ----------------------------- */
      if (cfg.kind === "anagrafiche") {
        const visibleSlugs = anags.filter((a) => {
          if (cfg.includeSlugs && !cfg.includeSlugs.includes(a.slug)) {
            return false;
          }
          return canSeeSlug(cfg, a.slug, role);
        });

        if (visibleSlugs.length === 0) continue;

        if (cfg.layout === "flat") {
          visibleSlugs.forEach((a) => {
            const slugIconName = cfg.perSlugIconName?.[a.slug] as IconName | undefined;
            const baseIcon: IconType = (a as any).icon ?? Icons.User;
            const finalIcon = resolveIconByName(slugIconName, baseIcon);

            sectionItems.push({
              title: a.label,
              url: `/anagrafiche/${a.slug}`,
              icon: finalIcon,
              items: [],
            });
          });
        } else {
          const groupTitle = cfg.groupLabel ?? cfg.label ?? "Anagrafiche";

          const defaultGroupIcon = Icons.User;
          const groupIcon = resolveIconByName(
            cfg.groupIconName ?? cfg.iconName,
            defaultGroupIcon,
          );

          sectionItems.push({
            title: groupTitle,
            url: "/anagrafiche",
            icon: groupIcon,
            items: visibleSlugs.map((a) => ({
              title: a.label,
              url: `/anagrafiche/${a.slug}`,
            })),
          });
        }

        continue;
      }

      /* -------------------------------- AULE -------------------------------- */
      if (cfg.kind === "aule") {
        const visible = aule.filter((g) => {
          if (cfg.includeSlugs && !cfg.includeSlugs.includes(g.slug)) {
            return false;
          }
          return canSeeSlug(cfg, g.slug, role);
        });

        if (!visible.length) continue;

        if (cfg.layout === "flat") {
          visible.forEach((g) => {
            const slugIconName = cfg.perSlugIconName?.[g.slug] as IconName | undefined;
            const baseIcon: IconType = Icons.Table;
            const finalIcon = resolveIconByName(slugIconName, baseIcon);

            sectionItems.push({
              title: g.label,
              url: `/aule/${g.slug}`,
              icon: finalIcon,
              items: [],
            });
          });
        } else {
          const groupTitle = cfg.groupLabel ?? cfg.label ?? "Gruppi";

          const defaultGroupIcon = Icons.Table;
          const groupIcon = resolveIconByName(
            cfg.groupIconName ?? cfg.iconName,
            defaultGroupIcon,
          );

          sectionItems.push({
            title: groupTitle,
            url: "/aule",
            icon: groupIcon,
            items: visible.map((g) => ({
              title: g.label,
              url: `/aule/${g.slug}`,
            })),
          });
        }
        continue;
      }

      /* -------------------------------- EVENTI ------------------------------- */
      if (cfg.kind === "eventi") {
        const visible = eventi.filter((e) => {
          if (cfg.includeSlugs && !cfg.includeSlugs.includes(e.slug)) {
            return false;
          }
          return canSeeSlug(cfg, e.slug, role);
        });

        if (!visible.length) continue;

        if (cfg.layout === "flat") {
          visible.forEach((e) => {
            const slugIconName = cfg.perSlugIconName?.[e.slug] as IconName | undefined;
            const baseIcon: IconType = Icons.BellIcon ?? Icons.ArrowLeftIcon;
            const finalIcon = resolveIconByName(slugIconName, baseIcon);

            sectionItems.push({
              title: e.label,
              url: `/eventi/${e.slug}`,
              icon: finalIcon,
              items: [],
            });
          });
        } else {
          const groupTitle = cfg.groupLabel ?? cfg.label ?? "Eventi";

          const defaultGroupIcon = Icons.ArrowLeftIcon;
          const groupIcon = resolveIconByName(
            cfg.groupIconName ?? cfg.iconName,
            defaultGroupIcon,
          );

          sectionItems.push({
            title: groupTitle,
            url: "/eventi",
            icon: groupIcon,
            items: visible.map((e) => ({
              title: e.label,
              url: `/eventi/${e.slug}`,
            })),
          });
        }
      }
    }

    if (sectionItems.length) {
      sections.push({
        label: sectionCfg.label ?? sectionCfg.id,
        items: sectionItems,
      });
    }
  }

  return sections;
}
