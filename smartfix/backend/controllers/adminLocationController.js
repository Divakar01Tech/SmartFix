const Location = require('../models/Location');
const Waitlist = require('../models/Waitlist');
const User = require('../models/User');
const Booking = require('../models/Booking');

// GET /api/admin/locations/districts
exports.adminGetDistricts = async (req, res) => {
  try {
    const districts = await Location.find({ level: 'district' }).sort({ 'name.en': 1 });
    
    // Attach worker counts and booking counts
    const districtIds = districts.map(d => d._id);
    const workerCounts = await User.aggregate([
      { $match: { role: 'Worker', 'verificationStatus': 'Verified', 'districtId': { $in: districtIds } } },
      { $group: { _id: '$districtId', count: { $sum: 1 } } }
    ]);
    const bookingCounts = await Booking.aggregate([
      { $match: { 'address.districtId': { $in: districtIds } } },
      { $group: { _id: '$address.districtId', count: { $sum: 1 } } }
    ]);
    
    const wcMap = Object.fromEntries(workerCounts.map(w => [w._id.toString(), w.count]));
    const bcMap = Object.fromEntries(bookingCounts.map(b => [b._id.toString(), b.count]));

    const result = districts.map(d => ({
      ...d.toObject(),
      workerCount: wcMap[d._id.toString()] || 0,
      bookingCount: bcMap[d._id.toString()] || 0
    }));

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching districts.', error: err.message });
  }
};

// PATCH /api/admin/locations/districts/:id/toggle-active
exports.adminToggleDistrictActive = async (req, res) => {
  try {
    const district = await Location.findOne({ _id: req.params.id, level: 'district' });
    if (!district) return res.status(404).json({ message: 'District not found.' });

    // Warning: activating with zero verified workers
    if (!district.isServiceActive) {
      const workerCount = await User.countDocuments({ role: 'Worker', verificationStatus: 'Verified', districtId: district._id });
      if (workerCount === 0) {
        if (!req.body.confirmActivation) {
          return res.status(200).json({
            requiresConfirmation: true,
            message: `Warning: No verified workers in ${district.name.en}. Pass confirmActivation: true to proceed.`
          });
        }
      }
    }

    district.isServiceActive = !district.isServiceActive;
    await district.save();
    res.status(200).json({ success: true, isServiceActive: district.isServiceActive, district: district.name });
  } catch (err) {
    res.status(500).json({ message: 'Error toggling district status.', error: err.message });
  }
};

// PATCH /api/admin/locations/taluks/:id
exports.adminUpdateTaluk = async (req, res) => {
  try {
    const { radiusKm, zoneOverride } = req.body;
    const taluk = await Location.findOneAndUpdate(
      { _id: req.params.id, level: 'taluk' },
      { $set: { radiusKm, zoneOverride } },
      { new: true }
    );
    if (!taluk) return res.status(404).json({ message: 'Taluk not found.' });
    res.status(200).json({ success: true, taluk });
  } catch (err) {
    res.status(500).json({ message: 'Error updating taluk.', error: err.message });
  }
};

// POST /api/admin/locations/villages - add manually
exports.adminAddVillage = async (req, res) => {
  try {
    const { talukId, name, kind, lat, lng, pincode } = req.body;
    const taluk = await Location.findOne({ _id: talukId, level: 'taluk' });
    if (!taluk) return res.status(404).json({ message: 'Taluk not found.' });

    const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const village = await Location.create({
      level: 'village',
      name,
      slug: slugify(name.en),
      parentId: talukId,
      kind: kind || 'village',
      lat, lng, pincode
    });
    res.status(201).json({ success: true, village });
  } catch (err) {
    res.status(500).json({ message: 'Error adding village.', error: err.message });
  }
};

// PATCH /api/admin/locations/villages/:id - edit or disable
exports.adminUpdateVillage = async (req, res) => {
  try {
    const { name, kind, lat, lng, pincode, disabled } = req.body;
    const update = {};
    if (name) update.name = name;
    if (kind) update.kind = kind;
    if (lat !== undefined) update.lat = lat;
    if (lng !== undefined) update.lng = lng;
    if (pincode !== undefined) update.pincode = pincode;
    if (disabled !== undefined) update.disabled = disabled;

    const village = await Location.findOneAndUpdate({ _id: req.params.id, level: 'village' }, { $set: update }, { new: true });
    if (!village) return res.status(404).json({ message: 'Village not found.' });
    res.status(200).json({ success: true, village });
  } catch (err) {
    res.status(500).json({ message: 'Error updating village.', error: err.message });
  }
};
