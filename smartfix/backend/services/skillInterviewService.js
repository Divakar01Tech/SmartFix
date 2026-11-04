const InterviewSession = require('../models/InterviewSession');
const User = require('../models/User');
const { callGeminiApi } = require('./geminiService');
const { generateWorkerBio } = require('../controllers/bioController');

/**
 * Normalizes any category string or trade alias to one of the 6 canonical SmartFix services
 */
function normalizeCategory(rawCat) {
  if (!rawCat) return 'Plumbing';
  const c = rawCat.toString().trim().toLowerCase();

  // 1. Water Purifier Service
  if (
    c.includes('purif') ||
    c.includes('water') ||
    /\bro\b/.test(c) ||
    c.includes('வாட்டர்') ||
    c.includes('பியூரிஃபையர்') ||
    c.includes('filter')
  ) {
    return 'Water Purifier Service';
  }

  // 2. Washing Machine Repair
  if (
    c.includes('wash') ||
    c.includes('வாஷிங்') ||
    c.includes('துவைக்கும்') ||
    c.includes('laundry')
  ) {
    return 'Washing Machine Repair';
  }

  // 3. Refrigerator Repair
  if (
    c.includes('refrig') ||
    c.includes('fridge') ||
    c.includes('பிரிட்ஜ்') ||
    c.includes('freeze')
  ) {
    return 'Refrigerator Repair';
  }

  // 4. Electrical Repairs
  if (
    c.includes('electr') ||
    c.includes('power') ||
    c.includes('மின்') ||
    c.includes('வயரிங்') ||
    /\bmcb\b/.test(c) ||
    /\bfan\b/.test(c) ||
    c.includes('wiring')
  ) {
    return 'Electrical Repairs';
  }

  // 5. AC Service and Repair
  if (
    /\bac\b/.test(c) ||
    /\ba\/c\b/.test(c) ||
    c.includes('air condition') ||
    c.includes('air-condition') ||
    c.includes('aircon') ||
    c.includes('hvac') ||
    c.includes('cool') ||
    c.includes('ஏசி') ||
    c.includes('குளிர்சாதனம்')
  ) {
    return 'AC Service and Repair';
  }

  // 6. Plumbing
  if (
    c.includes('plumb') ||
    c.includes('pipe') ||
    c.includes('குழாய்') ||
    c.includes('பிளம்பிங்') ||
    c.includes('drain') ||
    c.includes('tap')
  ) {
    return 'Plumbing';
  }

  return 'Plumbing';
}

/**
 * Deep Trade Domain Knowledge and Specific Guidelines for all 6 Services
 */
