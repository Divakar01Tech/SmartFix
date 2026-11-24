const mongoose = require('mongoose');

const workerUpskillProgressSchema = new mongoose.Schema(
  {
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    trade: {
      type: String,
      required: true,
    },
    assignedReason: {
      type: String,
      enum: ['interview_borderline', 'rating_recovery', 'voluntary'],
      default: 'interview_borderline',
    },
    weakAreas: [{ type: String }],
    lessons: [
      {
        lesson: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'UpskillLesson',
          required: true,
        },
        completed: { type: Boolean, default: false },
        quizScore: { type: Number, default: 0 },
        attempts: { type: Number, default: 0 },
        completedAt: { type: Date, default: null },
      },
    ],
    overallStatus: {
      type: String,
      enum: ['active', 'graduated'],
      default: 'active',
      index: true,
    },
    graduatedAt: { type: Date, default: null },
    adminReview: {
      status: {
        type: String,
        enum: ['pending', 'badge_awarded', 'declined'],
        default: 'pending',
      },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reviewedAt: { type: Date, default: null },
      adminNotes: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('WorkerUpskillProgress', workerUpskillProgressSchema);
