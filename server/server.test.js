import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./server.js";

let server;
let base;
let dir;

before(async () => {
  dir = mkdtempSync(join(tmpdir(), "bandd-test-"));
  server = createApp({ dbFile: join(dir, "test.db"), limits: { register: 100 } });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((done) => server.close(done));
  rmSync(dir, { recursive: true, force: true });
});

// Cliente mínimo que guarda o cookie de sessão, como um navegador.
function client() {
  let cookie = "";
  return async (method, path, body, headers = {}) => {
    const response = await fetch(base + path, {
      method,
      headers: { "X-BanDD": "1", "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null, headers: response.headers };
  };
}

async function signUp(email, name = "Mestre") {
  const api = client();
  const res = await api("POST", "/api/auth/register", { name, email, password: "segredo-forte-1" });
  assert.equal(res.status, 201);
  return api;
}

test("cadastro guarda só o hash scrypt da senha e o login funciona", async () => {
  const api = await signUp("ana@example.com", "Ana");
  const me = await api("GET", "/api/auth/me");
  assert.equal(me.body.user.email, "ana@example.com");

  const db = new DatabaseSync(join(dir, "test.db"));
  const row = db.prepare("SELECT password_hash FROM users WHERE email = ?").get("ana@example.com");
  db.close();
  assert.match(row.password_hash, /^scrypt\$16384\$8\$1\$[\w-]+\$[\w-]+$/);
  assert.ok(!row.password_hash.includes("segredo-forte-1"));

  const other = client();
  assert.equal((await other("POST", "/api/auth/login", { email: "ANA@example.com", password: "errada123" })).status, 401);
  const ok = await other("POST", "/api/auth/login", { email: "ANA@example.com", password: "segredo-forte-1" });
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get("set-cookie"), /HttpOnly; SameSite=Lax/);

  assert.equal((await other("POST", "/api/auth/logout")).status, 204);
  assert.equal((await other("GET", "/api/auth/me")).body.user, null);
  assert.equal((await other("GET", "/api/sync")).status, 401);
});

test("cadastro rejeita e-mail repetido e senha curta", async () => {
  await signUp("bia@example.com");
  const api = client();
  assert.equal((await api("POST", "/api/auth/register", { name: "B", email: "bia@example.com", password: "12345678" })).status, 409);
  assert.equal((await api("POST", "/api/auth/register", { name: "B", email: "b2@example.com", password: "123" })).status, 400);
});

test("login bloqueia depois de muitas tentativas", async () => {
  const api = client();
  const statuses = [];
  for (let i = 0; i < 11; i += 1) statuses.push((await api("POST", "/api/auth/login", { email: "ninguem@example.com", password: "x" })).status);
  assert.deepEqual([statuses[0], statuses.at(-1)], [401, 429]);
});

test("rotas que alteram dados exigem o cabeçalho anti-CSRF", async () => {
  const api = await signUp("csrf@example.com");
  const res = await api("PUT", "/api/campaigns/c-csrf", { name: "X" }, { "X-BanDD": "0" });
  assert.equal(res.status, 403);
});

test("campanha compartilhada por convite respeita os papéis", async () => {
  const owner = await signUp("dono@example.com", "Dono");
  const guest = await signUp("convidado@example.com", "Convidado");
  const stranger = await signUp("estranho@example.com", "Estranho");

  assert.equal((await owner("PUT", "/api/campaigns/camp-1", { name: "Eldoria", background: "forest" })).status, 204);
  assert.equal((await owner("PUT", "/api/notes/n-1", { title: "Pista", content: "O cálice", campaignId: "camp-1" })).status, 204);
  assert.equal((await owner("PUT", "/api/notes/n-private", { title: "Segredo", content: "", campaignId: "" })).status, 204);

  // Quem não é membro não vê nem altera, e o id ocupado vira 409.
  assert.equal((await stranger("PUT", "/api/campaigns/camp-1", { name: "Roubada" })).status, 409);
  assert.equal((await stranger("GET", "/api/campaigns/camp-1/members")).status, 404);

  const invite = await owner("POST", "/api/campaigns/camp-1/invites", { role: "viewer" });
  assert.equal(invite.status, 201);
  const joined = await guest("POST", "/api/invites/accept", { code: invite.body.code.toLowerCase() });
  assert.equal(joined.status, 200);
  assert.equal(joined.body.campaign.role, "viewer");
  // Convite é de uso único.
  assert.equal((await stranger("POST", "/api/invites/accept", { code: invite.body.code })).status, 404);

  const sync = await guest("GET", "/api/sync");
  assert.deepEqual(sync.body.campaigns.map((c) => [c.id, c.role, c.ownerName]), [["camp-1", "viewer", "Dono"]]);
  assert.deepEqual(sync.body.notes.map((n) => n.id), ["n-1"]);

  // Leitor não edita; depois de promovido a editor, edita mas não exclui a campanha.
  assert.equal((await guest("PUT", "/api/notes/n-1", { title: "Mudei", campaignId: "camp-1" })).status, 403);
  const guestId = sync.body.user.id;
  assert.equal((await owner("PATCH", `/api/campaigns/camp-1/members/${guestId}`, { role: "editor" })).status, 204);
  assert.equal((await guest("PUT", "/api/notes/n-1", { title: "Mudei", content: "x", campaignId: "camp-1" })).status, 204);
  assert.equal((await guest("PUT", "/api/campaigns/camp-1", { name: "Eldoria 2" })).status, 204);
  assert.equal((await guest("DELETE", "/api/campaigns/camp-1")).status, 403);
  assert.equal((await guest("POST", "/api/campaigns/camp-1/invites", { role: "editor" })).status, 403);

  const members = await owner("GET", "/api/campaigns/camp-1/members");
  assert.deepEqual(members.body.members.map((m) => m.role), ["owner", "editor"]);

  // Sair da campanha remove o acesso às anotações dela.
  assert.equal((await guest("DELETE", `/api/campaigns/camp-1/members/${guestId}`)).status, 204);
  assert.deepEqual((await guest("GET", "/api/sync")).body.notes, []);

  // Excluir a campanha devolve as anotações ao autor, sem campanha.
  assert.equal((await owner("DELETE", "/api/campaigns/camp-1")).status, 204);
  const afterDelete = await owner("GET", "/api/sync");
  assert.deepEqual(afterDelete.body.campaigns, []);
  assert.deepEqual(afterDelete.body.notes.map((n) => [n.id, n.campaignId]).sort(), [["n-1", ""], ["n-private", ""]]);
});

test("dados pessoais, exportação e importação", async () => {
  const api = await signUp("backup@example.com");
  await api("PUT", "/api/personal", { combatants: [{ id: "c1", name: "Goblin", score: 12 }], round: 3, activeCampaignId: "x", extra: "ignorado" });
  await api("PUT", "/api/campaigns/exp-1", { name: "Exportada" });
  const exported = await api("GET", "/api/export");
  assert.equal(exported.body.app, "band-d-hub");
  assert.equal(exported.body.data.round, 3);
  assert.equal(exported.body.data.campaigns[0].name, "Exportada");

  // Outra conta importa o mesmo arquivo: o id já ocupado ganha um novo, e a anotação acompanha.
  exported.body.data.notes = [{ id: "imp-note", title: "Ligada", campaignId: "exp-1" }];
  exported.body.data.activeCampaignId = "exp-1";
  const other = await signUp("backup2@example.com");
  const imported = await other("POST", "/api/import", exported.body);
  assert.deepEqual(imported.body, { campaigns: 1, notes: 1 });
  const sync = await other("GET", "/api/sync");
  const [campaign] = sync.body.campaigns;
  assert.notEqual(campaign.id, "exp-1");
  assert.equal(sync.body.notes[0].campaignId, campaign.id);
  assert.equal(sync.body.personal.activeCampaignId, campaign.id);
  assert.equal(sync.body.personal.combatants[0].name, "Goblin");
});

test("o servidor só expõe o site, não o banco nem arquivos locais", async () => {
  assert.equal((await fetch(`${base}/`)).status, 200);
  assert.equal((await fetch(`${base}/assets/js/app.js`)).status, 200);
  for (const path of ["/github.local.env", "/server/server.js", "/data/bandd.db", "/assets/../package.json", "/%2e%2e/package.json"]) {
    assert.equal((await fetch(base + path)).status, 404, path);
  }
});
