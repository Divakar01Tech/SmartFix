const UpskillLesson = require('../models/UpskillLesson');
const WorkerUpskillProgress = require('../models/WorkerUpskillProgress');
const User = require('../models/User');
const { callClaudeJSON, isAiFeatureEnabled } = require('./aiService');

// Standard built-in trade lessons fallback library
const BUILTIN_LESSONS = [
  {
    trade: 'Electrical Repairs',
    topic: 'safetyAwareness',
    difficulty: 'intermediate',
    title: {
      en: 'Main Electrical Isolation & Live Wire Testing Protocol',
      ta: 'முதன்மை மின் இணைப்பு துண்டிப்பு மற்றும் மின்னோட்ட சோதனை விதிமுறைகள்',
    },
    content: {
      en: 'Always switch off the main Double Pole (DP) MCB or isolator before touching any switchboard. Use a calibrated neon tester or digital multimeter to verify 0V between Phase-to-Neutral and Phase-to-Earth. Never work on wet surfaces; wear rubber-soled safety footwear at all customer doorsteps in Tamil Nadu.',
      ta: 'சுவிட்ச்போர்டை தொடுவதற்கு முன் மெயின் DP MCB அல்லது ஐசோலேட்டரை அணைக்க வேண்டும். பேஸ் மற்றும் நியூட்ரல் இடையே 0V உள்ளதை மல்டிமீட்டர் அல்லது நியான் டெஸ்டர் கொண்டு உறுதிப்படுத்தவும். ஈரமான தரையில் நிற்காமல் ரப்பர் பாதணிகளை அணியவும்.',
    },
    keyTakeaways: [
      {
        en: 'Lock out main breaker before unscrewing board covers',
        ta: 'போர்டை திறப்பதற்கு முன் மெயின் சுவிட்சை துண்டிக்கவும்',
      },
      {
        en: 'Always test your tester on a known live circuit first',
        ta: 'டெஸ்டரை முதலில் சரியாக வேலை செய்யும் இணைப்பில் பரிசோதிக்கவும்',
      },
    ],
    quiz: [
      {
        question: {
          en: 'What is the mandatory first step before opening any customer switchboard?',
          ta: 'வாடிக்கையாளர் சுவிட்ச்போர்டை திறப்பதற்கு முன் செய்ய வேண்டிய முதல் வேலை என்ன?',
        },
        options: [
          { en: 'Touch wires with back of hand', ta: 'கையின் பின்புறத்தால் கம்பிகளை தொடுதல்' },
          { en: 'Switch off main isolator / DP MCB and test with voltmeter', ta: 'மெயின் ஐசோலேட்டர் / DP MCB-ஐ அணைத்து வோல்ட்மீட்டரால் சோதித்தல்' },
          { en: 'Start removing switches immediately', ta: 'உடனடியாக சுவிட்சுகளை கழற்றுதல்' },
          { en: 'Wear normal cloth gloves', ta: 'சாதாரண துணி கையுறை அணிதல்' },
        ],
        correctIndex: 1,
        explanation: {
          en: 'Isolating the main MCB and verifying 0V prevents accidental electrocution.',
          ta: 'மெயின் சுவிட்சை அணைத்து 0V சோதிப்பது மின் விபத்துகளை முற்றிலுமாக தவிர்க்கும்.',
        },
      },
      {
        question: {
          en: 'What voltage should a multimeter read between Phase and Neutral in a safe isolated line?',
          ta: 'பாதுகாப்பாக துண்டிக்கப்பட்ட இணைப்பில் பேஸ் மற்றும் நியூட்ரல் இடையே மல்டிமீட்டர் காட்டும் அளவு என்ன?',
        },
        options: [
          { en: '230V AC', ta: '230V AC' },
          { en: '110V AC', ta: '110V AC' },
          { en: '0V AC', ta: '0V AC' },
          { en: '440V AC', ta: '440V AC' },
        ],
        correctIndex: 2,
        explanation: {
          en: 'An isolated line must read 0V before starting physical work.',
          ta: 'மின் துண்டிப்பு சரியாக இருந்தால் 0V காட்ட வேண்டும்.',
        },
      },
      {
        question: {
          en: 'Why must electricians wear rubber-soled shoes while performing repairs?',
          ta: 'மின் பழுது நீக்கும் போது எலக்ட்ரீஷியன்கள் ரப்பர் சோல் காலணிகளை ஏன் அணிய வேண்டும்?',
        },
        options: [
          { en: 'To keep feet clean', ta: 'கால்களை சுத்தமாக வைக்க' },
          { en: 'To insulate the body and prevent earthing loop in case of accidental contact', ta: 'உடலுக்கு மின் காப்பு வழங்கி தரைவழி மின் அதிர்ச்சியைத் தடுக்க' },
          { en: 'Company dress code only', ta: 'நிறுவன சீருடைக்காக மட்டுமே' },
          { en: 'To prevent slipping on tiles', ta: 'தரையிலிருந்து வழுக்காமல் இருக்க' },
        ],
        correctIndex: 1,
        explanation: {
          en: 'Rubber soles insulate the technician from earth ground, interrupting dangerous shock circuits.',
          ta: 'ரப்பர் சோல் தரையிலிருந்து உடலை பிரித்து மின் அதிர்ச்சி உடலுக்குள் பாய்வதைத் தடுக்கிறது.',
        },
      },
    ],
  },
  {
    trade: 'Plumbing',
    topic: 'diagnosisLogic',
    difficulty: 'intermediate',
    title: {
      en: 'Diagnosing Hidden Pipe Joint Leaks vs Wall Seepage',
      ta: 'மறைக்கப்பட்ட பைப் கசிவு மற்றும் சுவர் ஈரப்பதம் கண்டறியும் முறை',
    },
    content: {
      en: 'To differentiate between an active pressurized pipe leak and structural rainwater seepage: Turn off all taps in the house and observe the water meter or overhead tank level. If the dial moves or overhead tank drains steadily, an active pressure-line leak is confirmed. For wastewater/drain lines, pour food-grade colored dye into the drain to locate the exact wall exit point.',
      ta: 'பைப் கசிவா அல்லது மழைக்கால ஈரப்பதமா என்பதை அறிய: வீட்டில் உள்ள அனைத்து குழாய்களையும் மூடிவிட்டு வாட்டர் மீட்டர் அல்லது மேல்நிலை தொட்டி அளவை கவனிக்கவும். அளவு குறைந்தால் பிரஷர் லைனில் கசிவு உள்ளது உறுதி. கழிவுநீர் குழாய்க்கு நிறமூட்டிய தண்ணீரை ஊற்றி கசியும் இடத்தை கண்டறியலாம்.',
    },
    keyTakeaways: [
      {
        en: 'Observe meter dial with all fixtures closed to identify pressure leaks',
        ta: 'அனைத்து குழாய்களையும் மூடி மீட்டர் ஓடுவதை வைத்து கசிவை கண்டறியவும்',
      },
      {
        en: 'Use dye test for drainage & P-trap joints before chipping walls',
        ta: 'சுவரை உடைக்கும் முன் ட்ரெயின் பைப் மற்றும் P-ட்ராப்பை பரிசோதிக்கவும்',
      },
    ],
    quiz: [
      {
        question: {
          en: 'If all taps are closed and the water meter continues to spin, what does it signify?',
          ta: 'அனைத்து குழாய்களும் மூடப்பட்ட பிறகும் வாட்டர் மீட்டர் ஓடிக்கொண்டிருந்தால் என்ன காரணம்?',
        },
        options: [
          { en: 'Defective water meter only', ta: 'மீட்டர் பழுது மட்டுமே' },
          { en: 'Active leak in pressurized supply piping', ta: 'பிரஷர் குடிநீர் குழாயில் கசிவு உள்ளது' },
          { en: 'Rainwater seepage from roof', ta: 'மேற்கூரை மழைநீர் கசிவு' },
          { en: 'Evaporation in overhead tank', ta: 'தொட்டியில் நீர் ஆவியாதல்' },
        ],
        correctIndex: 1,
        explanation: {
          en: 'Moving meter while closed confirms pressurized supply pipe rupture.',
          ta: 'குழாய்கள் மூடியிருக்கும் போது மீட்டர் ஓடினால் சப்ளை பைப்பில் கசிவு உள்ளது உறுதி.',
        },
      },
      {
        question: {
          en: 'What non-destructive test helps detect concealed bathroom drainage leaks?',
          ta: 'சுவரை உடைக்காமல் பாத்ரூம் ட்ரெயின் பைப் கசிவை அறிய உதவும் எளிய முறை எது?',
        },
        options: [
          { en: 'Hammer tapping on wall', ta: 'சுத்தியலால் தட்டுதல்' },
          { en: 'Colored dye water test through drain trap', ta: 'நிறமூட்டப்பட்ட தண்ணீரை ட்ரெயின் ட்ராப்பில் ஊற்றி சோதித்தல்' },
          { en: 'Applying paint over damp wall', ta: 'ஈரமான சுவரில் பெயிண்ட் அடித்தல்' },
          { en: 'Increasing pump pressure', ta: 'மோட்டார் பிரஷரை அதிகரித்தல்' },
        ],
        correctIndex: 1,
        explanation: {
          en: 'Food-grade dye reveals concealed wastewater path without chipping tiles.',
          ta: 'நிறமூட்டிய தண்ணீர் டைல்ஸ் உடைக்காமல் கசியும் இடத்தை தெளிவாக காட்டும்.',
        },
      },
      {
        question: {
          en: 'What is the standard professional step before replacing a bathroom concealed valve?',
          ta: 'கன்சீல்டு வால்வு மாற்றுவதற்கு முன் எடுக்க வேண்டிய கட்டாய நடவடிக்கை என்ன?',
        },
        options: [
          { en: 'Turn off the main overhead tank supply valve and drain remaining line water', ta: 'மேல்நிலை தொட்டி மெயின் வால்வை மூடி பைப்பில் உள்ள நீரை வெளியேற்றுதல்' },
          { en: 'Apply sealant while water is flowing', ta: 'தண்ணீர் வரும்போதே சீலண்ட் போடுதல்' },
          { en: 'Use force to unscrew spindle without shutting water', ta: 'தண்ணீரை மூடாமல் பலவந்தமாக கழற்றுதல்' },
          { en: 'Open all other home taps to full speed', ta: 'வீட்டின் பிற குழாய்களை திறந்து வைத்தல்' },
        ],
        correctIndex: 0,
        explanation: {
          en: 'Shutting off supply and releasing residual pressure prevents flooding and thread damage.',
          ta: 'மெயின் வால்வை மூடி எஞ்சிய நீரை வடித்தல் வெள்ளப்பெருக்கைத் தவிர்க்கும்.',
        },
      },
    ],
  },
  {
    trade: 'AC Repair',
    topic: 'safetyAwareness',
    difficulty: 'intermediate',
    title: {
      en: 'Safe Handling of Flammable Refrigerants (R32 / R290)',
      ta: 'எரியக்கூடிய R32 / R290 குளிரூட்டி வாயுக்களை பாதுகாப்பாக கையாளும் முறை',
    },
    content: {
      en: 'Modern inverter air conditioners in Tamil Nadu use R32 (A2L mildly flammable) or R290 (A3 highly flammable) refrigerants. Never use oxygen or acetylene for pressure testing; always use dry nitrogen (OFDN). Vacuum the system to below 500 microns with a two-stage vacuum pump before gas charging. Strictly avoid smoking or open flames within 5 meters of outdoor charging ports.',
      ta: 'நவீன இன்வெர்ட்டர் AC-களில் R32 மற்றும் R290 எரியக்கூடிய வாயுக்கள் பயன்படுத்தப்படுகின்றன. பிரஷர் சோதனைக்கு ஆக்ஸிஜன் பயன்படுத்தக்கூடாது; உலர்ந்த நைட்ரஜன் (OFDN) மட்டுமே பயன்படுத்த வேண்டும். கேஸ் ஏற்றுவதற்கு முன் 500 மைக்ரான் வரை வேக்யூம் செய்ய வேண்டும். அவுட்டோர் யூனிட் அருகில் தீப்பற்றக்கூடிய பொருட்களை தவிர்க்கவும்.',
    },
    keyTakeaways: [
      {
        en: 'Never pressurize AC copper lines with oxygen (risk of explosion)',
        ta: 'காப்பர் பைப்பில் ஆக்ஸிஜன் கொண்டு பிரஷர் ஏற்றக்கூடாது (வெடிக்கும் அபாயம்)',
      },
      {
        en: 'Pull deep vacuum (<500 microns) before charging R32',
        ta: 'கேஸ் நிரப்புவதற்கு முன் 500 மைக்ரான் வரை வேக்யூம் செய்யவும்',
      },
    ],
    quiz: [
      {
        question: {
          en: 'Which gas must strictly NEVER be used for AC leak pressure testing due to explosive fire risk?',
          ta: 'வெடிக்கும் அபாயம் உள்ளதால் AC லீக் டெஸ்டிங்கிற்கு கண்டிப்பாக பயன்படுத்தக் கூடாத வாயு எது?',
        },
        options: [
          { en: 'Oxygen / Compressed Air with oil', ta: 'ஆக்ஸிஜன் அல்லது ஆயில் கலந்த காற்று' },
          { en: 'Oxygen-Free Dry Nitrogen (OFDN)', ta: 'உலர்ந்த நைட்ரஜன் (OFDN)' },
          { en: 'Argon', ta: 'ஆர்கான்' },
          { en: 'Carbon Dioxide', ta: 'கார்பன் டை ஆக்சைடு' },
        ],
        correctIndex: 0,
        explanation: {
          en: 'Oxygen reacts with compressor oil under pressure and causes catastrophic explosions.',
          ta: 'அழுத்தத்தில் ஆக்ஸிஜன் கம்ப்ரசர் ஆயிலுடன் வினைபுரிந்து கடுமையான வெடிப்பை ஏற்படுத்தும்.',
        },
      },
      {
        question: {
          en: 'Why is a two-stage vacuum pump essential before charging inverter R32 AC units?',
          ta: 'இன்வெர்ட்டர் R32 AC-யில் கேஸ் ஏற்றுவதற்கு முன் வேக்யூம் பம்ப் செய்வது ஏன் கட்டாயம்?',
        },
        options: [
          { en: 'To cool down the copper pipes', ta: 'காப்பர் பைப்பை குளிர்விக்க' },
          { en: 'To remove moisture and non-condensable air that causes acid formation and high head pressure', ta: 'ஈரப்பதம் மற்றும் காற்றை அகற்றி அமிலம் உருவாவதை தடுக்க' },
          { en: 'To make the unit run quieter', ta: 'சத்தமில்லாமல் இயங்குவதற்கு' },
          { en: 'To clean dust from the fins', ta: 'தூசியை சுத்தம் செய்ய' },
        ],
        correctIndex: 1,
        explanation: {
          en: 'Moisture reacts with synthetic POE oil to create corrosive hydrofluoric acid, destroying compressors.',
          ta: 'ஈரப்பதம் ஆயிலுடன் வினைபுரிந்து அமிலத்தை உருவாக்கி கம்ப்ரசரை பாழாக்கிவிடும்.',
        },
      },
      {
        question: {
          en: 'What safe distance must be kept from open flames when venting or brazing near R32 equipment?',
          ta: 'R32 ஏசி அவுட்டோர் யூனிட் அருகே வெல்டிங் அல்லது பழுது நீக்கும் போது திறந்த தீப்பிழம்புகளிலிருந்து எவ்வளவு தூரம் இடைவெளி தேவை?',
        },
        options: [
          { en: 'At least 3 to 5 meters in a well-ventilated area', ta: 'நன்கு காற்றோட்டமான இடத்தில் குறைந்தது 3 முதல் 5 மீட்டர் தூரம்' },
          { en: 'No distance needed', ta: 'எந்த இடைவெளியும் தேவையில்லை' },
          { en: '10 centimeters', ta: '10 சென்டிமீட்டர்' },
          { en: 'Inside a closed cupboard', ta: 'மூடிய அறைக்குள்' },
        ],
        correctIndex: 0,
        explanation: {
          en: 'R32 is an A2L mildly flammable gas and requires ventilation and flame clearance.',
          ta: 'R32 லேசான எரியக்கூடிய தன்மை கொண்டதால் காற்றோட்டமும் 3-5 மீட்டர் இடைவெளியும் அவசியம்.',
        },
      },
    ],
  },
];

