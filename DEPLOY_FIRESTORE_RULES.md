# Deploy Firestore Rules to Fix User Name Display

## Issue
The Groups screen is showing userId instead of user names in the entry cards because the Firestore rules prevent reading other users' documents.

## Solution
The Firestore rules have been updated to allow reading user documents for display names. You need to deploy these rules to Firebase.

## How to Deploy

### Option 1: Firebase Console (Recommended)
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (cashbook-bfeb4)
3. Go to Firestore Database
4. Click on the "Rules" tab
5. Replace the existing rules with the content from `firestore.rules`
6. Click "Publish"

### Option 2: Firebase CLI
If you have Firebase CLI installed:
```bash
firebase deploy --only firestore:rules
```

### Option 3: Using npx
```bash
npx firebase deploy --only firestore:rules
```

## Updated Rules
The key change is in the users collection rules:
```javascript
// Before: Users could only read their own document
match /users/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}

// After: Users can read any user document (for display names)
match /users/{userId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && request.auth.uid == userId;
}
```

## What This Fixes
- The `getUserDisplayNames` function can now read other users' documents
- Expense cards will show user names instead of userId
- Only basic user information (displayName, email) is exposed, maintaining security

## Testing
After deploying the rules:
1. Open the app
2. Go to a group with expenses
3. Check that expense cards show user names instead of userId
4. Verify that the "Entered by [Name]" text shows actual names 