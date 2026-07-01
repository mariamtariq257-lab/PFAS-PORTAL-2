// pages/api/auth/[...nextauth].js
// Replaces Auth0 — all 22 PFAS client logins hardcoded here.
// No external auth service needed. Runs entirely on Vercel.

import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

// All client logins — email (lowercase) → { password, projects[] }
// projects[] is the list of slugs this login can access
const USERS = {
  "lda@pfas.pk":        { password: "Lda@2026!",       projects: ["lda"] },
  "pcmmdc@pfas.pk":     { password: "Pcmmdc@2026!",    projects: ["pcmmdc"] },
  "p4a@pfas.pk":        { password: "P4a@2026!",       projects: ["p4a"] },
  "energy@pfas.pk":     { password: "Energy@2026!",    projects: ["energy"] },
  "fisheries@pfas.pk":  { password: "Fisheries@2026!", projects: ["shrimps"] },
  "tam@pfas.pk":        { password: "Tam@2026!",       projects: ["tam"] },
  "pha@pfas.pk":        { password: "Pha@2026!",       projects: ["pha"] },
  "pbf@pfas.pk":        { password: "Pbf@2026!",       projects: ["pbf"] },
  "hed@pfas.pk":        { password: "Hed@2026!",       projects: ["hed"] },
  "phimc@pfas.pk":      { password: "Phimc@2026!",     projects: ["phimc"] },
  "vss@pfas.pk":        { password: "Vss@2026!",       projects: ["twilight"] },

  // Combined logins
  "cw@pfas.pk":         { password: "Cw@2026!",        projects: ["bot1","bot2","bot3","bot4","bot5","om-roads"] },
  "fiedmc@pfas.pk":     { password: "Fiedmc@2026!",    projects: ["fiedmc-m3ic","fiedmc-sbp"] },
  "finance@pfas.pk":    { password: "Finance@2026!",   projects: ["punjab-onebill","twilight"] },
  "wildlife@pfas.pk":   { password: "Wildlife@2026!",  projects: ["wildlife-bansra","wildlife-changa"] },

  // Legacy single-project logins
  "fiedmc-sbp@pfas.pk": { password: "FiedmcSbp@2026!", projects: ["fiedmc-sbp"] },
  "cw-bot1@pfas.pk":    { password: "Bot1Cw@2026!",    projects: ["bot1"] },
  "cw-bot2@pfas.pk":    { password: "Bot2Cw@2026!",    projects: ["bot2"] },
  "cw-bot3@pfas.pk":    { password: "Bot3Cw@2026!",    projects: ["bot3"] },
  "cw-bot4@pfas.pk":    { password: "Bot4Cw@2026!",    projects: ["bot4"] },
  "cw-bot5@pfas.pk":    { password: "Bot5Cw@2026!",    projects: ["bot5"] },
  "cw-om@pfas.pk":      { password: "CwOm18@2026!",    projects: ["om-roads"] },
  "wildlife-b@pfas.pk": { password: "WildlifeB@2026!", projects: ["wildlife-bansra"] },
  "wildlife-c@pfas.pk": { password: "WildlifeC@2026!", projects: ["wildlife-changa"] },
};

export default NextAuth({
  providers: [
    CredentialsProvider({
      name: "PFAS Portal",
      credentials: {
        email:    { label: "Email",    type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = (credentials?.email || "").toLowerCase().trim();
        const password = credentials?.password || "";
        const user = USERS[email];
        if (!user || user.password !== password) return null;
        return { id: email, email, projects: user.projects };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // On sign-in, store projects in the JWT
      if (user) token.projects = user.projects;
      return token;
    },
    async session({ session, token }) {
      // Expose projects to the client via session
      session.user.projects = token.projects || [];
      return session;
    },
  },
  pages: {
    signIn: "/",   // Use our own login UI on the home page
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
});
