/**
 * advisor-engine.js — SokoShamba Beginner Farm Advisor
 * ----------------------------------------------------
 * A rule-based recommendation engine for first-time Kenyan farmers.
 * No API keys, no network calls — pure logic based on real agronomic data.
 *
 * Input:  { county, landSize, budget, experience, goal, water }
 * Output: ranked crop recommendations with full costings, calendar and risks.
 */

/* ============================================================ AGRO ZONES */
/**
 * Kenyan counties grouped by dominant agro-ecological conditions.
 * altitude: 'high' (>1800m) | 'medium' (1200-1800m) | 'low' (<1200m)
 * rain: 'reliable' | 'moderate' | 'low'
 */
export const COUNTY_ZONES = {
  // High altitude, reliable rain — cereals, dairy, horticulture, potatoes
  'Uasin Gishu':      { altitude: 'high',   rain: 'reliable', zone: 'North Rift Highlands' },
  'Trans Nzoia':      { altitude: 'high',   rain: 'reliable', zone: 'North Rift Highlands' },
  'Nandi':            { altitude: 'high',   rain: 'reliable', zone: 'North Rift Highlands' },
  'Elgeyo-Marakwet':  { altitude: 'high',   rain: 'reliable', zone: 'North Rift Highlands' },
  'Kericho':          { altitude: 'high',   rain: 'reliable', zone: 'Tea Highlands' },
  'Bomet':            { altitude: 'high',   rain: 'reliable', zone: 'Tea Highlands' },
  'Nyandarua':        { altitude: 'high',   rain: 'reliable', zone: 'Central Highlands' },
  'Nyeri':            { altitude: 'high',   rain: 'reliable', zone: 'Central Highlands' },
  'Kiambu':           { altitude: 'high',   rain: 'reliable', zone: 'Central Highlands' },
  'Murang’a':         { altitude: 'medium', rain: 'reliable', zone: 'Central Highlands' },
  'Kirinyaga':        { altitude: 'medium', rain: 'reliable', zone: 'Mt Kenya East' },
  'Meru':             { altitude: 'medium', rain: 'reliable', zone: 'Mt Kenya East' },
  'Embu':             { altitude: 'medium', rain: 'reliable', zone: 'Mt Kenya East' },
  'Tharaka-Nithi':    { altitude: 'medium', rain: 'moderate', zone: 'Mt Kenya East' },
  'Nakuru':           { altitude: 'high',   rain: 'moderate', zone: 'Central Rift' },
  'Laikipia':         { altitude: 'high',   rain: 'moderate', zone: 'Central Rift' },
  'Baringo':          { altitude: 'medium', rain: 'moderate', zone: 'Central Rift' },
  'Narok':            { altitude: 'high',   rain: 'moderate', zone: 'South Rift' },
  'Nyamira':          { altitude: 'high',   rain: 'reliable', zone: 'Kisii Highlands' },
  'Kisii':            { altitude: 'high',   rain: 'reliable', zone: 'Kisii Highlands' },
  'Vihiga':           { altitude: 'medium', rain: 'reliable', zone: 'Western' },
  'Kakamega':         { altitude: 'medium', rain: 'reliable', zone: 'Western' },
  'Bungoma':          { altitude: 'medium', rain: 'reliable', zone: 'Western' },
  'Busia':            { altitude: 'low',    rain: 'moderate', zone: 'Western Lowlands' },
  'Siaya':            { altitude: 'low',    rain: 'moderate', zone: 'Lake Basin' },
  'Kisumu':           { altitude: 'low',    rain: 'moderate', zone: 'Lake Basin' },
  'Homa Bay':         { altitude: 'low',    rain: 'moderate', zone: 'Lake Basin' },
  'Migori':           { altitude: 'medium', rain: 'moderate', zone: 'Lake Basin' },
  'Machakos':         { altitude: 'medium', rain: 'low',      zone: 'Eastern Semi-Arid' },
  'Makueni':          { altitude: 'medium', rain: 'low',      zone: 'Eastern Semi-Arid' },
  'Kitui':            { altitude: 'low',    rain: 'low',      zone: 'Eastern Semi-Arid' },
  'Kajiado':          { altitude: 'medium', rain: 'low',      zone: 'Southern Rangelands' },
  'Taita-Taveta':     { altitude: 'medium', rain: 'low',      zone: 'Coastal Hinterland' },
  'Kilifi':           { altitude: 'low',    rain: 'moderate', zone: 'Coastal' },
  'Kwale':            { altitude: 'low',    rain: 'moderate', zone: 'Coastal' },
  'Mombasa':          { altitude: 'low',    rain: 'moderate', zone: 'Coastal' },
  'Lamu':             { altitude: 'low',    rain: 'moderate', zone: 'Coastal' },
  'Tana River':       { altitude: 'low',    rain: 'low',      zone: 'Coastal Lowland' },
  'Nairobi':          { altitude: 'high',   rain: 'moderate', zone: 'Urban / Peri-urban' },
  'Garissa':          { altitude: 'low',    rain: 'low',      zone: 'ASAL' },
  'Wajir':            { altitude: 'low',    rain: 'low',      zone: 'ASAL' },
  'Mandera':          { altitude: 'low',    rain: 'low',      zone: 'ASAL' },
  'Marsabit':         { altitude: 'medium', rain: 'low',      zone: 'ASAL' },
  'Isiolo':           { altitude: 'low',    rain: 'low',      zone: 'ASAL' },
  'Samburu':          { altitude: 'medium', rain: 'low',      zone: 'ASAL' },
  'Turkana':          { altitude: 'low',    rain: 'low',      zone: 'ASAL' },
  'West Pokot':       { altitude: 'medium', rain: 'moderate', zone: 'ASAL' },
  'Nyamira ':         { altitude: 'high',   rain: 'reliable', zone: 'Kisii Highlands' }
};

