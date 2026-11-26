const cron = require('node-cron');
const Payment = require('../models/Payment');
const Wallet = require('../models/Wallet');
const { finalizePayment } = require('../controllers/paymentController');
const { getRazorpayInstance } = require('../utils/razorpay');

/**
 * Sweeps expired 'created' payment orders, marks them failed,
 * and releases any held/reserved customer wallet balance.
 */
async function sweepExpiredPaymentOrders() {
  try {
    const now = new Date();
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    const expiredPayments = await Payment.find({
      status: 'created',
      $or: [
        { orderExpiresAt: { $lt: now } },
        { orderExpiresAt: null, createdAt: { $lt: fifteenMinutesAgo } },
      ],
    });

    if (expiredPayments.length === 0) return;

    for (const payment of expiredPayments) {
      payment.status = 'failed';
      await payment.save();

      // Release reserved wallet balance
      if (payment.walletUsedPaise > 0 && payment.customer) {
        try {
          const wallet = await Wallet.findOne({ user: payment.customer });
          if (wallet && typeof wallet.releaseReservation === 'function') {
            await wallet.releaseReservation(Math.round(payment.walletUsedPaise / 100), payment.booking);
            console.log(`⏰ Released reserved wallet funds (₹${payment.walletUsedPaise / 100}) for expired order ${payment.razorpayOrderId}`);
          }
        } catch (releaseErr) {
          console.warn(`Failed to release wallet reservation for payment ${payment._id}:`, releaseErr.message);
        }
      }
    }
  } catch (err) {
    console.warn('Error during payment expiration sweep:', err.message);
  }
}

/**
 * Reconciles pending orders with Razorpay directly in case webhook delivery was delayed/missed.
 */
async function reconcilePendingOrdersWithRazorpay(io) {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const pendingOrders = await Payment.find({
      status: 'created',
      method: 'razorpay',
      razorpayOrderId: { $exists: true, $ne: null },
      createdAt: { $gt: twoHoursAgo },
    }).limit(20);

    if (pendingOrders.length === 0) return;

    let razorpay;
    try {
      razorpay = getRazorpayInstance();
    } catch {
      return; // Razorpay not configured with live credentials
    }

    for (const payment of pendingOrders) {
      if (!payment.razorpayOrderId || payment.razorpayOrderId.startsWith('order_mock')) continue;

      try {
        const paymentsList = await razorpay.orders.fetchPayments(payment.razorpayOrderId);
        const items = paymentsList?.items || [];
        const captured = items.find((p) => p.status === 'captured');

        if (captured) {
          console.log(`⏰ Reconciliation: Found captured payment ${captured.id} for order ${payment.razorpayOrderId}. Finalizing...`);
          await finalizePayment(payment.razorpayOrderId, captured.id, {
            paymentMethod: 'Razorpay (Reconciliation)',
            io,
          });
        }
      } catch (fetchErr) {
        // Order might not exist on live server or test mode discrepancy
      }
    }
  } catch (err) {
    console.warn('Error during Razorpay reconciliation:', err.message);
  }
}

function initPaymentReconciliationCron(io) {
  // Run expired order sweep every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    await sweepExpiredPaymentOrders();
  });

  // Run Razorpay sync reconciliation every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    await reconcilePendingOrdersWithRazorpay(io);
  });

  console.log('⏰ Payment Expiry Sweep & Reconciliation Cron initialized');
}

module.exports = {
  initPaymentReconciliationCron,
  sweepExpiredPaymentOrders,
  reconcilePendingOrdersWithRazorpay,
};
