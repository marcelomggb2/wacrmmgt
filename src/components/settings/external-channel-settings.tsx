'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Camera,
  Copy,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Wifi,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { buildInstagramWebhookUrl } from '@/lib/inbox/instagram-webhook';

type ExternalChannelRow = {
  id: string;
  provider: 'uazapi' | 'instagram';
  label?: string | null;
  status: 'connected' | 'disconnected' | 'setup_pending' | 'error';
  base_url?: string | null;
  external_key?: string | null;
  display_identifier?: string | null;
  settings?: Record<string, unknown>;
  last_error?: string | null;
  has_token?: boolean;
  has_webhook_secret?: boolean;
};

interface ExternalChannelSettingsProps {
  provider: 'uazapi' | 'instagram';
}

function providerMeta(provider: 'uazapi' | 'instagram') {
  if (provider === 'uazapi') {
    return {
      title: 'UAZAPI inbox',
      description:
        'Connect a non-official WhatsApp inbox with token auth and SSE events, separated from Meta channels.',
      addLabel: 'Add UAZAPI channel',
    };
  }

  return {
    title: 'Instagram inbox',
    description:
      'Save the Instagram inbox setup now. Sending and webhooks stay disabled until the Graph integration is completed.',
    addLabel: 'Prepare Instagram channel',
  };
}

