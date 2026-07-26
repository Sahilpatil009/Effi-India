import {
  AppState,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type AppStateStatus,
} from "react-native";
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import {
  createSessionFromUrl,
  fetchProfile,
  getSupabaseClientSafe,
  signInWithGoogle,
  signOut,
  type Profile,
} from "../lib/supabase";

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

type AppConfigErrorProps = {
  message: string;
  onRetry: () => void;
};

function AppConfigErrorScreen({ message, onRetry }: AppConfigErrorProps) {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>App setup issue</Text>
      <Text style={styles.errorBody}>{message}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.85}>
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

function createFallbackProfile(user: User): Profile {
  const metadata = user.user_metadata ?? {};

  return {
    id: user.id,
    full_name:
      metadata.full_name ?? metadata.name ?? user.email?.split("@")[0] ?? "Citizen",
    avatar_url: metadata.avatar_url ?? null,
    created_at: null,
    updated_at: null,
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const initializeSupabase = useCallback(() => {
    const { client, error } = getSupabaseClientSafe();

    if (!client) {
      setSupabase(null);
      setConfigError(error ?? "Unable to initialize Supabase client.");
      setIsLoading(false);
      return;
    }

    setSupabase(client);
    setConfigError(null);
  }, []);

  useEffect(() => {
    initializeSupabase();
  }, [initializeSupabase]);

  const hydrateProfile = useCallback(
    async (nextUser: User | null) => {
      if (!nextUser) {
        setProfile(null);
        return;
      }

      try {
        const fetchedProfile = await fetchProfile(nextUser.id);
        setProfile(fetchedProfile ?? createFallbackProfile(nextUser));
      } catch (error) {
        console.warn("[auth] Failed to hydrate profile:", error);
        setProfile(createFallbackProfile(nextUser));
      }
    },
    [],
  );

  const refreshProfile = useCallback(async () => {
    await hydrateProfile(user);
  }, [hydrateProfile, user]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isMounted = true;

    const bootstrap = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          try {
            await createSessionFromUrl(initialUrl);
          } catch (error) {
            console.warn("[auth] Failed to restore session from initial URL:", error);
          }
        }

        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();

        if (!isMounted) {
          return;
        }

        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        setIsLoading(false);
        void hydrateProfile(initialSession?.user ?? null);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!isMounted) {
        return;
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (isMounted) {
        setIsLoading(false);
      }
      void hydrateProfile(nextSession?.user ?? null);
    });

    const linkSubscription = Linking.addEventListener("url", ({ url }) => {
      void createSessionFromUrl(url);
    });

    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextState) => {
        if (
          appStateRef.current.match(/inactive|background/) &&
          nextState === "active"
        ) {
          void supabase.auth.startAutoRefresh();
        }

        if (nextState.match(/inactive|background/)) {
          void supabase.auth.stopAutoRefresh();
        }

        appStateRef.current = nextState;
      },
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      linkSubscription.remove();
      appStateSubscription.remove();
    };
  }, [hydrateProfile, supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile,
      isLoading,
      isAuthenticated: Boolean(session?.user),
      signInWithGoogle,
      signOut,
      refreshProfile,
    }),
    [isLoading, profile, refreshProfile, session, user],
  );

  if (configError) {
    return (
      <AppConfigErrorScreen
        message={configError}
        onRetry={() => {
          setIsLoading(true);
          initializeSupabase();
        }}
      />
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#F8FAFC",
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
    textAlign: "center",
  },
  errorBody: {
    fontSize: 14,
    lineHeight: 21,
    color: "#334155",
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: "#0F4C81",
    alignItems: "center",
    justifyContent: "center",
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
