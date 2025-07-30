import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

// Your Firebase configuration
// Replace with your actual Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCjyjCVXcwTJXXkuiU0D_FVePAKdKZgxqA",
  authDomain: "cashbook-bfeb4.firebaseapp.com",
  projectId: "cashbook-bfeb4",
  storageBucket: "cashbook-bfeb4.firebasestorage.app",
  messagingSenderId: "951004658048",
  appId: "1:951004658048:web:1b0f297d876283eedba965",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth (AsyncStorage persistence will be handled automatically)
const auth = getAuth(app);

// Initialize Firestore
const db = getFirestore(app);

// Test function to check Firestore access
export const testFirestoreAccess = async () => {
  try {
    console.log('Testing Firestore access...');
    await setDoc(doc(db, 'test', 'test-doc'), {
      test: true,
      timestamp: new Date()
    });
    console.log('Firestore access test successful');
    return true;
  } catch (error: any) {
    console.error('Firestore access test failed:', error);
    return false;
  }
};

// Test function to check if we can read groups
export const testGroupsAccess = async () => {
  try {
    console.log('Testing groups collection access...');
    const { getDocs, collection } = await import('firebase/firestore');
    const querySnapshot = await getDocs(collection(db, 'groups'));
    console.log('Groups collection access successful, found', querySnapshot.docs.length, 'documents');
    return true;
  } catch (error: any) {
    console.error('Groups collection access failed:', error);
    return false;
  }
};

export { auth, db };
export default app; 