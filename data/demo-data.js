/**
 * demo-data.js
 * ⚠️ DEMO DATA ONLY — these sellers, farms, orders and prices are fictional
 * placeholders used to demonstrate the SokoShamba interface.
 * In production this data is served from Supabase.
 */

/** Pexels helper (public stock photography, hot-link friendly). */
const px = (id, w = 1200) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=${Math.round(w * 0.62)}&w=${w}`;

export const IMG = {
  maize: px(16130279),
  maize2: px(27529053),
  maizeCobs: px(7543105),
  maizeDetail: px(37331573),
  veg: px(701970),
  tomato: px(26950755),
  vegOrganic: px(319798),
  marketWomen: px(33624055),
  marketSpices: px(28493546),
  marketWide: px(13994770),
  goats: px(12565679),
  cattle: px(36280662),
  dairyBarn: px(11357090),
  goatBarn: px(5953665),
  goatFeed: px(5953670)
};

/** Fallback gradient tile used when a remote image fails to load. */
export function placeholderImage(label = 'SokoShamba', emoji = '🌿') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f5132"/><stop offset="100%" stop-color="#2f9e5f"/>
    </linearGradient></defs>
    <rect width="800" height="500" fill="url(#g)"/>
    <text x="400" y="230" font-size="96" text-anchor="middle">${emoji}</text>
    <text x="400" y="310" font-size="30" fill="#eafaf0" font-family="system-ui,sans-serif"
      text-anchor="middle">${String(label).slice(0, 26)}</text>
  </svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

/* ------------------------------------------------------------------ USERS */
/** Demo accounts. Passwords are NOT stored — demo auth accepts any password
 *  of 6+ characters for these emails (see js/auth.js). */
export const demoUsers = [
  {
    id: 'usr-001', fullName: 'Joseph Kiptoo', email: 'farmer@sokoshamba.demo',
    phone: '+254712345001', accountType: 'farmer', county: 'Uasin Gishu',
    location: 'Moiben', verified: true, avatar: '',
    bio: 'Third generation maize and dairy farmer on 12 acres in Moiben, Uasin Gishu.',
    joined: '2024-03-11', rating: 4.8
  },
  {
    id: 'usr-002', fullName: 'Amina Hassan', email: 'buyer@sokoshamba.demo',
    phone: '+254712345002', accountType: 'buyer', county: 'Nairobi',
    location: 'Embakasi', verified: true, avatar: '',
    bio: 'Procurement lead for a Nairobi grocery chain sourcing fresh produce weekly.',
    joined: '2024-06-02', rating: 4.6
  },
  {
    id: 'usr-003', fullName: 'Grace Wanjiru', email: 'supplier@sokoshamba.demo',
    phone: '+254712345003', accountType: 'supplier', county: 'Nakuru',
    location: 'Nakuru Town East', verified: true, avatar: '',
    bio: 'Agrovet supplying certified seed, fertilizer and animal feed across the Rift.',
    joined: '2023-11-19', rating: 4.9
  },
  {
    id: 'usr-004', fullName: 'Peter Otieno', email: 'services@sokoshamba.demo',
    phone: '+254712345004', accountType: 'service', county: 'Kisumu',
    location: 'Ahero', verified: false, avatar: '',
    bio: 'Tractor hire, ploughing and produce transport around Nyanza.',
    joined: '2025-01-08', rating: 4.4
  },
  {
    id: 'usr-005', fullName: 'SokoShamba Admin', email: 'admin@sokoshamba.demo',
    phone: '+254712345005', accountType: 'admin', county: 'Nairobi',
    location: 'Westlands', verified: true, avatar: '',
    bio: 'Platform operations (demo administrator account).',
    joined: '2023-08-01', rating: 5
  }
];

/* --------------------------------------------------------------- PRODUCTS */
const p = (o) => ({
  availability: 'In Stock', verifiedSeller: true, delivery: 'Seller delivery + pickup',
  createdAt: '2025-11-02', rating: 4.6, reviews: 12, ...o
});

export const demoProducts = [
  p({ id: 'prd-001', name: 'Grade 1 Dry Maize', category: 'cereals', price: 4200, unit: '90kg bag',
    quantity: 180, county: 'Uasin Gishu', location: 'Moiben', sellerId: 'usr-001', seller: 'Joseph Kiptoo',
    images: [IMG.maize, IMG.maize2, IMG.maizeDetail], emoji: '🌾',
    description: 'Well dried, sorted H614 maize at 13.5% moisture. Stored in a raised, fumigated store. Bulk collection welcome; loading assistance provided at the farm gate.' }),
  p({ id: 'prd-002', name: 'Fresh Sukuma Wiki (Kale)', category: 'vegetables', price: 35, unit: 'bunch',
    quantity: 900, county: 'Kiambu', location: 'Limuru', sellerId: 'usr-001', seller: 'Wambui Greens',
    images: [IMG.vegOrganic, IMG.veg], emoji: '🥬', rating: 4.4,
    description: 'Freshly harvested kale, cut to order every morning. Ideal for grocers, hotels and market vendors. Minimum order 50 bunches.' }),
  p({ id: 'prd-003', name: 'Tomatoes (Anna F1)', category: 'vegetables', price: 3800, unit: 'crate',
    quantity: 64, county: 'Kirinyaga', location: 'Mwea', sellerId: 'usr-001', seller: 'Mwea Fresh Growers',
    images: [IMG.tomato, IMG.marketSpices], emoji: '🍅', rating: 4.7,
    description: 'Firm, long-shelf-life Anna F1 tomatoes in 64kg crates. Graded and packed the same day as harvest.' }),
  p({ id: 'prd-004', name: 'Hass Avocado (Export Grade)', category: 'fruits', price: 28, unit: 'piece',
    quantity: 12000, county: 'Murang’a', location: 'Kandara', sellerId: 'usr-001', seller: 'Kandara Farmers Co-op',
    images: [IMG.marketWide, IMG.veg], emoji: '🥑', rating: 4.9,
    description: 'Count 16–20 export grade Hass avocado from a GlobalG.A.P-oriented cooperative. Demo listing for illustration.' }),
  p({ id: 'prd-005', name: 'Friesian Dairy Heifer', category: 'livestock', price: 145000, unit: 'head',
    quantity: 6, county: 'Nakuru', location: 'Rongai', sellerId: 'usr-001', seller: 'Rongai Dairy Stock',
    images: [IMG.cattle, IMG.dairyBarn], emoji: '🐄', rating: 4.5, delivery: 'Buyer arranges transport',
    description: 'In-calf Friesian heifers, 3rd trimester, vaccinated with full records. Veterinary inspection welcome before purchase.' }),
  p({ id: 'prd-006', name: 'Improved Kienyeji Chicks (Day Old)', category: 'poultry', price: 110, unit: 'piece',
    quantity: 2500, county: 'Kakamega', location: 'Lurambi', sellerId: 'usr-003', seller: 'Western Hatchery',
    images: [IMG.goatFeed], emoji: '🐓', rating: 4.3,
    description: 'Vaccinated day-old improved kienyeji chicks. Transport boxes included for orders above 200 chicks.' }),
  p({ id: 'prd-007', name: 'Fresh Cow Milk (Bulk)', category: 'dairy', price: 52, unit: 'litre',
    quantity: 1200, county: 'Nyeri', location: 'Mukurweini', sellerId: 'usr-001', seller: 'Mukurweini Dairy Group',
    images: [IMG.dairyBarn], emoji: '🥛', rating: 4.8,
    description: 'Cooled raw milk collected twice daily from a smallholder dairy group. Bulk supply agreements available.' }),
  p({ id: 'prd-008', name: 'Certified Maize Seed H629 (10kg)', category: 'seeds', price: 4650, unit: 'piece',
    quantity: 340, county: 'Nakuru', location: 'Nakuru Town East', sellerId: 'usr-003', seller: 'Grace Agrovet',
    images: [IMG.maizeCobs], emoji: '🌱', rating: 4.9,
    description: 'Certified hybrid maize seed suited to medium-to-high altitude zones. Sealed 10kg packs with traceable lot numbers.' }),
  p({ id: 'prd-009', name: 'DAP Fertilizer 50kg', category: 'fertilizer', price: 5400, unit: '50kg bag',
    quantity: 420, county: 'Eldoret', location: 'Uasin Gishu', sellerId: 'usr-003', seller: 'Grace Agrovet',
    images: [IMG.marketSpices], emoji: '🧪', rating: 4.7,
    description: 'Planting fertilizer for cereals. Discount tiers apply from 20 bags. Delivery within the North Rift in 48 hours.' }),
  p({ id: 'prd-010', name: 'Dairy Meal 70kg', category: 'animal-feed', price: 3150, unit: 'piece',
    quantity: 260, county: 'Kericho', location: 'Ainamoi', sellerId: 'usr-003', seller: 'Highland Feeds',
    images: [IMG.goatBarn], emoji: '🌽', rating: 4.2,
    description: '16% crude protein dairy meal formulated for high-yielding cows. Store in a dry, ventilated room.' }),
  p({ id: 'prd-011', name: 'Knapsack Sprayer 20L', category: 'farm-equipment', price: 4300, unit: 'piece',
    quantity: 75, county: 'Nairobi', location: 'Industrial Area', sellerId: 'usr-003', seller: 'Shamba Tools Ltd',
    images: [IMG.marketWide], emoji: '🚜', rating: 4.1, verifiedSeller: false,
    description: 'Heavy-duty lever knapsack sprayer with brass lance and spare seals. Six month warranty (demo listing).' }),
  p({ id: 'prd-012', name: 'Irish Potatoes (Shangi)', category: 'vegetables', price: 3300, unit: '50kg bag',
    quantity: 150, county: 'Nyandarua', location: 'Ol Kalou', sellerId: 'usr-001', seller: 'Ol Kalou Growers',
    images: [IMG.veg], emoji: '🥔', rating: 4.5,
    description: 'Freshly dug Shangi potatoes, well graded, packed in standard 50kg bags as per the Irish Potato Regulations.' }),
  p({ id: 'prd-013', name: 'Green Grams (Ndengu)', category: 'cereals', price: 12500, unit: '90kg bag',
    quantity: 40, county: 'Kitui', location: 'Mwingi', sellerId: 'usr-001', seller: 'Mwingi Pulses',
    images: [IMG.maize2], emoji: '🫘', rating: 4.6,
    description: 'Machine-cleaned N26 green grams, ready for wholesale or milling. Sample dispatch available on request.' }),
  p({ id: 'prd-014', name: 'Bananas (Tissue Culture)', category: 'fruits', price: 750, unit: 'bunch',
    quantity: 220, county: 'Meru', location: 'Imenti South', sellerId: 'usr-001', seller: 'Imenti Banana Hub',
    images: [IMG.marketWomen], emoji: '🍌', rating: 4.4,
    description: 'Large, evenly filled bunches from tissue culture stock. Ripening room supply agreements welcome.' }),
  p({ id: 'prd-015', name: 'Boer Goats (Breeding Stock)', category: 'livestock', price: 22000, unit: 'head',
    quantity: 18, county: 'Kajiado', location: 'Kitengela', sellerId: 'usr-001', seller: 'Kitengela Livestock',
    images: [IMG.goats, IMG.goatBarn], emoji: '🐐', rating: 4.3, delivery: 'Buyer arranges transport',
    description: 'Healthy Boer crosses, dewormed and vaccinated. Suitable for meat goat enterprises in ASAL counties.' }),
  p({ id: 'prd-016', name: 'Table Eggs (Tray of 30)', category: 'poultry', price: 420, unit: 'tray',
    quantity: 800, county: 'Kiambu', location: 'Thika', sellerId: 'usr-001', seller: 'Thika Layers Farm',
    images: [IMG.goatFeed], emoji: '🥚', rating: 4.7,
    description: 'Fresh brown table eggs collected daily. Standing weekly orders receive priority dispatch.' }),
  p({ id: 'prd-017', name: 'Wheat Grain (Bulk)', category: 'cereals', price: 5100, unit: '90kg bag',
    quantity: 300, county: 'Narok', location: 'Narok North', sellerId: 'usr-001', seller: 'Narok Grain Growers',
    images: [IMG.maizeDetail], emoji: '🌾', rating: 4.5,
    description: 'Clean milling wheat, moisture 12%. Weighbridge tickets provided for bulk truck loads.' }),
  p({ id: 'prd-018', name: 'Passion Fruit (Purple)', category: 'fruits', price: 160, unit: 'kg',
    quantity: 900, county: 'Bungoma', location: 'Kanduyi', sellerId: 'usr-001', seller: 'Kanduyi Fruit Farmers',
    images: [IMG.marketWide], emoji: '🍇', rating: 4.2, availability: 'Limited Stock',
    description: 'Purple passion fruit graded for juice processors and fresh market. Harvested twice weekly.' }),
  p({ id: 'prd-019', name: 'CAN Fertilizer 50kg', category: 'fertilizer', price: 4900, unit: '50kg bag',
    quantity: 380, county: 'Trans Nzoia', location: 'Kitale', sellerId: 'usr-003', seller: 'Kitale Agro Supplies',
    images: [IMG.marketSpices], emoji: '🧪', rating: 4.6,
    description: 'Top-dressing fertilizer for maize and wheat. Volume pricing for cooperatives and farmer groups.' }),
  p({ id: 'prd-020', name: 'Napier Grass Splits', category: 'animal-feed', price: 8, unit: 'piece',
    quantity: 15000, county: 'Vihiga', location: 'Sabatia', sellerId: 'usr-001', seller: 'Sabatia Fodder',
    images: [IMG.vegOrganic], emoji: '🌿', rating: 4.0, verifiedSeller: false,
    description: 'Kakamega 1 napier splits for fodder establishment. Sold in bundles of 500 splits.' }),
  p({ id: 'prd-021', name: 'Sorghum (Gadam)', category: 'cereals', price: 4700, unit: '90kg bag',
    quantity: 90, county: 'Homa Bay', location: 'Ndhiwa', sellerId: 'usr-001', seller: 'Ndhiwa Cereal Group',
    images: [IMG.maize], emoji: '🌾', rating: 4.3,
    description: 'Gadam sorghum suited to brewing and milling contracts. Aggregated from a 120-member farmer group.' }),
  p({ id: 'prd-022', name: 'Water Tank 5,000L', category: 'farm-equipment', price: 46000, unit: 'piece',
    quantity: 24, county: 'Machakos', location: 'Athi River', sellerId: 'usr-003', seller: 'Athi Plastics',
    images: [IMG.marketWide], emoji: '💧', rating: 4.4,
    description: 'UV-stabilised polyethylene tank for irrigation and livestock water storage. Delivery within 50km included.' }),
  p({ id: 'prd-023', name: 'Onions (Red Creole)', category: 'vegetables', price: 3900, unit: '50kg bag',
    quantity: 110, county: 'Kajiado', location: 'Loitokitok', sellerId: 'usr-001', seller: 'Loitokitok Growers',
    images: [IMG.marketSpices], emoji: '🧅', rating: 4.5,
    description: 'Well cured red creole onions with good keeping quality. Bulk buyers can inspect before loading.' }),
  p({ id: 'prd-024', name: 'Yoghurt (Bulk 5L)', category: 'dairy', price: 950, unit: 'piece',
    quantity: 140, county: 'Kisumu', location: 'Kisumu Central', sellerId: 'usr-003', seller: 'Lake Basin Dairies',
    images: [IMG.dairyBarn], emoji: '🥛', rating: 4.6, availability: 'Made to Order',
    description: 'Natural and vanilla yoghurt in 5 litre food-grade buckets for institutions and retailers.' })
];

/* ---------------------------------------------------------------- ORDERS */
export const demoOrders = [
  {
    id: 'SS-24081', userId: 'usr-002', sellerId: 'usr-001', date: '2026-01-14',
    items: [{ productId: 'prd-001', name: 'Grade 1 Dry Maize', qty: 10, price: 4200, unit: '90kg bag' }],
    subtotal: 42000, delivery: 2800, total: 44800, paymentMethod: 'M-Pesa',
    paymentStatus: 'Paid', status: 'Out for Delivery',
    address: { name: 'Amina Hassan', phone: '+254712345002', county: 'Nairobi', town: 'Embakasi', line: 'Off Airport North Rd, Gate 4', notes: 'Call on arrival' },
    timeline: [
      { label: 'Order placed', at: '2026-01-14 09:12' },
      { label: 'Payment confirmed', at: '2026-01-14 09:18' },
      { label: 'Seller confirmed order', at: '2026-01-14 11:40' },
      { label: 'Dispatched from Moiben', at: '2026-01-15 06:30' }
    ]
  },
  {
    id: 'SS-24074', userId: 'usr-002', sellerId: 'usr-003', date: '2026-01-06',
    items: [
      { productId: 'prd-009', name: 'DAP Fertilizer 50kg', qty: 20, price: 5400, unit: '50kg bag' },
      { productId: 'prd-008', name: 'Certified Maize Seed H629 (10kg)', qty: 6, price: 4650, unit: 'piece' }
    ],
    subtotal: 135900, delivery: 3500, total: 139400, paymentMethod: 'Card',
    paymentStatus: 'Paid', status: 'Delivered',
    address: { name: 'Amina Hassan', phone: '+254712345002', county: 'Nakuru', town: 'Njoro', line: 'Plot 12, Njoro Farm Road', notes: '' },
    timeline: [
      { label: 'Order placed', at: '2026-01-06 14:02' },
      { label: 'Payment confirmed', at: '2026-01-06 14:05' },
      { label: 'Delivered', at: '2026-01-08 12:20' }
    ]
  },
  {
    id: 'SS-24062', userId: 'usr-002', sellerId: 'usr-001', date: '2025-12-28',
    items: [{ productId: 'prd-003', name: 'Tomatoes (Anna F1)', qty: 4, price: 3800, unit: 'crate' }],
    subtotal: 15200, delivery: 1200, total: 16400, paymentMethod: 'M-Pesa',
    paymentStatus: 'Pending', status: 'Pending',
    address: { name: 'Amina Hassan', phone: '+254712345002', county: 'Nairobi', town: 'Embakasi', line: 'Off Airport North Rd, Gate 4', notes: 'Morning delivery preferred' },
    timeline: [{ label: 'Order placed', at: '2025-12-28 08:41' }]
  }
];

/* -------------------------------------------------------------- SERVICES */
export const demoServices = [
  { id: 'svc-001', name: 'Tractor Ploughing & Harrowing', type: 'machinery', provider: 'Peter Otieno', providerId: 'usr-004',
    county: 'Kisumu', location: 'Ahero', price: 3500, unit: 'acre', rating: 4.4, verified: false, emoji: '🚜',
    description: 'Disc ploughing, harrowing and ridging with a 90HP tractor. Bookings taken per acre with a 3-acre minimum.' },
  { id: 'svc-002', name: 'Refrigerated Produce Transport', type: 'transport', provider: 'ChillLink Logistics', providerId: 'usr-004',
    county: 'Nairobi', location: 'Embakasi', price: 90, unit: 'km', rating: 4.7, verified: true, emoji: '🚛',
    description: 'Temperature controlled 3-tonne trucks for horticulture moving between farm hubs and Nairobi markets.' },
  { id: 'svc-003', name: 'Grain Storage & Fumigation', type: 'storage', provider: 'Rift Grain Stores', providerId: 'usr-004',
    county: 'Uasin Gishu', location: 'Eldoret', price: 120, unit: '90kg bag', rating: 4.5, verified: true, emoji: '🏬',
    description: 'Monthly warehousing with fumigation, moisture monitoring and warehouse receipt documentation.' },
  { id: 'svc-004', name: 'Veterinary Farm Visits', type: 'veterinary', provider: 'Dr. Chebet Ruto', providerId: 'usr-004',
    county: 'Nandi', location: 'Kapsabet', price: 2500, unit: 'day', rating: 4.9, verified: true, emoji: '🩺',
    description: 'Herd health checks, AI services, deworming programmes and treatment for dairy and small stock.' },
  { id: 'svc-005', name: 'Drip Irrigation Installation', type: 'irrigation', provider: 'AquaShamba Systems', providerId: 'usr-004',
    county: 'Machakos', location: 'Mwala', price: 65000, unit: 'acre', rating: 4.6, verified: true, emoji: '💧',
    description: 'Design and installation of drip kits including filtration, mainlines and fertigation points.' },
  { id: 'svc-006', name: 'Casual Farm Labour Teams', type: 'labour', provider: 'Shamba Works Crew', providerId: 'usr-004',
    county: 'Kericho', location: 'Bureti', price: 600, unit: 'day', rating: 4.1, verified: false, emoji: '👷',
    description: 'Organised crews for weeding, harvesting, sorting and packing. Supervisor included for teams above 10.' },
  { id: 'svc-007', name: 'Agronomy Consulting', type: 'consulting', provider: 'GreenFields Agronomy', providerId: 'usr-004',
    county: 'Nakuru', location: 'Naivasha', price: 8000, unit: 'day', rating: 4.8, verified: true, emoji: '📋',
    description: 'Soil testing interpretation, crop nutrition plans and pest scouting schedules for commercial farms.' },
  { id: 'svc-008', name: 'Combine Harvester Hire', type: 'equipment', provider: 'North Rift Harvesters', providerId: 'usr-004',
    county: 'Trans Nzoia', location: 'Kitale', price: 4800, unit: 'acre', rating: 4.5, verified: true, emoji: '🌾',
    description: 'Wheat and maize combine harvesting with grain trailers. Book early for the August–October window.' }
];

/* -------------------------------------------------------------- ADVISORY */
export const demoArticles = [
  { id: 'adv-001', category: 'Crop Production', title: 'Planning your maize season in the North Rift',
    author: 'SokoShamba Agronomy Desk', date: '2026-01-05', read: 6, image: IMG.maizeCobs,
    excerpt: 'Variety choice, planting windows and spacing decisions that determine yield before the first rains arrive.',
    body: `<p>Maize yields in the North Rift are largely decided before planting. Start by matching the variety maturity class to your altitude and expected rainfall.</p>
