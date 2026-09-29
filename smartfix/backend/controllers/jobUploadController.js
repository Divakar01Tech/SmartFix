const { Readable } = require('stream');
const mongoose = require('mongoose');
const { getDriveClient, PARENT_FOLDER_ID } = require('../config/googleDrive');
const Booking = require('../models/Booking');

/**
 * @desc    Upload project-related file directly to Google Drive and link to MongoDB Job
 * @route   POST /api/jobs/:jobId/upload
 * @access  Protected / Public (Customer, Worker, Admin)
 */
const uploadJobAttachment = async (req, res) => {
  const { jobId } = req.params;

  // 1. Validate Job ID format (MongoDB ObjectId)
  if (!mongoose.Types.ObjectId.isValid(jobId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid Job/Booking ID format.',
    });
  }

  // 2. Validate Multer memory buffer
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({
      success: false,
      message: 'No file provided. Please upload a file under the "file" field.',
    });
  }

  // 3. Verify Job exists before initiating Google API calls
  const existingJob = await Booking.findById(jobId).select('_id');
  if (!existingJob) {
    return res.status(404).json({
      success: false,
      message: `Job with ID ${jobId} not found in database.`,
    });
  }

  try {
    // 4. Initialize Google Drive client
    const driveClient = getDriveClient();

    // 5. Stream memory buffer directly to Google Drive without touching local disk
    const bufferStream = Readable.from(req.file.buffer);

    const fileMetadata = {
      name: `${Date.now()}_${req.file.originalname}`,
      parents: PARENT_FOLDER_ID ? [PARENT_FOLDER_ID] : [],
    };

    const media = {
      mimeType: req.file.mimetype,
      body: bufferStream,
    };

    // 6. Upload to Google Drive and request 'id' and 'webViewLink'
    const driveResponse = await driveClient.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink, webContentLink',
      supportsAllDrives: true,
    });

    const googleDriveId = driveResponse.data.id;
    const viewLink = driveResponse.data.webViewLink;

    if (!googleDriveId || !viewLink) {
      throw new Error('Google Drive API succeeded but returned missing file ID or webViewLink.');
    }

    // 7. Auto-grant permission to Admin/User email if configured
    const userEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'muthdivakar01022006@gmail.com';
    try {
      await driveClient.permissions.create({
        fileId: googleDriveId,
        requestBody: {
          role: 'writer',
          type: 'user',
          emailAddress: userEmail,
        },
        sendNotificationEmail: false,
        supportsAllDrives: true,
      });
    } catch (permError) {
      // Non-blocking error: log and proceed even if permission grant fails (e.g. if already inherited from shared folder)
      console.warn(`[GoogleDrive] Permission notice for ${userEmail}:`, permError.message);
    }

    // 8. Atomically $push attachment subdocument into MongoDB Job/Booking record
    const updatedJob = await Booking.findByIdAndUpdate(
      jobId,
      {
        $push: {
          attachments: {
            fileName: req.file.originalname,
            googleDriveId,
            viewLink,
            uploadedAt: new Date(),
          },
        },
      },
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: 'File successfully streamed to Google Drive and linked to job.',
      attachment: {
        fileName: req.file.originalname,
        googleDriveId,
        viewLink,
      },
      attachmentsCount: updatedJob.attachments.length,
      job: updatedJob,
    });
  } catch (error) {
    console.error('[GoogleDrive Upload Error]:', error);

    // 9. Structured error response for API timeouts, auth errors, and server faults
    const isTimeout =
      error.code === 'ETIMEDOUT' ||
      error.code === 'ECONNABORTED' ||
      error.message?.includes('timeout');

    if (isTimeout) {
      return res.status(504).json({
        success: false,
        message: 'Google Drive API connection timed out. Please retry your upload.',
        error: 'GATEWAY_TIMEOUT',
      });
    }

    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to upload attachment to Google Drive.',
      error: error.errors || error.code || 'DRIVE_UPLOAD_FAILURE',
    });
  }
};

module.exports = {
  uploadJobAttachment,
};
