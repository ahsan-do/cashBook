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
  const styles = makeStyles(theme);

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
            <Ionicons name={option.icon as any} size={24} color={theme.colors.primaryVariant} />
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
            <Ionicons name="checkmark-circle" size={24} color={theme.colors.primaryVariant} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back">
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

const makeStyles = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    minWidth: 48,
    minHeight: 48,
    marginRight: theme.spacing.sm,
  },
  headerTitle: {
    fontSize: theme.typeSize.subtitle,
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
    padding: theme.spacing.xl,
  },
  section: {
    marginBottom: theme.spacing.xxl,
  },
  sectionTitle: {
    fontSize: theme.typeSize.title,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
  },
  sectionDescription: {
    fontSize: theme.typeSize.body,
    lineHeight: 22,
  },
  themeOptions: {
    gap: theme.spacing.md,
  },
  themeOption: {
    borderRadius: theme.radius.md,
    borderWidth: 2,
    padding: theme.spacing.lg,
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
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.lg,
  },
  themeOptionText: {
    flex: 1,
  },
  themeOptionTitle: {
    fontSize: theme.typeSize.body,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  themeOptionDescription: {
    fontSize: theme.typeSize.small,
    lineHeight: 20,
  },
  infoSection: {
    marginTop: theme.spacing.xxxl,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: theme.spacing.lg,
    borderRadius: theme.radius.md,
    borderWidth: 1,
  },
  infoText: {
    fontSize: theme.typeSize.small,
    lineHeight: 20,
    marginLeft: theme.spacing.md,
    flex: 1,
  },
});
