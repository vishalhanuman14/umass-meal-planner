import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { AuthProvider, useAuth } from "./src/contexts/AuthContext";
import { ProfileProvider, useProfile } from "./src/contexts/ProfileContext";
import SignInScreen from "./src/screens/SignInScreen";
import BodyStatsScreen from "./src/screens/onboarding/BodyStatsScreen";
import GoalsScreen from "./src/screens/onboarding/GoalsScreen";
import PreferencesScreen from "./src/screens/onboarding/PreferencesScreen";
import HomeScreen from "./src/screens/HomeScreen";
import ChatScreen from "./src/screens/ChatScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import { colors } from "./src/theme";
import type {
  AuthStackParamList,
  MainStackParamList,
  OnboardingStackParamList
} from "./src/types";

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface,
    primary: colors.amber,
    text: colors.text,
    border: colors.border
  }
};

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="SignIn" component={SignInScreen} />
    </AuthStack.Navigator>
  );
}

function OnboardingNavigator() {
  return (
    <OnboardingStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background }
      }}
    >
      <OnboardingStack.Screen name="BodyStats" component={BodyStatsScreen} options={{ title: "Profile" }} />
      <OnboardingStack.Screen name="Goals" component={GoalsScreen} options={{ title: "Goals" }} />
      <OnboardingStack.Screen name="Preferences" component={PreferencesScreen} options={{ title: "Preferences" }} />
    </OnboardingStack.Navigator>
  );
}

function MainNavigator() {
  return (
    <MainStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background }
      }}
    >
      <MainStack.Screen name="Home" component={HomeScreen} options={{ title: "Today" }} />
      <MainStack.Screen name="Chat" component={ChatScreen} options={{ title: "Ask" }} />
      <MainStack.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings" }} />
    </MainStack.Navigator>
  );
}

function RootNavigator() {
  const { session, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();

  if (authLoading || (session && profileLoading)) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.amber} />
      </View>
    );
  }

  if (!session) {
    return <AuthNavigator />;
  }

  if (!profile?.onboarding_completed) {
    return <OnboardingNavigator />;
  }

  return <MainNavigator />;
}

export default function App() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <NavigationContainer theme={theme}>
          <StatusBar style="light" />
          <RootNavigator />
        </NavigationContainer>
      </ProfileProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background
  }
});
