"use client";

export type WhiteboardParticipant = {
  key: string; // `${anagraficaType}:${anagraficaId}`
  anagraficaType: string;
  anagraficaId: string;

  displayName: string; // NOME UMANO
  subtitle: string | null;
};

export type WhiteboardEventVM = {
  id: string;
  title: string;
  subtitle: string | null;

  start: string; // ISO
  end: string;   // ISO

  typeSlug: string;
  typeLabel: string;

  visibilityRole: string | null;

  participants: WhiteboardParticipant[];
};
