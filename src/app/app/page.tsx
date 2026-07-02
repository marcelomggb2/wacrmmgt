"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  DollarSign,
  Hash,
  Home,
  MessageCircle,
  Mic,
  MoreVertical,
  Paperclip,
  Phone,
  Plus,
  Search,
  Send,
  Settings,
  Sparkles,
  Star,
  Users2,
  X,
} from "lucide-react";
import { format, isToday, isYesterday, differenceInHours } from "date-fns";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Contact, Conversation, Message } from "@/types";
import { useRealtime } from "@/hooks/use-realtime";
import { useUazapiSseBridge } from "@/hooks/use-uazapi-sse-bridge";

type MobileTab = "inbox" | "leads" | "agenda" | "calls" | "settings";

const TABS: Array<{
  id: MobileTab;
  label: string;
  icon: typeof MessageCircle;
}> = [
  { id: "inbox", label: "Inbox", icon: MessageCircle },
  { id: "leads", label: "Leads", icon: Users2 },
  { id: "agenda", label: "Agenda", icon: CalendarDays },
  { id: "calls", label: "Calls", icon: Phone },
  { id: "settings", label: "Settings", icon: Settings },
];

const QUICK_DIAL = [
  ["1", ""],
  ["2", "ABC"],
  ["3", "DEF"],
  ["4", "GHI"],
  ["5", "JKL"],
  ["6", "MNO"],
  ["7", "PQRS"],
  ["8", "TUV"],
  ["9", "WXYZ"],
  ["*", ""],
  ["0", "+"],
  ["#", ""],
];

function asMobileTab(value: string | null): MobileTab {
  return TABS.some((tab) => tab.id === value) ? (value as MobileTab) : "inbox";
}

function displayName(conversation: Conversation): string {
  return (
    conversation.contact?.name ||
    conversation.contact?.phone ||
    conversation.last_message_text ||
    "Novo lead"
  );
}

function initials(contact?: Contact | null): string {
  const source = contact?.name || contact?.phone || "Lead";
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function formatMessageTime(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return "Yesterday";
  return format(date, "dd/MM");
}

function formatDayLabel(value: string): string {
  const date = new Date(value);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "dd MMM yyyy");
}

function groupMessages(messages: Message[]) {
  const groups: Array<{ date: string; messages: Message[] }> = [];
  let current = "";

  for (const message of messages) {
    const day = format(new Date(message.created_at), "yyyy-MM-dd");
    if (day !== current) {
      current = day;
      groups.push({ date: message.created_at, messages: [message] });
    } else {
      groups[groups.length - 1].messages.push(message);
    }
  }

  return groups;
}

function isOfficialMeta(conversation: Conversation | null): boolean {
  return (
    !conversation?.channel_provider ||
    conversation.channel_provider === "whatsapp_official"
  );
}

function sessionState(conversation: Conversation | null, messages: Message[]) {
  if (!conversation) {
    return { closed: false, label: "Ready", tone: "open" as const };
  }

  if (!isOfficialMeta(conversation)) {
    return { closed: false, label: "UAZAPI livre", tone: "open" as const };
  }

  const lastCustomer = [...messages]
    .reverse()
    .find((message) => message.sender_type === "customer");

  if (!lastCustomer) {
    return { closed: true, label: "Requer template", tone: "closed" as const };
  }

  const hours = differenceInHours(new Date(), new Date(lastCustomer.created_at));
  if (hours >= 24) {
    return { closed: true, label: "Sessao fechada", tone: "closed" as const };
  }

  return {
    closed: false,
    label: `${Math.max(1, 24 - hours)}h abertas`,
    tone: "open" as const,
  };
}

export default function MobileAppPage() {
  return (
    <Suspense fallback={<MobileLoading />}>
      <MobileAppInner />
    </Suspense>
  );
}

function MobileLoading() {
  return (
    <div className="mx-auto flex h-[100dvh] max-w-md items-center justify-center bg-[#edf5f2]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#008069] border-t-transparent" />
        <p className="text-sm font-semibold text-[#075e54]">Abrindo app mobile...</p>
      </div>
    </div>
  );
}

function MobileAppInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = asMobileTab(searchParams.get("tab"));

  const [profileName, setProfileName] = useState("MG Team");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] =
    useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [resyncToken, setResyncToken] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const setTab = useCallback(
    (tab: MobileTab) => {
      setActiveConversation(null);
      setMessages([]);
      router.replace(`/app?tab=${tab}`, { scroll: false });
    },
    [router],
  );

  const loadConversations = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("conversations")
      .select("*, contact:contacts(*)")
      .order("last_message_at", { ascending: false });

    if (error) {
      console.error("[mobile] failed to load conversations:", error);
      setLoading(false);
      return;
    }

    setConversations((data as Conversation[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session?.user) {
        router.replace("/login");
      }
    });

    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name,email")
        .eq("user_id", data.user.id)
        .maybeSingle();
      setProfileName(
        (profile?.full_name as string | undefined) ||
          (profile?.email as string | undefined) ||
          "MG Team",
      );
    });
  }, [router]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations, resyncToken]);

  useUazapiSseBridge({
    enabled: true,
    onSynced: () => setResyncToken((value) => value + 1),
  });

  const handleMessageEvent = useCallback(
    (event: { eventType: string; new: Message; old: Partial<Message> }) => {
      const message = event.new;

      if (event.eventType === "INSERT") {
        if (activeConversation?.id === message.conversation_id) {
          setMessages((prev) => {
            if (prev.some((item) => item.id === message.id)) return prev;
            return [
              ...prev.filter((item) => !item.id.startsWith("temp-")),
              message,
            ];
          });
        }

        setConversations((prev) =>
          prev.map((conversation) =>
            conversation.id === message.conversation_id
              ? {
                  ...conversation,
                  last_message_text: message.content_text ?? "",
                  last_message_at: message.created_at,
                  unread_count:
                    activeConversation?.id === message.conversation_id
                      ? 0
                      : conversation.unread_count + 1,
                }
              : conversation,
          ),
        );
      }

      if (event.eventType === "UPDATE") {
        setMessages((prev) =>
          prev.map((item) => (item.id === message.id ? { ...item, ...message } : item)),
        );
      }
    },
    [activeConversation?.id],
  );

  const handleConversationEvent = useCallback(
    (event: { eventType: string; new: Conversation; old: Partial<Conversation> }) => {
      const conversation = event.new;

      setConversations((prev) => {
        if (event.eventType === "INSERT") {
          if (prev.some((item) => item.id === conversation.id)) return prev;
          return [conversation, ...prev];
        }

        if (event.eventType === "UPDATE") {
          return prev.map((item) =>
            item.id === conversation.id ? { ...item, ...conversation } : item,
          );
        }

        return prev;
      });

      if (activeConversation?.id === conversation.id) {
        setActiveConversation((prev) =>
          prev ? { ...prev, ...conversation } : prev,
        );
      }
    },
    [activeConversation?.id],
  );

  useRealtime({
    channelName: "mobile-inbox-realtime",
    onMessageEvent: handleMessageEvent,
    onConversationEvent: handleConversationEvent,
    enabled: true,
  });

  useEffect(() => {
    if (!activeConversation) return;
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      setMessagesLoading(true);
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", activeConversation.id)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (error) {
        console.error("[mobile] failed to load messages:", error);
      } else {
        setMessages((data as Message[]) ?? []);
      }
      setMessagesLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeConversation]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, activeConversation?.id]);

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;

    return conversations.filter((conversation) => {
      const haystack = [
        conversation.contact?.name,
        conversation.contact?.phone,
        conversation.last_message_text,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [conversations, search]);

  const topLeads = useMemo(
    () => conversations.filter((item) => item.status !== "closed").slice(0, 8),
    [conversations],
  );

  const unreadTotal = conversations.reduce(
    (total, conversation) => total + (conversation.unread_count || 0),
    0,
  );

  const currentSession = sessionState(activeConversation, messages);

  const selectConversation = useCallback((conversation: Conversation) => {
    setActiveConversation(conversation);
    setMessages([]);
    setDraft("");
    setConversations((prev) =>
      prev.map((item) =>
        item.id === conversation.id ? { ...item, unread_count: 0 } : item,
      ),
    );
  }, []);

  const sendMessage = useCallback(async () => {
    const text = draft.trim();
    if (!text || !activeConversation || currentSession.closed || sending) return;

    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      conversation_id: activeConversation.id,
      sender_type: "agent",
      content_type: "text",
      content_text: text,
      status: "sending",
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    setSending(true);

    try {
      const response = await fetch("/api/inbox/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: activeConversation.id,
          message_type: "text",
          content_text: text,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${response.status}`);
      }

      setMessages((prev) =>
        prev.map((item) =>
          item.id === tempId ? { ...item, status: "sent" } : item,
        ),
      );
    } catch (error) {
      console.error("[mobile] failed to send message:", error);
      setMessages((prev) =>
        prev.map((item) =>
          item.id === tempId ? { ...item, status: "failed" } : item,
        ),
      );
    } finally {
      setSending(false);
    }
  }, [activeConversation, currentSession.closed, draft, sending]);

  const primaryConversation = activeConversation || conversations[0] || null;

  return (
    <div className="mx-auto flex h-[100dvh] max-w-md flex-col overflow-hidden bg-[#edf5f2] text-slate-950 shadow-2xl">
      {activeTab === "inbox" && activeConversation ? (
        <ChatScreen
          conversation={activeConversation}
          messages={messages}
          loading={messagesLoading}
          draft={draft}
          onDraftChange={setDraft}
          onBack={() => {
            setActiveConversation(null);
            setMessages([]);
          }}
          onSend={sendMessage}
          session={currentSession}
          sending={sending}
          scrollRef={scrollRef}
        />
      ) : (
        <>
          <MobileHeader
            profileName={profileName}
            unreadTotal={unreadTotal}
            activeTab={activeTab}
          />
          <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-24 pt-3">
            {activeTab === "inbox" && (
              <InboxHome
                conversations={filteredConversations}
                loading={loading}
                search={search}
                onSearchChange={setSearch}
                onSelect={selectConversation}
              />
            )}
            {activeTab === "leads" && (
              <LeadsHome leads={topLeads} onSelect={selectConversation} />
            )}
            {activeTab === "agenda" && <AgendaHome leads={topLeads} />}
            {activeTab === "calls" && (
              <CallsHome conversation={primaryConversation} />
            )}
            {activeTab === "settings" && (
              <SettingsHome profileName={profileName} conversations={conversations} />
            )}
          </main>
          <BottomNav activeTab={activeTab} onChange={setTab} unread={unreadTotal} />
        </>
      )}
    </div>
  );
}

function MobileHeader({
  profileName,
  unreadTotal,
  activeTab,
}: {
  profileName: string;
  unreadTotal: number;
  activeTab: MobileTab;
}) {
  const title =
    activeTab === "inbox"
      ? "WhatsApp Inbox"
      : activeTab === "leads"
        ? "Leads"
        : activeTab === "agenda"
          ? "Agenda"
          : activeTab === "calls"
            ? "Chamadas"
            : "Settings";

  return (
    <header className="shrink-0 bg-[#075e54] px-4 pb-4 pt-[calc(env(safe-area-inset-top)+14px)] text-white">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-white/70">{profileName}</p>
          <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {unreadTotal > 0 && (
            <span className="rounded-full bg-[#25d366] px-2.5 py-1 text-xs font-bold text-[#063c35]">
              {unreadTotal}
            </span>
          )}
          <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white">
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

function InboxHome({
  conversations,
  loading,
  search,
  onSearchChange,
  onSelect,
}: {
  conversations: Conversation[];
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (conversation: Conversation) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-[28px] bg-white p-3 shadow-sm">
        <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2.5">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Pesquisar conversas"
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
          {search && (
            <button onClick={() => onSearchChange("")}>
              <X className="h-4 w-4 text-slate-400" />
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-[28px] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Conversas</h2>
            <p className="text-xs text-slate-500">Instagram, WhatsApp e UAZAPI</p>
          </div>
          <button className="flex h-10 w-10 items-center justify-center rounded-full bg-[#008069] text-white shadow-sm">
            <Plus className="h-5 w-5" />
          </button>
        </div>
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-8 text-center">
            <MessageCircle className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm font-semibold text-slate-700">
              Nenhuma conversa ainda
            </p>
            <p className="text-xs text-slate-500">
              Os novos leads aparecem aqui em tempo real.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {conversations.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                onSelect={onSelect}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ConversationRow({
  conversation,
  onSelect,
}: {
  conversation: Conversation;
  onSelect: (conversation: Conversation) => void;
}) {
  const unread = conversation.unread_count > 0;
  const provider =
    conversation.channel_provider === "instagram"
      ? "Instagram"
      : conversation.channel_provider === "uazapi"
        ? "UAZAPI"
        : "WhatsApp";

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(conversation)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-slate-50"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#d9fdd3] text-sm font-bold text-[#075e54]">
          {initials(conversation.contact)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[15px] font-bold text-slate-950">
              {displayName(conversation)}
            </p>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              {provider}
            </span>
          </div>
          <p className="mt-0.5 truncate text-sm text-slate-500">
            {conversation.last_message_text || "Abrir atendimento"}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={cn("text-xs", unread ? "font-bold text-[#008069]" : "text-slate-400")}>
            {formatMessageTime(conversation.last_message_at)}
          </span>
          {unread ? (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#25d366] px-1.5 text-[11px] font-bold text-[#063c35]">
              {conversation.unread_count}
            </span>
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-300" />
          )}
        </div>
      </button>
    </li>
  );
}

function ChatScreen({
  conversation,
  messages,
  loading,
  draft,
  onDraftChange,
  onBack,
  onSend,
  session,
  sending,
  scrollRef,
}: {
  conversation: Conversation;
  messages: Message[];
  loading: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onBack: () => void;
  onSend: () => void;
  session: ReturnType<typeof sessionState>;
  sending: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const grouped = groupMessages(messages);
  const name = displayName(conversation);

  return (
    <div className="flex h-full flex-col bg-[#efeae2]">
      <header className="flex shrink-0 items-center gap-3 bg-[#075e54] px-3 pb-3 pt-[calc(env(safe-area-inset-top)+10px)] text-white">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full text-white active:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#d9fdd3] text-sm font-bold text-[#075e54]">
          {initials(conversation.contact)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold">{name}</p>
          <p className="truncate text-xs text-white/70">
            {conversation.contact?.phone || session.label}
          </p>
        </div>
        <button className="flex h-10 w-10 items-center justify-center rounded-full text-white active:bg-white/10">
          <Phone className="h-5 w-5" />
        </button>
      </header>

      <div
        className={cn(
          "mx-3 mt-3 rounded-full px-3 py-2 text-center text-xs font-semibold shadow-sm",
          session.tone === "open"
            ? "bg-[#d9fdd3] text-[#075e54]"
            : "bg-amber-100 text-amber-800",
        )}
      >
        {session.tone === "open"
          ? `Sessao aberta - ${session.label}`
          : "Sessao fechada - selecione um template para continuar"}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 7 }).map((_, index) => (
              <div
                key={index}
                className={cn(
                  "h-12 animate-pulse rounded-2xl bg-white/80",
                  index % 2 === 0 ? "mr-16" : "ml-16",
                )}
              />
            ))}
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.date} className="space-y-2">
              <div className="flex justify-center">
                <span className="rounded-lg bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-500 shadow-sm">
                  {formatDayLabel(group.date)}
                </span>
              </div>
              {group.messages.map((message) => (
                <MobileBubble key={message.id} message={message} />
              ))}
            </div>
          ))
        )}
      </div>

      <footer className="shrink-0 bg-[#efeae2] px-2 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2">
        {session.closed ? (
          <button
            type="button"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#008069] px-4 text-sm font-bold text-white shadow-sm"
          >
            <Sparkles className="h-4 w-4" />
            Selecionar Template
          </button>
        ) : (
          <div className="flex items-end gap-2">
            <div className="flex min-h-12 flex-1 items-end gap-1 rounded-[24px] bg-white px-3 py-2 shadow-sm">
              <button className="flex h-8 w-8 shrink-0 items-center justify-center text-slate-400">
                <Paperclip className="h-5 w-5" />
              </button>
              <textarea
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
                placeholder="Mensagem"
                rows={1}
                className="max-h-24 min-h-8 flex-1 resize-none bg-transparent py-1 text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
              />
              <button className="flex h-8 w-8 shrink-0 items-center justify-center text-slate-400">
                <Mic className="h-5 w-5" />
              </button>
            </div>
            <button
              type="button"
              disabled={!draft.trim() || sending}
              onClick={onSend}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#008069] text-white shadow-sm disabled:opacity-50"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}

function MobileBubble({ message }: { message: Message }) {
  const mine = message.sender_type === "agent" || message.sender_type === "bot";

  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[82%] rounded-2xl px-3 py-2 text-sm shadow-sm",
          mine
            ? "rounded-tr-sm bg-[#d9fdd3] text-slate-950"
            : "rounded-tl-sm bg-white text-slate-950",
        )}
      >
        <p className="whitespace-pre-wrap break-words">
          {message.content_text || `[${message.content_type}]`}
        </p>
        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-500">
          <span>{format(new Date(message.created_at), "HH:mm")}</span>
          {mine && (
            <CheckCircle2
              className={cn(
                "h-3 w-3",
                message.status === "failed" ? "text-red-500" : "text-[#53bdeb]",
              )}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function LeadsHome({
  leads,
  onSelect,
}: {
  leads: Conversation[];
  onSelect: (conversation: Conversation) => void;
}) {
  return (
    <div className="space-y-4">
      <MetricStrip leads={leads} />
      <section className="rounded-[28px] bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Oportunidades</h2>
            <p className="text-xs text-slate-500">Leads ativos para acao rapida</p>
          </div>
          <span className="rounded-full bg-[#d9fdd3] px-3 py-1 text-xs font-bold text-[#075e54]">
            {leads.length}
          </span>
        </div>
        <div className="mt-4 space-y-3">
          {leads.map((lead, index) => (
            <button
              key={lead.id}
              type="button"
              onClick={() => onSelect(lead)}
              className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-3 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#008069] text-sm font-bold text-white">
                  {initials(lead.contact)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-950">
                    {displayName(lead)}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {lead.last_message_text || "Sem mensagem recente"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#075e54]">
                    R$ {(index + 1) * 1000}
                  </p>
                  <p className="text-[10px] uppercase text-slate-400">estimado</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                  reels-integrar
                </span>
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                  {lead.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function MetricStrip({ leads }: { leads: Conversation[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-[24px] bg-white p-4 shadow-sm">
        <Users2 className="h-5 w-5 text-[#008069]" />
        <p className="mt-3 text-2xl font-bold text-slate-950">{leads.length}</p>
        <p className="text-xs text-slate-500">Leads abertos</p>
      </div>
      <div className="rounded-[24px] bg-white p-4 shadow-sm">
        <DollarSign className="h-5 w-5 text-[#008069]" />
        <p className="mt-3 text-2xl font-bold text-slate-950">
          R$ {leads.length * 1000}
        </p>
        <p className="text-xs text-slate-500">Pipeline estimado</p>
      </div>
    </div>
  );
}

function AgendaHome({ leads }: { leads: Conversation[] }) {
  const today = new Date();
  const days = Array.from({ length: 14 }).map((_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    return date;
  });

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Agenda</h2>
            <p className="text-xs text-slate-500">Follow-ups e reunioes</p>
          </div>
          <CalendarDays className="h-5 w-5 text-[#008069]" />
        </div>
        <div className="mt-4 grid grid-cols-7 gap-2">
          {days.slice(0, 14).map((day) => (
            <div
              key={day.toISOString()}
              className={cn(
                "rounded-2xl px-2 py-3 text-center",
                isToday(day) ? "bg-[#008069] text-white" : "bg-slate-50 text-slate-600",
              )}
            >
              <p className="text-[10px] font-semibold uppercase">
                {format(day, "EEE")}
              </p>
              <p className="text-sm font-bold">{format(day, "d")}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="space-y-3">
        {leads.slice(0, 4).map((lead, index) => (
          <div key={lead.id} className="rounded-[24px] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#d9fdd3] font-bold text-[#075e54]">
                {initials(lead.contact)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-950">
                  Follow-up: {displayName(lead)}
                </p>
                <p className="text-xs text-slate-500">
                  {index % 2 === 0 ? "10:30 AM" : "02:15 PM"} · WhatsApp
                </p>
              </div>
              <Clock3 className="h-5 w-5 text-slate-300" />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function CallsHome({ conversation }: { conversation: Conversation | null }) {
  const [number, setNumber] = useState(conversation?.contact?.phone ?? "");

  useEffect(() => {
    if (conversation?.contact?.phone) setNumber(conversation.contact.phone);
  }, [conversation?.contact?.phone]);

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] bg-[#111b21] p-5 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
          Call dialer
        </p>
        <div className="mt-6 text-center">
          <p className="min-h-8 text-2xl font-semibold tracking-wide">
            {number || "Digite um numero"}
          </p>
          <p className="mt-1 text-xs text-white/50">
            {conversation ? displayName(conversation) : "Lead selecionado"}
          </p>
        </div>
        <div className="mt-8 grid grid-cols-3 gap-4">
          {QUICK_DIAL.map(([digit, letters]) => (
            <button
              key={`${digit}-${letters}`}
              type="button"
              onClick={() => setNumber((value) => `${value}${digit}`)}
              className="mx-auto flex h-16 w-16 flex-col items-center justify-center rounded-full bg-[#1f2c2b] text-white active:bg-[#263a38]"
            >
              <span className="text-xl font-semibold">{digit}</span>
              <span className="text-[10px] font-bold text-white/55">{letters}</span>
            </button>
          ))}
        </div>
        <div className="mt-7 flex items-center justify-center gap-8">
          <button
            type="button"
            className="flex h-16 w-16 items-center justify-center rounded-full bg-[#33e34d] text-[#07230d]"
          >
            <Phone className="h-7 w-7" />
          </button>
          <button
            type="button"
            onClick={() => setNumber((value) => value.slice(0, -1))}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/70"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </section>
    </div>
  );
}

function SettingsHome({
  profileName,
  conversations,
}: {
  profileName: string;
  conversations: Conversation[];
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-[28px] bg-[#111b21] p-5 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1f2c2b] text-lg font-bold text-[#25d366]">
            {profileName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-lg font-bold">{profileName}</p>
            <p className="text-xs text-white/50">MG Team workspace</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-2">
          <SettingStat label="Chats" value={conversations.length} />
          <SettingStat
            label="Unread"
            value={conversations.reduce((sum, item) => sum + item.unread_count, 0)}
          />
          <SettingStat label="Mode" value="PWA" />
        </div>
      </section>
      <section className="rounded-[28px] bg-white p-2 shadow-sm">
        {[
          ["App version", "mobile-web"],
          ["Visual", "WhatsApp style"],
          ["Status", "Online"],
        ].map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-2xl px-3 py-3"
          >
            <span className="text-sm font-semibold text-slate-800">{label}</span>
            <span className="text-xs font-bold text-slate-400">{value}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

function SettingStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-white/5 p-3 text-center">
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
        {label}
      </p>
    </div>
  );
}

function BottomNav({
  activeTab,
  onChange,
  unread,
}: {
  activeTab: MobileTab;
  onChange: (tab: MobileTab) => void;
  unread: number;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-slate-200 bg-white/95 px-3 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="grid grid-cols-5 gap-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className="relative flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-semibold"
            >
              <span
                className={cn(
                  "flex h-8 min-w-12 items-center justify-center rounded-full px-3",
                  active ? "bg-[#d9fdd3] text-[#075e54]" : "text-slate-500",
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className={active ? "text-[#075e54]" : "text-slate-400"}>
                {tab.label}
              </span>
              {tab.id === "inbox" && unread > 0 && (
                <span className="absolute right-4 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#25d366] px-1 text-[9px] font-bold text-[#063c35]">
                  {unread}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
