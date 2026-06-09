import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

const router = Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Verify the Google token, create/update the user, log them in
router.post("/auth/google", async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: "Missing credential" });

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email || !payload.sub) {
      return res.status(401).json({ error: "Invalid Google token" });
    }

    const existing = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.googleId, payload.sub))
      .limit(1);

    let user;
    if (existing.length > 0) {
      [user] = await db
        .update(usersTable)
        .set({
          name: payload.name ?? existing[0].name,
          picture: payload.picture ?? null,
          lastLoginAt: new Date(),
        })
        .where(eq(usersTable.id, existing[0].id))
        .returning();
    } else {
      [user] = await db
        .insert(usersTable)
        .values({
          googleId: payload.sub,
          email: payload.email,
          name: payload.name ?? payload.email,
          picture: payload.picture ?? null,
          role: "agent",
        })
        .returning();
    }

    req.session.userId = user.id;
    res.json({ id: user.id, email: user.email, name: user.name, picture: user.picture, role: user.role });
  } catch (err) {
    req.log.error({ err }, "Google auth failed");
    res.status(401).json({ error: "Authentication failed" });
  }
});

// Who am I?
router.get("/auth/me", async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    const rows = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (rows.length === 0) return res.status(401).json({ error: "Not authenticated" });
    const u = rows[0];
    res.json({ id: u.id, email: u.email, name: u.name, picture: u.picture, role: u.role });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Log out
router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

export default router;