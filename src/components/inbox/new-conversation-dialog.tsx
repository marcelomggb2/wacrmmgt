"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageSquarePlus, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { TagSelector } from "@/components/contacts/tag-selector";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import type {
  Contact,
  Conversation,
  InboxChannel,
  MessageTemplate,
  Tag,
} from "@/types";
import {
  TemplatePicker,
  type TemplateSendValues,
} from "./template-picker";

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (conversation: Conversation) => void;
}

export function NewConversationDialog({
  open,
  onOpenChange,
  onCreated,
}: NewConversationDialogProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [channels, setChannels] = useState<InboxChannel[]>([]);
  const [search, setSearch] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<string>("new");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [templateValues, setTemplateValues] = useState<TemplateSendValues | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [{ data: contactRows }, { data: tagRows }, channelsRes] = await Promise.all([
          supabase
            .from("contacts")
            .select("*")
            .order("updated_at", { ascending: false })
            .limit(150),
          supabase.from("tags").select("*").order("name"),
          fetch("/api/inbox/channels"),
        ]);

        const channelsPayload = await channelsRes.json().catch(() => ({ channels: [] }));
        if (cancelled) return;

        setContacts((contactRows as Contact[]) ?? []);
        setTags((tagRows as Tag[]) ?? []);
        setChannels((channelsPayload.channels ?? []) as InboxChannel[]);
        setSelectedChannelId(
          ((channelsPayload.channels ?? []) as InboxChannel[]).find(
            (channel) => channel.selectable,
          )?.id ?? "",
        );
      } catch (error) {
        console.error("Failed to prepare new conversation dialog:", error);
        toast.error("Failed to load contacts and channels");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, supabase]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setSelectedContactId("new");
      setName("");
      setPhone("");
      setEmail("");
      setSelectedTagIds([]);
      setSelectedTemplate(null);
      setTemplateValues(null);
    }
  }, [open]);

  const filteredContacts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return contacts.slice(0, 8);
    return contacts
      .filter((contact) => {
        const haystack = [
          contact.name || "",
          contact.phone || "",
          contact.email || "",
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 8);
  }, [contacts, search]);

  const selectedChannel = channels.find((channel) => channel.id === selectedChannelId) ?? null;
  const existingContact = contacts.find((contact) => contact.id === selectedContactId) ?? null;

  useEffect(() => {
    if (!existingContact) return;
    setName(existingContact.name || "");
    setPhone(existingContact.phone || "");
    setEmail(existingContact.email || "");
  }, [existingContact]);

  function handleTemplateSelect(
    template: MessageTemplate,
    values: TemplateSendValues,
  ) {
    setSelectedTemplate(template);
    setTemplateValues(values);
  }

  async function handleSubmit() {
    if (!selectedChannelId) {
      toast.error("Select a channel");
      return;
    }

    if (!selectedTemplate || !templateValues) {
      toast.error("Choose a template");
      return;
    }

    if (selectedContactId === "new" && !phone.trim()) {
      toast.error("Phone number is required");
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch("/api/inbox/start-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: selectedContactId === "new" ? undefined : selectedContactId,
          contact:
            selectedContactId === "new"
              ? {
                  name,
                  phone,
                  email,
                }
              : undefined,
          tag_ids: selectedTagIds,
          channel: {
            id: selectedChannelId,
            provider: selectedChannel?.provider,
          },
          template: {
            name: selectedTemplate.name,
            language: selectedTemplate.language,
            body: templateValues.body,
            headerText: templateValues.headerText,
            buttonParams: templateValues.buttonParams,
          },
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || `HTTP ${response.status}`);
      }

      onOpenChange(false);
      onCreated(payload.conversation as Conversation);
      toast.success("Conversation started");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start conversation";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="border-border bg-popover sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-popover-foreground">
              <MessageSquarePlus className="size-4 text-primary" />
              New conversation
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Pick a contact, assign tags, choose a channel, and send the first template.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-5 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Find contact</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search by name, phone or email"
                      className="pl-9"
                    />
                  </div>
                  <div className="rounded-lg border border-border bg-background/50 p-2">
                    <button
                      type="button"
                      onClick={() => setSelectedContactId("new")}
                      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
                        selectedContactId === "new"
                          ? "bg-primary/15 text-primary"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Plus className="size-4" />
                        Create a new contact
                      </span>
                    </button>
                    {filteredContacts.map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => setSelectedContactId(contact.id)}
                        className={`mt-1 flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
                          selectedContactId === contact.id
                            ? "bg-primary/15 text-primary"
                            : "text-foreground hover:bg-muted"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {contact.name || contact.phone}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {contact.phone}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Name</Label>
                    <Input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      disabled={selectedContactId !== "new"}
                      placeholder="Customer name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Phone</Label>
                    <Input
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      disabled={selectedContactId !== "new"}
                      placeholder="+1 234 567 8900"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-muted-foreground">Email</Label>
                    <Input
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      disabled={selectedContactId !== "new"}
                      placeholder="customer@example.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground">Tags</Label>
                  <TagSelector
                    tags={tags}
                    selectedTagIds={selectedTagIds}
                    onChange={setSelectedTagIds}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Channel</Label>
                  <Select
                    value={selectedChannelId}
                    onValueChange={(value) => setSelectedChannelId(value ?? "")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a channel" />
                    </SelectTrigger>
                    <SelectContent>
                      {channels
                        .filter((channel) => channel.selectable)
                        .map((channel) => (
                          <SelectItem key={channel.id} value={channel.id}>
                            {channel.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-lg border border-border bg-background/50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {selectedTemplate?.name || "No template selected"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedTemplate
                          ? selectedTemplate.body_text
                          : "The first message must be an approved template."}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setTemplatePickerOpen(true)}
                    >
                      Choose template
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading || submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Start conversation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TemplatePicker
        open={templatePickerOpen}
        onOpenChange={setTemplatePickerOpen}
        onSelect={handleTemplateSelect}
      />
    </>
  );
}
