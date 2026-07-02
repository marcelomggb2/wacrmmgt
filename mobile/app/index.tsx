import { Redirect } from "expo-router";

import { LoadingState } from "@/components/LoadingState";
import { useAuth } from "@/hooks/useAuth";

export default function IndexRoute() {
  const { loading, user } = useAuth();

  if (loading) return <LoadingState label="Abrindo MG Team Mobile..." />;

  return <Redirect href={user ? "/(tabs)" : "/(auth)/login"} />;
}
