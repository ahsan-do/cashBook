# Updated Firestore Security Rules

## 🔧 Problem
The current security rules are causing "missing or insufficient permissions" error during signup because they're too restrictive for the initial user document creation.

## ✅ Solution
Here are the updated Firestore security rules that will fix the signup issue:

## 📋 Updated Security Rules

Copy and paste these rules in your Firebase Console:

### Go to Firebase Console:
1. **Firebase Console** → Your Project
2. **Firestore Database** → **Rules** tab
3. Replace the existing rules with the following:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own user document
    // Allow creation during signup and updates after authentication
    match /users/{userId} {
      allow create: if request.auth != null && request.auth.uid == userId;
      allow read, update: if request.auth != null && request.auth.uid == userId;
    }
    
    // Users can read/write groups they are members of
    match /groups/{groupId} {
      allow create: if request.auth != null && 
        request.auth.uid in request.resource.data.members;
      allow read, update, delete: if request.auth != null && 
        request.auth.uid in resource.data.members;
    }
    
    // Users can read/write expenses in groups they are members of
    match /expenses/{expenseId} {
      allow create: if request.auth != null && 
        request.auth.uid in get(/databases/$(database)/documents/groups/$(request.resource.data.groupId)).data.members;
      allow read, update, delete: if request.auth != null && 
        request.auth.uid in get(/databases/$(database)/documents/groups/$(resource.data.groupId)).data.members;
    }
    
    // Users can read/write invitations they created or are invited to
    match /groupInvitations/{invitationId} {
      allow create: if request.auth != null && 
        request.auth.uid == request.resource.data.invitedBy;
      allow read, update: if request.auth != null && 
        (request.auth.uid == resource.data.invitedBy || 
         request.auth.token.email == resource.data.invitedEmail);
    }
  }
}
```

## 🔍 Key Changes Made:

### 1. **User Document Creation**:
- **Before**: Required user to already exist
- **After**: Allows creation during signup with `request.auth.uid == userId`

### 2. **Group Creation**:
- **Before**: Required user to be in existing members list
- **After**: Allows creation if user is in the initial members list

### 3. **Expense Creation**:
- **Before**: Required group to exist with user as member
- **After**: Allows creation if user is in the group's members list

### 4. **Invitation Creation**:
- **Before**: Required existing invitation
- **After**: Allows creation by the inviter

## 🚀 How to Apply:

### Step 1: Access Firestore Rules
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click **"Firestore Database"** in the left sidebar
4. Click the **"Rules"** tab

### Step 2: Update Rules
1. Delete all existing rules
2. Copy and paste the updated rules above
3. Click **"Publish"**

### Step 3: Test
1. Try signing up with a new email
2. The signup should now work without permission errors
3. User document should be created successfully

## 🔒 Security Features:

### ✅ **User Security**:
- Users can only access their own user document
- User document creation is restricted to authenticated users
- User ID must match the document ID

### ✅ **Group Security**:
- Users can only access groups they're members of
- Group creation requires user to be in initial members list
- Group updates require existing membership

### ✅ **Expense Security**:
- Users can only access expenses in groups they're members of
- Expense creation requires group membership
- Expense updates require existing group membership

### ✅ **Invitation Security**:
- Users can only create invitations for themselves
- Users can only read invitations they created or are invited to
- Email verification for invitation access

## 🧪 Testing the Rules:

### Test Cases:
1. **✅ Sign Up**: New user should be able to create account
2. **✅ Create Group**: User should be able to create groups
3. **✅ Add Expenses**: User should be able to add expenses to their groups
4. **✅ Invite Users**: User should be able to send invitations
5. **❌ Access Others' Data**: User should NOT be able to access other users' data

### Common Issues:
- **"Missing or insufficient permissions"**: Rules are too restrictive
- **"Permission denied"**: User not authenticated or not authorized
- **"Document does not exist"**: Trying to access non-existent document

## 🔄 Alternative Rules (More Permissive for Testing):

If you're still having issues, you can temporarily use these more permissive rules for testing:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow all authenticated users to read/write all documents
    // WARNING: This is for testing only, not for production!
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**⚠️ Warning**: The alternative rules above are for testing only. They allow any authenticated user to access any document. Use them temporarily to test your app, then switch back to the secure rules above.

## 📞 Need Help?

If you're still experiencing issues:
1. Check Firebase Console for specific error messages
2. Verify your Firebase configuration in `src/services/firebase.ts`
3. Ensure Authentication is enabled in Firebase Console
4. Check that your project has the correct permissions

The updated rules should resolve the signup permission issue while maintaining proper security for your app! 