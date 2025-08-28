
import React, { useState, useEffect } from 'react';
// Fix: Remove v9 firestore imports.
import { db } from '../services/firebase';
import { Material, UnitType } from '../types';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Spinner from '../components/ui/Spinner';
import Select from '../components/ui/Select';
import { UNIT_TYPES, UNIT_LABELS } from '../constants';
import { formatCurrency } from '../utils/formatting';

const Materials: React.FC = () => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  
  const initialFormState: Omit<Material, 'id'> = {
    name: '',
    unitType: 'weight',
    unitLabel: 'g',
    pricePerUnit: 0,
    stockQty: 0,
    minQty: 0,
  };
  const [formState, setFormState] = useState(initialFormState);

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    setLoading(true);
    // Fix: use v8 get() syntax.
    const querySnapshot = await db.collection('materials').get();
    const materialsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Material[];
    setMaterials(materialsData);
    setLoading(false);
  };
  
  const handleOpenModal = (material: Material | null = null) => {
    setSelectedMaterial(material);
    setFormState(material ? material : initialFormState);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedMaterial(null);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let newFormState = { ...formState, [name]: value };

    if (name === 'unitType') {
      // Reset unitLabel if unitType changes
      newFormState.unitLabel = UNIT_LABELS[value as UnitType][0] as 'g' | 'kg' | 'piece';
    }

    setFormState(newFormState);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSave = {
        ...formState,
        pricePerUnit: parseFloat(String(formState.pricePerUnit)),
        stockQty: parseInt(String(formState.stockQty)),
        minQty: parseInt(String(formState.minQty || 0)),
    };

    if (selectedMaterial) {
      // Fix: use v8 update() syntax.
      const materialDoc = db.collection('materials').doc(selectedMaterial.id);
      await materialDoc.update(dataToSave);
    } else {
      // Fix: use v8 add() syntax.
      await db.collection('materials').add(dataToSave);
    }
    fetchMaterials();
    handleCloseModal();
  };
  
  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this material?')) {
        // Fix: use v8 delete() syntax.
        await db.collection('materials').doc(id).delete();
        fetchMaterials();
    }
  };

  if (loading) return <div className="flex justify-center items-center h-full"><Spinner /></div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-semibold text-gray-800">Materials (خامات)</h1>
        <Button onClick={() => handleOpenModal()}>Add Material</Button>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full leading-normal">
            <thead>
              <tr>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Price per Unit</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Stock</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100"></th>
              </tr>
            </thead>
            <tbody>
              {materials.map(material => {
                  const isLowStock = material.minQty ? material.stockQty <= material.minQty : false;
                  return (
                    <tr key={material.id}>
                      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm whitespace-nowrap">{material.name}</td>
                      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm whitespace-nowrap">{formatCurrency(material.pricePerUnit)} / {material.unitLabel}</td>
                      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm whitespace-nowrap">
                          <span className={isLowStock ? 'text-red-600 font-bold' : ''}>{material.stockQty} {material.unitLabel}</span>
                          {isLowStock && <span className="ml-2 text-xs text-white bg-red-500 px-2 py-1 rounded-full">LOW</span>}
                      </td>
                      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-right whitespace-nowrap">
                        <Button size="sm" variant="secondary" className="mr-2" onClick={() => handleOpenModal(material)}>Edit</Button>
                        <Button size="sm" variant="danger" onClick={() => handleDelete(material.id)}>Delete</Button>
                      </td>
                    </tr>
                  )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={selectedMaterial ? 'Edit Material' : 'Add Material'}>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Input label="Material Name" name="name" value={formState.name} onChange={handleFormChange} required />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select label="Unit Type" name="unitType" value={formState.unitType} onChange={handleFormChange} options={UNIT_TYPES.map(t => ({value: t, label: t}))} />
                <Select label="Unit Label" name="unitLabel" value={formState.unitLabel} onChange={handleFormChange} options={(UNIT_LABELS[formState.unitType] || []).map(l => ({value: l, label: l}))} />
            </div>
            <Input label="Price per Unit" name="pricePerUnit" type="number" step="0.01" value={formState.pricePerUnit} onChange={handleFormChange} required />
            <Input label="Stock Quantity" name="stockQty" type="number" value={formState.stockQty} onChange={handleFormChange} required />
            <Input label="Minimum Stock Threshold" name="minQty" type="number" value={formState.minQty} onChange={handleFormChange} />
          </div>
          <div className="mt-6 flex justify-end space-x-2">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Materials;
