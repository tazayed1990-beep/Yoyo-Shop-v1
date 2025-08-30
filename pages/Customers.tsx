
import React, { useState, useEffect } from 'react';
// Fix: Remove v9 firestore imports.
import { db, logActivity } from '../services/firebase';
import { Customer } from '../types';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Spinner from '../components/ui/Spinner';
import { useAuth } from '../hooks/useAuth';

const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [formState, setFormState] = useState({ fullName: '', address: '', phoneNumber: '', email: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const { currentUser } = useAuth();
  const [phoneError, setPhoneError] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    // Fix: use v8 get() syntax.
    const querySnapshot = await db.collection('customers').get();
    const customersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Fix: Cast to any to call toDate() on v8 Timestamp.
        createdAt: (doc.data().createdAt as any).toDate()
    })) as Customer[];
    setCustomers(customersData);
    setLoading(false);
  };
  
  const validatePhoneNumber = (phone: string): string => {
    const validPrefixes = ['010', '011', '012', '015'];
    if (!/^\d{11}$/.test(phone)) {
      return "Please enter a valid Egyptian mobile number (11 digits, starting with 010, 011, 012, or 015).";
    }
    if (!validPrefixes.some(prefix => phone.startsWith(prefix))) {
      return "Please enter a valid Egyptian mobile number (11 digits, starting with 010, 011, 012, or 015).";
    }
    return ''; // No error
  };

  const handleOpenModal = (customer: Customer | null = null) => {
    setSelectedCustomer(customer);
    // Fix: Explicitly set form fields to avoid type mismatch on optional properties (email) and to exclude extra properties from the customer object (id, createdAt).
    const initialData = customer ? { fullName: customer.fullName, address: customer.address, phoneNumber: customer.phoneNumber, email: customer.email || '' } : { fullName: '', address: '', phoneNumber: '', email: '' };
    setFormState(initialData);
    setPhoneError(customer ? validatePhoneNumber(customer.phoneNumber) : ''); // Validate existing number on open
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCustomer(null);
    setPhoneError('');
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
     if (name === 'phoneNumber') {
      setPhoneError(validatePhoneNumber(value));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validatePhoneNumber(formState.phoneNumber);
    if (validationError) {
      setPhoneError(validationError);
      // alert(validationError); // This simulates a final server-side check
      return;
    }

    if (selectedCustomer) {
      // Update
      // Fix: use v8 update() syntax.
      const customerDoc = db.collection('customers').doc(selectedCustomer.id);
      await customerDoc.update(formState);
      await logActivity(currentUser?.email, 'Update Customer', `Updated details for ${formState.fullName}`);
    } else {
      // Create
      // Fix: use v8 add() syntax.
      await db.collection('customers').add({ ...formState, createdAt: new Date() });
      await logActivity(currentUser?.email, 'Create Customer', `Created new customer: ${formState.fullName}`);
    }
    fetchCustomers();
    handleCloseModal();
  };

  const handleDelete = async (id: string) => {
    const customerToDelete = customers.find(c => c.id === id);
    if (window.confirm('Are you sure you want to delete this customer?')) {
        // Fix: use v8 delete() syntax.
        await db.collection('customers').doc(id).delete();
        await logActivity(currentUser?.email, 'Delete Customer', `Deleted customer: ${customerToDelete?.fullName || `ID: ${id}`}`);
        fetchCustomers();
    }
  };

  const filteredCustomers = customers.filter(customer =>
    customer.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phoneNumber.includes(searchTerm)
  );

  if (loading) return <div className="flex justify-center items-center h-full"><Spinner /></div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-semibold text-gray-800">Customers</h1>
        <Button onClick={() => handleOpenModal()}>Add Customer</Button>
      </div>

      <div className="mb-4">
        <Input
          type="text"
          placeholder="Search by name or phone number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Search customers"
        />
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full leading-normal">
            <thead>
              <tr>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Full Name</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Phone</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100"></th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map(customer => (
                <tr key={customer.id}>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm whitespace-nowrap">{customer.fullName}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm whitespace-nowrap">{customer.phoneNumber}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm whitespace-nowrap">{customer.email}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-right whitespace-nowrap">
                    <Button size="sm" variant="secondary" className="mr-2" onClick={() => handleOpenModal(customer)}>Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(customer.id)}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={selectedCustomer ? 'Edit Customer' : 'Add Customer'}>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Input label="Full Name" name="fullName" value={formState.fullName} onChange={handleFormChange} required />
            <Input label="Address" name="address" value={formState.address} onChange={handleFormChange} required />
            <div>
                <Input label="Phone Number" name="phoneNumber" value={formState.phoneNumber} onChange={handleFormChange} required />
                {phoneError && <p className="text-red-500 text-xs mt-1">{phoneError}</p>}
            </div>
            <Input label="Email (Optional)" name="email" type="email" value={formState.email} onChange={handleFormChange} />
          </div>
          <div className="mt-6 flex justify-end space-x-2">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>Cancel</Button>
            <Button type="submit" disabled={!!phoneError}>Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Customers;