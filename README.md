# Cashbook

Cashbook is an Expo and React Native app for shared cash books. Signed-in users can create books, invite members, and record cash-in and cash-out transactions.

## Stack

- **App:** Expo SDK 53, React Native, TypeScript, React Navigation, and React Context.
- **Authentication:** Supabase Auth with Google OAuth and optional email/password sign-in. Email confirmation is required before book data is available.
- **Data:** Supabase Postgres with Row Level Security. Database RPCs create books with their owner membership, accept and manage invitations, soft-delete records, calculate totals, and page transactions with running balances.
- **Local services:** Supabase CLI and Docker for the local database/API and email testing inbox.

Book and transaction data is loaded through Supabase services. The app does not currently provide real-time synchronization or analytics.

## Requirements

- Node.js and npm
- Docker, running before starting Supabase
- Android Studio/Android SDK and `adb` for Android development
- An Expo account and EAS CLI for cloud development-client builds

## Configure the app

Copy `.env.example` to `.env` and set these variables to your Supabase project or local Supabase instance:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_ENABLE_EMAIL_AUTH` (set to `true` to show email/password sign-in and sign-up; missing or any other value keeps email auth off)

Use only the Supabase anon/publishable key in the app. Never put a `service_role` key in the app or repository.

For Google sign-in, enable Google in Supabase Auth, configure the Google OAuth client credentials, and allow `cashbook://auth/callback` in Supabase Auth's redirect URLs. Set the Google OAuth client's authorized redirect URI to your Supabase project's `/auth/v1/callback` URL.

## Local Supabase

Install Docker, then start the local Supabase stack from the repository root:

```bash
npx supabase start
npx supabase db reset
npx supabase test db
```

`db reset` recreates the local database and applies all migrations. `test db` runs the pgTAP database tests. The local API is available on port `54321`, and the email testing inbox (Mailpit) is available at `http://127.0.0.1:54324`.

Use the API URL and anon key printed by `npx supabase status` in `.env` for local development. Supabase email confirmation links use the app's `cashbook://auth/callback` deep link; configure the corresponding redirect URL in the Supabase Auth URL settings.

## Run on Android

Install JavaScript packages and create/update the local environment file, then connect an Android phone with USB debugging enabled. Forward the local Supabase API, Metro bundler, and Mailpit ports to the phone:

```bash
chmod +x scripts/dev-phone.sh
./scripts/dev-phone.sh
```

The equivalent commands are:

```bash
adb reverse tcp:54321 tcp:54321
adb reverse tcp:8081 tcp:8081
adb reverse tcp:54324 tcp:54324
```

Build and install the native development client, then start Metro in dev-client mode:

```bash
npx expo run:android
npx expo start --dev-client
```

If a development client is already installed, start Metro and open the app. Keep the phone and development machine connected while testing.

For a cloud Android development-client build, configure EAS credentials as prompted and run:

```bash
npx eas-cli build --platform android --profile development
```

Install the resulting build on the device, keep `npx expo start --dev-client` running, and use the same `.env` and port forwarding for local Supabase.

## Tests and type checking

```bash
npx tsc --noEmit
node tests/unit/money.test.mjs
node tests/unit/serviceErrors.test.mjs
npx supabase test db
```

## Repository layout

```text
src/
  contexts/       Auth, currency, and theme state
  navigation/     App navigation
  screens/        React Native screens
  services/       Supabase client, data services, money, and error helpers
  types/          Shared application types
supabase/
  migrations/     Database schema, RLS, and RPC migrations
  tests/          pgTAP database tests
scripts/          Local developer helpers
```
