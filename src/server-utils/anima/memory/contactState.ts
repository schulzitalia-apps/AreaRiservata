import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import { AnimaMemoryModel } from "@/server-utils/anima-mini/animaMemory";

export type RememberedContact = {
  recordId: string;
  typeSlug: string;
  typeLabel: string;
  displayName: string;
  emails: string[];
  phones: string[];
  updatedAt: string;
};

export type ContactState = {
  recentContacts: RememberedContact[];
};

function normalizeContact(raw: any): RememberedContact | null {
  const recordId = String(raw?.recordId ?? "").trim();
  const typeSlug = String(raw?.typeSlug ?? "").trim();
  const typeLabel = String(raw?.typeLabel ?? "").trim();
  const displayName = String(raw?.displayName ?? "").trim();
  const emails = Array.isArray(raw?.emails)
    ? raw.emails.map((item: unknown) => String(item).trim().toLowerCase()).filter(Boolean)
    : [];
  const phones = Array.isArray(raw?.phones)
    ? raw.phones.map((item: unknown) => String(item).trim()).filter(Boolean)
    : [];

  if (!recordId || !typeSlug || !displayName) {
    return null;
  }

  return {
    recordId,
    typeSlug,
    typeLabel: typeLabel || typeSlug,
    displayName,
    emails,
    phones,
    updatedAt: raw?.updatedAt
      ? new Date(raw.updatedAt).toISOString()
      : new Date().toISOString(),
  };
}

export async function loadContactState(
  sessionId: string,
): Promise<ContactState | null> {
  if (!sessionId) return null;

  await connectToDatabase();
  const doc = (await AnimaMemoryModel.findById(sessionId).lean()) as {
    contactState?: {
      recentContacts?: unknown[];
    } | null;
  } | null;
  const recentContacts = Array.isArray(doc?.contactState?.recentContacts)
    ? doc.contactState.recentContacts
        .map((item: unknown) => normalizeContact(item))
        .filter((item): item is RememberedContact => !!item)
    : [];

  if (!recentContacts.length) {
    return null;
  }

  return {
    recentContacts,
  };
}

export async function saveContactState(
  sessionId: string,
  state: ContactState,
): Promise<void> {
  if (!sessionId) return;

  await connectToDatabase();
  await AnimaMemoryModel.updateOne(
    { _id: sessionId },
    {
      $set: {
        contactState: {
          recentContacts: state.recentContacts.map((contact) => ({
            ...contact,
            updatedAt: new Date(contact.updatedAt),
          })),
        },
      },
    },
    { upsert: true },
  );
}

export async function rememberContacts(
  sessionId: string,
  contacts: RememberedContact[],
): Promise<ContactState | null> {
  if (!sessionId || !contacts.length) return null;

  const previous = await loadContactState(sessionId);
  const merged = [
    ...contacts,
    ...(previous?.recentContacts ?? []),
  ];

  const deduped = Array.from(
    new Map(
      merged.map((contact) => [
        `${contact.typeSlug}:${contact.recordId}`,
        {
          ...contact,
          emails: Array.from(new Set(contact.emails)),
          phones: Array.from(new Set(contact.phones)),
        },
      ]),
    ).values(),
  ).slice(0, 8);

  const nextState = {
    recentContacts: deduped,
  };

  await saveContactState(sessionId, nextState);
  return nextState;
}