export function zoneFor(county) {
  return COUNTY_ZONES[county] || { altitude: 'medium', rain: 'moderate', zone: 'Mixed farming' };
}

/* ============================================================== CROPS */
/**
 * Enterprise database. Costs are per acre in KES, based on typical
 * 2025/26 Kenyan smallholder budgets. Deliberately conservative.
 */
export const ENTERPRISES = [
  {
    id: 'sukuma',
    name: 'Sukuma Wiki (Kale)',
    emoji: '🥬',
    category: 'vegetables',
    difficulty: 1,
    cycleDays: 60,
    minLand: 0.125,
    idealLand: [0.125, 2],
    altitudes: ['high', 'medium', 'low'],
    rain: ['reliable', 'moderate'],
    needsIrrigation: false,
    costPerAcre: { seed: 3000, fertilizer: 12000, chemicals: 3500, labour: 18000, land: 5000, other: 3500 },
    yieldPerAcre: 12000, unit: 'bunch', priceRange: [25, 45],
    why: 'Fastest money for a beginner. Harvest starts in 6-8 weeks and keeps producing for months.',
    risks: ['Aphids and diamondback moth', 'Prices crash when everyone plants at once', 'Needs water in dry spells'],
    tips: [
      'Plant in batches 2 weeks apart so you harvest every week instead of all at once.',
      'Sell directly to hotels, schools and grocers — not brokers at the gate.',
      'Spacing 60cm × 45cm. Top-dress with CAN after each harvest.'
    ],
    inputs: ['seeds', 'fertilizer']
  },
  {
    id: 'tomato',
    name: 'Tomatoes (Anna F1)',
    emoji: '🍅',
    category: 'vegetables',
    difficulty: 4,
    cycleDays: 110,
    minLand: 0.25,
    idealLand: [0.25, 3],
    altitudes: ['high', 'medium', 'low'],
    rain: ['reliable', 'moderate'],
    needsIrrigation: true,
    costPerAcre: { seed: 9000, fertilizer: 32000, chemicals: 38000, labour: 40000, land: 8000, other: 18000 },
    yieldPerAcre: 220, unit: 'crate (64kg)', priceRange: [2200, 4500],
    why: 'Highest profit per acre in horticulture — but only if you can spray on schedule and irrigate.',
    risks: ['Tuta absoluta can wipe out a crop', 'Blight in wet weather', 'Very volatile prices', 'High input cost'],
    tips: [
      'Not recommended for your first ever season unless you have a mentor nearby.',
      'Budget for 10-14 sprays. Skipping one can cost you the whole crop.',
      'Staking and pruning increases marketable yield by 30%+.'
    ],
    inputs: ['seeds', 'fertilizer', 'farm-equipment']
  },
  {
    id: 'maize',
    name: 'Maize (Hybrid)',
    emoji: '🌽',
    category: 'cereals',
    difficulty: 2,
    cycleDays: 150,
    minLand: 1,
    idealLand: [1, 50],
    altitudes: ['high', 'medium'],
    rain: ['reliable', 'moderate'],
    needsIrrigation: false,
    costPerAcre: { seed: 4650, fertilizer: 15200, chemicals: 3200, labour: 9500, land: 6000, other: 3000 },
    yieldPerAcre: 25, unit: '90kg bag', priceRange: [3800, 5200],
    why: 'The backbone crop. Reliable, easy to sell, and you can eat what you do not sell.',
    risks: ['Fall armyworm', 'Rain failure at tasselling', 'Post-harvest losses if not dried properly', 'Thin margins'],
    tips: [
      'Match variety to altitude: H629/H6213 above 1800m, H513/DK777 medium zones.',
      'The first 6 weeks must be weed-free or you lose up to 40% yield.',
      'Dry to 13.5% moisture before storage or aflatoxin will destroy your value.'
    ],
    inputs: ['seeds', 'fertilizer']
  },
  {
    id: 'beans',
    name: 'Beans (Rosecoco)',
    emoji: '🫘',
    category: 'cereals',
    difficulty: 1,
    cycleDays: 90,
    minLand: 0.25,
    idealLand: [0.25, 10],
    altitudes: ['high', 'medium'],
    rain: ['reliable', 'moderate'],
    needsIrrigation: false,
    costPerAcre: { seed: 6000, fertilizer: 8000, chemicals: 3000, labour: 11000, land: 5000, other: 2500 },
    yieldPerAcre: 7, unit: '90kg bag', priceRange: [8500, 12000],
    why: 'Low cost, fixes nitrogen for your next crop, and always has a market.',
    risks: ['Bean fly in young plants', 'Rots if rain hits at drying', 'Yields drop fast in poor soil'],
    tips: [
      'Excellent first crop. Also a great rotation partner before maize.',
      'Intercrop with maize to use the same land twice.',
      'Harvest when 90% of pods are dry, then dry on a raised sheet, not bare soil.'
    ],
    inputs: ['seeds', 'fertilizer']
  },
  {
    id: 'potato',
    name: 'Irish Potatoes (Shangi)',
    emoji: '🥔',
    category: 'vegetables',
    difficulty: 3,
    cycleDays: 100,
    minLand: 0.5,
    idealLand: [0.5, 10],
    altitudes: ['high'],
    rain: ['reliable'],
    needsIrrigation: false,
    costPerAcre: { seed: 35000, fertilizer: 22000, chemicals: 12000, labour: 22000, land: 7000, other: 6000 },
    yieldPerAcre: 90, unit: '50kg bag', priceRange: [2200, 4000],
    why: 'Strong returns in high-altitude counties with a guaranteed urban market.',
    risks: ['Late blight needs regular spraying', 'Certified seed is expensive', 'Price swings with season'],
    tips: [
      'Use certified seed — recycled seed carries disease and halves your yield.',
      'Earth up twice to stop greening.',
      'Store in a dark, ventilated shed to hold for better prices.'
    ],
    inputs: ['seeds', 'fertilizer']
  },
  {
    id: 'greengram',
    name: 'Green Grams (Ndengu)',
    emoji: '🫛',
    category: 'cereals',
    difficulty: 1,
    cycleDays: 75,
    minLand: 1,
    idealLand: [1, 20],
    altitudes: ['medium', 'low'],
    rain: ['low', 'moderate'],
    needsIrrigation: false,
    costPerAcre: { seed: 3500, fertilizer: 4000, chemicals: 4500, labour: 9000, land: 3500, other: 2000 },
    yieldPerAcre: 5, unit: '90kg bag', priceRange: [9000, 14000],
    why: 'Perfect for dry counties. Short season, drought tolerant, and high value per kilo.',
    risks: ['Pod borers', 'Rain during drying spoils the grain', 'Needs a clean threshing floor'],
    tips: [
      'Ideal for Kitui, Makueni, Machakos and Tharaka-Nithi.',
      'Harvest in 2-3 pickings as pods mature rather than all at once.',
      'Machine-cleaned ndengu fetches a much better price than farm-run.'
    ],
    inputs: ['seeds']
  },
  {
    id: 'kienyeji',
    name: 'Improved Kienyeji Chicken',
    emoji: '🐓',
    category: 'poultry',
    difficulty: 2,
    cycleDays: 150,
    minLand: 0.05,
    idealLand: [0.05, 1],
    altitudes: ['high', 'medium', 'low'],
    rain: ['reliable', 'moderate', 'low'],
    needsIrrigation: false,
    unitsPerAcre: 300,
    costPerAcre: { seed: 33000, fertilizer: 0, chemicals: 6000, labour: 12000, land: 3000, other: 66000 },
    yieldPerAcre: 270, unit: 'bird', priceRange: [650, 1100],
    why: 'Best choice when you have very little land. Eggs and meat both sell, and start-up is small.',
    risks: ['Newcastle disease can kill a whole flock', 'Feed cost is 70% of your budget', 'Predators and theft'],
    tips: [
      'Vaccinate on schedule — Marek\'s, Gumboro, Newcastle. Non-negotiable.',
      'Start with 100 birds, not 500. Learn the routine first.',
      'Sell live birds direct to consumers around Christmas and Easter for peak prices.'
    ],
    inputs: ['poultry', 'animal-feed']
  },
  {
    id: 'dairy',
    name: 'Dairy Cow (1-2 cows)',
    emoji: '🐄',
    category: 'dairy',
    difficulty: 3,
    cycleDays: 365,
    minLand: 0.5,
    idealLand: [0.5, 10],
    altitudes: ['high', 'medium'],
    rain: ['reliable', 'moderate'],
    needsIrrigation: false,
    unitsPerAcre: 1,
    costPerAcre: { seed: 145000, fertilizer: 8000, chemicals: 12000, labour: 36000, land: 6000, other: 90000 },
    yieldPerAcre: 5400, unit: 'litre/year', priceRange: [45, 60],
    why: 'Daily income instead of waiting for one harvest. Manure also improves your soil for free.',
    risks: ['High upfront cost', 'Mastitis and East Coast Fever', 'Needs fodder all year, not just in the rains'],
    tips: [
      'Plant napier and desmodium BEFORE you buy the cow. Feed first, animal second.',
      'A cow drinks 60-100 litres a day. No reliable water = no milk.',
      'Join a dairy cooperative for better prices and AI services.'
    ],
    inputs: ['livestock', 'animal-feed']
  },
  {
    id: 'onion',
    name: 'Onions (Red Creole)',
    emoji: '🧅',
    category: 'vegetables',
    difficulty: 3,
    cycleDays: 150,
    minLand: 0.25,
    idealLand: [0.25, 5],
    altitudes: ['medium', 'low'],
    rain: ['moderate', 'low'],
    needsIrrigation: true,
    costPerAcre: { seed: 12000, fertilizer: 26000, chemicals: 16000, labour: 34000, land: 6000, other: 12000 },
    yieldPerAcre: 130, unit: '50kg bag', priceRange: [2500, 5000],
    why: 'Stores well, so you can hold stock and sell when prices rise instead of dumping at harvest.',
    risks: ['Thrips and purple blotch', 'Needs steady irrigation', 'Long season ties up your land'],
    tips: [
      'Cure in shade for 2-3 weeks after lifting — this is what makes them store.',
      'Stop irrigating 2 weeks before harvest.',
      'Loitokitok, Karatina and Oloitoktok are the reference markets to watch.'
    ],
    inputs: ['seeds', 'fertilizer', 'farm-equipment']
  },
  {
    id: 'banana',
    name: 'Bananas (Tissue Culture)',
    emoji: '🍌',
    category: 'fruits',
    difficulty: 2,
    cycleDays: 400,
    minLand: 0.25,
    idealLand: [0.25, 5],
    altitudes: ['medium', 'low'],
    rain: ['reliable', 'moderate'],
    needsIrrigation: false,
    costPerAcre: { seed: 45000, fertilizer: 18000, chemicals: 6000, labour: 26000, land: 6000, other: 9000 },
    yieldPerAcre: 450, unit: 'bunch', priceRange: [500, 900],
    why: 'Plant once, harvest for years. After the first bunch it keeps producing with little extra cost.',
    risks: ['First harvest takes 12-15 months', 'Panama disease', 'Wind can topple heavy plants'],
    tips: [
      'Only for farmers who can wait a year for the first income.',
      'Use tissue culture suckers — clean planting material prevents disease.',
      'Prop heavy bunches and keep 3 plants per stool (mother, daughter, granddaughter).'
    ],
    inputs: ['seeds', 'fertilizer']
  },
  {
    id: 'sorghum',
    name: 'Sorghum (Gadam)',
    emoji: '🌾',
    category: 'cereals',
    difficulty: 1,
    cycleDays: 110,
    minLand: 1,
    idealLand: [1, 30],
    altitudes: ['medium', 'low'],
    rain: ['low', 'moderate'],
    needsIrrigation: false,
    costPerAcre: { seed: 2500, fertilizer: 6000, chemicals: 3000, labour: 8500, land: 3500, other: 2500 },
    yieldPerAcre: 12, unit: '90kg bag', priceRange: [3500, 5000],
    why: 'Grows where maize fails. Breweries and millers buy on contract, so the market is secure.',
    risks: ['Birds can eat a large share', 'Striga weed in poor soils', 'Needs a buyer arranged early'],
    tips: [
      'Get a contract with a buyer BEFORE planting — that is the whole advantage.',
      'Bird scaring during grain fill is essential. Budget labour for it.',
      'Excellent for Kitui, Homa Bay, Siaya and Makueni.'
    ],
    inputs: ['seeds', 'fertilizer']
  },
  {
    id: 'avocado',
    name: 'Hass Avocado',
    emoji: '🥑',
    category: 'fruits',
    difficulty: 2,
    cycleDays: 1095,
    minLand: 0.5,
    idealLand: [0.5, 20],
    altitudes: ['high', 'medium'],
    rain: ['reliable'],
    needsIrrigation: false,
    costPerAcre: { seed: 32000, fertilizer: 14000, chemicals: 5000, labour: 18000, land: 7000, other: 8000 },
    yieldPerAcre: 6000, unit: 'fruit', priceRange: [18, 35],
    why: 'Export demand is strong and a mature orchard earns for 30+ years.',
    risks: ['3 years to first real harvest', 'Export grading is strict', 'Needs deep well-drained soil'],
    tips: [
      'Only plant if you have other income for the first 3 years.',
      'Intercrop with beans or vegetables while the trees are young.',
      'Spacing 5m × 5m gives about 160 trees per acre.'
    ],
    inputs: ['seeds', 'fertilizer']
  }
];

