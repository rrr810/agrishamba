/**
 * SokoShamba — Central configuration
 *
 * Only public configuration belongs here.
 *
 * Never put these values in this file:
 * - Supabase service-role key
 * - Paystack secret key
 * - Gemini API key
 * - SMTP passwords
 * - Private webhook secrets
 */

export const APP = Object.freeze({
  name: 'SokoShamba',
  legalName: 'SokoShamba (Registration pending)',
  tagline: "Connecting Kenya's Agricultural Community",
  version: '1.0.0',
  yearFounded: 2026,

  supportEmail: 'ryankibichiy@gmail.com',
  businessEmail: 'virrtech@gmail.com',
  supportPhone: '+254 740 793 959',
  whatsapp: '254740793959',
  officeLocation: 'Eldoret, Kenya',

  founder: {
    name: 'Ryan Kibichiy Lagat',
    role: 'Founder & CEO'
  },

  liveUrl: 'https://agrishamba.netlify.app',
  canonical: 'https://agrishamba.netlify.app/'
});

/* ============================================================ SUPABASE */

export const SUPABASE = {
  url: 'https://wihsjgaqfpzrigofzfzb.supabase.co',

  // Public Supabase anon key only.
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpaHNqZ2FxZnB6cmlnb2Z6ZnpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NDg5MTEsImV4cCI6MjEwMTQyNDkxMX0.DwdG_SDdhA5x_wflmKeuIhDoDtl6to539KydDnS3SH4',

  buckets: {
    productImages: 'product-images',
    avatars: 'avatars'
  }
};

/* ============================================================ PAYSTACK */

export const PAYSTACK = {
  // Test key for the current SokoShamba Paystack account.
  // Keep test mode on until Paystack approves the account.
  publicKey: 'pk_test_1cbb1ca7961fd0de2ef2546708bff531a2ecc3a9',

  initializeEndpoint:
    'https://wihsjgaqfpzrigofzfzb.supabase.co/functions/v1/paystack-initialize',

  verifyEndpoint:
    'https://wihsjgaqfpzrigofzfzb.supabase.co/functions/v1/paystack-verify',

  currency: 'KES',

  channels: [
    'mobile_money',
    'card',
    'bank_transfer'
  ],

  // true = test mode
  // false = live mode after Paystack approval
  testMode: true,

  testMpesaSuccess: '0710000000',
  testMpesaFailure: '0710000001'
};

/* ========================================================== AUTOMATION */

export const AUTOMATION = {
  proxyEndpoint:
    'https://wihsjgaqfpzrigofzfzb.supabase.co/functions/v1/automation-event',

  enabled: false
};

/* =============================================================== MODE */

export const MODE = {
  DEMO: 'demo',
  PRODUCTION: 'production'
};

export function getMode() {
  return SUPABASE.url && SUPABASE.anonKey
    ? MODE.PRODUCTION
    : MODE.DEMO;
}

export function isDemo() {
  return getMode() === MODE.DEMO;
}

/* ============================================================ COUNTIES */

export const COUNTIES = [
  'Baringo',
  'Bomet',
  'Bungoma',
  'Busia',
  'Elgeyo-Marakwet',
  'Embu',
  'Garissa',
  'Homa Bay',
  'Isiolo',
  'Kajiado',
  'Kakamega',
  'Kericho',
  'Kiambu',
  'Kilifi',
  'Kirinyaga',
  'Kisii',
  'Kisumu',
  'Kitui',
  'Kwale',
  'Laikipia',
  'Lamu',
  'Machakos',
  'Makueni',
  'Mandera',
  'Marsabit',
  'Meru',
  'Migori',
  'Mombasa',
  'Muranga',
  'Nairobi',
  'Nakuru',
  'Nandi',
  'Narok',
  'Nyamira',
  'Nyandarua',
  'Nyeri',
  'Samburu',
  'Siaya',
  'Taita-Taveta',
  'Tana River',
  'Tharaka-Nithi',
  'Trans Nzoia',
  'Turkana',
  'Uasin Gishu',
  'Vihiga',
  'Wajir',
  'West Pokot'
];

/* ========================================================== CATEGORIES */

export const CATEGORIES = [
  { id: 'cereals', name: 'Cereals', icon: '🌾' },
  { id: 'vegetables', name: 'Vegetables', icon: '🥬' },
  { id: 'fruits', name: 'Fruits', icon: '🍌' },
  { id: 'livestock', name: 'Livestock', icon: '🐄' },
  { id: 'poultry', name: 'Poultry', icon: '🐓' },
  { id: 'dairy', name: 'Dairy', icon: '🥛' },
  { id: 'seeds', name: 'Seeds', icon: '🌱' },
  { id: 'fertilizer', name: 'Fertilizer', icon: '🧪' },
  { id: 'animal-feed', name: 'Animal Feed', icon: '🌽' },
  { id: 'farm-equipment', name: 'Farm Equipment', icon: '🚜' },
  { id: 'other', name: 'Other', icon: '📦' }
];

/* =============================================================== UNITS */

export const UNITS = [
  'kg',
  '90kg bag',
  '50kg bag',
  'crate',
  'tray',
  'litre',
  'bunch',
  'piece',
  'head',
  'tonne',
  'acre',
  'day'
];

/* ======================================================= ACCOUNT TYPES */

export const ACCOUNT_TYPES = [
  {
    id: 'farmer',
    label: 'Farmer',
    icon: '🧑‍🌾',
    desc: 'Sell your produce, dairy, livestock or poultry directly to buyers.'
  },
  {
    id: 'buyer',
    label: 'Buyer',
    icon: '🛒',
    desc: 'Source produce directly from verified farmers and cooperatives.'
  },
  {
    id: 'supplier',
    label: 'Supplier',
    icon: '🏪',
    desc: 'Sell seeds, fertilizer, animal feed and farm equipment.'
  },
  {
    id: 'rider',
    label: 'Rider / Transport',
    icon: '🚛',
    desc: 'Offer boda-boda, pickup, lorry or refrigerated transport for produce.'
  },
  {
    id: 'service',
    label: 'Other Service',
    icon: '🧰',
    desc: 'Machinery hire, storage, veterinary, irrigation or consulting.'
  }
];

/* ============================================================ STATUSES */

export const ORDER_STATUSES = [
  'Pending',
  'Payment Received',
  'Confirmed',
  'Being Prepared',
  'Ready',
  'Rider Assigned',
  'Out for Delivery',
  'Delivered',
  'Confirmed by Buyer',
  'Cancelled',
  'Disputed'
];

export const PAYMENT_STATUSES = [
  'Pending',
  'Paid',
  'Failed',
  'Cancelled',
  'Refunded'
];

/* ================================================= PRICING FALLBACKS */

export const DELIVERY_FEE_BASE = 200;
export const PLATFORM_FEE_RATE = 0.05;