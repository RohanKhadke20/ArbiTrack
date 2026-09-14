import { useState } from 'react';
import { useSecureLiveQuery } from '../../hooks/useSecureLiveQuery';
import { DBEncryptionService } from '../../services/dbService';
import { db, type Product } from '../../db/db';
import { addProduct, updateProduct, deleteProduct } from '../../db/queries';
import { Plus, Edit2, Trash2, X } from 'lucide-react';

export const Products = () => {
  const products = useSecureLiveQuery(
    () => db.products.filter(p => !p.isDeleted).reverse().toArray(),
    DBEncryptionService.decryptProduct
  ) || [];
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [image, setImage] = useState(''); // Base64 image

  const openAddModal = () => {
    setEditingId(null);
    setName('');
    setPrice('');
    setStock('100'); // default
    setImage('');
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingId(product.id ?? null);
    setName(product.name);
    setPrice((product.price ?? 0).toString());
    setStock((product.stock ?? 0).toString());
    setImage(product.image || '');
    setIsModalOpen(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!name || !price) {
      alert("नाम और दाम आवश्यक हैं / Name and Price are required.");
      return;
    }

    try {
      if (editingId) {
        await updateProduct(editingId, { name, price: Number(price), stock: Number(stock), image });
      } else {
        await addProduct({
          name,
          price: Number(price),
          stock: Number(stock),
          image
        });
      }
      setIsModalOpen(false);
    } catch (e) {
      console.error(e);
      alert("Failed to save product.");
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("Delete this product?")) {
      await deleteProduct(id);
    }
  };

  return (
    <div className="page-container">
      <div className="flex-row space-between mb-4">
        <h2 style={{ fontSize: '1.4rem' }}>सामान / Inventory</h2>
        <button className="btn btn-primary" style={{ padding: '12px', width: 'auto', borderRadius: '50%' }} onClick={openAddModal}>
          <Plus size={24} />
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {products.length === 0 ? (
          <div className="text-center text-muted" style={{ padding: '40px 20px', fontSize: '1.2rem' }}>
            कोई सामान नहीं जोड़ा गया। + पर क्लिक करें<br/><br/>No products added yet. Click + to add.
          </div>
        ) : (
          products.map((p, idx) => (
            <div key={p.id} className="flex-row space-between" style={{ 
              padding: '16px', 
              borderBottom: idx === products.length - 1 ? 'none' : '1px solid #E2E8F0' 
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '1.3rem' }}>{p.name}</div>
                <div className="text-muted" style={{ fontSize: '1.1rem' }}>₹{p.price} | स्टॉक (Stock): {p.stock}</div>
              </div>
              <div className="flex-row gap-2">
                <button className="btn-icon" style={{ width: 40, height: 40 }} onClick={() => openEditModal(p)}>
                  <Edit2 size={18} color="var(--primary)" />
                </button>
                <button className="btn-icon" style={{ width: 40, height: 40 }} onClick={() => handleDelete(p.id!)}>
                  <Trash2 size={18} color="var(--danger)" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex',
          alignItems: 'flex-end', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--surface)', width: '100%', maxWidth: 480,
            borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)',
            padding: '24px', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))'
          }}>
            <div className="flex-row space-between mb-4">
              <h3 style={{ fontSize: '1.4rem' }}>{editingId ? 'बदलें / Edit' : 'नया सामान / Add'}</h3>
              <button className="btn-icon" style={{ border: 'none' }} onClick={() => setIsModalOpen(false)}>
                <X size={24} />
              </button>
            </div>

            <div className="input-group">
              <label style={{ fontSize: '1.1rem' }}>फ़ोटो / Product Image</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {image ? (
                  <div style={{ width: 80, height: 80, backgroundImage: `url(${image})`, backgroundSize: 'cover', borderRadius: 'var(--radius-sm)' }} />
                ) : (
                  <div style={{ width: 80, height: 80, background: '#E2E8F0', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '2rem', color: '#94A3B8' }}>+</span>
                  </div>
                )}
                <input type="file" accept="image/*" onChange={handleImageUpload} style={{ flex: 1 }} />
              </div>
            </div>

            <div className="input-group">
              <label style={{ fontSize: '1.1rem' }}>नाम / Product Name</label>
              <input type="text" className="input-field" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Aashirvaad Atta 5kg" />
            </div>

            <div className="flex-row gap-4">
              <div className="input-group" style={{ flex: 1 }}>
                <label style={{ fontSize: '1.1rem' }}>दाम (₹) / Price</label>
                <input type="number" className="input-field" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" />
              </div>
              <div className="input-group" style={{ flex: 1 }}>
                <label style={{ fontSize: '1.1rem' }}>स्टॉक / Stock</label>
                <input type="number" className="input-field" value={stock} onChange={e => setStock(e.target.value)} />
              </div>
            </div>

            <button className="btn btn-primary mt-4" style={{ padding: '24px', fontSize: '1.4rem' }} onClick={handleSave}>
              सेव करें / Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
