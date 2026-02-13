// src/store/models/profile.ts

export type ProfileData = {
  fullName?: string | null;
  phone?: string | null;
  bio?: string | null;
  avatarKey?: string | null;
  updatedAt?: string | null; // ISO string (timestamps)
};
