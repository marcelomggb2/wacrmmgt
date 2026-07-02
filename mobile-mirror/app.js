import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const config = window.WACRM_MOBILE_CONFIG || {};
const app = document.querySelector("#app");

const state = {
  supabase: null,
  user: null,
  profile: null,
  account: null,
  conversations: [],
  messages: [],
  deals: [],
  stages: [],
  channels: [],
  selectedConversationId: null,
  tab: "inbox",
  leadFilter: "all",
  search: "",
  loading: true,
  error: "",
  installPrompt: null,
  refreshTimer: null,
};

const tabs = [
  { id: "inbox", label: "Inbox" },
  { id: "leads", label: "Leads" },
  { id: "connect", label: "Conexoes" },
  { id: "settings", label: "Conta" },
];

const leadLanes = [
  { id: "new", label: "Novo lead", hint: "Entrada recente" },
  { id: "talking", label: "Em conversa", hint: "DM ou WhatsApp ativo" },
  { id: "ready", label: "Pronto p/ vendedor", hint: "Alta intencao" },
  { id: "proposal", label: "Proposta", hint: "Valor ou fechamento" },
  { id: "done", label: "Ganho / Perdido", hint: "Resultado" },
];

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  state.installPrompt = event;
  render();
});

window.addEventListener("appinstalled", () => {
  state.installPrompt = null;
  toast("App instalado.");
});

init();

async function init() {
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    renderConfigMissing();
    return;
  }

  state.supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
  }

  const { data } = await state.supabase.auth.getSession();
  state.user = data.session?.user || null;

  state.supabase.auth.onAuthStateChange((_event, session) => {
    state.user = session?.user || null;
    if (state.user) {
      bootstrapData();
    } else {
      clearRealtime();
      state.profile = null;
      state.account = null;
      render();
    }
  });

  if (state.user) {
    await bootstrapData();
  } else {
    state.loading = false;
    render();
  }
}

async function bootstrapData() {
  state.loading = true;
  state.error = "";
  render();

  try {
    await loadProfile();
    await Promise.all([loadConversations(), loadDeals(), loadChannels()]);
    state.selectedConversationId =
      state.selectedConversationId || state.conversations[0]?.id || null;
    if (state.selectedConversationId) {
      await loadMessages(state.selectedConversationId);
    }
    setupRealtime();
  } catch (error) {
    state.error = error.message || "Falha ao carregar dados.";
  } finally {
    state.loading = false;
    render();
  }
}

async function loadProfile() {
  const { data, error } = await state.supabase
    .from("profiles")
    .select(
      "id, user_id, full_name, email, avatar_url, account_id, account_role, account:accounts(id, name, default_currency)"
    )
    .eq("user_id", state.user.id)
    .maybeSingle();

  if (error) throw error;

  const account = Array.isArray(data?.account) ? data.account[0] : data?.account;
  state.profile = data || null;
  state.account = account || null;
}

async function loadConversations() {
  const { data, error } = await state.supabase
    .from("conversations")
    .select(
      "id, contact_id, status, last_message_text, last_message_at, unread_count, channel_provider, external_channel_id, whatsapp_config_id, created_at, updated_at, contact:contacts(id, name, phone, email, company, avatar_url)"
    )
    .order("last_message_at", { ascending: false })
    .limit(80);

  if (error) throw error;
  state.conversations = data || [];
}

