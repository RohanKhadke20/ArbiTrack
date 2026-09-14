import { Outlet, Link } from 'react-router-dom';

export const RetailerLayout = () => {
  return (
    <div className="retailer-layout">
      <aside className="retailer-sidebar">
        <h2>Admin Panel</h2>
        <nav>
          <Link to="/admin">Dashboard</Link>
          <Link to="/admin/products">Products</Link>
          <Link to="/admin/orders">Orders</Link>
          <Link to="/admin/settings">Settings</Link>
        </nav>
      </aside>
      <main className="retailer-main">
        <Outlet />
      </main>
    </div>
  );
};
