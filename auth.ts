import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [Google],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.profileType = (user as any).profileType ?? null;
      }
      if (trigger === "update" && session?.profileType !== undefined) {
        token.profileType = session.profileType;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.profileType = token.profileType as "programador" | "marketing" | null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