async function loadMessages(conversationId) {
  const { data, error } = await state.supabase
    .from("messages")
    .select(
      "id, conversation_id, sender_type, content_type, content_text, media_url, status, created_at"
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(90);

  if (error) throw error;
  state.messages = data || [];
}

async function loadDeals() {
  const [dealsRes, stagesRes] = await Promise.all([
    state.supabase
      .from("deals")
      .select(
        "id, title, value, currency, status, stage_id, contact_id, conversation_id, expected_close_date, created_at, updated_at, contact:contacts(id, name, phone, email, company), stage:pipeline_stages(id, name, color, position, pipeline_id)"
      )
      .order("updated_at", { ascending: false })
      .limit(120),
    state.supabase
      .from("pipeline_stages")
      .select("id, name, color, position, pipeline_id")
      .order("position", { ascending: true }),
  ]);

  if (dealsRes.error) throw dealsRes.error;
  if (stagesRes.error) throw stagesRes.error;

  state.deals = dealsRes.data || [];
  state.stages = stagesRes.data || [];
}

async function loadChannels() {
  const { data, error } = await state.supabase
    .from("external_inbox_channels")
    .select("id, provider, label, status, display_identifier, connected_at, last_error, settings")
    .order("created_at", { ascending: false });

  if (error && !/does not exist/i.test(error.message)) {
    throw error;
  }

  state.channels = data || [];
}

function setupRealtime() {
  clearRealtime();
  state.realtime = state.supabase
    .channel("mobile-mirror")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "conversations" },
      () => scheduleRefresh("conversations")
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "messages" },
      (payload) => {
        if (payload.new?.conversation_id === state.selectedConversationId) {
          scheduleRefresh("messages");
        }
        scheduleRefresh("conversations");
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "deals" },
      () => scheduleRefresh("deals")
    )
    .subscribe();
}

function clearRealtime() {
  if (state.realtime) {
    state.supabase.removeChannel(state.realtime);
    state.realtime = null;
  }
}

function scheduleRefresh(scope) {
  clearTimeout(state.refreshTimer);
  state.refreshTimer = setTimeout(async () => {
    if (!state.user) return;
    try {
      if (scope === "messages") {
        await loadMessages(state.selectedConversationId);
      } else if (scope === "deals") {
        await loadDeals();
      } else {
        await loadConversations();
        if (state.selectedConversationId) {
          await loadMessages(state.selectedConversationId);
        }
      }
      render();
    } catch (error) {
      console.warn("[mobile-mirror] realtime refresh failed", error);
    }
  }, 500);
}

function render() {
  if (!state.supabase) return;

  if (!state.user) {
    renderAuth();
    return;
  }

  if (state.loading) {
    app.innerHTML = `
      <div class="boot-screen">
        <div class="brand-mark">MG</div>
        <p>Sincronizando conversas e leads...</p>
      </div>
    `;
    return;
  }

  app.innerHTML = `
    <div class="app-shell">
      ${renderTopbar()}
      <main class="content">${renderActiveTab()}</main>
      ${renderBottomNav()}
      <div id="toast" class="toast"></div>
    </div>
  `;

  bindEvents();
}

function renderAuth() {
  app.innerHTML = `
    <main class="auth-shell">
      <section class="auth-card">
        <div class="brand-mark">MG</div>
        <h1>Central mobile MG Team</h1>
        <p>Entre com o mesmo login do WACRM. O app le dados via Supabase/RLS e nao altera rotas do CRM principal.</p>
        <form id="loginForm">
          <div class="field">
            <label for="email">Email</label>
            <input id="email" type="email" autocomplete="email" required />
          </div>
          <div class="field">
            <label for="password">Senha</label>
            <input id="password" type="password" autocomplete="current-password" required />
          </div>
          <button class="primary-btn" type="submit" style="width:100%; margin-top:18px;">Entrar</button>
        </form>
        ${state.error ? `<div class="error-box">${escapeHtml(state.error)}</div>` : ""}
      </section>
    </main>
  `;

  document.querySelector("#loginForm").addEventListener("submit", handleLogin);
}

function renderConfigMissing() {
  app.innerHTML = `
    <main class="auth-shell">
      <section class="auth-card">
        <div class="brand-mark">MG</div>
        <h1>Config ausente</h1>
        <p>Este PWA precisa do arquivo <strong>config.js</strong> com a URL publica e a anon key do Supabase.</p>
      </section>
    </main>
  `;
}

