import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Order, Customer, Product, DashboardStats, Expense } from '../types';
import Card from '../components/ui/Card';
import Spinner from '../components/ui/Spinner';
import { formatCurrency } from '../utils/formatting';

interface RankedItem {
  id: string;
  name: string;
  count: number;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [bestSellers, setBestSellers] = useState<RankedItem[]>([]);
  const [topCustomers, setTopCustomers] = useState<RankedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    const ordersQuery = query(collection(db, 'orders'), where('isCancelled', '!=', true));
    const customersQuery = collection(db, 'customers');
    const expensesQuery = collection(db, 'expenses');
    
    // Combined listener for all data sources
    const unsubOrders = onSnapshot(ordersQuery, (ordersSnapshot) => {
      const orders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      
      const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
      const depositOrders = orders.filter(order => order.depositPaid && order.depositAmount > 0);
      const totalDeposits = depositOrders.reduce((sum, order) => sum + order.depositAmount, 0);
      const totalMaterialCost = orders.reduce((sum, order) => {
        return sum + order.items.reduce((itemSum, item) => itemSum + (item.materialsCost * item.qty), 0);
      }, 0);

      setStats(prev => ({
          ...prev,
          totalOrders: orders.length,
          totalRevenue,
          totalDeposits,
          depositOrdersCount: depositOrders.length,
          totalMaterialCost,
      } as DashboardStats));

      // Top Customers
      const customerCounts: { [key: string]: { name: string, count: number } } = {};
      orders.forEach(order => {
        if (!customerCounts[order.customerId]) {
          customerCounts[order.customerId] = { name: order.customerName, count: 0 };
        }
        customerCounts[order.customerId].count++;
      });
      const sortedCustomers = Object.entries(customerCounts)
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 5)
        .map(([id, data]) => ({ id, name: data.name, count: data.count }));
      setTopCustomers(sortedCustomers);
      
      // Best Sellers
      const unsubProducts = onSnapshot(collection(db, 'products'), (productSnapshot) => {
        const products = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        const productMap = new Map<string, string>(products.map(p => [p.id, p.name]));
        
        const productSales: { [key: string]: number } = {};
        orders.forEach(order => {
            order.items.forEach(item => {
                productSales[item.productId] = (productSales[item.productId] || 0) + item.qty;
            });
        });

        const sortedProducts = Object.entries(productSales)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([id, count]) => ({ id, name: productMap.get(id) || 'Unknown Product', count }));
        setBestSellers(sortedProducts);
      });

      return () => unsubProducts();
    }, (error) => console.error("Error fetching orders:", error));

    const unsubCustomers = onSnapshot(customersQuery, (snapshot) => {
      setStats(prev => ({
        ...prev,
        totalCustomers: snapshot.size,
      } as DashboardStats));
    });

    const unsubExpenses = onSnapshot(expensesQuery, (snapshot) => {
      const totalExpenses = snapshot.docs.reduce((sum, doc) => sum + (doc.data() as Expense).amount, 0);
      setStats(prev => ({
        ...prev,
        totalExpenses
      } as DashboardStats));
    });

    return () => {
      unsubOrders();
      unsubCustomers();
      unsubExpenses();
    };
  }, []);

  useEffect(() => {
      if (stats && stats.totalRevenue !== undefined && stats.totalMaterialCost !== undefined && stats.totalExpenses !== undefined) {
          const netProfit = stats.totalRevenue - stats.totalMaterialCost - stats.totalExpenses;
          setStats(prev => ({ ...prev, netProfit } as DashboardStats));
          setLoading(false);
      }
  }, [stats?.totalRevenue, stats?.totalMaterialCost, stats?.totalExpenses]);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }
  
  const profitLossClass = stats.netProfit >= 0 ? 'text-green-600' : 'text-red-600';


  return (
    <div>
      <h1 className="text-3xl font-semibold text-gray-800 mb-6">Dashboard</h1>
      
      <>
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-6">
          <Card className="lg:col-span-1 xl:col-span-2">
            <h4 className="text-gray-500 font-medium">Total Revenue</h4>
            <p className="text-3xl font-bold text-dark truncate">{formatCurrency(stats.totalRevenue)}</p>
            <p className="text-sm text-gray-500">from {stats.totalOrders} orders</p>
          </Card>
          <Card>
            <h4 className="text-gray-500 font-medium">Total Expenses</h4>
            <p className="text-3xl font-bold text-dark truncate">{formatCurrency(stats.totalExpenses)}</p>
          </Card>
          <Card>
            <h4 className="text-gray-500 font-medium">Net Profit / Loss</h4>
            <p className={`text-3xl font-bold truncate ${profitLossClass}`}>{formatCurrency(stats.netProfit)}</p>
          </Card>
          <Card>
            <h4 className="text-gray-500 font-medium">Down Payments</h4>
            <p className="text-3xl font-bold text-dark truncate">{formatCurrency(stats.totalDeposits)}</p>
            <p className="text-sm text-gray-500">from {stats.depositOrdersCount} orders</p>
          </Card>
          <Card>
            <h4 className="text-gray-500 font-medium">Total Customers</h4>
            <p className="text-3xl font-bold text-dark">{stats.totalCustomers}</p>
          </Card>
        </div>
        
        {/* Dynamic Data Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Best-Selling Products">
            {bestSellers.length > 0 ? (
              <ul className="divide-y divide-gray-200">
                {bestSellers.map(item => (
                  <li key={item.id} className="flex justify-between items-center py-3">
                    <span className="font-medium text-gray-800">{item.name}</span>
                    <span className="text-sm text-white bg-secondary px-3 py-1 rounded-full">{item.count} sold</span>
                  </li>
                ))}
              </ul>
            ) : <p>No sales data available.</p>}
          </Card>
          <Card title="Most Frequent Customers">
            {topCustomers.length > 0 ? (
               <ul className="divide-y divide-gray-200">
                {topCustomers.map(item => (
                  <li key={item.id} className="flex justify-between items-center py-3">
                    <span className="font-medium text-gray-800">{item.name}</span>
                    <span className="text-sm text-white bg-primary px-3 py-1 rounded-full">{item.count} orders</span>
                  </li>
                ))}
              </ul>
            ) : <p>No customer data available.</p>}
          </Card>
        </div>
      </>
    </div>
  );
};

export default Dashboard;
