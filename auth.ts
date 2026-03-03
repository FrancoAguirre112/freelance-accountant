import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [Google],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        // Query DB directly to get profileType since the adapter doesn't include custom fields
        const dbUser = await db.query.users.findFirst({
          where: eq(users.id, user.id!),
          columns: { profileType: true },
        });
        token.profileType = dbUser?.profileType ?? null;
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
