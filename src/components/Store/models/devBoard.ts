// src/components/Store/models/devBoard.ts

export type DevItemCategory = "bug" | "feature" | "training" | "note";
export type DevItemStatus = "open" | "in_progress" | "done";

export type DevBoardItem = {
  id: string;
  category: DevItemCategory;
  title: string;
  description: string;
  status: DevItemStatus;
  versionTag: string | null;
  createdAt?: string;
  updatedAt?: string;
  createdBy?:
    | {
    id: string;
    name: string;
    email: string;
    role: string | null;
  }
    | null;
};
