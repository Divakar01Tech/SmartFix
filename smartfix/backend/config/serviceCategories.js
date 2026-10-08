/**
 * Shared Service Categories and defined Sub-Services for SmartFix platform.
 * Exactly 6 categories, each with 8 defined sub-services.
 */

const SERVICE_CATEGORIES = [
  {
    id: 'plumbing',
    name: 'Plumbing',
    trade: 'Plumbing',
    icon: '🔧',
    description: 'Expert pipe repairs, tap installations, drain blockage, and emergency plumbing services.',
    subServices: [
      'Pipe Leak Repair',
      'Tap/Faucet Installation & Repair',
      'Toilet Repair',
      'Sink & Basin Installation',
      'Drain Blockage Removal',
      'Water Tank Connection',
      'Bathroom Fittings',
      'Emergency Plumbing',
    ],
  },
  {
    id: 'electrical',
    name: 'Electrical Repairs',
    trade: 'Electrical Repairs',
    icon: '💡',
    description: 'Certified electricians for wiring, switches, fan & light installation, MCB & inverters.',
    subServices: [
      'Switch & Socket Repair',
      'Fan Installation & Repair',
      'Light Installation',
      'Wiring & Rewiring',
      'MCB/Fuse Repair',
      'Inverter Installation',
      'Door Bell Installation',
      'Emergency Electrical Service',
    ],
  },
  {
    id: 'ac-repair',
    name: 'AC Service and Repair',
    trade: 'AC Service and Repair',
    aliases: ['AC Service & Repair', 'AC Service and Repair'],
    icon: '❄️',
    description: 'Professional AC general service, gas refilling, installation, leakage & cooling repair.',
    subServices: [
      'AC General Service',
      'AC Gas Refilling',
      'AC Installation',
      'AC Uninstallation',
      'AC Water Leakage Repair',
      'Cooling Issue Repair',
      'Compressor Repair',
      'Annual Maintenance',
    ],
  },
  {
    id: 'refrigerator',
    name: 'Refrigerator Repair',
    trade: 'Refrigerator Repair',
    icon: '🧊',
    description: 'Quick fridge cooling repair, gas charging, compressor, thermostat & seal replacement.',
    subServices: [
      'Cooling Issue Repair',
      'Gas Charging',
      'Compressor Repair',
      'Thermostat Replacement',
      'Door Seal Replacement',
      'Water Leakage Repair',
      'Noise Issue Repair',
      'General Service',
    ],
  },
  {
    id: 'washing-machine',
    name: 'Washing Machine Repair',
    trade: 'Washing Machine Repair',
    icon: '🧺',
    description: 'Front-load & top-load washing machine general service, drum, motor & PCB repair.',
    subServices: [
      'General Service',
      'Drum Repair',
      'Water Inlet/Outlet Repair',
      'Motor Repair',
      'PCB Repair',
      'Spin Issue Repair',
      'Installation',
      'Uninstallation',
    ],
  },
  {
    id: 'water-purifier',
    name: 'Water Purifier Service',
    trade: 'Water Purifier Service',
    icon: '💧',
    description: 'RO/UV filter replacement, membrane change, leakage repair & quality checks.',
    subServices: [
      'Filter Replacement',
      'RO Membrane Replacement',
      'UV Lamp Replacement',
      'Water Leakage Repair',
      'Water Quality Check',
      'General Cleaning',
      'Installation',
      'AMC (Annual Maintenance)',
    ],
  },
];

const VALID_TRADES = [
  'Plumbing',
  'Electrical Repairs',
  'AC Service and Repair',
  'AC Service & Repair',
  'Refrigerator Repair',
  'Washing Machine Repair',
  'Water Purifier Service',
];

const TAMILNADU_TALUKS = [
  'Tamil Nadu',
  'Karaikudi',
  'Devakottai',
  'Manamadurai',
  'Ilayangudi',
  'Singampunari',
  'Tirupattur',
  'Kalayarkoil',
];

function getCategoryByTrade(trade) {
  if (!trade) return null;
  const clean = trade.trim().toLowerCase();
  return SERVICE_CATEGORIES.find(
    (c) => c.trade.toLowerCase() === clean || (c.aliases && c.aliases.some((a) => a.toLowerCase() === clean))
  );
}

function validateSubServicesForTrade(trade, subServices) {
  if (!subServices || !Array.isArray(subServices) || subServices.length === 0) {
    return { valid: true };
  }
  const category = getCategoryByTrade(trade);
  if (!category) {
    return { valid: false, error: `Invalid trade '${trade}'. Must be one of the 6 allowed service categories.` };
  }
  const allowed = category.subServices.map((s) => s.toLowerCase());
  for (const sub of subServices) {
    if (!allowed.includes(sub.trim().toLowerCase())) {
      return {
        valid: false,
        error: `'${sub}' is not a valid sub-service for ${trade}. Allowed: ${category.subServices.join(', ')}`,
      };
    }
  }
  return { valid: true };
}

module.exports = {
  SERVICE_CATEGORIES,
  VALID_TRADES,
  TAMILNADU_TALUKS,
  getCategoryByTrade,
  validateSubServicesForTrade,
};

