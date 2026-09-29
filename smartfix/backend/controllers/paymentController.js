const Razorpay = require('razorpay');
const crypto = require('crypto');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Wallet = require('../models/Wallet');
const CommissionConfig = require('../models/CommissionConfig');

const getRazorpayInstance = () => {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error('Razorpay credentials not configured in .env');
  }
  return new Razorpay({ key_id, key_secret });
};

// POST /api/payments/create-order
// Creates a Razorpay order for a completed booking
exports.createOrder = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const customerId = req.user?.id;

    let booking = null;
    try {
      booking = await Booking.findById(bookingId);
    } catch (e) {}

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.paymentStatus === 'Paid') {
      return res.status(400).json({ message: 'This booking is already paid' });
    }

    if (!['Completed', 'WorkInProgress'].includes(booking.status)) {
      return res.status(400).json({ message: 'Payment can only be initiated after work is completed' });
    }

    // Get current commission config
    let config = await CommissionConfig.findOne({ key: 'platform_commission' });
    if (!config) {
      config = await CommissionConfig.create({ key: 'platform_commission' });
    }

    const amountINR = booking.price;
    const amountPaise = amountINR * 100;

    let razorpayOrder;
    try {
      const razorpay = getRazorpayInstance();
      razorpayOrder = await razorpay.orders.create({
        amount: amountPaise,
        currency: 'INR',
        receipt: `receipt_${bookingId}_${Date.now()}`,
        notes: {
          bookingId: bookingId.toString(),
          customerId: customerId?.toString() || '',
          service: booking.trade,
        },
      });
    } catch (rzpErr) {
      // Demo mode: generate a fake order ID if Razorpay keys aren't configured
      console.warn('⚠️ Razorpay not configured, using demo mode:', rzpErr.message);
      razorpayOrder = {
        id: `order_demo_${Date.now()}`,
        amount: amountPaise,
        currency: 'INR',
        status: 'created',
      };
    }

    // Calculate splits
    const commissionAmount = Math.round(amountINR * (config.commissionPercent / 100));
    const customerCashback = Math.round(commissionAmount * (config.cashbackPercent / 100));
    const providerPayout = amountINR - commissionAmount;

    // Create payment record
    const payment = await Payment.create({
      booking: bookingId,
      customer: customerId || booking.customer,
      provider: booking.worker,
      razorpayOrderId: razorpayOrder.id,
      amount: amountPaise,
      currency: 'INR',
      commissionPercent: config.commissionPercent,
      commissionAmount,
      providerPayout,
      cashbackPercent: config.cashbackPercent,
      customerCashback,
    });

    // Save razorpayOrderId to booking for reference
    await Booking.findByIdAndUpdate(bookingId, { razorpayOrderId: razorpayOrder.id }).catch(() => {});

    res.status(201).json({
      message: 'Razorpay order created',
      order: {
        id: razorpayOrder.id,
        amount: amountPaise,
        currency: 'INR',
        paymentId: payment._id,
      },
      splits: {
        totalAmount: amountINR,
        commissionPercent: config.commissionPercent,
        commissionAmount,
        providerPayout,
        cashbackPercent: config.cashbackPercent,
        customerCashback,
      },
      key: process.env.RAZORPAY_KEY_ID || 'rzp_test_demo',
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create payment order', error: err.message });
  }
};

