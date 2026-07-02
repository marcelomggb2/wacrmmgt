"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Archive,
  CalendarDays,
  GripVertical,
  KanbanSquare,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Priority = "low" | "normal" | "high" | "urgent";

interface TaskBoard {
  id: string;
  account_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface TaskColumn {
  id: string;
  account_id: string;
  board_id: string;
  name: string;
  position: number;
  color: string;
  wip_limit: number | null;
}

interface TaskCard {
  id: string;
  account_id: string;
  board_id: string;
  column_id: string;
  title: string;
  description: string | null;
  priority: Priority;
  labels: string[];
  due_date: string | null;
  position: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CardDraft {
  title: string;
  description: string;
  due_date: string;
  labels: string;
  priority: Priority;
}

const DEFAULT_COLUMNS = [
  { name: "Entrada", color: "#0f766e" },
  { name: "Planejado", color: "#2563eb" },
  { name: "Fazendo", color: "#f59e0b" },
  { name: "Aguardando", color: "#7c3aed" },
  { name: "Concluido", color: "#16a34a" },
];

const EMPTY_DRAFT: CardDraft = {
  title: "",
  description: "",
  due_date: "",
  labels: "",
  priority: "normal",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

const PRIORITY_CLASS: Record<Priority, string> = {
  low: "border-slate-300 bg-slate-100 text-slate-700",
  normal: "border-emerald-300 bg-emerald-50 text-emerald-700",
  high: "border-amber-300 bg-amber-50 text-amber-700",
  urgent: "border-rose-300 bg-rose-50 text-rose-700",
};

export function InternalTaskBoard() {
  const { accountId, user, canSendMessages, profileLoading } = useAuth();
  const [board, setBoard] = useState<TaskBoard | null>(null);
  const [columns, setColumns] = useState<TaskColumn[]>([]);
  const [cards, setCards] = useState<TaskCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [draftColumnId, setDraftColumnId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CardDraft>(EMPTY_DRAFT);
  const [newColumnName, setNewColumnName] = useState("");
  const bootstrappingRef = useRef(false);
  const supabase = useMemo(() => createClient(), []);

  const sortedColumns = useMemo(
    () => [...columns].sort((a, b) => a.position - b.position),
    [columns],
  );

  const cardsByColumn = useMemo(() => {
    const map = new Map<string, TaskCard[]>();
    for (const column of sortedColumns) map.set(column.id, []);
    for (const card of cards) {
      if (card.archived_at) continue;
      const bucket = map.get(card.column_id);
      if (bucket) bucket.push(card);
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => a.position - b.position);
    }
    return map;
  }, [cards, sortedColumns]);

  const activeCard = activeCardId
    ? cards.find((card) => card.id === activeCardId) ?? null
    : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const createDefaultBoard = useCallback(
    async (accountIdValue: string, userId: string | null) => {
      const { data: newBoard, error: boardError } = await supabase
        .from("task_boards")
        .insert({
          account_id: accountIdValue,
          created_by: userId,
          name: "Quadro secundario",
          description: "Tarefas internas do WACRM, separado do pipeline de vendas.",
          settings: { source: "wacrm_internal", version: 1 },
        })
        .select("id, account_id, name, description, created_at")
        .single();

      if (boardError) throw boardError;

      const { error: columnsError } = await supabase.from("task_board_columns").insert(
        DEFAULT_COLUMNS.map((column, index) => ({
          account_id: accountIdValue,
          board_id: newBoard.id,
          name: column.name,
          color: column.color,
          position: (index + 1) * 1000,
        })),
      );

      if (columnsError) throw columnsError;
      return newBoard as TaskBoard;
    },
    [supabase],
  );

  const loadBoard = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    setError(null);

    try {
      const { data: boardRows, error: boardError } = await supabase
        .from("task_boards")
        .select("id, account_id, name, description, created_at")
        .eq("account_id", accountId)
        .order("created_at", { ascending: true })
        .limit(1);

      if (boardError) throw boardError;

      let currentBoard = (boardRows?.[0] as TaskBoard | undefined) ?? null;
      if (!currentBoard && canSendMessages && !bootstrappingRef.current) {
        bootstrappingRef.current = true;
        currentBoard = await createDefaultBoard(accountId, user?.id ?? null);
        bootstrappingRef.current = false;
      }

      setBoard(currentBoard);

      if (!currentBoard) {
        setColumns([]);
        setCards([]);
        return;
      }

      const [columnsRes, cardsRes] = await Promise.all([
        supabase
          .from("task_board_columns")
          .select("id, account_id, board_id, name, position, color, wip_limit")
          .eq("board_id", currentBoard.id)
          .order("position", { ascending: true }),
        supabase
          .from("task_cards")
          .select(
            "id, account_id, board_id, column_id, title, description, priority, labels, due_date, position, archived_at, created_at, updated_at",
          )
          .eq("board_id", currentBoard.id)
          .is("archived_at", null)
          .order("position", { ascending: true }),
      ]);

      if (columnsRes.error) throw columnsRes.error;
      if (cardsRes.error) throw cardsRes.error;

      setColumns((columnsRes.data ?? []) as TaskColumn[]);
      setCards((cardsRes.data ?? []) as TaskCard[]);
    } catch (err) {
      bootstrappingRef.current = false;
      setError(err instanceof Error ? err.message : "Falha ao carregar quadro");
    } finally {
      setLoading(false);
    }
  }, [accountId, canSendMessages, createDefaultBoard, supabase, user?.id]);

