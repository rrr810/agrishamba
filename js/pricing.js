/**
 * pricing.js — SokoShamba commission and delivery pricing.
 * All amounts are in KES.
 */

export const COMMISSION_TIERS = [
    { max: 1000, flat: 30 },
    { max: 50000, rate: 0.05 },
    { max: Infinity, rate: 0.03 }
  ];
  
  export function calculateCommission(subtotal) {
    const amount = Math.max(0, Number(subtotal) || 0);
    if (!amount) return 0;
  
    const tier = COMMISSION_TIERS.find((item) => amount <= item.max);
  
    return tier?.flat !== undefined
      ? tier.flat
      : Math.round(amount * (tier?.rate || 0));
  }
  
  export function sellerPayout(subtotal) {
    const amount = Math.max(0, Number(subtotal) || 0);
    return Math.max(0, amount - calculateCommission(amount));
  }
  
  export const DELIVERY_RATES = {
    boda: [
      { maxKm: 5, price: 200 },
      { maxKm: 15, price: 350 },
      { maxKm: 30, price: 600 },
      { maxKm: 50, price: 900 }
    ],
    pickup: [
      { maxKm: 5, price: 400 },
      { maxKm: 15, price: 700 },
      { maxKm: 30, price: 1200 },
      { maxKm: 50, price: 2000 }
    ]
  };
  
  export const WEIGHT_MULTIPLIERS = [
    { maxKg: 20, mult: 1 },
    { maxKg: 50, mult: 1.3 },
    { maxKg: 200, mult: 1.5, requiresPickup: true },
    { maxKg: Infinity, mult: 2, requiresLorry: true }
  ];
  
  export const HANDLING_EXTRAS = {
    livestock: { label: 'Livestock', extra: 1 },
    refrigerated: { label: 'Refrigerated', extra: 0.5 },
    lateNight: { label: 'Late night', extra: 0.3 },
    badWeather: { label: 'Bad weather', extra: 0.2 }
  };
  
  export function calculateDelivery({
    distanceKm = 5,
    vehicle = 'boda',
    weightKg = 10,
    extras = []
  } = {}) {
    const distance = Math.max(0, Number(distanceKm) || 0);
    const weight = Math.max(0, Number(weightKg) || 0);
    const rates = DELIVERY_RATES[vehicle] || DELIVERY_RATES.boda;
  
    const distanceTier =
      rates.find((tier) => distance <= tier.maxKm) ||
      rates[rates.length - 1];
  
    const weightTier =
      WEIGHT_MULTIPLIERS.find((tier) => weight <= tier.maxKg) ||
      WEIGHT_MULTIPLIERS[0];
  
    let vehicleRequired = vehicle;
  
    if (weightTier.requiresPickup && vehicle === 'boda') {
      vehicleRequired = 'pickup';
    }
  
    if (weightTier.requiresLorry) {
      vehicleRequired = 'lorry';
    }
  
    const extrasMultiplier = extras.reduce(
      (total, key) => total + (HANDLING_EXTRAS[key]?.extra || 0),
      0
    );
  
    const totalFee = Math.max(
      0,
      Math.round(
        distanceTier.price *
        weightTier.mult *
        (1 + extrasMultiplier)
      )
    );
  
    const platformFee = Math.round(totalFee * 0.1);
    const riderEarns = totalFee - platformFee;
  
    return {
      baseFee: distanceTier.price,
      weightMultiplier: weightTier.mult,
      extrasMultiplier,
      totalFee,
      riderEarns,
      platformFee,
      vehicleRequired,
      breakdown: {
        distance: `${distance} km via ${vehicle}`,
        weight: `${weight} kg`,
        extras: extras
          .map((key) => HANDLING_EXTRAS[key]?.label)
          .filter(Boolean)
      }
    };
  }
  
  export function calculateOrderTotals({
    subtotal = 0,
    delivery = 0
  } = {}) {
    const value = Math.max(0, Number(subtotal) || 0);
  
    const deliveryFee = typeof delivery === 'object'
      ? Number(delivery.totalFee || 0)
      : Math.max(0, Number(delivery) || 0);
  
    const commission = calculateCommission(value);
  
    const riderGets = typeof delivery === 'object'
      ? Number(delivery.riderEarns || 0)
      : Math.round(deliveryFee * 0.9);
  
    return {
      subtotal: value,
      commission,
      deliveryFee,
      total: value + deliveryFee,
      sellerGets: sellerPayout(value),
      riderGets,
      platformGets: commission + Math.round(deliveryFee * 0.1)
    };
  }
  
  export function fmtKES(value) {
    return `KES ${Number(value || 0).toLocaleString('en-KE', {
      maximumFractionDigits: 0
    })}`;
  }
  
  export const ESCROW = Object.freeze({
    autoReleaseHours: 72,
    disputeWindowHours: 24,
    refundWindowDays: 7
  });