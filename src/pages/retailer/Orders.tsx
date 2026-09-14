import { useState } from 'react';
import { useSecureLiveQuery } from '../../hooks/useSecureLiveQuery';
import { DBEncryptionService } from '../../services/dbService';
import { db } from '../../db/db';
import { updateOrderStatus } from '../../db/queries';
import { AuditService } from '../../services/auditService';
import { Package, ChevronDown, ChevronUp } from 'lucide-react';

const STATUS_META: Record<string, { label: string; color: string; emoji: string }> = {
  pending:   { label: 'Pending',   color: '#F59E0B', emoji: '⏳' },
  confirmed: { label: 'Confirmed', color: '#3B82F6', emoji: '✅' },
  delivered: { label: 'Delivered', color: '#10B981', emoji: '🚚' },
  completed: { label: 'Completed', color: '#10B981', emoji: '✔️' },
  cancelled: { label: 'Cancelled', color: '#EF4444', emoji: '❌' },
};

export const Orders = () => {
  const [expanded, setExpanded] = useState<string | null>(null);

  const orders = useSecureLiveQuery(
    () => db.orders.orderBy('createdAt').reverse().toArray(),
    DBEncryptionService.decryptOrder
  ) ?? [];

  const handleStatus = async (orderId: string, status: 'pending' | 'confirmed' | 'delivered' | 'completed' | 'cancelled') => {
    await updateOrderStatus(orderId, status);
    await AuditService.logAction(`ORDER_STATUS: ${orderId} → ${status}`);
  };

  return (
    <div className="page-container">
      <div className="flex-row space-between mb-4">
        <h2 style={{ fontSize: '1.4rem' }}>ऑर्डर / Orders</h2>
        <span style={{ color: '#64748B', fontSize: '0.95rem' }}>{orders.length} orders</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {orders.length === 0 ? (
          <div className="text-center text-muted" style={{ padding: '60px 20px' }}>
            <Package size={48} style={{ margin: '0 auto 16px', opacity: 0.4 }} />
            <p style={{ fontSize: '1.2rem' }}>कोई ऑर्डर नहीं / No orders yet</p>
          </div>
        ) : (
          orders.map(order => {
            const meta = STATUS_META[order.status] ?? STATUS_META.pending;
            const isOpen = expanded === order.id;

            return (
              <div key={order.id} className="card" style={{ padding: '0', overflow: 'hidden' }}>
                {/* Header row — always visible */}
                <div
                  onClick={() => setExpanded(isOpen ? null : order.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', cursor: 'pointer' }}
                >
                  {/* Status badge */}
                  <div style={{
                    background: `${meta.color}20`, color: meta.color,
                    borderRadius: '8px', padding: '6px 10px',
                    fontWeight: 700, fontSize: '0.8rem',
                    letterSpacing: '0.5px', whiteSpace: 'nowrap',
                  }}>
                    {meta.emoji} {meta.label}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {order.customerName}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#64748B' }}>
                      ₹{order.totalAmount} · {(order.paymentMethod ?? 'cash').toUpperCase()} · {new Date(order.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  {isOpen ? <ChevronUp size={20} color="#94A3B8" /> : <ChevronDown size={20} color="#94A3B8" />}
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid #F1F5F9', padding: '16px' }}>
                    {/* Order ID */}
                    <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#64748B', marginBottom: '12px' }}>
                      Order: {order.id}
                    </div>

                    {/* Phone */}
                    <div className="flex-row space-between mb-2" style={{ fontSize: '1rem' }}>
                      <span className="text-muted">Phone</span>
                      <span>+91{order.customerPhone}</span>
                    </div>

                    {/* Items */}
                    <div style={{ background: '#F8FAFC', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                      {(order.items ?? []).map((item, idx) => (
                        <div key={idx} className="flex-row space-between" style={{ fontSize: '1rem', marginBottom: '4px' }}>
                          <span>Product #{item.productId} × {item.quantity}</span>
                          <span style={{ fontWeight: 600 }}>₹{item.price * item.quantity}</span>
                        </div>
                      ))}
                      <div style={{ height: 1, background: '#E2E8F0', margin: '8px 0' }} />
                      <div className="flex-row space-between" style={{ fontWeight: 700, fontSize: '1.2rem' }}>
                        <span>Total</span>
                        <span>₹{order.totalAmount}</span>
                      </div>
                    </div>

                    {/* Status actions */}
                    {order.status === 'pending' && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn btn-primary"
                          style={{ flex: 1, padding: '12px', fontSize: '0.95rem' }}
                          onClick={() => handleStatus(order.id, 'confirmed')}
                        >
                          ✅ Confirm
                        </button>
                        <button
                          className="btn"
                          style={{ flex: 1, padding: '12px', background: '#FEE2E2', color: '#EF4444', fontSize: '0.95rem' }}
                          onClick={() => handleStatus(order.id, 'cancelled')}
                        >
                          ❌ Cancel
                        </button>
                      </div>
                    )}

                    {order.status === 'confirmed' && (
                      <button
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '12px', background: '#10B981' }}
                        onClick={() => handleStatus(order.id, 'delivered')}
                      >
                        🚚 Mark as Delivered
                      </button>
                    )}

                    {(order.status === 'delivered' || order.status === 'completed') && (
                      <div style={{ textAlign: 'center', color: '#10B981', fontWeight: 600, padding: '8px' }}>
                        ✔️ Order Complete
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
