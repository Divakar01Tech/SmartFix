const fs = require('fs');
const path = require('path');
const selfsigned = require('selfsigned');

const certsDir = path.join(__dirname, '..', 'certs');
const keyPath = path.join(certsDir, 'key.pem');
const certPath = path.join(certsDir, 'cert.pem');

async function generateSslCertificates() {
  if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir, { recursive: true });
  }

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    console.log('✅ SSL certificates already exist in certs/');
    return { keyPath, certPath };
  }

  console.log('🔐 Generating fresh self-signed SSL certificates for localhost...');

  const attrs = [{ name: 'commonName', value: 'localhost' }];

  const pems = await selfsigned.generate(attrs, {
    keySize: 2048,
    days: 365,
    algorithm: 'sha256',
  });

  fs.writeFileSync(keyPath, pems.private, { encoding: 'utf8' });
  fs.writeFileSync(certPath, pems.cert, { encoding: 'utf8' });

  console.log(`✅ SSL certificates generated successfully:`);
  console.log(`   - Key:  ${keyPath}`);
  console.log(`   - Cert: ${certPath}`);

  return { keyPath, certPath };
}

if (require.main === module) {
  generateSslCertificates().catch(console.error);
}

module.exports = {
  generateSslCertificates,
  keyPath,
  certPath,
};
