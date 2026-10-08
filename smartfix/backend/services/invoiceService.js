const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generates a clean PDF invoice for a completed & paid booking
 * @param {Object} booking - Populated Mongoose booking document
 * @returns {Promise<String>} Relative path to stored invoice file
 */
const generateInvoicePDF = (booking) => {
  return new Promise((resolve, reject) => {
    try {
      const invoicesDir = path.join(__dirname, '../invoices');
      if (!fs.existsSync(invoicesDir)) {
        fs.mkdirSync(invoicesDir, { recursive: true });
      }

      const fileName = `invoice_${booking._id}.pdf`;
      const filePath = path.join(invoicesDir, fileName);
      const doc = new PDFDocument({ margin: 50 });

      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      // Header
      doc.fillColor('#1e293b').fontSize(24).text('SmartFix Home Services', { align: 'center' });
      doc.fontSize(10).fillColor('#64748b').text('Tamil Nadu On-Demand Network', { align: 'center' });
      doc.moveDown(1.5);

      // Invoice Title & Details
      doc.fillColor('#0f172a').fontSize(16).text('TAX INVOICE / RECEIPT', { underline: true });
      doc.moveDown(0.5);

      doc.fontSize(10).fillColor('#334155');
      doc.text(`Invoice ID: INV-${booking._id.toString().slice(-8).toUpperCase()}`);
      doc.text(`Booking Reference: #${booking._id}`);
      doc.text(`Date of Service: ${booking.date || new Date().toISOString().split('T')[0]}`);
      doc.text(`Payment Date: ${booking.paidAt ? new Date(booking.paidAt).toLocaleString('en-IN') : new Date().toLocaleString('en-IN')}`);
      doc.text(`Payment Status: PAID (${booking.paymentMethod || 'Online UPI'})`);
      doc.moveDown();

      // Divider Line
      doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#cbd5e1').stroke();
      doc.moveDown();

      // Customer & Worker Info
      doc.fontSize(11).fillColor('#1e293b').text('Customer Details:');
      doc.fontSize(10).fillColor('#475569');
      doc.text(`Name: ${booking.customer?.name || 'Customer'}`);
      doc.text(`Phone: ${booking.customer?.phone || 'N/A'}`);
      doc.text(`Address: ${booking.address || 'Tamil Nadu'}`);
      doc.moveDown();

      doc.fontSize(11).fillColor('#1e293b').text('Service Specialist Details:');
      doc.fontSize(10).fillColor('#475569');
      doc.text(`Technician: ${booking.worker?.name || 'Assigned Specialist'}`);
      doc.text(`Trade Category: ${booking.trade}`);
      doc.text(`Service Tier: ${booking.serviceTier || 'AutoHandyman'}`);
      doc.moveDown();

      // Table Header
      doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#cbd5e1').stroke();
      doc.moveDown(0.5);

      doc.fontSize(10).fillColor('#0f172a');
      doc.text('Service Description', 50, doc.y, { width: 300 });
      doc.text('Amount (INR)', 400, doc.y - 12, { width: 150, align: 'right' });
      doc.moveDown(0.5);

      doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#e2e8f0').stroke();
      doc.moveDown(0.5);

      // Line item
      const itemDesc = `${booking.trade} - ${booking.subServices?.join(', ') || 'Standard Repair & Inspection'}`;
      doc.fontSize(10).fillColor('#334155');
      doc.text(itemDesc, 50, doc.y, { width: 300 });
      doc.text(`INR ${booking.price || 0}.00`, 400, doc.y - 12, { width: 150, align: 'right' });
      doc.moveDown(1.5);

      // Commission transparency breakdown if available
      doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#cbd5e1').stroke();
      doc.moveDown(0.5);

      doc.fontSize(10).fillColor('#475569');
      doc.text(`Subtotal:`, 300, doc.y, { width: 100 });
      doc.text(`INR ${booking.price || 0}.00`, 400, doc.y - 12, { width: 150, align: 'right' });
      doc.moveDown(0.5);

      doc.text(`Taxes & Platform Fee (10% included):`, 200, doc.y, { width: 200 });
      doc.text(`INR ${booking.commissionAmount || Math.round((booking.price || 0) * 0.10)}.00`, 400, doc.y - 12, { width: 150, align: 'right' });
      doc.moveDown(0.5);

      doc.fontSize(12).fillColor('#0f172a').text(`Total Paid:`, 300, doc.y, { width: 100 });
      doc.fontSize(12).fillColor('#16a34a').text(`INR ${booking.price || 0}.00`, 400, doc.y - 14, { width: 150, align: 'right' });
      doc.moveDown(2);

      // Footer
      doc.fontSize(9).fillColor('#94a3b8').text('Thank you for using SmartFix Services! For support, call +91-7604975206 or email support@smartfix.in.', { align: 'center' });
      doc.end();

      writeStream.on('finish', () => {
        resolve(`/invoices/${fileName}`);
      });

      writeStream.on('error', (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = { generateInvoicePDF };
