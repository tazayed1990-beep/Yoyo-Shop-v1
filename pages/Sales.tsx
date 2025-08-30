import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { useApp } from '../hooks/useApp';
import { Order, Customer, User, EarnedReward } from '../types';
import Spinner from '../components/ui/Spinner';
import Card from '../components/ui/Card';
import { formatCurrency } from '../utils/formatting';

const Sales: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [referredUsers, setReferredUsers] = useState<User[]>([]);
  const [earnedRewards, setEarnedRewards] = useState<EarnedReward[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();
  const { settings } = useApp();

  useEffect(() => {
    if (!currentUser) return;

    const fetchData = async () => {
      setLoading(true);
      
      const ordersQuery = db.collection('orders').where('salespersonId', '==', currentUser.uid);
      const customersQuery = db.collection('customers').where('referredById', '==', currentUser.uid);
      const usersQuery = db.collection('users').where('referredById', '==', currentUser.uid);
      const rewardsQuery = db.collection('earnedRewards').where('salespersonId', '==', currentUser.uid);

      const [ordersSnap, customersSnap, usersSnap, rewardsSnap] = await Promise.all([
        ordersQuery.get(),
        customersQuery.get(),
        usersQuery.get(),
        rewardsQuery.get(),
      ]);

      setOrders(ordersSnap.docs.map(doc => doc.data() as Order));
      setCustomers(customersSnap.docs.map(doc => doc.data() as Customer));
      setReferredUsers(usersSnap.docs.map(doc => doc.data() as User));
      setEarnedRewards(rewardsSnap.docs.map(doc => doc.data() as EarnedReward));
      
      setLoading(false);
    };

    fetchData();
  }, [currentUser]);

  const stats = useMemo(() => {
    const activeOrders = orders.filter(o => !o.isCancelled);
    const totalSales = activeOrders.reduce((sum, order) => sum + order.total, 0);
    const commissionRate = settings?.commissionRate || 0;
    const commissionEarned = totalSales * (commissionRate / 100);
    const totalRewards = earnedRewards.reduce((sum, reward) => sum + reward.amount, 0);

    return {
      totalSales,
      totalOrders: activeOrders.length,
      customersAcquired: customers.length,
      commissionEarned,
      totalRewards
    };
  }, [orders, customers, settings, earnedRewards]);

  if (loading) {
    return <div className="flex justify-center items-center h-full"><Spinner /></div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold text-gray-800 mb-6">My Sales Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Card>
          <h4 className="text-gray-500 font-medium">Total Sales</h4>
          <p className="text-3xl font-bold text-dark">{formatCurrency(stats.totalSales)}</p>
          <p className="text-sm text-gray-500">from {stats.totalOrders} orders</p>
        </Card>
        <Card>
          <h4 className="text-gray-500 font-medium">Commission Earned</h4>
          <p className="text-3xl font-bold text-secondary">{formatCurrency(stats.commissionEarned)}</p>
          <p className="text-sm text-gray-500">at {settings?.commissionRate || 0}% rate</p>
        </Card>
        <Card>
          <h4 className="text-gray-500 font-medium">Bonuses Earned</h4>
          <p className="text-3xl font-bold text-secondary">{formatCurrency(stats.totalRewards)}</p>
          <p className="text-sm text-gray-500">from {earnedRewards.length} rewards</p>
        </Card>
        <Card>
          <h4 className="text-gray-500 font-medium">Customers Acquired</h4>
          <p className="text-3xl font-bold text-dark">{stats.customersAcquired}</p>
          <p className="text-sm text-gray-500">in your network</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="My Referral Network">
          <div>
            <h3 className="font-semibold mb-2">Referred Customers ({customers.length})</h3>
            {customers.length > 0 ? (
              <ul className="divide-y divide-gray-200 max-h-60 overflow-y-auto">
                {customers.map((c, i) => <li key={i} className="py-2">{c.fullName} - {c.phoneNumber}</li>)}
              </ul>
            ) : <p className="text-gray-500">No customers referred yet.</p>}
          </div>
          <div className="mt-4">
            <h3 className="font-semibold mb-2">Referred Agents ({referredUsers.length})</h3>
             {referredUsers.length > 0 ? (
              <ul className="divide-y divide-gray-200 max-h-60 overflow-y-auto">
                {referredUsers.map(u => <li key={u.uid} className="py-2">{u.name || u.email} ({u.role})</li>)}
              </ul>
            ) : <p className="text-gray-500">No agents referred yet.</p>}
          </div>
        </Card>

        <Card title="Earned Rewards">
          {earnedRewards.length > 0 ? (
            <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
              {earnedRewards.map(reward => (
                <li key={reward.id} className="flex justify-between items-center py-3">
                  <div>
                    <p className="font-medium text-gray-800">{reward.rewardName}</p>
                    <p className="text-sm text-gray-500">Earned on {(reward.dateEarned as any)?.toDate().toLocaleDateString()}</p>
                  </div>
                  <span className="text-lg font-bold text-green-600">{formatCurrency(reward.amount)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-gray-500">No special bonuses earned yet.</p>}
        </Card>
      </div>

    </div>
  );
};

export default Sales;
