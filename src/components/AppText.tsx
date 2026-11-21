import React, { createContext, useContext } from 'react';
import { StyleSheet, Text as NativeText, TextInput as NativeTextInput, TextInputProps, TextProps, TextStyle } from 'react-native';
import { fontFaceForWeight } from '../theme/typography';

const FontLoadedContext = createContext(false);

export const AppTextProvider: React.FC<{ loaded: boolean; children: React.ReactNode }> = ({ loaded, children }) => (
  <FontLoadedContext.Provider value={loaded}>{children}</FontLoadedContext.Provider>
);

export const AppText: React.FC<TextProps> = ({ style, ...props }) => {
  const fontLoaded = useContext(FontLoadedContext);
  const flattened = StyleSheet.flatten(style) as TextStyle | undefined;
  const fontFamily = fontLoaded ? fontFaceForWeight(flattened?.fontWeight) : undefined;
  return <NativeText {...props} style={[style, fontFamily ? { fontFamily } : undefined]} />;
};

export const AppTextInput = React.forwardRef<NativeTextInput, TextInputProps>(({ style, ...props }, ref) => {
  const fontLoaded = useContext(FontLoadedContext);
  return <NativeTextInput ref={ref} {...props} style={[style, fontLoaded ? { fontFamily: fontFaceForWeight('400') } : undefined]} />;
});
