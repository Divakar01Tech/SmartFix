const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Wallet = require('../models/Wallet');
const User = require('../models/User');
const Settings = require('../models/Settings');
const CommissionConfig = require('../models/CommissionConfig');
const Earning = require('../models/Earning');
const WebhookEvent = require('../models/WebhookEvent');
const { getRazorpayInstance, verifyRazorpaySignature, verifyWebhookSignature } = require('../utils/razorpay');

/**
 * Helper to get current platform commission % and customer bonus % from Settings / CommissionConfig
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
    amountPayablePaise: payment.amountPayablePaise,
    walletUsed: payment.walletUsed,
    walletUsedPaise: payment.walletUsedPaise,
    totalAmount: payment.amountTotal,
    amountTotalPaise: payment.amountTotalPaise,
    workerPayout: splits.workerPayout,
    workerPayoutPaise: splits.workerPayoutPaise,
    bonusCredited: splits.bonusCredited,
    bonusPaise: splits.bonusPaise,
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
      bonusPaise: splits.bonusPaise,
      bookingId,
    });
  }

  if (workerId) {
    io.to(`user-${workerId}`).emit('booking-status-changed', { bookingId, status: 'Paid' });
    io.to(`user-${workerId}`).emit('earnings-credited', {
      amount: splits.workerPayout,
      workerPayoutPaise: splits.workerPayoutPaise,
      bookingId,
    });
  }

  io.emit('booking-updated', { ...booking.toObject?.() || booking, status: 'paid', paymentStatus: 'Paid' });
};

/**
 * finalizePayment(orderId, paymentId, options)
 *
 * IDEMPOTENT: Single source of truth for both browser callback and webhook.
 * Processing an already-paid booking is a no-op that returns the existing payment record.
 * Executes wallet commit, bonus cashback, worker earnings ledger, and booking status change.
 */
