// src/lib/auth-options.ts
import type { NextAuthOptions, User as NextAuthUserBaseType } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import UserModel, { IUserDocument } from "@/server-utils/models/User";
import bcrypt from "bcrypt";
import { AppRole } from "@/types/roles";

// Tipologia utente restituita da authorize
interface AuthorizeResponseUser {
  id: string;
  email: string;
  role: AppRole;
  name?: string | null;
  image?: string | null;
}

// Estensioni tipi NextAuth (puoi anche metterle in src/types/next-auth.d.ts)
declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      role?: AppRole;
    } & NextAuthUserBaseType;
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: AppRole;
  }
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET as string,
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials): Promise<AuthorizeResponseUser | null> {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email e password sono richieste.");
        }

        await connectToDatabase();

        const foundUser: IUserDocument | null = await UserModel
          .findOne({ email: credentials.email.toLowerCase().trim() })
          .select("+password");

        if (!foundUser || !foundUser.password) {
          throw new Error("Credenziali non valide.");
        }

        const passwordCorrect = await bcrypt.compare(credentials.password, foundUser.password);
        if (!passwordCorrect) {
          throw new Error("Credenziali non valide.");
        }

        if (!foundUser.approved) {
          throw new Error("Utente non approvato. Contatta l'amministratore.");
        }

        return {
          id: foundUser._id.toString(),
          email: foundUser.email,
          role: foundUser.role,
          name: foundUser.name,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as AuthorizeResponseUser;
        if (u.id) token.id = u.id;
        if (u.role) token.role = u.role;
        if (u.name) token.name = u.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.id) session.user.id = token.id as string;
        if (token.role) session.user.role = token.role as AppRole;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
};
