
import React, { useState, useEffect } from 'react';
// Fix: Remove v9 firestore imports.
import { db } from '../services/firebase';
import { Product, Material, ProductMaterial } from '../types';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Spinner from '../components/ui/Spinner';
import Select from '../components/ui/Select';
import { formatCurrency } from '../utils/formatting';

const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  const initialFormState = {
    name: '',
    description: '',
    price: '0',
    materials: [] as ProductMaterial[],
    materialsCost: 0,
  };
  const [formState, setFormState] = useState(initialFormState);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    // Fix: use v8 get() syntax.
    const productsQuery = await db.collection('products').get();
    const productsData = productsQuery.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
    setProducts(productsData);

    // Fix: use v8 get() syntax.
    const materialsQuery = await db.collection('materials').get();
    const materialsData = materialsQuery.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Material[];
    setMaterials(materialsData);
    
    setLoading(false);
  };
  
  const handleOpenModal = (product: Product | null = null) => {
    setSelectedProduct(product);
    if (product) {
      // Fix: Explicitly map properties to form state to handle optional 'description' and avoid including 'id'.
      setFormState({
        name: product.name,
        description: product.description || '',
        price: String(product.price),
        materials: product.materials,
        materialsCost: product.materialsCost,
      });
    } else {
      setFormState(initialFormState);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  const calculateMaterialsCost = (productMaterials: ProductMaterial[]): number => {
    return productMaterials.reduce((total, pm) => {
        const material = materials.find(m => m.id === pm.materialId);
        if (!material) return total;
        // Ensure quantity is a number before calculation
        const quantity = typeof pm.quantity === 'number' ? pm.quantity : 0;
        return total + (material.pricePerUnit * quantity);
    }, 0);
  };

  useEffect(() => {
    const cost = calculateMaterialsCost(formState.materials);
    setFormState(prev => ({ ...prev, materialsCost: cost }));
  }, [formState.materials, materials]);


  const handleMaterialChange = (index: number, field: keyof ProductMaterial, value: any) => {
    const updatedMaterials = [...formState.materials];
    const materialId = field === 'materialId' ? value : updatedMaterials[index].materialId;
    const material = materials.find(m => m.id === materialId);
    
    updatedMaterials[index] = {
      ...updatedMaterials[index],
      [field]: value,
      name: material?.name || ''
    };
    setFormState(prev => ({...prev, materials: updatedMaterials}));
  };

  const addMaterialRow = () => {
    setFormState(prev => ({...prev, materials: [...prev.materials, { materialId: '', name: '', quantity: 0 }]}));
  };
  
  const removeMaterialRow = (index: number) => {
    const updatedMaterials = formState.materials.filter((_, i) => i !== index);
    setFormState(prev => ({...prev, materials: updatedMaterials}));
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSave = {
        ...formState,
        price: parseFloat(formState.price),
    };

    if (selectedProduct) {
      // Fix: Use v8 update() syntax.
      const productDoc = db.collection('products').doc(selectedProduct.id);
      await productDoc.update(dataToSave);
    } else {
      // Fix: Use v8 add() syntax.
      await db.collection('products').add(dataToSave);
    }
    fetchData();
    handleCloseModal();
  };
  
  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
        // Fix: Use v8 delete() syntax.
        await db.collection('products').doc(id).delete();
        fetchData();
    }
  };

  if (loading) return <div className="flex justify-center items-center h-full"><Spinner /></div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-semibold text-gray-800">Products</h1>
        <Button onClick={() => handleOpenModal()}>Add Product</Button>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full leading-normal">
            <thead>
              <tr>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Materials Cost</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Price</th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100"></th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => (
                <tr key={product.id}>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{product.name}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{formatCurrency(product.materialsCost)}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{formatCurrency(product.price)}</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-right whitespace-nowrap">
                    <Button size="sm" variant="secondary" className="mr-2" onClick={() => handleOpenModal(product)}>Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(product.id)}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={selectedProduct ? 'Edit Product' : 'Add Product'}>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Input label="Product Name" name="name" value={formState.name} onChange={handleFormChange} required />
            <textarea name="description" value={formState.description} onChange={handleFormChange} placeholder="Description" className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
            
            <div className="border-t pt-4">
              <h3 className="text-lg font-medium">Materials</h3>
                {formState.materials.map((pm, index) => {
                  const material = materials.find(m => m.id === pm.materialId);
                  return (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center mt-2">
                      <div className="col-span-6">
                        <Select
                          value={pm.materialId}
                          onChange={(e) => handleMaterialChange(index, 'materialId', e.target.value)}
                          options={[{ value: '', label: 'Select Material'}, ...materials.map(m => ({ value: m.id, label: m.name }))]}
                        />
                      </div>
                      <div className="col-span-5 flex items-center">
                          <Input
                            type="number"
                            placeholder="Qty"
                            value={pm.quantity}
                            onChange={(e) => handleMaterialChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-full"
                          />
                          {material && <span className="ml-2 text-sm text-gray-600 whitespace-nowrap">{material.unitLabel}</span>}
                      </div>
                      <div className="col-span-1">
                          <Button type="button" variant="danger" size="sm" onClick={() => removeMaterialRow(index)}>X</Button>
                      </div>
                    </div>
                  );
                })}
              <Button type="button" size="sm" className="mt-2" onClick={addMaterialRow}>+ Add Material</Button>
            </div>

            <div>
                <p>
                    Calculated Materials Cost: <span className="font-bold">{formatCurrency(formState.materialsCost)}</span>
                    {selectedProduct && selectedProduct.materialsCost.toFixed(2) !== formState.materialsCost.toFixed(2) && (
                        <span className="text-sm text-orange-600 ml-2 animate-pulse">
                            (was {formatCurrency(selectedProduct.materialsCost)})
                        </span>
                    )}
                </p>
            </div>
            <Input label="Final Selling Price" name="price" type="number" step="0.01" value={formState.price} onChange={handleFormChange} required />

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

export default Products;
