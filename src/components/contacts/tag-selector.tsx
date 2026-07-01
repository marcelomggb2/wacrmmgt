"use client";

import { Loader2, Tag as TagIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Tag } from "@/types";

interface TagSelectorProps {
  tags: Tag[];
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  loading?: boolean;
  disabled?: boolean;
  emptyText?: string;
}

export function TagSelector({
  tags,
  selectedTagIds,
  onChange,
  loading = false,
  disabled = false,
  emptyText = "No tags available. Create tags in Settings.",
}: TagSelectorProps) {
  function toggleTag(tagId: string) {
    if (disabled) return;

    onChange(
      selectedTagIds.includes(tagId)
        ? selectedTagIds.filter((id) => id !== tagId)
        : [...selectedTagIds, tagId],
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        Loading tags...
      </div>
    );
  }

  if (tags.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => {
        const selected = selectedTagIds.includes(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggleTag(tag.id)}
            disabled={disabled}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              selected
                ? "ring-2 ring-primary ring-offset-1 ring-offset-border"
                : "opacity-70 hover:opacity-100",
              disabled && "cursor-not-allowed opacity-50",
            )}
            style={{
              backgroundColor: `${tag.color}20`,
              color: tag.color,
              borderColor: `${tag.color}40`,
            }}
          >
            <TagIcon className="size-3" />
            {tag.name}
          </button>
        );
      })}
    </div>
  );
}
