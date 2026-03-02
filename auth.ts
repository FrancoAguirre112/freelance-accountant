import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [Google],
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id;
      // Fetch profileType from DB
      const dbUser = await db.query.users.findFirst({
        where: eq(users.id, user.id),
      });
      session.user.profileType = dbUser?.profileType ?? null;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
