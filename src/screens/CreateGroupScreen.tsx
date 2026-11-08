import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { bookService } from '../services/bookService';
import { useDialog } from '../contexts/DialogContext';
import Toast from 'react-native-toast-message';

interface CreateGroupScreenProps {
  navigation: any;
}

export const CreateGroupScreen: React.FC<CreateGroupScreenProps> = ({ navigation }) => {
  const { theme } = useTheme();
  const dialog = useDialog();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currencyCode, setCurrencyCode] = useState('PKR');
  const [loading, setLoading] = useState(false);
  const currencies = ['PKR', 'USD', 'EUR', 'GBP', 'AED', 'SAR'];

  const handleCreateGroup = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      void dialog.notify({ title: 'Error', message: 'Please enter a book name.' });
      return;
    }

    setLoading(true);
    try {
      await bookService.createBook({
        name: trimmedName,
        currencyCode,
        description: description.trim() || null,
      });

      Toast.show({ type: 'success', text1: 'Success', text2: 'Book created successfully!' });
      navigation.goBack();
    } catch (error: any) {
      void dialog.notify({ title: 'Error', message: error?.message || 'Could not create book. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.text }]}>Create New Book</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              Set up a book to start tracking cash in and cash out
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Book Name *</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                  },
                ]}
                placeholder="e.g., Home, Shop, Personal"
                placeholderTextColor={theme.colors.textTertiary}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Currency</Text>
              <View style={styles.currencyOptions}>
                {currencies.map((code) => {
                  const selected = currencyCode === code;
                  return (
                    <TouchableOpacity
                      key={code}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      style={[
                        styles.currencyOption,
                        {
                          backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
                          borderColor: selected ? theme.colors.primary : theme.colors.border,
                        },
                      ]}
                      onPress={() => setCurrencyCode(code)}
                    >
                      <Text style={{ color: selected ? theme.colors.onPrimary : theme.colors.text }}>{code}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Description</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                  },
                ]}
                placeholder="Describe the purpose of this book"
                placeholderTextColor={theme.colors.textTertiary}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.createButton,
                {
                  backgroundColor: theme.colors.primary,
                  opacity: loading ? 0.6 : 1,
                },
              ]}
              onPress={handleCreateGroup}
              disabled={loading}
            >
              <Text style={[styles.createButtonText, { color: theme.colors.onPrimary }]}>
                {loading ? 'Creating...' : 'Create Book'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  form: {
    gap: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  currencyOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  currencyOption: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 64,
    alignItems: 'center',
  },
  label: {
    marginBottom: 8,
    fontWeight: '500',
    fontSize: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  createButton: {
    paddingVertical: 16,
    borderRadius: 8,
    marginTop: 24,
  },
  createButtonText: {
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 18,
  },
});
