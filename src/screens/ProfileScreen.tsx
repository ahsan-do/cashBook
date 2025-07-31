import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { useTheme } from '../contexts/ThemeContext';
import { CurrencySelector } from '../components/CurrencySelector';
import { groupService } from '../services/groupService';

interface ProfileScreenProps {
  navigation: any;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const { user, firebaseUser, logout, sendEmailVerification } = useAuth();
  const { selectedCurrency, currencies } = useCurrency();
  const { theme, themeMode } = useTheme();
  const [showCurrencySelector, setShowCurrencySelector] = useState(false);
  const [invitationCount, setInvitationCount] = useState(0);
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [isResendingVerification, setIsResendingVerification] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              Alert.alert('Error', 'Failed to logout');
            }
          },
        },
      ]
    );
  };

  const fetchInvitationCount = async () => {
    if (!user?.email) return;
    try {
      setLoadingInvitations(true);
      const invitations = await groupService.getPendingInvitations(user.email);
      setInvitationCount(invitations.length);
    } catch (error: any) {
      console.error('Error fetching invitation count:', error);
    } finally {
      setLoadingInvitations(false);
    }
  };

  useEffect(() => {
    fetchInvitationCount();
  }, [user?.email]);

  const handleResendVerification = async () => {
    setIsResendingVerification(true);
    try {
      await sendEmailVerification();
      Alert.alert(
        'Verification Email Sent',
        'A new verification email has been sent to your inbox. Please check your email and click the verification link.',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      Alert.alert('Error', `Failed to send verification email: ${error.message}`);
    } finally {
      setIsResendingVerification(false);
    }
  };

  const currentCurrency = currencies.find(c => c.code === selectedCurrency);

  const getThemeModeDisplay = () => {
    switch (themeMode) {
      case 'light':
        return 'Light Theme';
      case 'dark':
        return 'Dark Theme';
      case 'system':
        return 'System Default';
      default:
        return 'System Default';
    }
  };

  const menuItems = [
    {
      title: 'Email Verification',
      icon: firebaseUser?.emailVerified ? 'checkmark-circle' : 'mail-unread-outline',
      subtitle: firebaseUser?.emailVerified 
        ? 'Email verified' 
        : 'Email not verified',
      onPress: firebaseUser?.emailVerified 
        ? undefined 
        : handleResendVerification,
      loading: isResendingVerification,
      color: firebaseUser?.emailVerified ? theme.colors.success : theme.colors.error,
    },
    {
      title: 'Theme',
      icon: 'color-palette-outline',
      subtitle: getThemeModeDisplay(),
      onPress: () => navigation.navigate('ThemeSettings'),
    },
    {
      title: 'Currency',
      icon: 'cash-outline',
      subtitle: `${currentCurrency?.symbol} ${currentCurrency?.name}`,
      onPress: () => setShowCurrencySelector(true),
    },
    {
      title: 'Invitations',
      icon: 'mail-outline',
      subtitle: loadingInvitations 
        ? 'Loading...' 
        : invitationCount > 0 
          ? `${invitationCount} pending invitation${invitationCount > 1 ? 's' : ''}` 
          : 'No pending invitations',
      onPress: () => navigation.navigate('Invitations'),
    },
    {
      title: 'Account Settings',
      icon: 'person-outline',
      onPress: () => navigation.navigate('AccountSettings'),
    },
    {
      title: 'Notifications',
      icon: 'notifications-outline',
      onPress: () => Alert.alert('Notifications', 'Notifications settings will be implemented soon.'),
    },
    {
      title: 'Privacy & Security',
      icon: 'shield-outline',
      onPress: () => Alert.alert('Privacy & Security', 'Privacy and security settings will be implemented soon.'),
    },
    {
      title: 'Help & Support',
      icon: 'help-circle-outline',
      onPress: () => Alert.alert('Help & Support', 'Help and support will be implemented soon.'),
    },
    {
      title: 'About',
      icon: 'information-circle-outline',
      onPress: () => Alert.alert('About', 'About page will be implemented soon.'),
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView>
        <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.profileInfo}>
            <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
              <Ionicons name="person" size={40} color={theme.colors.onPrimary} />
            </View>
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: theme.colors.text }]}>{user?.displayName}</Text>
              <Text style={[styles.userEmail, { color: theme.colors.textSecondary }]}>{user?.email}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Settings</Text>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.menuItem,
                {
                  backgroundColor: theme.colors.surface,
                  borderBottomColor: theme.colors.borderLight,
                },
              ]}
              onPress={item.onPress}
              disabled={!item.onPress || item.loading}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons 
                  name={item.icon as any} 
                  size={24} 
                  color={item.color || theme.colors.textSecondary} 
                />
                <View style={styles.menuItemText}>
                  <Text style={[styles.menuItemTitle, { color: theme.colors.text }]}>{item.title}</Text>
                  {item.subtitle && (
                    <Text style={[styles.menuItemSubtitle, { color: theme.colors.textSecondary }]}>{item.subtitle}</Text>
                  )}
                </View>
              </View>
              {item.loading ? (
                <Ionicons name="refresh" size={20} color={theme.colors.textTertiary} />
              ) : item.onPress ? (
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
              ) : null}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <TouchableOpacity 
            style={[
              styles.logoutButton,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.error,
              },
            ]} 
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={24} color={theme.colors.error} />
            <Text style={[styles.logoutText, { color: theme.colors.error }]}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.versionText, { color: theme.colors.textSecondary }]}>Cashbook v1.0.0</Text>
        </View>
      </ScrollView>

      <CurrencySelector
        visible={showCurrencySelector}
        onClose={() => setShowCurrencySelector(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
  },
  section: {
    margin: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemText: {
    marginLeft: 16,
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  menuItemSubtitle: {
    fontSize: 14,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  versionText: {
    fontSize: 14,
  },
}); 