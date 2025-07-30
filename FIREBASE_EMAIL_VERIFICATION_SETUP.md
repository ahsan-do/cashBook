# Firebase Email Verification Setup Guide

This guide will help you enable and configure email verification in your Firebase project for the Cashbook app.

## 🔧 Step 1: Enable Email Verification in Firebase Console

### 1.1 Access Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (cashbook)

### 1.2 Navigate to Authentication Settings
1. In the left sidebar, click on **"Authentication"**
2. Click on the **"Settings"** tab (gear icon)
3. Scroll down to find **"User actions"** section

### 1.3 Enable Email Verification
1. Find **"Email verification"** option
2. **Enable** the toggle switch
3. This will automatically send verification emails when users sign up

## 📧 Step 2: Configure Email Templates (Optional)

### 2.1 Customize Email Templates
1. In Authentication Settings, scroll to **"Email templates"** section
2. Click on **"Verification email"**
3. You can customize:
   - **Subject line**: Default is "Verify your email address"
   - **Email content**: HTML and text versions
   - **Sender name**: Default is "Firebase"
   - **Reply-to address**: Optional

### 2.2 Recommended Email Template Customization
```
Subject: Verify your Cashbook account

HTML Content:
<h2>Welcome to Cashbook!</h2>
<p>Please verify your email address to complete your account setup.</p>
<p>Click the button below to verify your email:</p>
[VERIFICATION_LINK_BUTTON]
<p>If the button doesn't work, copy and paste this link into your browser:</p>
<p>[VERIFICATION_LINK]</p>
<p>Thanks,<br>The Cashbook Team</p>
```

## 🔒 Step 3: Configure Security Rules (Optional)

### 3.1 Firestore Security Rules
You can add email verification checks to your Firestore security rules:

```javascript
// In Firestore Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write only if user is authenticated and email is verified
    match /users/{userId} {
      allow read, write: if request.auth != null 
        && request.auth.uid == userId 
        && request.auth.token.email_verified == true;
    }
    
    // Allow group access only for verified users
    match /groups/{groupId} {
      allow read, write: if request.auth != null 
        && request.auth.token.email_verified == true;
    }
    
    // Allow expense access only for verified users
    match /expenses/{expenseId} {
      allow read, write: if request.auth != null 
        && request.auth.token.email_verified == true;
    }
  }
}
```

## 📱 Step 4: App Integration

### 4.1 How It Works in the App
1. **Sign Up Flow**:
   - User creates account
   - Verification email is automatically sent
   - User is redirected to EmailVerificationScreen
   - User can check verification status or resend email

2. **Profile Screen**:
   - Shows email verification status
   - Unverified users can resend verification email
   - Verified users see green checkmark

3. **Verification Process**:
   - User clicks link in email
   - Firebase marks email as verified
   - App automatically detects verification
   - User can access full app features

## 🚀 Step 5: Testing Email Verification

### 5.1 Test the Flow
1. Create a new account with a real email address
2. Check your email inbox (and spam folder)
3. Click the verification link
4. Return to the app and check verification status

### 5.2 Common Issues
- **Email not received**: Check spam folder, wait 5-10 minutes
- **Link expired**: Use "Resend Verification Email" in app
- **App not updating**: Pull to refresh or restart app

## ⚙️ Step 6: Advanced Configuration

### 6.1 Custom Domain (Optional)
1. In Firebase Console, go to **Authentication > Settings**
2. Under **"Authorized domains"**, add your custom domain
3. Configure DNS records as instructed

### 6.2 Action Code Settings (Optional)
1. In Authentication Settings, find **"Action code settings"**
2. Configure:
   - **URL**: Your app's deep link URL
   - **Handle code in app**: Enable for mobile apps
   - **iOS bundle ID**: Your iOS app bundle ID
   - **Android package name**: Your Android package name

## 🔍 Step 7: Monitoring

### 7.1 Check Verification Status
1. In Firebase Console, go to **Authentication > Users**
2. Look for **"Email verified"** column
3. You can manually verify users if needed

### 7.2 Analytics
1. Go to **Analytics > Events**
2. Look for authentication events
3. Monitor verification success rates

## 📋 Summary

After completing these steps:
- ✅ Email verification is enabled
- ✅ Users receive verification emails on signup
- ✅ App guides users through verification process
- ✅ Profile screen shows verification status
- ✅ Users can resend verification emails
- ✅ Optional: Security rules require verification

## 🆘 Troubleshooting

### Email Not Sending
- Check Firebase project billing status
- Verify email templates are configured
- Check Firebase quotas and limits

### App Not Detecting Verification
- Ensure user reloads after verification
- Check network connectivity
- Verify Firebase configuration in app

### Security Rules Issues
- Test rules in Firebase Console
- Check user authentication status
- Verify email verification status in user token

For more help, refer to the [Firebase Authentication Documentation](https://firebase.google.com/docs/auth). 