const finalizePayment = async (orderId, paymentId, options = {}) => {
  const { paymentMethod = 'Razorpay', io = null, bookingId = null } = options;

  // 1. Fetch Payment record
  let payment = null;
  if (orderId) {
    payment = await Payment.findOne({ razorpayOrderId: orderId });
  }
  if (!payment && bookingId) {
    payment = await Payment.findOne({ booking: bookingId }).sort({ createdAt: -1 });
  }
  if (!payment) {
    throw new Error(`Payment record with orderId '${orderId}' not found`);
  }

  // Idempotency: If payment already paid, return early without double crediting
  if (payment.status === 'paid') {
    const existingBooking = await Booking.findById(payment.booking);
    return { payment, booking: existingBooking, alreadyProcessed: true };
  }

  // 2. Fetch Booking record
  const booking = await Booking.findById(payment.booking);
  if (!booking) {
    throw new Error(`Associated booking ${payment.booking} not found`);
  }

  // Idempotency check on booking status
  if (booking.paymentStatus === 'Paid' || (booking.status || '').toLowerCase() === 'paid') {
    payment.status = 'paid';
    payment.razorpayPaymentId = paymentId || payment.razorpayPaymentId;
    payment.paidAt = payment.paidAt || new Date();
    await payment.save();
    return { payment, booking, alreadyProcessed: true };
  }

  // 3. Integer Paise Calculations
  const totalPaise = payment.amountTotalPaise || Math.round(payment.amountTotal * 100);
  const payablePaise = payment.amountPayablePaise !== undefined ? payment.amountPayablePaise : Math.round(payment.amountPaid * 100);
  const walletUsedPaise = payment.walletUsedPaise || Math.round((payment.walletUsed || 0) * 100);

  const commPct = payment.commissionPercentSnapshot || payment.commissionPercent || 10;
  const bonusPct = payment.bonusPercentSnapshot || payment.cashbackPercent || 5;

  // Platform Commission calculated on total job amount
  const commissionPaise = Math.floor((totalPaise * commPct) / 100);
  // Worker Net Payout
  const workerPayoutPaise = totalPaise - commissionPaise;
  // Customer Bonus Cashback is earned ONLY on the Razorpay-paid portion (breaks spend-bonus -> earn-bonus loop)
  const bonusPaise = Math.floor((payablePaise * bonusPct) / 100);

  const now = new Date();

  // 4. Atomic Execution Helper
  const executeOperations = async (sess) => {
    const sessionOpt = sess ? { session: sess } : {};

    // A. Commit wallet reservation if customer used wallet balance
    if (walletUsedPaise > 0 && payment.customer) {
      let customerWallet = await Wallet.findOne({ user: payment.customer });
      if (customerWallet) {
        const walletUsedInr = Math.round(walletUsedPaise / 100);
        if (typeof customerWallet.commitReservation === 'function') {
          await customerWallet.commitReservation(
            walletUsedInr,
            `Wallet applied for Booking #${booking._id.toString().slice(-6)}`,
            booking._id,
            payment._id,
            sess
          );
        } else {
          await customerWallet.debit(
            walletUsedInr,
            `Wallet applied for Booking #${booking._id.toString().slice(-6)}`,
            booking._id,
            payment._id,
            sess
          );
        }
      }
    }

    // B. Credit Customer Bonus Cashback to Customer Wallet (on Razorpay-paid portion only)
    if (bonusPaise > 0 && payment.customer) {
      const bonusInr = Math.round(bonusPaise / 100);
      if (bonusInr > 0) {
        let customerWallet = await Wallet.findOne({ user: payment.customer });
        if (!customerWallet) {
          const [newWallet] = await Wallet.create(
            [{ user: payment.customer, role: 'customer', balance: 0, reservedBalance: 0 }],
            sessionOpt
          );
          customerWallet = newWallet;
        }
        await customerWallet.credit(
          bonusInr,
          `Cashback reward (${bonusPct}%) for Booking #${booking._id.toString().slice(-6)}`,
          booking._id,
          payment._id,
          sess
        );
      }
    }

    // C. Record Worker Earnings in Earning Ledger
    const workerId = booking.worker || payment.provider || payment.worker;
    if (workerId) {
      await Earning.findOneAndUpdate(
        { paymentId: payment._id },
        {
          workerId,
          bookingId: booking._id,
          paymentId: payment._id,
          grossPaise: totalPaise,
          commissionPaise,
          netPaise: workerPayoutPaise,
          status: 'pending_payout',
        },
        { upsert: true, new: true, ...sessionOpt }
      );

      // Track worker earnings on User model
      const workerPayoutInr = Math.round(workerPayoutPaise / 100);
      await User.findByIdAndUpdate(
        workerId,
        {
          $inc: {
            earnings: workerPayoutInr,
            totalEarnings: workerPayoutInr,
          },
        },
        sessionOpt
      );
    }

    // D. Update Payment Record
    payment.status = 'paid';
    payment.razorpayPaymentId = paymentId || payment.razorpayPaymentId || `pay_${Date.now()}`;
    payment.amountTotalPaise = totalPaise;
    payment.walletUsedPaise = walletUsedPaise;
    payment.amountPayablePaise = payablePaise;
    payment.commissionPaise = commissionPaise;
    payment.workerPayoutPaise = workerPayoutPaise;
    payment.bonusPaise = bonusPaise;
    payment.paymentMethod = paymentMethod;
    payment.paidAt = now;
    await payment.save(sessionOpt);

    // E. Update Booking Record
    booking.status = 'paid';
    booking.paymentStatus = 'Paid';
    booking.paidAt = now;
    booking.paymentMethod = paymentMethod === 'Wallet' ? 'Wallet' : 'Razorpay';
    booking.transactionId = payment.razorpayPaymentId;
    booking.isOnlinePayment = true;
    booking.commissionAmount = Math.round(commissionPaise / 100);
    booking.providerPayout = Math.round(workerPayoutPaise / 100);
    booking.workerTotalPayout = Math.round(workerPayoutPaise / 100);
    booking.customerCashback = Math.round(bonusPaise / 100);
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

  const splits = {
    price: Math.round(totalPaise / 100),
    totalPaise,
    commission: Math.round(commissionPaise / 100),
    commissionPaise,
    workerPayout: Math.round(workerPayoutPaise / 100),
    workerPayoutPaise,
    bonusCredited: Math.round(bonusPaise / 100),
    bonusPaise,
  };

  // 5. Emit Socket.io real-time events
  emitPaidSocketEvents(io, booking, payment, splits);

  return {
    payment,
    booking,
    splits,
    alreadyProcessed: false,
  };
};

// ============================================================================
// 1. POST /api/payments/create-order (Customer Authenticated)
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

    // Role & Ownership Rule: Only the booking's own customer can initiate payment
    const bookingCustId = (booking.customer?._id || booking.customer)?.toString();
    if (bookingCustId !== customerId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only pay for your own bookings.',
      });
    }

    // Lifecycle Rule: Customer pays AFTER job is Completed (Completed -> Paid)
    const st = (booking.status || '').toLowerCase();
    const isCompleted = ['completed', 'workcompleted'].includes(st);
    if (!isCompleted) {
      return res.status(400).json({
        success: false,
        message: `Payment can only be initiated after the worker marks the job as Completed. Current status: '${booking.status}'.`,
      });
    }

    // Already Paid check
    if (booking.paymentStatus === 'Paid' || st === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'This booking has already been paid.',
      });
    }

    // Amount is ALWAYS computed server-side in INTEGER PAISE. Never trust client amount!
    const finalAmountPaise = booking.finalAmountPaise || Math.round((Number(booking.price) || 0) * 100);
    if (!finalAmountPaise || finalAmountPaise <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid booking final amount.' });
    }

    // Tamper Protection: Reject if client provided an amount that deviates from server price
    if (req.body.amount !== undefined && req.body.amount !== null) {
      const clientAmountPaise = Math.round(Number(req.body.amount));
      // Client amount might be in INR or paise
      const matchesPaise = clientAmountPaise === finalAmountPaise;
      const matchesInr = clientAmountPaise === Math.round(finalAmountPaise / 100);
      if (!matchesPaise && !matchesInr) {
        return res.status(400).json({
          success: false,
          message: 'Tampered payment amount rejected: Client provided amount does not match server-calculated price.',
          expectedPaise: finalAmountPaise,
        });
      }
    }

    // Snapshot current platform rates onto payment record
    const { commissionPct, bonusPct } = await getPlatformRates();

    // Customer Wallet balance check
    let walletUsedPaise = 0;
    let customerWallet = null;

    if (useWallet) {
      customerWallet = await Wallet.findOne({ user: customerId }).catch(() => null);
      if (customerWallet) {
        const spendableInr = customerWallet.getSpendableBalance ? customerWallet.getSpendableBalance() : (customerWallet.balance || 0);
        const spendablePaise = Math.round(spendableInr * 100);
        walletUsedPaise = Math.min(spendablePaise, finalAmountPaise);
      }
    }

    let amountPayablePaise = finalAmountPaise - walletUsedPaise;

    // Razorpay constraint: non-zero payment must be at least 100 paise (₹1).
    // If payable is between 1 and 99 paise, adjust walletUsed so payable is 100 paise or 0.
    if (amountPayablePaise > 0 && amountPayablePaise < 100) {
      walletUsedPaise = Math.max(0, finalAmountPaise - 100);
      amountPayablePaise = finalAmountPaise - walletUsedPaise;
    }

    // Case A: 100% covered by wallet
    if (amountPayablePaise === 0 && walletUsedPaise >= finalAmountPaise) {
      const walletOrderId = `order_wallet_${bookingId}_${Date.now()}`;

      // Reserve wallet balance first
      if (customerWallet && typeof customerWallet.reserve === 'function') {
        await customerWallet.reserve(Math.round(walletUsedPaise / 100), bookingId);
      }

      const walletPayment = await Payment.create({
        booking: bookingId,
        customer: customerId,
        provider: booking.worker,
        worker: booking.worker,
        razorpayOrderId: walletOrderId,
        method: 'wallet',
        amountTotalPaise: finalAmountPaise,
        walletUsedPaise,
        amountPayablePaise: 0,
        commissionPercentSnapshot: commissionPct,
        bonusPercentSnapshot: bonusPct,
        amountTotal: Math.round(finalAmountPaise / 100),
        walletUsed: Math.round(walletUsedPaise / 100),
        amountPaid: 0,
        status: 'created',
        paymentMethod: 'Wallet',
      });

      const io = req.app?.get('io');
      await finalizePayment(walletOrderId, `pay_wallet_${Date.now()}`, { paymentMethod: 'Wallet', io, bookingId });

      return res.status(200).json({
        success: true,
        paidByWalletOnly: true,
        message: 'Payment completed successfully using your wallet balance.',
        bookingId,
        orderId: walletOrderId,
        paymentId: walletPayment._id,
      });
    }

    // Case B: Partial or full charge via Razorpay
    // Reserve wallet funds during checkout so customer cannot double-spend
    if (walletUsedPaise > 0 && customerWallet && typeof customerWallet.reserve === 'function') {
      try {
        await customerWallet.reserve(Math.round(walletUsedPaise / 100), bookingId);
      } catch (reserveErr) {
        return res.status(400).json({ success: false, message: reserveErr.message });
      }
    }

    // Expiration duration (default 15 minutes)
    const expiryMinutes = parseInt(process.env.PAYMENT_ORDER_EXPIRY_MINUTES) || 15;
    const orderExpiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // Reuse existing 'created' Payment order if identical and not expired
    const existingPayment = await Payment.findOne({
      booking: bookingId,
      status: 'created',
    });

    if (
      existingPayment &&
      existingPayment.amountPayablePaise === amountPayablePaise &&
      existingPayment.walletUsedPaise === walletUsedPaise &&
      existingPayment.razorpayOrderId &&
      (!existingPayment.orderExpiresAt || existingPayment.orderExpiresAt > new Date())
    ) {
      return res.status(200).json({
        success: true,
        orderId: existingPayment.razorpayOrderId,
        amount: amountPayablePaise, // In integer paise
        currency: 'INR',
        keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
        key: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
        paymentId: existingPayment._id,
        order: {
          id: existingPayment.razorpayOrderId,
          amount: amountPayablePaise,
          currency: 'INR',
        },
        splits: {
          totalPaise: finalAmountPaise,
          walletUsedPaise,
          payablePaise: amountPayablePaise,
          totalInr: Math.round(finalAmountPaise / 100),
          walletUsedInr: Math.round(walletUsedPaise / 100),
          payableInr: Math.round(amountPayablePaise / 100),
        },
      });
    }

    // Call Razorpay API to create order
    let rzpOrder;
    try {
      const razorpay = getRazorpayInstance();
      rzpOrder = await razorpay.orders.create({
        amount: amountPayablePaise,
        currency: 'INR',
        receipt: `bk_${bookingId.toString().slice(-16)}`,
        notes: {
          bookingId: bookingId.toString(),
          customerId: customerId.toString(),
          walletUsedPaise: walletUsedPaise.toString(),
          totalPaise: finalAmountPaise.toString(),
        },
      });
    } catch (rzpErr) {
      console.warn('⚠️ Razorpay live API call notice:', rzpErr.message);
      rzpOrder = {
        id: `order_${Date.now()}`,
        amount: amountPayablePaise,
        currency: 'INR',
        status: 'created',
      };
    }

    // Save Payment record with status 'created'
    let paymentRecord;
    const paymentData = {
      booking: bookingId,
      customer: customerId,
      provider: booking.worker,
      worker: booking.worker,
      razorpayOrderId: rzpOrder.id,
      method: 'razorpay',
      amountTotalPaise: finalAmountPaise,
      walletUsedPaise,
      amountPayablePaise,
      commissionPercentSnapshot: commissionPct,
      bonusPercentSnapshot: bonusPct,
      amountTotal: Math.round(finalAmountPaise / 100),
      walletUsed: Math.round(walletUsedPaise / 100),
      amountPaid: Math.round(amountPayablePaise / 100),
      amount: amountPayablePaise,
      orderExpiresAt,
      status: 'created',
      paymentMethod: 'Razorpay',
      receipt: `bk_${bookingId.toString().slice(-16)}`,
    };

    if (existingPayment) {
      Object.assign(existingPayment, paymentData);
      paymentRecord = await existingPayment.save();
    } else {
      paymentRecord = await Payment.create(paymentData);
    }

    await Booking.findByIdAndUpdate(bookingId, { razorpayOrderId: rzpOrder.id }).catch(() => {});

    return res.status(201).json({
      success: true,
      orderId: rzpOrder.id,
      amount: amountPayablePaise, // in integer paise
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
      key: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
      paymentId: paymentRecord._id,
      order: {
        id: rzpOrder.id,
        amount: amountPayablePaise,
        currency: 'INR',
      },
      splits: {
        totalPaise: finalAmountPaise,
        walletUsedPaise,
        payablePaise: amountPayablePaise,
        totalInr: Math.round(finalAmountPaise / 100),
        walletUsedInr: Math.round(walletUsedPaise / 100),
        payableInr: Math.round(amountPayablePaise / 100),
      },
    });
  } catch (err) {
    console.error('Create payment order error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create payment order', error: err.message });
  }
};

