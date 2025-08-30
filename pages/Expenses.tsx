

import React, { useState, useEffect } from 'react';
// Fix: Use v8 firestore features by importing firebase.
// Fix: Use Firebase v9 compat libraries to get firestore namespace.
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { db, logActivity } from '../services/firebase';
import { Expense } from '../types';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Spinner from '../components/ui/Spinner';
import { useTranslation } from '../utils/localization';
import { EXPENSE_CATEGORIES } from '../constants';
import { formatCurrency } from '../utils/formatting';
import { useAuth } from '../hooks/useAuth';

const Expenses: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const { t } = useTranslation();
  const { currentUser } = useAuth();

  const initialFormState = {
    name: '',
    category: '',
    amount: '',
    date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
  };
  const [formState, setFormState] = useState(initialFormState);

  useEffect(() => {
    setLoading(true);
    // Fix: use v8 onSnapshot() syntax.
    const unsubscribe = db.collection('expenses').onSnapshot((querySnapshot) => {
      const expensesData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          // Fix: cast to any to call toDate() on v8 Timestamp.
          date: (doc.data().date as any).toDate()
      })) as Expense[];
      // Sort by date descending
      expensesData.sort((a, b) => (b.date as Date).getTime() - (a.date as Date).getTime());
      setExpenses(expensesData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleOpenModal = (expense: Expense | null = null) => {
    setSelectedExpense(expense);
    if (expense) {
      setFormState({
        name: expense.name,
        category: expense.category,
        amount: String(expense.amount),
        date: (expense.date as Date).toISOString().split('T')[0],
      });
    } else {
      setFormState(initialFormState);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedExpense(null);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormState(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSave = {
        name: formState.name,
        category: formState.category,
        amount: parseFloat(formState.amount),
        // Fix: use v8 Timestamp.
        date: firebase.firestore.Timestamp.fromDate(new Date(formState.date)),
    };

    try {
        if (selectedExpense) {
            // Fix: use v8 update() syntax.
            await db.collection('expenses').doc(selectedExpense.id).update(dataToSave);
            await logActivity(currentUser?.email, 'Update Expense', `Updated expense: ${dataToSave.name} (${formatCurrency(dataToSave.amount)})`);
        } else {
            // Fix: use v8 add() and serverTimestamp() syntax.
            await db.collection('expenses').add({ ...dataToSave, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
             await logActivity(currentUser?.email, 'Create Expense', `Created expense: ${dataToSave.name} (${formatCurrency(dataToSave.amount)})`);
        }
        handleCloseModal();
    } catch (error) {
        console.error("Error saving expense:", error);
        alert("Failed to save expense.");
    }
  };

  const handleDelete = async (id: string) => {
    const expenseToDelete = expenses.find(ex => ex.id === id);
    if (window.confirm('Are you sure you want to delete this expense?')) {
        // Fix: use v8 delete() syntax.
        await db.collection('expenses').doc(id).delete();
        await logActivity(currentUser?.email, 'Delete Expense', `Deleted expense: ${expenseToDelete?.name || `ID: ${id}`} (${formatCurrency(expenseToDelete?.amount || 0)})`);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-full"><Spinner /></div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-semibold text-gray-800">{t('expenses')}</h1>
        <Button onClick={() => handleOpenModal()}>{t('addExpense')}</Button>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full leading-normal">
            <thead>
              <tr>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('date')}</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('expenseName')}</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('category')}</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('amount')}</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100"></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(expense => (
                <tr key={expense.id}>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm whitespace-nowrap">{(expense.date as Date).toLocaleDateString()}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm whitespace-nowrap">{expense.name}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm whitespace-nowrap">{expense.category}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm whitespace-nowrap">{formatCurrency(expense.amount)}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-right whitespace-nowrap">
                    <Button size="sm" variant="secondary" className="mr-2" onClick={() => handleOpenModal(expense)}>Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(expense.id)}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={selectedExpense ? t('editExpense') : t('addExpense')}>
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input label={t('date')} name="date" type="date" value={formState.date} onChange={handleFormChange} required />
            <Input label={t('expenseName')} name="name" value={formState.name} onChange={handleFormChange} required />
            <div>
                 <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">{t('category')}</label>
                 <input
                    id="category"
                    name="category"
                    list="expense-categories"
                    value={formState.category}
                    onChange={handleFormChange}
                    required
                    className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                 />
                 <datalist id="expense-categories">
                     {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat} />)}
                 </datalist>
            </div>
            <Input label={t('amount')} name="amount" type="number" step="0.01" value={formState.amount} onChange={handleFormChange} required />

          <div className="mt-6 flex justify-end space-x-2">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Expenses;