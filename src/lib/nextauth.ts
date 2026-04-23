/**
 * NextAuth configuration — used only for server-side session in the dashboard UI.
 * API routes use the custom JWT auth in src/lib/auth.ts instead.
 */
import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import { loginSchema } from "@/lib/validations/auth";
import { UserRole } from "@/types";

export const authOptions: NextAuthOptions = {
  secret:
    process.env.NEXTAUTH_SECRET ||
    process.env.JWT_SECRET ||
    "ventu-suli-demo-nextauth-secret-change-me",
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            name: true,
            email: true,
            password_hash: true,
            role: true,
            organization_id: true,
          },
        });

        if (!user) return null;
        const ok = await verifyPassword(password, user.password_hash);
        if (!ok) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { last_login_at: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as UserRole,
          organization_id: user.organization_id,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: UserRole }).role;
        token.organization_id = (user as { organization_id: string }).organization_id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.organization_id = token.organization_id as string;
      }
      return session;
    },
  },
};
