const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const SkillQuestion = require('../models/SkillQuestion');

const QUESTIONS_DATA = [
  // 1. Plumbing
  {
    category: 'Plumbing',
    questionText: 'When fixing a leaking tap or valve under a kitchen sink, what is the very first physical safety step you take before loosening any pipes?',
    questionTextTamil: 'சமையலறை தொட்டிக்கு அடியில் கசியும் குழாயை சரிசெய்யும் முன் நீங்கள் எடுக்கும் முதல் பாதுகாப்பு நடவடிக்கை என்ன?',
    keyEvaluationCriteria: ['water supply isolation', 'shut off main valve', 'drain residual pressure'],
    difficulty: 'basic',
  },
  {
    category: 'Plumbing',
    questionText: 'A customer reports low water pressure in their bathroom shower while all other taps have good pressure. What do you inspect first?',
    questionTextTamil: 'குளியலறை ஷவரில் மட்டும் குறைந்த நீர் அழுத்தம் இருந்தால் முதலில் எதை ஆய்வு செய்வீர்கள்?',
    keyEvaluationCriteria: ['shower head sediment mesh', 'mineral scale clogging', 'individual shower valve'],
    difficulty: 'intermediate',
  },
  {
    category: 'Plumbing',
    questionText: 'How do you properly seal a threaded PVC pipe connection to prevent high-pressure water leaks?',
    questionTextTamil: 'பிவிசி குழாய் இணைப்புகளில் கசிவை தடுக்க டெஃப்லான் டேப்பை எவ்வாறு சரியாக சுற்றுவீர்கள்?',
    keyEvaluationCriteria: ['Teflon thread seal tape clockwise', 'pipe joint compound', 'tighten with pipe wrench'],
    difficulty: 'intermediate',
  },

  // 2. Electrical Repairs
  {
    category: 'Electrical Repairs',
    questionText: 'If an MCB trips repeatedly as soon as a customer turns on their geyser, how do you determine if the issue is in the MCB or the geyser heating element?',
    questionTextTamil: 'கீசர் இயக்கியவுடன் MCB டிரிப் ஆனால், பிரச்சனை MCB-யிலா அல்லது ஹீட்டிங் எலிமெண்டிலா என்பதை எவ்வாறு கண்டறிவீர்கள்?',
    keyEvaluationCriteria: ['multimeter resistance test', 'earth fault insulation check', 'isolate geyser plug'],
    difficulty: 'intermediate',
  },
  {
    category: 'Electrical Repairs',
    questionText: 'What safety precautions and tools do you use before working inside a main Distribution Box (DB)?',
    questionTextTamil: 'பிரதான விநியோக பெட்டிக்குள் (DB Box) வேலை செய்வதற்கு முன் என்ன பாதுகாப்பு உபகரணங்களை பயன்படுத்துவீர்கள்?',
    keyEvaluationCriteria: ['insulated gloves/tools', 'turn off main isolator', 'neon tester/voltmeter check'],
    difficulty: 'basic',
  },
  {
    category: 'Electrical Repairs',
    questionText: 'Explain how you check for proper earth grounding in a 3-pin socket using a digital multimeter.',
    questionTextTamil: 'டிஜிட்டல் மல்டிமீட்டரைப் பயன்படுத்தி 3-பின் சாக்கெட்டில் எர்த் கனெக்ஷனை எவ்வாறு சரிபார்ப்பீர்கள்?',
    keyEvaluationCriteria: ['Phase to Neutral voltage 230V', 'Phase to Earth voltage 230V', 'Neutral to Earth < 5V'],
    difficulty: 'advanced',
  },

  // 3. AC Service and Repair
  {
    category: 'AC Service and Repair',
    questionText: 'What causes an indoor split AC unit to drip water down the wall inside a bedroom, and how do you clean or fix it?',
    questionTextTamil: 'ஸ்பிளிட் ஏசியில் உள்ளே தண்ணீர் கசிவதற்கு என்ன காரணம், அதை எவ்வாறு சுத்தம் செய்வீர்கள்?',
    keyEvaluationCriteria: ['condensate drain pipe clog', 'drain tray clearing', 'level gradient check'],
    difficulty: 'basic',
  },
  {
    category: 'AC Service and Repair',
    questionText: 'If an AC compressor runs for 2 minutes and then shuts off while blowing warm air, what electrical or pressure issue do you diagnose?',
    questionTextTamil: 'ஏசி கம்ப்ரஸர் 2 நிமிடங்கள் ஓடி நின்றுவிட்டால் என்ன மின்தடை அல்லது பிரஷர் பிரச்சனையாக இருக்கும்?',
    keyEvaluationCriteria: ['run capacitor failure', 'overload protector trip', 'refrigerant gas leak'],
    difficulty: 'intermediate',
  },
  {
    category: 'AC Service and Repair',
    questionText: 'Explain the safety procedure for checking R32 or R410A refrigerant gas pressure using a manifold gauge.',
    questionTextTamil: 'R32 அல்லது R410A வாயு அழுத்தத்தை மேனிஃபோல்ட் கேஜ் மூலம் சரிபார்க்கும் பாதுகாப்பு முறை என்ன?',
    keyEvaluationCriteria: ['purge hoses', 'suction line standing/running pressure', 'refrigerant flammability safety'],
    difficulty: 'advanced',
  },

  // 4. Refrigerator Repair
  {
    category: 'Refrigerator Repair',
    questionText: 'If a single-door refrigerator compressor is running continuously but the freezer is not forming ice, what is the probable cause?',
    questionTextTamil: 'சிங்கிள் டோர் பிரிட்ஜ் கம்ப்ரஸர் தொடர்ந்து ஓடியும் பனி உருவாகவில்லை என்றால் என்ன காரணம்?',
    keyEvaluationCriteria: ['gas leak/shortage', 'capillary blockage', 'compressor low pumping efficiency'],
    difficulty: 'intermediate',
  },
  {
    category: 'Refrigerator Repair',
    questionText: 'How do you test if a frost-free refrigerator relay switch or overload protector is burnt out?',
    questionTextTamil: 'ஃப்ராஸ்ட் ஃபிரீ பிரிட்ஜில் ரிலே சுவிட்ச் அல்லது ஓவர்லோட் ப்ரொடெக்டர் பழுதாகிவிட்டதா என்பதை எவ்வாறு சோதிப்பீர்கள்?',
    keyEvaluationCriteria: ['shake test for rattling', 'multimeter continuity test across pin terminals'],
    difficulty: 'basic',
  },

  // 5. Washing Machine Repair
  {
    category: 'Washing Machine Repair',
    questionText: 'If a top-load washing machine vibrates violently and stops during the high-speed spin cycle, what mechanical parts do you inspect?',
    questionTextTamil: 'வாஷிங் மெஷின் ஸ்பின் சைக்கிளின் போது பலமாக அதிர்ந்தால் என்ன பாகங்களை ஆய்வு செய்வீர்கள்?',
    keyEvaluationCriteria: ['suspension rod dampers', 'unbalanced load sensor switch', 'tub balance ring'],
    difficulty: 'intermediate',
  },
  {
    category: 'Washing Machine Repair',
    questionText: 'How do you diagnose why a fully automatic washing machine is not draining water out of the drum?',
    questionTextTamil: 'வாஷிங் மெஷினில் தண்ணீர் வெளியேறவில்லை என்றால் டிரெய்ன் மோட்டாரை எவ்வாறு சோதிப்பீர்கள்?',
    keyEvaluationCriteria: ['drain pump motor impeller blockage', 'drain valve coin/lint filter clog', 'PCB drain output voltage'],
    difficulty: 'basic',
  },

  // 6. Water Purifier Service
  {
    category: 'Water Purifier Service',
    questionText: 'When installing a new RO membrane filter, how do you verify proper TDS reduction and waste-to-pure water ratio?',
    questionTextTamil: 'புதிய RO மெம்பரின் சுத்திகரிப்புத்திறனை TDS மீட்டரைக் கொண்டு எவ்வாறு சரிபார்ப்பீர்கள்?',
    keyEvaluationCriteria: ['TDS meter inlet vs product water test', '90%+ TDS reduction', 'reject water flow restrictor check'],
    difficulty: 'intermediate',
  },
  {
    category: 'Water Purifier Service',
    questionText: 'If a water purifier pump is running continuously but no purified water enters the storage tank, what do you check?',
    questionTextTamil: 'வாட்டர் பியூரிஃபையர் பம்ப் ஓடியும் தண்ணீர் டேங்கிற்கு வரவில்லை என்றால் என்ன செக் செய்வீர்கள்?',
    keyEvaluationCriteria: ['SV solenoid valve stuck closed', 'booster pump pressure psi', 'clogged pre-sediment filter'],
    difficulty: 'basic',
  },
];

async function seedSkillQuestions() {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smartfix';
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB for SkillQuestions seeding');

    await SkillQuestion.deleteMany({});
    console.log('🧹 Cleared existing skillQuestions collection');

    const inserted = await SkillQuestion.insertMany(QUESTIONS_DATA);
    console.log(`🎉 Successfully seeded ${inserted.length} practical skill questions across 6 categories!`);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  seedSkillQuestions();
}

module.exports = { seedSkillQuestions };