<h3>1. Choose the right variety</h3><p>Above 1,800m, late maturing varieties such as H629 or H6213 use the long season well. In medium zones, medium maturing varieties reduce the risk of a dry finish.</p>
<h3>2. Soil testing pays for itself</h3><p>A soil test costing a few thousand shillings often reveals that blanket DAP application is not what your field needs. Correcting pH with lime can raise nutrient availability substantially.</p>
<h3>3. Plant spacing</h3><p>Target 75cm between rows and 25cm within rows for one plant per hill — roughly 53,000 plants per hectare.</p>
<h3>4. Plan weeding early</h3><p>The critical weed-free period is the first six weeks. Budget for labour or herbicide before planting, not after weeds appear.</p>` },
  { id: 'adv-002', category: 'Livestock', title: 'Feeding dairy cows for consistent milk yield',
    author: 'Dr. Chebet Ruto', date: '2025-12-18', read: 7, image: IMG.dairyBarn,
    excerpt: 'A practical feeding framework for smallholder dairy units targeting 18–25 litres per cow per day.',
    body: `<p>Milk yield follows dry matter intake. A 450kg cow needs roughly 3% of her body weight in dry matter daily.</p>
<h3>Forage first</h3><p>Quality napier harvested at 1–1.2m, plus legumes such as desmodium or lucerne, should form the base of the ration.</p>
<h3>Concentrates with purpose</h3><p>Feed dairy meal at about 1kg for every 2–3 litres produced above maintenance. Feeding more than 4kg in one sitting risks acidosis.</p>
<h3>Water is a nutrient</h3><p>A lactating cow drinks 60–100 litres a day. Restricted water is the most common hidden cause of a yield drop.</p>` },
  { id: 'adv-003', category: 'Poultry', title: 'Brooding improved kienyeji chicks successfully',
    author: 'SokoShamba Advisory', date: '2025-12-02', read: 5, image: IMG.goatFeed,
    excerpt: 'The first 21 days determine flock uniformity. Temperature, space and biosecurity basics explained.',
    body: `<p>Set the brooder to 32–35°C for the first week and reduce by roughly 3°C each week until room temperature.</p>
