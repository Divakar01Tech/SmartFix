const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Wallet = require('../models/Wallet');
const User = require('../models/User');
const Settings = require('../models/Settings');
const CommissionConfig = require('../models/CommissionConfig');
const { getRazorpayInstance, verifyRazorpaySignature, verifyWebhookSignature } = require('../utils/razorpay');

/**
 * Helper to get current commission % and customer bonus % from Settings / CommissionConfig
 */
const getPlatformRates = async () => {
  let commissionPct = 10;
  let bonusPct = 5;

  try {
    const settings = await Settings.findOne().sort({ createdAt: -1 });
    if (settings) {
      if (typeof settings.commissionPercent === 'number') commissionPct = settings.commissionPercent;
      if (typeof settings.customerBonusPercent === 'number') bonusPct = settings.customerBonusPercent;
    } else {
      const config = await CommissionConfig.findOne({ key: 'platform_commission' });
      if (config) {
        if (typeof config.commissionPercent === 'number') commissionPct = config.commissionPercent;
        if (typeof config.cashbackPercent === 'number') bonusPct = config.cashbackPercent;
      }
    }
  } catch (e) {
    console.warn('Error reading platform rates, using defaults (10% commission, 5% bonus):', e.message);
  }

  return { commissionPct, bonusPct };
};

/**
 * Helper to emit Socket.io events when booking is marked Paid
 */
const emitPaidSocketEvents = (io, booking, payment, splits) => {
  if (!io || !booking) return;

  const bookingId = booking._id?.toString() || booking.id?.toString();
  const customerId = (booking.customer?._id || booking.customer)?.toString();
  const workerId = (booking.worker?._id || booking.worker)?.toString();

  const payload = {
    bookingId,
    status: 'Paid',
    paymentStatus: 'Paid',
    amountPaid: payment.amountPaid,
    walletUsed: payment.walletUsed,
    totalAmount: payment.amountTotal,
    workerPayout: splits.workerPayout,
    bonusCredited: splits.bonusCredited,
    paidAt: payment.paidAt,
  };

  io.to(`booking-${bookingId}`).emit('booking-status-changed', { bookingId, status: 'Paid' });
  io.to(`booking:${bookingId}`).emit('booking-status-changed', { bookingId, status: 'Paid' });
  io.to(`booking-${bookingId}`).emit('payment-success', payload);
  io.to(`booking:${bookingId}`).emit('payment-success', payload);

  if (customerId) {
    io.to(`user-${customerId}`).emit('booking-status-changed', { bookingId, status: 'Paid' });
    io.to(`user-${customerId}`).emit('cashback-credited', {
      amount: splits.bonusCredited,
      bookingId,
    });
  }

  if (workerId) {
    io.to(`user-${workerId}`).emit('booking-status-changed', { bookingId, status: 'Paid' });
    io.to(`user-${workerId}`).emit('earnings-credited', {
      amount: splits.workerPayout,
      bookingId,
    });
  }

  io.emit('booking-updated', { ...booking.toObject?.() || booking, status: 'paid', paymentStatus: 'Paid' });
};

/**
 * markPaid(orderId, paymentId, options)
 *
 * IDEMPOTENT: Returns early if payment is already marked paid.
 * Executes wallet deductions, bonus cashback, worker payout, and status update inside a transaction.
 */