function renderTopbar() {
  const accountName = state.account?.name || state.profile?.full_name || state.user.email;
  const unread = state.conversations.reduce((sum, item) => sum + Number(item.unread_count || 0), 0);
  const instagram = state.conversations.filter((item) => providerOf(item) === "instagram").length;
  const hot = buildLeadItems().filter((item) => item.priority === "hot").length;

  return `
    <header class="topbar">
      <div class="topbar-main">
        <div class="brand-row">
          <div class="brand-mark">MG</div>
          <div class="brand-copy">
            <strong>MG Team Mobile</strong>
            <span>${escapeHtml(accountName || "Conta")}</span>
          </div>
        </div>
        <button class="icon-btn" data-action="refresh" title="Atualizar">↻</button>
      </div>
      <div class="top-metrics">
        <div class="metric-pill"><span>Inbox</span><strong>${state.conversations.length}</strong></div>
        <div class="metric-pill"><span>Nao lidas</span><strong>${unread}</strong></div>
        <div class="metric-pill"><span>Insta/Hot</span><strong>${instagram}/${hot}</strong></div>
      </div>
    </header>
  `;
}

function renderActiveTab() {
  if (state.error) {
    return `<div class="error-box">${escapeHtml(state.error)}</div>`;
  }

  if (state.tab === "leads") return renderLeadCenter();
  if (state.tab === "connect") return renderConnections();
  if (state.tab === "settings") return renderSettings();
  return renderInbox();
}

function renderInbox() {
  const conversations = filteredConversations();
  const selected = selectedConversation();

  return `
    <section class="screen-title">
      <div>
        <h1>Inbox</h1>
        <p>Conversas de WhatsApp, Instagram e canais externos.</p>
      </div>
      <span class="status-dot">Ao vivo</span>
    </section>

    <section class="inbox-layout">
      <aside class="panel conversation-list">
        <div class="search-box">
          <input id="searchInput" value="${escapeAttribute(state.search)}" placeholder="Buscar contato, telefone ou mensagem" />
        </div>
        <div class="conversation-items">
          ${
            conversations.length
              ? conversations.map(renderConversationRow).join("")
              : `<div class="empty-state">Nenhuma conversa encontrada.</div>`
          }
        </div>
      </aside>
      ${selected ? renderChat(selected) : `<section class="panel empty-state">Selecione uma conversa.</section>`}
    </section>
  `;
}

function renderConversationRow(item) {
  const contact = item.contact || {};
  const provider = providerOf(item);
  const active = item.id === state.selectedConversationId ? " is-active" : "";

  return `
    <button class="conversation-row${active}" data-action="select-conversation" data-id="${item.id}">
      <div class="avatar">${initials(contact.name || contact.phone || "?")}</div>
      <div class="conversation-main">
        <div class="conversation-title">
          <strong>${escapeHtml(contact.name || contact.phone || "Sem nome")}</strong>
          <span class="badge ${provider}">${labelProvider(provider)}</span>
        </div>
        <span class="last-message">${escapeHtml(item.last_message_text || "Sem mensagens ainda")}</span>
      </div>
      <div class="row-meta">
        <time>${formatRelative(item.last_message_at || item.updated_at)}</time>
        ${Number(item.unread_count || 0) > 0 ? `<span class="unread">${item.unread_count}</span>` : ""}
      </div>
    </button>
  `;
}

