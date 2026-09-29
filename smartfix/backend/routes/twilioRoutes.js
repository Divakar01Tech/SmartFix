const express = require('express');
const router = express.Router();
const twilioService = require('../services/twilioService');

/**
 * POST /api/twilio/voice-webhook
 * TwiML callback endpoint for incoming or outbound Twilio Voice Calls
 */
router.post('/voice-webhook', (req, res) => {
  const speechText = req.query.message || req.body?.SpeechResult || 'Hello! This is SmartFix home services emergency dispatch. A new booking is assigned to you.';
  const twimlXml = twilioService.generateTwiMLResponse(speechText);
  res.type('text/xml');
  res.send(twimlXml);
});

/**
 * POST /api/twilio/test-communication
 * Utility route for testing SMS, WhatsApp, or Voice Alerts via Twilio
 */
router.post('/test-communication', async (req, res) => {
  try {
    const { phone, type, message } = req.body;
    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    const commType = type || 'sms';
    const testMsg = message || 'SmartFix Test: Hello from SmartFix Twilio integration!';

    let result;
    if (commType === 'whatsapp') {
      result = await twilioService.sendWhatsApp(phone, testMsg);
    } else if (commType === 'voice') {
      result = await twilioService.makeVoiceAlertCall(phone, testMsg);
    } else {
      result = await twilioService.sendSms(phone, testMsg);
    }

    return res.status(200).json({
      message: `Twilio ${commType.toUpperCase()} test completed`,
      configured: twilioService.isTwilioConfigured(),
      result,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Twilio test failed', error: err.message });
  }
});

module.exports = router;
