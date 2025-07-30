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
import { CurrencySelector } from '../components/CurrencySelector';
import { groupService } from '../services/groupService';

interface ProfileScreenProps {
  navigation: any;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const { user, firebaseUser, logout, sendEmailVerification } = useAuth();
  const { selectedCurrency, currencies } = useCurrency();
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
      color: firebaseUser?.emailVerified ? '#059669' : '#dc2626',
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
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <View style={styles.profileInfo}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={40} color="#ffffff" />
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user?.displayName}</Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={item.onPress}
              disabled={!item.onPress || item.loading}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons 
                  name={item.icon as any} 
                  size={24} 
                  color={item.color || "#6b7280"} 
                />
                <View style={styles.menuItemText}>
                  <Text style={styles.menuItemTitle}>{item.title}</Text>
                  {item.subtitle && (
                    <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
                  )}
                </View>
              </View>
              {item.loading ? (
                <Ionicons name="refresh" size={20} color="#9ca3af" />
              ) : item.onPress ? (
                <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
              ) : null}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#dc2626" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.versionText}>Cashbook v1.0.0</Text>
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
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#ffffff',
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
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#6b7280',
  },
  section: {
    backgroundColor: '#ffffff',
    marginTop: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    padding: 20,
    paddingBottom: 10,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemText: {
    marginLeft: 12,
  },
  menuItemTitle: {
    fontSize: 16,
    color: '#1f2937',
  },
  menuItemSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  logoutText: {
    fontSize: 16,
    color: '#dc2626',
    marginLeft: 12,
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    padding: 20,
  },
  versionText: {
    fontSize: 14,
    color: '#9ca3af',
  },
}); 