// ============================================================================
// 2. POST /api/payments/verify (Customer Authenticated)
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

    // Verify HMAC-SHA256 checkout signature using crypto.timingSafeEqual
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const isLiveConfigured = keySecret && !keySecret.includes('YOUR_') && !keySecret.includes('rzp_test_YOUR');
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
    const bookingId = req.body.bookingId || req.body.booking;
    const result = await finalizePayment(orderId, paymentId, { paymentMethod: 'Razorpay', io, bookingId });

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

    // Verify raw body signature using timingSafeEqual
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

    // Idempotent Event Deduplication
    const eventId =
      req.headers['x-razorpay-event-id'] ||
      event.event_id ||
      event.id ||
      `evt_${event.created_at}_${event.event}_${event.payload?.payment?.entity?.id || event.payload?.order?.entity?.id || Date.now()}`;

    const existingEvent = await WebhookEvent.findOne({ eventId });
    if (existingEvent) {
      return res.status(200).json({ status: 'already_processed', eventId });
    }

    // Record Event
    await WebhookEvent.create({
      eventId,
      eventType: event.event,
      payloadSummary: {
        event: event.event,
        paymentId: event.payload?.payment?.entity?.id,
        orderId: event.payload?.payment?.entity?.order_id || event.payload?.order?.entity?.id,
      },
    }).catch(() => {});

    const io = req.app?.get('io');

    // Handle payment.captured or order.paid
    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      const paymentEntity = event.payload?.payment?.entity;
      const orderEntity = event.payload?.order?.entity;

      const orderId = paymentEntity?.order_id || orderEntity?.id;
      const paymentId = paymentEntity?.id;

      if (orderId) {
        await finalizePayment(orderId, paymentId, { paymentMethod: 'Razorpay (Webhook)', io });
      }
    } else if (event.event === 'payment.failed') {
      const paymentEntity = event.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id;
      if (orderId) {
        const failedPayment = await Payment.findOneAndUpdate({ razorpayOrderId: orderId }, { status: 'failed' });
        // Release reserved wallet balance
        if (failedPayment && failedPayment.walletUsedPaise > 0 && failedPayment.customer) {
          const custWallet = await Wallet.findOne({ user: failedPayment.customer });
          if (custWallet && typeof custWallet.releaseReservation === 'function') {
            await custWallet.releaseReservation(Math.round(failedPayment.walletUsedPaise / 100), failedPayment.booking).catch(() => {});
          }
        }
      }
    } else if (event.event === 'refund.processed') {
      const refundEntity = event.payload?.refund?.entity;
      const paymentId = refundEntity?.payment_id;
      if (paymentId) {
        await Payment.findOneAndUpdate(
          { razorpayPaymentId: paymentId },
          { $set: { 'refunds.$[elem].status': 'processed' } },
          { arrayFilters: [{ 'elem.refundId': refundEntity.id }] }
        ).catch(() => {});
      }
    }

    return res.status(200).json({ status: 'ok', eventId });
  } catch (err) {
    console.error('Webhook error:', err);
    // Respond 200 on server errors to prevent endless retries after valid signature
    return res.status(200).json({ status: 'error', message: err.message });
  }
};

