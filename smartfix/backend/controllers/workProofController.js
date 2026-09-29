const mongoose = require('mongoose');
const { Readable } = require('stream');
const Booking = require('../models/Booking');
const { getDriveClient, PARENT_FOLDER_ID } = require('../config/googleDrive');
const { callGeminiApi } = require('../services/geminiService');

// Helper to upload a buffer to GDrive
const uploadBufferToDrive = async (buffer, originalname, mimetype) => {
  const driveClient = getDriveClient();
  const bufferStream = Readable.from(buffer);

  const fileMetadata = {
    name: `${Date.now()}_${originalname}`,
    parents: PARENT_FOLDER_ID ? [PARENT_FOLDER_ID] : [],
  };

  const media = {
    mimeType: mimetype,
    body: bufferStream,
  };

  const driveResponse = await driveClient.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, webViewLink, webContentLink',
    supportsAllDrives: true,
  });

  const fileId = driveResponse.data.id;
  // Make public or accessible to everyone who has the link
  try {
    await driveClient.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
      supportsAllDrives: true,
    });
  } catch (err) {
    console.warn('Could not make file public:', err.message);
  }
  return driveResponse.data.webViewLink;
};

// Helper to fetch file buffer from GDrive using webViewLink (Wait, since it's hard to fetch by link without auth, let's extract file ID)
const fetchDriveFileAsBase64 = async (url) => {
  try {
    const match = url.match(/[\/|\=]([0-9a-zA-Z_-]{25,})/);
    if (!match) return null;
    const fileId = match[1];
    
    const driveClient = getDriveClient();
    const res = await driveClient.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
    const base64 = Buffer.from(res.data).toString('base64');
    return `data:image/jpeg;base64,${base64}`;
  } catch (err) {
    console.error('Failed to download image from drive for AI', err.message);
    return null;
  }
};

exports.uploadBeforePhotos = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    
    if (booking.status !== 'Arrived') {
      return res.status(400).json({ message: 'Before photos can only be uploaded when status is Arrived.' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No photos provided.' });
    }

    const urls = [];
    for (const file of req.files) {
      const url = await uploadBufferToDrive(file.buffer, file.originalname, file.mimetype);
      urls.push(url);
    }

    if (!booking.workProof) booking.workProof = {};
    booking.workProof.beforePhotos = [...(booking.workProof.beforePhotos || []), ...urls];
    
    await booking.save();
    res.status(200).json({ message: 'Before photos uploaded', workProof: booking.workProof });
  } catch (err) {
    res.status(500).json({ message: 'Upload failed', error: err.message });
  }
};

exports.uploadAfterPhotos = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No photos provided.' });
    }

    const urls = [];
    for (const file of req.files) {
      const url = await uploadBufferToDrive(file.buffer, file.originalname, file.mimetype);
      urls.push(url);
    }

    if (!booking.workProof) booking.workProof = {};
    booking.workProof.afterPhotos = [...(booking.workProof.afterPhotos || []), ...urls];
    
    await booking.save();
    res.status(200).json({ message: 'After photos uploaded', workProof: booking.workProof });
  } catch (err) {
    res.status(500).json({ message: 'Upload failed', error: err.message });
  }
};

exports.runAiVerification = async (booking) => {
  try {
    // Only run if we have before/after photos
    const beforeUrls = booking.workProof?.beforePhotos || [];
    const afterUrls = booking.workProof?.afterPhotos || [];
    
    if (beforeUrls.length === 0 || afterUrls.length === 0) {
      return; // Can't verify without both
    }

    // Prepare images for LLM
    const imagesPayload = [];
    for (const url of beforeUrls) {
      const b64 = await fetchDriveFileAsBase64(url);
      if (b64) imagesPayload.push({ text: 'Before Photo', image: b64 });
    }
    for (const url of afterUrls) {
      const b64 = await fetchDriveFileAsBase64(url);
      if (b64) imagesPayload.push({ text: 'After Photo', image: b64 });
    }

    const systemPrompt = `You are a SmartFix quality assurance AI. You will be provided with 'Before' and 'After' photos of a home service repair.
You must output strict JSON only with no markdown. Do NOT use names or PII.
Format:
{
  "matchesBookedService": true/false,
  "workAppearsComplete": true/false,
  "confidence": 0.0 to 1.0,
  "summary": "2 sentences neutral summary of what appears to be done.",
  "concerns": ["Any concern 1", "Any concern 2"]
}
Say honestly "cannot tell" in the summary and lower confidence if photos are unclear.`;

    const userPrompt = `The booked service is: ${booking.trade} - ${booking.subServices.join(', ')}. Please evaluate the photos.`;
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    // Inject images manually as part of user message
    imagesPayload.forEach(img => {
      messages.push({ role: 'user', content: img.text, image: img.image });
    });

    const result = await callGeminiApi(messages, 0.2, 1000);
    
    if (!result || !result.text) {
      throw new Error('LLM returned no response');
    }

    let raw = result.text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(raw);

    booking.workProof.aiVerification = {
      matchesBookedService: Boolean(parsed.matchesBookedService),
      workAppearsComplete: Boolean(parsed.workAppearsComplete),
      confidence: Number(parsed.confidence) || 0,
      summary: parsed.summary || 'Cannot determine from photos.',
      concerns: parsed.concerns || [],
      verifiedAt: new Date()
    };
    booking.workProof.aiVerificationFailed = false;

    if (booking.workProof.aiVerification.confidence < 0.5 || booking.workProof.aiVerification.concerns.length > 0) {
      booking.riskFlag = 'high';
      booking.riskFactors.push('AI Verification flagged concerns or low confidence.');
    }

    await booking.save();
  } catch (err) {
    console.error('AI Verification Error:', err.message);
    booking.workProof.aiVerificationFailed = true;
    await booking.save().catch(() => {});
  }
};
