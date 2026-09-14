import { useState } from 'react';
import { useSecureLiveQuery } from '../../hooks/useSecureLiveQuery';
import { DBEncryptionService } from '../../services/dbService';
import { db } from '../../db/db';
import { useCartStore } from '../../store/useCartStore';
import { Search, Plus } from 'lucide-react';

export const Shop = () => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Fetch products from Dexie, filtering out deleted ones, and decrypt them
  const products = useSecureLiveQuery(
    () => db.products.filter(p => !p.isDeleted).toArray(),
    DBEncryptionService.decryptProduct
  ) || [];

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { items, addToCart, updateQuantity, removeFromCart } = useCartStore();

  return (
    <div>
      <div style={{ padding: '0 16px', marginTop: '16px' }}>
        <div className="input-group" style={{ position: 'relative', marginBottom: '16px' }}>
          <Search size={20} style={{ position: 'absolute', top: '16px', left: '16px', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            className="input-field" 
            placeholder="सामान खोजें / Search items..." 
            style={{ paddingLeft: '48px', fontSize: '1.2rem' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="product-grid">
        {filteredProducts.map(product => {
          const cartItem = items.find(i => i.productId === product.id);
          const quantity = cartItem?.quantity || 0;

          return (
            <div key={product.id} className="product-card">
              <div className="product-image" style={{ 
                backgroundImage: `url(${product.image || 'https://via.placeholder.com/150'})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }} />
              <div className="product-info">
                <div className="product-title">{product.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                  <div className="price"><span className="price-symbol">₹</span>{product.price}</div>
                  
                  {quantity > 0 ? (
                    <div className="qty-control">
                      <button className="qty-btn" onClick={() => {
                        if (quantity === 1) removeFromCart(product.id!);
                        else updateQuantity(product.id!, quantity - 1);
                      }}>-</button>
                      <span className="qty-input" style={{ display: 'inline-block', lineHeight: '40px' }}>{quantity}</span>
                      <button className="qty-btn" onClick={() => updateQuantity(product.id!, quantity + 1)}>+</button>
                    </div>
                  ) : (
                    <button 
                      className="btn-icon" 
                      style={{ background: 'var(--primary)', color: 'white', border: 'none', width: '40px', height: '40px' }}
                      onClick={() => addToCart({
                        productId: product.id!,
                        name: product.name,
                        price: product.price || 0,
                        quantity: 1,
                        image: product.image || ''
                      })}
                    >
                      <Plus size={20} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {filteredProducts.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '1.2rem' }}>
            कोई सामान नहीं मिला / No items found
          </div>
        )}
      </div>
    </div>
  );
};