const markPaid = async (orderId, paymentId, options = {}) => {
  const { paymentMethod = 'Razorpay', io = null } = options;

  // 1. Fetch Payment record
  const payment = await Payment.findOne({ razorpayOrderId: orderId });
  if (!payment) {
    throw new Error(`Payment record with orderId '${orderId}' not found`);
  }

  // Idempotency: If payment already paid, return early without double crediting
  if (payment.status === 'paid') {
    return { payment, alreadyProcessed: true };
  }

  // 2. Fetch Booking record
  const booking = await Booking.findById(payment.booking);
  if (!booking) {
    throw new Error(`Associated booking ${payment.booking} not found`);
  }

  // Idempotency: If booking already paid, sync payment status and return early
  if (booking.paymentStatus === 'Paid' || (booking.status || '').toLowerCase() === 'paid') {
    payment.status = 'paid';
    payment.razorpayPaymentId = paymentId || payment.razorpayPaymentId;
    payment.paidAt = payment.paidAt || new Date();
    await payment.save();
    return { payment, alreadyProcessed: true };
  }

  // 3. Compute commission, worker payout, customer bonus
  const { commissionPct, bonusPct } = await getPlatformRates();
  const price = payment.amountTotal || Number(booking.price) || 0;
  const commission = Math.round(price * (commissionPct / 100));
  const workerPayout = price - commission;
  // Customer bonus is credited on the amount paid via Razorpay (or 5% total if online)
  const bonusCredited = Math.round(payment.amountPaid * (bonusPct / 100));

  const now = new Date();

/**
 * Check if current MongoDB deployment supports multi-document transactions (requires ReplicaSet or Sharded)
 */
const supportsTransactions = () => {
  try {
    const desc = mongoose.connection?.client?.topology?.description;
    if (!desc) return false;
    const type = desc.type;
    const setName = desc.setName;
    if (type === 'ReplicaSetWithPrimary' || type === 'Sharded' || Boolean(setName)) {
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
};

  // 4. Atomic Execution (with transaction support & fallback for standalone MongoDB)
  const executeOperations = async (sess) => {
    const sessionOpt = sess ? { session: sess } : {};

    // A. Deduct wallet used if customer applied wallet balance
    if (payment.walletUsed > 0 && payment.customer) {
      let customerWallet = await Wallet.findOne({ user: payment.customer });
      if (customerWallet) {
        await customerWallet.debit(
          payment.walletUsed,
          `Wallet applied for Booking #${booking._id.toString().slice(-6)}`,
          booking._id,
          payment._id,
          sess
        );
      }
    }

    // B. Credit Customer Bonus Cashback to Customer Wallet
    if (bonusCredited > 0 && payment.customer) {
      let customerWallet = await Wallet.findOne({ user: payment.customer });
      if (!customerWallet) {
        const [newWallet] = await Wallet.create(
          [{ user: payment.customer, role: 'customer', balance: 0 }],
          sessionOpt
        );
        customerWallet = newWallet;
      }
      await customerWallet.credit(
        bonusCredited,
        `Customer reward bonus for Booking #${booking._id.toString().slice(-6)}`,
        booking._id,
        payment._id,
        sess
      );
    }

    // C. Credit Worker Payout to Worker's Wallet & User Earnings
    const workerId = booking.worker || payment.provider || payment.worker;
    if (workerId) {
      let workerWallet = await Wallet.findOne({ user: workerId });
      if (!workerWallet) {
        const [newWWallet] = await Wallet.create(
          [{ user: workerId, role: 'worker', balance: 0 }],
          sessionOpt
        );
        workerWallet = newWWallet;
      }
      await workerWallet.credit(
        workerPayout,
        `Earnings payout for Booking #${booking._id.toString().slice(-6)} (Price: ₹${price} - ${commissionPct}% Comm: ₹${commission})`,
        booking._id,
        payment._id,
        sess
      );

      // Track earnings in User model
      await User.findByIdAndUpdate(
        workerId,
        {
          $inc: {
            earnings: workerPayout,
            totalEarnings: workerPayout,
          },
        },
        sessionOpt
      );
    }

    // D. Update Payment Record
    payment.status = 'paid';
    payment.razorpayPaymentId = paymentId || `pay_${Date.now()}`;
    payment.commission = commission;
    payment.commissionAmount = commission;
    payment.workerPayout = workerPayout;
    payment.providerPayout = workerPayout;
    payment.bonusCredited = bonusCredited;
    payment.customerCashback = bonusCredited;
    payment.commissionPercent = commissionPct;
    payment.cashbackPercent = bonusPct;
    payment.paymentMethod = paymentMethod;
    payment.paidAt = now;
    await payment.save(sessionOpt);

    // E. Update Booking Record
    booking.status = 'paid';
    booking.paymentStatus = 'Paid';
    booking.paidAt = now;
    booking.paymentMethod = payment.walletUsed >= price ? 'Wallet' : 'Razorpay';
    booking.transactionId = payment.razorpayPaymentId;
    booking.isOnlinePayment = true;
    booking.commissionAmount = commission;
    booking.providerPayout = workerPayout;
    booking.workerTotalPayout = workerPayout;
    booking.customerCashback = bonusCredited;
    booking.statusHistory.push({
      status: 'paid',
      changedAt: now,
      changedBy: payment.customer,
      actorRole: 'customer',
      reason: `Payment verified successfully via ${paymentMethod}`,
    });

    await booking.save(sessionOpt);
  };

  let session = null;
  let useTransaction = false;

  if (supportsTransactions()) {
    try {
      session = await mongoose.startSession();
      session.startTransaction();
      useTransaction = true;
    } catch (sessErr) {
      session = null;
      useTransaction = false;
    }
  }

  try {
    if (useTransaction && session) {
      await executeOperations(session);
      await session.commitTransaction();
    } else {
      await executeOperations(null);
    }
  } catch (err) {
    if (useTransaction && session) {
      try {
        await session.abortTransaction();
      } catch (abortErr) {}
    }
    // If transaction failed due to replica set requirement, fall back to non-transaction execution
    if (useTransaction && (err.message?.includes('Transaction numbers are only allowed') || err.message?.includes('replica set'))) {
      await executeOperations(null);
    } else {
      throw err;
    }
  } finally {
    if (session) {
      try {
        session.endSession();
      } catch (endErr) {}
    }
  }

  // 5. Emit Socket.io real-time events to booking room & user rooms
  emitPaidSocketEvents(io, booking, payment, { workerPayout, bonusCredited, commission });

  return {
    payment,
    booking,
    splits: { price, commission, workerPayout, bonusCredited },
    alreadyProcessed: false,
  };
};

// ============================================================================
// 1. POST /api/payments/create-order (Auth required)
// ============================================================================
exports.createOrder = async (req, res) => {
  try {
    const { bookingId, useWallet = false } = req.body;
    const customerId = req.user?.id || req.user?._id;

    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ success: false, message: 'Valid booking ID is required.' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    // Business Rule: Only the booking's own customer can pay
    const bookingCustId = (booking.customer?._id || booking.customer)?.toString();
    if (bookingCustId !== customerId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only pay for your own bookings.',
      });
    }

    // Business Rule: Customer pays AFTER worker marks job Completed (Completed -> Paid)
    const st = (booking.status || '').toLowerCase();
    const isCompleted = ['completed', 'workcompleted'].includes(st);
    if (!isCompleted) {
      return res.status(400).json({
        success: false,
        message: `Payment can only be initiated after the worker marks the job as Completed. Current status: '${booking.status}'.`,
      });
    }

    // Business Rule: Already paid check
    if (booking.paymentStatus === 'Paid' || st === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'This booking has already been paid.',
      });
    }

    // Amount is ALWAYS computed server-side from the booking's final price in DB. Never trust client amount!
    const fullPrice = Number(booking.price);
    if (!fullPrice || fullPrice <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid booking price.' });
    }

    // Tamper Protection: Reject if client passed an amount that does not match server-calculated amount
    if (req.body.amount !== undefined && req.body.amount !== null) {
      const clientAmount = Number(req.body.amount);
      if (Math.round(clientAmount) !== Math.round(fullPrice)) {
        return res.status(400).json({
          success: false,
          message: 'Tampered payment amount rejected: Client provided amount does not match server-calculated price.',
          expectedAmount: fullPrice,
          clientAmount,
        });
      }
    }

    // Customer wallet balance calculation
    let walletUsed = 0;
    if (useWallet) {
      const custWallet = await Wallet.findOne({ user: customerId }).catch(() => null);
      const balance = Math.max(0, custWallet?.balance || 0);
      walletUsed = Math.min(balance, fullPrice);
    }

    const amountPaid = fullPrice - walletUsed; // Amount to be charged via Razorpay

    // If wallet covers 100% of price, skip Razorpay and finalize directly
    if (amountPaid === 0 && walletUsed >= fullPrice) {
      const walletOrderId = `order_wallet_${bookingId}_${Date.now()}`;
      const walletPayment = await Payment.create({
        booking: bookingId,
        customer: customerId,
        provider: booking.worker,
        worker: booking.worker,
        razorpayOrderId: walletOrderId,
        amountTotal: fullPrice,
        walletUsed: fullPrice,
        amountPaid: 0,
        amount: 0,
        status: 'created',
        paymentMethod: 'Wallet',
      });

      const io = req.app?.get('io');
      await markPaid(walletOrderId, `pay_wallet_${Date.now()}`, { paymentMethod: 'Wallet', io });

      return res.status(200).json({
        success: true,
        paidWithWallet: true,
        message: 'Payment completed successfully using wallet balance.',
        bookingId,
        orderId: walletOrderId,
      });
    }

    // Business Rule: If an unpaid 'created' order already exists for the booking, reuse it instead of creating duplicate
    const existingPayment = await Payment.findOne({
      booking: bookingId,
      status: 'created',
    });

    if (
      existingPayment &&
      existingPayment.amountPaid === amountPaid &&
      existingPayment.walletUsed === walletUsed &&
      existingPayment.razorpayOrderId
    ) {
      return res.status(200).json({
        success: true,
        orderId: existingPayment.razorpayOrderId,
        amount: Math.round(amountPaid * 100), // in paise
        keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
        key: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
        paymentId: existingPayment._id,
        order: {
          id: existingPayment.razorpayOrderId,
          amount: Math.round(amountPaid * 100),
          currency: 'INR',
        },
        splits: {
          price: fullPrice,
          walletUsed,
          amountPaid,
        },
      });
    }

    // Create Razorpay order
    const amountPaise = Math.round(amountPaid * 100);
    let rzpOrder;
    try {
      const razorpay = getRazorpayInstance();
      rzpOrder = await razorpay.orders.create({
        amount: amountPaise,
        currency: 'INR',
        receipt: `bk_${bookingId.toString().slice(-16)}`,
        notes: {
          bookingId: bookingId.toString(),
          customerId: customerId.toString(),
          walletUsed: walletUsed.toString(),
        },
      });
    } catch (rzpErr) {
      // In development / demo fallback if keys aren't configured with live Razorpay server
      console.warn('⚠️ Razorpay order create fallback:', rzpErr.message);
      rzpOrder = {
        id: `order_${Date.now()}`,
        amount: amountPaise,
        currency: 'INR',
        status: 'created',
      };
    }

    // Save Payment record with status 'created'
    let paymentRecord;
    if (existingPayment) {
      existingPayment.razorpayOrderId = rzpOrder.id;
      existingPayment.amountTotal = fullPrice;
      existingPayment.walletUsed = walletUsed;
      existingPayment.amountPaid = amountPaid;
      existingPayment.amount = amountPaise;
      paymentRecord = await existingPayment.save();
    } else {
      paymentRecord = await Payment.create({
        booking: bookingId,
        customer: customerId,
        provider: booking.worker,
        worker: booking.worker,
        razorpayOrderId: rzpOrder.id,
        amountTotal: fullPrice,
        walletUsed,
        amountPaid,
        amount: amountPaise,
        status: 'created',
        paymentMethod: 'Razorpay',
        receipt: `bk_${bookingId.toString().slice(-16)}`,
      });
    }

    // Link orderId to booking
    await Booking.findByIdAndUpdate(bookingId, { razorpayOrderId: rzpOrder.id }).catch(() => {});

    return res.status(201).json({
      success: true,
      orderId: rzpOrder.id,
      amount: amountPaise,
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
      key: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
      paymentId: paymentRecord._id,
      order: {
        id: rzpOrder.id,
        amount: amountPaise,
        currency: 'INR',
      },
      splits: {
        price: fullPrice,
        walletUsed,
        amountPaid,
      },
    });
  } catch (err) {
    console.error('Create payment order error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create payment order', error: err.message });
  }
};

