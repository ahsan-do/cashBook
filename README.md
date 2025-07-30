# Cashbook - React Native Expense Tracker

A collaborative expense tracking app built with React Native, Expo, and Firebase. Users can create groups, set budgets, track expenses, and invite others to collaborate on expense management.

## Features

- 🔐 **Authentication**: Email/password authentication with Firebase
- 👥 **Group Management**: Create and manage expense groups
- 💰 **Expense Tracking**: Add and track expenses in groups
- 📊 **Expense Tracking**: Add and categorize expenses
- 🤝 **Collaboration**: Invite users to groups for shared expense tracking
- 📱 **Real-time Updates**: Live synchronization across devices
- 🎨 **Modern UI**: Clean and intuitive user interface

## Tech Stack

- **Frontend**: React Native with Expo
- **Backend**: Firebase (Authentication, Firestore)
- **Styling**: React Native StyleSheet (NativeWind setup included)
- **Navigation**: React Navigation v6
- **State Management**: React Context API
- **Icons**: Expo Vector Icons

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI
- Firebase account

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd cashBook
npm install
```

### 2. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable Authentication with Email/Password
4. Create a Firestore database
5. Get your Firebase configuration

### 3. Configure Firebase

Update `src/services/firebase.ts` with your Firebase configuration:

```typescript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};
```

### 4. Firestore Security Rules

Set up the following security rules in your Firestore database:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Users can read/write groups they are members of
    match /groups/{groupId} {
      allow read, write: if request.auth != null && 
        request.auth.uid in resource.data.members;
    }
    
    // Users can read/write expenses in groups they are members of
    match /expenses/{expenseId} {
      allow read, write: if request.auth != null && 
        request.auth.uid in get(/databases/$(database)/documents/groups/$(resource.data.groupId)).data.members;
    }
    
    // Users can read/write invitations they created or are invited to
    match /groupInvitations/{invitationId} {
      allow read, write: if request.auth != null && 
        (request.auth.uid == resource.data.invitedBy || 
         request.auth.token.email == resource.data.invitedEmail);
    }
  }
}
```

### 5. Run the App

```bash
# Start the development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run on web
npm run web
```

## Project Structure

```
src/
├── components/          # Reusable UI components
├── contexts/           # React Context providers
├── hooks/              # Custom React hooks
├── navigation/         # Navigation configuration
├── screens/            # App screens
├── services/           # Firebase and API services
├── types/              # TypeScript type definitions
└── utils/              # Utility functions
```

## Database Schema

### Users Collection
```typescript
{
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: Date;
}
```

### Groups Collection
```typescript
{
  id: string;
  name: string;
  description?: string;
  currency: string;
  createdBy: string;
  members: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

### Expenses Collection
```typescript
{
  id: string;
  groupId: string;
  title: string;
  amount: number;
  category: string;
  description?: string;
  paidBy: string;
  splitBetween: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

### Group Invitations Collection
```typescript
{
  id: string;
  groupId: string;
  invitedBy: string;
  invitedEmail: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
  expiresAt: Date;
}
```

## Key Features Implementation

### Authentication Flow
- Email/password registration and login
- Persistent authentication state
- Protected routes based on authentication status

### Group Management
- Create groups for expense tracking
- Invite users via email
- Manage group members
- Real-time group updates

### Expense Tracking
- Add expenses with categories
- Split expenses between group members
- Track spending and balances
- View expense history and analytics

### Real-time Collaboration
- Live updates when expenses are added/modified
- Group member notifications
- Shared expense summaries

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support, email support@cashbook.com or create an issue in the repository. 