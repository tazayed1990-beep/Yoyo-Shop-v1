import React, { useState, useEffect } from 'react';
// Fix: Use v8 firestore features by importing firebase.
// Fix: Use Firebase v9 compat libraries to get firestore namespace.
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { db, logActivity } from '../services/firebase';
import { User, UserRole } from '../types';
import Spinner from '../components/ui/Spinner';
import Select from '../components/ui/Select';
import { USER_ROLES } from '../constants';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { useTranslation } from '../utils/localization';
import { useAuth } from '../hooks/useAuth';

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  
  const initialFormState = {
      uid: '',
      email: '',
      name: '',
      role: UserRole.VIEWER,
      commissionRate: 0,
  };
  const [formState, setFormState] = useState(initialFormState);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const querySnapshot = await db.collection('users').get();
    const usersData = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as User[];
    setUsers(usersData);
    setLoading(false);
  };

  const handleOpenModal = (user: User | null = null) => {
    if (user) {
      setSelectedUser(user);
      setIsEditMode(true);
      setFormState({
        uid: user.uid,
        email: user.email || '',
        name: user.name || '',
        role: user.role,
        commissionRate: user.commissionRate || 0,
      });
    } else {
      setSelectedUser(null);
      setIsEditMode(false);
      setFormState(initialFormState);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: name === 'commissionRate' ? parseFloat(value) : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.email) {
        alert('Email is required.');
        return;
    }

    const dataToSave = {
        email: formState.email,
        name: formState.name,
        role: formState.role,
        commissionRate: formState.commissionRate || 0,
    };

    try {
        if (isEditMode && selectedUser) {
            await db.collection('users').doc(selectedUser.uid).update(dataToSave);
            await logActivity(currentUser?.email, 'Update User', `Updated user details for ${dataToSave.email}`);
        } else {
            if (!formState.uid) {
                alert('UID is required for new users.');
                return;
            }
            await db.collection('users').doc(formState.uid).set({
                ...dataToSave,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            });
            await logActivity(currentUser?.email, 'Create User', `Created user record for ${dataToSave.email} with role ${dataToSave.role}`);
        }
        fetchUsers();
        handleCloseModal();
    } catch (error) {
        console.error("Error saving user:", error);
        alert("Failed to save user.");
    }
  };
  
  const handleDelete = async (uid: string) => {
    const userToDelete = users.find(u => u.uid === uid);
    if (window.confirm(`Are you sure you want to delete the user record for ${userToDelete?.email}? This does NOT delete their authentication account.`)) {
        try {
            await db.collection('users').doc(uid).delete();
            await logActivity(currentUser?.email, 'Delete User', `Deleted user record for ${userToDelete?.email}`);
            fetchUsers();
        } catch (error) {
            console.error("Error deleting user:", error);
            alert("Failed to delete user record.");
        }
    }
  };


  if (loading) return <div className="flex justify-center items-center h-full"><Spinner /></div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-semibold text-gray-800">User Management</h1>
        <Button onClick={() => handleOpenModal()}>{t('addUser')}</Button>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full leading-normal">
            <thead>
              <tr>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('email')}</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('name')}</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('role')}</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Commission (%)</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100"></th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.uid}>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm whitespace-nowrap">{user.email}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm whitespace-nowrap">{user.name || '-'}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm whitespace-nowrap">{user.role}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm whitespace-nowrap">{user.commissionRate || 0}%</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-right whitespace-nowrap">
                    <Button size="sm" variant="secondary" className="mr-2" onClick={() => handleOpenModal(user)}>Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(user.uid)}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={isEditMode ? 'Edit User' : t('addUser')}>
        <form onSubmit={handleSubmit} className="space-y-4">
            {!isEditMode && <p className="text-sm text-gray-600">First, create the user in Firebase Authentication, then copy their UID here to create their database record.</p>}
            <Input label={t('uid')} name="uid" value={formState.uid} onChange={handleFormChange} required disabled={isEditMode} />
            <Input label={t('email')} name="email" type="email" value={formState.email} onChange={handleFormChange} required />
            <Input label={t('name')} name="name" value={formState.name} onChange={handleFormChange} />
            <Input label="Commission Rate (%)" name="commissionRate" type="number" min="0" max="100" step="0.1" value={formState.commissionRate} onChange={handleFormChange} />
            <Select label={t('role')} name="role" value={formState.role} onChange={handleFormChange} options={USER_ROLES.map(r => ({value: r, label: r}))} />
            <div className="mt-6 flex justify-end space-x-2">
                <Button type="button" variant="secondary" onClick={handleCloseModal}>Cancel</Button>
                <Button type="submit">Save User</Button>
            </div>
        </form>
      </Modal>
    </div>
  );
};

export default Users;