// ============================================================================
// 2. POST /api/payments/verify (Auth required)
// ============================================================================
exports.verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId: bodyOrderId,
      paymentId: bodyPaymentId,
      signature: bodySignature,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    } = req.body;

    const orderId = razorpay_order_id || razorpayOrderId || bodyOrderId;
    const paymentId = razorpay_payment_id || razorpayPaymentId || bodyPaymentId;
    const signature = razorpay_signature || razorpaySignature || bodySignature;

    if (!orderId || !paymentId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required Razorpay orderId or paymentId',
      });
    }

    // Verify HMAC-SHA256 signature using timingSafeEqual
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const isLiveConfigured = keySecret && !keySecret.includes('YOUR_') && !keySecret.includes('rzp_test_YOUR');

    // In demo mode when mock keys are used without real Razorpay checkout
    const isDemo = (!signature || signature.startsWith('demo_') || paymentId.startsWith('demo_')) && !isLiveConfigured;

    if (!isDemo) {
      if (!signature) {
        return res.status(400).json({ success: false, message: 'Missing razorpay_signature' });
      }
      const isValid = verifyRazorpaySignature(orderId, paymentId, signature);
      if (!isValid) {
        return res.status(400).json({ success: false, message: 'Payment verification failed: invalid signature' });
      }
    }

    const io = req.app?.get('io');
    const result = await markPaid(orderId, paymentId, { paymentMethod: 'Razorpay', io });

    return res.status(200).json({
      success: true,
      message: result.alreadyProcessed
        ? 'Payment already verified and processed.'
        : 'Payment verified and booking marked Paid successfully.',
      payment: result.payment,
      splits: result.splits,
    });
  } catch (err) {
    console.error('Payment verification error:', err);
    return res.status(500).json({ success: false, message: 'Payment verification failed', error: err.message });
  }
};