const TRADE_DOMAIN_DETAILS = {
  'AC Service and Repair': {
    tradeNameEn: 'AC Service and Repair (AC Mechanic)',
    tradeNameTa: 'ஏசி மெக்கானிக் (AC Service & Repair)',
    focusAreas: 'Refrigerant pressure checks (R32, R410A, R22), manifold gauges, vacuum pump before gas charging, indoor unit water leakage from drain pipe or condensate tray, compressor run capacitor diagnostics, outdoor unit condenser coil cleaning, inverter split AC communication error codes (indoor-to-outdoor PCB), deep jet wash service with motor and PCB waterproof masking, flammable gas safety protocols.',
    tamilInstructions: 'கேள்வி ஏசி மெக்கானிக் (AC Mechanic) வேலை சார்ந்ததாக மட்டுமே இருக்க வேண்டும். கூலிங் பிரச்சனை, கேஸ் லீக், இன்டோர் தண்ணீர் ஒழுகுதல், கம்ப்ரசர் கெபாசிட்டர், இன்வெர்ட்டர் பிசிபி எரர், ஜெட் வாஷ் சர்வீஸ் பாதுகாப்பு போன்ற உண்மையான களப்பணி கேள்விகளை மட்டுமே கேட்கவும்.',
  },
  'Plumbing': {
    tradeNameEn: 'Plumbing (Plumber)',
    tradeNameTa: 'பிளம்பர் (Plumbing & Pipe Repair)',
    focusAreas: 'Concealed wall leakage detection without breaking unnecessary tiles, CPVC and PVC solvent cement welding, pipe cutting, reaming and pressure testing, clearing air locks in main lines from overhead tanks, western toilet flush cistern overflowing/siphon valves, ball valves and gate valves replacement under pressure, kitchen sink P-trap grease blockage clearing, line pressure isolation and pipe wrench safety.',
    tamilInstructions: 'கேள்வி பிளம்பிங் (Plumber) வேலை சார்ந்ததாக மட்டுமே இருக்க வேண்டும். மறைமுக பைப் கசிவு, CPVC/PVC பசை இணைப்புகள், மேல்நிலை தொட்டி ஏர் லாக் நீக்குதல், டாய்லெட் பிளஷ் வால்வு, கேட் வால்வு மாற்றுதல் போன்ற நேரடி பிளம்பிங் பழுது சார்ந்த கேள்விகளை மட்டுமே கேட்கவும்.',
  },
  'Electrical Repairs': {
    tradeNameEn: 'Electrical Repairs (Electrician)',
    tradeNameTa: 'எலக்ட்ரீஷியன் (Electrical Repairs)',
    focusAreas: 'Distribution box (DB) troubleshooting, MCB and RCCB/ELCB tripping isolation (geysers, pumps), neutral loop faults and loose neutral diagnosis, 3-pin socket earthing voltage testing using digital multimeter (Phase-Neutral 230V, Phase-Earth 230V, Neutral-Earth < 2V), ceiling fan slow speed / capacitor (2.25µF) / starting vs running winding continuity, 3-phase load balancing, inverter-battery wiring, personal electrical safety and insulated tool protocol.',
    tamilInstructions: 'கேள்வி எலக்ட்ரீஷியன் (Electrician) வேலை சார்ந்ததாக மட்டுமே இருக்க வேண்டும். ELCB/MCB டிரிப் ஆகுதல், மல்டிமீட்டர் மூலம் எர்த்திங் டெஸ்டிங், சீலிங் ஃபேன் கெபாசிட்டர்/காயில் பழுது, 3-பேஸ் நியூட்ரல் பிரச்சனை, மின் அதிர்ச்சி தடுப்பு பாதுகாப்பு போன்ற உண்மையான மின்சார வேலை கேள்விகளை மட்டுமே கேட்கவும்.',
  },
  'Refrigerator Repair': {
    tradeNameEn: 'Refrigerator Repair (Fridge Technician)',
    tradeNameTa: 'பிரிட்ஜ் மெக்கானிக் (Refrigerator Repair)',
    focusAreas: 'Single & double-door frost-free refrigerators, compressor running continuously with zero cooling, gas leakage vs capillary tube moisture/oil choke, frost-free defrost system troubleshooting (defrost timer, bimetal thermostat, thermal fuse, defrost heater element), compressor clicking sound diagnosis (PTC starter relay and overload protector OLP), inverter BLDC compressor 3-phase U-V-W resistance test and driver board signal, R600a/R134a gas charging and cabinet electric shock prevention.',
    tamilInstructions: 'கேள்வி பிரிட்ஜ் மெக்கானிக் (Refrigerator Technician) வேலை சார்ந்ததாக மட்டுமே இருக்க வேண்டும். பிரீசரில் ஐஸ் கட்டாதது, பிராஸ்ட்-ப்ரீ டீப்ராஸ்ட் டைமர்/ஹீட்டர் பழுது, PTC ரிலே மற்றும் OLP பரிசோதனை, இன்வெர்ட்டர் BLDC கம்ப்ரசர், R600a கேஸ் சார்ஜிங் மற்றும் பாடி ஷாக் போன்ற கேள்விகளை மட்டுமே கேட்கவும்.',
  },
  'Washing Machine Repair': {
    tradeNameEn: 'Washing Machine Repair (Washer Technician)',
    tradeNameTa: 'வாஷிங் மெஷின் மெக்கானிக் (Washing Machine Repair)',
    focusAreas: 'Top-load and front-load washing machines, violent vibration and cabinet banging during spin cycle (suspension dampener rods, drum spider, shock absorbers, balance ring), drain pump failure and error codes (OE/E2), coin trap cleaning, continuous water filling and overflow (defective inlet solenoid valve, pressure level sensor switch and air tube leak), motor humming without drum rotation (drive belt, run capacitor, BLDC direct drive hall sensor), door lock interlock switch testing and main PCB handling.',
    tamilInstructions: 'கேள்வி வாஷிங் மெஷின் மெக்கானிக் வேலை சார்ந்ததாக மட்டுமே இருக்க வேண்டும். ஸ்பின் சுழற்சியில் கடுமையான அதிர்வு, தண்ணீர் வெளியேறாத OE எரர், தண்ணீர் நிக்காமல் வழிதல்/பிரஷர் சுவிட்ச் பழுது, டிரைவ் பெல்ட்/மோட்டார், பிரண்ட் லோட் டோர் லாக் சுவிட்ச் போன்ற நடைமுறை பழுது கேள்விகளை மட்டுமே கேட்கவும்.',
  },
  'Water Purifier Service': {
    tradeNameEn: 'Water Purifier Service (RO Technician)',
    tradeNameTa: 'ஆர்.ஓ வாட்டர் பியூரிஃபையர் சர்வீஸ் (RO Technician)',
    focusAreas: 'Domestic RO + UV + UF water purifiers, measuring TDS reduction and rejection percentage (high raw TDS vs pure output TDS), RO membrane scaling and flow restrictor (FR) replacement, booster pump pressure measurement using gauge (80-100 PSI minimum), filter replacement sequence (spun sediment, pre-carbon, post-carbon) and mandatory carbon flushing before membrane inlet, continuous wastewater drainage from stuck solenoid valve (SV), float switch automatic shut-off, UV lamp ballast testing, storage tank sanitization and post-service taste correction.',
    tamilInstructions: 'கேள்வி ஆர்.ஓ வாட்டர் பியூரிஃபையர் (RO Purifier) வேலை சார்ந்ததாக மட்டுமே இருக்க வேண்டும். TDS அளவு குறைத்தல், பூஸ்டர் பம்ப் பிரஷர் (80-100 PSI), செடிமென்ட் மற்றும் கார்பன் ஃபில்டர் பிளஷிங், வேஸ்ட் வாட்டர் நிக்காமல் போகும் SV வால்வு பழுது, UV சேம்பர் மற்றும் டேங்க் துர்நாற்றம் நீக்குதல் போன்ற கேள்விகளை மட்டுமே கேட்கவும்.',
  },
};

/**
 * 6 Core Trade-Specific Practical Question Banks (Bilingual: English & Tamil)
 */
