const mongoose = require('mongoose');
const User = require('./User');

// Export User model as Worker for semantic consistency across worker modules
module.exports = User;
