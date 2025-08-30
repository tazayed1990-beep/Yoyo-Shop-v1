import React, { useState, useEffect, useMemo } from 'react';
// Fix: Use v8 firestore features by importing firebase.
// Fix: Use Firebase v9 compat libraries to get firestore namespace.
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { db, logActivity } from '../services/firebase';
import { Order, ProductionStatus, ShippingStatus, Customer, Product, OrderItem, Material } from '../types';
import { PRODUCTION_STATUSES, SHIPPING_STATUSES } from '../constants';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { generateInvoicePdf } from '../services/invoices';
import { useApp } from '../hooks/useApp';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency } from '../utils/formatting';


const Orders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const { settings, language } = useApp();
  const { currentUser } = useAuth();

  // State for new order confirmation
  const [pendingOrder, setPendingOrder] = useState<Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'customerName' | 'items'> & { items: OrderItem[] } | null>(null);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);

  // State for status change confirmation
  const [pendingStatusChange, setPendingStatusChange] = useState<{order: Order; field: 'productionStatus' | 'shippingStatus'; value: string} | null>(null);
  const [isStatusChangeModalOpen, setIsStatusChangeModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState('Active');


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
    setMaterials(materialsQuery.docs.map(doc => ({ id: doc.id, ...doc.data() } as Material)));

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
  
  const addStockDeductionsToBatch = (batch: firebase.firestore.WriteBatch, orderData: { items: OrderItem[] }) => {
    for (const item of orderData.items) {
      const product = products.find(p => p.id === item.productId);
      if (product?.materials) {
        for (const prodMaterial of product.materials) {
          const materialDocRef = db.collection('materials').doc(prodMaterial.materialId);
          const quantityToDeduct = prodMaterial.quantity * item.qty;
          batch.update(materialDocRef, { stockQty: firebase.firestore.FieldValue.increment(-quantityToDeduct) });
        }
      }
    }
  };
  
  const addStockRestorationToBatch = (batch: firebase.firestore.WriteBatch, order: Order) => {
    for (const item of order.items) {
        const product = products.find(p => p.id === item.productId);
        if (product?.materials) {
            for (const prodMaterial of product.materials) {
                const materialDocRef = db.collection('materials').doc(prodMaterial.materialId);
                const quantityToRestore = prodMaterial.quantity * item.qty;
                batch.update(materialDocRef, { stockQty: firebase.firestore.FieldValue.increment(quantityToRestore) });
            }
        }
    }
  };
  
  const getMaterialUsageMap = (items: OrderItem[]): Map<string, number> => {
    const usageMap = new Map<string, number>();
    items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        if (product?.materials) {
            product.materials.forEach(prodMaterial => {
                const currentQty = usageMap.get(prodMaterial.materialId) || 0;
                usageMap.set(prodMaterial.materialId, currentQty + (prodMaterial.quantity * item.qty));
            });
        }
    });
    return usageMap;
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
      // If new order, assign current user. If editing, keep original salesperson.
      salespersonId: selectedOrder?.salespersonId || currentUser?.uid,
      salespersonName: selectedOrder?.salespersonName || currentUser?.name || currentUser?.email || 'N/A',
    };

    if (selectedOrder) {
      const batch = db.batch();
      const orderDocRef = db.collection('orders').doc(selectedOrder.id);
      
      // If stock was already deducted, we need to calculate the difference and adjust.
      if (selectedOrder.stockDeducted) {
          const oldUsage = getMaterialUsageMap(selectedOrder.items);
          const newUsage = getMaterialUsageMap(formState.items);
          const allMaterialIds = new Set([...oldUsage.keys(), ...newUsage.keys()]);

          allMaterialIds.forEach(materialId => {
              const oldQty = oldUsage.get(materialId) || 0;
              const newQty = newUsage.get(materialId) || 0;
              const delta = newQty - oldQty;

              if (delta !== 0) {
                  const materialDocRef = db.collection('materials').doc(materialId);
                  batch.update(materialDocRef, { stockQty: firebase.firestore.FieldValue.increment(-delta) });
              }
          });
      }

      batch.update(orderDocRef, {...dataToSave, updatedAt: firebase.firestore.FieldValue.serverTimestamp()});
      await batch.commit();
      await logActivity(currentUser?.email, 'Update Order', `Updated Order #${selectedOrder.id.substring(0,8)}`);
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

    let newOrderId = '';
    try {
        const data = {
            ...pendingOrder,
            stockDeducted: deductStock,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        };

        const newOrderRef = await db.collection('orders').add(data);
        newOrderId = newOrderRef.id;
        
        if (deductStock) {
            const batch = db.batch();
            addStockDeductionsToBatch(batch, pendingOrder);
            await batch.commit();
        }
        await logActivity(currentUser?.email, 'Create Order', `Created new Order #${newOrderId.substring(0,8)}. Stock deducted: ${deductStock}`);

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
     if (window.confirm('Are you sure you want to delete this order? Note: Canceled orders with deducted stock must be manually handled.')) {
        await db.collection('orders').doc(id).delete();
        await logActivity(currentUser?.email, 'Delete Order', `Deleted Order #${id.substring(0,8)}`);
        fetchData();
    }
  };


  const handleStatusChange = async (orderId: string, field: 'productionStatus' | 'shippingStatus', value: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    
    const isCompletionStatus = value === 'Finished' || value === 'Delivered';
    if (!order.stockDeducted && isCompletionStatus) {
        setPendingStatusChange({ order, field, value });
        setIsStatusChangeModalOpen(true);
    } else {
        const orderDoc = db.collection('orders').doc(orderId);
        await orderDoc.update({ [field]: value, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        await logActivity(currentUser?.email, 'Update Order Status', `Order #${orderId.substring(0,8)} ${field} set to ${value}`);
        fetchData();
    }
  };

  const finalizeStatusChange = async (deductStock: boolean) => {
    if (!pendingStatusChange) return;
    const { order, field, value } = pendingStatusChange;
    
    try {
        const batch = db.batch();
        const orderDocRef = db.collection('orders').doc(order.id);

        const updates: any = {
            [field]: value,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (deductStock) {
            addStockDeductionsToBatch(batch, order);
            updates.stockDeducted = true;
        }

        batch.update(orderDocRef, updates);
        await batch.commit();
        await logActivity(currentUser?.email, 'Update Order Status', `Order #${order.id.substring(0,8)} ${field} set to ${value}. Stock deducted: ${deductStock}`);
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
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    if (window.confirm('Are you sure you want to cancel this order? If stock was deducted, it will be returned.')) {
        try {
            const batch = db.batch();
            const orderDocRef = db.collection('orders').doc(order.id);

            if (order.stockDeducted) {
                addStockRestorationToBatch(batch, order);
            }
            
            batch.update(orderDocRef, { 
                isCancelled: true,
                stockDeducted: false,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp() 
            });
            
            await batch.commit();
            await logActivity(currentUser?.email, 'Cancel Order', `Cancelled Order #${orderId.substring(0,8)}. Stock restored: ${order.stockDeducted}`);
            fetchData();
        } catch (error) {
            console.error("Error cancelling order:", error);
            alert("Failed to cancel the order. Please try again.");
        }
    }
  };

  const filteredOrders = useMemo(() => {
    switch (activeFilter) {
      case 'Active':
        return orders.filter(o => !o.isCancelled);
      case 'Ready to Ship':
        return orders.filter(o => o.productionStatus === 'Finished' && o.shippingStatus !== 'Delivered' && !o.isCancelled);
      case 'Canceled':
        return orders.filter(o => o.isCancelled);
      case 'All':
      default:
        return orders;
    }
  }, [orders, activeFilter]);


  const getStatusColor = (status: ProductionStatus | ShippingStatus) => {
    switch (status) {
        case 'Finished':
        case 'Delivered':
            return 'bg-green-100 text-green-800';
        case 'Started':
        case 'Layer 1':
        case 'Layer 2':
        case 'Final Layer':
        case 'Out for Shipment':
        case 'Out for Delivery':
            return 'bg-yellow-100 text-yellow-800';
        case 'Not Started':
        case 'Ready':
            return 'bg-blue-100 text-blue-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
  };


  if (loading) return <div className="flex justify-center items-center h-full"><Spinner /></div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-semibold text-gray-800">Orders</h1>
        <Button onClick={() => handleOpenModal()}>Add Order</Button>
      </div>
      
      <div className="mb-4 flex flex-wrap gap-2">
        <Button size="sm" variant={activeFilter === 'Active' ? 'primary' : 'secondary'} className={activeFilter !== 'Active' ? 'opacity-70' : ''} onClick={() => setActiveFilter('Active')}>Active</Button>
        <Button size="sm" variant={activeFilter === 'Ready to Ship' ? 'primary' : 'secondary'} className={activeFilter !== 'Ready to Ship' ? 'opacity-70' : ''} onClick={() => setActiveFilter('Ready to Ship')}>Ready to Ship</Button>
        <Button size="sm" variant={activeFilter === 'Canceled' ? 'primary' : 'secondary'} className={activeFilter !== 'Canceled' ? 'opacity-70' : ''} onClick={() => setActiveFilter('Canceled')}>Canceled</Button>
        <Button size="sm" variant={activeFilter === 'All' ? 'primary' : 'secondary'} className={activeFilter !== 'All' ? 'opacity-70' : ''} onClick={() => setActiveFilter('All')}>All</Button>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full leading-normal">
            <thead>
              <tr>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Customer</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Total</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Production</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Shipping</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Salesperson</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100"></th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(order => (
                <tr key={order.id} className={order.isCancelled ? 'bg-red-50 opacity-60' : ''}>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{order.customerName}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{formatCurrency(order.total)}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                     <Select
                        className="text-xs"
                        value={order.productionStatus}
                        onChange={(e) => handleStatusChange(order.id, 'productionStatus', e.target.value as ProductionStatus)}
                        options={PRODUCTION_STATUSES.map(s => ({ value: s, label: s }))}
                        disabled={order.isCancelled}
                      />
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                      <Select
                        className="text-xs"
                        value={order.shippingStatus}
                        onChange={(e) => handleStatusChange(order.id, 'shippingStatus', e.target.value as ShippingStatus)}
                        options={SHIPPING_STATUSES.map(s => ({ value: s, label: s }))}
                        disabled={order.isCancelled}
                      />
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{order.createdAt?.toLocaleDateString()}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{order.salespersonName}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-right whitespace-nowrap">
                    {!order.isCancelled && <Button size="sm" variant="secondary" className="mr-2" onClick={() => handleOpenModal(order)}>Edit</Button>}
                    <Button size="sm" className="mr-2" onClick={() => generateInvoicePdf({order, customer: customers.find(c=>c.id === order.customerId)!, settings: settings!, issueDate: new Date(), language })}>Invoice</Button>
                    {!order.isCancelled && <Button size="sm" variant="danger" className="mr-2" onClick={() => handleCancelOrder(order.id)}>Cancel</Button>}
                    {order.isCancelled && <Button size="sm" variant="danger" onClick={() => handleDelete(order.id)}>Delete</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={selectedOrder ? 'Edit Order' : 'Add Order'}>
         <form onSubmit={handleSubmit}>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            <Select label="Customer" name="customerId" value={formState.customerId} onChange={handleFormChange} options={[{value: '', label: 'Select Customer'}, ...customers.map(c => ({value: c.id, label: c.fullName}))]} required />
            
            <div className="border-t pt-4">
              <h3 className="font-medium mb-2">Items</h3>
              <div className="space-y-3">
                {formState.items.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-center border-b pb-2">
                    <div className="col-span-6">
                      <Select value={item.productId} onChange={(e) => handleItemChange(index, 'productId', e.target.value)} options={[{value: '', label: 'Select Product'}, ...products.map(p => ({value: p.id, label: p.name}))]} />
                    </div>
                    <div className="col-span-2">
                      <Input type="number" placeholder="Qty" value={item.qty} onChange={(e) => handleItemChange(index, 'qty', parseInt(e.target.value) || 0)} />
                    </div>
                     <div className="col-span-3 text-sm text-center">
                        {formatCurrency(item.lineTotal)}
                     </div>
                    <div className="col-span-1">
                      <Button type="button" variant="danger" size="sm" onClick={() => removeItem(index)}>X</Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button type="button" size="sm" className="mt-2" onClick={addItem}>+ Add Item</Button>
            </div>

            <div className="border-t pt-4 grid grid-cols-2 gap-4">
                <Input label="Discount" name="discount" type="number" value={formState.discount} onChange={handleFormChange} />
                 <div className="flex items-end">
                    <p className="text-lg">Subtotal: <span className="font-bold">{formatCurrency(formState.subtotal)}</span></p>
                </div>
                <div className="flex items-center space-x-2">
                    <input type="checkbox" id="depositPaid" name="depositPaid" checked={formState.depositPaid} onChange={handleFormChange} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"/>
                    <label htmlFor="depositPaid">Deposit Paid?</label>
                </div>
                {formState.depositPaid && <Input label="Deposit Amount" name="depositAmount" type="number" value={formState.depositAmount} onChange={handleFormChange} />}
                <div className="flex items-end text-xl font-bold text-dark">
                    Total: {formatCurrency(formState.total)}
                </div>
            </div>

            <div className="border-t pt-4">
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea id="notes" name="notes" value={formState.notes} onChange={handleFormChange} rows={3} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
            </div>

          </div>
          <div className="mt-6 flex justify-end space-x-2">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>Cancel</Button>
            <Button type="submit">Save Order</Button>
          </div>
        </form>
      </Modal>

      {/* New Order Stock Confirmation Modal */}
      <Modal isOpen={isNewOrderModalOpen} onClose={() => setIsNewOrderModalOpen(false)} title="New Order Confirmation">
          <div className="space-y-4">
            <p>Do you want to deduct the required material stock from inventory for this new order now?</p>
            <p className="text-sm text-gray-600">You can also deduct stock later by changing the order status to "Finished" or "Delivered".</p>
            <div className="flex justify-end space-x-3 pt-4">
                <Button variant="secondary" onClick={() => finalizeNewOrder(false)}>Create Order Only</Button>
                <Button variant="primary" onClick={() => finalizeNewOrder(true)}>Create Order & Deduct Stock</Button>
            </div>
          </div>
      </Modal>

       {/* Status Change Stock Confirmation Modal */}
      <Modal isOpen={isStatusChangeModalOpen} onClose={() => setIsStatusChangeModalOpen(false)} title="Update Status & Inventory">
          <div className="space-y-4">
            <p>You've updated this order's status to '{pendingStatusChange?.value}'. Do you want to deduct the material stock from inventory now?</p>
            <p className="text-sm text-gray-600">This action has not been performed on this order yet.</p>
            <div className="flex justify-end space-x-3 pt-4">
                <Button variant="secondary" onClick={() => finalizeStatusChange(false)}>Update Status Only</Button>
                <Button variant="primary" onClick={() => finalizeStatusChange(true)}>Update Status & Deduct Stock</Button>
            </div>
          </div>
      </Modal>

    </div>
  );
};

export default Orders;
