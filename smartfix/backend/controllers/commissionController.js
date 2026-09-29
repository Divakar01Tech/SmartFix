const CommissionConfig = require('../models/CommissionConfig');

// GET /api/commission
exports.getConfig = async (req, res) => {
  try {
    let config = await CommissionConfig.findOne({ key: 'platform_commission' });
    if (!config) {
      config = await CommissionConfig.create({ key: 'platform_commission' });
    }
    res.status(200).json({ config });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch commission config', error: err.message });
  }
};

// PUT /api/commission  (Admin only)
exports.updateConfig = async (req, res) => {
  try {
    const { commissionPercent, cashbackPercent } = req.body;
    const adminId = req.user?.id;

    const config = await CommissionConfig.findOneAndUpdate(
      { key: 'platform_commission' },
      {
        ...(commissionPercent !== undefined && { commissionPercent: Number(commissionPercent) }),
        ...(cashbackPercent !== undefined && { cashbackPercent: Number(cashbackPercent) }),
        updatedBy: adminId,
      },
      { new: true, upsert: true }
    );

    res.status(200).json({ message: 'Commission config updated', config });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update commission config', error: err.message });
  }
};