/* ========================================================= SCORING */
/**
 * Score every enterprise against the farmer's situation.
 * Returns the top N with reasons, costings and a calendar.
 */
export function recommend({ county, landSize, budget, experience, goal, water }) {
  const zone = zoneFor(county);
  const acres = Number(landSize) || 0.25;
  const money = Number(budget) || 0;

  const scored = ENTERPRISES.map((e) => {
    let score = 50;
    const reasons = [];
    const warnings = [];

    /* --- Climate fit ------------------------------------------------- */
    if (e.altitudes.includes(zone.altitude)) {
      score += 20;
      reasons.push(`Suited to ${county}'s ${zone.altitude} altitude`);
    } else {
      score -= 30;
      warnings.push(`${county} is ${zone.altitude} altitude — not ideal for this crop`);
    }

    if (e.rain.includes(zone.rain)) {
      score += 15;
      if (zone.rain === 'low') reasons.push('Handles low rainfall well');
    } else {
      score -= 20;
      warnings.push(`Rainfall in ${county} is ${zone.rain} — this crop wants more`);
    }

    /* --- Irrigation -------------------------------------------------- */
    if (e.needsIrrigation) {
      if (water === 'yes') { score += 10; reasons.push('You have water — irrigation crops open up'); }
      else if (water === 'sometimes') { score -= 10; warnings.push('Needs reliable irrigation; yours is seasonal'); }
      else { score -= 35; warnings.push('Requires irrigation and you have no water source'); }
    } else if (water === 'no') {
      score += 8;
      reasons.push('Rain-fed — no irrigation needed');
    }

    /* --- Land fit ---------------------------------------------------- */
    if (acres < e.minLand) {
      score -= 40;
      warnings.push(`Needs at least ${e.minLand} acre; you have ${acres}`);
    } else {
      const [lo, hi] = e.idealLand;
      if (acres >= lo && acres <= hi) { score += 15; reasons.push(`${acres} acre(s) is a good size for this`); }
      else if (acres > hi) { score += 5; }
    }

    /* --- Experience -------------------------------------------------- */
    const expLevel = { none: 1, some: 2, experienced: 3 }[experience] || 1;
    if (e.difficulty <= expLevel + 1) {
      score += 15;
      if (e.difficulty <= 2) reasons.push('Beginner friendly');
    } else {
      score -= 25;
      warnings.push(`Fairly demanding (difficulty ${e.difficulty}/5) for your experience level`);
    }

    /* --- Budget ------------------------------------------------------ */
    const totalCost = totalCostFor(e, acres);
    if (money > 0) {
      if (totalCost <= money) {
        score += 20;
        reasons.push(`Fits your KES ${money.toLocaleString('en-KE')} budget`);
      } else if (totalCost <= money * 1.3) {
        score -= 5;
        warnings.push(`Slightly over budget (needs ~KES ${totalCost.toLocaleString('en-KE')})`);
      } else {
        score -= 35;
        warnings.push(`Too expensive — needs about KES ${totalCost.toLocaleString('en-KE')}`);
      }
    }

    /* --- Goal -------------------------------------------------------- */
    if (goal === 'quick') {
      if (e.cycleDays <= 90) { score += 25; reasons.push(`Fast money — first harvest in about ${e.cycleDays} days`); }
      else if (e.cycleDays > 300) { score -= 30; warnings.push(`Takes ${Math.round(e.cycleDays / 30)} months before any income`); }
    }
    if (goal === 'steady') {
      if (['dairy', 'kienyeji', 'sukuma', 'banana'].includes(e.id)) {
        score += 25; reasons.push('Produces income regularly, not just once');
      }
    }
    if (goal === 'profit') {
      const profit = projectProfit(e, acres);
      if (profit.margin > 45) { score += 25; reasons.push(`Strong margin potential (~${Math.round(profit.margin)}%)`); }
      else if (profit.margin < 20) { score -= 10; }
    }
    if (goal === 'food') {
      if (['maize', 'beans', 'sukuma', 'kienyeji', 'potato'].includes(e.id)) {
        score += 25; reasons.push('You can eat what you do not sell');
      }
    }

    return { enterprise: e, score, reasons, warnings, costing: buildCosting(e, acres), profit: projectProfit(e, acres) };
  });

  return scored
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((r, i) => ({ ...r, rank: i + 1, confidence: Math.min(98, Math.max(45, Math.round(r.score))) }));
}