function renderChat(conversation) {
  const contact = conversation.contact || {};
  const provider = providerOf(conversation);

  return `
    <section class="panel chat-panel">
      <div class="chat-head">
        <div class="chat-user">
          <div class="avatar">${initials(contact.name || contact.phone || "?")}</div>
          <div>
            <strong>${escapeHtml(contact.name || contact.phone || "Contato")}</strong>
            <span>${escapeHtml(contact.phone || contact.email || labelProvider(provider))}</span>
          </div>
        </div>
        <span class="badge ${provider}">${labelProvider(provider)}</span>
      </div>
      <div class="messages" id="messages">
        ${
          state.messages.length
            ? state.messages.map(renderBubble).join("")
            : `<div class="empty-state">Historico vazio.</div>`
        }
      </div>
      <div class="reply-box">
        <textarea id="replyDraft" placeholder="Escreva um rascunho para copiar ou abrir no CRM"></textarea>
        <div class="reply-actions">
          <span class="reply-note">Envio real fica no backend do CRM para proteger tokens Meta/UAZAPI.</span>
          <button class="primary-btn" data-action="open-crm">Abrir CRM</button>
        </div>
      </div>
    </section>
  `;
}

function renderBubble(message) {
  const sender = message.sender_type || "customer";
  const text =
    message.content_text ||
    (message.media_url ? `[${message.content_type || "midia"}] ${message.media_url}` : "");

  return `
    <div class="bubble ${sender}">
      <p>${escapeHtml(text || "Mensagem sem texto")}</p>
      <time>${formatTime(message.created_at)}</time>
    </div>
  `;
}

function renderLeadCenter() {
  const items = buildLeadItems().filter((item) => {
    if (state.leadFilter === "all") return true;
    if (state.leadFilter === "instagram") return item.provider === "instagram";
    if (state.leadFilter === "whatsapp") return item.provider === "whatsapp_official";
    if (state.leadFilter === "hot") return item.priority === "hot";
    return true;
  });

  const totalValue = items.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const lanes = leadLanes.map((lane) => ({
    ...lane,
    items: items.filter((item) => item.lane === lane.id),
  }));

  return `
    <section class="screen-title">
      <div>
        <h1>Central de Leads</h1>
        <p>Organizacao inspirada no Meta Business: fonte, prioridade, SLA e contexto.</p>
      </div>
    </section>

    <section class="lead-center">
      <div class="insights-row">
        <div class="panel insight-card"><span>Leads ativos</span><strong>${items.length}</strong></div>
        <div class="panel insight-card"><span>Valor em aberto</span><strong>${formatMoney(totalValue)}</strong></div>
      </div>
      <div class="filter-row">
        ${renderFilter("all", "Todos")}
        ${renderFilter("instagram", "Instagram")}
        ${renderFilter("whatsapp", "WhatsApp")}
        ${renderFilter("hot", "Alta intencao")}
      </div>
      <div class="lead-board">
        ${lanes.map(renderLeadLane).join("")}
      </div>
    </section>
  `;
}

function renderFilter(id, label) {
  return `<button class="chip ${state.leadFilter === id ? "active" : ""}" data-action="lead-filter" data-id="${id}">${label}</button>`;
}

function renderLeadLane(lane) {
  const laneValue = lane.items.reduce((sum, item) => sum + Number(item.value || 0), 0);
  return `
    <section class="panel lead-lane">
      <div class="lane-head">
        <div>
          <strong>${lane.label}</strong>
          <span>${lane.hint}</span>
        </div>
        <span>${lane.items.length} • ${formatMoney(laneValue)}</span>
      </div>
      <div class="lead-stack">
        ${
          lane.items.length
            ? lane.items.map(renderLeadCard).join("")
            : `<div class="empty-state">Sem leads nesta etapa.</div>`
        }
      </div>
    </section>
  `;
}

function renderLeadCard(item) {
  return `
    <article class="lead-card">
      <div class="lead-card-top">
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <small>${escapeHtml(item.subtitle)}</small>
        </div>
        <span class="badge ${item.providerClass}">${item.source}</span>
      </div>
      <p>${escapeHtml(item.preview || "Sem ultima mensagem.")}</p>
      <div class="lead-tags">
        ${item.priority === "hot" ? `<span class="badge hot">Alta intencao</span>` : ""}
        ${item.tags.map((tag) => `<span class="badge">${escapeHtml(tag)}</span>`).join("")}
      </div>
      <button class="ghost-btn" data-action="select-lead" data-id="${item.conversationId || ""}">Abrir conversa</button>
    </article>
  `;
}