  useEffect(() => {
    if (!profileLoading) void loadBoard();
  }, [loadBoard, profileLoading]);

  async function addColumn() {
    const name = newColumnName.trim();
    if (!accountId || !board || !name) return;
    setSaving(true);
    setError(null);
    try {
      const nextPosition =
        sortedColumns.reduce((max, column) => Math.max(max, column.position), 0) + 1000;
      const { data, error: insertError } = await supabase
        .from("task_board_columns")
        .insert({
          account_id: accountId,
          board_id: board.id,
          name,
          position: nextPosition,
          color: "#475569",
        })
        .select("id, account_id, board_id, name, position, color, wip_limit")
        .single();

      if (insertError) throw insertError;
      setColumns((current) => [...current, data as TaskColumn]);
      setNewColumnName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar lista");
    } finally {
      setSaving(false);
    }
  }

  async function addCard(columnId: string) {
    const title = draft.title.trim();
    if (!accountId || !board || !title) return;
    setSaving(true);
    setError(null);
    try {
      const columnCards = cardsByColumn.get(columnId) ?? [];
      const nextPosition =
        columnCards.reduce((max, card) => Math.max(max, card.position), 0) + 1000;
      const labels = draft.labels
        .split(",")
        .map((label) => label.trim())
        .filter(Boolean)
        .slice(0, 6);

      const { data, error: insertError } = await supabase
        .from("task_cards")
        .insert({
          account_id: accountId,
          board_id: board.id,
          column_id: columnId,
          created_by: user?.id ?? null,
          title,
          description: draft.description.trim() || null,
          due_date: draft.due_date || null,
          labels,
          priority: draft.priority,
          position: nextPosition,
          metadata: { source: "manual" },
        })
        .select(
          "id, account_id, board_id, column_id, title, description, priority, labels, due_date, position, archived_at, created_at, updated_at",
        )
        .single();

      if (insertError) throw insertError;
      setCards((current) => [...current, data as TaskCard]);
      setDraft(EMPTY_DRAFT);
      setDraftColumnId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar cartao");
    } finally {
      setSaving(false);
    }
  }

  async function archiveCard(cardId: string) {
    const previous = cards;
    setCards((current) => current.filter((card) => card.id !== cardId));
    const { error: updateError } = await supabase
      .from("task_cards")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", cardId);

    if (updateError) {
      setCards(previous);
      setError(updateError.message);
    }
  }