/* ========================================================= COSTING */
export function totalCostFor(e, acres) {
  const per = Object.values(e.costPerAcre).reduce((s, v) => s + v, 0);
  return Math.round(per * acres);
}

export function buildCosting(e, acres) {
  const lines = Object.entries(e.costPerAcre)
    .filter(([, v]) => v > 0)
    .map(([key, v]) => ({
      key,
      label: {
        seed: e.category === 'poultry' ? 'Day-old chicks' :
              e.category === 'dairy' ? 'Buying the cow' :
              e.category === 'fruits' ? 'Seedlings' : 'Seed / planting material',
        fertilizer: 'Fertilizer',
        chemicals: e.category === 'poultry' || e.category === 'dairy' ? 'Vet & vaccines' : 'Chemicals / sprays',
        labour: 'Labour',
        land: 'Land prep / rent share',
        other: e.category === 'poultry' ? 'Feed & housing' :
               e.category === 'dairy' ? 'Feed & shed' : 'Transport & other'
      }[key] || key,
      perAcre: v,
      total: Math.round(v * acres)
    }))
    .sort((a, b) => b.total - a.total);

  const total = lines.reduce((s, l) => s + l.total, 0);
  return { lines, total, perAcre: Math.round(total / acres) };
}

export function projectProfit(e, acres) {
  const cost = totalCostFor(e, acres);
  const [lowP, highP] = e.priceRange;
  const midP = (lowP + highP) / 2;
  const totalYield = Math.round(e.yieldPerAcre * acres);

  const revLow = Math.round(totalYield * lowP);
  const revMid = Math.round(totalYield * midP);
  const revHigh = Math.round(totalYield * highP);

  const profitLow = revLow - cost;
  const profitMid = revMid - cost;
  const profitHigh = revHigh - cost;

  return {
    cost,
    totalYield,
    unit: e.unit,
    revLow, revMid, revHigh,
    profitLow, profitMid, profitHigh,
    margin: revMid > 0 ? (profitMid / revMid) * 100 : 0,
    breakEvenPrice: totalYield > 0 ? Math.round(cost / totalYield) : 0,
    roi: cost > 0 ? (profitMid / cost) * 100 : 0
  };
}

