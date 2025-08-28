

import React, { useState, useEffect } from 'react';
// Fix: Use v8 firestore features by importing firebase.
// Fix: Use Firebase v9 compat libraries to get firestore namespace.
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { db } from '../services/firebase';
import { User, UserRole } from '../types';
import Spinner from '../components/ui/Spinner';
import Select from '../components/ui/Select';
import { USER_ROLES } from '../constants';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { useTranslation } from '../utils/localization';

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { t } = useTranslation();
  
  const initialFormState = {
      uid: '',
      email: '',
      name: '',
      role: UserRole.VIEWER,
  };
  const [formState, setFormState] = useState(initialFormState);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    // Fix: use v8 get() syntax.
    const querySnapshot = await db.collection('users').get();
    const usersData = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as User[];
    setUsers(usersData);
    setLoading(false);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormState(initialFormState);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormState(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.uid || !formState.email) {
        alert('UID and Email are required.');
        return;
    }
    try {
        // Fix: use v8 set() and serverTimestamp() syntax.
        await db.collection('users').doc(formState.uid).set({
            email: formState.email,
            name: formState.name,
            role: formState.role,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        fetchUsers();
        handleCloseModal();
    } catch (error) {
        console.error("Error creating user:", error);
        alert("Failed to create user.");
    }
  };
  
  const handleRoleChange = async (uid: string, role: UserRole) => {
    try {
        // Fix: use v8 update() syntax.
        const userDoc = db.collection('users').doc(uid);
        await userDoc.update({ role });
        // Optimistically update UI
        setUsers(users.map(u => u.uid === uid ? { ...u, role } : u));
    } catch (error) {
        console.error("Error updating role: ", error);
        alert("Failed to update role.");
    }
  };


  if (loading) return <div className="flex justify-center items-center h-full"><Spinner /></div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-semibold text-gray-800">{t('users')}</h1>
        <Button onClick={() => setIsModalOpen(true)}>{t('addUser')}</Button>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full leading-normal">
            <thead>
              <tr>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('email')}</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('name')}</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('role')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.uid}>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm whitespace-nowrap">{user.email}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm whitespace-nowrap">{user.name || '-'}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm whitespace-nowrap">
                    <Select 
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.uid, e.target.value as UserRole)}
                      options={USER_ROLES.map(r => ({ value: r, label: r }))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={t('addUser')}>
        <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-gray-600">First, create the user in the Firebase Authentication console, then copy their UID here to create their record in the database.</p>
            <Input label={t('uid')} name="uid" value={formState.uid} onChange={handleFormChange} required />
            <Input label={t('email')} name="email" type="email" value={formState.email} onChange={handleFormChange} required />
            <Input label={t('name')} name="name" value={formState.name} onChange={handleFormChange} />
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