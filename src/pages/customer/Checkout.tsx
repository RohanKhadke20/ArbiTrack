import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../../store/useCartStore';
import { ArrowLeft, Smartphone, User, ShieldCheck, Camera, CheckCircle2, MessageCircle, X } from 'lucide-react';
import { addOrder } from '../../db/queries';
import { AuditService } from '../../services/auditService';

// ── Types ────────────────────────────────────────────────────────────────────
type PaymentMethod = 'upi' | 'cash';
type CheckoutStep  = 'details' | 'confirm' | 'payment' | 'done';

interface OrderSummary {
  orderId: string;
  upiId: string;
  shopName: string;
  total: number;
  upiLink: string;
  waLink: string;
  idempotencyKey: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const encodeWA = (text: string): string =>
  encodeURIComponent(text.replace(/&/g, '%26'));

const buildStructuredMessage = (
  orderId: string,
  customerName: string,
  phone: string,
  items: { name: string; quantity: number; price: number }[],
  total: number,
  method: PaymentMethod,
  signature: string
): string => {
  const itemLines = items
    .map(i => `  • ${i.name} ×${i.quantity} = ₹${i.price * i.quantity}`)
    .join('\n');

  return (
    `🛒 *New Order — ${orderId}*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 *Customer:* ${customerName}\n` +
    `📞 *Phone:* +91${phone}\n\n` +
    `*Items:*\n${itemLines}\n\n` +
    `💰 *Total:* ₹${total}\n` +
    `💳 *Payment:* ${method.toUpperCase()}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🔒 Integrity: ${signature}`
  );
};

// ── Component ─────────────────────────────────────────────────────────────────
export const Checkout = () => {
  const { items, getTotal, clearCart } = useCartStore();
  const navigate = useNavigate();

  const [step,          setStep]          = useState<CheckoutStep>('details');
  const [name,          setName]          = useState('');
  const [phone,         setPhone]         = useState('');
  const [method,        setMethod]        = useState<PaymentMethod>('cash');
  const [loading,       setLoading]       = useState(false);
  const [orderSummary,  setOrderSummary]  = useState<OrderSummary | null>(null);
  const [screenshot,    setScreenshot]    = useState<string | null>(null);
  const [markedPaid,    setMarkedPaid]    = useState(false);
  const [paidError,     setPaidError]     = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate a client-side idempotency key on first render so double-taps are safe
  const idempotencyKey = useRef(crypto.randomUUID());

  const total = getTotal();

  // ── Step 1 → Step 2: validate and build confirmation ─────────────────────
  const handleProceedToConfirm = async () => {
    if (!name.trim())             return alert('Please enter your name');
    if (phone.length < 10)        return alert('Please enter a valid 10-digit phone number');

    setLoading(true);
    try {
      const { getConfig } = await import('../../db/queries');
      const upiId    = ((await getConfig('upiId'))    as string | null) ?? 'shop@upi';
      const shopName = ((await getConfig('shopName')) as string | null) ?? 'Our Shop';
      const retailerPhone = ((await getConfig('retailerPhone')) as string | null) ?? '919999999999';

      // Build HMAC over the order payload
      const { CryptoService } = await import('../../services/cryptoService');
      const msgCore   = `${idempotencyKey.current}|${name}|${phone}|${total}|${method}`;
      const signature = await CryptoService.generateHMAC(msgCore);

      const structuredMsg = buildStructuredMessage(
        idempotencyKey.current.slice(-8).toUpperCase(),
        name, phone, items, total, method, signature
      );

      const waLink  = `https://wa.me/${retailerPhone}?text=${encodeWA(structuredMsg)}`;
      const upiLink = method === 'upi'
        ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(shopName)}&am=${total}&tr=${idempotencyKey.current.slice(-8)}&tn=${encodeURIComponent('Order ' + idempotencyKey.current.slice(-8))}`
        : '';

      setOrderSummary({
        orderId:   idempotencyKey.current.slice(-8).toUpperCase(),
        upiId,
        shopName,
        total,
        upiLink,
        waLink,
        idempotencyKey: idempotencyKey.current,
      });
      setStep('confirm');
    } catch {
      alert('Failed to prepare order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2 → Step 3: save order then trigger UPI/WhatsApp ─────────────────
  const handleConfirmOrder = async () => {
    if (!orderSummary) return;
    setLoading(true);
    try {
      await addOrder(
        {
          customerName:  name,
          customerPhone: phone,
          items: items.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.price })),
          totalAmount:   total,
          paymentMethod: method,
          status:        'pending',
        },
        orderSummary.idempotencyKey
      );

      await AuditService.logAction(`ORDER_PLACED: ${orderSummary.orderId} via ${method.toUpperCase()}`);
      clearCart();

      if (method === 'upi') {
        setStep('payment');
      } else {
        // Cash: open WhatsApp and go to done screen
        window.open(orderSummary.waLink, '_blank');
        setStep('done');
      }
    } catch {
      alert('Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── UPI: open UPI intent ───────────────────────────────────────────────────
  const handleOpenUPI = () => {
    if (!orderSummary) return;
    window.location.href = orderSummary.upiLink;
  };

  // ── UPI: mark as paid + optional screenshot ───────────────────────────────
  const handleMarkPaid = async () => {
    if (!orderSummary) return;
    if (!screenshot) {
      setPaidError('Please upload a screenshot of your payment before confirming.');
      return;
    }
    setPaidError('');
    await AuditService.logAction(`PAYMENT_CONFIRMED: ${orderSummary.orderId}`);
    // Open WhatsApp with the message
    window.open(orderSummary.waLink, '_blank');
    setMarkedPaid(true);
    setStep('done');
  };

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setScreenshot(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // ─────────────────────────────────────────────────────────────────────────
  if (items.length === 0 && step === 'details') {
    return (
      <div className="mobile-container page-container text-center" style={{ paddingTop: 100 }}>
        <h3>कोई आइटम नहीं / No items to checkout</h3>
        <button className="btn btn-primary mt-4" onClick={() => navigate('/')}>Go Back</button>
      </div>
    );
  }

  // ── DONE screen ────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="mobile-container page-container text-center" style={{ paddingTop: 60 }}>
        <CheckCircle2 size={80} color="#10B981" style={{ margin: '0 auto 24px' }} />
        <h2 style={{ fontSize: '2rem', color: '#10B981', marginBottom: '16px' }}>ऑर्डर सफल!</h2>
        <p className="text-muted" style={{ fontSize: '1.2rem', marginBottom: '8px' }}>
          Order ID: <strong>{orderSummary?.orderId}</strong>
        </p>
        <p className="text-muted mb-4">
          {markedPaid ? 'Payment screenshot received. दुकानदार सत्यापित करेगा।' : 'दुकानदार को WhatsApp भेजा गया।'}
        </p>
        <button className="btn btn-primary" style={{ padding: '16px 48px' }} onClick={() => navigate('/')}>
          Shop More
        </button>
      </div>
    );
  }

  // ── UPI PAYMENT screen ─────────────────────────────────────────────────────
  if (step === 'payment' && orderSummary) {
    return (
      <div className="mobile-container page-container">
        <header className="glass-header" style={{ margin: '-16px -16px 24px -16px' }}>
          <h2 style={{ flex: 1, textAlign: 'center', margin: 0 }}>UPI Payment</h2>
        </header>

        {/* Payment details */}
        <div className="card mb-4" style={{ borderLeft: '4px solid #10B981' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <ShieldCheck size={28} color="#10B981" />
            <h3 style={{ margin: 0 }}>Payment Details</h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '1.15rem' }}>
            <tbody>
              {[
                ['Shop Name', orderSummary.shopName],
                ['UPI ID', orderSummary.upiId],
                ['Amount', `₹${orderSummary.total}`],
                ['Order Ref', orderSummary.orderId],
              ].map(([label, val]) => (
                <tr key={label}>
                  <td style={{ padding: '8px 0', color: '#64748B', width: '40%' }}>{label}</td>
                  <td style={{ padding: '8px 0', fontWeight: 700 }}>{val}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          className="btn btn-primary"
          style={{ width: '100%', padding: '20px', fontSize: '1.2rem', marginBottom: '16px' }}
          onClick={handleOpenUPI}
        >
          Open UPI App to Pay ₹{orderSummary.total}
        </button>

        <p style={{ textAlign: 'center', color: '#64748B', marginBottom: '24px', fontSize: '0.95rem' }}>
          Pay using GPay, PhonePe, Paytm, or any UPI app
        </p>

        <div className="card" style={{ borderLeft: '4px solid #F59E0B' }}>
          <h4 style={{ marginBottom: '16px' }}>✅ Payment Done? Upload Screenshot</h4>
          <p className="text-muted mb-4" style={{ fontSize: '0.95rem' }}>
            Upload your payment confirmation screenshot. This helps the shopkeeper verify your payment immediately.
          </p>

          {screenshot ? (
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <img src={screenshot} alt="Payment screenshot" style={{ width: '100%', borderRadius: '8px', maxHeight: '200px', objectFit: 'cover' }} />
              <button
                onClick={() => setScreenshot(null)}
                style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{ border: '2px dashed #CBD5E1', borderRadius: '8px', padding: '32px', textAlign: 'center', cursor: 'pointer', marginBottom: '16px', color: '#64748B' }}
            >
              <Camera size={32} style={{ margin: '0 auto 8px' }} />
              <p>Tap to upload payment screenshot</p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleScreenshotUpload}
            style={{ display: 'none' }}
          />

          {paidError && <div style={{ color: 'var(--danger)', marginBottom: '12px', fontWeight: 600 }}>{paidError}</div>}

          <button
            className="btn btn-primary"
            style={{ width: '100%', padding: '16px', background: '#10B981', fontSize: '1.1rem' }}
            onClick={handleMarkPaid}
          >
            <CheckCircle2 size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} />
            Mark as Paid & Notify Shop
          </button>
        </div>
      </div>
    );
  }

  // ── CONFIRM screen ─────────────────────────────────────────────────────────
  if (step === 'confirm' && orderSummary) {
    return (
      <div className="mobile-container page-container">
        <header className="glass-header" style={{ margin: '-16px -16px 24px -16px' }}>
          <button className="btn-icon" onClick={() => setStep('details')} style={{ border: 'none' }}>
            <ArrowLeft size={24} />
          </button>
          <h2 style={{ flex: 1, textAlign: 'center', margin: 0 }}>Order Summary</h2>
          <div style={{ width: 48 }} />
        </header>

        {/* Order ID */}
        <div style={{ textAlign: 'center', marginBottom: '20px', background: '#EFF6FF', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '0.9rem', color: '#64748B' }}>Order ID</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '4px', fontFamily: 'monospace' }}>
            {orderSummary.orderId}
          </div>
        </div>

        {/* Items */}
        <div className="card mb-4">
          <h4 className="mb-4">Items</h4>
          {items.map((item, idx) => (
            <div key={idx} className="flex-row space-between mb-2" style={{ fontSize: '1.1rem' }}>
              <span>{item.name} × {item.quantity}</span>
              <span style={{ fontWeight: 600 }}>₹{item.price * item.quantity}</span>
            </div>
          ))}
          <div style={{ height: 1, background: '#E2E8F0', margin: '12px 0' }} />
          <div className="flex-row space-between" style={{ fontSize: '1.4rem', fontWeight: 700 }}>
            <span>Total</span>
            <span>₹{total}</span>
          </div>
        </div>

        {/* Customer + method */}
        <div className="card mb-4" style={{ fontSize: '1.05rem' }}>
          <div className="flex-row space-between mb-2">
            <span className="text-muted">Name</span><span style={{ fontWeight: 600 }}>{name}</span>
          </div>
          <div className="flex-row space-between mb-2">
            <span className="text-muted">Phone</span><span style={{ fontWeight: 600 }}>+91{phone}</span>
          </div>
          <div className="flex-row space-between">
            <span className="text-muted">Payment</span>
            <span style={{ fontWeight: 600, color: method === 'upi' ? '#10B981' : '#64748B' }}>
              {method.toUpperCase()}
              {method === 'upi' && ` → ${orderSummary.upiId}`}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" style={{ flex: 1, padding: '16px' }} onClick={() => setStep('details')}>
            Edit
          </button>
          <button className="btn btn-primary" style={{ flex: 2, padding: '16px', fontSize: '1.1rem' }} onClick={handleConfirmOrder} disabled={loading}>
            {loading ? 'Placing...' : 'Confirm Order'}
          </button>
        </div>
      </div>
    );
  }

  // ── DETAILS screen (step 1) ────────────────────────────────────────────────
  return (
    <div className="mobile-container page-container">
      <header className="glass-header" style={{ margin: '-16px -16px 24px -16px' }}>
        <button className="btn-icon" onClick={() => navigate(-1)} style={{ border: 'none' }}>
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ flex: 1, textAlign: 'center', margin: 0 }}>चेकआउट / Checkout</h2>
        <div style={{ width: 48 }} />
      </header>

      {/* Customer details */}
      <div className="card mb-4">
        <h3 className="mb-4" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.3rem' }}>
          <User size={24} className="text-muted" /> आपका विवरण / Your Details
        </h3>

        <div className="input-group">
          <label style={{ fontSize: '1.1rem' }}>पूरा नाम / Full Name</label>
          <input
            type="text"
            className="input-field"
            placeholder="e.g. Rahul Kumar"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="input-group">
          <label style={{ fontSize: '1.1rem' }}>WhatsApp Number</label>
          <div style={{ position: 'relative' }}>
            <Smartphone size={24} style={{ position: 'absolute', top: 20, left: 16, color: 'var(--text-muted)' }} />
            <input
              type="tel"
              className="input-field"
              placeholder="10-digit number"
              style={{ paddingLeft: 48 }}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
          </div>
        </div>
      </div>

      {/* Payment method */}
      <div className="card mb-4">
        <h3 className="mb-4" style={{ fontSize: '1.3rem' }}>भुगतान / Payment Method</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {(['upi', 'cash'] as PaymentMethod[]).map((m) => (
            <label key={m} style={{
              display: 'flex', alignItems: 'center', gap: 16, padding: '20px 16px',
              border: `2px solid ${method === m ? 'var(--primary)' : '#E2E8F0'}`,
              borderRadius: 'var(--radius-md)', cursor: 'pointer',
              background: method === m ? '#FFF7ED' : 'transparent',
              transition: 'all 0.15s',
            }}>
              <input type="radio" name="payment" checked={method === m} onChange={() => setMethod(m)} style={{ width: 24, height: 24 }} />
              <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>
                {m === 'upi' ? '📱 UPI (GPay, PhonePe, Paytm)' : '💵 दुकान पर दें / Pay at Shop'}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Total */}
      <div className="card mb-4">
        <div className="flex-row space-between">
          <span className="text-muted" style={{ fontSize: '1.2rem' }}>कुल राशि / Total</span>
          <span className="price" style={{ fontSize: '1.8rem' }}>₹{total}</span>
        </div>
      </div>

      <div>
        <button
          className="btn btn-primary"
          style={{ padding: '24px' }}
          onClick={handleProceedToConfirm}
          disabled={loading}
        >
          <span style={{ fontSize: '1.5rem' }}>
            {loading ? 'Preparing...' : 'Review Order →'}
          </span>
        </button>
      </div>

      {/* WhatsApp message preview info */}
      <div style={{ marginTop: '16px', padding: '12px', background: '#F0FDF4', borderRadius: '8px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
        <MessageCircle size={20} color="#10B981" style={{ flexShrink: 0, marginTop: '2px' }} />
        <p style={{ fontSize: '0.9rem', color: '#15803D', margin: 0 }}>
          Your order details will be sent to the shopkeeper via WhatsApp with a tamper-proof integrity signature.
        </p>
      </div>
    </div>
  );
};
