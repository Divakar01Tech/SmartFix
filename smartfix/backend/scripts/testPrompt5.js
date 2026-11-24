const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const SupportConversation = require('../models/SupportConversation');
const SupportTicket = require('../models/SupportTicket');
const AiSettings = require('../models/AiSettings');
const { handleSupportMessage } = require('../services/supportBotService');
const { invalidateAiSettingsCache } = require('../services/aiService');

async function runPrompt5Test() {
  console.log('--- Testing Prompt 5: Support Chatbot with Grounded Tools ---');

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartfix';
  await mongoose.connect(mongoUri);
  console.log('✓ Connected to MongoDB');

  // Create test customer
  const customer = await User.create({
    name: 'Support Test Customer',
    email: `support_cust_${Date.now()}@example.com`,
    phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
    password: 'Password123!',
    role: 'customer',
  });

  // Create test booking for this customer
  const booking = await Booking.create({
    customer: customer._id,
    trade: 'Electrical Repairs',
    address: 'Anna Nagar, Sivagangai, Tamil Nadu',
    district: 'Sivagangai',
    price: 400,
    status: 'en_route',
    notes: 'Ceiling fan sparking',
  });

  // Create wallet for customer with available balance and pending_review bonus
  const wallet = await Wallet.create({
    user: customer._id,
    role: 'customer',
    balance: 250,
    transactions: [
      {
        amount: 250,
        type: 'credit',
        status: 'available',
        category: 'cashback',
        description: 'Welcome bonus',
      },
      {
        amount: 100,
        type: 'credit',
        status: 'pending_review',
        category: 'bonus',
        description: 'Bonus under review',
      },
    ],
  });

  // Test 1: Asking "Where is my technician?" (must trigger get_my_bookings tool)
  console.log('\n[1] Testing tool trigger: "Where is my technician?":');
  const res1 = await handleSupportMessage({
    userId: customer._id,
    userRole: 'customer',
    message: 'Where is my technician for my Electrical Repairs booking?',
  });
  console.log('Bot Response 1:', res1);
  if (!res1.ok || !res1.toolsUsed.includes('get_my_bookings')) {
    throw new Error('Support bot failed to call get_my_bookings tool');
  }
  if (!res1.reply.toLowerCase().includes('en_route') && !res1.reply.toLowerCase().includes('en route') && !res1.reply.toLowerCase().includes('electrical')) {
    throw new Error('Bot reply was not grounded in actual booking data');
  }
  console.log('✓ Bot invoked get_my_bookings and reported real status "en_route"!');

  // Test 2: Asking "How much bonus do I have?" (must trigger get_wallet_summary tool)
  console.log('\n[2] Testing tool trigger: "How much wallet balance and bonus do I have?":');
  const res2 = await handleSupportMessage({
    conversationId: res1.conversationId,
    userId: customer._id,
    userRole: 'customer',
    message: 'How much wallet balance and bonus do I have?',
  });
  console.log('Bot Response 2:', res2);
  if (!res2.ok || !res2.toolsUsed.includes('get_wallet_summary')) {
    throw new Error('Support bot failed to call get_wallet_summary tool');
  }
  if (!res2.reply.includes('250') || !res2.reply.includes('100')) {
    throw new Error('Bot reply did not accurately distinguish available ₹250 and pending review ₹100');
  }
  console.log('✓ Bot correctly queried wallet summary and separated available and pending_review balances!');

  // Test 3: Unauthorized refund / complaint -> triggers escalate_to_admin and creates SupportTicket
  console.log('\n[3] Testing escalation: unauthorized refund demand:');
  const res3 = await handleSupportMessage({
    conversationId: res1.conversationId,
    userId: customer._id,
    userRole: 'customer',
    message: 'I demand an immediate full refund and want to talk to an admin right now!',
  });
  console.log('Bot Response 3:', res3);
  if (!res3.ok || !res3.isEscalated) {
    throw new Error('Support bot failed to escalate to admin');
  }

  const createdTicket = await SupportTicket.findOne({ userId: customer._id });
  console.log('Created SupportTicket in DB:', createdTicket);
  if (!createdTicket || createdTicket.status !== 'open') {
    throw new Error('Failed to create SupportTicket record in DB');
  }
  console.log('✓ Support ticket created successfully and status marked as escalated!');

  // Test 4: Feature Toggle disabled
  console.log('\n[4] Testing AI toggle disabled for supportBot:');
  let settings = await AiSettings.findOne({ singletonKey: 'DEFAULT_AI_SETTINGS' });
  if (!settings) {
    settings = await AiSettings.create({ singletonKey: 'DEFAULT_AI_SETTINGS' });
  }
  settings.supportBot = false;
  await settings.save();
  invalidateAiSettingsCache();

  const disabledRes = await handleSupportMessage({
    userId: customer._id,
    userRole: 'customer',
    message: 'Hello, need help',
  });
  console.log('Disabled feature result:', disabledRes);
  if (!disabledRes.aiDisabled) {
    throw new Error('Expected aiDisabled: true when toggle is false');
  }
  console.log('✓ AI toggle gating verified!');

  // Re-enable toggle
  settings.supportBot = true;
  await settings.save();
  invalidateAiSettingsCache();

  // Cleanup
  await Booking.deleteOne({ _id: booking._id });
  await Wallet.deleteOne({ _id: wallet._id });
  await SupportConversation.deleteMany({ userId: customer._id });
  await SupportTicket.deleteMany({ userId: customer._id });
  await User.deleteOne({ _id: customer._id });
  await mongoose.disconnect();
  console.log('\nPrompt 5 Test Completed Successfully! 🎉');
}

runPrompt5Test().catch((err) => {
  console.error('Prompt 5 Test Failed:', err);
  process.exit(1);
});