const TRADE_QUESTIONS_BILINGUAL = {
  'AC Service and Repair': {
    en: [
      'When a split AC compressor runs but only blows warm air without cooling, how do you verify if the issue is low refrigerant gas versus a failed compressor run capacitor?',
      'A customer complains that water is dripping down the wall inside their bedroom from the indoor AC unit. What are the common causes and how do you unclog the drain tray or pipe?',
      'On an inverter split AC, if the outdoor unit fails to turn on and displays a communication error code, what step-by-step checks do you perform on the wiring and inverter PCB?',
      'When doing a deep jet-pump water wash service on an indoor split AC, what essential precautions do you take to prevent water from entering the PCB and blower motor?',
      'What safety protocols and manifold gauge procedures must you follow when checking or charging flammable R32 gas, and why is vacuuming the copper lines mandatory before charging?'
    ],
    ta: [
      'ஒரு ஸ்பிளிட் ஏசி ஓடும்போது குளிர்ந்த காற்று வராமல் சாதாரண காற்று மட்டும் அடித்தால், அதில் கேஸ் குறைவா அல்லது கம்ப்ரசர் ரன் கெபாசிட்டர் பழுதா என்பதை எப்படி பரிசோதிப்பீர்கள்?',
      'வீட்டிற்குள் இருக்கும் ஏசி இன்டோர் யூனிட்டில் இருந்து சுவர் வழியாக தண்ணீர் ஒழுகுவதாக வாடிக்கையாளர் கூறினால், அதற்கு என்ன காரணம் மற்றும் அதை எப்படி சரிசெய்வீர்கள்?',
      'இன்வெர்ட்டர் ஏசியில் அவுட்டோர் யூனிட் இயங்காமல் எரர் கோடு காட்டினால், இன்டோர்-அவுட்டோர் வயரிங் மற்றும் பிசிபி (PCB) போர்டை எப்படி பரிசோதிப்பீர்கள்?',
      'ஸ்பிளிட் ஏசிக்கு ஜெட் பம்ப் மூலம் வாட்டர் சர்வீஸ் செய்யும்போது, இன்டோர் பிசிபி போர்டு மற்றும் மோட்டாருக்குள் தண்ணீர் புகாமல் இருக்க என்ன பாதுகாப்பு செய்வீர்கள்?',
      'R32 போன்ற எரியக்கூடிய கேஸ் நிரப்பும் போது என்ன பாதுகாப்பு விதிகளை கடைப்பிடிப்பீர்கள், மற்றும் கேஸ் ஏற்றுவதற்கு முன் சிஸ்டத்தை வேக்யூம் (Vacuum) செய்வது ஏன் கட்டாயம்?'
    ]
  },
  'Plumbing': {
    en: [
      'A customer notices water seepage and dampness on a bedroom wall sharing a bathroom. How do you locate the concealed pipe leak without breaking all the wall tiles?',
      'Explain the correct step-by-step procedure for cutting, cleaning, and solvent cement welding of CPVC pipes so that high water pressure will not cause leaks.',
      'The overhead water tank is full, but no water flows from the bathroom taps due to an air lock in the main pipeline. How do you clear the air lock?',
      'If a western toilet flush tank continuously runs water into the commode bowl and overflows, what part is defective and how do you repair or replace it?',
      'What safety measures and pipe wrench techniques do you use when replacing a damaged main water line gate valve or ball valve under active supply pressure?'
    ],
    ta: [
      'பாத்ரூம் சுவரில் உள்ளே செல்லும் மறைமுக பைப் லைனில் கசிவு ஏற்பட்டு பக்கத்து சுவரில் ஈரம் இறங்கினால், அனைத்து டைல்ஸ்களையும் உடைக்காமல் கசிவு உள்ள இடத்தை எப்படி கண்டுபிடிப்பீர்கள்?',
      'CPVC பைப்புகளை வெட்டி, பசை (Solvent Cement) போட்டு இணைக்கும் போது, அதிக நீர் அழுத்தத்திலும் கசிவு ஏற்படாமல் இருக்க என்ன முறையை பின்பற்றுவீர்கள்?',
      'மேல்நிலை தண்ணீர் தொட்டியில் முழுமையாக தண்ணீர் இருந்தும் பைப் லைனில் காற்று அடைத்து (Air Lock) குழாய்களில் தண்ணீர் வராவிட்டால், அந்த ஏர் லாக்கை எப்படி நீக்குவீர்கள்?',
      'வெஸ்டர்ன் டாய்லெட் ஃப்ளஷ் டேங்கில் தண்ணீர் நிக்காமல் தொடர்ந்து கிண்ணத்திற்குள் (Commode) வழிந்து கொண்டே இருந்தால், எந்த பாகத்தை சரிசெய்வீர்கள்?',
      'மெயின் லைனில் உடைந்த கேட் வால்வு அல்லது பால் வால்வை மாற்றும்போது, நீர் அழுத்தத்தை கட்டுப்படுத்தி பாதுகாப்பாக வேலை செய்ய என்ன செய்வீர்கள்?'
    ]
  },
  'Electrical Repairs': {
    en: [
      'If an RCCB/ELCB trips immediately every time a customer switches on their water heater (geyser), how do you isolate whether the fault is in the heating element, wiring, or RCCB itself?',
      'Explain how you test for proper earth grounding in a 3-pin 16A power socket using a digital multimeter, and what voltage readings you expect between Phase, Neutral, and Earth.',
      'A ceiling fan rotates very slowly and hums loudly even at top regulator speed. How do you test the capacitor and check starting versus running coil windings?',
      'In a house with 3-phase supply, one phase is showing low voltage and heavy spark when heavy appliances start. How do you diagnose a loose neutral or unbalanced load?',
      'What standard safety equipment and lockout procedures do you use before touching wires in an electrical distribution board to ensure zero electric shock hazard?'
    ],
    ta: [
      'வாடிக்கையாளர் வாட்டர் ஹீட்டர் (கீசர்) போடும்போது மட்டும் மெயின் ELCB/RCCB டிரிப் ஆனால், பிரச்சனை ஹீட்டிங் காயிலா, வயரிங்கா அல்லது ELCB-யா என்பதை எப்படி கண்டறிவீர்கள்?',
      'டிஜிட்டல் மல்டிமீட்டர் மூலம் 3-பின் சாக்கெட்டில் எர்த்திங் (Earthing) சரியாக உள்ளதா என்பதை எப்படி சோதிப்பீர்கள்? Phase-Neutral மற்றும் Phase-Earth வோல்டேஜ் அளவு என்னவாக இருக்க வேண்டும்?',
      'சீலிங் ஃபேன் முழு வேகத்தில் வைத்தும் மெதுவாக சுழன்று சத்தம் மட்டும் வந்தால், அதன் கெபாசிட்டர் மற்றும் வைண்டிங் காயிலை எப்படி பரிசோதிப்பீர்கள்?',
      '3-பேஸ் மின் இணைப்பில் ஒரு பேஸ் மட்டும் குறைந்த வோல்டேஜ் காட்டினால், நியூட்ரல் லூஸ் கனெக்ஷனா அல்லது லோடு சமநிலையின்மையா என்பதை எப்படி சரிசெய்வீர்கள்?',
      'மெயின் பேனல் போர்டில் வேலை செய்யும் போது மின்சார அதிர்ச்சி (Electric Shock) ஏற்படாமல் இருக்க என்னென்ன பாதுகாப்பு கருவிகள் மற்றும் முன்னெச்சரிக்கை நடவடிக்கைகளை எடுப்பீர்கள்?'
    ]
  },
  'Refrigerator Repair': {
    en: [
      'The refrigerator compressor is vibrating and running constantly, but the freezer is not making ice and the condenser coil is cold. How do you diagnose a gas leak versus a capillary tube blockage?',
      'In a double-door frost-free refrigerator, the freezer has thick ice blocking the air vents and the lower fresh food compartment is warm. How do you test the defrost timer, bimetal sensor, and defrost heater?',
      'When the refrigerator tries to start, you hear a click sound every 2 minutes and the compressor fails to run. How do you test the PTC starter relay and overload protector (OLP) with a multimeter?',
      'How do you test the 3-phase resistance (U-V-W terminals) of an inverter refrigerator BLDC compressor, and how do you know if the inverter PCB board is sending voltage pulses?',
      'A customer complains of getting a mild electric shock when opening the refrigerator door. What is the cause, and what precautions do you take when vacuuming and charging flammable R600a gas?'
    ],
    ta: [
      'பிரிட்ஜ் கம்ப்ரசர் ஓடிக்கொண்டே இருக்கிறது, ஆனால் பிரீசரில் ஐஸ் கட்டவில்லை, பின்புற காயிலும் சூடாகவில்லை என்றால், கேஸ் லீக்கா அல்லது கேபிலரி குழாய் அடைப்பா என்பதை எப்படி கண்டுபிடிப்பீர்கள்?',
      'டபுள் டோர் பிராஸ்ட்-ப்ரீ பிரிட்ஜில் கீழே குளிர்ச்சி வராமல் மேலே ஐஸ் கட்டி ஏர் வென்ட்டை அடைத்துக்கொண்டால், டீப்ராஸ்ட் டைமர், பயோமெட்டல் சென்சார் மற்றும் ஹீட்டரை எப்படி பரிசோதிப்பீர்கள்?',
      'பிரிட்ஜ் ஆன் ஆகும்போது கம்ப்ரசர் ஓடாமல் இரண்டு நிமிடத்திற்கு ஒருமுறை "டிக்" என்று சத்தம் மட்டும் வந்தால், PTC ரிலே மற்றும் OLP-ஐ மல்டிமீட்டர் மூலம் எப்படி பரிசோதிப்பீர்கள்?',
      'இன்வெர்ட்டர் பிரிட்ஜ் BLDC கம்ப்ரசரில் உள்ள U, V, W டெர்மினல்களின் ரெசிஸ்டன்ஸ் மதிப்பை எப்படி அளவிடுவீர்கள்? இன்வெர்ட்டர் பிசிபி போர்டு சரியாக வேலை செய்கிறதா என்பதை எப்படி அறிவீர்கள்?',
      'பிரிட்ஜ் கதவை தொடும்போது லேசான ஷாக் அடித்தால் என்ன காரணம்? மேலும் எரியக்கூடிய R600a கேஸ் ஏற்றும்போது என்ன பாதுகாப்பு விதிகளை பின்பற்ற வேண்டும்?'
    ]
  },
  'Washing Machine Repair': {
    en: [
      'A top-load washing machine washes fine, but when it enters high-speed spin cycle, it vibrates violently, bangs against the body, and stops with an error. What parts do you inspect and replace?',
      'The washing machine stops mid-cycle full of soapy water and displays a drain error (such as OE or E2). How do you safely drain the water, clean the coin trap filter, and test the drain pump motor?',
      'Water keeps filling into the washing machine drum continuously and overflows even when the power button is switched off. What is the cause, and how does the pressure sensor switch work?',
      'The motor hums but the washing machine drum does not turn during wash mode. How do you diagnose a broken drive belt, seized drum bearings, or a bad motor capacitor?',
      'On a front-load washer, the cycle will not start and the door lock error light flashes. How do you test the thermal door interlock switch, and what safety steps do you take around the main PCB?'
    ],
    ta: [
      'வாஷிங் மெஷின் துவைக்கும் போது நன்றாக ஓடுகிறது, ஆனால் ஸ்பின் (Spin) சுழற்சிக்கு வரும்போது பலத்த சத்தத்துடன் ஆடி பாடியில் மோதி நின்றால், எந்த பாகங்களை பரிசோதித்து மாற்றுவீர்கள்?',
      'வாஷிங் மெஷினில் தண்ணீர் வெளியேறாமல் "OE" அல்லது "E2" எரர் காட்டினால், தண்ணீரை பாதுகாப்பாக வெளியேற்றி டிரைன் பம்ப் மற்றும் ஃபில்டரை எப்படி சரிசெய்வீர்கள்?',
      'மெஷின் ஆஃப் செய்திருந்தாலும் டிரம்மிற்குள் தண்ணீர் நிக்காமல் வந்து வழிந்து கொண்டே இருந்தால் எந்த வால்வு பழுது? மேலும் வாட்டர் லெவல் பிரஷர் சுவிட்ச்சை எப்படி பரிசோதிப்பீர்கள்?',
      'வாஷிங் மெஷின் மோட்டார் சத்தம் போடுகிறது ஆனால் டிரம் சுழலவில்லை என்றால், டிரைவ் பெல்ட், டிரம் பேரிங் அல்லது மோட்டார் கெபாசிட்டரை எப்படி பரிசோதிப்பீர்கள்?',
      'பிரண்ட் லோட் மெஷினில் கதவு லாக் ஆகாமல் மிஷின் ஸ்டார்ட் ஆகவில்லை என்றால், டோர் லாக் சுவிட்சை எப்படி சோதிப்பீர்கள் மற்றும் மெயின் பிசிபி போர்டை கையாளும் போது என்ன பாதுகாப்பு எடுப்பீர்கள்?'
    ]
  },
  'Water Purifier Service': {
    en: [
      'If raw borewell water has a TDS of 1000 PPM, but the pure water output shows a high TDS of 350 PPM, what steps do you take to inspect the RO membrane and flow restrictor (FR)?',
      'Pure water drops to a tiny slow trickle even with clean pre-filters. How do you measure the RO booster pump pressure with a pressure gauge, and what is the minimum required operating PSI?',
      'Explain the correct sequence of pre-filters (spun sediment, pre-carbon, sediment) and why carbon cartridges must be thoroughly flushed with water before connecting to the RO membrane.',
      'A customer notices that rejected waste water keeps flowing down the drain continuously 24 hours a day even when the storage tank is completely full. What component is stuck open?',
      'How do you test whether the inline UV lamp and electronic ballast are functioning properly, and what procedure do you follow to clean and sanitize the storage tank to remove bad odor or taste?'
    ],
    ta: [
      'உள்ளே வரும் போர்வெல் தண்ணீரின் TDS 1000 ஆக இருக்கும்போது, சுத்திகரிக்கப்பட்ட RO தண்ணீரின் TDS 350 என மிக அதிகமாக வந்தால், RO மெம்பிரேன் மற்றும் FR-ஐ எப்படி பரிசோதிப்பீர்கள்?',
      'ப்ரீ-ஃபில்டர்கள் சுத்தமாக இருந்தும் RO பியூர் தண்ணீர் சொட்டு சொட்டாக மிகக் குறைவாக வந்தால், பூஸ்டர் பம்ப் பிரஷரை எப்படி அளவிடுவீர்கள்? அதற்கு குறைந்தபட்சம் எத்தனை PSI பிரஷர் இருக்க வேண்டும்?',
      'ஸ்பன் செடிமென்ட், ப்ரீ-கார்பன் ஃபில்டர்களை சரியான வரிசையில் பொருத்துவது எப்படி? புதிய கார்பன் ஃபில்டரை மாட்டியவுடன் மெம்பிரேனுடன் இணைப்பதற்கு முன் தண்ணீரில் ஏன் பிளஷ் (Flush) செய்ய வேண்டும்?',
      'தண்ணீர் தொட்டி நிரம்பிய பின்பும் வேஸ்ட் வாட்டர் பைப் வழியாக 24 மணி நேரமும் தண்ணீர் நிக்காமல் வெளியேறிக்கொண்டே இருந்தால், எந்த சோலனாய்டு வால்வு (SV) பழுது மற்றும் அதை எப்படி மாற்றுவீர்கள்?',
      'UV லேம்ப் மற்றும் சோக் (Ballast) சரியாக எரிகிறதா என்பதை எப்படி பரிசோதிப்பீர்கள்? தண்ணீர் டேங்கில் இருந்து துர்நாற்றம் அல்லது சுவை மாற்றம் வராமல் இருக்க டேங்கை எப்படி சுத்தம் செய்வீர்கள்?'
    ]
  }
};

