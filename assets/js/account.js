// Conta do usuário e sincronização com o servidor (server/server.js).
// Sem servidor (arquivo aberto direto ou servidor estático), o site segue só com o armazenamento local.
// As funções daqui usam o estado e as funções de app.js, que já existem quando initAccount() roda.
const SYNC_QUEUE_KEY = "bandd-sync-queue";
const SYNC_OWNER_KEY = "bandd-sync-owner";
const PERSONAL_STORAGE_KEYS = ["cronica-combatants", "cronica-round", "cronica-current-combatant", "cronica-custom-creatures", "cronica-active-campaign"];
const ACCOUNT_DATA_KEYS = ["cronica-campaigns", "cronica-notes", ...PERSONAL_STORAGE_KEYS, SYNC_QUEUE_KEY, SYNC_OWNER_KEY];

const account = {
  available: false,
  user: null,
  // Dono dos dados deste navegador; com a sessão expirada, as alterações continuam na fila para ele.
  ownerId: localStorage.getItem(SYNC_OWNER_KEY),
  online: true,
  // Só depois de initAccount: as gravações feitas ao montar o estado não são alterações do usuário.
  ready: false,
  // Itens a enviar: "campaign:<id>", "note:<id>" ou "personal". O conteúdo é lido do estado na hora do envio.
  queue: new Set(loadSyncQueue()),
  // Impressão digital do que o servidor tem, para saber o que mudou localmente.
  synced: { campaigns: new Map(), notes: new Map() },
  personalVersion: 0,
  applying: false,
  flushing: null,
  flushTimer: null,
  lastRefresh: 0,
  shareCampaignId: null,
  shareRole: null,
  authMode: "login",
};

function loadSyncQueue() {
  try {
    const stored = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || "[]");
    return Array.isArray(stored) ? stored.filter((key) => typeof key === "string") : [];
  } catch {
    return [];
  }
}

function saveSyncQueue() {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify([...account.queue]));
  } catch (error) {
    console.error("Não foi possível salvar a fila de sincronização.", error);
  }
}

