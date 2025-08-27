import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, Timestamp, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Order, ProductionStatus, ShippingStatus, Customer, Product, OrderItem } from '../types';
import { PRODUCTION_STATUSES, SHIPPING_STATUSES } from '../constants';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { generateInvoicePdf } from '../services/invoices';
import { useApp } from '../hooks/useApp';
import { formatCurrency } from '../utils/formatting';


const Orders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const { settings, language } = useApp();

  const initialFormState: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'customerName'> = {
    customerId: '',
    items: [],
    subtotal: 0,
    discount: 0,
    total: 0,
    depositPaid: false,
    depositAmount: 0,
    productionStatus: 'Not Started',
    shippingStatus: 'Ready',
    notes: '',
    isCancelled: false,
  };

  const [formState, setFormState] = useState(initialFormState);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const ordersQuery = await getDocs(collection(db, 'orders'));
    const ordersData = ordersQuery.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: (doc.data().createdAt as Timestamp)?.toDate(),
      updatedAt: (doc.data().updatedAt as Timestamp)?.toDate(),
    })) as Order[];
    setOrders(ordersData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));

    const customersQuery = await getDocs(collection(db, 'customers'));
    setCustomers(customersQuery.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    
    const productsQuery = await getDocs(collection(db, 'products'));
    setProducts(productsQuery.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    
    setLoading(false);
  };
  
  useEffect(() => {
    // Recalculate totals whenever items, discount, or deposit changes
    const subtotal = formState.items.reduce((acc, item) => acc + item.lineTotal, 0);
    const total = subtotal - formState.discount;
    setFormState(prev => ({...prev, subtotal, total}));
  }, [formState.items, formState.discount]);

  const handleOpenModal = (order: Order | null = null) => {
    setSelectedOrder(order);
    setFormState(order ? { ...order, discount: order.discount || 0 } : initialFormState);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedOrder(null);
  };
  
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const val = isCheckbox ? (e.target as HTMLInputElement).checked : value;
    setFormState(prev => ({ ...prev, [name]: val }));
  };

  const handleItemChange = (index: number, field: keyof OrderItem, value: any) => {
    const newItems = [...formState.items];
    const item = newItems[index];
    // Fix: Cast item to 'any' to allow dynamic property assignment, resolving the "not assignable to type 'never'" error.
    (item as any)[field] = value;

    if (field === 'productId') {
        const product = products.find(p => p.id === value);
        if (product) {
            item.name = product.name;
            item.unitPrice = product.price;
            item.materialsCost = product.materialsCost;
        }
    }

    if (field === 'qty' || field === 'productId') {
        item.lineTotal = item.qty * item.unitPrice;
    }

    setFormState(prev => ({...prev, items: newItems}));
  };

  const addItem = () => {
    setFormState(prev => ({ ...prev, items: [...prev.items, { productId: '', name: '', qty: 1, unitPrice: 0, materialsCost: 0, lineTotal: 0}]}));
  };

  const removeItem = (index: number) => {
    setFormState(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index)}));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const customer = customers.find(c => c.id === formState.customerId);
    if (!customer) {
        alert("Please select a customer.");
        return;
    }
    
    const dataToSave = {
        ...formState,
        customerName: customer.fullName,
        updatedAt: serverTimestamp(),
    };

    if (selectedOrder) {
      await updateDoc(doc(db, 'orders', selectedOrder.id), dataToSave);
    } else {
      await addDoc(collection(db, 'orders'), {...dataToSave, createdAt: serverTimestamp()});
    }
    fetchData();
    handleCloseModal();
  };
  
  const handleDelete = async (id: string) => {
     if (window.confirm('Are you sure you want to delete this order?')) {
        await deleteDoc(doc(db, 'orders', id));
        fetchData();
    }
  };


  const handleStatusChange = async (orderId: string, field: 'productionStatus' | 'shippingStatus', value: string) => {
    const orderDoc = doc(db, 'orders', orderId);
    await updateDoc(orderDoc, { [field]: value });
    fetchData();
  };

  const handleCancelOrder = async (orderId: string) => {
    if (window.confirm('Are you sure you want to cancel this order? This action cannot be undone.')) {
        const orderDoc = doc(db, 'orders', orderId);
        await updateDoc(orderDoc, { isCancelled: true });
        fetchData();
    }
  };
  
  const handlePrintInvoice = (order: Order) => {
    const customer = customers.find(c => c.id === order.customerId);
    if (!customer || !settings) {
        alert("Customer data or settings not found.");
        return;
    }
    generateInvoicePdf({ order, customer, settings, issueDate: new Date(), language });
  };


  if (loading) return <div className="flex justify-center items-center h-full"><Spinner /></div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-semibold text-gray-800">Orders</h1>
        <Button onClick={() => handleOpenModal()}>Create Order</Button>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full leading-normal">
            <thead>
              <tr>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Order ID</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Customer</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Total</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Production Status</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Shipping Status</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id} className={`${order.isCancelled ? 'bg-red-100 opacity-70' : ''}`}>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm whitespace-nowrap">{order.id.substring(0, 8)}...</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm whitespace-nowrap">{order.customerName}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm whitespace-nowrap">{order.createdAt.toLocaleDateString()}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm whitespace-nowrap">{formatCurrency(order.total)}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm whitespace-nowrap">
                    <Select 
                      value={order.productionStatus}
                      onChange={(e) => handleStatusChange(order.id, 'productionStatus', e.target.value)}
                      options={PRODUCTION_STATUSES.map(s => ({ value: s, label: s }))}
                      disabled={order.isCancelled}
                    />
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm whitespace-nowrap">
                    <Select 
                      value={order.shippingStatus}
                      onChange={(e) => handleStatusChange(order.id, 'shippingStatus', e.target.value)}
                      options={SHIPPING_STATUSES.map(s => ({ value: s, label: s }))}
                      disabled={order.isCancelled}
                    />
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-right space-x-1 whitespace-nowrap">
                      <Button size="sm" variant="primary" onClick={() => handlePrintInvoice(order)}>Invoice</Button>
                      <Button size="sm" variant="secondary" onClick={() => handleOpenModal(order)}>Edit</Button>
                      {!order.isCancelled && <Button size="sm" variant="danger" onClick={() => handleCancelOrder(order.id)}>Cancel</Button>}
                      {order.isCancelled && <span className="text-red-600 font-bold">CANCELLED</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={selectedOrder ? 'Edit Order' : 'Create Order'}>
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto p-1">
            <Select label="Customer" name="customerId" value={formState.customerId} onChange={handleFormChange} options={[{ value: '', label: 'Select a customer' },...customers.map(c => ({ value: c.id, label: c.fullName }))]} required />
            
            <div className="border-t pt-4">
                <h3 className="font-medium text-lg mb-2">Items</h3>
                {formState.items.map((item, index) => (
                    <div key={index} className="flex flex-col md:flex-row gap-2 items-center mb-2">
                        <div className="w-full md:flex-1">
                            <Select value={item.productId} onChange={e => handleItemChange(index, 'productId', e.target.value)} options={[{value: '', label: 'Select product'}, ...products.map(p => ({value: p.id, label: p.name}))]} />
                        </div>
                        <div className="w-full md:w-24">
                             <Input type="number" value={item.qty} onChange={e => handleItemChange(index, 'qty', parseInt(e.target.value))} />
                        </div>
                        <div className="w-full md:w-auto text-sm text-center md:text-left">@ {formatCurrency(item.unitPrice)}</div>
                        <div className="w-full md:w-auto text-sm font-semibold text-center md:text-left">{formatCurrency(item.lineTotal)}</div>
                        <div className="w-full md:w-auto">
                            <Button type="button" size="sm" variant="danger" onClick={() => removeItem(index)} className="w-full md:w-auto">X</Button>
                        </div>
                    </div>
                ))}
                 <Button type="button" size="sm" onClick={addItem}>+ Add Item</Button>
            </div>

            <div className="border-t pt-4 space-y-2 text-right">
                <div>Subtotal: <span className="font-bold">{formatCurrency(formState.subtotal)}</span></div>
                <div className="flex justify-end items-center gap-2">
                    <label htmlFor="discount">Discount:</label>
                    <Input id="discount" name="discount" type="number" className="w-24 text-right" value={formState.discount} onChange={e => setFormState(prev => ({...prev, discount: parseFloat(e.target.value) || 0}))} />
                </div>
                 <div>Total: <span className="text-xl font-bold">{formatCurrency(formState.total)}</span></div>
            </div>

             <div className="border-t pt-4">
                <div className="flex items-center gap-4">
                   <div className="flex items-center gap-2">
                        <input type="checkbox" id="depositPaid" name="depositPaid" checked={formState.depositPaid} onChange={handleFormChange} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                        <label htmlFor="depositPaid">Deposit Paid</label>
                   </div>
                   {formState.depositPaid && (
                       <Input name="depositAmount" label="Deposit Amount" type="number" value={formState.depositAmount} onChange={e => setFormState(prev => ({...prev, depositAmount: parseFloat(e.target.value) || 0}))} />
                   )}
                </div>
                 {formState.depositPaid && <div className="text-right mt-2">Remaining Balance: <span className="font-bold">{formatCurrency(formState.total - formState.depositAmount)}</span></div>}
            </div>

            <div className="mt-6 flex justify-end space-x-2">
                <Button type="button" variant="secondary" onClick={handleCloseModal}>Cancel</Button>
                <Button type="submit">Save Order</Button>
            </div>
        </form>
      </Modal>

    </div>
  );
};

export default Orders;