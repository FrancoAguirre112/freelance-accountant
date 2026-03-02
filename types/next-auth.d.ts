import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      profileType?: "programador" | "marketing" | null;
    };
  }

  interface User {
    profileType?: "programador" | "marketing" | null;
  }
}
