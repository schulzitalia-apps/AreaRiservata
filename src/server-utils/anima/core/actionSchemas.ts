import {
  ANIMA_ACTIONS_CONFIG,
  type AnimaActionKey,
} from "@/server-utils/anima/config/anima.actions.config";

function hasMeaningfulValue(value: unknown): boolean {
  if (value === null || typeof value === "undefined") return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

export function resolveActionFieldState<T extends Record<string, unknown>>(args: {
  actionKey: AnimaActionKey;
  data: T;
}) {
  const definition = ANIMA_ACTIONS_CONFIG[args.actionKey];
  const missing: string[] = [];

  for (const field of definition.fields as ReadonlyArray<{
    key: string;
    required: boolean;
    missingLabel?: string;
  }>) {
    if (!field.required) continue;
    if (hasMeaningfulValue(args.data[field.key])) continue;
    missing.push(field.missingLabel ?? field.key);
  }

  return {
    definition,
    missing,
    readiness:
      definition.executeWhenRequiredFieldsArePresent && missing.length === 0
        ? ("ready" as const)
        : ("collecting" as const),
  };
}
