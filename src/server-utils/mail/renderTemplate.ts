// src/server-utils/Mail/renderTemplate.ts
type Vars = Record<string, any>;

function escapeHtml(input: any): string {
  const s = String(input ?? "");
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getPath(vars: Vars, path: string): any {
  const keys = path.split(".").map((k) => k.trim()).filter(Boolean);
  let cur: any = vars;
  for (const k of keys) {
    if (cur == null) return undefined;
    cur = cur[k];
  }
  return cur;
}

function parseFilterToken(token: string): { name: string; arg?: string } {
  const t = token.trim();
  const m = t.match(/^([a-zA-Z_][a-zA-Z0-9_]*)(?::(.*))?$/);
  if (!m) return { name: t };
  let arg = m[2]?.trim();
  // rimuovi eventuali virgolette per default:"ciao"
  if (arg && ((arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'")))) {
    arg = arg.slice(1, -1);
  }
  return { name: m[1], arg };
}

function applyFilters(value: any, filters: string[]): any {
  let v: any = value;

  for (const f of filters) {
    const { name, arg } = parseFilterToken(f);

    switch (name) {
      case "trim":
        v = String(v ?? "").trim();
        break;

      case "upper":
        v = String(v ?? "").toUpperCase();
        break;

      case "lower":
        v = String(v ?? "").toLowerCase();
        break;

      case "urlencode":
        v = encodeURIComponent(String(v ?? ""));
        break;

      case "default":
        // default:"testo" -> se null/undefined/"" allora usa arg
        if (v == null || v === "") v = arg ?? "";
        break;

      case "date":
        // date:"it-IT" (semplice): prova a formattare date/iso
        // se arg manca: usa locale default
        try {
          const d = v instanceof Date ? v : new Date(String(v));
          if (!isNaN(d.getTime())) {
            const locale = arg || undefined;
            v = new Intl.DateTimeFormat(locale).format(d);
          }
        } catch {
          // lascia invariato
        }
        break;

      default:
        // filtro sconosciuto: ignora
        break;
    }
  }

  return v;
}

/**
 * Renderizza template tipo:
 *  - {{name}}  (escaped)
 *  - {{{htmlSnippet}}} (raw, NON escaped)
 *  - {{thread.title | trim | upper}}
 *  - {{missing | default:"—"}}
 */
export function renderTemplate(template: string, vars: Vars): string {
  if (!template) return "";

  // 1) triple braces RAW: {{{ ... }}}
  //    Consente anche filtri: {{{ foo | trim }}}
  let out = template.replace(/\{\{\{\s*([\s\S]+?)\s*\}\}\}/g, (_, expr: string) => {
    const parts = expr.split("|").map((x: string) => x.trim()).filter(Boolean);
    const path = parts[0] || "";
    const filters = parts.slice(1);
    const value = applyFilters(getPath(vars, path), filters);
    return String(value ?? "");
  });

  // 2) doppie braces ESCAPED: {{ ... }}
  out = out.replace(/\{\{\s*([\s\S]+?)\s*\}\}/g, (_, expr: string) => {
    const parts = expr.split("|").map((x: string) => x.trim()).filter(Boolean);
    const path = parts[0] || "";
    const filters = parts.slice(1);
    const value = applyFilters(getPath(vars, path), filters);
    return escapeHtml(value);
  });

  return out;
}
