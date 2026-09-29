const mongoose = require('mongoose');

const interviewSessionSchema = new mongoose.Schema(
  {
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['in_progress', 'completed', 'abandoned'],
      default: 'in_progress',
    },
    messages: [
      {
        role: {
          type: String,
          enum: ['assistant', 'worker'],
          required: true,
        },
        text: {
          type: String,
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    questionsAsked: {
      type: Number,
      default: 0,
    },
    currentQuestionRetries: {
      type: Number,
      default: 0,
    },
    autoFlaggedConcerns: [
      {
        type: String,
      },
    ],
    aiRecommendation: {
      verdict: {
        type: String,
        enum: ['pass', 'borderline', 'fail'],
      },
      confidenceScore: {
        type: Number,
        min: 0,
        max: 100,
      },
      perQuestionScores: [
        {
          question: { type: Number },
          specificity: { type: Number, default: 0 },
          safety: { type: Number, default: 0 },
          diagnosisLogic: { type: Number, default: 0 },
          clarity: { type: Number, default: 0 },
          total: { type: Number, default: 0 },
        },
      ],
      summary: {
        type: String,
      },
      flaggedConcerns: [
        {
          type: String,
        },
      ],
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('InterviewSession', interviewSessionSchema);
