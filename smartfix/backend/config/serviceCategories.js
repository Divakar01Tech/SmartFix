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

const SIVAGANGAI_TALUKS = [
  'Sivagangai',
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
  SIVAGANGAI_TALUKS,
  getCategoryByTrade,
  validateSubServicesForTrade,
};