/**
 * Seed or retrieve standard lessons for a given trade
 */
async function ensureStandardLessons(trade = 'Electrical Repairs') {
  const normTrade = trade.toLowerCase().includes('electr')
    ? 'Electrical Repairs'
    : trade.toLowerCase().includes('plumb')
    ? 'Plumbing'
    : trade.toLowerCase().includes('ac')
    ? 'AC Repair'
    : 'Electrical Repairs';

  let lessons = await UpskillLesson.find({ trade: normTrade });
  if (lessons.length === 0) {
    const toInsert = BUILTIN_LESSONS.filter((l) => l.trade === normTrade);
    if (toInsert.length > 0) {
      await UpskillLesson.insertMany(toInsert);
      lessons = await UpskillLesson.find({ trade: normTrade });
    }
  }
  return lessons;
}

/**
 * 1. Generate or Assign Upskill Plan for a Worker
 */
async function generateOrAssignUpskillPlan(workerId, reason = 'interview_borderline', weakAreas = []) {
  const worker = await User.findById(workerId);
  if (!worker) throw new Error('Worker not found');

  const trade = worker.trade || (worker.categories && worker.categories[0]) || 'Electrical Repairs';

  // Check if an active plan already exists
  let existingProgress = await WorkerUpskillProgress.findOne({
    worker: workerId,
    overallStatus: 'active',
  }).populate('lessons.lesson');

  if (existingProgress && existingProgress.lessons.length > 0) {
    return existingProgress;
  }

  // Ensure lessons exist for this trade
  let lessons = await ensureStandardLessons(trade);

  // If AI upskilling is enabled and custom weak area is provided, try dynamic generation
  const enabled = await isAiFeatureEnabled('upskilling');
  if (enabled && weakAreas.length > 0) {
    try {
      const system = `You are a master technical trainer for trade workers in Tamil Nadu, India.
Generate a concise, highly practical lesson (under 250 words) with 2 key takeaways and a 3-question multiple-choice quiz.
Bilingual in English and Tamil.
Output ONLY valid JSON matching this schema:
{
  "title": { "en": string, "ta": string },
  "content": { "en": string, "ta": string },
  "keyTakeaways": [
    { "en": string, "ta": string },
    { "en": string, "ta": string }
  ],
  "quiz": [
    {
      "question": { "en": string, "ta": string },
      "options": [
        { "en": string, "ta": string },
        { "en": string, "ta": string },
        { "en": string, "ta": string },
        { "en": string, "ta": string }
      ],
      "correctIndex": number (0 to 3),
      "explanation": { "en": string, "ta": string }
    }
  ]
}`;

      const aiRes = await callClaudeJSON({
        feature: 'upskilling',
        system,
        user: `Worker Trade: ${trade}\nIdentified Weak Area: ${weakAreas.join(', ')}\nGenerate an actionable micro-coaching lesson for real Indian home service jobs.`,
        userId: workerId,
        schemaCheck: (obj) => obj && obj.title && obj.content && Array.isArray(obj.quiz) && obj.quiz.length === 3,
      });

      if (aiRes.ok && aiRes.data) {
        const dynamicLesson = await UpskillLesson.create({
          trade,
          topic: weakAreas[0] || 'safetyAwareness',
          difficulty: 'intermediate',
          title: aiRes.data.title,
          content: aiRes.data.content,
          keyTakeaways: aiRes.data.keyTakeaways || [],
          quiz: aiRes.data.quiz,
          isAiGenerated: true,
        });
        lessons.unshift(dynamicLesson);
      }
    } catch (err) {
      console.warn('[UpskillingService] AI generation error, using standard lessons:', err.message);
    }
  }

  // Assign up to 2-3 lessons
  const assignedLessons = lessons.slice(0, 2).map((l) => ({
    lesson: l._id,
    completed: false,
    quizScore: 0,
    attempts: 0,
  }));

  const progress = await WorkerUpskillProgress.create({
    worker: workerId,
    trade,
    assignedReason: reason,
    weakAreas,
    lessons: assignedLessons,
    overallStatus: 'active',
  });

  return WorkerUpskillProgress.findById(progress._id).populate('lessons.lesson');
}

