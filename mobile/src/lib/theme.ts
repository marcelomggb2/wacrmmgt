export const colors = {
  background: "#f4f7f5",
  card: "#ffffff",
  cardMuted: "#eef6f2",
  text: "#0f172a",
  muted: "#64748b",
  border: "#dbe3df",
  primary: "#075e54",
  primarySoft: "#dff5ed",
  whatsapp: "#25d366",
  instagram: "#c13584",
  blue: "#1877f2",
  amber: "#f59e0b",
  danger: "#e11d48",
  dark: "#10201d",
  bubbleAgent: "#d9fdd3",
  bubbleCustomer: "#ffffff"
};

export const radii = {
  sm: 10,
  md: 16,
  lg: 22,
  pill: 999
};

export const shadow = {
  shadowColor: "#0f172a",
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.12,
  shadowRadius: 26,
  elevation: 8
};

export function currencyFormat(value: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

export function initials(value?: string | null) {
  const label = value?.trim() || "?";
  return label
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function relativeTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "agora";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function shortTime(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}
