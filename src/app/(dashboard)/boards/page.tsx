"use client";

import { useMemo } from "react";
import { ExternalLink, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const DEFAULT_BOARDS_URL = "/boards/index.html";

export default function BoardsPage() {
  const boardsUrl =
    process.env.NEXT_PUBLIC_BOARDS_URL?.trim() || DEFAULT_BOARDS_URL;

  const localhostWarning = useMemo(() => {
    if (typeof window === "undefined") return false;
    const host = window.location.hostname;
    const isLocalHost = host === "localhost" || host === "127.0.0.1";
    return boardsUrl.includes("localhost") && !isLocalHost;
  }, [boardsUrl]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Boards</h1>
          <p className="text-sm text-muted-foreground">
            Quadro de tarefas embutido no proprio app (Hostinger Node friendly).
          </p>
        </div>
        <Button asChild variant="outline" className="gap-2">
          <a href={boardsUrl} target="_blank" rel="noreferrer">
            Abrir em nova aba
            <ExternalLink className="size-4" />
          </a>
        </Button>
      </div>

      {localhostWarning && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>URL local detectada</AlertTitle>
          <AlertDescription>
            O CRM esta em ambiente remoto, mas o Boards aponta para localhost.
            Remova NEXT_PUBLIC_BOARDS_URL para usar a versao interna
            (/boards/index.html) ou troque para uma URL publica.
          </AlertDescription>
        </Alert>
      )}

      <div className="h-[calc(100vh-12rem)] overflow-hidden rounded-xl border border-border bg-card">
        <iframe
          title="Boards Integration"
          src={boardsUrl}
          className="h-full w-full"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </div>
  );
}
