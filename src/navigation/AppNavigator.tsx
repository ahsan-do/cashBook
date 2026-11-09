import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { LoginScreen } from '../screens/LoginScreen';
import { SignUpScreen } from '../screens/SignUpScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { GroupsScreen } from '../screens/GroupsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { LoadingScreen } from '../screens/LoadingScreen';
import { CreateGroupScreen } from '../screens/CreateGroupScreen';
import { GroupDetailsScreen } from '../screens/GroupDetailsScreen';
import { InvitationsScreen } from '../screens/InvitationsScreen';
import { AccountSettingsScreen } from '../screens/AccountSettingsScreen';
import { EmailVerificationScreen } from '../screens/EmailVerificationScreen';
import { ThemeSettingsScreen } from '../screens/ThemeSettingsScreen';
import { BookMembersScreen } from '../screens/BookMembersScreen';
import { emailAuthEnabled } from '../config/auth';
import { motion } from '../theme/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const TabItem: React.FC<{ route: BottomTabBarProps['state']['routes'][number]; focused: boolean; color: string; navigation: BottomTabBarProps['navigation']; width: number }> = ({ route, focused, color, navigation, width }) => {
  const { theme } = useTheme();
  const reduced = useReducedMotion();
  const iconScale = useRef(new Animated.Value(1)).current;
  const iconName = route.name === 'Home' ? (focused ? 'home' : 'home-outline') : route.name === 'Groups' ? (focused ? 'wallet' : 'wallet-outline') : (focused ? 'person' : 'person-outline');
  const label = route.name === 'Groups' ? 'Books' : route.name;
  useEffect(() => {
    if (reduced) { iconScale.setValue(1); return; }
    if (focused) Animated.sequence([Animated.spring(iconScale, { toValue: 1.16, ...motion.spring, useNativeDriver: true }), Animated.spring(iconScale, { toValue: 1, ...motion.spring, useNativeDriver: true })]).start();
  }, [focused, iconScale, reduced]);
  return <Pressable
    accessibilityRole="tab"
    accessibilityState={{ selected: focused }}
    accessibilityLabel={`${label} tab`}
    onPress={() => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
    }}
    onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
    style={[styles.tabItem, { width }]}
  >
    <Animated.View style={{ transform: [{ scale: iconScale }] }}><Ionicons name={iconName} size={22} color={focused ? theme.colors.onPrimary : color} /></Animated.View>
    <Text style={[styles.tabLabel, { color: focused ? theme.colors.text : color }]}>{label}</Text>
  </Pressable>;
};

const AnimatedTabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [barWidth, setBarWidth] = useState(0);
  const pillX = useRef(new Animated.Value(0)).current;
  const itemWidth = barWidth / Math.max(state.routes.length, 1);
  const targetX = state.index * itemWidth + Math.max(0, (itemWidth - 54) / 2);
  useEffect(() => {
    if (!barWidth) return;
    if (reduced) { pillX.setValue(targetX); return; }
    Animated.spring(pillX, { toValue: targetX, ...motion.spring, useNativeDriver: true }).start();
  }, [barWidth, targetX, pillX, reduced]);
  return <View onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)} style={[styles.tabBar, { height: 62 + insets.bottom, paddingBottom: Math.max(4, insets.bottom), backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
    {barWidth > 0 && <Animated.View pointerEvents="none" style={[styles.activePill, { backgroundColor: theme.colors.primary, transform: [{ translateX: pillX }] }]} />}
    <View style={styles.tabRow}>{state.routes.map((route, index) => {
      const focused = state.index === index;
      const color = focused ? theme.colors.text : theme.colors.textSecondary;
      return <TabItem key={route.key} route={route} focused={focused} color={color} navigation={navigation} width={itemWidth} />;
    })}</View>
  </View>;
};

const AuthStack: React.FC<{ initialRouteName: string }> = ({ initialRouteName }) => (
  <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    {emailAuthEnabled && <Stack.Screen name="SignUp" component={SignUpScreen} />}
    <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
  </Stack.Navigator>
);

const VerificationStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
  </Stack.Navigator>
);

const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <AnimatedTabBar {...props} />}
      screenOptions={({ route }) => ({
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Groups" component={GroupsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 4 },
  tabRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  activePill: { position: 'absolute', top: 4, left: 0, width: 54, height: 30, borderRadius: 15 },
  tabItem: { height: 52, alignItems: 'center', justifyContent: 'center', gap: 1 },
  tabLabel: { fontSize: 11, fontWeight: '600' },
});

const MainStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="MainTabs" component={MainTabNavigator} />
    <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
    <Stack.Screen name="GroupDetails" component={GroupDetailsScreen} />
    <Stack.Screen name="BookMembers" component={BookMembersScreen} />
    <Stack.Screen name="Invitations" component={InvitationsScreen} />
    <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
    <Stack.Screen name="ThemeSettings" component={ThemeSettingsScreen} />
  </Stack.Navigator>
);

export const AppNavigator = () => {
  const { session, isEmailVerified, authInitializing, authLinkMessage } = useAuth();
  const { theme } = useTheme();
  const [startupVisible, setStartupVisible] = useState(false);
  const startupShownAt = useRef<number | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (authInitializing && !startupVisible) {
      timer = setTimeout(() => {
        startupShownAt.current = Date.now();
        setStartupVisible(true);
      }, 120);
    } else if (!authInitializing && startupVisible) {
      const elapsed = startupShownAt.current === null ? 400 : Date.now() - startupShownAt.current;
      timer = setTimeout(() => {
        startupShownAt.current = null;
        setStartupVisible(false);
      }, Math.max(0, 400 - elapsed));
    }
    return () => { if (timer) clearTimeout(timer); };
  }, [authInitializing, startupVisible]);

  if (authInitializing || startupVisible) {
    return startupVisible
      ? <LoadingScreen />
      : <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  }

  return (
    <NavigationContainer>
      {session && isEmailVerified ? (
        <MainStack />
      ) : session ? (
        <VerificationStack />
      ) : (
        <AuthStack
          key={authLinkMessage ? 'auth-link-error' : 'signed-out'}
          initialRouteName={authLinkMessage ? 'EmailVerification' : 'Login'}
        />
      )}
    </NavigationContainer>
  );
};