// Backward-compatible fallback mapping
const CATEGORY_FALLBACK_QUESTIONS = Object.fromEntries(
  Object.entries(TRADE_QUESTIONS_BILINGUAL).map(([k, v]) => [k, v.en])
);

/**
 * Pre-check for substantive answers to prevent trivial single-word responses
 */
function isLikelyRealAnswer(text) {
  if (!text || typeof text !== 'string') return false;
  const cleaned = text.trim();
  // Strip punctuation and symbols across all languages using Unicode property escapes
  const normalized = cleaned.replace(/[^\p{L}\p{N}\s]/gu, '').trim();
  if (cleaned.length < 6 || normalized.length < 3) return false;
  const lower = cleaned.toLowerCase();
  const greetingsOnly = ['hi', 'hii', 'hello', 'hey', 'ok', 'yes', 'no', 'test', 'வணக்கம்', 'சரி', 'ஆமாம்', 'இல்லை'];
  if (greetingsOnly.includes(lower) || greetingsOnly.includes(normalized.toLowerCase())) return false;
  return true;
}

/**
 * Call Gemini API or OpenRouter API with context history
 */
async function callLlmApi(messagesPayload, temperature = 0.3, maxTokens = 600) {
  if (process.env.GROK_API_KEY || process.env.GEMINI_API_KEY) {
    try {
      const geminiResult = await callGeminiApi(messagesPayload, temperature, maxTokens);
      if (geminiResult && geminiResult.text) {
        return geminiResult.text;
      }
    } catch (gErr) {
      console.warn('Gemini API attempt warning:', gErr.message);
    }
  }

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  const openRouterMessages = messagesPayload.map((m) => {
    if (m.role === 'system') {
      return { role: 'user', content: `[SYSTEM INSTRUCTION]\n${m.content}` };
    }
    return m;
  });

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'SmartFix Skill Verification AI',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'claude-sonnet-4-6',
        messages: openRouterMessages,
        temperature,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`AI Gateway status ${response.status}`);
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content || null;
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('⚠️ Skill Interview AI call warning:', err.message);
    return null;
  }
}