function renderConnections() {
  const instagram = state.channels.filter((item) => item.provider === "instagram");
  const uazapi = state.channels.filter((item) => item.provider === "uazapi");

  return `
    <section class="screen-title">
      <div>
        <h1>Conexoes</h1>
        <p>Status operacional dos canais, sem editar tokens pelo PWA.</p>
      </div>
    </section>
    <section class="connections-grid">
      ${renderConnectionCard("Instagram Inbox", "instagram", instagram, "DMs e comentarios preparados para automacao Meta.")}
      ${renderConnectionCard("UAZAPI", "uazapi", uazapi, "Canal nao oficial separado das conexoes Meta Cloud API.")}
      ${renderPwaCard()}
    </section>
  `;
}

function renderConnectionCard(title, provider, channels, text) {
  const connected = channels.filter((item) => item.status === "connected").length;
  const pending = channels.filter((item) => item.status === "setup_pending").length;
  const first = channels[0];

  return `
    <article class="panel connection-card">
      <div class="connection-head">
        <h3>${title}</h3>
        <span class="badge ${provider}">${connected ? "Conectado" : pending ? "Pendente" : "Nao configurado"}</span>
      </div>
      <p>${text}</p>
      <div class="connection-meta">
        <div class="meta-row"><span>Canais</span><strong>${channels.length}</strong></div>
        <div class="meta-row"><span>Identificador</span><strong>${escapeHtml(first?.display_identifier || first?.label || "-")}</strong></div>
        <div class="meta-row"><span>Erro</span><strong>${escapeHtml(first?.last_error || "Nenhum")}</strong></div>
      </div>
      <button class="ghost-btn" data-action="open-settings" style="margin-top:14px;">Abrir configuracao no CRM</button>
    </article>
  `;
}

function renderPwaCard() {
  const installable = Boolean(state.installPrompt);
  return `
    <article class="panel connection-card">
      <div class="connection-head">
        <h3>Instalacao PWA</h3>
        <span class="badge whatsapp">${installable ? "Disponivel" : "Safari/Chrome"}</span>
      </div>
      <p>No iPhone: Safari > Compartilhar > Adicionar a Tela de Inicio. No Android/Chrome, use o botao quando aparecer.</p>
      <button class="primary-btn" data-action="install" ${installable ? "" : "disabled"} style="margin-top:14px;">Instalar app</button>
    </article>
  `;
}

function renderSettings() {
  return `
    <section class="screen-title">
      <div>
        <h1>Conta</h1>
        <p>Perfil e acesso rapido ao WACRM completo.</p>
      </div>
    </section>
    <section class="connections-grid">
      <article class="panel connection-card">
        <div class="connection-head">
          <h3>${escapeHtml(state.profile?.full_name || state.user.email)}</h3>
          <span class="badge">${escapeHtml(state.profile?.account_role || "membro")}</span>
        </div>
        <div class="connection-meta">
          <div class="meta-row"><span>Email</span><strong>${escapeHtml(state.user.email || "-")}</strong></div>
          <div class="meta-row"><span>Conta</span><strong>${escapeHtml(state.account?.name || "-")}</strong></div>
          <div class="meta-row"><span>CRM</span><strong>${escapeHtml(crmUrl())}</strong></div>
        </div>
        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:14px;">
          <button class="primary-btn" data-action="open-crm">Abrir CRM</button>
          <button class="ghost-btn" data-action="logout">Sair</button>
        </div>
      </article>
    </section>
  `;
}

function renderBottomNav() {
  return `
    <nav class="bottom-nav">
      ${tabs
        .map(
          (tab) =>
            `<button class="tab-btn ${state.tab === tab.id ? "active" : ""}" data-action="tab" data-id="${tab.id}">${tab.label}</button>`
        )
        .join("")}
    </nav>
  `;
}