async function apiRequest(method, path, body) {
  const response = await fetch(`./api/${path}`, {
    method,
    credentials: "same-origin",
    headers: { "X-BanDD": "1", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.code = data?.error;
    throw error;
  }
  return data;
}

const campaignFingerprint = (campaign) => JSON.stringify([campaign.name, campaign.description || "", campaign.background || "mountains", campaign.imageUrl || ""]);
const noteFingerprint = (note) => JSON.stringify([note.title || "", note.content || "", note.campaignId || ""]);

function campaignRole(campaignId) {
  return state.campaigns.find((campaign) => campaign.id === campaignId)?.role || null;
}

// Chamado por saveStored em app.js depois de cada gravação local.
function syncLocalChange(key) {
  if (!account.ready || !(account.user || account.ownerId) || account.applying) return;
  if (key === "cronica-campaigns") queueDiff("campaign", state.campaigns, account.synced.campaigns, campaignFingerprint);
  else if (key === "cronica-notes") queueDiff("note", state.notes, account.synced.notes, noteFingerprint);
  else if (PERSONAL_STORAGE_KEYS.includes(key)) {
    account.personalVersion += 1;
    account.queue.add("personal");
  } else return;
  saveSyncQueue();
  scheduleFlush();
  updateAccountUi();
}

function queueDiff(type, list, synced, fingerprint) {
  const current = new Map(list.map((item) => [item.id, fingerprint(item)]));
  current.forEach((value, id) => {
    if (synced.get(id) !== value) account.queue.add(`${type}:${id}`);
  });
  synced.forEach((value, id) => {
    if (!current.has(id)) account.queue.add(`${type}:${id}`);
  });
}

function scheduleFlush(delay = 800) {
  window.clearTimeout(account.flushTimer);
  account.flushTimer = window.setTimeout(() => flushQueue(), delay);
}

function personalPayload() {
  return {
    combatants: state.combatants,
    round: state.round,
    currentCombatantId: state.currentCombatantId,
    customCreatures: state.customCreatures,
    activeCampaignId: state.activeCampaignId,
  };
}

// Envia um item e diz se ele pode sair da fila (não sai se mudou de novo durante o envio).
async function pushItem(key) {
  if (key === "personal") {
    const version = account.personalVersion;
    await apiRequest("PUT", "personal", personalPayload());
    return version === account.personalVersion;
  }
  const separator = key.indexOf(":");
  const type = key.slice(0, separator);
  const id = key.slice(separator + 1);
  const isCampaign = type === "campaign";
  const list = isCampaign ? state.campaigns : state.notes;
  const synced = isCampaign ? account.synced.campaigns : account.synced.notes;
  const fingerprint = isCampaign ? campaignFingerprint : noteFingerprint;
  const item = list.find((entry) => entry.id === id);
  const path = `${isCampaign ? "campaigns" : "notes"}/${encodeURIComponent(id)}`;
  if (!item) {
    await apiRequest("DELETE", path);
    synced.delete(id);
    return !list.some((entry) => entry.id === id);
  }
  const sent = fingerprint(item);
  await apiRequest("PUT", path, isCampaign
    ? { name: item.name, description: item.description || "", background: item.background, imageUrl: item.imageUrl || "" }
    : { title: item.title || "", content: item.content || "", campaignId: item.campaignId || "", updatedAt: item.updatedAt });
  synced.set(id, sent);
  const now = list.find((entry) => entry.id === id);
  return Boolean(now) && fingerprint(now) === sent;
}

// Campanhas novas sobem antes das anotações que apontam para elas; exclusões e dados pessoais vão por último.
function queueOrder(key) {
  if (key === "personal") return 3;
  if (key.startsWith("note:")) return 1;
  return state.campaigns.some((campaign) => `campaign:${campaign.id}` === key) ? 0 : 2;
}

function flushQueue() {
  if (account.flushing) return account.flushing;
  account.flushing = (async () => {
    let needsPull = false;
    try {
      while (account.user && account.queue.size) {
        const key = [...account.queue].sort((a, b) => queueOrder(a) - queueOrder(b))[0];
        try {
          if (await pushItem(key)) account.queue.delete(key);
        } catch (error) {
          if (error.status === 401) {
            handleSessionLost();
            break;
          }
          if (error.status === 409) {
            account.queue.delete(key);
            remapConflictingId(key);
          } else if (error.status >= 400 && error.status < 500) {
            account.queue.delete(key);
            needsPull = true;
          } else throw error;
        }
        saveSyncQueue();
      }
      account.online = true;
    } catch (error) {
      console.error("Falha ao sincronizar; nova tentativa em instantes.", error);
      account.online = false;
      scheduleFlush(30000);
    }
    saveSyncQueue();
    updateAccountUi();
    if (needsPull && account.user) {
      showToast(t("Você não tem permissão para essa alteração; a versão do servidor foi restaurada."));
      await pullFromServer().catch((error) => console.error("Falha ao atualizar do servidor.", error));
    }
  })().finally(() => {
    account.flushing = null;
  });
  return account.flushing;
}

// O id já pertence a outra conta (ex.: a campanha de exemplo ou um backup alheio): troca por um novo.
function remapConflictingId(key) {
  const separator = key.indexOf(":");
  const type = key.slice(0, separator);
  const id = key.slice(separator + 1);
  const newId = crypto.randomUUID();
  if (type === "campaign") {
    const campaign = state.campaigns.find((item) => item.id === id);
    if (!campaign) return;
    campaign.id = newId;
    state.notes.forEach((note) => {
      if (note.campaignId === id) note.campaignId = newId;
    });
    saveStored("cronica-campaigns", state.campaigns);
    saveStored("cronica-notes", state.notes);
    if (state.activeCampaignId === id) setActiveCampaign(campaign);
    renderCampaigns();
  } else if (type === "note") {
    const note = state.notes.find((item) => item.id === id);
    if (!note) return;
    note.id = newId;
    if (state.activeNoteId === id) state.activeNoteId = newId;
    saveStored("cronica-notes", state.notes);
  }
}

// Junta a lista do servidor com o que ainda está na fila local (o local pendente prevalece).
function mergeWithPending(type, serverList, localList, keepIds = new Set()) {
  const local = new Map(localList.map((item) => [item.id, item]));
  const pending = (id) => account.queue.has(`${type}:${id}`) || keepIds.has(id);
  const serverIds = new Set(serverList.map((item) => item.id));
  const meta = ({ role, ownerName, memberCount, authorName }) => ({ role, ownerName, memberCount, authorName });
  return serverList
    .map((item) => (pending(item.id) ? (local.has(item.id) ? { ...local.get(item.id), ...meta(item) } : null) : item))
    .filter(Boolean)
    .concat(localList.filter((item) => pending(item.id) && !serverIds.has(item.id)));
}

function applySnapshot(data, { includePersonal = false } = {}) {
  account.applying = true;
  try {
    account.synced.campaigns = new Map(data.campaigns.map((campaign) => [campaign.id, campaignFingerprint(campaign)]));
    account.synced.notes = new Map(data.notes.map((note) => [note.id, noteFingerprint(note)]));
    state.campaigns = mergeWithPending("campaign", data.campaigns, state.campaigns);
    const editing = state.notesDirty && state.activeNoteId ? new Set([state.activeNoteId]) : new Set();
    state.notes = mergeWithPending("note", data.notes, state.notes, editing);
    if (state.activeNoteId && !state.notes.some((note) => note.id === state.activeNoteId)) state.activeNoteId = null;
    saveStored("cronica-campaigns", state.campaigns);
    saveStored("cronica-notes", state.notes);

    const personal = data.personal;
    if (includePersonal && personal && !account.queue.has("personal")) {
      state.combatants = Array.isArray(personal.combatants) ? personal.combatants : [];
      state.round = Math.max(1, Number(personal.round) || 1);
      state.currentCombatantId = personal.currentCombatantId || null;
      state.customCreatures = (Array.isArray(personal.customCreatures) ? personal.customCreatures : [])
        .filter((creature) => creature && typeof creature.name === "string")
        .map((creature) => ({ ...creature, provider: "custom" }));
      persistCombatants();
      saveStored("cronica-custom-creatures", state.customCreatures);
      if (personal.activeCampaignId) setActiveCampaign(state.campaigns.find((campaign) => campaign.id === personal.activeCampaignId) || null);
      renderInitiative();
    }
  } finally {
    account.applying = false;
  }
  renderCampaigns();
  if (!state.notesDirty) renderNotes();
  updateAccountUi();
}

async function pullFromServer({ includePersonal = false } = {}) {
  applySnapshot(await apiRequest("GET", "sync"), { includePersonal });
  account.lastRefresh = Date.now();
}

function hasLocalPersonalData() {
  return state.combatants.length > 0 || state.customCreatures.length > 0;
}

async function onSignedIn(user) {
  const owner = localStorage.getItem(SYNC_OWNER_KEY);
  account.user = user;
  if (owner && owner !== user.id) {
    // Os dados locais são de outra conta: descarta o que estava pendente dela.
    account.queue.clear();
  }
  const data = await apiRequest("GET", "sync");
  if (!owner) {
    // Dados criados sem conta neste navegador: envia o que a conta ainda não tem.
    const campaignIds = new Set(data.campaigns.map((campaign) => campaign.id));
    const noteIds = new Set(data.notes.map((note) => note.id));
    state.campaigns.forEach((campaign) => {
      if (!campaignIds.has(campaign.id)) account.queue.add(`campaign:${campaign.id}`);
    });
    state.notes.forEach((note) => {
      if (!noteIds.has(note.id)) account.queue.add(`note:${note.id}`);
    });
    if (!data.personal && hasLocalPersonalData()) account.queue.add("personal");
  }
  localStorage.setItem(SYNC_OWNER_KEY, user.id);
  account.ownerId = user.id;
  saveSyncQueue();
  applySnapshot(data, { includePersonal: true });
  account.lastRefresh = Date.now();
  await flushQueue();
}

// Sessão expirada: volta para a tela de login. A fila local fica guardada e é enviada ao entrar de novo.
function handleSessionLost() {
  account.user = null;
  document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
  showAuthGate("login", t("Sua sessão expirou. Entre de novo para continuar."));
}

async function refreshFromServer() {
  if (!account.user || document.hidden || Date.now() - account.lastRefresh < 10000) return;
  account.lastRefresh = Date.now();
  try {
    await flushQueue();
    if (account.user) await pullFromServer();
    account.online = true;
  } catch (error) {
    if (error.status === 401) handleSessionLost();
    else account.online = false;
  }
  updateAccountUi();
}

async function logout() {
  await flushQueue();
  if (account.queue.size && !window.confirm(t("Algumas alterações ainda não chegaram ao servidor e serão perdidas. Sair mesmo assim?"))) return;
  try {
    await apiRequest("POST", "auth/logout");
  } catch (error) {
    console.error("Falha ao encerrar a sessão no servidor.", error);
  }
  // Os dados continuam na conta; este navegador volta vazio para não expô-los a quem usar depois.
  try {
    ACCOUNT_DATA_KEYS.forEach((key) => localStorage.removeItem(key));
    localStorage.setItem("cronica-campaigns", "[]");
    localStorage.setItem("cronica-campaigns-migrated", "true");
  } catch (error) {
    console.error("Não foi possível limpar os dados locais.", error);
  }
  window.location.reload();
}

// Importa um backup já validado direto na conta.
async function importBackupToAccount(data) {
  await flushQueue();
  const result = await apiRequest("POST", "import", { app: "band-d-hub", version: 1, data });
  account.queue.delete("personal");
  saveSyncQueue();
  return result;
}

const AUTH_ERRORS = {
  invalid_credentials: "E-mail ou senha incorretos.",
  email_taken: "Já existe uma conta com este e-mail.",
  weak_password: "A senha precisa ter pelo menos 8 caracteres.",
  invalid_email: "Informe um e-mail válido.",
  name_required: "Informe seu nome.",
  too_many_attempts: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
  invalid_invite: "Código inválido ou expirado.",
};

function errorMessage(error) {
  return t(AUTH_ERRORS[error?.code] || "Não foi possível falar com o servidor. Tente de novo.");
}

// ---- Interface ----
function updateAccountUi() {
  const user = account.user;
  const button = document.querySelector("#account-button");
  button.hidden = !user;
  document.querySelector("#account-button-label").textContent = user ? user.name.split(/\s+/)[0] : "";
  const dot = document.querySelector("#sync-dot");
  const pending = Boolean(user) && (account.queue.size > 0 || !account.online);
  dot.hidden = !pending;
  dot.classList.toggle("is-offline", !account.online);
  const status = !account.online
    ? t("Sem conexão com o servidor. As alterações ficam guardadas e serão enviadas depois.")
    : account.queue.size
      ? t("Enviando {count} alteração(ões)...", { count: account.queue.size })
      : t("Tudo sincronizado com a sua conta.");
  button.title = status;
  document.querySelector("#join-campaign").hidden = !user;
  document.querySelector("#backup-account-note").hidden = !user;
  if (user) {
    document.querySelector("#account-user-name").textContent = user.name;
    document.querySelector("#account-user-email").textContent = user.email;
    const syncStatus = document.querySelector("#account-sync-status");
    syncStatus.textContent = status;
    syncStatus.classList.toggle("is-pending", pending);
  }
}

function setAuthMode(mode) {
  account.authMode = mode;
  const register = mode === "register";
  document.querySelectorAll("[data-account-tab]").forEach((tab) => {
    const active = tab.dataset.accountTab === mode;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  document.querySelector("#account-dialog-title").textContent = register ? t("Criar conta") : t("Entrar");
  document.querySelector("#account-name-field").hidden = !register;
  document.querySelector("#account-password-hint").hidden = !register;
  document.querySelector("#account-password").autocomplete = register ? "new-password" : "current-password";
  document.querySelector("#account-submit").textContent = register ? t("Criar conta") : t("Entrar");
  document.querySelector("#account-error").textContent = "";
}

// Estados da tela de entrada: "pending" (conferindo a sessão), "login", "offline" (sem servidor) e "ok" (site liberado).
function showAuthGate(mode, notice = "") {
  document.documentElement.dataset.auth = mode === "ok" ? "ok" : "locked";
  document.querySelector("#auth-loading").hidden = mode !== "pending";
  document.querySelector("#auth-offline").hidden = mode !== "offline";
  document.querySelector("#account-guest").hidden = mode !== "login";
  const noticeElement = document.querySelector("#auth-notice");
  noticeElement.textContent = notice;
  noticeElement.hidden = !notice;
  if (mode === "login") document.querySelector(account.authMode === "register" ? "#account-name" : "#account-email").focus();
}

// Libera o site depois do login. Se os dados não carregarem, o site abre com os locais e tenta de novo depois.
async function enterApp(user) {
  try {
    await onSignedIn(user);
  } catch (error) {
    console.error("Falha ao carregar os dados da conta.", error);
    account.user = user;
    account.online = false;
    scheduleFlush(30000);
  }
  updateAccountUi();
  showAuthGate("ok");
}

function openAccountDialog({ focusJoin = false } = {}) {
  updateAccountUi();
  document.querySelector("#account-dialog").showModal();
  if (focusJoin) document.querySelector("#join-code").focus();
}

async function submitAccountForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = document.querySelector("#account-submit");
  const error = document.querySelector("#account-error");
  const register = account.authMode === "register";
  const body = {
    email: form.email.value.trim(),
    password: form.password.value,
    ...(register ? { name: form.name.value.trim() } : {}),
  };
  if (register && body.password.length < 8) {
    error.textContent = t(AUTH_ERRORS.weak_password);
    return;
  }
  submit.disabled = true;
  error.textContent = "";
  try {
    const { user } = await apiRequest("POST", register ? "auth/register" : "auth/login", body);
    form.reset();
    await enterApp(user);
    showToast(register ? t("Conta criada. Bem-vindo(a), {name}!", { name: user.name }) : t("Bem-vindo(a) de volta, {name}!", { name: user.name }));
  } catch (requestError) {
    console.error("Falha ao entrar.", requestError);
    error.textContent = errorMessage(requestError);
  } finally {
    submit.disabled = false;
  }
}

async function joinCampaign(event) {
  event.preventDefault();
  const input = document.querySelector("#join-code");
  const code = input.value.trim();
  if (!code) return;
  try {
    const { campaign } = await apiRequest("POST", "invites/accept", { code });
    input.value = "";
    document.querySelector("#account-dialog").close();
    await pullFromServer();
    navigate("campaigns");
    showToast(t("Você entrou em “{name}”.", { name: campaign.name }));
  } catch (error) {
    showToast(errorMessage(error));
  }
}

// Selo do cartão de campanha: quem compartilhou ou quantos membros tem.
function campaignShareBadge(campaign) {
  if (!account.user || !campaign.role) return "";
  if (campaign.role !== "owner") {
    const access = campaign.role === "editor" ? t("pode editar") : t("só leitura");
    return `<span class="share-badge">${icon("users")} ${escapeHtml(t("De {name} · {access}", { name: campaign.ownerName, access }))}</span>`;
  }
  return campaign.memberCount > 1 ? `<span class="share-badge">${icon("users")} ${escapeHtml(t("{count} membros", { count: campaign.memberCount }))}</span>` : "";
}

const ROLE_LABELS = { owner: "Mestre (dono)", editor: "Pode editar", viewer: "Pode ver" };

async function openShareDialog(campaign) {
  account.shareCampaignId = campaign.id;
  document.querySelector("#share-dialog-title").textContent = campaign.name;
  document.querySelector("#share-dialog-subtitle").textContent = t("Carregando membros...");
  document.querySelector("#member-list").innerHTML = "";
  document.querySelector("#invite-box").hidden = true;
  document.querySelector("#invite-code").hidden = true;
  document.querySelector("#leave-campaign").hidden = true;
  document.querySelector("#share-dialog").showModal();
  await flushQueue();
  await renderShareDialog();
}

async function renderShareDialog() {
  const id = account.shareCampaignId;
  const subtitle = document.querySelector("#share-dialog-subtitle");
  try {
    const { role, members } = await apiRequest("GET", `campaigns/${encodeURIComponent(id)}/members`);
    account.shareRole = role;
    const isOwner = role === "owner";
    subtitle.textContent = isOwner
      ? t("Quem entrar vê a campanha e as anotações ligadas a ela.")
      : t("Seu acesso: {role}.", { role: t(ROLE_LABELS[role]).toLowerCase() });
    document.querySelector("#member-list").innerHTML = members.map((member) => {
      const name = `${escapeHtml(member.name)}${member.isYou ? ` <small>(${t("você")})</small>` : ""}`;
      const email = member.email ? `<span class="member-email">${escapeHtml(member.email)}</span>` : "";
      const controls = isOwner && member.role !== "owner"
        ? `<select data-member-role="${escapeHtml(member.userId)}" aria-label="${escapeHtml(t("Permissão de {name}", { name: member.name }))}">
            ${["viewer", "editor"].map((value) => `<option value="${value}"${value === member.role ? " selected" : ""}>${t(ROLE_LABELS[value])}</option>`).join("")}
          </select><button class="icon-button" type="button" data-remove-member="${escapeHtml(member.userId)}" aria-label="${escapeHtml(t("Remover {name}", { name: member.name }))}">${icon("x")}</button>`
        : `<span class="member-role">${t(ROLE_LABELS[member.role])}</span>`;
      return `<li><span class="member-avatar" aria-hidden="true">${escapeHtml(member.name.slice(0, 1).toUpperCase())}</span><span class="member-name">${name}${email}</span>${controls}</li>`;
    }).join("");
    document.querySelector("#invite-box").hidden = !isOwner;
    document.querySelector("#leave-campaign").hidden = isOwner;
  } catch (error) {
    subtitle.textContent = error.status === 404
      ? t("Esta campanha ainda não chegou ao servidor. Tente de novo em instantes.")
      : errorMessage(error);
  }
}

async function createInvite() {
  try {
    const { code } = await apiRequest("POST", `campaigns/${encodeURIComponent(account.shareCampaignId)}/invites`, {
      role: document.querySelector("#invite-role").value,
    });
    document.querySelector("#invite-code-value").textContent = code;
    document.querySelector("#invite-code").hidden = false;
  } catch (error) {
    showToast(errorMessage(error));
  }
}

async function leaveSharedCampaign() {
  const campaign = state.campaigns.find((item) => item.id === account.shareCampaignId);
  if (!campaign || !window.confirm(t("Sair da campanha “{name}”? Você precisará de um novo convite para voltar.", { name: campaign.name }))) return;
  try {
    await apiRequest("DELETE", `campaigns/${encodeURIComponent(campaign.id)}/members/${encodeURIComponent(account.user.id)}`);
    document.querySelector("#share-dialog").close();
    await pullFromServer();
    showToast(t("Você saiu de “{name}”.", { name: campaign.name }));
  } catch (error) {
    showToast(errorMessage(error));
  }
}

function bindAccountEvents() {
  document.querySelector("#account-button").addEventListener("click", () => openAccountDialog());
  document.querySelector("#auth-retry").addEventListener("click", checkSession);
  document.querySelector("#join-campaign").addEventListener("click", () => openAccountDialog({ focusJoin: true }));
  document.querySelectorAll("[data-account-tab]").forEach((tab) => tab.addEventListener("click", () => setAuthMode(tab.dataset.accountTab)));
  document.querySelector("#account-form").addEventListener("submit", submitAccountForm);
  document.querySelector("#join-form").addEventListener("submit", joinCampaign);
  document.querySelector("#logout-button").addEventListener("click", logout);
  document.querySelector("#account-export").addEventListener("click", () => {
    const link = document.createElement("a");
    link.href = "./api/export";
    link.download = "";
    link.click();
  });
  document.querySelector("#create-invite").addEventListener("click", createInvite);
  document.querySelector("#copy-invite").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(document.querySelector("#invite-code-value").textContent);
      showToast(t("Código copiado."));
    } catch {
      showToast(t("Não foi possível copiar; selecione o código e copie manualmente."));
    }
  });
  document.querySelector("#leave-campaign").addEventListener("click", leaveSharedCampaign);
  document.querySelector("#member-list").addEventListener("change", async (event) => {
    const select = event.target.closest("[data-member-role]");
    if (!select) return;
    try {
      await apiRequest("PATCH", `campaigns/${encodeURIComponent(account.shareCampaignId)}/members/${encodeURIComponent(select.dataset.memberRole)}`, { role: select.value });
      showToast(t("Permissão atualizada."));
    } catch (error) {
      showToast(errorMessage(error));
      await renderShareDialog();
    }
  });
  document.querySelector("#member-list").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-remove-member]");
    if (!button) return;
    try {
      await apiRequest("DELETE", `campaigns/${encodeURIComponent(account.shareCampaignId)}/members/${encodeURIComponent(button.dataset.removeMember)}`);
      await renderShareDialog();
      await pullFromServer();
    } catch (error) {
      showToast(errorMessage(error));
    }
  });
  ["#account-dialog", "#share-dialog"].forEach((selector) => {
    const dialog = document.querySelector(selector);
    dialog.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) dialog.close();
    });
  });
  document.querySelector("#account-dialog-close").addEventListener("click", () => document.querySelector("#account-dialog").close());
  ["#share-dialog-close", "#share-done"].forEach((selector) => {
    document.querySelector(selector).addEventListener("click", () => document.querySelector("#share-dialog").close());
  });
}

// Confere a sessão. Sem login válido, o site fica travado na tela de entrada.
async function checkSession() {
  showAuthGate("pending");
  let user;
  try {
    const response = await fetch("./api/auth/me", { credentials: "same-origin" });
    if (!response.ok || !(response.headers.get("content-type") || "").includes("application/json")) throw new Error(`HTTP ${response.status}`);
    ({ user } = await response.json());
  } catch (error) {
    console.error("Servidor indisponível.", error);
    showAuthGate("offline");
    return;
  }
  account.available = true;
  if (user) await enterApp(user);
  else showAuthGate("login");
}

async function initAccount() {
  account.ready = true;
  bindAccountEvents();
  await checkSession();
  window.addEventListener("focus", refreshFromServer);
  window.addEventListener("online", () => flushQueue());
  window.setInterval(refreshFromServer, 60000);
}
