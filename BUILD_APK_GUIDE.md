# Android development-client builds

Cashbook uses Expo and Supabase. Configure the app's Supabase URL and anon key in `.env` before building. See [README.md](README.md) for local Supabase setup and physical-phone port forwarding.

## Local development build

With Android Studio/SDK installed and a USB-debugging-enabled phone connected:

```bash
./scripts/dev-phone.sh
npx expo run:android
npx expo start --dev-client
```

`expo run:android` builds and installs the native development client. If you already installed it, run only the port-forwarding helper and start Metro.

## EAS development build

Install or invoke EAS CLI, then build with the development profile:

```bash
npx eas-cli build --platform android --profile development
```

Install the generated build on the phone. Start Metro with `npx expo start --dev-client`; for a local Supabase stack, also forward ports `54321`, `8081`, and `54324` with `./scripts/dev-phone.sh`.

## Release builds

The `preview` profile creates an installable APK, while `production` creates an Android App Bundle:

```bash
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform android --profile production
```

Review the app identifiers, signing credentials, assets, and privacy requirements before distributing a release build.