/* ======================================================== CALENDAR */
/**
 * Build a simple month-by-month action plan starting from today.
 */
export function buildCalendar(e, startDate = new Date()) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const steps = [];
  const add = (dayOffset, title, detail) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + dayOffset);
    steps.push({
      date: d,
      label: `${d.getDate()} ${months[d.getMonth()]}`,
      week: Math.max(0, Math.round(dayOffset / 7)),
      title, detail
    });
  };

  if (e.category === 'poultry') {
    add(0,   'Build or clean the house', 'Disinfect, set up brooder, feeders and drinkers. Buy first bag of chick mash.');
    add(3,   'Chicks arrive', 'Brooder at 32-35°C. Give glucose water for the first 6 hours.');
    add(7,   'Week 1 check', 'Reduce brooder temp by 3°C. Watch for weak chicks.');
    add(14,  'Gumboro vaccination', 'Follow the hatchery schedule exactly.');
    add(21,  'Move off brooder', 'Room temperature is fine now. Increase floor space.');
    add(56,  'Switch to growers mash', 'Cheaper feed, birds are past the delicate stage.');
    add(120, 'Start selling cockerels', 'Males mature faster. Sell to free up space and feed.');
    add(150, 'Full harvest / layers start', 'Hens begin laying. Cockerels ready for market.');
  } else if (e.category === 'dairy') {
    add(-60, 'Plant fodder FIRST', 'Napier, desmodium, lucerne. Do this before buying any animal.');
    add(0,   'Build the shed', 'Concrete floor, roof, feed trough, clean water point.');
    add(30,  'Buy the cow', 'In-calf heifer with records. Bring a vet to inspect before paying.');
    add(35,  'Settle-in period', 'Keep feeding routine identical for 2 weeks to avoid stress.');
    add(90,  'Calving', 'Watch closely. Have the vet number ready.');
    add(95,  'Milking begins', 'Milk twice daily. Same time every day.');
    add(180, 'Peak production', 'Push feed quality now — this is when you earn.');
    add(365, 'Dry off & re-breed', 'Rest her 60 days before the next calving.');
  } else if (e.cycleDays > 300) {
    add(0,   'Prepare holes and soil', 'Dig planting holes early and mix in manure.');
    add(14,  'Plant seedlings', 'Plant at the start of the long rains.');
    add(60,  'First weeding & mulching', 'Mulch heavily to hold moisture.');
    add(180, 'Formative pruning', 'Shape the plants for good structure.');
    add(365, 'Year 1 complete', 'Keep weeding, mulching and feeding.');
    add(e.cycleDays, 'First real harvest', `Expect around ${e.yieldPerAcre} ${e.unit} per acre.`);
  } else {
    const c = e.cycleDays;
    add(-14, 'Prepare the land', 'Plough and harrow. Do a soil test if you can afford it.');
    add(-7,  'Buy inputs', 'Certified seed and planting fertilizer. Buy early — prices rise at planting.');
    add(0,   'Planting day', 'Plant at the correct spacing with planting fertilizer.');
    add(Math.round(c * 0.12), 'Germination check', 'Gap-fill any blanks within the first 2 weeks.');
    add(Math.round(c * 0.2),  'First weeding', 'Critical. Weeds now cost you real yield.');
    add(Math.round(c * 0.3),  'Top dressing', 'Apply CAN or urea. Scout for pests.');
    add(Math.round(c * 0.45), 'Second weeding & spray', 'Keep the crop clean and pest-free.');
    add(Math.round(c * 0.7),  'Pre-harvest scouting', 'Line up your buyer now, not on harvest day.');
    add(c, 'Harvest', `Target around ${e.yieldPerAcre} ${e.unit} per acre.`);
    add(c + 14, 'Dry, grade and sell', 'Proper drying and grading adds real money to your price.');
  }

  return steps;
}