<h3>Space</h3><p>Allow 1 square foot per chick to four weeks. Overcrowding causes pecking and uneven growth.</p>
<h3>Biosecurity</h3><p>Use a footbath, restrict visitors and never mix age groups in one house.</p>
<h3>Vaccination</h3><p>Follow the hatchery programme: Marek's at day old, Gumboro and Newcastle as scheduled.</p>` },
  { id: 'adv-004', category: 'Soil Health', title: 'Reading a soil test report without confusion',
    author: 'GreenFields Agronomy', date: '2025-11-21', read: 8, image: IMG.vegOrganic,
    excerpt: 'pH, organic carbon, CEC and the nutrient columns — what actually changes your fertilizer plan.',
    body: `<p>Most Kenyan smallholder soils tested show acidity below pH 5.5 and low organic carbon. Both limit fertilizer response.</p>
<h3>pH</h3><p>Below 5.5, apply agricultural lime based on the recommendation and give it at least two months before planting.</p>
<h3>Organic carbon</h3><p>Below 2% means poor structure and water holding. Manure, compost and cover crops fix this over seasons, not weeks.</p>
<h3>Phosphorus</h3><p>Acidic soils fix phosphorus. Banding fertilizer near the seed is more efficient than broadcasting.</p>` },
  { id: 'adv-005', category: 'Pest Management', title: 'Managing fall armyworm with an IPM approach',
    author: 'SokoShamba Agronomy Desk', date: '2025-11-08', read: 6, image: IMG.maize2,
    excerpt: 'Scouting thresholds, cultural controls and responsible pesticide rotation to slow resistance.',
    body: `<p>Scout twice a week from emergence. Treat when 20% of plants in the whorl stage show fresh damage.</p>
<h3>Cultural control</h3><p>Early planting, push-pull intercropping with desmodium, and destroying crop residue all reduce pressure.</p>
<h3>Chemical rotation</h3><p>Rotate active ingredient groups between sprays and always observe the pre-harvest interval on the label.</p>
<h3>Safety</h3><p>Wear protective clothing and never re-use pesticide containers for water or feed.</p>` },
  { id: 'adv-006', category: 'Irrigation', title: 'Sizing a drip system for one acre of tomatoes',
    author: 'AquaShamba Systems', date: '2025-10-30', read: 7, image: IMG.tomato,
    excerpt: 'Water source, filtration, lateral spacing and daily run-time calculations for horticulture.',
    body: `<p>One acre of tomatoes at peak needs roughly 20,000–25,000 litres per day depending on climate and stage.</p>
<h3>Storage</h3><p>Size your tank for at least one full day of irrigation to absorb pumping interruptions.</p>
<h3>Filtration</h3><p>A disc or screen filter is mandatory. Emitter blockage is the leading cause of drip failure.</p>
<h3>Run time</h3><p>With 1.6 litre/hour emitters at 30cm spacing, calculate emitters per line, then divide daily requirement by total hourly output.</p>` },
  { id: 'adv-007', category: 'Farm Finance', title: 'Costing your farm enterprise properly',
    author: 'SokoShamba Advisory', date: '2025-10-12', read: 5, image: IMG.marketWide,
    excerpt: 'Fixed vs variable costs, break-even price and why family labour must appear in your books.',
    body: `<p>Many farms look profitable only because unpaid family labour and land are excluded from the calculation.</p>
<h3>Variable costs</h3><p>Seed, fertilizer, chemicals, casual labour, transport — these scale with area planted.</p>
<h3>Fixed costs</h3><p>Land rent, equipment depreciation, permanent staff. Allocate a share to each enterprise.</p>
<h3>Break-even</h3><p>Break-even price equals total cost divided by expected yield. Use the SokoShamba Farm Calculator to model scenarios before planting.</p>` },
  { id: 'adv-008', category: 'Market Information', title: 'Timing your maize sale after harvest',
    author: 'SokoShamba Market Desk', date: '2025-09-27', read: 6, image: IMG.marketWomen,
    excerpt: 'Post-harvest price cycles, storage costs and how to decide between selling now or holding.',
    body: `<p>Prices are typically lowest at harvest and recover over the following months. Holding only pays if the price gain exceeds storage cost and losses.</p>
<h3>Count the cost of holding</h3><p>Include storage fees, fumigation, shrinkage and the cost of capital tied up in the crop.</p>
<h3>Sell in tranches</h3><p>Selling in three portions across the season reduces the risk of getting the timing completely wrong.</p>
<h3>Use verified information</h3><p>Compare several market references before committing to a buyer.</p>` }
];

