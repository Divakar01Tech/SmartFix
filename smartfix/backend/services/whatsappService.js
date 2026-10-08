const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

let whatsappClient = null;
let isReady = false;

const initWhatsApp = () => {
    whatsappClient = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: { 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        },
        webVersionCache: {
            type: 'remote',
            remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
        }
    });

    whatsappClient.on('qr', (qr) => {
        console.log('\n========================================================');
        console.log('📱 Scan this QR code in WhatsApp to link your device for sending OTPs:');
        console.log('========================================================\n');
        qrcode.generate(qr, {small: true});
    });

    whatsappClient.on('ready', () => {
        console.log('\n✅ WhatsApp Web Client is ready! You can now send OTPs to any WhatsApp number.');
        isReady = true;
    });

    whatsappClient.on('auth_failure', msg => {
        console.error('❌ WhatsApp Authentication failure', msg);
    });

    whatsappClient.initialize();
};

const sendWhatsAppMessage = async (phoneNumber, message) => {
    if (!isReady || !whatsappClient) {
        console.warn('⚠️ WhatsApp client not ready yet. Please scan the QR code in the terminal.');
        return { success: false, error: 'WhatsApp client not ready' };
    }

    try {
        const cleanPhone = phoneNumber.replace(/\D/g, '');
        // WhatsApp ID format: 919787792998@c.us
        const chatId = `${cleanPhone}@c.us`;
        
        await whatsappClient.sendMessage(chatId, message);
        console.log(`✅ WhatsApp message successfully sent to +${cleanPhone}`);
        return { success: true };
    } catch (err) {
        console.error(`❌ Error sending WhatsApp message:`, err.message);
        return { success: false, error: err.message };
    }
};

module.exports = {
    initWhatsApp,
    sendWhatsAppMessage,
    get isReady() { return isReady; }
};
