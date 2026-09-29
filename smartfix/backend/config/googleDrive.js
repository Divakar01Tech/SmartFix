const fs = require('fs');
const path = require('path');
const { drive, auth } = require('@googleapis/drive');

// Service account JSON file placed in the backend root
const keyFileName = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || 'service-account.json';
const KEY_FILE_PATH = path.join(__dirname, '..', keyFileName);

let driveInstance = null;

/**
 * Initializes and returns the Google Drive API client
 */
const getDriveClient = () => {
  if (driveInstance) {
    return driveInstance;
  }

  if (!fs.existsSync(KEY_FILE_PATH)) {
    throw new Error(
      `Google Drive Service Account key file not found at: ${KEY_FILE_PATH}. ` +
      `Please download your service account JSON key from Google Cloud Console and place it in smartfix/backend/${keyFileName}`
    );
  }

  const authClient = new auth.GoogleAuth({
    keyFile: KEY_FILE_PATH,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  driveInstance = drive({
    version: 'v3',
    auth: authClient,
    timeout: 30000, // 30-second timeout to prevent server thread hang
  });

  return driveInstance;
};

module.exports = {
  getDriveClient,
  PARENT_FOLDER_ID: process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID || '1b6ol-tYoEq2SfYmkLddUf8VZMAaEJKpT',
  KEY_FILE_PATH,
};
