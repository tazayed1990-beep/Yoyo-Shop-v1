
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
// Fix: Remove v9 firestore imports.
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

interface MonthlyData {
    name: string;
    Revenue: number;
    Costs: number;
    Profit: number;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [bestSellers, setBestSellers] = useState<RankedItem[]>([]);
  const [topCustomers, setTopCustomers] = useState<RankedItem[]>([]);
  const [monthlyProfitData, setMonthlyProfitData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    // Fix: Use v8 query syntax.
    const ordersQuery = db.collection('orders');
    // Fix: Use v8 collection reference syntax.
    const customersQuery = db.collection('customers');
    const expensesQuery = db.collection('expenses');
    
    // Combined listener for all data sources
    const unsubOrders = ordersQuery.onSnapshot((ordersSnapshot) => {
      const allOrders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      const orders = allOrders.filter(o => !o.isCancelled);
      
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
      const unsubProducts = db.collection('products').onSnapshot((productSnapshot) => {
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

       // Process data for P&L chart
       const unsubExpensesChart = expensesQuery.onSnapshot((expenseSnapshot) => {
            const allExpenses = expenseSnapshot.docs.map(doc => doc.data() as Expense);
            processMonthlyData(orders, allExpenses);
       });


      return () => {
        unsubProducts();
        unsubExpensesChart();
      }
    }, (error) => console.error("Error fetching orders:", error));

    const unsubCustomers = customersQuery.onSnapshot((snapshot) => {
      setStats(prev => ({
        ...prev,
        totalCustomers: snapshot.size,
      } as DashboardStats));
    });

    const unsubExpenses = expensesQuery.onSnapshot((snapshot) => {
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

  const processMonthlyData = (orders: Order[], expenses: Expense[]) => {
    const data: { [month: string]: { revenue: number, materialCost: number, expenses: number } } = {};
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    orders.forEach(order => {
        const date = (order.createdAt as any).toDate(); // Assuming createdAt is a Firestore timestamp
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        if (!data[monthKey]) data[monthKey] = { revenue: 0, materialCost: 0, expenses: 0 };
        data[monthKey].revenue += order.total;
        data[monthKey].materialCost += order.items.reduce((sum, item) => sum + (item.materialsCost * item.qty), 0);
    });

    expenses.forEach(expense => {
        const date = (expense.date as any).toDate(); // Assuming date is a Firestore timestamp
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        if (!data[monthKey]) data[monthKey] = { revenue: 0, materialCost: 0, expenses: 0 };
        data[monthKey].expenses += expense.amount;
    });
    
    const sortedKeys = Object.keys(data).sort((a, b) => {
        const [yearA, monthA] = a.split('-').map(Number);
        const [yearB, monthB] = b.split('-').map(Number);
        if (yearA !== yearB) return yearA - yearB;
        return monthA - monthB;
    });

    const finalChartData = sortedKeys.slice(-6).map(key => { // Get last 6 months of data
        const [year, month] = key.split('-');
        const { revenue, materialCost, expenses } = data[key];
        return {
            name: `${months[parseInt(month, 10)]} '${String(year).slice(2)}`,
            Revenue: revenue,
            Costs: materialCost + expenses,
            Profit: revenue - materialCost - expenses,
        };
    });

    setMonthlyProfitData(finalChartData);
};


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
          <Link to="/orders" className="lg:col-span-1 xl:col-span-2 block hover:shadow-lg transition-shadow duration-200 rounded-lg">
            <Card className="h-full">
              <h4 className="text-gray-500 font-medium">Total Revenue</h4>
              <p className="text-3xl font-bold text-dark truncate">{formatCurrency(stats.totalRevenue)}</p>
              <p className="text-sm text-gray-500">from {stats.totalOrders} orders</p>
            </Card>
          </Link>
          <Link to="/expenses" className="block hover:shadow-lg transition-shadow duration-200 rounded-lg">
            <Card className="h-full">
                <h4 className="text-gray-500 font-medium">Total Expenses</h4>
                <p className="text-3xl font-bold text-dark truncate">{formatCurrency(stats.totalExpenses)}</p>
            </Card>
          </Link>
          <Card>
            <h4 className="text-gray-500 font-medium">Net Profit / Loss</h4>
            <p className={`text-3xl font-bold truncate ${profitLossClass}`}>{formatCurrency(stats.netProfit)}</p>
          </Card>
          <Link to="/orders" className="block hover:shadow-lg transition-shadow duration-200 rounded-lg">
            <Card className="h-full">
                <h4 className="text-gray-500 font-medium">Down Payments</h4>
                <p className="text-3xl font-bold text-dark truncate">{formatCurrency(stats.totalDeposits)}</p>
                <p className="text-sm text-gray-500">from {stats.depositOrdersCount} orders</p>
            </Card>
           </Link>
          <Link to="/customers" className="block hover:shadow-lg transition-shadow duration-200 rounded-lg">
            <Card className="h-full">
                <h4 className="text-gray-500 font-medium">Total Customers</h4>
                <p className="text-3xl font-bold text-dark">{stats.totalCustomers}</p>
            </Card>
          </Link>
        </div>
        
        {/* P&L Chart */}
        <div className="mb-6">
            <Card title="Monthly Profit & Loss">
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={monthlyProfitData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis tickFormatter={(value) => formatCurrency(Number(value))} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Legend />
                        <Bar dataKey="Profit" fill="#10b981" />
                        <Bar dataKey="Revenue" fill="#3b82f6" />
                        <Bar dataKey="Costs" fill="#ef4444" />
                    </BarChart>
                </ResponsiveContainer>
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