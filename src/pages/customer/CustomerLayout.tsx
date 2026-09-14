import { Outlet, Link, useLocation } from 'react-router-dom';
import { ShoppingBag, ShoppingCart } from 'lucide-react';
import { useCartStore, type CartItem } from '../../store/useCartStore';

export const CustomerLayout = () => {
  const location = useLocation();
  const items = useCartStore((state) => state.items);
  const totalItems = items.reduce((acc: number, item: CartItem) => acc + item.quantity, 0);

  return (
    <div className="mobile-container">
      {location.pathname === '/' && (
        <header className="glass-header">
          <div className="flex-row gap-2">
            <div style={{ background: 'var(--primary)', padding: '12px', borderRadius: '16px', color: 'white' }}>
              <ShoppingBag size={32} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.4rem' }}>Shri Kirana</h1>
              <p className="text-muted" style={{ fontSize: '1rem', fontWeight: 600 }}>दुकान / Grocery</p>
            </div>
          </div>
          <Link to="/cart" style={{ position: 'relative', color: 'var(--text-main)' }}>
            <button className="btn-icon">
              <ShoppingCart size={32} />
            </button>
            {totalItems > 0 && <span className="badge" style={{ transform: 'scale(1.2)' }}>{totalItems}</span>}
          </Link>
        </header>
      )}
      
      <main>
        <Outlet />
      </main>

      {/* Floating Bottom Cart Bar for Shop Page */}
      {location.pathname === '/' && totalItems > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 32px)',
          maxWidth: '448px',
          background: 'var(--text-main)',
          color: 'white',
          padding: '20px',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 100,
          boxShadow: 'var(--shadow-lg)'
        }}>
          <div>
            <div style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.8)' }}>{totalItems} सामान (Items)</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>₹{useCartStore.getState().getTotal()}</div>
          </div>
          <Link to="/cart" style={{ textDecoration: 'none' }}>
            <button className="btn btn-primary" style={{ padding: '16px 28px', width: 'auto', display: 'flex', gap: '8px' }}>
              <ShoppingCart size={24} /> कार्ट (Cart)
            </button>
          </Link>
        </div>
      )}
    </div>
  );
};