// POST /api/payments/verify
// Verifies Razorpay signature, updates booking, credits wallets (with idempotency protection)
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, bookingId, paymentId } = req.body;

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const isLiveConfigured = keySecret && !keySecret.includes('YOUR_') && !keySecret.includes('rzp_test_YOUR');
    const isDemo = (!razorpayPaymentId || razorpayPaymentId.startsWith('demo_')) && !isLiveConfigured;

    let signatureValid = false;

    if (isDemo) {
      signatureValid = true;
    } else {
      if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        return res.status(400).json({ message: 'Missing required Razorpay payment verification parameters' });
      }
      const body = `${razorpayOrderId}|${razorpayPaymentId}`;
      const expectedSignature = crypto
        .createHmac('sha256', keySecret || '')
        .update(body)
        .digest('hex');
      signatureValid = expectedSignature === razorpaySignature;
    }

    if (!signatureValid) {
      return res.status(400).json({ message: 'Payment verification failed: invalid signature' });
    }

    // Fetch payment record
    const payment = await Payment.findOne({ razorpayOrderId }).catch(() => null)
      || await Payment.findById(paymentId).catch(() => null);

    if (!payment) {
      return res.status(404).json({ message: 'Payment record not found' });
    }

    // Idempotency: If already paid, return success without double processing
    if (payment.status === 'paid') {
      return res.status(200).json({ message: 'Payment already verified and processed', paymentId: payment._id });
    }

    const booking = await Booking.findById(payment.booking);
    if (booking && booking.paymentStatus === 'Paid') {
      payment.status = 'paid';
      await payment.save();
      return res.status(200).json({ message: 'Booking is already marked as paid', paymentId: payment._id });
    }

    // Mark payment as paid
    payment.razorpayPaymentId = razorpayPaymentId || `demo_pay_${Date.now()}`;
    payment.razorpaySignature = razorpaySignature || 'demo_signature';
    payment.status = 'paid';
    payment.paidAt = new Date();
    await payment.save();

    const amountINR = (payment.amount / 100);


    // Update booking
    await Booking.findByIdAndUpdate(payment.booking, {
      status: 'Paid',
      paymentStatus: 'Paid',
      transactionId: payment.razorpayPaymentId,
      isOnlinePayment: true,
      commissionAmount: payment.commissionAmount,
      providerPayout: payment.providerPayout,
      customerCashback: payment.customerCashback,
      workerTotalPayout: payment.providerPayout,
    }).catch(() => {});

    // Credit Provider Wallet
    let providerWallet = await Wallet.findOne({ user: payment.provider }).catch(() => null);
    if (!providerWallet) {
      providerWallet = await Wallet.create({
        user: payment.provider,
        role: 'handyman',
        balance: 0,
      });
    }
    await providerWallet.credit(
      payment.providerPayout,
      `Earnings from booking #${payment.booking} - ${booking?.trade || 'Service'}`,
      payment.booking,
      payment._id
    ).catch(() => {});

    // Credit Customer Cashback Wallet
    let customerWallet = await Wallet.findOne({ user: payment.customer }).catch(() => null);
    if (!customerWallet) {
      customerWallet = await Wallet.create({
        user: payment.customer,
        role: 'customer',
        balance: 0,
      });
    }
    await customerWallet.credit(
      payment.customerCashback,
      `Cashback reward for booking #${payment.booking} - ${booking?.trade || 'Service'}`,
      payment.booking,
      payment._id
    ).catch(() => {});

    // Emit real-time payment success event
    const io = req.app?.get('io');
    if (io && booking) {
      io.to(`booking-${payment.booking}`).emit('payment-success', {
        bookingId: payment.booking,
        providerPayout: payment.providerPayout,
        customerCashback: payment.customerCashback,
        totalAmount: amountINR,
      });
      io.to(`user-${payment.customer}`).emit('cashback-credited', {
        amount: payment.customerCashback,
        bookingId: payment.booking,
      });
      io.to(`user-${payment.provider}`).emit('earnings-credited', {
        amount: payment.providerPayout,
        bookingId: payment.booking,
      });
    }

    res.status(200).json({
      message: 'Payment verified and wallets credited successfully!',
      payment: {
        id: payment._id,
        status: 'paid',
        paidAt: payment.paidAt,
        providerPayout: payment.providerPayout,
        customerCashback: payment.customerCashback,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Payment verification failed', error: err.message });
  }
};

// GET /api/payments/all  (Admin only)
exports.getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate('booking', 'trade address date price status')
      .populate('customer', 'name phone')
      .populate('provider', 'name phone trade')
      .sort({ createdAt: -1 });
    res.status(200).json({ payments });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch payments', error: err.message });
  }
};

// GET /api/payments/booking/:bookingId
exports.getPaymentByBooking = async (req, res) => {
  try {
    const payment = await Payment.findOne({ booking: req.params.bookingId });
    if (!payment) return res.status(404).json({ message: 'No payment found for this booking' });
    res.status(200).json({ payment });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch payment', error: err.message });
  }
};