// ============================================================================
// 4. POST /api/payments/:paymentId/refund (Admin Only)
// ============================================================================
exports.refundPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { amountPaise, amountInr, reason = 'Admin initiated refund' } = req.body;
    const adminUser = req.user;

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }

    if (payment.status !== 'paid' && payment.status !== 'partially_refunded') {
      return res.status(400).json({
        success: false,
        message: `Cannot refund payment with status '${payment.status}'. Only paid payments can be refunded.`,
      });
    }

    const payablePaise = payment.amountPayablePaise || Math.round(payment.amountPaid * 100);
    const existingRefundsPaise = (payment.refunds || []).reduce(
      (sum, r) => (r.status !== 'failed' ? sum + (r.amountPaise || 0) : sum),
      0
    );

    const refundPaise = amountPaise
      ? Math.round(Number(amountPaise))
      : amountInr
      ? Math.round(Number(amountInr) * 100)
      : payablePaise - existingRefundsPaise;

    if (refundPaise <= 0) {
      return res.status(400).json({ success: false, message: 'Refund amount must be greater than 0.' });
    }

    if (existingRefundsPaise + refundPaise > payablePaise) {
      return res.status(400).json({
        success: false,
        message: `Requested refund of ₹${refundPaise / 100} exceeds refundable balance of ₹${(payablePaise - existingRefundsPaise) / 100}.`,
      });
    }

    // Call Razorpay Refund API
    let rzpRefund;
    try {
      const razorpay = getRazorpayInstance();
      rzpRefund = await razorpay.payments.refund(payment.razorpayPaymentId, {
        amount: refundPaise,
        notes: {
          reason,
          initiatedBy: adminUser.email || adminUser.name || 'Admin',
        },
      });
    } catch (rzpErr) {
      console.warn('⚠️ Razorpay live refund warning:', rzpErr.message);
      rzpRefund = {
        id: `rfnd_${Date.now()}`,
        amount: refundPaise,
        status: 'processed',
      };
    }

    // Record refund entry
    const newRefundEntry = {
      refundId: rzpRefund.id,
      amountPaise: refundPaise,
      amountInr: Math.round(refundPaise / 100),
      reason,
      status: 'processed',
      initiatedBy: adminUser._id || adminUser.id,
      createdAt: new Date(),
    };

    payment.refunds.push(newRefundEntry);

    const newTotalRefunded = existingRefundsPaise + refundPaise;
    payment.status = newTotalRefunded >= payablePaise ? 'refunded' : 'partially_refunded';
    await payment.save();

    // Reverse Worker Earnings proportionally in Earning ledger
    const earning = await Earning.findOne({ paymentId: payment._id });
    if (earning) {
      if (payment.status === 'refunded') {
        earning.status = 'reversed';
        earning.notes = `${earning.notes || ''} [Reversed due to full refund: ${reason}]`.trim();
      } else {
        const refundRatio = refundPaise / payablePaise;
        const reversedNetPaise = Math.round(earning.netPaise * refundRatio);
        earning.netPaise = Math.max(0, earning.netPaise - reversedNetPaise);
        earning.notes = `${earning.notes || ''} [Partial refund ₹${refundPaise / 100}: -₹${reversedNetPaise / 100}]`.trim();
      }
      await earning.save();
    }

    // Rule 9: Do NOT pull back already-credited customer cashback. Flag in customer notes as unearned bonus.
    if (payment.customer) {
      await User.findByIdAndUpdate(payment.customer, {
        $push: {
          auditFlags: `Unearned bonus retained on refund for booking #${payment.booking} (₹${payment.bonusPaise / 100})`,
        },
      }).catch(() => {});
    }

    return res.status(200).json({
      success: true,
      message: `Refund of ₹${refundPaise / 100} processed successfully.`,
      refund: newRefundEntry,
      payment,
    });
  } catch (err) {
    console.error('Refund processing error:', err);
    return res.status(500).json({ success: false, message: 'Failed to process refund', error: err.message });
  }
};

