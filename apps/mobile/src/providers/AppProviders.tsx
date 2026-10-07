import type { ReactNode } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./AuthProvider";
import { StudentProfileProvider } from "./StudentProfileProvider";

export interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Single composition root for app wide providers.
 *
 * It exists so the route layout stays about navigation only, and so the list of
 * providers grows in one obvious place (the session, a theme override, a data
 * cache) instead of being spread across screens.
 *
 * `SafeAreaProvider` is first because everything below it, including custom
 * headers, reads the device insets from it. `AuthProvider` is next because the
 * route guards above it read the session to decide which screens exist, and
 * `StudentProfileProvider` sits inside it because the profile it reads belongs to
 * the signed-in account — it would have nothing to read before the session is
 * known.
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StudentProfileProvider>{children}</StudentProfileProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