  async function moveCard(cardId: string, targetColumnId: string) {
    const card = cards.find((item) => item.id === cardId);
    if (!card || card.column_id === targetColumnId) return;
    const previous = cards;
    const targetCards = cards.filter(
      (item) => item.column_id === targetColumnId && item.id !== cardId,
    );
    const nextPosition =
      targetCards.reduce((max, item) => Math.max(max, item.position), 0) + 1000;

    setCards((current) =>
      current.map((item) =>
        item.id === cardId
          ? { ...item, column_id: targetColumnId, position: nextPosition }
          : item,
      ),
    );

    const { error: updateError } = await supabase
      .from("task_cards")
      .update({
        column_id: targetColumnId,
        position: nextPosition,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cardId);

    if (updateError) {
      setCards(previous);
      setError(updateError.message);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveCardId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCardId(null);
    const { active, over } = event;
    if (!over) return;
    const targetColumnId = String(over.id);
    if (!columns.some((column) => column.id === targetColumnId)) return;
    void moveCard(String(active.id), targetColumnId);
  }

  if (loading || profileLoading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-border bg-card">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Carregando quadro interno...
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="rounded-xl border border-border bg-card p-8">
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
          <KanbanSquare className="size-9 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">Quadro interno indisponivel</h2>
          <p className="text-sm text-muted-foreground">
            Nao encontrei um quadro para esta conta. Um usuario com permissao de agente
            ou admin precisa acessar esta tela para criar a estrutura inicial.
          </p>
          <Button onClick={() => void loadBoard()} variant="outline">
            <RefreshCw className="size-4" />
            Recarregar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <KanbanSquare className="size-5 text-primary" />
            <h1 className="truncate text-2xl font-semibold text-foreground">{board.name}</h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {board.description}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={newColumnName}
            onChange={(event) => setNewColumnName(event.target.value)}
            placeholder="Nova lista"
            className="h-9 sm:w-44"
            disabled={!canSendMessages || saving}
          />
          <Button onClick={() => void addColumn()} disabled={!newColumnName.trim() || saving || !canSendMessages}>
            <Plus className="size-4" />
            Lista
          </Button>
          <Button variant="outline" onClick={() => void loadBoard()}>
            <RefreshCw className="size-4" />
            Atualizar
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {error}
        </div>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveCardId(null)}
      >
        <div className="task-board-scroll flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4">
          {sortedColumns.map((column) => (
            <TaskColumnView
              key={column.id}
              column={column}
              cards={cardsByColumn.get(column.id) ?? []}
              canEdit={canSendMessages}
              draft={draft}
              saving={saving}
              isDraftOpen={draftColumnId === column.id}
              onOpenDraft={() => {
                setDraft(EMPTY_DRAFT);
                setDraftColumnId(column.id);
              }}
              onCloseDraft={() => setDraftColumnId(null)}
              onDraftChange={setDraft}
              onAddCard={() => void addCard(column.id)}
              onArchive={archiveCard}
            />
          ))}
        </div>

        <DragOverlay>
          {activeCard ? (
            <TaskCardView card={activeCard} isOverlay onArchive={archiveCard} canEdit={false} />
          ) : null}
        </DragOverlay>
      </DndContext>

      <style jsx>{`
        .task-board-scroll {
          scroll-behavior: smooth;
          scrollbar-width: thin;
          scrollbar-color: var(--border) transparent;
        }
        .task-board-scroll::-webkit-scrollbar {
          height: 8px;
        }
        .task-board-scroll::-webkit-scrollbar-thumb {
          background: var(--border);
          border-radius: 9999px;
        }
        @media (hover: none), (pointer: coarse) {
          .task-board-scroll {
            scrollbar-width: none;
          }
          .task-board-scroll::-webkit-scrollbar {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

function TaskColumnView({
  column,
  cards,
  canEdit,
  draft,
  saving,
  isDraftOpen,
  onOpenDraft,
  onCloseDraft,
  onDraftChange,
  onAddCard,
  onArchive,
}: {
  column: TaskColumn;
  cards: TaskCard[];
  canEdit: boolean;
  draft: CardDraft;
  saving: boolean;
  isDraftOpen: boolean;
  onOpenDraft: () => void;
  onCloseDraft: () => void;
  onDraftChange: (draft: CardDraft) => void;
  onAddCard: () => void;
  onArchive: (cardId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <section className="flex w-[86vw] min-w-[280px] max-w-[360px] shrink-0 snap-start flex-col rounded-xl border border-border bg-muted/35 lg:w-[320px]">
      <div className="rounded-t-xl border-b border-border bg-card px-4 py-3">
        <div className="-mx-4 -mt-3 mb-3 h-1 rounded-t-xl" style={{ background: column.color }} />
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-foreground">{column.name}</h2>
            <p className="text-xs text-muted-foreground">{cards.length} cartoes</p>
          </div>
          {column.wip_limit ? (
            <Badge variant="outline">{cards.length}/{column.wip_limit}</Badge>
          ) : null}
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[360px] flex-1 flex-col gap-2 p-3 transition-colors",
          isOver && "bg-primary/5 outline outline-2 outline-primary/50",
        )}
      >
        {cards.map((card) => (
          <DraggableTaskCard
            key={card.id}
            card={card}
            canEdit={canEdit}
            onArchive={onArchive}
          />
        ))}

        {cards.length === 0 && !isDraftOpen ? (
          <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-border bg-card/70 px-4 text-center text-xs text-muted-foreground">
            Solte tarefas aqui ou crie um cartao.
          </div>
        ) : null}

        {isDraftOpen ? (
          <form
            className="space-y-2 rounded-xl border border-border bg-card p-3 shadow-sm"
            onSubmit={(event) => {
              event.preventDefault();
              onAddCard();
            }}
          >
            <Input
              value={draft.title}
              onChange={(event) => onDraftChange({ ...draft, title: event.target.value })}
              placeholder="Titulo do cartao"
              autoFocus
            />
            <Textarea
              value={draft.description}
              onChange={(event) =>
                onDraftChange({ ...draft, description: event.target.value })
              }
              placeholder="Descricao curta"
              className="min-h-20"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={draft.due_date}
                onChange={(event) => onDraftChange({ ...draft, due_date: event.target.value })}
                type="date"
              />
              <select
                value={draft.priority}
                onChange={(event) =>
                  onDraftChange({ ...draft, priority: event.target.value as Priority })
                }
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="low">Baixa</option>
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
            <Input
              value={draft.labels}
              onChange={(event) => onDraftChange({ ...draft, labels: event.target.value })}
              placeholder="Tags separadas por virgula"
            />
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={!draft.title.trim() || saving}>
                Criar
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={onCloseDraft}>
                Cancelar
              </Button>
            </div>
          </form>
        ) : null}
      </div>

      <div className="border-t border-border bg-card p-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start border border-dashed border-border text-muted-foreground"
          disabled={!canEdit}
          onClick={onOpenDraft}
        >
          <Plus className="size-4" />
          Novo cartao
        </Button>
      </div>
    </section>
  );
}

function DraggableTaskCard({
  card,
  canEdit,
  onArchive,
}: {
  card: TaskCard;
  canEdit: boolean;
  onArchive: (cardId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform) }}
      className={cn(isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
    >
      <TaskCardView card={card} canEdit={canEdit} onArchive={onArchive} />
    </div>
  );
}

function TaskCardView({
  card,
  canEdit,
  isOverlay,
  onArchive,
}: {
  card: TaskCard;
  canEdit: boolean;
  isOverlay?: boolean;
  onArchive: (cardId: string) => void;
}) {
  return (
    <article
      className={cn(
        "rounded-xl border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md",
        isOverlay && "w-[300px] rotate-1 shadow-xl",
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-sm font-semibold leading-5 text-foreground">
            {card.title}
          </h3>
          {card.description ? (
            <p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">
              {card.description}
            </p>
          ) : null}
        </div>
        {canEdit ? (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Arquivar cartao"
            onClick={(event) => {
              event.stopPropagation();
              onArchive(card.id);
            }}
          >
            <Archive className="size-3.5" />
          </Button>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            "inline-flex h-5 items-center rounded-full border px-2 text-[11px] font-semibold",
            PRIORITY_CLASS[card.priority],
          )}
        >
          {PRIORITY_LABEL[card.priority]}
        </span>
        {card.due_date ? (
          <span className="inline-flex h-5 items-center gap-1 rounded-full border border-border bg-muted px-2 text-[11px] font-medium text-muted-foreground">
            <CalendarDays className="size-3" />
            {new Date(`${card.due_date}T00:00:00`).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
            })}
          </span>
        ) : null}
        {card.labels.map((label) => (
          <Badge key={label} variant="outline" className="bg-background">
            {label}
          </Badge>
        ))}
      </div>
    </article>
  );
}

export function BoardsIntro() {
  return (
    <div className="mb-5 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="size-5" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Funcao Trello secundaria</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Um quadro interno para tarefas operacionais. Ele nao substitui o pipeline de vendas:
            serve para organizar demandas, follow-ups internos e operacao da equipe.
          </p>
        </div>
      </div>
    </div>
  );
}