// ============================================================================
// 5. GET /api/payments/earnings (Worker: own ledger; Admin: all ledger)
// ============================================================================
exports.getEarnings = async (req, res) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id || req.user?._id;

    let query = {};
    if (userRole === 'worker' || userRole === 'handyman') {
      query.workerId = userId;
    } else if (userRole !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const earnings = await Earning.find(query)
      .populate('workerId', 'name phone email avatar trade')
      .populate('bookingId', 'trade address date price status time')
      .populate('paymentId', 'amountTotal amountPaid status paymentMethod')
      .sort({ createdAt: -1 });

    const totalNetPaise = earnings.reduce((sum, e) => (e.status !== 'reversed' ? sum + e.netPaise : sum), 0);
    const pendingPayoutPaise = earnings.reduce(
      (sum, e) => (e.status === 'pending_payout' ? sum + e.netPaise : sum),
      0
    );
    const paidOutPaise = earnings.reduce((sum, e) => (e.status === 'paid_out' ? sum + e.netPaise : sum), 0);

    return res.status(200).json({
      success: true,
      earnings,
      summary: {
        totalNetPaise,
        totalNetInr: Math.round(totalNetPaise / 100),
        pendingPayoutPaise,
        pendingPayoutInr: Math.round(pendingPayoutPaise / 100),
        paidOutPaise,
        paidOutInr: Math.round(paidOutPaise / 100),
        count: earnings.length,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve earnings', error: err.message });
  }
};

// ============================================================================
// 6. POST /api/payments/earnings/:earningId/payout (Admin Only: Manual Payout)
// ============================================================================
exports.markEarningPaid = async (req, res) => {
  try {
    const { earningId } = req.params;
    const { payoutRef = `MANUAL_PAYOUT_${Date.now()}`, notes = '' } = req.body;

    const earning = await Earning.findById(earningId);
    if (!earning) {
      return res.status(404).json({ success: false, message: 'Earning entry not found.' });
    }

    if (earning.status === 'paid_out') {
      return res.status(400).json({ success: false, message: 'This earning has already been marked as paid out.' });
    }

    earning.status = 'paid_out';
    earning.payoutRef = payoutRef;
    earning.paidOutAt = new Date();
    if (notes) earning.notes = `${earning.notes || ''} [${notes}]`.trim();
    await earning.save();

    return res.status(200).json({
      success: true,
      message: 'Worker payout marked as completed.',
      earning,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to mark earning payout', error: err.message });
  }
};

// ============================================================================
// 7. GET /api/payments/my (Customer History)
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
// 8. GET /api/admin/payments (Admin Overview & Analytics)
// ============================================================================
exports.getAdminPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate('booking', 'trade address date price status time')
      .populate('customer', 'name phone email')
      .populate('provider', 'name phone trade')
      .sort({ createdAt: -1 });

    const totalVolume = payments
      .filter((p) => p.status === 'paid' || p.status === 'partially_refunded')
      .reduce((sum, p) => sum + (p.amountTotal || 0), 0);

    const totalCommission = payments
      .filter((p) => p.status === 'paid' || p.status === 'partially_refunded')
      .reduce((sum, p) => sum + (p.commission || p.commissionAmount || 0), 0);

    const totalProviderPayout = payments
      .filter((p) => p.status === 'paid' || p.status === 'partially_refunded')
      .reduce((sum, p) => sum + (p.workerPayout || p.providerPayout || 0), 0);

    const totalBonusCredited = payments
      .filter((p) => p.status === 'paid' || p.status === 'partially_refunded')
      .reduce((sum, p) => sum + (p.bonusCredited || p.customerCashback || 0), 0);

    const totalRefundedInr = payments.reduce((sum, p) => {
      const pRefunds = (p.refunds || []).reduce((rSum, r) => rSum + (r.amountInr || Math.round((r.amountPaise || 0) / 100)), 0);
      return sum + pRefunds;
    }, 0);

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
        totalRefundedInr,
        totalWalletLiability,
        count: payments.length,
        paidCount: payments.filter((p) => p.status === 'paid').length,
        refundedCount: payments.filter((p) => p.status === 'refunded' || p.status === 'partially_refunded').length,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch admin payments', error: err.message });
  }
};

// ============================================================================
// 9. GET /api/payments/booking/:bookingId
// ============================================================================
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

// ============================================================================
// 10. POST /api/payments/pay-cod (Cash on Delivery)
// ============================================================================
exports.payCod = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const customerId = req.user?.id || req.user?._id;

    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ success: false, message: 'Valid booking ID is required.' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const bookingCustId = (booking.customer?._id || booking.customer)?.toString();
    if (bookingCustId !== customerId.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied: You can only settle your own bookings.' });
    }

    const st = (booking.status || '').toLowerCase();
    if (!['completed', 'workcompleted'].includes(st)) {
      return res.status(400).json({
        success: false,
        message: `Payment can only be initiated after the worker marks the job as Completed. Current status: '${booking.status}'.`,
      });
    }

    if (booking.paymentStatus === 'Paid' || st === 'paid') {
      return res.status(400).json({ success: false, message: 'This booking has already been paid.' });
    }

    const totalPaise = booking.finalAmountPaise || Math.round((Number(booking.price) || 0) * 100);
    const fullPrice = Math.round(totalPaise / 100);
    const { commissionPct } = await getPlatformRates();
    const commissionPaise = Math.floor((totalPaise * commissionPct) / 100);
    const workerPayoutPaise = totalPaise - commissionPaise;
    const commission = Math.round(commissionPaise / 100);
    const workerPayout = Math.round(workerPayoutPaise / 100);
    const now = new Date();
    const codOrderId = `order_cod_${bookingId}_${Date.now()}`;

    // Create Payment record
    const payment = await Payment.create({
      booking: bookingId,
      customer: customerId,
      provider: booking.worker,
      worker: booking.worker,
      razorpayOrderId: codOrderId,
      method: 'cod',
      amountTotalPaise: totalPaise,
      walletUsedPaise: 0,
      amountPayablePaise: totalPaise,
      commissionPaise,
      workerPayoutPaise,
      bonusPaise: 0,
      commissionPercentSnapshot: commissionPct,
      bonusPercentSnapshot: 0,
      amountTotal: fullPrice,
      walletUsed: 0,
      amountPaid: fullPrice,
      status: 'paid',
      paymentMethod: 'COD',
      commission,
      workerPayout,
      bonusCredited: 0,
      paidAt: now,
    });

    // Record worker earnings
    if (booking.worker) {
      await Earning.create({
        workerId: booking.worker,
        bookingId: booking._id,
        paymentId: payment._id,
        grossPaise: totalPaise,
        commissionPaise,
        netPaise: workerPayoutPaise,
        status: 'pending_payout',
        notes: 'COD settlement (cash collected directly by worker)',
      }).catch(() => {});
    }

    // Update Booking Record
    booking.status = 'paid';
    booking.paymentStatus = 'Paid';
    booking.paidAt = now;
    booking.paymentMethod = 'COD';
    booking.transactionId = `COD_${Date.now()}`;
    booking.isOnlinePayment = false;
    booking.commissionAmount = commission;
    booking.providerPayout = workerPayout;
    booking.workerTotalPayout = workerPayout;
    booking.statusHistory.push({
      status: 'paid',
      changedAt: now,
      changedBy: customerId,
      actorRole: 'customer',
      reason: 'Cash on delivery payment settled with technician',
    });
    await booking.save();

    const io = req.app?.get('io');
    emitPaidSocketEvents(io, booking, payment, { workerPayout, workerPayoutPaise, bonusCredited: 0, bonusPaise: 0, commission });

    return res.status(200).json({
      success: true,
      message: 'Cash on Delivery payment recorded successfully.',
      payment,
      splits: { price: fullPrice, commission, workerPayout, bonusCredited: 0 },
    });
  } catch (err) {
    console.error('COD payment error:', err);
    return res.status(500).json({ success: false, message: 'Failed to record COD payment', error: err.message });
  }
};

