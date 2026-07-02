import { useCallback, useEffect, useMemo, useState } from "react";

import { crmBaseUrl, supabase } from "@/lib/supabase";
import type { Conversation, Message } from "@/types/domain";

function normalizeConversation(row: unknown): Conversation {
  const conversation = row as Conversation & { contact?: Conversation["contact"] | Conversation["contact"][] };
  const contact = Array.isArray(conversation.contact)
    ? conversation.contact[0] ?? null
    : conversation.contact ?? null;
  return { ...conversation, contact };
}

export function useConversations(accountId?: string | null) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    setError(null);

    try {
      const { data, error: loadError } = await supabase
        .from("conversations")
        .select(
          "id, account_id, contact_id, status, assigned_agent_id, last_message_text, last_message_at, unread_count, channel_provider, external_channel_id, whatsapp_config_id, created_at, updated_at, contact:contacts(id, account_id, phone, name, email, company, avatar_url)"
        )
        .eq("account_id", accountId)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(100);

      if (loadError) throw loadError;
      setConversations((data || []).map(normalizeConversation));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar inbox");
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!accountId) return;

    const channel = supabase
      .channel(`mobile-conversations:${accountId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter: `account_id=eq.${accountId}`
        },
        () => void loadConversations()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [accountId, loadConversations]);

  const unreadTotal = useMemo(
    () => conversations.reduce((sum, item) => sum + Number(item.unread_count || 0), 0),
    [conversations]
  );

  return {
    conversations,
    loading,
    error,
    unreadTotal,
    refresh: loadConversations
  };
}

export function useConversationMessages(conversationId?: string | string[]) {
  const id = Array.isArray(conversationId) ? conversationId[0] : conversationId;
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConversation = useCallback(async () => {
    if (!id) return;
    const { data, error: loadError } = await supabase
      .from("conversations")
      .select(
        "id, account_id, contact_id, status, assigned_agent_id, last_message_text, last_message_at, unread_count, channel_provider, external_channel_id, whatsapp_config_id, created_at, updated_at, contact:contacts(id, account_id, phone, name, email, company, avatar_url)"
      )
      .eq("id", id)
      .maybeSingle();

    if (loadError) throw loadError;
    setConversation(data ? normalizeConversation(data) : null);
  }, [id]);

  const loadMessages = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      await loadConversation();
      const { data, error: loadError } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_type, sender_id, content_type, content_text, media_url, status, created_at")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true })
        .limit(240);

      if (loadError) throw loadError;
      setMessages((data || []) as Message[]);

      await supabase
        .from("conversations")
        .update({ unread_count: 0, updated_at: new Date().toISOString() })
        .eq("id", id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar conversa");
    } finally {
      setLoading(false);
    }
  }, [id, loadConversation]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`mobile-messages:${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${id}`
        },
        (payload) => {
          const next = payload.new as Message | null;
          const old = payload.old as Message | null;

          setMessages((current) => {
            if (payload.eventType === "DELETE" && old?.id) {
              return current.filter((message) => message.id !== old.id);
            }

            if (!next?.id) return current;

            const exists = current.some((message) => message.id === next.id);
            const merged = exists
              ? current.map((message) => (message.id === next.id ? next : message))
              : [...current, next];

            return merged.sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `id=eq.${id}`
        },
        (payload) =>
          setConversation((current) =>
            current
              ? { ...current, ...(payload.new as Partial<Conversation>) }
              : (payload.new as Conversation)
          )
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id]);

  const sendMessage = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!id || !content) return;

      setSending(true);
      try {
        const {
          data: { session }
        } = await supabase.auth.getSession();

        const response = await fetch(`${crmBaseUrl}/api/inbox/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || ""}`
          },
          body: JSON.stringify({
            conversation_id: id,
            message_type: "text",
            content_text: content
          })
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || "Falha ao enviar mensagem");
        }
      } finally {
        setSending(false);
      }
    },
    [id]
  );

  return {
    conversation,
    messages,
    loading,
    sending,
    error,
    refresh: loadMessages,
    sendMessage
  };
}
