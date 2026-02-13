// src/store/services/profileService.ts
import { apiClient } from "../api/client";
import { ProfileData } from "../models/profile";

const mapProfile = (json: any): ProfileData => ({
  fullName: json.fullName ?? null,
  phone: json.phone ?? null,
  bio: json.bio ?? null,
  avatarKey: json.avatarKey ?? null,
  updatedAt: json.updatedAt ?? null,
});

export const profileService = {
  async fetchMyProfile(): Promise<ProfileData> {
    const json = await apiClient.get<any>("/api/profile/me");
    return mapProfile(json);
  },

  async updateMyProfile(payload: {
    fullName?: string;
    phone?: string;
    bio?: string;
  }): Promise<ProfileData> {
    const json = await apiClient.patch<any>("/api/profile/me", payload);
    return mapProfile(json);
  },
};
