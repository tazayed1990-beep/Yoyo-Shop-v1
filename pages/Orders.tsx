


import React, { useState, useEffect } from 'react';
// Fix: Use v8 firestore features by importing firebase.
// Fix: Use Firebase v9 compat libraries to get firestore namespace.
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
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
  const [materials, setMaterials] = useState<any[]>([]); // Using any for simplicity with materials map
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const { settings, language } = useApp();

  // State for new order confirmation
  const [pendingOrder, setPendingOrder] = useState<Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'customerName' | 'items'> & { items: OrderItem[] } | null>(null);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);

  // State for status change confirmation
  const [pendingStatusChange, setPendingStatusChange] = useState<{order: Order; field: 'productionStatus' | 'shippingStatus'; value: string} | null>(null);
  const [isStatusChangeModalOpen, setIsStatusChangeModalOpen] = useState(false);


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
    stockDeducted: false,
  };

  const [formState, setFormState] = useState(initialFormState);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    // Fix: use v8 get() syntax.
    const ordersQuery = await db.collection('orders').get();
    const ordersData = ordersQuery.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Fix: Cast to any to call toDate() on v8 Timestamp.
      createdAt: (doc.data().createdAt as any)?.toDate(),
      updatedAt: (doc.data().updatedAt as any)?.toDate(),
    })) as Order[];
    setOrders(ordersData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));

    // Fix: use v8 get() syntax.
    const customersQuery = await db.collection('customers').get();
    setCustomers(customersQuery.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    
    // Fix: use v8 get() syntax.
    const productsQuery = await db.collection('products').get();
    setProducts(productsQuery.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    
    // Fix: use v8 get() syntax.
    const materialsQuery = await db.collection('materials').get();
    setMaterials(materialsQuery.docs.map(doc => ({ id: doc.id, ...doc.data() })));

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
  
  // Fix: Use v8 WriteBatch type.
  const addStockDeductionsToBatch = (batch: firebase.firestore.WriteBatch, orderData: { items: OrderItem[] }) => {
    for (const item of orderData.items) {
      const product = products.find(p => p.id === item.productId);
      if (product?.materials) {
        for (const prodMaterial of product.materials) {
          // Fix: use v8 doc() syntax.
          const materialDocRef = db.collection('materials').doc(prodMaterial.materialId);
          const quantityToDeduct = prodMaterial.quantity * item.qty;
          // Fix: use v8 increment() syntax.
          batch.update(materialDocRef, { stockQty: firebase.firestore.FieldValue.increment(-quantityToDeduct) });
        }
      }
    }
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
    };

    if (selectedOrder) {
      // Fix: use v8 update() and serverTimestamp() syntax.
      await db.collection('orders').doc(selectedOrder.id).update({...dataToSave, updatedAt: firebase.firestore.FieldValue.serverTimestamp()});
      fetchData();
      handleCloseModal();
    } else {
      // For new orders, trigger confirmation flow
      setPendingOrder(dataToSave);
      setIsNewOrderModalOpen(true);
      handleCloseModal();
    }
  };

  const finalizeNewOrder = async (deductStock: boolean) => {
    if (!pendingOrder) return;

    try {
        const data = {
            ...pendingOrder,
            stockDeducted: deductStock,
            // Fix: use v8 serverTimestamp() syntax.
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        };

        // Fix: use v8 add() syntax.
        const newOrderRef = await db.collection('orders').add(data);
        
        if (deductStock) {
            // Fix: use v8 batch() syntax.
            const batch = db.batch();
            const newOrderData = { ...pendingOrder, id: newOrderRef.id };
            addStockDeductionsToBatch(batch, newOrderData);
            await batch.commit();
        }

    } catch (error) {
        console.error("Error creating order or deducting stock:", error);
        alert("Failed to create order. Please try again.");
    } finally {
        setIsNewOrderModalOpen(false);
        setPendingOrder(null);
        fetchData();
    }
  };
  
  const handleDelete = async (id: string) => {
     if (window.confirm('Are you sure you want to delete this order?')) {
        // Fix: use v8 delete() syntax.
        await db.collection('orders').doc(id).delete();
        fetchData();
    }
  };


  const handleStatusChange = async (orderId: string, field: 'productionStatus' | 'shippingStatus', value: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    
    // Check for completion status and if stock hasn't been deducted
    const isCompletionStatus = value === 'Finished' || value === 'Delivered';
    if (!order.stockDeducted && isCompletionStatus) {
        setPendingStatusChange({ order, field, value });
        setIsStatusChangeModalOpen(true);
    } else {
        // Just update status normally
        // Fix: use v8 update() and serverTimestamp() syntax.
        const orderDoc = db.collection('orders').doc(orderId);
        await orderDoc.update({ [field]: value, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        fetchData();
    }
  };

  const finalizeStatusChange = async (deductStock: boolean) => {
    if (!pendingStatusChange) return;

    const { order, field, value } = pendingStatusChange;
    
    try {
        // Fix: use v8 batch() syntax.
        const batch = db.batch();
        // Fix: use v8 doc() syntax.
        const orderDocRef = db.collection('orders').doc(order.id);

        const updates: any = {
            [field]: value,
            // Fix: use v8 serverTimestamp() syntax.
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (deductStock) {
            addStockDeductionsToBatch(batch, order);
            updates.stockDeducted = true;
        }

        batch.update(orderDocRef, updates);
        await batch.commit();

    } catch (error) {
        console.error("Error updating status or deducting stock:", error);
        alert("Failed to update order status. Please try again.");
    } finally {
        setIsStatusChangeModalOpen(false);
        setPendingStatusChange(null);
        fetchData();
    }
  };


  const handleCancelOrder = async (orderId: string) => {
    if (window.confirm('Are you sure you want to cancel this order? This action cannot be undone.')) {
        // Fix: use v8 update() and serverTimestamp() syntax.
        const orderDoc = db.collection('orders').doc(orderId);
        await orderDoc.update({ isCancelled: true, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
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
                 <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Stock Status</th>
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
                    {order.stockDeducted ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Deducted
                      </span>
                    ) : (
                       <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Pending
                      </span>
                    )}
                  </td>
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

      {/* Confirmation Modal for New Order */}
      <Modal 
        isOpen={isNewOrderModalOpen} 
        onClose={() => setIsNewOrderModalOpen(false)}
        title="Confirm New Order"
      >
        <p className="mb-4">A new order is ready to be created. Do you want to deduct the required material stock now?</p>
        <div className="flex justify-end space-x-2">
          <Button variant="secondary" onClick={() => finalizeNewOrder(false)}>Create Without Deducting</Button>
          <Button variant="primary" onClick={() => finalizeNewOrder(true)}>Create & Deduct Stock</Button>
        </div>
      </Modal>

      {/* Confirmation Modal for Status Change */}
      <Modal 
        isOpen={isStatusChangeModalOpen} 
        onClose={() => setIsStatusChangeModalOpen(false)}
        title="Confirm Stock Deduction"
      >
        <p className="mb-4">This order is being marked as complete, but stock has not been deducted. Deduct materials from inventory now?</p>
        <div className="flex justify-end space-x-2">
          <Button variant="secondary" onClick={() => finalizeStatusChange(false)}>Update Status Only</Button>
          <Button variant="primary" onClick={() => finalizeStatusChange(true)}>Update Status & Deduct Stock</Button>
        </div>
      </Modal>
    </div>
  );
};

export default Orders;