const SERVICE_KEYWORDS = {
  // Plumbing
  'Pipe Leak Repair': { en: ['pipe', 'leak', 'burst', 'water leaking', 'broken pipe'], ta: ['kuzhai', 'kuzhai oluguthu', 'kuzhai udaichuduchu', 'thanni varuthu'] },
  'Tap/Faucet Installation & Repair': { en: ['tap', 'faucet', 'tap broken', 'new tap'], ta: ['tap', 'pipe', 'pudhu tap', 'tap repair'] },
  'Toilet Repair': { en: ['toilet', 'flush', 'commode', 'closet', 'western'], ta: ['toilet', 'flush', 'kakkus'] },
  'Sink & Basin Installation': { en: ['sink', 'basin', 'wash basin'], ta: ['wash basin', 'kai kaluvura', 'sink'] },
  'Drain Blockage Removal': { en: ['drain', 'block', 'clog', 'blockage', 'choke'], ta: ['adaippu', 'thanni pogala', 'block', 'drainage'] },
  'Water Tank Connection': { en: ['tank', 'water tank', 'sintex'], ta: ['tank', 'thanni tank', 'sintex'] },
  'Bathroom Fittings': { en: ['bathroom', 'shower', 'fittings'], ta: ['bathroom', 'shower'] },
  'Emergency Plumbing': { en: ['emergency', 'urgent plumbing'], ta: ['urgent', 'udane', 'plumber'] },

  // Electrical
  'Switch & Socket Repair': { en: ['switch', 'socket', 'plug', 'board'], ta: ['switch', 'plug', 'board', 'current'] },
  'Fan Installation & Repair': { en: ['fan', 'ceiling fan', 'table fan'], ta: ['fan', 'fan oda la', 'fan sound varudhu'] },
  'Light Installation': { en: ['light', 'tube', 'bulb', 'led'], ta: ['light', 'bulb', 'tube light'] },
  'Wiring & Rewiring': { en: ['wire', 'wiring', 'short circuit', 'fire'], ta: ['wire', 'current', 'short circuit'] },
  'MCB/Fuse Repair': { en: ['mcb', 'fuse', 'trip', 'main board'], ta: ['fuse', 'mcb', 'trip aiduchu', 'main switch'] },
  'Inverter Installation': { en: ['inverter', 'battery', 'ups'], ta: ['inverter', 'battery', 'ups'] },
  'Door Bell Installation': { en: ['bell', 'door bell', 'calling bell'], ta: ['calling bell', 'door bell'] },
  'Emergency Electrical Service': { en: ['emergency', 'urgent electrical', 'power cut'], ta: ['current illa', 'power cut', 'urgent electrical'] },

  // AC
  'AC General Service': { en: ['service', 'clean', 'general service', 'ac service'], ta: ['ac service', 'clean', 'ac dust'] },
  'AC Gas Refilling': { en: ['gas', 'refill', 'no cooling'], ta: ['gas illa', 'cooling illa', 'gas charging'] },
  'AC Installation': { en: ['install', 'new ac', 'fix ac'], ta: ['ac maatanum', 'pudhu ac', 'install'] },
  'AC Uninstallation': { en: ['uninstall', 'remove', 'dismantle'], ta: ['ac kalatanum', 'remove'] },
  'AC Water Leakage Repair': { en: ['leak', 'water leak', 'water drops'], ta: ['thanni oluguthu', 'water leak'] },
  'Cooling Issue Repair': { en: ['cooling', 'not cooling', 'hot air'], ta: ['cooling illa', 'sudaathu'] },
  'Compressor Repair': { en: ['compressor', 'outdoor unit'], ta: ['compressor', 'outdoor', 'sound varudhu'] },
  'Annual Maintenance': { en: ['amc', 'annual', 'contract'], ta: ['amc', 'varusha service'] },

  // Refrigerator
  'Gas Charging': { en: ['gas', 'refill', 'gas leak'], ta: ['gas', 'gas charging'] },
  'Thermostat Replacement': { en: ['thermostat', 'sensor', 'ice building'], ta: ['thermostat', 'sensor', 'ice form aaguthu'] },
  'Door Seal Replacement': { en: ['seal', 'gasket', 'door not closing'], ta: ['door moodala', 'seal', 'rubber'] },
  'Noise Issue Repair': { en: ['noise', 'sound', 'loud'], ta: ['satham varudhu', 'sound varudhu'] },

  // Washing Machine
  'Drum Repair': { en: ['drum', 'not spinning', 'noise'], ta: ['drum', 'suthala', 'satham'] },
  'Water Inlet/Outlet Repair': { en: ['inlet', 'outlet', 'water not draining', 'water not coming'], ta: ['thanni varala', 'thanni pogala'] },
  'Motor Repair': { en: ['motor', 'not working'], ta: ['motor', 'odala'] },
  'PCB Repair': { en: ['pcb', 'board', 'display not working'], ta: ['board', 'display varala', 'pcb'] },
  'Spin Issue Repair': { en: ['spin', 'dryer', 'clothes wet'], ta: ['dryer', 'spin aagala', 'thuni kaayala'] },

  // Water Purifier
  'Filter Replacement': { en: ['filter', 'candle', 'change filter'], ta: ['filter', 'mathanum', 'candle'] },
  'RO Membrane Replacement': { en: ['membrane', 'ro', 'taste bad'], ta: ['membrane', 'ro', 'taste illa'] },
  'UV Lamp Replacement': { en: ['uv', 'lamp', 'light'], ta: ['uv light', 'lamp'] },
  'Water Quality Check': { en: ['tds', 'check quality', 'taste'], ta: ['tds check', 'taste check'] },
  'General Cleaning': { en: ['clean', 'service', 'purifier service'], ta: ['clean', 'service'] },
};

module.exports.SERVICE_KEYWORDS = SERVICE_KEYWORDS;
