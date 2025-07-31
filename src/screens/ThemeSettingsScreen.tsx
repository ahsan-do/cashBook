import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { ThemeMode } from '../types';

interface ThemeSettingsScreenProps {
  navigation: any;
}

export const ThemeSettingsScreen: React.FC<ThemeSettingsScreenProps> = ({ navigation }) => {
  const { theme, themeMode, setThemeMode } = useTheme();
  
  const themeOptions = [
    {
      mode: 'light' as ThemeMode,
      title: 'Light',
      description: 'Always use light theme',
      icon: 'sunny',
    },
    {
      mode: 'dark' as ThemeMode,
      title: 'Dark',
      description: 'Always use dark theme',
      icon: 'moon',
    },
    {
      mode: 'system' as ThemeMode,
      title: 'System Default',
      description: 'Follow your device settings',
      icon: 'settings',
    },
  ];

  const renderThemeOption = (option: typeof themeOptions[0]) => {
    const isSelected = themeMode === option.mode;
    return (
      <TouchableOpacity
        key={option.mode}
        style={[
          styles.themeOption,
          {
            backgroundColor: theme.colors.surface,
            borderColor: isSelected ? theme.colors.primary : theme.colors.border,
          },
        ]}
        onPress={() => setThemeMode(option.mode)}
      >
        <View style={styles.themeOptionContent}>
          <View style={[styles.iconContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Ionicons name={option.icon as any} size={24} color={theme.colors.primary} />
          </View>
          <View style={styles.themeOptionText}>
            <Text style={[styles.themeOptionTitle, { color: theme.colors.text }]}>
              {option.title}
            </Text>
            <Text style={[styles.themeOptionDescription, { color: theme.colors.textSecondary }]}>
              {option.description}
            </Text>
          </View>
          {isSelected && (
            <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Theme Settings</Text>
        <View style={styles.headerSpacer} />
      </View>
      
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Choose Theme</Text>
          <Text style={[styles.sectionDescription, { color: theme.colors.textSecondary }]}>
            Select your preferred theme. The system default will automatically follow your device settings.
          </Text>
        </View>

        <View style={styles.themeOptions}>
          {themeOptions.map(renderThemeOption)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 16,
    lineHeight: 22,
  },
  themeOptions: {
    gap: 12,
  },
  themeOption: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
  },
  themeOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themeOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  themeOptionText: {
    flex: 1,
  },
  themeOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  themeOptionDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  infoSection: {
    marginTop: 32,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 12,
    flex: 1,
  },
}); 