import { getEventiList } from "@/config/eventi.registry";

export type EventTypeResolverMode = "includes" | "catalog_tokens";

export type EventTypeMatch = {
  slug: string;
  label: string;
  score: number;
  matchedBy: string;
};

export type EventTypeAmbiguity = {
  ambiguous: boolean;
  options: string[];
};

export type EventTypeResolutionAnalysis = {
  best: EventTypeMatch | null;
  candidates: EventTypeMatch[];
  ambiguity: EventTypeAmbiguity;
};

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .map((item) => item.trim())
    .filter((item) => item.length >= 3);
}

const EVENT_TYPE_ALIASES: Partial<Record<string, string[]>> = {
  arrivo_merce: [
    "scarico merce",
    "scarico merci",
    "scarichi merce",
    "scarichi merci",
  ],
  ordine_merce: ["ordine merci", "ordini merce", "ordini merci"],
  "fattura-pagata": [
    "pagamento fattura",
    "pagamento di fattura",
    "pagamenti fatture",
    "pagamenti di fatture",
    "fattura pagata",
    "fatture pagate",
  ],
};

function singularizeToken(token: string): string[] {
  const variants = new Set<string>([token]);
  if (token.endsWith("i") && token.length > 4) {
    variants.add(`${token.slice(0, -1)}e`);
    variants.add(token.slice(0, -1));
  }
  if (token.endsWith("e") && token.length > 4) {
    variants.add(`${token.slice(0, -1)}i`);
    variants.add(token.slice(0, -1));
  }
  return Array.from(variants).filter((item) => item.length >= 3);
}

function buildCandidateTexts(item: { slug: string; label: string }) {
  return [item.slug, item.label, ...(EVENT_TYPE_ALIASES[item.slug] ?? [])]
    .map((candidate) => normalizeText(candidate))
    .filter(Boolean);
}

function buildCandidateTokens(item: { slug: string; label: string }): Set<string> {
  return new Set(
    buildCandidateTexts(item).flatMap((candidate) =>
      tokenize(candidate).flatMap((token) => singularizeToken(token)),
    ),
  );
}

function buildScoredCandidates(args: {
  message: string;
  mode: EventTypeResolverMode;
}): EventTypeMatch[] {
  const normalizedMessage = normalizeText(args.message);
  const messageTokens = tokenize(normalizedMessage).flatMap((token) =>
    singularizeToken(token),
  );
  if (!normalizedMessage) return [];

  const matches = getEventiList()
    .map((item) => {
      const candidateTexts = buildCandidateTexts(item);
      const candidateTokens = buildCandidateTokens(item);
      const exactLabel = candidateTexts.find(
        (candidate) => candidate === normalizeText(item.label),
      );
      const labelIncluded =
        exactLabel && normalizedMessage.includes(exactLabel) ? exactLabel : null;
      const slugIncluded = normalizedMessage.includes(normalizeText(item.slug))
        ? normalizeText(item.slug)
        : null;
      const aliasIncluded = candidateTexts.find(
        (candidate) =>
          candidate !== normalizeText(item.label) &&
          candidate !== normalizeText(item.slug) &&
          normalizedMessage.includes(candidate),
      );

      let score = 0;
      let matchedBy = args.mode === "includes" ? "includes" : "catalog_tokens";

      if (labelIncluded) {
        score = 1;
        matchedBy = `includes:label:${labelIncluded}`;
      } else if (slugIncluded) {
        score = 0.97;
        matchedBy = `includes:slug:${slugIncluded}`;
      } else if (aliasIncluded) {
        score = 0.95;
        matchedBy = `includes:alias:${aliasIncluded}`;
      } else if (args.mode === "catalog_tokens" && messageTokens.length) {
        const matchedTokens = Array.from(new Set(messageTokens)).filter((token) =>
          candidateTokens.has(token),
        );
        if (!matchedTokens.length) {
          return null;
        }
        const messageCoverage =
          matchedTokens.length / Math.max(new Set(messageTokens).size, 1);
        const candidateCoverage =
          matchedTokens.length / Math.max(candidateTokens.size, 1);
        score = messageCoverage * 0.75 + candidateCoverage * 0.25;
        matchedBy = `catalog_tokens:${matchedTokens.join(",")}`;
      } else {
        return null;
      }

      return {
        slug: item.slug,
        label: item.label,
        score,
        matchedBy,
      } satisfies EventTypeMatch;
    })
    .filter((item): item is EventTypeMatch => !!item)
    .sort((a, b) => b.score - a.score);

  return matches;
}

export function analyzeEventTypeResolution(args: {
  message: string;
  mode?: EventTypeResolverMode;
}): EventTypeResolutionAnalysis {
  const mode = args.mode ?? "catalog_tokens";
  const candidates = buildScoredCandidates({
    message: args.message,
    mode,
  });

  const best = candidates[0] ?? null;
  const second = candidates[1] ?? null;
  const ambiguous =
    !!best &&
    !!second &&
    best.score >= 0.4 &&
    second.score >= 0.4 &&
    Math.abs(best.score - second.score) <= 0.12;
  const options = ambiguous
    ? candidates
        .filter((candidate) => best && best.score - candidate.score <= 0.12)
        .slice(0, 3)
        .map((candidate) => candidate.label)
    : [];

  return {
    best: ambiguous ? null : best,
    candidates,
    ambiguity: {
      ambiguous,
      options,
    },
  };
}

export function detectEventTypeAmbiguity(message: string): EventTypeAmbiguity {
  return analyzeEventTypeResolution({
    message,
    mode: "catalog_tokens",
  }).ambiguity;
}

export function resolveEventType(args: {
  message: string;
  mode?: EventTypeResolverMode;
}): EventTypeMatch | null {
  return analyzeEventTypeResolution(args).best;
}
