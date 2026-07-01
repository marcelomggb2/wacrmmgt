'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, CheckCircle2, AlertTriangle, Loader2, Wifi } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SettingsPanelHead } from './settings-panel-head';
import { WhatsAppConfig } from './whatsapp-config';
import { ExternalChannelSettings } from './external-channel-settings';

interface ChannelRow {
  id: string;
  phone_number_id: string;
  waba_id?: string;
  label?: string | null;
  status: 'connected' | 'disconnected';
  registered_at?: string | null;
  last_registration_error?: string | null;
  created_at: string;
}

export function ChannelsSettings() {
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [loading, setLoading] = useState(true);
  /** null = list view; 'new' = add form; string = editing that config id */
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchChannels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/channels');
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      setChannels(data.channels ?? []);
    } catch {
      toast.error('Failed to load channels');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  async function handleDelete(id: string) {
    if (!confirm('Remove this WhatsApp channel? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/whatsapp/config?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      toast.success('Channel removed');
      setChannels((prev) => prev.filter((c) => c.id !== id));
    } catch {
      toast.error('Failed to remove channel');
    } finally {
      setDeletingId(null);
    }
  }

  // When the child form finishes (save or cancel), go back to list.
  function handleFormDone() {
    setEditing(null);
    fetchChannels();
  }

  if (editing !== null) {
    return (
      <WhatsAppConfig
        configId={editing === 'new' ? undefined : editing}
        onDone={handleFormDone}
      />
    );
  }

  return (
    <div className="space-y-6">
      <SettingsPanelHead
        title="Inbox Channels"
        description="Manage official Meta numbers and keep non-official inboxes separated by provider."
      />

      <Tabs defaultValue="official" className="space-y-4">
        <TabsList>
          <TabsTrigger value="official">Official WhatsApp</TabsTrigger>
          <TabsTrigger value="uazapi">UAZAPI</TabsTrigger>
          <TabsTrigger value="instagram">Instagram</TabsTrigger>
        </TabsList>

        <TabsContent value="official" className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="size-5 animate-spin mr-2" />
              Loading channels…
            </div>
          ) : (
            <>
              {channels.length === 0 ? (
                <Card className="border-dashed border-border">
                  <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                    <Wifi className="size-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      No WhatsApp numbers connected yet.
                    </p>
                    <Button size="sm" onClick={() => setEditing('new')}>
                      <Plus className="size-4 mr-1.5" />
                      Add number
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {channels.map((ch) => (
                    <Card key={ch.id} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <CardTitle className="text-sm font-medium text-foreground">
                              {ch.label || ch.phone_number_id}
                            </CardTitle>
                            {ch.label && (
                              <CardDescription className="text-xs text-muted-foreground font-mono">
                                {ch.phone_number_id}
                              </CardDescription>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {ch.status === 'connected' && ch.registered_at ? (
                              <Badge
                                variant="outline"
                                className="border-emerald-700/50 bg-emerald-950/30 text-emerald-400 text-xs"
                              >
                                <CheckCircle2 className="size-3 mr-1" />
                                Live
                              </Badge>
                            ) : ch.status === 'connected' ? (
                              <Badge
                                variant="outline"
                                className="border-amber-700/50 bg-amber-950/30 text-amber-400 text-xs"
                              >
                                <AlertTriangle className="size-3 mr-1" />
                                Not registered
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-border text-muted-foreground text-xs"
                              >
                                Disconnected
                              </Badge>
                            )}

                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-foreground"
                              onClick={() => setEditing(ch.id)}
                            >
                              <Pencil className="size-3.5" />
                              <span className="sr-only">Edit</span>
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDelete(ch.id)}
                              disabled={deletingId === ch.id}
                            >
                              {deletingId === ch.id ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="size-3.5" />
                              )}
                              <span className="sr-only">Remove</span>
                            </Button>
                          </div>
                        </div>

                        {ch.last_registration_error && (
                          <p className="mt-2 text-xs text-amber-400/80 leading-relaxed">
                            Registration error: {ch.last_registration_error}
                          </p>
                        )}
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              )}

              {channels.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border text-muted-foreground hover:text-foreground"
                  onClick={() => setEditing('new')}
                >
                  <Plus className="size-4 mr-1.5" />
                  Add number
                </Button>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="uazapi">
          <ExternalChannelSettings provider="uazapi" />
        </TabsContent>

        <TabsContent value="instagram">
          <ExternalChannelSettings provider="instagram" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
