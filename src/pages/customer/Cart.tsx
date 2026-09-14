import { Link, useNavigate } from 'react-router-dom';
import { useCartStore } from '../../store/useCartStore';
import { ArrowLeft, Trash2 } from 'lucide-react';

export const Cart = () => {
  const { items, updateQuantity, removeFromCart, getTotal } = useCartStore();
  const navigate = useNavigate();

  return (
    <div className="mobile-container page-container">
      <header className="glass-header" style={{ margin: '-16px -16px 16px -16px' }}>
        <button className="btn-icon" onClick={() => navigate(-1)} style={{ border: 'none' }}>
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ flex: 1, textAlign: 'center', margin: 0 }}>कार्ट / Cart</h2>
        <div style={{ width: 48 }}></div>
      </header>

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ width: 80, height: 80, background: '#F1F5F9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Trash2 size={32} color="var(--text-muted)" />
          </div>
          <h3 className="mb-4">कार्ट खाली है / Cart is empty</h3>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <button className="btn btn-primary" style={{ fontSize: '1.2rem' }}>खरीदारी शुरू करें / Shop</button>
          </Link>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {items.map(item => (
              <div key={item.productId} className="card flex-row space-between">
                <div className="flex-row gap-4" style={{ flex: 1 }}>
                  <div style={{ 
                    width: 60, height: 60, borderRadius: 'var(--radius-sm)',
                    backgroundImage: `url(${item.image || 'https://via.placeholder.com/150'})`,
                    backgroundSize: 'cover', backgroundPosition: 'center'
                  }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    <div className="price" style={{ fontSize: '1.1rem' }}>₹{item.price}</div>
                  </div>
                </div>
                <div className="qty-control" style={{ border: '1px solid #E2E8F0' }}>
                  <button className="qty-btn" onClick={() => {
                    if (item.quantity === 1) removeFromCart(item.productId);
                    else updateQuantity(item.productId, item.quantity - 1);
                  }}>-</button>
                  <span className="qty-input" style={{ display: 'inline-block', lineHeight: '40px' }}>{item.quantity}</span>
                  <button className="qty-btn" onClick={() => updateQuantity(item.productId, item.quantity + 1)}>+</button>
                </div>
              </div>
            ))}
          </div>

          <div className="card mt-4">
            <div className="flex-row space-between mb-4">
              <span className="text-muted" style={{ fontSize: '1.1rem' }}>सामान का कुल / Item Total</span>
              <span style={{ fontWeight: 600, fontSize: '1.2rem' }}>₹{getTotal()}</span>
            </div>
            <div className="flex-row space-between mb-4">
              <span className="text-muted" style={{ fontSize: '1.1rem' }}>डिलीवरी / Delivery</span>
              <span style={{ color: 'var(--secondary)', fontWeight: 600, fontSize: '1.2rem' }}>मुफ़्त / Free</span>
            </div>
            <div style={{ height: 1, background: '#E2E8F0', margin: '16px 0' }}></div>
            <div className="flex-row space-between">
              <span style={{ fontSize: '1.3rem', fontWeight: 700 }}>कुल भुगतान / To Pay</span>
              <span className="price" style={{ fontSize: '1.6rem' }}>₹{getTotal()}</span>
            </div>
          </div>

          <div style={{ marginTop: '32px' }}>
            <Link to="/checkout" style={{ textDecoration: 'none' }}>
              <button className="btn btn-primary" style={{ padding: '24px' }}>
                <span style={{ fontSize: '1.4rem' }}>चेकआउट करें / Checkout</span>
              </button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
};
