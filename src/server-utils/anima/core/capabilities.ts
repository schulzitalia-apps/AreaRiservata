import type { AnimaCapability, AnimaUserContext } from "./types";

export function getBaseAnimaCapabilities(
  user: AnimaUserContext,
): AnimaCapability[] {
  const capabilities: AnimaCapability[] = [
    "conversation.reply",
    "conversation.help.events",
    "eventi.types.list",
    "eventi.recent.summary",
  ];

  if (user.isAuthenticated) {
    capabilities.push(
      "anagrafiche.read",
      "sprintTimeline.read",
      "sprintTimeline.prioritize",
    );

    if (user.role !== "Cliente") {
      capabilities.push("anagrafiche.create");
    }
  }

  if (user.email) {
    capabilities.push("mail.send");
  }

  return capabilities;
}
