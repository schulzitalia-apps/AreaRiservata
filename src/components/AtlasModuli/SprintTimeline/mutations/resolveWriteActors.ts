"use client";

export type ResolvedActorClient = {
  name: string;
  userId?: string;
  anagraficaId?: string; // evolverId
};

/**
 * Risolve un set di nomi in attori strutturati chiamando l'endpoint dedicato.
 */
export async function resolveActorsByNamesClient(
  names: string[],
): Promise<ResolvedActorClient[]> {
  const uniqueNames = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));
  if (!uniqueNames.length) return [];

  try {
    const res = await fetch("/api/sprint-timeline/resolve-actors", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ names: uniqueNames }),
    });

    if (!res.ok) {
      console.warn("Failed to resolve actors, falling back to names only");
      return uniqueNames.map((name) => ({ name }));
    }

    const json = await res.json();
    return json.actors as ResolvedActorClient[];
  } catch (error) {
    console.error("Error resolving actors client-side:", error);
    return uniqueNames.map((name) => ({ name }));
  }
}