// ============================================================================
// 3. POST /api/payments/webhook (Mounted BEFORE express.json() with raw body)
// ============================================================================
exports.handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.body; // Buffer from express.raw({ type: 'application/json' })

    if (!signature) {
      return res.status(400).json({ success: false, message: 'Missing x-razorpay-signature header' });
    }

    const isValid = verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
    }

    let event;
    try {
      const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
      event = JSON.parse(bodyStr);
    } catch (parseErr) {
      return res.status(400).json({ success: false, message: 'Invalid JSON payload' });
    }

    const io = req.app?.get('io');

    // Handle payment.captured or order.paid
    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      const paymentEntity = event.payload?.payment?.entity;
      const orderEntity = event.payload?.order?.entity;

      const orderId = paymentEntity?.order_id || orderEntity?.id;
      const paymentId = paymentEntity?.id;

      if (orderId) {
        await markPaid(orderId, paymentId, { paymentMethod: 'Razorpay (Webhook)', io });
      }
    } else if (event.event === 'payment.failed') {
      const paymentEntity = event.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id;
      if (orderId) {
        await Payment.findOneAndUpdate({ razorpayOrderId: orderId }, { status: 'failed' });
      }
    }

    // Always respond 200 for valid signatures
    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('Webhook error:', err);
    // Even if processing throws, valid signature endpoints return 200 to prevent Razorpay retrying indefinitely
    return res.status(200).json({ status: 'error', message: err.message });
  }
};

