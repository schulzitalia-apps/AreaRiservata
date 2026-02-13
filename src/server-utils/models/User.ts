import mongoose, { Document, Model, Schema, Types } from "mongoose";
import bcrypt from "bcrypt";
import { AppRole, ROLES } from "@/types/roles";

export interface IUser {
  email: string;
  password?: string;          // hashed (select: false)
  role: AppRole;
  approved: boolean;
  name?: string;
}

export interface IUserDocument extends IUser, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  comparePassword?(plain: string): Promise<boolean>;
}

const userSchema = new Schema<IUserDocument>(
  {
    email: {
      type: String,
      required: [true, "L'indirizzo email è obbligatorio."],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/.+\@.+\..+/, "Per favore, inserisci un indirizzo email valido."],
    },
    password: {
      type: String,
      select: false, // importantissimo: non esporre di default
    },
    role: {
      type: String,
      enum: ROLES,
      default: "Cliente",
    },
    approved: {
      type: Boolean,
      default: false,
    },
    name: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Helper per confrontare
userSchema.methods.comparePassword = function (plain: string) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(plain, this.password);
};

const UserModel: Model<IUserDocument> =
  (mongoose.models.User as Model<IUserDocument>) ||
  mongoose.model<IUserDocument>("User", userSchema);

export default UserModel;
