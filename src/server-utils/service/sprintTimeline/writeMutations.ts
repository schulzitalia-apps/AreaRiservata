import type { AuthContext } from "@/server-utils/lib/auth-context";
import { anagraficheService } from "@/components/Store/services/anagraficheService"; // Nota: in un mondo ideale questi sarebbero service server puri
import { eventiService } from "@/components/Store/services/eventiService";
import {
  SPRINT_AULA_TYPE,
  TASK_ANAGRAFICA_TYPE,
  TIMELINE_EVENT_TYPE,
} from "@/components/AtlasModuli/SprintTimeline/constants";
import { resolveActorByName, resolveActorsByNames } from "./resolveActors";
import type { SprintTimelineCreateTaskPayload } from "@/components/AtlasModuli/SprintTimeline/SprintTimeline.types";

/**
 * Nota: Attualmente i service 'anagraficheService' e 'eventiService' sono importati da '@/components/Store/services'.
 * In questa architettura ibrida, stiamo preparando il terreno. Se questi service usano 'fetch' con path relativi, 
 * sul server potrebbero aver bisogno di URL assoluti o di una versione server-side dedicata.
 * 
 * Assumiamo per ora che il service di dominio server-side serva come documentazione operativa e punto di convergenza.
 */

export async function createSprintTimelineTaskServer(args: {
  sprintId: string;
  payload: SprintTimelineCreateTaskPayload;
  auth: AuthContext;
}) {
  const { payload } = args;

  const [owner, referente] = await Promise.all([
    resolveActorByName(payload.ownerName || ""),
    resolveActorByName(payload.referenteName || ""),
  ]);

  // Qui andrebbe la logica di creazione che oggi risiede nei thunk,
  // ma eseguita interamente server-side.
  
  // 1. Create Task Anagrafica
  // 2. Attach to Sprint
  // 3. Create Milestone Events
  
  // NOTA: Per ora limitiamoci a definire lo scheletro come richiesto dal piano "preparatorio".
  // Lo spostamento effettivo dell'esecuzione richiede che i service Atlas siano richiamabili server-side.
}

export async function createSprintTimelineEventServer(args: {
  sprintId: string;
  laneId: string;
  payload: any;
  auth: AuthContext;
}) {
  // Risoluzione attori server-side
  const actors = await resolveActorsByNames(args.payload.participants || []);
  
  // Logica di creazione evento...
}