function bindEvents() {
  document.querySelectorAll("[data-action='tab']").forEach((button) => {
    button.addEventListener("click", () => {
      state.tab = button.dataset.id;
      render();
    });
  });

  document.querySelector("[data-action='refresh']")?.addEventListener("click", async () => {
    toast("Atualizando...");
    await bootstrapData();
  });

  document.querySelector("#searchInput")?.addEventListener("input", (event) => {
    state.search = event.target.value;
    render();
  });

  document.querySelectorAll("[data-action='select-conversation']").forEach((button) => {
    button.addEventListener("click", async () => {
      state.selectedConversationId = button.dataset.id;
      state.loading = true;
      render();
      await loadMessages(state.selectedConversationId);
      state.loading = false;
      render();
      scrollMessages();
    });
  });

  document.querySelectorAll("[data-action='lead-filter']").forEach((button) => {
    button.addEventListener("click", () => {
      state.leadFilter = button.dataset.id;
      render();
    });
  });

  document.querySelectorAll("[data-action='select-lead']").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!button.dataset.id) return;
      state.selectedConversationId = button.dataset.id;
      state.tab = "inbox";
      state.loading = true;
      render();
      await loadMessages(state.selectedConversationId);
      state.loading = false;
      render();
      scrollMessages();
    });
  });

  document.querySelectorAll("[data-action='open-crm'], [data-action='open-settings']").forEach((button) => {
    button.addEventListener("click", openCrm);
  });

  document.querySelector("[data-action='install']")?.addEventListener("click", installApp);
  document.querySelector("[data-action='logout']")?.addEventListener("click", logout);
}

async function handleLogin(event) {
  event.preventDefault();
  state.error = "";
  const email = document.querySelector("#email").value.trim();
  const password = document.querySelector("#password").value;

  const { error } = await state.supabase.auth.signInWithPassword({ email, password });
  if (error) {
    state.error = error.message;
    renderAuth();
  }
}

async function logout() {
  await state.supabase.auth.signOut();
  state.user = null;
  render();
}

async function installApp() {
  if (!state.installPrompt) return;
  state.installPrompt.prompt();
  await state.installPrompt.userChoice;
  state.installPrompt = null;
  render();
}