/**
 * 1. Start or resume interview session
 */
async function startInterview(workerId, category, language = 'en') {
  const normalizedCategory = normalizeCategory(category);

  // Clean up stale in_progress sessions older than 30 minutes (mark abandoned)
  const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
  await InterviewSession.updateMany(
    { workerId, status: 'in_progress', updatedAt: { $lt: thirtyMinsAgo } },
    { status: 'abandoned' }
  );

  // Check 24-hour rate limit rule: 1 session per worker per category per 24 hours
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentSession = await InterviewSession.findOne({
    workerId,
    category: normalizedCategory,
    startedAt: { $gte: twentyFourHoursAgo },
  }).sort({ createdAt: -1 });

  if (recentSession) {
    if (recentSession.status === 'in_progress') {
      return recentSession;
    }
    throw new Error('⏱️ Rate Limit: You can attempt 1 practical skill verification interview per 24 hours per category. Please try again tomorrow.');
  }

  const session = await InterviewSession.create({
    workerId,
    category: normalizedCategory,
    status: 'in_progress',
    messages: [],
    questionsAsked: 0,
    currentQuestionRetries: 0,
    startedAt: new Date(),
  });

  return await askNextQuestion(session._id, language);
}

/**
 * 2. Ask next question (1 to 5) strictly tailored to the chosen service trade
 */
