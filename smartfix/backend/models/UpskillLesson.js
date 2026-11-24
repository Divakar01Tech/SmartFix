const mongoose = require('mongoose');

const upskillLessonSchema = new mongoose.Schema(
  {
    trade: {
      type: String,
      required: true,
      index: true,
    },
    topic: {
      type: String,
      required: true, // 'safetyAwareness', 'diagnosisLogic', 'customerCommunication', 'practicalSpecificity'
      index: true,
    },
    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'intermediate',
    },
    title: {
      en: { type: String, required: true },
      ta: { type: String, required: true },
    },
    content: {
      en: { type: String, required: true },
      ta: { type: String, required: true },
    },
    keyTakeaways: [
      {
        en: { type: String },
        ta: { type: String },
      },
    ],
    quiz: [
      {
        question: {
          en: { type: String, required: true },
          ta: { type: String, required: true },
        },
        options: [
          {
            en: { type: String, required: true },
            ta: { type: String, required: true },
          },
        ],
        correctIndex: { type: Number, required: true },
        explanation: {
          en: { type: String, default: '' },
          ta: { type: String, default: '' },
        },
      },
    ],
    isAiGenerated: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('UpskillLesson', upskillLessonSchema);