// ============================================================================
// 4. GET /api/payments/my (Customer History)
// ============================================================================
exports.getMyPayments = async (req, res) => {
  try {
    const customerId = req.user?.id || req.user?._id;
    const payments = await Payment.find({ customer: customerId })
      .populate('booking', 'trade address date price status time')
      .populate('provider', 'name phone trade avatar')
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, payments });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch payment history', error: err.message });
  }
};

// ============================================================================
// 5. GET /api/admin/payments (Admin Only: list, totals, total commission, total wallet liability)
// ============================================================================
exports.getAdminPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate('booking', 'trade address date price status time')
      .populate('customer', 'name phone email')
      .populate('provider', 'name phone trade')
      .sort({ createdAt: -1 });

    // Aggregate statistics
    const totalVolume = payments
      .filter((p) => p.status === 'paid')
      .reduce((sum, p) => sum + (p.amountTotal || 0), 0);

    const totalCommission = payments
      .filter((p) => p.status === 'paid')
      .reduce((sum, p) => sum + (p.commission || p.commissionAmount || 0), 0);

    const totalProviderPayout = payments
      .filter((p) => p.status === 'paid')
      .reduce((sum, p) => sum + (p.workerPayout || p.providerPayout || 0), 0);

    const totalBonusCredited = payments
      .filter((p) => p.status === 'paid')
      .reduce((sum, p) => sum + (p.bonusCredited || p.customerCashback || 0), 0);

    // Total Wallet Liability: Sum of all positive wallet balances in system
    const wallets = await Wallet.find({ balance: { $gt: 0 } });
    const totalWalletLiability = wallets.reduce((sum, w) => sum + (w.balance || 0), 0);

    return res.status(200).json({
      success: true,
      payments,
      stats: {
        totalVolume,
        totalCommission,
        totalProviderPayout,
        totalBonusCredited,
        totalWalletLiability,
        count: payments.length,
        paidCount: payments.filter((p) => p.status === 'paid').length,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch admin payments', error: err.message });
  }
};

// 6. GET /api/payments/booking/:bookingId
exports.getPaymentByBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const payment = await Payment.findOne({ booking: bookingId })
      .populate('booking')
      .populate('customer', 'name phone email')
      .populate('provider', 'name phone trade');

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found for this booking.' });
    }

    return res.status(200).json({ success: true, payment });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve payment', error: err.message });
  }
};

// Aliases
exports.getAllPayments = exports.getAdminPayments;

// Export internal helper for testing
exports.markPaid = markPaid;