async function askNextQuestion(sessionId, language = 'en') {
  const session = await InterviewSession.findById(sessionId);
  if (!session) throw new Error('Interview session not found');

  if (session.questionsAsked >= 5) {
    return session;
  }

  const rawCat = session.category || 'Plumbing';
  const category = normalizeCategory(rawCat);
  const qIndex = session.questionsAsked; // 0 to 4
  const isTamil = language === 'ta';

  const domain = TRADE_DOMAIN_DETAILS[category] || TRADE_DOMAIN_DETAILS['Plumbing'];
  const tradeEn = domain.tradeNameEn;
  const tradeTa = domain.tradeNameTa;

  const systemPrompt = `You are conducting a strict, trade-specific practical skill-verification interview for a technician joining SmartFix in the trade: "${category}" (${tradeEn} / ${tradeTa}).

CRITICAL REQUIREMENTS:
1. Every question MUST directly test real-world hands-on repair, diagnosis, and safety skills specifically for ${category}.
2. DO NOT ask generic customer service, billing, or general tool questions. Focus strictly on on-the-job scenarios for ${category}: ${domain.focusAreas}
3. Ask ONE practical question at a time.
4. Keep questions short, realistic, and direct. The candidate may answer by speaking or typing.
5. ${isTamil ? `IMPORTANT: Ask the question in simple, natural conversational Tamil used by local workers in Tamil Nadu. ${domain.tamilInstructions}` : 'Ask clearly in plain, professional English.'}
6. You are asking question ${qIndex + 1} of 5. After 5 questions total, stop and do not ask more.`;

  const historyPayload = [
    { role: 'system', content: systemPrompt },
    ...session.messages.map((m) => ({
      role: m.role === 'worker' ? 'user' : 'assistant',
      content: m.text,
    })),
    {
      role: 'user',
      content: isTamil
        ? `${category} பணிக்கான செயல்முறை கேள்வி எண் ${qIndex + 1} / 5 கேட்கவும்.`
        : `Please ask practical question ${qIndex + 1} of 5 for a ${category} technician.`
    },
  ];

  let nextQuestionText = await callLlmApi(historyPayload, 0.4, 600);

  if (process.env.NODE_ENV !== 'production') {
    console.log(`🤖 Trade Interview [${category}] Q${qIndex + 1} (${isTamil ? 'ta' : 'en'}):`, nextQuestionText);
  }

  // Robust Fallback from Trade-Specific Question Bank
  if (!nextQuestionText || nextQuestionText.trim().length < 15) {
    const questionsForTrade = TRADE_QUESTIONS_BILINGUAL[category] || TRADE_QUESTIONS_BILINGUAL['Plumbing'];
    const bank = isTamil ? questionsForTrade.ta : questionsForTrade.en;
    nextQuestionText = bank[qIndex % bank.length];
  }

  // Clean up quotes
  nextQuestionText = nextQuestionText.replace(/^["']|["']$/g, '').trim();

  session.messages.push({
    role: 'assistant',
    text: nextQuestionText,
    timestamp: new Date(),
  });
  session.questionsAsked += 1;
  await session.save();

  return session;
}

/**
 * 3. Submit worker answer
 */
async function submitAnswer(sessionId, answerText, language = 'en') {
  const session = await InterviewSession.findById(sessionId);
  if (!session) throw new Error('Interview session not found');

  if (session.status !== 'in_progress') {
    throw new Error('This interview session is already completed or expired.');
  }

  if (!answerText || !answerText.trim()) {
    throw new Error('Please type or speak your response before submitting.');
  }

  const cleanedAnswer = answerText.trim();
  const currentQNum = session.questionsAsked || 1;
  const isReal = isLikelyRealAnswer(cleanedAnswer);

  if (!isReal) {
    const currentRetries = session.currentQuestionRetries || 0;
    if (currentRetries < 2) {
      session.currentQuestionRetries = currentRetries + 1;

      session.messages.push({
        role: 'worker',
        text: cleanedAnswer,
        timestamp: new Date(),
      });

      const isTamil = language === 'ta';
      const repromptText = isTamil
        ? 'இது முழு பதில் இல்லை போல் இருக்கிறது — நீங்கள் உண்மையில் என்ன செய்வீர்கள் என்று சொந்த வார்த்தைகளில் விளக்கவும்.'
        : "That doesn't look like a full answer — please describe what you'd actually do, in your own words. Take your time.";

      session.messages.push({
        role: 'assistant',
        text: repromptText,
        timestamp: new Date(),
      });

      await session.save();
      return session;
    } else {
      session.currentQuestionRetries = 0;
      if (!session.autoFlaggedConcerns) session.autoFlaggedConcerns = [];
      session.autoFlaggedConcerns.push(`weak/short answer on Q${currentQNum} after retries`);
    }
  } else {
    session.currentQuestionRetries = 0;
  }

  session.messages.push({
    role: 'worker',
    text: cleanedAnswer,
    timestamp: new Date(),
  });

  await session.save();

  if (session.questionsAsked < 5) {
    return await askNextQuestion(sessionId, language);
  } else {
    return await generateFinalAssessment(sessionId);
  }
}

/**
 * 4. Generate Final AI Assessment (structured 4-criteria rubric evaluation)
 */
async function generateFinalAssessment(sessionId) {
  const session = await InterviewSession.findById(sessionId);
  if (!session) throw new Error('Interview session not found');

  const category = normalizeCategory(session.category);
  const domain = TRADE_DOMAIN_DETAILS[category] || TRADE_DOMAIN_DETAILS['Plumbing'];

  const transcriptText = session.messages
    .map((m) => `${m.role === 'assistant' ? 'AI Question' : 'Worker Answer'}: ${m.text}`)
    .join('\n');

  const evaluationSystemPrompt = `You are evaluating a practical skill interview transcript for a candidate applying as a "${category}" (${domain.tradeNameEn}).
Key Technical Domain for this Trade: ${domain.focusAreas}

Score EACH of the 5 answers against these 4 criteria (0-25 points each):
A. Practical Specificity (0-25) — concrete steps, proper trade tools (e.g. multimeter, manifold gauge, pipe wrench, vacuum pump, TDS meter) vs vague answers
B. Safety Awareness (0-25) — proactive electrical/water/gas shut-off, protective gear, earthing, handling flammable gases (R32/R600a)
C. Problem-Diagnosis Logic (0-25) — logical troubleshooting sequence (isolate component first before replacing)
D. Communication Clarity (0-25) — practical clarity only. DO NOT penalize broken English, Tamil, spelling or grammar. If the worker conveyed a sound technical procedure, award high clarity.

Compute 0-100 score for each answer (sum of 4 criteria). Average all 5 answer scores into one final score.
Final verdict: 70-100 = 'pass', 40-69 = 'borderline', 0-39 = 'fail'.

Respond ONLY in JSON with this exact shape:
{
  "verdict": "pass" | "borderline" | "fail",
  "confidenceScore": number,
  "perQuestionScores": [
    {
      "question": 1,
      "specificity": 0-25,
      "safety": 0-25,
      "diagnosisLogic": 0-25,
      "clarity": 0-25,
      "total": 0-100
    }
  ],
  "summary": "2-3 sentences explaining the technical assessment for an admin to review",
  "flaggedConcerns": ["string"]
}
Do not include markdown code block backticks.`;

  const payload = [
    { role: 'system', content: evaluationSystemPrompt },
    { role: 'user', content: `Interview Transcript for ${category} Worker:\n${transcriptText}` },
  ];

  let rawResult = await callLlmApi(payload, 0.2, 1000);

  let recommendation = {
    verdict: 'borderline',
    confidenceScore: 65,
    perQuestionScores: [],
    summary: `The worker completed all 5 practical scenario questions for ${category}. Their responses demonstrate basic operational understanding of repair workflows.`,
    flaggedConcerns: [],
  };

  if (rawResult) {
    try {
      let cleanedJson = rawResult.replace(/```json/gi, '').replace(/```/g, '').trim();
      const jsonMatch = cleanedJson.match(/\{[\s\S]*\}/);
      if (jsonMatch) cleanedJson = jsonMatch[0];

      const parsed = JSON.parse(cleanedJson);

      if (Array.isArray(parsed.perQuestionScores) && parsed.perQuestionScores.length > 0) {
        recommendation.perQuestionScores = parsed.perQuestionScores.map((q, idx) => {
          const spec = Math.min(25, Math.max(0, Number(q.specificity) || 0));
          const safe = Math.min(25, Math.max(0, Number(q.safety) || 0));
          const diag = Math.min(25, Math.max(0, Number(q.diagnosisLogic) || 0));
          const clar = Math.min(25, Math.max(0, Number(q.clarity) || 0));
          const calculatedTotal = spec + safe + diag + clar;
          return {
            question: q.question || (idx + 1),
            specificity: spec,
            safety: safe,
            diagnosisLogic: diag,
            clarity: clar,
            total: typeof q.total === 'number' ? Math.min(100, Math.max(0, Number(q.total))) : calculatedTotal,
          };
        });

        const totalSum = recommendation.perQuestionScores.reduce((sum, q) => sum + q.total, 0);
        const avgScore = Math.round(totalSum / recommendation.perQuestionScores.length);
        recommendation.confidenceScore = avgScore;

        if (avgScore >= 70) recommendation.verdict = 'pass';
        else if (avgScore >= 40) recommendation.verdict = 'borderline';
        else recommendation.verdict = 'fail';
      } else if (typeof parsed.confidenceScore === 'number') {
        const score = Math.min(100, Math.max(0, Math.round(parsed.confidenceScore)));
        recommendation.confidenceScore = score;
        if (score >= 70) recommendation.verdict = 'pass';
        else if (score >= 40) recommendation.verdict = 'borderline';
        else recommendation.verdict = 'fail';
      } else if (parsed.verdict && ['pass', 'borderline', 'fail'].includes(parsed.verdict.toLowerCase())) {
        recommendation.verdict = parsed.verdict.toLowerCase();
      }

      if (parsed.summary && typeof parsed.summary === 'string') {
        recommendation.summary = parsed.summary.trim();
      }
      if (Array.isArray(parsed.flaggedConcerns)) {
        recommendation.flaggedConcerns = parsed.flaggedConcerns;
      }
    } catch (parseErr) {
      console.warn('⚠️ Assessment JSON parse notice:', parseErr.message);
    }
  }

  // Deterministic fallback if perQuestionScores is empty
  if (!recommendation.perQuestionScores || recommendation.perQuestionScores.length === 0) {
    const fallbackBase = recommendation.verdict === 'pass' ? 20 : recommendation.verdict === 'fail' ? 8 : 15;
    recommendation.perQuestionScores = [1, 2, 3, 4, 5].map((qNum) => ({
      question: qNum,
      specificity: fallbackBase,
      safety: fallbackBase,
      diagnosisLogic: fallbackBase,
      clarity: fallbackBase,
      total: fallbackBase * 4,
    }));
    const sum = recommendation.perQuestionScores.reduce((acc, q) => acc + q.total, 0);
    recommendation.confidenceScore = Math.round(sum / 5);
    if (recommendation.confidenceScore >= 70) recommendation.verdict = 'pass';
    else if (recommendation.confidenceScore >= 40) recommendation.verdict = 'borderline';
    else recommendation.verdict = 'fail';
  }

  if (session.autoFlaggedConcerns && session.autoFlaggedConcerns.length > 0) {
    const merged = new Set([
      ...(recommendation.flaggedConcerns || []),
      ...session.autoFlaggedConcerns,
    ]);
    recommendation.flaggedConcerns = Array.from(merged);
  }

  session.aiRecommendation = recommendation;
  session.status = 'completed';
  session.completedAt = new Date();
  await session.save();

  // Keep worker profile verificationStatus as 'Pending' — Admin makes final decision
  await User.findByIdAndUpdate(session.workerId, {
    verificationStatus: 'Pending',
  }).catch(() => null);

  // Trigger async bio generation
  generateWorkerBio(session.workerId).catch(err => console.error('Bio Gen Error:', err));

  return session;
}

module.exports = {
  startInterview,
  askNextQuestion,
  submitAnswer,
  generateFinalAssessment,
  normalizeCategory,
  TRADE_DOMAIN_DETAILS,
  TRADE_QUESTIONS_BILINGUAL,
  CATEGORY_FALLBACK_QUESTIONS,
};
