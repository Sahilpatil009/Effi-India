import { Redirect, Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { registerGlobals } from "@livekit/react-native";
import { StyleSheet, Text, View } from "react-native";
import { AuthProvider } from "../providers/auth-provider";
import { useAuth } from "../hooks/useAuth";
import { LoadingScreen } from "../components/loading-screen";

let startupError: string | null = null;

try {
  registerGlobals();
} catch (error) {
  startupError =
    error instanceof Error
      ? error.message
      : "Failed to initialize LiveKit globals.";
}

function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();

  if (isLoading) {
    return <LoadingScreen label="Checking your session..." />;
  }

  const inLogin = segments[0] === "login";

  if (!isAuthenticated && !inLogin) {
    return <Redirect href="/login" />;
  }

  if (isAuthenticated && inLogin) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#F8FAFC" },
      }}
    >
      <Stack.Screen
        name="(tabs)"
        options={{ title: "Home", headerShown: false }}
      />
      <Stack.Screen
        name="call"
        options={{
          title: "Voice Chat",
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="login"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  if (startupError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>App startup issue</Text>
        <Text style={styles.errorBody}>{startupError}</Text>
      </View>
    );
  }

  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </AuthProvider>
  );
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
  },
});
