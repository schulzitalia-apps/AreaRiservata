import mongoose from "mongoose";
import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import ProfileModel from "@/server-utils/models/Profile";
import UserModel from "@/server-utils/models/User";

export type AnimaResolvedUserProfile = {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  bio: string | null;
  displayName: string | null;
};

export async function loadAnimaUserProfile(args: {
  userId: string;
  fallbackName?: string | null;
}): Promise<AnimaResolvedUserProfile> {
  if (!args.userId || !mongoose.isValidObjectId(args.userId)) {
    return {
      fullName: null,
      email: null,
      phone: null,
      bio: null,
      displayName: args.fallbackName ?? null,
    };
  }

  await connectToDatabase();

  const objectId = new mongoose.Types.ObjectId(args.userId);

  const [profile, user] = await Promise.all([
    ProfileModel.findOne({ userId: objectId }).lean(),
    UserModel.findById(objectId).select({ name: 1, email: 1 }).lean(),
  ]);

  const fullName =
    typeof profile?.fullName === "string" && profile.fullName.trim()
      ? profile.fullName.trim()
      : null;

  const displayName =
    fullName ||
    (typeof user?.name === "string" && user.name.trim() ? user.name.trim() : null) ||
    args.fallbackName ||
    null;

  return {
    fullName,
    email:
      typeof user?.email === "string" && user.email.trim()
        ? user.email.trim().toLowerCase()
        : null,
    phone:
      typeof profile?.phone === "string" && profile.phone.trim()
        ? profile.phone.trim()
        : null,
    bio:
      typeof profile?.bio === "string" && profile.bio.trim()
        ? profile.bio.trim()
        : null,
    displayName,
  };
}
