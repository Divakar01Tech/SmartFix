import { apiService } from './api';

/**
 * MCP (Model Context Protocol) Tool Definitions & Executable Handlers
 * Allows SmartFix AI Assistant to directly query live database resources,
 * calculate fares, diagnose DIY issues, and generate interactive booking tools.
 */

export const MCP_TOOL_DEFINITIONS = [
  {
    name: 'search_handymen',
    description: 'Find verified handymen by trade (Plumbing, Electrical, AC Repair, etc.), maximum hourly rate, or city.',
    parameters: {
      type: 'object',
      properties: {
        trade: { type: 'string', description: 'Trade category e.g. Plumbing, Electrical, AC Repair' },
        maxRate: { type: 'number', description: 'Maximum hourly rate in INR (₹)' },
        city: { type: 'string', description: 'City or town name e.g. Tamil Nadu, Karaikudi' },
      },
    },
  },
  {
    name: 'estimate_service_fare',
    description: 'Calculate live distance ETA and price estimates for BikePro, AutoHandyman, MasterTech tiers.',
    parameters: {
      type: 'object',
      properties: {
        trade: { type: 'string', description: 'Service category required' },
        distanceKm: { type: 'number', description: 'Distance in kilometers' },
      },
    },
  },
  {
    name: 'diy_repair_troubleshoot',
    description: 'Provide immediate DIY emergency steps for leaking taps, tripped circuit breakers, AC water leaks.',
    parameters: {
      type: 'object',
      properties: {
        issueType: { type: 'string', description: 'Type of repair issue' },
      },
    },
  },
];

/**
 * Execute MCP Tool dynamically based on user prompt intent
 */
export async function executeMcpTool(intent, params = {}) {
  switch (intent) {
    case 'search_handymen': {
      const allWorkers = await apiService.getWorkers({});
      let filtered = allWorkers;
      if (params.trade) {
        filtered = filtered.filter(w => w.trade?.toLowerCase().includes(params.trade.toLowerCase()));
      }
      if (params.maxRate) {
        filtered = filtered.filter(w => (w.ratePerHour || 350) <= params.maxRate);
      }
      if (params.city) {
        filtered = filtered.filter(w => w.location?.toLowerCase().includes(params.city.toLowerCase()));
      }
      return {
        tool: 'search_handymen',
        success: true,
        count: filtered.length,
        data: filtered.slice(0, 3), // Top 3 workers
      };
    }

    case 'estimate_service_fare': {
      const fareData = await apiService.estimateFare({ trade: params.trade || 'General Repair' });
      return {
        tool: 'estimate_service_fare',
        success: true,
        data: fareData,
      };
    }

    case 'diy_repair_troubleshoot': {
      const issue = (params.issueType || '').toLowerCase();
      let steps = [
        '1. Turn off main water valve or power switch immediately.',
        '2. Clear the work area and keep children away.',
        '3. Book a certified SmartFix handyman for a safe, permanent resolution.',
      ];

      if (issue.includes('leak') || issue.includes('water') || issue.includes('pipe') || issue.includes('tap')) {
        steps = [
          '🚰 1. Turn off the main water isolation valve under the sink or near the water meter.',
          '🧵 2. Wrap Teflon tape or a cloth tightly around the leak thread to reduce drip.',
          '👨‍🔧 3. Book a verified SmartFix plumber to replace the washer or brass pipe.',
        ];
      } else if (issue.includes('power') || issue.includes('electric') || issue.includes('spark') || issue.includes('mcb')) {
        steps = [
          '⚡ 1. Turn OFF the main MCB trip switch at your electrical distribution box.',
          '🔌 2. Unplug high-voltage appliances (AC, Heater, Fridge) connected to that circuit.',
          '⚠️ 3. DO NOT touch exposed wires. Book a SmartFix certified electrician immediately.',
        ];
      } else if (issue.includes('ac') || issue.includes('cooling') || issue.includes('air conditioner')) {
        steps = [
          '❄️ 1. Clean or replace the front mesh air filters.',
          '💧 2. Check if the outdoor drain hose is clogged or bent.',
          '👨‍🔧 3. Book an AC Master Specialist for gas refilling & chemical jet washing.',
        ];
      }

      return {
        tool: 'diy_repair_troubleshoot',
        success: true,
        issue: params.issueType,
        steps,
      };
    }

    default:
      return { success: false, message: 'Unknown MCP Tool' };
  }
}

/**
 * Intelligent Intent Detection for MCP Tool Execution
 */
export function detectMcpIntent(userPrompt) {
  const p = userPrompt.toLowerCase();

  // Search Handymen Intent
  if (p.includes('plumber') || p.includes('electrician') || p.includes('carpenter') || p.includes('painter') || p.includes('ac repair') || p.includes('find worker') || p.includes('cleaner') || p.includes('under') || p.includes('₹') || p.includes('rate')) {
    let trade = null;
    if (p.includes('plumb')) trade = 'Plumbing';
    else if (p.includes('electr')) trade = 'Electrical';
    else if (p.includes('ac')) trade = 'AC Repair';
    else if (p.includes('carpent')) trade = 'Carpentry';
    else if (p.includes('paint')) trade = 'Painting';
    else if (p.includes('clean')) trade = 'Cleaning';

    let maxRate = null;
    const rateMatch = p.match(/(?:under|<|below|within|\u20B9|\brs\.?)\s*(\d{3,4})/i);
    if (rateMatch) maxRate = parseInt(rateMatch[1], 10);

    let city = null;
    if (p.includes('Tamil Nadu')) city = 'Tamil Nadu';
    else if (p.includes('karaikudi')) city = 'Karaikudi';
    else if (p.includes('devakottai')) city = 'Devakottai';
    else if (p.includes('manamadurai')) city = 'Manamadurai';

    return {
      intent: 'search_handymen',
      params: { trade, maxRate, city },
    };
  }

  // Fare Estimation Intent
  if (p.includes('cost') || p.includes('price') || p.includes('fare') || p.includes('how much') || p.includes('estimate') || p.includes('charge')) {
    return {
      intent: 'estimate_service_fare',
      params: { trade: 'General Service' },
    };
  }

  // DIY Troubleshooting Intent
  if (p.includes('leak') || p.includes('tripped') || p.includes('spark') || p.includes('how to fix') || p.includes('broken') || p.includes('water') || p.includes('noisy') || p.includes('emergency')) {
    return {
      intent: 'diy_repair_troubleshoot',
      params: { issueType: userPrompt },
    };
  }

  return null;
}