/**
 * 2. Get Sanitized Upskill Plan for Worker (Hides correctIndex to prevent cheating)
 */
async function getWorkerUpskillPlan(workerId) {
  let progress = await WorkerUpskillProgress.findOne({ worker: workerId })
    .sort({ createdAt: -1 })
    .populate('lessons.lesson')
    .lean();

  if (!progress) {
    // Generate initial default plan
    progress = await generateOrAssignUpskillPlan(workerId, 'voluntary', ['safetyAwareness']);
    progress = progress.toObject ? progress.toObject() : progress;
  }

  // Strip correctIndex from quiz items so worker cannot inspect client response
  const sanitizedLessons = (progress.lessons || []).map((l) => {
    if (!l.lesson) return l;
    const lessonDoc = { ...l.lesson };
    if (Array.isArray(lessonDoc.quiz)) {
      lessonDoc.quiz = lessonDoc.quiz.map((q) => {
        const { correctIndex, ...safeQ } = q;
        return safeQ;
      });
    }
    return {
      ...l,
      lesson: lessonDoc,
    };
  });

  return {
    ...progress,
    lessons: sanitizedLessons,
  };
}

/**
 * 3. Submit Quiz Answer and Grade Server-Side
 */
async function submitQuizAnswer(workerId, lessonId, answers = []) {
  const lesson = await UpskillLesson.findById(lessonId);
  if (!lesson) throw new Error('Lesson not found');

  if (!Array.isArray(answers) || answers.length !== lesson.quiz.length) {
    throw new Error(`Expected exactly ${lesson.quiz.length} answers.`);
  }

  let correctCount = 0;
  const reviewBreakdown = [];

  lesson.quiz.forEach((q, idx) => {
    const isCorrect = answers[idx] === q.correctIndex;
    if (isCorrect) correctCount++;
    reviewBreakdown.push({
      questionIndex: idx,
      userAnswer: answers[idx],
      correctAnswer: q.correctIndex,
      isCorrect,
      explanation: q.explanation,
    });
  });

  const total = lesson.quiz.length;
  const scorePercent = Math.round((correctCount / total) * 100);
  const passed = scorePercent >= 70; // 70% passing threshold

  // Update Progress in Database
  const progress = await WorkerUpskillProgress.findOne({
    worker: workerId,
    'lessons.lesson': lessonId,
  });

  if (progress) {
    const item = progress.lessons.find((l) => l.lesson.toString() === lessonId.toString());
    if (item) {
      item.attempts = (item.attempts || 0) + 1;
      item.quizScore = Math.max(item.quizScore || 0, scorePercent);
      if (passed) {
        item.completed = true;
        item.completedAt = new Date();
      }
    }

    // Check if ALL assigned lessons are now completed
    const allCompleted = progress.lessons.every((l) => l.completed === true);
    if (allCompleted) {
      progress.overallStatus = 'graduated';
      progress.graduatedAt = new Date();
      progress.adminReview = {
        status: 'pending',
        adminNotes: 'Worker completed all upskilling modules. Ready for Admin review for Verified / Trusted Worker Badge.',
      };
    }

    await progress.save();
  }

  return {
    passed,
    score: scorePercent,
    correctCount,
    totalQuestions: total,
    reviewBreakdown,
    graduated: progress ? progress.overallStatus === 'graduated' : false,
  };
}

