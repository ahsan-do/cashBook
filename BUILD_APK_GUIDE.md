# Building Android APK for Cashbook App

This guide will help you build an Android APK for your Cashbook app using Expo EAS Build.

## 🚀 Prerequisites

### 1. Expo Account
- Create an account at [expo.dev](https://expo.dev)
- Install EAS CLI: `npm install -g eas-cli`

### 2. Firebase Configuration
- Ensure your Firebase project is properly configured
- Update `src/services/firebase.ts` with your Firebase config
- Set up Firestore security rules (see `UPDATED_FIRESTORE_RULES.md`)

### 3. App Configuration
- Update `app.json` with your details (see below)
- Ensure all assets are in the `assets/` folder

## ⚙️ Configuration Setup

### 1. Update app.json
Replace the placeholder values in `app.json`:

```json
{
  "expo": {
    "name": "Cashbook",
    "slug": "cashbook",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/splash-icon.jpg",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.yourcompany.cashbook"
    },
    "android": {
      "package": "com.yourcompany.cashbook",
      "versionCode": 1,
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "edgeToEdgeEnabled": true,
      "permissions": [
        "INTERNET",
        "ACCESS_NETWORK_STATE"
      ]
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "extra": {
      "eas": {
        "projectId": "your-actual-project-id"
      }
    },
    "owner": "your-actual-expo-username"
  }
}
```

### 2. Required Assets
Ensure these files exist in your `assets/` folder:
- `icon.png` (1024x1024)
- `adaptive-icon.png` (1024x1024)
- `splash-icon.jpg` (1242x2436)
- `favicon.png` (48x48)

## 🔧 Build Process

### Step 1: Login to Expo
```bash
eas login
```

### Step 2: Configure EAS Build
```bash
eas build:configure
```

### Step 3: Build APK (Development/Testing)
```bash
eas build --platform android --profile preview
```

### Step 4: Build AAB (Production/Play Store)
```bash
eas build --platform android --profile production
```

## 📱 Build Profiles

### Preview Profile (APK)
- **Purpose**: Testing and development
- **Format**: APK file
- **Distribution**: Direct installation
- **Use Case**: Share with testers, install directly on devices

### Production Profile (AAB)
- **Purpose**: Google Play Store release
- **Format**: Android App Bundle (AAB)
- **Distribution**: Google Play Store
- **Use Case**: Official app store release

## 🎯 Build Commands

### Quick APK Build
```bash
# Build APK for testing
eas build --platform android --profile preview --local
```

### Production Build
```bash
# Build AAB for Play Store
eas build --platform android --profile production
```

### Development Build
```bash
# Build with development client
eas build --platform android --profile development
```

## 📋 Build Configuration

### eas.json (Already Created)
```json
{
  "cli": {
    "version": ">= 5.9.1"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "aab"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

## 🔍 Troubleshooting

### Common Issues:

#### 1. "Missing or insufficient permissions"
- **Solution**: Update Firestore security rules (see `UPDATED_FIRESTORE_RULES.md`)
- **Temporary Fix**: Use permissive rules for testing

#### 2. "Build failed"
- **Check**: Firebase configuration in `src/services/firebase.ts`
- **Check**: All required assets exist in `assets/` folder
- **Check**: app.json configuration is correct

#### 3. "Authentication failed"
- **Solution**: Run `eas login` and authenticate
- **Check**: Expo account has proper permissions

#### 4. "Package name already exists"
- **Solution**: Change `package` in app.json to unique name
- **Example**: `com.yourname.cashbook` or `com.yourcompany.cashbookapp`

## 📦 Build Output

### APK File Location
- **Cloud Build**: Download link provided after build completion
- **Local Build**: `android/app/build/outputs/apk/`

### AAB File Location
- **Cloud Build**: Download link provided after build completion
- **Local Build**: `android/app/build/outputs/bundle/`

## 🚀 Deployment Options

### 1. Direct APK Installation
- Download APK from build link
- Enable "Install from unknown sources" on Android device
- Install APK directly

### 2. Google Play Store
- Upload AAB file to Google Play Console
- Configure store listing
- Submit for review

### 3. Internal Testing
- Use Google Play Console internal testing
- Share with specific testers
- No review required

## 🔒 Security Considerations

### Before Production Release:
1. **Firebase Rules**: Apply secure Firestore rules
2. **API Keys**: Ensure Firebase config is production-ready
3. **Permissions**: Review Android permissions
4. **Testing**: Test all features thoroughly

### Production Checklist:
- [ ] Firebase project configured for production
- [ ] Firestore security rules applied
- [ ] Email verification enabled
- [ ] All features tested
- [ ] App icons and splash screen ready
- [ ] Privacy policy and terms of service (if required)

## 📞 Support

### Expo Documentation:
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Android Build Guide](https://docs.expo.dev/build-reference/android-builds/)

### Firebase Documentation:
- [Firebase Console](https://console.firebase.google.com/)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)

## 🎉 Next Steps

After successful build:
1. **Test APK**: Install on Android device and test all features
2. **Fix Issues**: Address any bugs or problems found
3. **Iterate**: Make improvements and rebuild
4. **Release**: Deploy to Google Play Store or distribute APK

Your Cashbook app is now ready for Android deployment! 🚀 