const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Booking = require('../models/Booking');
const PhotoHash = require('../models/PhotoHash');
const fraudService = require('./fraudService');
const { callClaudeJSON, isAiFeatureEnabled } = require('./aiService');

function computeBufferSha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Upload and record proof photo with duplicate / reuse detection
 */
async function recordAndUploadProof({ bookingId, workerId, fileBuffer, fileRelativePath, kind }) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new Error('Booking not found');

  const sha256 = computeBufferSha256(fileBuffer);

  // 1. Check if this photo was used in any other booking
  const existingHash = await PhotoHash.findOne({
    sha256,
    bookingId: { $ne: bookingId },
  });

  if (existingHash) {
    // Flag suspicious photo reuse
    await fraudService.addSignal({
      userId: workerId,
      bookingId,
      code: 'proof_reuse',
      detail: `Photo hash reused from previously completed booking #${existingHash.bookingId.toString().slice(-6)}`,
      weight: 65,
    }).catch((err) => console.error('Fraud signal recording error:', err.message));
  }

  // 2. Check if identical photo was uploaded as the opposite kind in the same booking
  const oppositeKind = kind === 'before' ? 'after' : 'before';
  const oppositePhotos = booking.jobProof?.[oppositeKind] || [];
  const isIdenticalOpposite = oppositePhotos.some((p) => p.sha256 === sha256);

  if (isIdenticalOpposite) {
    await fraudService.addSignal({
      userId: workerId,
      bookingId,
      code: 'proof_reuse',
      detail: 'Exact identical photo uploaded for both before and after job verification',
      weight: 75,
    }).catch((err) => console.error('Fraud signal recording error:', err.message));
  }

  // 3. Save to PhotoHash collection
  await PhotoHash.create({
    sha256,
    bookingId,
    workerId,
    kind,
  }).catch(() => {});

  // 4. Update booking.jobProof
  if (!booking.jobProof) {
    booking.jobProof = { before: [], after: [], ai: { verdict: 'not_run' } };
  }

  const proofEntry = {
    url: fileRelativePath,
    sha256,
    uploadedAt: new Date(),
  };

  booking.jobProof[kind].push(proofEntry);
  await booking.save();

  return {
    success: true,
    entry: proofEntry,
    isReused: !!existingHash,
    isIdenticalOpposite,
  };
}

/**
 * Verify before and after job photos using Claude Vision
 */
async function verifyJobProof(bookingId) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new Error('Booking not found');

  const beforePhoto = (booking.jobProof?.before || []).slice(-1)[0];
  const afterPhoto = (booking.jobProof?.after || []).slice(-1)[0];

  if (!beforePhoto || !afterPhoto) {
    return {
      verdict: 'inconclusive',
      reason: 'missing_photo',
      completionConfidence: 0,
      observations: 'Both a Before photo and an After photo must be uploaded prior to AI verification.',
      concerns: ['Missing before or after photo'],
    };
  }

  // Fast check: identical images uploaded
  if (beforePhoto.sha256 === afterPhoto.sha256) {
    const aiResult = {
      verdict: 'suspicious',
      completionConfidence: 0,
      observations: 'Identical photo was submitted for both Before and After proofs. No visible repair change.',
      concerns: ['Identical image hash detected'],
      ranAt: new Date(),
    };

    booking.jobProof.ai = aiResult;
    await booking.save();

    await fraudService.evaluate({ userId: booking.worker, bookingId }).catch(() => {});
    return aiResult;
  }

  // Check if AI feature toggle is enabled
  const enabled = await isAiFeatureEnabled('jobProofCheck');
  if (!enabled) {
    const aiResult = {
      verdict: 'not_run',
      aiDisabled: true,
      completionConfidence: 0,
      observations: 'Job proof AI verification is currently disabled by Admin.',
      concerns: [],
      ranAt: new Date(),
    };
    booking.jobProof.ai = aiResult;
    await booking.save();
    return aiResult;
  }

  // Load images from disk
  const readImageBase64 = (filePath) => {
    let abs = filePath;
    if (!path.isAbsolute(abs)) {
      abs = path.join(__dirname, '..', filePath.replace(/^\/+/, ''));
    }
    if (fs.existsSync(abs)) {
      const buf = fs.readFileSync(abs);
      const ext = path.extname(abs).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      return { data: buf.toString('base64'), mimeType };
    }
    return null;
  };

  const beforeImg = readImageBase64(beforePhoto.url);
  const afterImg = readImageBase64(afterPhoto.url);

  if (!beforeImg || !afterImg) {
    const aiResult = {
      verdict: 'inconclusive',
      completionConfidence: 50,
      observations: 'Image files could not be read from disk for vision analysis.',
      concerns: ['Local file access error'],
      ranAt: new Date(),
    };
    booking.jobProof.ai = aiResult;
    await booking.save();
    return aiResult;
  }

  try {
    const system = `You compare before and after repair photos for a home service job in Tamil Nadu, India.
Determine if the repair appears completed.
Flag:
- photos that are identical or near-identical
- photos taken from computer/mobile screens
- stock or catalogue photos
- photos showing completely different rooms/appliances with no physical overlap
- after-photos showing no visible repair or clean-up progress

Return JSON ONLY:
{
  "verdict": "verified" | "inconclusive" | "suspicious",
  "completionConfidence": number (0-100),
  "observations": string (concise explanation of what was fixed or what looks suspect),
  "concerns": string[]
}`;

    const aiRes = await callClaudeJSON({
      feature: 'jobProofCheck',
      system,
      user: `Booking Trade: ${booking.trade || 'Home Services'}\nNotes: ${booking.notes || 'None'}\nCompare the attached Before (first image) and After (second image) repair photos.`,
      images: [beforeImg, afterImg],
      userId: booking.worker,
      schemaCheck: (obj) => {
        if (!['verified', 'inconclusive', 'suspicious'].includes(obj.verdict)) {
          throw new Error('Invalid verdict from vision analysis');
        }
      },
    });

    let aiResult = {
      verdict: 'inconclusive',
      completionConfidence: 60,
      observations: 'Visual inspection completed.',
      concerns: [],
      ranAt: new Date(),
    };

    if (aiRes.ok && aiRes.data) {
      aiResult = {
        verdict: aiRes.data.verdict || 'verified',
        completionConfidence: Number(aiRes.data.completionConfidence) || 75,
        observations: aiRes.data.observations || 'Repair work confirmed.',
        concerns: aiRes.data.concerns || [],
        ranAt: new Date(),
      };
    }

    booking.jobProof.ai = aiResult;
    await booking.save();

    // If suspicious, trigger fraud service evaluation
    if (aiResult.verdict === 'suspicious') {
      await fraudService.evaluate({ userId: booking.worker, bookingId }).catch(() => {});
    }

    return aiResult;
  } catch (err) {
    console.error('Job proof AI verification error:', err.message);
    const fallbackResult = {
      verdict: 'inconclusive',
      completionConfidence: 50,
      observations: 'AI verification was temporarily inconclusive. Visual inspection available in Admin and Customer portals.',
      concerns: [],
      ranAt: new Date(),
    };
    booking.jobProof.ai = fallbackResult;
    await booking.save();
    return fallbackResult;
  }
}

module.exports = {
  recordAndUploadProof,
  verifyJobProof,
  computeBufferSha256,
};
