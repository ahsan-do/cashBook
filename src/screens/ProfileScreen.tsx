import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { useTheme } from '../contexts/ThemeContext';
import { CurrencySelector } from '../components/CurrencySelector';
import { invitationService } from '../services/invitationService';
import { useDialog } from '../contexts/DialogContext';
import Toast from 'react-native-toast-message';

interface ProfileScreenProps {
  navigation: any;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const { user, isEmailVerified, logout, sendEmailVerification } = useAuth();
  const { selectedCurrency, currencies } = useCurrency();
  const { theme, themeMode } = useTheme();
  const dialog = useDialog();
  const styles = makeStyles(theme);
  const [showCurrencySelector, setShowCurrencySelector] = useState(false);
  const [invitationCount, setInvitationCount] = useState(0);
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [isResendingVerification, setIsResendingVerification] = useState(false);

  const handleLogout = async () => {
    if (!await dialog.confirm({ title: 'Logout', message: 'Are you sure you want to logout?', cancelLabel: 'Cancel', confirmLabel: 'Logout', destructive: true })) return;
    try { await logout(); } catch (error) { void dialog.notify({ title: 'Error', message: 'Failed to logout' }); }
  };

  const fetchInvitationCount = async () => {
    if (!user?.id) return;
    try {
      setLoadingInvitations(true);
      const invitations = await invitationService.listMyPendingInvitations();
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
      Toast.show({ type: 'success', text1: 'Verification Email Sent', text2: 'A new verification email has been sent to your inbox. Please check your email and click the verification link.' });
    } catch (error: any) {
      void dialog.notify({ title: 'Error', message: `Failed to send verification email: ${error.message}` });
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
      icon: isEmailVerified ? 'checkmark-circle' : 'mail-unread-outline',
      subtitle: isEmailVerified
        ? 'Email verified' 
        : 'Email not verified',
      onPress: isEmailVerified
        ? undefined 
        : handleResendVerification,
      loading: isResendingVerification,
      color: isEmailVerified ? theme.colors.success : theme.colors.error,
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
      onPress: () => Toast.show({ type: 'info', text1: 'Notifications', text2: 'Notifications settings will be implemented soon.' }),
    },
    {
      title: 'Privacy & Security',
      icon: 'shield-outline',
      onPress: () => Toast.show({ type: 'info', text1: 'Privacy & Security', text2: 'Privacy and security settings will be implemented soon.' }),
    },
    {
      title: 'Help & Support',
      icon: 'help-circle-outline',
      onPress: () => Toast.show({ type: 'info', text1: 'Help & Support', text2: 'Help and support will be implemented soon.' }),
    },
    {
      title: 'About',
      icon: 'information-circle-outline',
      onPress: () => Toast.show({ type: 'info', text1: 'About', text2: 'About page will be implemented soon.' }),
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

const makeStyles = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: theme.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.lg,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: theme.typeSize.title,
    fontWeight: 'bold',
    marginBottom: theme.spacing.xs,
  },
  userEmail: {
    fontSize: theme.typeSize.body,
  },
  section: {
    margin: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.typeSize.subtitle,
    fontWeight: '600',
    marginBottom: theme.spacing.lg,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 60,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: 1,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemText: {
    marginLeft: theme.spacing.lg,
    flex: 1,
  },
  menuItemTitle: {
    fontSize: theme.typeSize.body,
    fontWeight: '500',
    marginBottom: theme.spacing.xxs,
  },
  menuItemSubtitle: {
    fontSize: theme.typeSize.small,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
  },
  logoutText: {
    fontSize: theme.typeSize.body,
    fontWeight: '600',
    marginLeft: theme.spacing.sm,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  versionText: {
    fontSize: theme.typeSize.small,
  },
});
