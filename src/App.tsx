import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CustomerLayout }  from './pages/customer/CustomerLayout';
import { RetailerLayout }  from './pages/retailer/RetailerLayout';

import { Shop }         from './pages/customer/Shop';
import { Cart }         from './pages/customer/Cart';
import { Checkout }     from './pages/customer/Checkout';

import { Products }     from './pages/retailer/Products';
import { Settings }     from './pages/retailer/Settings';
import { Orders }       from './pages/retailer/Orders';
import { BackupRestore } from './pages/retailer/BackupRestore';
import { P2PSync }      from './pages/retailer/P2PSync';

import { AppLock }      from './components/AppLock';
import { SecurityBanner } from './components/SecurityBanner';
import { ReAuthModal, RequireRole } from './components/Guards';

const Dashboard = () => (
  <div className="page-container">
    <h2>Dashboard</h2>
    <p className="text-muted">Sales stats and overview will appear here.</p>
  </div>
);

function App() {
  return (
    <AppLock>
      {/* Global device integrity warning — shown on top of everything */}
      <SecurityBanner />

      {/* Global re-auth overlay triggered by withReAuth() */}
      <ReAuthModal />

      <HashRouter>
        <Routes>
          {/* ── Customer Routes (open to all) ── */}
          <Route path="/" element={<CustomerLayout />}>
            <Route index         element={<Shop />} />
            <Route path="cart"     element={<Cart />} />
            <Route path="checkout" element={<Checkout />} />
          </Route>

          {/* ── Retailer Routes ── */}
          <Route path="/admin" element={<RetailerLayout />}>
            <Route index element={
              <RequireRole allowedRoles={['OWNER', 'STAFF']}>
                <Dashboard />
              </RequireRole>
            } />

            {/* Products: both, but delete button hidden for STAFF inside component */}
            <Route path="products" element={
              <RequireRole allowedRoles={['OWNER', 'STAFF']}>
                <Products />
              </RequireRole>
            } />

            {/* Orders: both roles */}
            <Route path="orders" element={
              <RequireRole allowedRoles={['OWNER', 'STAFF']}>
                <Orders />
              </RequireRole>
            } />

            {/* P2P Sync: both roles (Staff may need to sync too) */}
            <Route path="sync" element={
              <RequireRole allowedRoles={['OWNER', 'STAFF']}>
                <P2PSync />
              </RequireRole>
            } />

            {/* Owner-only */}
            <Route path="settings" element={
              <RequireRole allowedRoles={['OWNER']}>
                <Settings />
              </RequireRole>
            } />
            <Route path="backup" element={
              <RequireRole allowedRoles={['OWNER']}>
                <BackupRestore />
              </RequireRole>
            } />

            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppLock>
  );
}

export default App;