export function ExternalChannelSettings({
  provider,
}: ExternalChannelSettingsProps) {
  const meta = providerMeta(provider);
  const [rows, setRows] = useState<ExternalChannelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ExternalChannelRow | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const [label, setLabel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [externalKey, setExternalKey] = useState('');
  const [displayIdentifier, setDisplayIdentifier] = useState('');
  const [token, setToken] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [instagramPageId, setInstagramPageId] = useState('');
  const [instagramAccountId, setInstagramAccountId] = useState('');

  const currentRow = useMemo(
    () => (editing && editing !== 'new' ? editing : null),
    [editing],
  );
  const currentOrigin =
    typeof window === 'undefined' ? null : window.location.origin;
  const instagramWebhookUrl = useMemo(() => {
    if (provider !== 'instagram' || !currentRow?.id) return '';
    return buildInstagramWebhookUrl(currentRow.id, currentOrigin);
  }, [currentOrigin, currentRow?.id, provider]);

  const resetForm = useCallback(() => {
    setLabel('');
    setBaseUrl('');
    setExternalKey('');
    setDisplayIdentifier('');
    setToken('');
    setWebhookSecret('');
    setInstagramPageId('');
    setInstagramAccountId('');
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/inbox/external-channels');
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Failed to load channels');
      setRows((payload.channels ?? []).filter((row: ExternalChannelRow) => row.provider === provider));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load channels');
    } finally {
      setLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    if (!currentRow) {
      resetForm();
      return;
    }

    setLabel(currentRow.label || '');
    setBaseUrl(currentRow.base_url || '');
    setExternalKey(currentRow.external_key || '');
    setDisplayIdentifier(currentRow.display_identifier || '');
    setInstagramPageId(String(currentRow.settings?.page_id || ''));
    setInstagramAccountId(String(currentRow.settings?.instagram_account_id || ''));
    setToken('');
    setWebhookSecret('');
  }, [currentRow, resetForm]);

  async function handleDelete(id: string) {
    if (!confirm('Remove this inbox channel?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/inbox/external-channels?id=${id}`, {
        method: 'DELETE',
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Delete failed');
      await fetchRows();
      toast.success('Channel removed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove channel');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);

      const settings =
        provider === 'instagram'
          ? {
              page_id: instagramPageId.trim() || null,
              instagram_account_id: instagramAccountId.trim() || null,
            }
          : { inbound_transport: 'sse' };

      const res = await fetch('/api/inbox/external-channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentRow?.id,
          provider,
          label,
          base_url: provider === 'uazapi' ? baseUrl : undefined,
          external_key: provider === 'uazapi' ? undefined : externalKey,
          display_identifier: displayIdentifier,
          token: token.trim() || undefined,
          webhook_secret:
            provider === 'instagram' ? webhookSecret.trim() || undefined : undefined,
          settings,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Save failed');

      setEditing(null);
      resetForm();
      await fetchRows();
      toast.success(provider === 'instagram' ? 'Instagram setup saved' : 'Channel saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save channel');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest(row: ExternalChannelRow) {
    if (provider !== 'uazapi') return;
    setTestingId(row.id);
    try {
      const res = await fetch(`/api/inbox/external-channels/${row.id}/status`);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Status check failed');
      toast.success('UAZAPI channel is reachable');
      await fetchRows();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to verify channel');
    } finally {
      setTestingId(null);
    }
  }

  if (editing) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-foreground">
            {currentRow ? 'Edit channel' : meta.addLabel}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {provider === 'uazapi'
              ? 'Keep this connection separate from your official Meta inboxes.'
              : 'This stores the Instagram configuration only. Real-time events stay disabled for now.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>

          {provider === 'uazapi' ? (
            <>
              <div className="space-y-2">
                <Label>UAZAPI server or subdomain</Label>
                <Input
                  placeholder="api, free, or https://api.uazapi.com"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Display identifier</Label>
                <Input
                  placeholder="Support WhatsApp"
                  value={displayIdentifier}
                  onChange={(e) => setDisplayIdentifier(e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Instagram business account ID</Label>
                <Input
                  value={instagramAccountId}
                  onChange={(e) => setInstagramAccountId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Facebook page ID</Label>
                <Input value={instagramPageId} onChange={(e) => setInstagramPageId(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Display identifier</Label>
                <Input
                  placeholder="@youraccount"
                  value={displayIdentifier}
                  onChange={(e) => setDisplayIdentifier(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>
              {provider === 'instagram'
                ? currentRow?.has_token
                  ? 'Replace page access token'
                  : 'Page access token'
                : currentRow?.has_token
                  ? 'Replace token'
                  : 'Access token'}
            </Label>
            <Input
              type="password"
              placeholder={currentRow?.has_token ? 'Leave blank to keep current token' : ''}
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>

          {provider === 'uazapi' && (
            <p className="text-xs text-muted-foreground">
              Incoming messages are read through UAZAPI SSE using the saved token; no UAZAPI webhook secret is needed.
            </p>
          )}

          {provider === 'instagram' && (
            <div className="space-y-2">
              <Label>
                {currentRow?.has_webhook_secret
                  ? 'Replace verify token'
                  : 'Verify token'}
              </Label>
              <Input
                type="password"
                placeholder={
                  currentRow?.has_webhook_secret
                    ? 'Leave blank to keep current secret'
                    : 'Create the same token you will paste into Meta Developers'
                }
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Meta sends this value back as <code>hub.verify_token</code> during webhook verification.
              </p>
            </div>
          )}

          {provider === 'instagram' && (
            <div className="space-y-2">
              <Label>Webhook callback URL</Label>
              {currentRow ? (
                <>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={instagramWebhookUrl}
                      className="font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(instagramWebhookUrl);
                        toast.success('Webhook URL copied');
                      }}
                    >
                      <Copy className="size-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use this exact URL in Meta Developers for the Instagram callback.
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Save the channel once to generate the dedicated callback URL.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-1 size-4 animate-spin" />}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">{meta.title}</h3>
          <p className="text-sm text-muted-foreground">{meta.description}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setEditing('new')}>
          <Plus className="mr-1.5 size-4" />
          {meta.addLabel}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 size-5 animate-spin" />
          Loading channels…
        </div>
      ) : rows.length === 0 ? (
        <Card className="border-dashed border-border">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            {provider === 'instagram' ? (
              <Camera className="size-10 text-muted-foreground/40" />
            ) : (
              <Wifi className="size-10 text-muted-foreground/40" />
            )}
            <p className="text-sm text-muted-foreground">No channels configured yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.id} className="border-border">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-sm font-medium text-foreground">
                      {row.label || row.display_identifier || row.external_key || provider}
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      {row.display_identifier || row.external_key || row.base_url || 'Setup pending'}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-xs">
                      {row.status === 'connected' ? (
                        <>
                          <CheckCircle2 className="mr-1 size-3" />
                          Connected
                        </>
                      ) : row.status === 'setup_pending' ? (
                        <>
                          <AlertTriangle className="mr-1 size-3" />
                          Prepared
                        </>
                      ) : (
                        row.status
                      )}
                    </Badge>
                    {provider === 'uazapi' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => handleTest(row)}
                        disabled={testingId === row.id}
                      >
                        {testingId === row.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="size-3.5" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => setEditing(row)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => handleDelete(row.id)}
                      disabled={deletingId === row.id}
                    >
                      {deletingId === row.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
                {row.last_error && (
                  <p className="text-xs text-amber-400/80">Last error: {row.last_error}</p>
                )}
                {provider === 'instagram' && (
                  <div className="flex gap-2 pt-1">
                    <Input
                      readOnly
                      value={buildInstagramWebhookUrl(row.id, currentOrigin)}
                      className="h-8 font-mono text-[11px]"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-8 shrink-0"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          buildInstagramWebhookUrl(row.id, currentOrigin),
                        );
                        toast.success('Webhook URL copied');
                      }}
                    >
                      <Copy className="size-3.5" />
                    </Button>
                  </div>
                )}
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
