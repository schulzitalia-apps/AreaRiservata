import type {
  SprintTimelineEvent,
  SprintTimelineLane,
  SprintTimelineParticipant,
} from "./SprintTimeline.types";
import { isOperationalCheckpoint } from "./SprintTimeline.helpers";

export type SprintTimelineViewer = {
  userId?: string;
  userName?: string;
  isElevated?: boolean;
};

function normalize(value?: string | null) {
  return (value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Rimuove accenti
    .replace(/\s+/g, " "); // Normalizza spazi multipli
}

function participantMatchesViewer(
  participant: SprintTimelineParticipant | undefined,
  viewer?: SprintTimelineViewer,
) {
  if (!participant || !viewer) return false;

  const vId = viewer.userId;
  const pId = participant.id;

  // Corrispondenza per ID (diretto o in lista userIds)
  if (vId) {
    if (pId === vId || participant.userIds?.includes(vId)) {
      return true;
    }
  }

  // Corrispondenza per nome (fallback se non abbiamo ID certi)
  if (viewer.userName) {
    const nv = normalize(viewer.userName);
    const np = normalize(participant.name);
    if (nv && np && (nv === np || nv.includes(np) || np.includes(nv))) {
      return true;
    }
  }

  return false;
}

export function someParticipantMatchesViewer(
  participants: SprintTimelineParticipant[] | undefined,
  viewer?: SprintTimelineViewer,
) {
  return (participants ?? []).some((participant) =>
    participantMatchesViewer(participant, viewer),
  );
}


export function isTaskOwner(
  lane?: SprintTimelineLane | null,
  viewer?: SprintTimelineViewer,
) {
  if (!lane || !viewer) return false;
  
  if (lane.viewerIsOwner) return true;

  const vId = viewer.userId;
  const vName = viewer.userName ? normalize(viewer.userName) : "";

  if (vId) {
    if (lane.ownerId === vId || lane.ownerUserIds?.includes(vId)) return true;
  }

  if (vName && lane.ownerName) {
    const oName = normalize(lane.ownerName);
    if (vName === oName || vName.includes(oName) || oName.includes(vName)) return true;
  }

  return false;
}

export function isTaskReferente(
  lane?: SprintTimelineLane | null,
  viewer?: SprintTimelineViewer,
) {
  if (!lane || !viewer) return false;
  
  if (lane.viewerIsReferente) return true;

  const vId = viewer.userId;
  const vName = viewer.userName ? normalize(viewer.userName) : "";

  if (vId && lane.referenteId === vId) return true;

  if (vName && lane.referenteName) {
    const rName = normalize(lane.referenteName);
    if (vName === rName || vName.includes(rName) || rName.includes(vName)) return true;
  }

  return false;
}

export function isEventActionableByUser(
  event?: SprintTimelineEvent | null,
  viewer?: SprintTimelineViewer,
) {
  if (!event || !viewer) return false;
  if (viewer.isElevated) return true;

  // Se l'evento ha una lista di partecipanti, devi esserci dentro
  const hasParticipants = (event.participants ?? []).length > 0;
  if (hasParticipants) {
    return someParticipantMatchesViewer(event.participants, viewer);
  }

  // Se l'evento è una validazione, devi essere un validatore
  if (event.kind === "validation") {
    return (
      (event.viewerIsValidator || event.viewerCanValidate) ||
      someParticipantMatchesViewer(event.validators, viewer)
    );
  }

  // Di base, se non ci sono partecipanti, il backend decide tramite viewerCanAct
  return event.viewerCanAct || event.viewerIsParticipant;
}


export function canCreateLaneNote(
  lane?: SprintTimelineLane | null,
  viewer?: SprintTimelineViewer,
) {
  if (!lane) return false;
  if (!viewer) return true;
  if (viewer.isElevated) return true;
  return true;
}

export function canManageCheckpoint(
  lane?: SprintTimelineLane | null,
  viewer?: SprintTimelineViewer,
  eventKind?: string,
) {
  if (!lane || !viewer) return false;
  if (viewer.isElevated) return true;

  // Le note hanno un gate dedicato e non devono allargare i permessi dei checkpoint.
  if (eventKind === "note") return false;

  // Solo il proprietario o il referente possono gestire checkpoint/task-block.
  return isTaskOwner(lane, viewer) || isTaskReferente(lane, viewer);
}

export function canManageCheckpointBlock(
  lane: SprintTimelineLane,
  event: SprintTimelineEvent | null | undefined,
  viewer?: SprintTimelineViewer,
) {
  if (!event || event.kind !== "block-update") return false;
  return isEventActionableByUser(event, viewer);
}

export function canResolveCheckpoint(
  lane: SprintTimelineLane,
  event: SprintTimelineEvent | null | undefined,
  viewer?: SprintTimelineViewer,
) {
  if (!isOperationalCheckpoint(event)) return false;
  return isEventActionableByUser(event, viewer);
}

export function canManageTaskBlock(
  lane: SprintTimelineLane,
  event: SprintTimelineEvent | null | undefined,
  viewer?: SprintTimelineViewer,
) {
  if (!event || event.kind !== "task-block") return false;
  return isEventActionableByUser(event, viewer);
}

export function canDeleteTaskBlock(
  lane: SprintTimelineLane,
  event: SprintTimelineEvent | null | undefined,
  viewer?: SprintTimelineViewer,
) {
  void lane;
  void event;
  return !!viewer?.isElevated;
}

export function canDeleteCheckpoint(
  lane: SprintTimelineLane,
  event: SprintTimelineEvent | null | undefined,
  viewer?: SprintTimelineViewer,
) {
  if (!event || event.kind !== "checkpoint") return false;
  if (event.systemCheckpointType) return !!viewer?.isElevated;
  if (viewer?.isElevated) return true;
  return isTaskOwner(lane, viewer) || isTaskReferente(lane, viewer);
}

export function isValidationActionableByUser(
  event?: SprintTimelineEvent | null,
  viewer?: SprintTimelineViewer,
) {
  if (!event) return false;
  if (event.kind !== "validation") return false;
  if (event.validationState !== "requested") return false;
  if (event.decisionLocked) return false;
  if (event.viewerCanValidate || event.viewerIsValidator) return true;
  return someParticipantMatchesViewer(event.validators, viewer);
}

export function canConfigureValidation(
  lane: SprintTimelineLane,
  viewer: SprintTimelineViewer,
) {
  if (viewer.isElevated) return true;
  
  // Solo l'Owner o il Referente
  const authorized = isTaskOwner(lane, viewer) || isTaskReferente(lane, viewer);
  if (!authorized) return false;

  // Solo se NON ci sono checkpoint gialli APERTI o BLOCCATI
  // (escludendo le validazioni)
  const hasOpenCheckpoints = lane.events.some(event => {
    if (!isOperationalCheckpoint(event)) return false;
    // @ts-ignore - import dinamico per evitare cicli
    const { getCheckpointChainStatus, getEventChainId } = require("./SprintTimeline.helpers");
    const status = getCheckpointChainStatus(lane, getEventChainId(event));
    return status === "open" || status === "blocked";
  });

  return !hasOpenCheckpoints;
}

export function getBlockResolvers(event?: SprintTimelineEvent | null) {
  return (event?.participants ?? []).map((item) => item.name).filter(Boolean);
}
