/**
 * farm-data.js — Real Kenyan agricultural reference data.
 * Used by the farm calculator and farm tools.
 *
 * Costs reflect typical 2025/26 smallholder budgets in KES.
 * Yields are conservative averages, adjustable by management level.
 */

/* ====================================================== CROP PROFILES */
/**
 * yieldRange: [poor, average, good] per acre
 * priceRange: [low, typical, high] farmgate KES per unit
 */
export const CROP_PROFILES = {
    maize: {
      name: 'Maize (hybrid)', emoji: '🌾', unit: '90kg bag',
      yieldRange: [12, 22, 35], priceRange: [3400, 4300, 5400],
      cycleDays: 150, seedRateKg: 10, seedCostPerKg: 465,
      npkPerAcre: { N: 60, P: 30, K: 15 },
      costs: { seed: 4650, fertilizer: 15200, chemicals: 3200, labour: 9500, land: 6000, other: 3000 },
      altitudes: ['high', 'medium'],
      note: 'Yield swings hugely with rainfall at tasselling and weed control in the first 6 weeks.'
    },
    beans: {
      name: 'Beans (Rosecoco)', emoji: '🫘', unit: '90kg bag',
      yieldRange: [3, 6, 10], priceRange: [7500, 10000, 13500],
      cycleDays: 90, seedRateKg: 30, seedCostPerKg: 200,
      npkPerAcre: { N: 20, P: 40, K: 20 },
      costs: { seed: 6000, fertilizer: 8000, chemicals: 3000, labour: 11000, land: 5000, other: 2500 },
      altitudes: ['high', 'medium'],
      note: 'Fixes nitrogen — a great rotation crop before maize.'
    },
    potato: {
      name: 'Irish Potato (Shangi)', emoji: '🥔', unit: '50kg bag',
      yieldRange: [50, 85, 130], priceRange: [1800, 3000, 4500],
      cycleDays: 100, seedRateKg: 800, seedCostPerKg: 44,
      npkPerAcre: { N: 80, P: 60, K: 100 },
      costs: { seed: 35000, fertilizer: 22000, chemicals: 12000, labour: 22000, land: 7000, other: 6000 },
      altitudes: ['high'],
      note: 'Certified seed is the single biggest driver of yield. Recycled seed can halve output.'
    },
    tomato: {
      name: 'Tomato (Anna F1)', emoji: '🍅', unit: 'crate (64kg)',
      yieldRange: [110, 200, 320], priceRange: [1800, 3200, 5500],
      cycleDays: 110, seedRateKg: 0.05, seedCostPerKg: 180000,
      npkPerAcre: { N: 100, P: 60, K: 120 },
      costs: { seed: 9000, fertilizer: 32000, chemicals: 38000, labour: 40000, land: 8000, other: 18000 },
      altitudes: ['high', 'medium', 'low'],
      note: 'Highest reward, highest risk. Tuta absoluta and price crashes are the two killers.'
    },
    sukuma: {
      name: 'Sukuma Wiki (kale)', emoji: '🥬', unit: 'bunch',
      yieldRange: [7000, 12000, 18000], priceRange: [20, 33, 50],
      cycleDays: 60, seedRateKg: 0.25, seedCostPerKg: 12000,
      npkPerAcre: { N: 90, P: 40, K: 50 },
      costs: { seed: 3000, fertilizer: 12000, chemicals: 3500, labour: 18000, land: 5000, other: 3500 },
      altitudes: ['high', 'medium', 'low'],
      note: 'Harvest weekly for months. Staggered planting smooths your cash flow.'
    },
    onion: {
      name: 'Onion (Red Creole)', emoji: '🧅', unit: '50kg bag',
      yieldRange: [80, 130, 200], priceRange: [2000, 3600, 6000],
      cycleDays: 150, seedRateKg: 2, seedCostPerKg: 6000,
      npkPerAcre: { N: 70, P: 50, K: 80 },
      costs: { seed: 12000, fertilizer: 26000, chemicals: 16000, labour: 34000, land: 6000, other: 12000 },
      altitudes: ['medium', 'low'],
      note: 'Cures and stores well — you can hold stock and sell into a better market.'
    },
    greengram: {
      name: 'Green Gram (Ndengu)', emoji: '🫛', unit: '90kg bag',
      yieldRange: [3, 5, 8], priceRange: [8000, 11500, 15000],
      cycleDays: 75, seedRateKg: 8, seedCostPerKg: 440,
      npkPerAcre: { N: 15, P: 30, K: 15 },
      costs: { seed: 3500, fertilizer: 4000, chemicals: 4500, labour: 9000, land: 3500, other: 2000 },
      altitudes: ['medium', 'low'],
      note: 'Drought tolerant and short season. Ideal for ASAL counties.'
    },
    sorghum: {
      name: 'Sorghum (Gadam)', emoji: '🌾', unit: '90kg bag',
      yieldRange: [7, 12, 20], priceRange: [3200, 4300, 5500],
      cycleDays: 110, seedRateKg: 4, seedCostPerKg: 625,
      npkPerAcre: { N: 40, P: 20, K: 10 },
      costs: { seed: 2500, fertilizer: 6000, chemicals: 3000, labour: 8500, land: 3500, other: 2500 },
      altitudes: ['medium', 'low'],
      note: 'Grows where maize fails. Contract with a brewery or miller before planting.'
    },
    wheat: {
      name: 'Wheat', emoji: '🌾', unit: '90kg bag',
      yieldRange: [12, 20, 30], priceRange: [4200, 5100, 6200],
      cycleDays: 120, seedRateKg: 50, seedCostPerKg: 110,
      npkPerAcre: { N: 70, P: 40, K: 20 },
      costs: { seed: 5500, fertilizer: 17000, chemicals: 6500, labour: 7000, land: 7000, other: 4500 },
      altitudes: ['high'],
      note: 'Mechanised crop — economics only work above about 10 acres.'
    },
    cabbage: {
      name: 'Cabbage', emoji: '🥬', unit: 'head',
      yieldRange: [12000, 18000, 26000], priceRange: [20, 35, 60],
      cycleDays: 95, seedRateKg: 0.15, seedCostPerKg: 90000,
      npkPerAcre: { N: 100, P: 50, K: 80 },
      costs: { seed: 8000, fertilizer: 20000, chemicals: 14000, labour: 24000, land: 6000, other: 8000 },
      altitudes: ['high', 'medium'],
      note: 'Diamondback moth is the main pest. Prices crash when everyone harvests together.'
    },
    banana: {
      name: 'Banana (tissue culture)', emoji: '🍌', unit: 'bunch',
      yieldRange: [300, 450, 650], priceRange: [400, 700, 1100],
      cycleDays: 400, seedRateKg: 450, seedCostPerKg: 100,
      npkPerAcre: { N: 80, P: 30, K: 150 },
      costs: { seed: 45000, fertilizer: 18000, chemicals: 6000, labour: 26000, land: 6000, other: 9000 },
      altitudes: ['medium', 'low'],
      note: 'Year one is investment. From year two the same plants keep producing.'
    },
    avocado: {
      name: 'Hass Avocado', emoji: '🥑', unit: 'fruit',
      yieldRange: [3500, 6000, 10000], priceRange: [12, 25, 40],
      cycleDays: 1095, seedRateKg: 160, seedCostPerKg: 200,
      npkPerAcre: { N: 60, P: 30, K: 90 },
      costs: { seed: 32000, fertilizer: 14000, chemicals: 5000, labour: 18000, land: 7000, other: 8000 },
      altitudes: ['high', 'medium'],
      note: 'Three years to real income, then 30+ years of harvest.'
    }
  };
  
  /* ================================================= REGION MULTIPLIERS */
  /** Yield multiplier by agro-zone rainfall reliability. */
  export const REGION_YIELD = {
    reliable: 1.0,
    moderate: 0.82,
    low: 0.6
  };
  
  /** Management level — the single biggest controllable factor. */
  export const MANAGEMENT_LEVELS = [
    { id: 'basic',     label: 'Basic',     mult: 0.68, desc: 'Rain-fed, minimal inputs, weeding when time allows' },
    { id: 'standard',  label: 'Standard',  mult: 1.0,  desc: 'Recommended fertilizer, timely weeding, basic pest control' },
    { id: 'good',      label: 'Good',      mult: 1.28, desc: 'Soil-tested nutrition, scouting, timely everything' },
    { id: 'intensive', label: 'Intensive', mult: 1.55, desc: 'Certified seed, irrigation, full agronomy support' }
  ];
  
  /* ==================================================== FERTILIZER DATA */
  export const FERTILIZERS = [
    { id: 'dap',    name: 'DAP (18-46-0)',   N: 18,  P: 46,  K: 0,   pricePer50kg: 5400, use: 'Planting' },
    { id: 'npk',    name: 'NPK 17-17-17',    N: 17,  P: 17,  K: 17,  pricePer50kg: 5100, use: 'Planting / general' },
    { id: 'can',    name: 'CAN (26-0-0)',    N: 26,  P: 0,   K: 0,   pricePer50kg: 4900, use: 'Top dressing' },
    { id: 'urea',   name: 'Urea (46-0-0)',   N: 46,  P: 0,   K: 0,   pricePer50kg: 5600, use: 'Top dressing' },
    { id: 'mop',    name: 'MOP (0-0-60)',    N: 0,   P: 0,   K: 60,  pricePer50kg: 5800, use: 'Potassium boost' },
    { id: 'tsp',    name: 'TSP (0-46-0)',    N: 0,   P: 46,  K: 0,   pricePer50kg: 5500, use: 'Phosphorus boost' },
    { id: 'manure', name: 'Farmyard manure', N: 0.5, P: 0.3, K: 0.5, pricePer50kg: 300,  use: 'Soil conditioner' }
  ];
  
  /* ======================================================= FEED DATA */
  export const LIVESTOCK_FEED = {
    dairy: {
      name: 'Dairy cow', emoji: '🐄',
      bodyWeightKg: 450,
      dmIntakePct: 0.031,
      concentratePerLitre: 0.4,
      maintenanceLitres: 5,
      waterPerLitreMilk: 4,
      feeds: [
        { id: 'napier',    name: 'Napier grass (fresh)', dmPct: 0.20, cpPct: 0.09, pricePerKg: 4 },
        { id: 'silage',    name: 'Maize silage',         dmPct: 0.32, cpPct: 0.08, pricePerKg: 9 },
        { id: 'hay',       name: 'Boma rhodes hay',      dmPct: 0.88, cpPct: 0.07, pricePerKg: 22 },
        { id: 'dairymeal', name: 'Dairy meal (16% CP)',  dmPct: 0.89, cpPct: 0.16, pricePerKg: 45 },
        { id: 'desmodium', name: 'Desmodium',            dmPct: 0.25, cpPct: 0.18, pricePerKg: 8 }
      ]
    },
    layers: {
      name: 'Layer chicken', emoji: '🥚',
      feedPerBirdPerDay: 0.115,
      eggsPerBirdPerYear: 280,
      feeds: [
        { id: 'layermash', name: 'Layers mash', dmPct: 0.89, cpPct: 0.17, pricePerKg: 62 }
      ]
    },
    broilers: {
      name: 'Broiler chicken', emoji: '🐔',
      feedPerBirdTotal: 4.2,
      daysToMarket: 42,
      feeds: [
        { id: 'starter',  name: 'Broiler starter',  dmPct: 0.89, cpPct: 0.22, pricePerKg: 72 },
        { id: 'finisher', name: 'Broiler finisher', dmPct: 0.89, cpPct: 0.19, pricePerKg: 68 }
      ]
    },
    kienyeji: {
      name: 'Improved kienyeji', emoji: '🐓',
      feedPerBirdPerDay: 0.075,
      daysToMarket: 150,
      feeds: [
        { id: 'growers', name: 'Growers mash', dmPct: 0.89, cpPct: 0.15, pricePerKg: 55 }
      ]
    },
    goat: {
      name: 'Dairy goat', emoji: '🐐',
      bodyWeightKg: 50,
      dmIntakePct: 0.035,
      feeds: [
        { id: 'napier',    name: 'Napier grass', dmPct: 0.20, cpPct: 0.09, pricePerKg: 4 },
        { id: 'dairymeal', name: 'Dairy meal',   dmPct: 0.89, cpPct: 0.16, pricePerKg: 45 }
      ]
    }
  };
  
  /* ================================================= PLANTING CALENDAR */
  export const PLANTING_WINDOWS = {
    'North Rift Highlands': {
      long: { start: 3, end: 5, label: 'Mar – May', reliability: 'high' },
      short: null,
      note: 'One long season. Plant with the first reliable rains in March/April.'
    },
    'Tea Highlands': {
      long: { start: 3, end: 5, label: 'Mar – May', reliability: 'high' },
      short: { start: 9, end: 11, label: 'Sep – Nov', reliability: 'medium' },
      note: 'Well distributed rainfall. Most crops do well.'
    },
    'Central Highlands': {
      long: { start: 3, end: 4, label: 'Mar – Apr', reliability: 'high' },
      short: { start: 10, end: 11, label: 'Oct – Nov', reliability: 'medium' },
      note: 'Two seasons. Long rains give better yields.'
    },
    'Mt Kenya East': {
      long: { start: 3, end: 4, label: 'Mar – Apr', reliability: 'high' },
      short: { start: 10, end: 11, label: 'Oct – Nov', reliability: 'high' },
      note: 'Both seasons are productive here.'
    },
    'Kisii Highlands': {
      long: { start: 2, end: 4, label: 'Feb – Apr', reliability: 'high' },
      short: { start: 8, end: 10, label: 'Aug – Oct', reliability: 'high' },
      note: 'Reliable rainfall almost year round.'
    },
    'Western': {
      long: { start: 2, end: 4, label: 'Feb – Apr', reliability: 'high' },
      short: { start: 8, end: 9, label: 'Aug – Sep', reliability: 'medium' },
      note: 'Long growing period. Early planting pays.'
    },
    'Western Lowlands': {
      long: { start: 3, end: 4, label: 'Mar – Apr', reliability: 'medium' },
      short: { start: 9, end: 10, label: 'Sep – Oct', reliability: 'medium' },
      note: 'Watch for mid-season dry spells.'
    },
    'Lake Basin': {
      long: { start: 3, end: 4, label: 'Mar – Apr', reliability: 'medium' },
      short: { start: 9, end: 10, label: 'Sep – Oct', reliability: 'medium' },
      note: 'Rains can be erratic. Consider drought-tolerant varieties.'
    },
    'Eastern Semi-Arid': {
      long: { start: 3, end: 4, label: 'Mar – Apr', reliability: 'low' },
      short: { start: 10, end: 11, label: 'Oct – Nov', reliability: 'medium' },
      note: 'Short rains are often more reliable than long rains here.'
    },
    'Central Rift': {
      long: { start: 3, end: 5, label: 'Mar – May', reliability: 'medium' },
      short: { start: 10, end: 11, label: 'Oct – Nov', reliability: 'low' },
      note: 'Irrigation greatly improves reliability.'
    },
    'South Rift': {
      long: { start: 3, end: 5, label: 'Mar – May', reliability: 'medium' },
      short: { start: 10, end: 11, label: 'Oct – Nov', reliability: 'low' },
      note: 'Long season crops do best with the main rains.'
    },
    'Southern Rangelands': {
      long: { start: 3, end: 4, label: 'Mar – Apr', reliability: 'low' },
      short: { start: 11, end: 12, label: 'Nov – Dec', reliability: 'low' },
      note: 'Livestock and drought-tolerant crops only without irrigation.'
    },
    'Coastal': {
      long: { start: 4, end: 6, label: 'Apr – Jun', reliability: 'medium' },
      short: { start: 10, end: 12, label: 'Oct – Dec', reliability: 'medium' },
      note: 'Humid conditions increase disease pressure.'
    },
    'Coastal Hinterland': {
      long: { start: 3, end: 5, label: 'Mar – May', reliability: 'low' },
      short: { start: 10, end: 12, label: 'Oct – Dec', reliability: 'medium' },
      note: 'Water harvesting makes a big difference here.'
    },
    'Coastal Lowland': {
      long: { start: 4, end: 6, label: 'Apr – Jun', reliability: 'low' },
      short: { start: 10, end: 12, label: 'Oct – Dec', reliability: 'low' },
      note: 'Very dry. Irrigation or flood-recession farming only.'
    },
    'Urban / Peri-urban': {
      long: { start: 3, end: 4, label: 'Mar – Apr', reliability: 'medium' },
      short: { start: 10, end: 11, label: 'Oct – Nov', reliability: 'medium' },
      note: 'Greenhouse and irrigated horticulture work well near the city market.'
    },
    'ASAL': {
      long: { start: 3, end: 4, label: 'Mar – Apr', reliability: 'low' },
      short: { start: 10, end: 11, label: 'Oct – Nov', reliability: 'low' },
      note: 'Only short-season drought tolerant crops. Water harvesting is essential.'
    },
    'default': {
      long: { start: 3, end: 5, label: 'Mar – May', reliability: 'medium' },
      short: { start: 10, end: 11, label: 'Oct – Nov', reliability: 'medium' },
      note: 'Confirm local rainfall patterns with neighbours or extension officers.'
    }
  };
  
  export const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];