// src/server-utils/services/mails/render.ts
export function renderMustacheLite(template: string, vars: Record<string, any>) {
  return template.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => {
    const path = key.split(".");
    let cur: any = vars;
    for (const p of path) cur = cur?.[p];
    return cur === null || cur === undefined ? "" : String(cur);
  });
}