function openCrm() {
  const draft = document.querySelector("#replyDraft")?.value?.trim();
  if (draft) {
    navigator.clipboard?.writeText(draft).then(() => toast("Rascunho copiado."));
  }

  const url = state.selectedConversationId
    ? `${crmUrl()}/inbox?conversation=${encodeURIComponent(state.selectedConversationId)}`
    : `${crmUrl()}/inbox`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function selectedConversation() {
  return state.conversations.find((item) => item.id === state.selectedConversationId) || null;
}

function filteredConversations() {
  const query = state.search.trim().toLowerCase();
  if (!query) return state.conversations;
  return state.conversations.filter((item) => {
    const contact = item.contact || {};
    return [contact.name, contact.phone, contact.email, item.last_message_text, providerOf(item)]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });
}

function buildLeadItems() {
  const byConversation = new Map();

  for (const conversation of state.conversations) {
    const provider = providerOf(conversation);
    const contact = conversation.contact || {};
    byConversation.set(conversation.id, {
      id: `conversation:${conversation.id}`,
      conversationId: conversation.id,
      name: contact.name || contact.phone || "Lead sem nome",
      subtitle: contact.phone || contact.email || "Sem contato",
      provider,
      providerClass: providerClass(provider),
      source: labelProvider(provider),
      preview: conversation.last_message_text || "",
      value: 0,
      tags: deriveTags(conversation, null),
      priority: isHotConversation(conversation) ? "hot" : "normal",
      lane: laneForConversation(conversation),
      updatedAt: conversation.last_message_at || conversation.updated_at,
    });
  }

  for (const deal of state.deals) {
    const conversationId = deal.conversation_id;
    const existing = conversationId ? byConversation.get(conversationId) : null;
    const contact = deal.contact || existing || {};
    const item = existing || {
      id: `deal:${deal.id}`,
      conversationId,
      name: contact.name || contact.phone || deal.title || "Lead",
      subtitle: contact.phone || contact.email || "Negocio sem conversa",
      provider: "whatsapp_official",
      providerClass: "whatsapp",
      source: "CRM",
      preview: deal.notes || deal.title,
      tags: [],
      priority: "normal",
      updatedAt: deal.updated_at || deal.created_at,
    };

    item.value = Number(deal.value || item.value || 0);
    item.title = deal.title;
    item.status = deal.status;
    item.stageName = deal.stage?.name || "";
    item.lane = laneForDeal(deal, item);
    item.tags = [...new Set([...(item.tags || []), ...deriveTags(null, deal)])];
    if (item.value > 0 || /proposta|contrato|pagamento|fech/i.test(item.stageName || "")) {
      item.priority = "hot";
    }
    byConversation.set(item.id, item);
    if (conversationId) byConversation.set(conversationId, item);
  }

  return [...new Map([...byConversation.values()].map((item) => [item.id, item])).values()].sort(
    (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
  );
}

function laneForConversation(conversation) {
  if (Number(conversation.unread_count || 0) > 0) return "ready";
  if (conversation.status === "closed") return "done";
  if (conversation.last_message_at) return "talking";
  return "new";
}

function laneForDeal(deal, fallback) {
  const stage = `${deal.stage?.name || ""} ${deal.status || ""}`.toLowerCase();
  if (/won|ganho|lost|perdido/.test(stage)) return "done";
  if (/proposta|contrato|pagamento|fech/.test(stage)) return "proposal";
  if (/qualificado|negocia|vendedor|atendimento/.test(stage)) return "ready";
  return fallback?.lane || "talking";
}

function deriveTags(conversation, deal) {
  const text = `${conversation?.last_message_text || ""} ${deal?.title || ""} ${deal?.notes || ""}`.toLowerCase();
  const tags = [];
  if (/integrar|reels/.test(text)) tags.push("reels-integrar");
  if (/instagram|insta/.test(text) || providerOf(conversation || {}) === "instagram") tags.push("instagram");
  if (/whatsapp|wpp/.test(text)) tags.push("whatsapp");
  if (/proposta|contrato|pagamento/.test(text)) tags.push("fechamento");
  return tags.slice(0, 3);
}

function isHotConversation(conversation) {
  const text = `${conversation.last_message_text || ""}`.toLowerCase();
  return Number(conversation.unread_count || 0) > 0 || /preco|valor|comprar|contrato|integrar|quero/.test(text);
}

function providerOf(conversation) {
  return conversation?.channel_provider || (conversation?.external_channel_id ? "uazapi" : "whatsapp_official");
}

function providerClass(provider) {
  if (provider === "instagram") return "instagram";
  if (provider === "uazapi") return "uazapi";
  return "whatsapp";
}

function labelProvider(provider) {
  if (provider === "instagram") return "Instagram";
  if (provider === "uazapi") return "UAZAPI";
  return "WhatsApp";
}

function crmUrl() {
  return (config.crmBaseUrl || "https://mgteamoficial.site").replace(/\/$/, "");
}

function initials(value) {
  return String(value || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatRelative(value) {
  if (!value) return "-";
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "agora";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: state.account?.default_currency || "BRL",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function scrollMessages() {
  requestAnimationFrame(() => {
    const messages = document.querySelector("#messages");
    if (messages) messages.scrollTop = messages.scrollHeight;
  });
}

function toast(message) {
  const node = document.querySelector("#toast");
  if (!node) return;
  node.textContent = message;
  node.classList.add("show");
  setTimeout(() => node.classList.remove("show"), 2600);
}
