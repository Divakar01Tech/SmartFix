require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const UpskillLesson = require('../models/UpskillLesson');
const WorkerUpskillProgress = require('../models/WorkerUpskillProgress');
const AiSettings = require('../models/AiSettings');
const {
  generateOrAssignUpskillPlan,
  getWorkerUpskillPlan,
  submitQuizAnswer,
  adminAwardBadge,
  ensureStandardLessons,
} = require('../services/upskillingService');

async function runTest() {
  console.log('--- TEST PROMPT 10: Worker Upskilling Coach ---');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartfix');

  try {
    // 1. Setup a test worker and admin
    const worker = await User.findOneAndUpdate(
      { email: 'prompt10_worker@test.com' },
      {
        name: 'Muthu Electrician',
        email: 'prompt10_worker@test.com',
        phone: '9840556677',
        role: 'worker',
        trade: 'Electrical Repairs',
        trustedWorkerBadge: false,
        currentLocation: { type: 'Point', coordinates: [78.4809, 9.8433] },
      },
      { upsert: true, new: true }
    );

    const admin = await User.findOneAndUpdate(
      { email: 'prompt10_admin@test.com' },
      {
        name: 'Super Admin',
        email: 'prompt10_admin@test.com',
        phone: '9840000000',
        role: 'admin',
        currentLocation: { type: 'Point', coordinates: [78.4809, 9.8433] },
      },
      { upsert: true, new: true }
    );

    // Clean up past progress for test worker
    await WorkerUpskillProgress.deleteMany({ worker: worker._id });

    // Ensure AI setting is enabled
    await AiSettings.findOneAndUpdate({}, { upskilling: true }, { upsert: true });

    // CASE 1: Plan Generation & Lesson Assignment
    console.log('\n[Case 1] Testing Plan Generation & Lesson Assignment...');
    const plan = await generateOrAssignUpskillPlan(worker._id, 'interview_borderline', ['safetyAwareness']);

    console.log('Assigned Plan Details:', {
      worker: plan.worker,
      trade: plan.trade,
      lessonsCount: plan.lessons.length,
      status: plan.overallStatus,
    });

    if (!plan || plan.lessons.length === 0) {
      throw new Error('Case 1 failed: No lessons were assigned in the upskilling plan');
    }
    const firstLessonItem = plan.lessons[0];
    const lessonDoc = await UpskillLesson.findById(firstLessonItem.lesson);

    if (!lessonDoc.title?.en || !lessonDoc.title?.ta || !lessonDoc.content?.en || !lessonDoc.content?.ta) {
      throw new Error('Case 1 failed: Lesson is missing bilingual EN or TA content');
    }
    console.log('✔ Case 1 Passed: Upskill plan generated with bilingual lessons.');

    // CASE 2: Anti-Cheating Sanitization
    console.log('\n[Case 2] Testing Anti-Cheating Sanitization in getWorkerUpskillPlan...');
    const sanitizedPlan = await getWorkerUpskillPlan(worker._id);
    const sanitizedQuiz = sanitizedPlan.lessons[0].lesson.quiz;
    console.log('Sanitized Quiz Question (first):', sanitizedQuiz[0]);

    if (sanitizedQuiz[0].correctIndex !== undefined) {
      throw new Error('Case 2 failed: correctIndex was leaked in client plan API response!');
    }
    console.log('✔ Case 2 Passed: correctIndex stripped from client plan response (prevents cheating).');

    // CASE 3: Server-Side Quiz Grading (Fail & Pass scenarios)
    console.log('\n[Case 3] Testing Server-Side Quiz Grading...');
    const lessonId = lessonDoc._id;
    const realAnswers = lessonDoc.quiz.map((q) => q.correctIndex);

    // 3a. Submitting all wrong answers (e.g. index 3 for everything if correct is different)
    const wrongAnswers = realAnswers.map((ans) => (ans + 1) % 4);
    const failRes = await submitQuizAnswer(worker._id, lessonId, wrongAnswers);
    console.log('Fail quiz result:', { passed: failRes.passed, score: failRes.score, correct: failRes.correctCount });

    if (failRes.passed !== false || failRes.score >= 70) {
      throw new Error('Case 3a failed: wrong answers should not pass the quiz');
    }

    // 3b. Submitting correct answers (>= 70%)
    const passRes = await submitQuizAnswer(worker._id, lessonId, realAnswers);
    console.log('Pass quiz result:', { passed: passRes.passed, score: passRes.score, correct: passRes.correctCount });

    if (passRes.passed !== true || passRes.score < 70) {
      throw new Error('Case 3b failed: correct answers should pass the quiz');
    }
    console.log('✔ Case 3 Passed: Quiz accurately graded server-side with 70% pass threshold.');

    // CASE 4: Complete Graduation and Flagging for Admin Review
    console.log('\n[Case 4] Testing Full Graduation & Non-Negotiable Admin Approval Rule...');
    // Complete remaining lessons if any
    for (let i = 1; i < plan.lessons.length; i++) {
      const remainingLesson = await UpskillLesson.findById(plan.lessons[i].lesson);
      const answers = remainingLesson.quiz.map((q) => q.correctIndex);
      await submitQuizAnswer(worker._id, remainingLesson._id, answers);
    }

    const graduatedProgress = await WorkerUpskillProgress.findOne({ worker: worker._id });
    console.log('Graduated Progress Record:', {
      overallStatus: graduatedProgress.overallStatus,
      adminReviewStatus: graduatedProgress.adminReview.status,
    });

    if (graduatedProgress.overallStatus !== 'graduated') {
      throw new Error('Case 4 failed: Overall status was not updated to graduated');
    }

    // Verify worker does NOT have badge yet (AI NEVER auto-approves!)
    const workerBeforeAdmin = await User.findById(worker._id);
    if (workerBeforeAdmin.trustedWorkerBadge !== false) {
      throw new Error('Case 4 failed: AI must NEVER auto-award trustedWorkerBadge!');
    }
    console.log('✔ Verified: AI did not auto-award badge. Flagged for Admin review.');

    // CASE 5: Admin Awards Trusted Worker Badge
    console.log('\n[Case 5] Testing Admin Decision (Admin Awards Badge)...');
    const badgeRes = await adminAwardBadge(worker._id, true, 'Certified by Admin Kumar after 100% quiz scores', admin._id);
    console.log('Admin badge decision result:', badgeRes);

    const workerAfterAdmin = await User.findById(worker._id);
    if (workerAfterAdmin.trustedWorkerBadge !== true) {
      throw new Error('Case 5 failed: Admin award did not set trustedWorkerBadge to true');
    }
    console.log('✔ Case 5 Passed: Admin successfully awarded Trusted Worker Badge.');

    // CASE 6: Graceful Offline / Toggle Fallback
    console.log('\n[Case 6] Testing AI Feature Toggle OFF...');
    await AiSettings.findOneAndUpdate({}, { upskilling: false });
    const standardLessons = await ensureStandardLessons('Plumbing');
    console.log(`Fallback retrieved ${standardLessons.length} built-in plumbing lessons.`);

    if (standardLessons.length === 0) {
      throw new Error('Case 6 failed: Built-in lessons fallback failed');
    }
    console.log('✔ Case 6 Passed: Built-in trade lessons provide resilient offline fallback.');

    // Cleanup
    await WorkerUpskillProgress.deleteMany({ worker: worker._id });
    await User.deleteMany({ _id: { $in: [worker._id, admin._id] } });
    await AiSettings.findOneAndUpdate({}, { upskilling: true });

    console.log('\n🎉 ALL PROMPT 10 ACCEPTANCE TESTS PASSED!');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

runTest();