export const advisoryCategories = ['Crop Production', 'Livestock', 'Poultry', 'Soil Health', 'Pest Management', 'Irrigation', 'Farm Finance', 'Market Information'];

/* --------------------------------------------------------- MARKET PRICES */
/** ⚠️ DEMO DATA — not a live market feed. */
export const demoMarketPrices = [
  { crop: 'Maize (dry)', market: 'Eldoret Main Market', county: 'Uasin Gishu', price: 4250, unit: '90kg bag', date: '2026-01-16', trend: 2.4 },
  { crop: 'Maize (dry)', market: 'Nakuru Wakulima', county: 'Nakuru', price: 4400, unit: '90kg bag', date: '2026-01-16', trend: 1.1 },
  { crop: 'Tomatoes', market: 'Wakulima Market', county: 'Nairobi', price: 4100, unit: 'crate', date: '2026-01-16', trend: -3.8 },
  { crop: 'Irish Potatoes', market: 'Ol Kalou Market', county: 'Nyandarua', price: 3250, unit: '50kg bag', date: '2026-01-15', trend: 0.9 },
  { crop: 'Sukuma Wiki', market: 'Kongowea Market', county: 'Mombasa', price: 45, unit: 'bunch', date: '2026-01-15', trend: 5.2 },
  { crop: 'Beans (Rosecoco)', market: 'Kibuye Market', county: 'Kisumu', price: 10800, unit: '90kg bag', date: '2026-01-14', trend: -1.4 },
  { crop: 'Milk (raw)', market: 'Kericho Collection', county: 'Kericho', price: 53, unit: 'litre', date: '2026-01-16', trend: 0 },
  { crop: 'Onions (red)', market: 'Loitokitok Market', county: 'Kajiado', price: 4050, unit: '50kg bag', date: '2026-01-13', trend: 3.6 },
  { crop: 'Bananas', market: 'Meru Town Market', county: 'Meru', price: 780, unit: 'bunch', date: '2026-01-14', trend: -0.7 },
  { crop: 'Green Grams', market: 'Mwingi Market', county: 'Kitui', price: 12900, unit: '90kg bag', date: '2026-01-12', trend: 4.1 }
];

