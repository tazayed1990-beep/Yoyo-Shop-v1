import React, { useState } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
// Fix: Use v8 firestore features by importing firebase.
// Fix: Use Firebase v9 compat libraries to get firestore namespace.
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import Card from '../components/ui/Card';
import { db } from '../services/firebase';
import { Order, Product, Customer, Material, Expense } from '../types';
import Spinner from '../components/ui/Spinner';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { formatCurrency } from '../utils/formatting';

interface ReportData {
  totalOrders: number;
  totalRevenue: number;
  totalProductsSold: number;
  customers: Customer[];
  totalMaterialCost: number;
  materialsUsed: { name: string; quantity: number; unitLabel: string }[];
  totalOperationalExpenses: number;
  profit: number;
}

const Reports: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
  });
  const [allOrdersInPeriod, setAllOrdersInPeriod] = useState<Order[]>([]);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [selectedCustomerOrders, setSelectedCustomerOrders] = useState<{customerName: string; orders: Order[]}>({ customerName: '', orders: [] });


  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };
  
  const generateReport = async () => {
    if (!filters.startDate || !filters.endDate) {
      alert('Please select a start and end date.');
      return;
    }
    setLoading(true);
    setReportData(null);

    // Fix: use v8 Timestamp.
    const startDate = firebase.firestore.Timestamp.fromDate(new Date(filters.startDate));
    const endDate = firebase.firestore.Timestamp.fromDate(new Date(filters.endDate + 'T23:59:59'));

    try {
      // 1. Fetch all necessary data in parallel
      // FIX: Removed `where('isCancelled', '!=', true)` to avoid composite index requirement.
      // Filtering will be done client-side.
      // Fix: use v8 query syntax.
      // Fix: Corrected collection path from ('db', 'orders') to ('orders').
      const ordersQuery = db
        .collection('orders')
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate);
      // Fix: Corrected collection path from ('db', 'expenses') to ('expenses').
      const expensesQuery = db
        .collection('expenses')
        .where('date', '>=', startDate)
        .where('date', '<=', endDate);

      const [
        ordersSnapshot, 
        customersSnapshot, 
        productsSnapshot, 
        materialsSnapshot, 
        expensesSnapshot
      ] = await Promise.all([
        ordersQuery.get(),
        db.collection('customers').get(),
        db.collection('products').get(),
        db.collection('materials').get(),
        expensesQuery.get()
      ]);

      // Fix: cast to any to call toDate() on v8 Timestamp.
      const ordersInPeriod = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: (doc.data().createdAt as any).toDate() }) as Order);
      const filteredOrders = ordersInPeriod.filter(order => !order.isCancelled);
      setAllOrdersInPeriod(filteredOrders);

      const allCustomers = customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Customer);
      const productsMap = new Map<string, Product>(productsSnapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() } as Product]));
      const materialsMap = new Map<string, Material>(materialsSnapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() } as Material]));
      const filteredExpenses = expensesSnapshot.docs.map(doc => doc.data() as Expense);

      // 2. Process data and calculate metrics

      // Sales
      const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.total, 0);
      const totalProductsSold = filteredOrders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.qty, 0), 0);

      // Customers
      const customerMetrics = new Map<string, { orderCount: number; totalSpent: number }>();
      filteredOrders.forEach(order => {
        const currentMetrics = customerMetrics.get(order.customerId) || { orderCount: 0, totalSpent: 0 };
        currentMetrics.orderCount++;
        currentMetrics.totalSpent += order.total;
        customerMetrics.set(order.customerId, currentMetrics);
      });

      const customerReport = allCustomers
        .map(customer => ({
          ...customer,
          orderCount: customerMetrics.get(customer.id)?.orderCount || 0,
          totalSpent: customerMetrics.get(customer.id)?.totalSpent || 0,
        }))
        .filter(customer => (customer.orderCount ?? 0) > 0) // Only show customers with orders in the period
        .sort((a, b) => (b.orderCount ?? 0) - (a.orderCount ?? 0));

      // Materials (Cost is still calculated for the materials usage report)
      const totalMaterialCost = filteredOrders.reduce((sum, order) => {
        return sum + order.items.reduce((itemSum, item) => itemSum + (item.materialsCost * item.qty), 0);
      }, 0);
      
      const materialsUsedMap = new Map<string, number>();
      filteredOrders.forEach(order => {
        order.items.forEach(item => {
          const product = productsMap.get(item.productId);
          if (product) {
            product.materials.forEach(prodMaterial => {
              const currentQty = materialsUsedMap.get(prodMaterial.materialId) || 0;
              materialsUsedMap.set(prodMaterial.materialId, currentQty + (prodMaterial.quantity * item.qty));
            });
          }
        });
      });

      const materialsUsedReport: { name: string; quantity: number; unitLabel: string }[] = [];
      materialsUsedMap.forEach((quantity, materialId) => {
        const material = materialsMap.get(materialId);
        if (material) {
          materialsUsedReport.push({
            name: material.name,
            quantity: quantity,
            unitLabel: material.unitLabel,
          });
        }
      });

      // Expenses
      const totalOperationalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);

      // Profit Calculation (P&L FIX)
      const profit = totalRevenue - totalOperationalExpenses;

      setReportData({
        totalOrders: filteredOrders.length,
        totalRevenue,
        totalProductsSold,
        customers: customerReport,
        totalMaterialCost, // Keep for materials report
        materialsUsed: materialsUsedReport,
        totalOperationalExpenses,
        profit,
      });

    } catch (error) {
      console.error("Error generating report:", error);
      alert("Failed to generate report. Check the console for details.");
    } finally {
      setLoading(false);
    }
  };
  
  const handleViewCustomerOrders = (customerId: string, customerName: string) => {
    const orders = allOrdersInPeriod.filter(order => order.customerId === customerId);
    setSelectedCustomerOrders({ customerName, orders });
    setIsCustomerModalOpen(true);
  };
  
  const handleExportCSV = () => {
    if (!reportData || !filters.startDate || !filters.endDate) return;

    const escapeCsvCell = (cell: any) => {
        const cellStr = String(cell ?? '').replace(/"/g, '""');
        return `"${cellStr}"`;
    };

    const csvRows: string[] = [];

    // Header
    csvRows.push('Yoyo Shop Report');
    csvRows.push(`Dates:,${filters.startDate} to ${filters.endDate}`);
    csvRows.push(''); // Blank line

    // Sales & Profit Summary
    csvRows.push('Sales & Profit Summary');
    csvRows.push('Metric,Value');
    csvRows.push(`Total Revenue,${escapeCsvCell(formatCurrency(reportData.totalRevenue))}`);
    csvRows.push(`Total Orders,${reportData.totalOrders}`);
    csvRows.push(`Total Products Sold,${reportData.totalProductsSold}`);
    csvRows.push(`Total Expenses,${escapeCsvCell(formatCurrency(reportData.totalOperationalExpenses))}`);
    csvRows.push(`Net Profit / Loss,${escapeCsvCell(formatCurrency(reportData.profit))}`);
    csvRows.push(''); // Blank line

    // Customer Report
    csvRows.push('Customer Report');
    csvRows.push('Customer Name,Phone Number,Email,Orders,Total Spent');
    reportData.customers.forEach(customer => {
        const row = [
            customer.fullName,
            customer.phoneNumber,
            customer.email || '',
            customer.orderCount || 0,
            formatCurrency(customer.totalSpent || 0)
        ].map(escapeCsvCell).join(',');
        csvRows.push(row);
    });
    csvRows.push(''); // Blank line

    // Materials Usage Report
    csvRows.push('Materials Usage Report');
    csvRows.push(`Total Material Cost:,${escapeCsvCell(formatCurrency(reportData.totalMaterialCost))}`);
    csvRows.push('Material Name,Total Quantity Used');
    reportData.materialsUsed.forEach(material => {
        const row = [
            material.name,
            `${material.quantity.toFixed(2)} ${material.unitLabel}`
        ].map(escapeCsvCell).join(',');
        csvRows.push(row);
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `report_${filters.startDate}_to_${filters.endDate}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
  };
  
  const handleExportPDF = () => {
    if (!reportData || !filters.startDate || !filters.endDate) return;

    const doc: any = new jsPDF();
    const today = new Date().toLocaleDateString();
    const reportPeriod = `${filters.startDate} to ${filters.endDate}`;
    const finalY = (doc as any).lastAutoTable.finalY || 0;

    // Header
    doc.setFontSize(18);
    doc.text('Yoyo Shop - Financial Report', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Report Period: ${reportPeriod}`, 14, 30);
    doc.text(`Generated On: ${today}`, 14, 36);

    // Sales & Profit Summary using autoTable
    doc.autoTable({
        startY: 45,
        head: [['Sales & Profit Summary', '']],
        body: [
            ['Total Revenue', formatCurrency(reportData.totalRevenue)],
            ['Total Expenses', formatCurrency(reportData.totalOperationalExpenses)],
            [{ content: 'Net Profit / Loss', styles: { fontStyle: 'bold' } }, { content: formatCurrency(reportData.profit), styles: { fontStyle: 'bold' } }],
        ],
        theme: 'grid',
        headStyles: { fillColor: [31, 41, 55] }
    });

    // Customer Report
    doc.autoTable({
        startY: (doc as any).lastAutoTable.finalY + 15,
        head: [['Active Customers', 'Orders', 'Total Spent']],
        body: reportData.customers.map(c => [c.fullName, c.orderCount, formatCurrency(c.totalSpent ?? 0)]),
        theme: 'striped',
        headStyles: { fillColor: [31, 41, 55] },
        didDrawPage: (data: any) => {
            doc.setFontSize(12);
            doc.text('Customer Report', data.settings.margin.left, (doc as any).lastAutoTable.finalY + 10);
        }
    });

    // Materials Usage
    doc.autoTable({
        startY: (doc as any).lastAutoTable.finalY + 15,
        head: [['Material Name', 'Total Quantity Used', 'Total Cost']],
        body: [
            ...reportData.materialsUsed.sort((a,b) => a.name.localeCompare(b.name)).map(m => [m.name, `${m.quantity.toFixed(2)} ${m.unitLabel}`, '']),
            [{ content: 'Total Material Cost', styles: { fontStyle: 'bold', halign: 'right' } }, '', { content: formatCurrency(reportData.totalMaterialCost), styles: { fontStyle: 'bold' }}]
        ],
        theme: 'striped',
        headStyles: { fillColor: [31, 41, 55] },
         didDrawPage: (data: any) => {
            doc.setFontSize(12);
            doc.text('Materials Usage Report', data.settings.margin.left, (doc as any).lastAutoTable.finalY + 10);
        }
    });

    doc.save(`report_${filters.startDate}_to_${filters.endDate}.pdf`);
};



  return (
    <div>
        <h1 className="text-3xl font-semibold text-gray-800 mb-6">Reports</h1>
        
        <Card className="mb-6">
            <div className="flex flex-col md:flex-row gap-4 items-center">
                <Input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} label="Start Date" />
                <Input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} label="End Date" />
                <div className="pt-5 flex gap-2">
                    <Button onClick={generateReport} disabled={loading}>{loading ? 'Generating...' : 'Generate Report'}</Button>
                    <Button onClick={handleExportPDF} disabled={!reportData} variant="secondary">Export PDF</Button>
                    <Button onClick={handleExportCSV} disabled={!reportData} variant="secondary">Export CSV</Button>
                </div>
            </div>
        </Card>

        {loading && <div className="flex justify-center mt-8"><Spinner /></div>}
        
        {!loading && !reportData && (
            <Card>
                <p className="text-center text-gray-500">Please select a date range and generate a report to see the data.</p>
            </Card>
        )}

        {reportData && (
            <div className="space-y-6">
                {/* Sales & Profit Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card title="Sales Summary">
                        <div className="space-y-4">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Total Orders</span>
                                <span className="font-bold">{reportData.totalOrders}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Total Revenue</span>
                                <span className="font-bold">{formatCurrency(reportData.totalRevenue)}</span>
                            </div>
                             <div className="flex justify-between">
                                <span className="text-gray-600">Total Products Sold</span>
                                <span className="font-bold">{reportData.totalProductsSold}</span>
                            </div>
                        </div>
                    </Card>
                    <Card title="Profit & Loss">
                        <div className="space-y-4">
                             <div className="flex justify-between">
                                <span className="text-green-600">Total Revenue</span>
                                <span className="font-bold text-green-600">{formatCurrency(reportData.totalRevenue)}</span>
                            </div>
                             <div className="flex justify-between">
                                <span className="text-red-600">(-) Total Expenses</span>
                                <span className="font-bold text-red-600">{formatCurrency(reportData.totalOperationalExpenses)}</span>
                            </div>
                            <div className={`flex justify-between border-t pt-2 mt-2 ${reportData.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                <span className="font-bold text-lg">Net Profit / Loss</span>
                                <span className="font-bold text-lg">{formatCurrency(reportData.profit)}</span>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Customer Report */}
                <Card title={`Active Customers in Period (${reportData.customers.length} total)`}>
                     <div className="overflow-x-auto max-h-96">
                        <table className="min-w-full leading-normal">
                            <thead>
                                <tr>
                                    <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Customer Name</th>
                                    <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Orders</th>
                                    <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Total Spent</th>
                                    <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.customers.map(customer => (
                                    <tr key={customer.id}>
                                        <td className="px-5 py-3 border-b border-gray-200 bg-white text-sm">{customer.fullName}</td>
                                        <td className="px-5 py-3 border-b border-gray-200 bg-white text-sm">{customer.orderCount}</td>
                                        <td className="px-5 py-3 border-b border-gray-200 bg-white text-sm">{formatCurrency(customer.totalSpent ?? 0)}</td>
                                        <td className="px-5 py-3 border-b border-gray-200 bg-white text-sm text-right">
                                            {(customer.orderCount ?? 0) > 0 && 
                                                <Button size="sm" onClick={() => handleViewCustomerOrders(customer.id, customer.fullName)}>View Orders</Button>
                                            }
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>

                {/* Materials Report */}
                <Card title="Materials Usage Report">
                    <div className="overflow-x-auto max-h-96">
                         <div className="mb-4 text-center">
                            <span className="text-gray-600">Total Material Cost for Period: </span>
                            <span className="font-bold text-lg">{formatCurrency(reportData.totalMaterialCost)}</span>
                        </div>
                        <table className="min-w-full leading-normal">
                            <thead>
                                <tr>
                                    <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Material Name</th>
                                    <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Total Quantity Used</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.materialsUsed.sort((a,b) => a.name.localeCompare(b.name)).map(material => (
                                    <tr key={material.name}>
                                        <td className="px-5 py-3 border-b border-gray-200 bg-white text-sm">{material.name}</td>
                                        <td className="px-5 py-3 border-b border-gray-200 bg-white text-sm">{material.quantity.toFixed(2)} {material.unitLabel}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        )}
        
        {/* Customer Orders Modal */}
        <Modal isOpen={isCustomerModalOpen} onClose={() => setIsCustomerModalOpen(false)} title={`Orders for ${selectedCustomerOrders.customerName}`}>
            <div className="max-h-[60vh] overflow-y-auto">
                <table className="min-w-full leading-normal">
                     <thead>
                        <tr>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Total</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">Items</th>
                        </tr>
                    </thead>
                    <tbody>
                        {selectedCustomerOrders.orders.map(order => (
                            <tr key={order.id}>
                                <td className="px-5 py-3 border-b border-gray-200 bg-white text-sm">
                                    {order.createdAt.toLocaleDateString()}
                                </td>
                                <td className="px-5 py-3 border-b border-gray-200 bg-white text-sm">
                                    {formatCurrency(order.total)}
                                </td>
                                <td className="px-5 py-3 border-b border-gray-200 bg-white text-sm">
                                    {order.items.map(item => `${item.qty}x ${item.name}`).join(', ')}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Modal>

    </div>
  );
};

export default Reports;