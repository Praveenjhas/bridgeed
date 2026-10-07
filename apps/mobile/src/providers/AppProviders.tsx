import type { ReactNode } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ActorProvider } from "./ActorProvider";

export interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Single composition root for app wide providers.
 *
 * It exists so the route layout stays about navigation only, and so the list of
 * providers grows in one obvious place (a session, a theme override, a data
 * cache) instead of being spread across screens.
 *
 * `SafeAreaProvider` is first because everything below it, including custom
 * headers, reads the device insets from it.
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <SafeAreaProvider>
      <ActorProvider>{children}</ActorProvider>
    </SafeAreaProvider>
  );
}
