export function messageFromError(error: unknown, fallback = "Algo deu errado") {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return fallback;
}