/* ===================================================== ACTION PLAN */
export function buildActionPlan(rec, ctx) {
  const e = rec.enterprise;
  const plan = [];

  plan.push({
    icon: '💰',
    title: 'Sort your money first',
    body: `You need about KES ${rec.costing.total.toLocaleString('en-KE')} for ${ctx.landSize} acre(s). ` +
      (ctx.budget && ctx.budget < rec.costing.total
        ? `You said you have KES ${Number(ctx.budget).toLocaleString('en-KE')} — consider starting with a smaller area (${Math.max(e.minLand, (Number(ctx.budget) / rec.costing.perAcre)).toFixed(2)} acres) rather than borrowing.`
        : `Keep 15% aside as a buffer for surprises like an extra spray or a labour shortage.`)
  });

  plan.push({
    icon: '🧪',
    title: 'Test your soil',
    body: 'A soil test costs KES 1,500-3,500 and tells you exactly what fertilizer you need. ' +
      'Most Kenyan smallholder soils are acidic (below pH 5.5) which locks up the fertilizer you already bought.'
  });

  plan.push({
    icon: '🛒',
    title: 'Buy inputs early',
    body: `Get your ${e.inputs.map((i) => i.replace('-', ' ')).join(', ')} at least 2 weeks before planting. ` +
      'Prices rise sharply once everyone starts planting.'
  });

  plan.push({
    icon: '🤝',
    title: 'Find your buyer BEFORE you plant',
    body: 'This is the mistake most beginners make. Talk to hotels, schools, grocers, millers or a cooperative now. ' +
      'A buyer lined up in advance is worth more than a 10% yield increase.'
  });

  plan.push({
    icon: '📓',
    title: 'Write down every shilling',
    body: 'Record every cost and every sale from day one. Without records you will never know if you actually made money.'
  });

  if (e.needsIrrigation) {
    plan.push({
      icon: '💧',
      title: 'Confirm your water',
      body: 'This crop fails without reliable water. Check your source can supply through the dry weeks before you commit.'
    });
  }

  if (rec.warnings.length) {
    plan.push({
      icon: '⚠️',
      title: 'Watch out for these',
      body: rec.warnings.join(' · ')
    });
  }

  return plan;
}
