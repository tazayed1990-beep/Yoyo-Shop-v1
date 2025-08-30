import React, { useState, useEffect } from 'react';
import { db, logActivity } from '../services/firebase';
import { Reward, RewardType } from '../types';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Spinner from '../components/ui/Spinner';
import Select from '../components/ui/Select';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency } from '../utils/formatting';

const REWARD_TYPES: { value: RewardType, label: string }[] = [
  { value: 'customerCount', label: 'Customer Acquisition Count' },
  { value: 'salesVolume', label: 'Total Sales Volume' },
];

const Rewards: React.FC = () => {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const { currentUser } = useAuth();

  const initialFormState: Omit<Reward, 'id'> = {
    name: '',
    type: 'customerCount',
    target: 0,
    rewardAmount: 0,
    timeframeDays: 30,
    isActive: true,
  };
  const [formState, setFormState] = useState(initialFormState);

  useEffect(() => {
    const unsubscribe = db.collection('rewards').onSnapshot(snapshot => {
      const rewardsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reward));
      setRewards(rewardsData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleOpenModal = (reward: Reward | null = null) => {
    setSelectedReward(reward);
    setFormState(reward ? reward : initialFormState);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedReward(null);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
        setFormState(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
        const isNumeric = ['target', 'rewardAmount', 'timeframeDays'].includes(name);
        setFormState(prev => ({ ...prev, [name]: isNumeric ? parseFloat(value) || 0 : value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedReward) {
      await db.collection('rewards').doc(selectedReward.id).update(formState);
      await logActivity(currentUser?.email, 'Update Reward', `Updated reward: ${formState.name}`);
    } else {
      await db.collection('rewards').add(formState);
      await logActivity(currentUser?.email, 'Create Reward', `Created new reward: ${formState.name}`);
    }
    handleCloseModal();
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this reward?')) {
      const rewardToDelete = rewards.find(r => r.id === id);
      await db.collection('rewards').doc(id).delete();
      await logActivity(currentUser?.email, 'Delete Reward', `Deleted reward: ${rewardToDelete?.name}`);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-full"><Spinner /></div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-semibold text-gray-800">Manage Rewards</h1>
        <Button onClick={() => handleOpenModal()}>Create Reward</Button>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full leading-normal">
            <thead>
              <tr>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Target</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100"></th>
              </tr>
            </thead>
            <tbody>
              {rewards.map(reward => (
                <tr key={reward.id}>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{reward.name}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{REWARD_TYPES.find(t => t.value === reward.type)?.label}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{reward.type === 'salesVolume' ? formatCurrency(reward.target) : reward.target}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{formatCurrency(reward.rewardAmount)}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${reward.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {reward.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-right whitespace-nowrap">
                    <Button size="sm" variant="secondary" className="mr-2" onClick={() => handleOpenModal(reward)}>Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(reward.id)}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={selectedReward ? 'Edit Reward' : 'Create Reward'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Reward Name" name="name" value={formState.name} onChange={handleFormChange} required />
          <Select label="Reward Type" name="type" value={formState.type} onChange={handleFormChange} options={REWARD_TYPES} />
          <Input label="Target Value" name="target" type="number" value={formState.target} onChange={handleFormChange} required />
          <Input label="Reward Amount (EGP)" name="rewardAmount" type="number" step="0.01" value={formState.rewardAmount} onChange={handleFormChange} required />
          <Input label="Timeframe (Days)" name="timeframeDays" type="number" value={formState.timeframeDays} onChange={handleFormChange} required />
          <div className="flex items-center">
            <input type="checkbox" id="isActive" name="isActive" checked={formState.isActive} onChange={handleFormChange} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
            <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">Is Active</label>
          </div>
          <div className="mt-6 flex justify-end space-x-2">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>Cancel</Button>
            <Button type="submit">Save Reward</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Rewards;