/* --------------------------------------------------------- NOTIFICATIONS */
export const demoNotifications = [
  { id: 'ntf-001', type: 'order', title: 'Order SS-24081 is out for delivery', body: 'Your 10 bags of Grade 1 Dry Maize left Moiben this morning.', at: '2026-01-15 06:35', read: false },
  { id: 'ntf-002', type: 'payment', title: 'Payment received', body: 'KES 44,800 confirmed for order SS-24081 via M-Pesa (demo).', at: '2026-01-14 09:18', read: false },
  { id: 'ntf-003', type: 'message', title: 'New message from Grace Wanjiru', body: 'Your fertilizer order can be delivered on Thursday.', at: '2026-01-13 17:02', read: false },
  { id: 'ntf-004', type: 'listing', title: 'Listing approved', body: 'Tomatoes (Anna F1) is now live on the marketplace.', at: '2026-01-11 10:24', read: true },
  { id: 'ntf-005', type: 'system', title: 'Welcome to SokoShamba', body: 'You are exploring the platform in demo mode. No real transactions occur.', at: '2026-01-02 08:00', read: true }
];

/* ------------------------------------------------------- PLATFORM STATS */
/** Labelled clearly in the UI as demo/placeholder figures. */
export const demoStats = [
  { label: 'Demo farmer profiles', value: 1250, suffix: '+' },
  { label: 'Demo product listings', value: 480, suffix: '+' },
  { label: 'Counties represented', value: 24, suffix: '' },
  { label: 'Demo orders simulated', value: 3600, suffix: '+' }
];
