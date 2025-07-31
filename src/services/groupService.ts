import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { Group, GroupInvitation, User } from '../types';

export const groupService = {
  // Create a new group
  async createGroup(groupData: Omit<Group, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      console.log('Creating group with data:', groupData);
      const docRef = await addDoc(collection(db, 'groups'), {
        ...groupData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log('Group created successfully with ID:', docRef.id);
      return docRef.id;
    } catch (error: any) {
      console.error('Error creating group:', error);
      throw new Error(`Failed to create group: ${error.message}`);
    }
  },

  // Get groups where user is a member
  async getUserGroups(userId: string): Promise<Group[]> {
    try {
      console.log('Getting groups for user ID:', userId);
      
      // First try a simple query without orderBy
      const q = query(
        collection(db, 'groups'),
        where('members', 'array-contains', userId)
      );
      console.log('Query created, executing...');
      const querySnapshot = await getDocs(q);
      console.log('Query executed, found', querySnapshot.docs.length, 'groups');
      
      const groups = querySnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('Group data:', { id: doc.id, ...data });
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as Group;
      });
      
      // Sort manually since orderBy might be causing issues
      groups.sort((a, b) => {
        if (a.updatedAt && b.updatedAt) {
          return b.updatedAt.getTime() - a.updatedAt.getTime();
        }
        return 0;
      });
      
      console.log('Processed groups:', groups);
      return groups;
    } catch (error: any) {
      console.error('Error in getUserGroups:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      throw new Error(`Failed to fetch groups: ${error.message}`);
    }
  },

  // Get a specific group by ID
  async getGroup(groupId: string): Promise<Group | null> {
    try {
      const docRef = doc(db, 'groups', groupId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate(),
          updatedAt: docSnap.data().updatedAt?.toDate(),
        } as Group;
      }
      return null;
    } catch (error) {
      throw new Error('Failed to fetch group');
    }
  },

  // Update group
  async updateGroup(groupId: string, updates: Partial<Group>): Promise<void> {
    try {
      const docRef = doc(db, 'groups', groupId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      throw new Error('Failed to update group');
    }
  },

  // Delete group
  async deleteGroup(groupId: string): Promise<void> {
    try {
      const docRef = doc(db, 'groups', groupId);
      await deleteDoc(docRef);
    } catch (error) {
      throw new Error('Failed to delete group');
    }
  },

  // Add member to group
  async addMemberToGroup(groupId: string, userId: string): Promise<void> {
    try {
      const docRef = doc(db, 'groups', groupId);
      await updateDoc(docRef, {
        members: [...(await this.getGroup(groupId))?.members || [], userId],
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      throw new Error('Failed to add member to group');
    }
  },

  // Remove member from group
  async removeMemberFromGroup(groupId: string, userId: string): Promise<void> {
    try {
      const group = await this.getGroup(groupId);
      if (!group) throw new Error('Group not found');
      
      const updatedMembers = group.members.filter(id => id !== userId);
      await this.updateGroup(groupId, { members: updatedMembers });
    } catch (error) {
      throw new Error('Failed to remove member from group');
    }
  },

  // Create group invitation
  async createInvitation(invitationData: Omit<GroupInvitation, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'groupInvitations'), {
        ...invitationData,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      throw new Error('Failed to create invitation');
    }
  },

  // Get pending invitations for a user
  async getPendingInvitations(email: string): Promise<GroupInvitation[]> {
    try {
      const q = query(
        collection(db, 'groupInvitations'),
        where('invitedEmail', '==', email),
        where('status', '==', 'pending')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as GroupInvitation[];
    } catch (error) {
      throw new Error('Failed to fetch invitations');
    }
  },

  // Update invitation status
  async updateInvitationStatus(invitationId: string, status: 'accepted' | 'declined'): Promise<void> {
    try {
      const docRef = doc(db, 'groupInvitations', invitationId);
      await updateDoc(docRef, { status });
    } catch (error) {
      throw new Error('Failed to update invitation status');
    }
  },
};

// Fetch user display names by user ID
export const getUserDisplayNames = async (userIds: string[]): Promise<Record<string, string>> => {
  const names: Record<string, string> = {};
  const uniqueIds = Array.from(new Set(userIds));
  
  await Promise.all(uniqueIds.map(async (id) => {
    try {
      const docRef = doc(db, 'users', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const user = docSnap.data() as User;
        names[id] = user.displayName || user.email || id;
      } else {
        names[id] = id;
      }
    } catch (error) {
      console.error(`Error fetching user ${id}:`, error);
      names[id] = id;
    }
  }));
  
  return names;
}; 