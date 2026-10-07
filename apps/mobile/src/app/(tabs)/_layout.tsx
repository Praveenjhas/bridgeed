import { StyleSheet, type ColorValue } from "react-native";
import { Tabs } from "expo-router/js-tabs";
import { Icon, type IconName } from "@/components";
import { useTheme } from "@/theme";

const TAB_ICON_SIZE = 22;

/**
 * Tab options are built from a name and a pair of icons, so every tab is
 * described in one place and the icon color always follows the navigator's
 * active and inactive tints.
 */
function tabOptions(title: string, icon: IconName, activeIcon: IconName) {
  return {
    title,
    tabBarIcon: ({
      color,
      focused,
    }: {
      color: ColorValue;
      focused: boolean;
      size: number;
    }) => (
      <Icon
        name={focused ? activeIcon : icon}
        color={color}
        size={TAB_ICON_SIZE}
      />
    ),
  };
}

/**
 * The tab shell.
 *
 * It uses the JavaScript tabs navigator rather than the native one so the bar
 * looks identical on both platforms and works in Expo Go, which matters while
 * the visual language is still being settled.
 */
export default function TabsLayout() {
  const { colors, typography } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        tabBarLabelStyle: typography.caption,
      }}
    >
      <Tabs.Screen
        name="index"
        options={tabOptions("Feed", "home-outline", "home")}
      />
      <Tabs.Screen
        name="communities"
        options={tabOptions("Communities", "people-outline", "people")}
      />
      <Tabs.Screen
        name="connections"
        options={tabOptions("Students", "git-network-outline", "git-network")}
      />
      <Tabs.Screen
        name="profile"
        options={tabOptions(
          "Profile",
          "person-circle-outline",
          "person-circle",
        )}
      />
    </Tabs>
  );
}
