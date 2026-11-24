const Appliance = require('../models/Appliance');
const Booking = require('../models/Booking');
const { extractApplianceFromImage, getExpiringAppliances } = require('../services/applianceService');

// POST /api/appliances/extract
exports.extractFromPhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload an appliance or nameplate image.' });
    }

    const userId = req.user?.id || req.user?._id;
    const photoUrl = `/storage/appliances/${req.file.filename}`;

    const result = await extractApplianceFromImage({
      filePath: req.file.path,
      mimeType: req.file.mimetype,
      userId,
    });

    if (result.aiDisabled) {
      return res.status(200).json({
        success: true,
        aiDisabled: true,
        photoUrl,
        message: result.message,
        data: {
          category: 'Other',
          brand: '',
          modelNumber: '',
          serialNumber: '',
          capacityOrSpecs: '',
          confidence: 0,
        },
      });
    }

    if (!result.ok) {
      return res.status(200).json({
        success: true,
        photoUrl,
        message: 'Could not auto-extract details. Please enter them manually.',
        data: {
          category: 'Other',
          brand: '',
          modelNumber: '',
          serialNumber: '',
          capacityOrSpecs: '',
          confidence: 0,
        },
      });
    }

    return res.status(200).json({
      success: true,
      photoUrl,
      data: result.data,
    });
  } catch (err) {
    console.error('extractFromPhoto error:', err);
    return res.status(500).json({ success: false, message: 'Image analysis failed: ' + err.message });
  }
};

// POST /api/appliances
exports.createAppliance = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const {
      category,
      brand,
      modelNumber,
      serialNumber,
      capacityOrSpecs,
      installDate,
      warrantyExpiry,
      photoUrl,
      notes,
      aiExtracted,
    } = req.body;

    if (!brand || !category) {
      return res.status(400).json({ success: false, message: 'Category and Brand are required.' });
    }

    const appliance = await Appliance.create({
      user: userId,
      category,
      brand,
      modelNumber: modelNumber || '',
      serialNumber: serialNumber || '',
      capacityOrSpecs: capacityOrSpecs || '',
      installDate: installDate ? new Date(installDate) : null,
      warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null,
      photoUrl: photoUrl || '',
      notes: notes || '',
      aiExtracted: aiExtracted || undefined,
    });

    return res.status(201).json({
      success: true,
      message: 'Appliance Passport created successfully.',
      appliance,
    });
  } catch (err) {
    console.error('createAppliance error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create appliance: ' + err.message });
  }
};

// GET /api/appliances
exports.getMyAppliances = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const appliances = await Appliance.find({ user: userId })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ success: true, count: appliances.length, appliances });
  } catch (err) {
    console.error('getMyAppliances error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch appliances: ' + err.message });
  }
};

// GET /api/appliances/expiring
exports.getExpiring = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const daysAhead = parseInt(req.query.days, 10) || 30;
    const expiring = await getExpiringAppliances(userId, daysAhead);

    return res.status(200).json({ success: true, expiring });
  } catch (err) {
    console.error('getExpiring error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch expiring appliances: ' + err.message });
  }
};

// GET /api/appliances/:id
exports.getApplianceById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;
    const userRole = req.user?.role || 'customer';

    const appliance = await Appliance.findById(id).lean();
    if (!appliance) {
      return res.status(404).json({ success: false, message: 'Appliance not found.' });
    }

    // Authorization & Trust Gating Check:
    // 1. Admin always has read access
    if (userRole === 'admin') {
      return res.status(200).json({ success: true, appliance });
    }

    // 2. Owner has full read access
    if (appliance.user.toString() === userId.toString()) {
      return res.status(200).json({ success: true, appliance });
    }

    // 3. Assigned worker on an active booking linked to this appliance
    if (userRole === 'worker' || userRole === 'handyman') {
      const hasActiveBooking = await Booking.exists({
        worker: userId,
        appliance: id,
        status: { $in: ['accepted', 'en_route', 'arrived', 'in_progress', 'completed'] },
      });

      if (hasActiveBooking) {
        return res.status(200).json({ success: true, appliance });
      }
    }

    return res.status(403).json({ success: false, message: 'Access denied to this appliance passport.' });
  } catch (err) {
    console.error('getApplianceById error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch appliance: ' + err.message });
  }
};

// PATCH /api/appliances/:id
exports.updateAppliance = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;

    const appliance = await Appliance.findById(id);
    if (!appliance) {
      return res.status(404).json({ success: false, message: 'Appliance not found.' });
    }

    if (appliance.user.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'You can only edit your own appliances.' });
    }

    const allowedUpdates = [
      'category',
      'brand',
      'modelNumber',
      'serialNumber',
      'capacityOrSpecs',
      'installDate',
      'warrantyExpiry',
      'photoUrl',
      'notes',
    ];

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        appliance[field] = req.body[field];
      }
    });

    await appliance.save();
    return res.status(200).json({ success: true, message: 'Appliance updated.', appliance });
  } catch (err) {
    console.error('updateAppliance error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update appliance: ' + err.message });
  }
};

// DELETE /api/appliances/:id
exports.deleteAppliance = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;

    const appliance = await Appliance.findById(id);
    if (!appliance) {
      return res.status(404).json({ success: false, message: 'Appliance not found.' });
    }

    if (appliance.user.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'You can only delete your own appliances.' });
    }

    await Appliance.findByIdAndDelete(id);
    return res.status(200).json({ success: true, message: 'Appliance deleted successfully.' });
  } catch (err) {
    console.error('deleteAppliance error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete appliance: ' + err.message });
  }
};