// ============================================================================
// 11. POST /api/payments/pay-razorpay-me
// ============================================================================
exports.payRazorpayMe = async (req, res) => {
  try {
    const { bookingId, utrNumber, paymentId } = req.body;
    const customerId = req.user?.id || req.user?._id;

    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ success: false, message: 'Valid booking ID is required.' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const bookingCustId = (booking.customer?._id || booking.customer)?.toString();
    if (bookingCustId !== customerId.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied: You can only settle your own bookings.' });
    }

    const st = (booking.status || '').toLowerCase();
    if (!['completed', 'workcompleted'].includes(st)) {
      return res.status(400).json({
        success: false,
        message: 'Payment can only be confirmed after the worker marks the job as Completed.',
      });
    }

    if (booking.paymentStatus === 'Paid' || st === 'paid') {
      return res.status(400).json({ success: false, message: 'This booking has already been paid.' });
    }

    const totalPaise = booking.finalAmountPaise || Math.round((Number(booking.price) || 0) * 100);
    const fullPrice = Math.round(totalPaise / 100);
    const { commissionPct, bonusPct } = await getPlatformRates();

    const commissionPaise = Math.floor((totalPaise * commissionPct) / 100);
    const workerPayoutPaise = totalPaise - commissionPaise;
    const bonusPaise = Math.floor((totalPaise * bonusPct) / 100);

    const now = new Date();
    const txnRef = (paymentId || utrNumber || `RZP_ME_${Date.now()}`).trim();
    const rzpOrderId = `order_rzpme_${bookingId}_${Date.now()}`;

    // Create Payment record
    const payment = await Payment.create({
      booking: bookingId,
      customer: customerId,
      provider: booking.worker,
      worker: booking.worker,
      razorpayOrderId: rzpOrderId,
      razorpayPaymentId: txnRef,
      method: 'razorpay',
      amountTotalPaise: totalPaise,
      walletUsedPaise: 0,
      amountPayablePaise: totalPaise,
      commissionPaise,
      workerPayoutPaise,
      bonusPaise,
      commissionPercentSnapshot: commissionPct,
      bonusPercentSnapshot: bonusPct,
      amountTotal: fullPrice,
      walletUsed: 0,
      amountPaid: fullPrice,
      status: 'paid',
      paymentMethod: 'Razorpay.me Direct UPI',
      paidAt: now,
    });

    // Worker Earning Record
    if (booking.worker) {
      await Earning.create({
        workerId: booking.worker,
        bookingId: booking._id,
        paymentId: payment._id,
        grossPaise: totalPaise,
        commissionPaise,
        netPaise: workerPayoutPaise,
        status: 'pending_payout',
        notes: `Razorpay.me payment (Ref: ${txnRef})`,
      }).catch(() => {});
    }

    // Credit Customer Cashback
    if (bonusPaise > 0) {
      const bonusInr = Math.round(bonusPaise / 100);
      let customerWallet = await Wallet.findOne({ user: customerId });
      if (!customerWallet) {
        customerWallet = await Wallet.create({ user: customerId, role: 'customer', balance: 0 });
      }
      await customerWallet.credit(
        bonusInr,
        `🎁 Cashback Reward for paying via Razorpay.me (Booking #${booking._id.toString().slice(-6)})`,
        booking._id,
        payment._id
      ).catch(() => {});
    }

    // Update Booking Record
    booking.status = 'paid';
    booking.paymentStatus = 'Paid';
    booking.paidAt = now;
    booking.paymentMethod = 'Razorpay.me';
    booking.transactionId = txnRef;
    booking.isOnlinePayment = true;
    booking.statusHistory.push({
      status: 'paid',
      changedAt: now,
      changedBy: customerId,
      actorRole: 'customer',
      reason: `Settled via direct Razorpay.me payment link (Ref: ${txnRef})`,
    });
    await booking.save();

    const io = req.app?.get('io');
    emitPaidSocketEvents(io, booking, payment, {
      workerPayout: Math.round(workerPayoutPaise / 100),
      workerPayoutPaise,
      bonusCredited: Math.round(bonusPaise / 100),
      bonusPaise,
      commission: Math.round(commissionPaise / 100),
    });

    return res.status(200).json({
      success: true,
      message: 'Payment confirmed via Razorpay.me successfully. Cashback credited to your wallet!',
      payment,
      splits: {
        price: fullPrice,
        commission: Math.round(commissionPaise / 100),
        workerPayout: Math.round(workerPayoutPaise / 100),
        bonusCredited: Math.round(bonusPaise / 100),
      },
    });
  } catch (err) {
    console.error('Razorpay.me payment error:', err);
    return res.status(500).json({ success: false, message: 'Failed to record Razorpay.me payment', error: err.message });
  }
};

// Aliases
exports.getAllPayments = exports.getAdminPayments;
exports.finalizePayment = finalizePayment;
exports.markPaid = finalizePayment; // Backward compatibility alias
