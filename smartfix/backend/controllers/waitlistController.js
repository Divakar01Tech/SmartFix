const Waitlist = require('../models/Waitlist');
const Location = require('../models/Location');

// POST /api/waitlist  { districtId }
// Auth required – adds user to waitlist for an inactive district
exports.joinWaitlist = async (req, res) => {
  try {
    const { districtId } = req.body;
    const userId = req.user._id || req.user.id;

    const district = await Location.findOne({ _id: districtId, level: 'district' });
    if (!district) {
      return res.status(404).json({ success: false, message: 'District not found.' });
    }
    if (district.isServiceActive) {
      return res.status(400).json({ success: false, message: 'Service is already active in this district.' });
    }

    // upsert – ignore if already on waitlist
    const existing = await Waitlist.findOne({ userId, districtId });
    if (existing) {
      return res.status(200).json({ success: true, alreadyJoined: true, waitlistCount: district.waitlistCount });
    }

    await Waitlist.create({ userId, districtId });
    await Location.findByIdAndUpdate(districtId, { $inc: { waitlistCount: 1 } });

    return res.status(201).json({
      success: true,
      message: `You will be notified when service launches in ${district.name.en}.`,
      waitlistCount: district.waitlistCount + 1
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to join waitlist.' });
  }
};
