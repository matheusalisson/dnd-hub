// Servidor do BanD&D: serve o site e a API de contas, campanhas compartilhadas e sincronização.
// Usa apenas módulos do Node (>= 22.13): http, sqlite e crypto.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { openDatabase, transaction } from "./db.js";
import {
  SESSION_COOKIE,
  SESSION_DAYS,
  createRateLimiter,
  hashPassword,
  newToken,
  sha256,
  verifyAgainstDummy,
  verifyPassword,
} from "./auth.js";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const MAX_BODY = 6 * 1024 * 1024;
const INVITE_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;
const BACKGROUNDS = ["mountains", "forest", "ruins", "night", "custom"];
const ROLES = ["editor", "viewer"];
const PERSONAL_KEYS = ["combatants", "round", "currentCombatantId", "customCreatures", "activeCampaignId"];
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

const text = (value, max) => String(value ?? "").slice(0, max);
const isEditorRole = (role) => role === "owner" || role === "editor";

export function createApp({ dbFile = join(ROOT, "data", "bandd.db"), staticRoot = ROOT, limits = {} } = {}) {
  const db = openDatabase(dbFile);
  const loginLimiter = createRateLimiter({ max: limits.login ?? 10, windowMs: 15 * 60 * 1000 });
  const registerLimiter = createRateLimiter({ max: limits.register ?? 5, windowMs: 60 * 60 * 1000 });
  const inviteLimiter = createRateLimiter({ max: limits.invite ?? 20, windowMs: 15 * 60 * 1000 });

  const q = {
    userByEmail: db.prepare("SELECT * FROM users WHERE email = ?"),
    insertUser: db.prepare("INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)"),
    insertSession: db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)"),
    sessionUser: db.prepare("SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?"),
    deleteSession: db.prepare("DELETE FROM sessions WHERE token_hash = ?"),
    purgeSessions: db.prepare("DELETE FROM sessions WHERE expires_at <= ?"),
    purgeInvites: db.prepare("DELETE FROM campaign_invites WHERE expires_at <= ?"),
    personal: db.prepare("SELECT data FROM personal_data WHERE user_id = ?"),
    savePersonal: db.prepare(`INSERT INTO personal_data (user_id, data, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`),
    campaign: db.prepare("SELECT * FROM campaigns WHERE id = ?"),
    role: db.prepare("SELECT role FROM campaign_members WHERE campaign_id = ? AND user_id = ?"),
    myCampaigns: db.prepare(`SELECT c.*, m.role, o.name AS owner_name,
        (SELECT COUNT(*) FROM campaign_members x WHERE x.campaign_id = c.id) AS member_count
      FROM campaigns c
      JOIN campaign_members m ON m.campaign_id = c.id AND m.user_id = ?
      JOIN users o ON o.id = c.owner_id
      ORDER BY c.rowid`),
    insertCampaign: db.prepare("INSERT INTO campaigns (id, owner_id, name, description, background, image_url, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"),
    updateCampaign: db.prepare("UPDATE campaigns SET name = ?, description = ?, background = ?, image_url = ?, updated_at = ? WHERE id = ?"),
    deleteCampaign: db.prepare("DELETE FROM campaigns WHERE id = ?"),
    insertMember: db.prepare("INSERT OR IGNORE INTO campaign_members (campaign_id, user_id, role) VALUES (?, ?, ?)"),
    members: db.prepare(`SELECT u.id, u.name, u.email, m.role FROM campaign_members m JOIN users u ON u.id = m.user_id
      WHERE m.campaign_id = ? ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END, u.name`),
    setMemberRole: db.prepare("UPDATE campaign_members SET role = ? WHERE campaign_id = ? AND user_id = ? AND role != 'owner'"),
    removeMember: db.prepare("DELETE FROM campaign_members WHERE campaign_id = ? AND user_id = ? AND role != 'owner'"),
    insertInvite: db.prepare("INSERT INTO campaign_invites (code_hash, campaign_id, role, created_by, expires_at) VALUES (?, ?, ?, ?, ?)"),
    invite: db.prepare("SELECT * FROM campaign_invites WHERE code_hash = ? AND expires_at > ?"),
    deleteInvite: db.prepare("DELETE FROM campaign_invites WHERE code_hash = ?"),
    note: db.prepare("SELECT * FROM notes WHERE id = ?"),
    myNotes: db.prepare(`SELECT n.*, a.name AS author_name FROM notes n JOIN users a ON a.id = n.author_id
      WHERE (n.campaign_id IS NULL AND n.author_id = ?)
         OR n.campaign_id IN (SELECT campaign_id FROM campaign_members WHERE user_id = ?)`),
    upsertNote: db.prepare(`INSERT INTO notes (id, author_id, campaign_id, title, content, updated_at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET campaign_id = excluded.campaign_id, title = excluded.title, content = excluded.content, updated_at = excluded.updated_at`),
    deleteNote: db.prepare("DELETE FROM notes WHERE id = ?"),
  };

  const cleanup = () => {
    const now = Date.now();
    q.purgeSessions.run(now);
    q.purgeInvites.run(now);
  };
  cleanup();
  const cleanupTimer = setInterval(cleanup, 60 * 60 * 1000);
  cleanupTimer.unref();

  const roleOf = (campaignId, userId) => q.role.get(campaignId, userId)?.role || null;

  function campaignInput(body) {
    const name = text(body.name, 80).trim();
    if (!name) throw new HttpError(400, "name_required");
    const background = BACKGROUNDS.includes(body.background) ? body.background : "mountains";
    const imageUrl = background === "custom" && /^https:\/\/\S+$/i.test(String(body.imageUrl || "")) ? text(body.imageUrl, 2000) : "";
    return { name, description: text(body.description, 500), background, imageUrl };
  }

  function serializeCampaign(row) {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      background: row.background,
      imageUrl: row.image_url,
      updatedAt: row.updated_at,
      role: row.role,
      ownerName: row.owner_name,
      memberCount: row.member_count,
    };
  }

  function serializeNote(row) {
    return { id: row.id, title: row.title, content: row.content, campaignId: row.campaign_id || "", updatedAt: row.updated_at, authorName: row.author_name };
  }

  function readPersonal(userId) {
    try {
      return JSON.parse(q.personal.get(userId)?.data || "null");
    } catch {
      return null;
    }
  }

  function personalInput(body) {
    const data = {};
    for (const key of PERSONAL_KEYS) if (key in body) data[key] = body[key];
    if (!Array.isArray(data.combatants)) data.combatants = [];
    if (!Array.isArray(data.customCreatures)) data.customCreatures = [];
    data.round = Math.max(1, Math.floor(Number(data.round)) || 1);
    data.currentCombatantId = typeof data.currentCombatantId === "string" ? text(data.currentCombatantId, 80) : null;
    data.activeCampaignId = typeof data.activeCampaignId === "string" ? text(data.activeCampaignId, 80) : null;
    return data;
  }

  // Cria ou atualiza uma campanha. Um id já usado por campanha alheia gera 409 para o cliente trocar de id.
  function saveCampaign(user, id, body) {
    const input = campaignInput(body);
    const existing = q.campaign.get(id);
    const now = Date.now();
    if (!existing) {
      transaction(db, () => {
        q.insertCampaign.run(id, user.id, input.name, input.description, input.background, input.imageUrl, now);
        q.insertMember.run(id, user.id, "owner");
      });
      return;
    }
    const role = roleOf(id, user.id);
    if (!role) throw new HttpError(409, "id_taken");
    if (!isEditorRole(role)) throw new HttpError(403, "forbidden");
    q.updateCampaign.run(input.name, input.description, input.background, input.imageUrl, now, id);
  }

  function canWriteNote(user, note) {
    return note.campaign_id ? isEditorRole(roleOf(note.campaign_id, user.id)) : note.author_id === user.id;
  }

  function canSeeNote(user, note) {
    return note.campaign_id ? Boolean(roleOf(note.campaign_id, user.id)) : note.author_id === user.id;
  }

  function saveNote(user, id, body) {
    const campaignId = body.campaignId ? text(body.campaignId, 80) : null;
    if (campaignId && !isEditorRole(roleOf(campaignId, user.id))) throw new HttpError(403, "forbidden");
    const existing = q.note.get(id);
    if (existing && !canWriteNote(user, existing)) throw new HttpError(canSeeNote(user, existing) ? 403 : 409, canSeeNote(user, existing) ? "forbidden" : "id_taken");
    const now = Date.now();
    const updatedAt = Number.isFinite(Number(body.updatedAt)) ? Math.min(Number(body.updatedAt), now + 60000) : now;
    q.upsertNote.run(id, existing?.author_id || user.id, campaignId, text(body.title, 100), text(body.content, 100000), updatedAt);
  }

  function snapshot(user) {
    return {
      user,
      campaigns: q.myCampaigns.all(user.id).map(serializeCampaign),
      notes: q.myNotes.all(user.id, user.id).map(serializeNote),
      personal: readPersonal(user.id),
    };
  }

  // ---- Sessão e cookies ----
  function parseCookies(header = "") {
    return Object.fromEntries(header.split(";").map((part) => part.trim().split("=")).filter(([k, v]) => k && v).map(([k, v]) => [k, decodeURIComponent(v)]));
  }

  function sessionCookie(req, value, maxAgeSeconds) {
    const secure = req.socket.encrypted || process.env.COOKIE_SECURE === "1" ? "; Secure" : "";
    return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
  }

  function startSession(req, res, userId) {
    const token = newToken();
    q.insertSession.run(sha256(token), userId, Date.now() + SESSION_DAYS * DAY);
    res.setHeader("Set-Cookie", sessionCookie(req, token, SESSION_DAYS * 24 * 60 * 60));
  }

  function currentUser(req) {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    return token ? q.sessionUser.get(sha256(token), Date.now()) || null : null;
  }

  function requireUser(req) {
    const user = currentUser(req);
    if (!user) throw new HttpError(401, "unauthorized");
    return { id: user.id, email: user.email, name: user.name };
  }

  const clientIp = (req) => req.socket.remoteAddress || "unknown";

  // ---- Rotas da API ----
  const routes = [
    ["POST", /^\/api\/auth\/register$/, async (req, res, body) => {
      if (!registerLimiter(clientIp(req))) throw new HttpError(429, "too_many_attempts");
      const name = text(body.name, 60).trim();
      const email = text(body.email, 200).trim().toLowerCase();
      const password = String(body.password ?? "");
      if (!name) throw new HttpError(400, "name_required");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "invalid_email");
      if (password.length < 8 || password.length > 200) throw new HttpError(400, "weak_password");
      if (q.userByEmail.get(email)) throw new HttpError(409, "email_taken");
      const id = randomUUID();
      q.insertUser.run(id, email, name, await hashPassword(password), Date.now());
      startSession(req, res, id);
      return [201, { user: { id, email, name } }];
    }],
    ["POST", /^\/api\/auth\/login$/, async (req, res, body) => {
      const email = text(body.email, 200).trim().toLowerCase();
      const password = String(body.password ?? "").slice(0, 200);
      if (!loginLimiter(`${clientIp(req)}|${email}`)) throw new HttpError(429, "too_many_attempts");
      const user = q.userByEmail.get(email);
      const valid = user ? await verifyPassword(password, user.password_hash) : await verifyAgainstDummy(password);
      if (!valid) throw new HttpError(401, "invalid_credentials");
      startSession(req, res, user.id);
      return [200, { user: { id: user.id, email: user.email, name: user.name } }];
    }],
    ["POST", /^\/api\/auth\/logout$/, async (req, res) => {
      const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
      if (token) q.deleteSession.run(sha256(token));
      res.setHeader("Set-Cookie", sessionCookie(req, "", 0));
      return [204];
    }],
    // Visitante recebe user: null (e não 401) para o site saber que o servidor existe sem gerar erro.
    ["GET", /^\/api\/auth\/me$/, async (req) => {
      const user = currentUser(req);
      return [200, { user: user ? { id: user.id, email: user.email, name: user.name } : null }];
    }],

    ["GET", /^\/api\/sync$/, async (req) => [200, snapshot(requireUser(req))]],
    ["PUT", /^\/api\/personal$/, async (req, res, body) => {
      const user = requireUser(req);
      q.savePersonal.run(user.id, JSON.stringify(personalInput(body)), Date.now());
      return [204];
    }],

    ["PUT", /^\/api\/campaigns\/([\w-]{1,80})$/, async (req, res, body, [id]) => {
      saveCampaign(requireUser(req), id, body);
      return [204];
    }],
    ["DELETE", /^\/api\/campaigns\/([\w-]{1,80})$/, async (req, res, body, [id]) => {
      const user = requireUser(req);
      const role = roleOf(id, user.id);
      if (!q.campaign.get(id)) return [204];
      if (role !== "owner") throw new HttpError(role ? 403 : 404, role ? "forbidden" : "not_found");
      q.deleteCampaign.run(id);
      return [204];
    }],
    ["GET", /^\/api\/campaigns\/([\w-]{1,80})\/members$/, async (req, res, body, [id]) => {
      const user = requireUser(req);
      const role = roleOf(id, user.id);
      if (!role) throw new HttpError(404, "not_found");
      const members = q.members.all(id).map((member) => ({
        userId: member.id,
        name: member.name,
        role: member.role,
        ...(role === "owner" ? { email: member.email } : {}),
        isYou: member.id === user.id,
      }));
      return [200, { role, members }];
    }],
    ["POST", /^\/api\/campaigns\/([\w-]{1,80})\/invites$/, async (req, res, body, [id]) => {
      const user = requireUser(req);
      if (roleOf(id, user.id) !== "owner") throw new HttpError(403, "forbidden");
      const role = ROLES.includes(body.role) ? body.role : "viewer";
      // Código curto para ditar na mesa; só o hash fica no banco.
      const code = newToken(9).replace(/[-_]/g, "x").slice(0, 10).toUpperCase();
      const expiresAt = Date.now() + INVITE_DAYS * DAY;
      q.insertInvite.run(sha256(code), id, role, user.id, expiresAt);
      return [201, { code, role, expiresAt }];
    }],
    ["POST", /^\/api\/invites\/accept$/, async (req, res, body) => {
      const user = requireUser(req);
      if (!inviteLimiter(user.id)) throw new HttpError(429, "too_many_attempts");
      const code = text(body.code, 40).trim().toUpperCase();
      const invite = code && q.invite.get(sha256(code), Date.now());
      if (!invite) throw new HttpError(404, "invalid_invite");
      transaction(db, () => {
        q.insertMember.run(invite.campaign_id, user.id, invite.role);
        q.deleteInvite.run(invite.code_hash);
      });
      const campaign = q.myCampaigns.all(user.id).find((row) => row.id === invite.campaign_id);
      return [200, { campaign: serializeCampaign(campaign) }];
    }],
    ["PATCH", /^\/api\/campaigns\/([\w-]{1,80})\/members\/([\w-]{1,80})$/, async (req, res, body, [id, memberId]) => {
      const user = requireUser(req);
      if (roleOf(id, user.id) !== "owner") throw new HttpError(403, "forbidden");
      if (!ROLES.includes(body.role)) throw new HttpError(400, "invalid_role");
      q.setMemberRole.run(body.role, id, memberId);
      return [204];
    }],
    ["DELETE", /^\/api\/campaigns\/([\w-]{1,80})\/members\/([\w-]{1,80})$/, async (req, res, body, [id, memberId]) => {
      const user = requireUser(req);
      const role = roleOf(id, user.id);
      // O dono remove qualquer membro; os demais só podem sair da campanha.
      if (role !== "owner" && !(role && memberId === user.id)) throw new HttpError(403, "forbidden");
      q.removeMember.run(id, memberId);
      return [204];
    }],

    ["PUT", /^\/api\/notes\/([\w-]{1,80})$/, async (req, res, body, [id]) => {
      saveNote(requireUser(req), id, body);
      return [204];
    }],
    ["DELETE", /^\/api\/notes\/([\w-]{1,80})$/, async (req, res, body, [id]) => {
      const user = requireUser(req);
      const note = q.note.get(id);
      if (!note) return [204];
      if (!canWriteNote(user, note)) throw new HttpError(canSeeNote(user, note) ? 403 : 404, "forbidden");
      q.deleteNote.run(id);
      return [204];
    }],

    // Exporta no mesmo formato do backup do navegador, para importar em qualquer lugar.
    ["GET", /^\/api\/export$/, async (req, res) => {
      const user = requireUser(req);
      const { campaigns, notes, personal } = snapshot(user);
      res.setHeader("Content-Disposition", `attachment; filename="band-d-backup-${new Date().toISOString().slice(0, 10)}.json"`);
      return [200, {
        app: "band-d-hub",
        version: 1,
        exportedAt: new Date().toISOString(),
        data: {
          campaigns: campaigns.map(({ id, name, description, background, imageUrl }) => ({ id, name, description, background, imageUrl })),
          notes: notes.map(({ id, title, content, campaignId, updatedAt }) => ({ id, title, content, campaignId, updatedAt })),
          combatants: personal?.combatants || [],
          round: personal?.round || 1,
          currentCombatantId: personal?.currentCombatantId || null,
          activeCampaignId: personal?.activeCampaignId || null,
          customCreatures: personal?.customCreatures || [],
        },
      }];
    }],
    // Importa um backup para a conta: campanhas e anotações são somadas (ids em conflito ganham um novo),
    // e os dados pessoais (iniciativa, criaturas) são substituídos.
    ["POST", /^\/api\/import$/, async (req, res, body) => {
      const user = requireUser(req);
      const data = body?.app === "band-d-hub" ? body.data : null;
      if (!data || typeof data !== "object") throw new HttpError(400, "invalid_backup");
      const campaignIds = new Map();
      let campaignsImported = 0;
      let notesImported = 0;
      transaction(db, () => {
        for (const campaign of Array.isArray(data.campaigns) ? data.campaigns : []) {
          if (!campaign || typeof campaign.name !== "string") continue;
          let id = /^[\w-]{1,80}$/.test(String(campaign.id)) ? String(campaign.id) : randomUUID();
          const existing = q.campaign.get(id);
          if (existing && !isEditorRole(roleOf(id, user.id))) id = randomUUID();
          saveCampaign(user, id, campaign);
          campaignIds.set(String(campaign.id), id);
          campaignsImported += 1;
        }
        for (const note of Array.isArray(data.notes) ? data.notes : []) {
          if (!note || typeof note !== "object") continue;
          let id = /^[\w-]{1,80}$/.test(String(note.id)) ? String(note.id) : randomUUID();
          const existing = q.note.get(id);
          if (existing && !canWriteNote(user, existing)) id = randomUUID();
          const campaignId = campaignIds.get(String(note.campaignId)) || "";
          saveNote(user, id, { ...note, campaignId });
          notesImported += 1;
        }
        const personal = personalInput(data);
        if (personal.activeCampaignId) personal.activeCampaignId = campaignIds.get(personal.activeCampaignId) || null;
        q.savePersonal.run(user.id, JSON.stringify(personal), Date.now());
      });
      return [200, { campaigns: campaignsImported, notes: notesImported }];
    }],
  ];

  async function readJson(req) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BODY) throw new HttpError(413, "payload_too_large");
      chunks.push(chunk);
    }
    if (!size) return {};
    try {
      const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      throw new HttpError(400, "invalid_json");
    }
  }

  function send(res, status, body) {
    res.statusCode = status;
    res.setHeader("Cache-Control", "no-store");
    if (body === undefined) return res.end();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(body));
  }

  async function handleApi(req, res, pathname) {
    if (req.method !== "GET") {
      // Proteção contra CSRF: exige o cabeçalho próprio (que força preflight em outra origem) e a mesma origem.
      const origin = req.headers.origin;
      if (req.headers["x-bandd"] !== "1" || (origin && new URL(origin).host !== req.headers.host)) {
        throw new HttpError(403, "csrf");
      }
    }
    for (const [method, pattern, handler] of routes) {
      const match = pathname.match(pattern);
      if (!match) continue;
      if (method !== req.method) continue;
      const body = req.method === "GET" || req.method === "DELETE" ? {} : await readJson(req);
      const [status, payload] = await handler(req, res, body, match.slice(1));
      return send(res, status, payload);
    }
    throw new HttpError(404, "not_found");
  }

  // Só serve o index.html e a pasta assets: nada de banco, .env ou código do servidor.
  async function serveStatic(req, res, pathname) {
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { error: "method_not_allowed" });
    const relative = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
    const file = normalize(join(staticRoot, relative));
    const allowed = file === join(staticRoot, "index.html") || file.startsWith(join(staticRoot, "assets") + sep);
    if (!allowed) return send(res, 404, { error: "not_found" });
    try {
      const content = await readFile(file);
      res.statusCode = 200;
      res.setHeader("Content-Type", MIME[extname(file).toLowerCase()] || "application/octet-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.end(req.method === "HEAD" ? undefined : content);
    } catch {
      send(res, 404, { error: "not_found" });
    }
  }

  const server = createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "same-origin");
    let pathname;
    try {
      pathname = new URL(req.url, "http://localhost").pathname;
      if (pathname.startsWith("/api/")) await handleApi(req, res, pathname);
      else await serveStatic(req, res, pathname);
    } catch (error) {
      if (error instanceof HttpError) return send(res, error.status, { error: error.code });
      console.error(`Erro em ${req.method} ${pathname}:`, error);
      send(res, 500, { error: "server_error" });
    }
  });
  server.on("close", () => {
    clearInterval(cleanupTimer);
    db.close();
  });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || "127.0.0.1";
  const server = createApp(process.env.DB_FILE ? { dbFile: resolve(process.env.DB_FILE) } : {});
  server.listen(port, host, () => console.log(`BanD&D rodando em http://${host}:${port}`));
}
