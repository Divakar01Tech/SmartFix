const mongoose = require('mongoose');

const skillQuestionSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: [
        'Plumbing',
        'Electrical Repairs',
        'AC Service and Repair',
        'Refrigerator Repair',
        'Washing Machine Repair',
        'Water Purifier Service',
      ],
      required: true,
      index: true,
    },
    questionText: {
      type: String,
      required: true,
    },
    questionTextTamil: {
      type: String,
      default: '',
    },
    keyEvaluationCriteria: [
      {
        type: String,
      },
    ],
    difficulty: {
      type: String,
      enum: ['basic', 'intermediate', 'advanced'],
      default: 'intermediate',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SkillQuestion', skillQuestionSchema);