/**
 * 4. Admin Awards Trusted Worker Badge
 * Non-negotiable rule: Admin decides, AI recommends.
 */
async function adminAwardBadge(workerId, approved = true, adminNotes = '', adminId = null) {
  const worker = await User.findById(workerId);
  if (!worker) throw new Error('Worker not found');

  const progress = await WorkerUpskillProgress.findOne({ worker: workerId }).sort({ createdAt: -1 });

  if (approved) {
    worker.trustedWorkerBadge = true;
    await worker.save();
    if (progress) {
      progress.adminReview = {
        status: 'badge_awarded',
        reviewedBy: adminId,
        reviewedAt: new Date(),
        adminNotes: adminNotes || 'Trusted Worker Badge awarded following graduation from SmartFix Academy.',
      };
      await progress.save();
    }
  } else {
    if (progress) {
      progress.adminReview = {
        status: 'declined',
        reviewedBy: adminId,
        reviewedAt: new Date(),
        adminNotes: adminNotes || 'Badge award declined by administrator.',
      };
      await progress.save();
    }
  }

  return {
    success: true,
    workerId: worker._id,
    trustedWorkerBadge: worker.trustedWorkerBadge,
    reviewStatus: progress?.adminReview?.status || 'pending',
  };
}

module.exports = {
  generateOrAssignUpskillPlan,
  getWorkerUpskillPlan,
  submitQuizAnswer,
  adminAwardBadge,
  ensureStandardLessons,
};
