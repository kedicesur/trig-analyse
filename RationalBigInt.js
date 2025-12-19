// RationalBigInt.js - Rational number arithmetic using BigInt

// Maximum denominator for fraction approximation (stability vs precision knob)
// Increasing to 10^30 to allow for much higher precision calculations
export const MAX_DEN = 10n ** 30n;

/**
 * Compute integer square root of a BigInt using Newton's method
 * @param {bigint} value - Non-negative BigInt
 * @returns {bigint} Integer square root
 */
export function bigIntSqrt(value) {
  if (value < 0n) throw new Error('Square root of negative number');
  if (value < 2n) return value;
  
  // Initial guess: roughly 2^(bits/2)
  let x = 1n << BigInt(Math.ceil(value.toString(2).length / 2));
  let y = (x + value / x) >> 1n;
  
  while (y < x) {
    x = y;
    y = (x + value / x) >> 1n;
  }
  return x;
}

/**
 * Compute greatest common divisor using Euclidean algorithm
 * @param {bigint} a - First number
 * @param {bigint} b - Second number
 * @returns {bigint} GCD of a and b
 */
export function gcd(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  
  while (b !== 0n) {
    [a, b] = [b, a % b];
  }
  
  return a;
}

/**
 * Normalize a rational number to lowest terms with positive denominator
 * @param {{n: bigint, d: bigint}} rational - Rational number
 * @returns {{n: bigint, d: bigint}} Normalized rational
 */
export function normalizeRational({ n, d }) {
  if (d === 0n) {
    throw new Error('Division by zero: denominator cannot be zero');
  }
  
  if (n === 0n) {
    return { n: 0n, d: 1n };
  }
  
  // Ensure denominator is positive
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  
  // Reduce to lowest terms
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

/**
 * Approximate a fraction with bounded denominator using continued fractions
 * Based on the algorithm from your reference implementation
 * @param {bigint} num - Numerator
 * @param {bigint} den - Denominator
 * @param {bigint} maxDen - Maximum allowed denominator
 * @returns {{n: bigint, d: bigint}} Approximated rational
 */
export function approxFrac(num, den, maxDen) {
  let a = num;
  let b = den;
  let p0 = 0n, q0 = 1n;
  let p1 = 1n, q1 = 0n;

  while (b !== 0n) {
    const k = a / b;
    const p2 = k * p1 + p0;
    const q2 = k * q1 + q0;

    if (q2 > maxDen) break;

    [p0, q0, p1, q1] = [p1, q1, p2, q2];
    [a, b] = [b, a % b];
  }

  return { n: p1, d: q1 };
}

/**
 * Add two rational numbers
 * @param {{n: bigint, d: bigint}} a - First rational
 * @param {{n: bigint, d: bigint}} b - Second rational
 * @returns {{n: bigint, d: bigint}} Sum
 */
export function addRational(a, b) {
  const n = a.n * b.d + b.n * a.d;
  const d = a.d * b.d;
  return normalizeRational({ n, d });
}

/**
 * Subtract two rational numbers
 * @param {{n: bigint, d: bigint}} a - First rational
 * @param {{n: bigint, d: bigint}} b - Second rational
 * @returns {{n: bigint, d: bigint}} Difference
 */
export function subtractRational(a, b) {
  const n = a.n * b.d - b.n * a.d;
  const d = a.d * b.d;
  return normalizeRational({ n, d });
}

/**
 * Multiply two rational numbers
 * @param {{n: bigint, d: bigint}} a - First rational
 * @param {{n: bigint, d: bigint}} b - Second rational
 * @returns {{n: bigint, d: bigint}} Product
 */
export function multiplyRational(a, b) {
  const n = a.n * b.n;
  const d = a.d * b.d;
  return normalizeRational({ n, d });
}

/**
 * Divide two rational numbers
 * @param {{n: bigint, d: bigint}} a - Numerator rational
 * @param {{n: bigint, d: bigint}} b - Denominator rational
 * @returns {{n: bigint, d: bigint}} Quotient
 */
export function divideRational(a, b) {
  if (b.n === 0n) {
    throw new Error('Division by zero');
  }
  const n = a.n * b.d;
  const d = a.d * b.n;
  return normalizeRational({ n, d });
}

/**
 * Convert rational to floating-point number
 * @param {{n: bigint, d: bigint}} rational - Rational number
 * @returns {number} Floating-point approximation
 */
export function toFloating({ n, d }) {
  if (n === 0n) return 0;
  
  // If either n or d is very large, scale them down to prevent Infinity
  // Number.MAX_VALUE is ~1.8e308, which is roughly 2^1024.
  // We use 500 bits as a safe ceiling to avoid overflow during conversion.
  const nAbs = n < 0n ? -n : n;
  
  // Custom bitLength estimate if not available, but V8 supports it.
  // For safety and compatibility, we can use a simple check.
  const nBits = nAbs.toString(2).length;
  const dBits = d.toString(2).length;
  const maxBits = Math.max(nBits, dBits);
  
  if (maxBits > 1000) {
    const shift = BigInt(maxBits - 500);
    return Number(n >> shift) / Number(d >> shift);
  }
  
  return Number(n) / Number(d);
}

/**
 * Convert floating-point to rational BigInt with normalization
 * @param {number} x - Floating-point number
 * @param {bigint} [maxDen=MAX_DEN] - Maximum denominator
 * @returns {{n: bigint, d: bigint}} Rational approximation
 */
export function fromFloating(x, maxDen = MAX_DEN) {
  if (!isFinite(x)) {
    throw new Error('Cannot convert non-finite number to rational');
  }
  
  if (x === 0) {
    return { n: 0n, d: 1n };
  }

  const sign = Math.sign(x);
  x = Math.abs(x);

  // Scale up to capture precision, then use approxFrac
  const scale = 1e15;
  const numerator = BigInt(Math.round(x * scale));
  const denominator = BigInt(Math.round(scale));
  
  const approx = approxFrac(numerator, denominator, maxDen);
  
  return {
    n: BigInt(sign) * approx.n,
    d: approx.d
  };
}

/**
 * Check if rational equals zero
 * @param {{n: bigint, d: bigint}} rational - Rational number
 * @returns {boolean} True if zero
 */
export function isZero({ n, d: _d }) {
  return n === 0n;
}

/**
 * Compare two rational numbers
 * @param {{n: bigint, d: bigint}} a - First rational
 * @param {{n: bigint, d: bigint}} b - Second rational
 * @returns {number} -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareRational(a, b) {
  const diff = a.n * b.d - b.n * a.d;
  if (diff < 0n) return -1;
  if (diff > 0n) return 1;
  return 0;
}

/**
 * Create a rational from an integer
 * @param {bigint} n - Integer value
 * @returns {{n: bigint, d: bigint}} Rational representation
 */
export function fromInteger(n) {
  return { n, d: 1n };
}

/**
 * Negate a rational number
 * @param {{n: bigint, d: bigint}} rational - Rational number
 * @returns {{n: bigint, d: bigint}} Negated rational
 */
export function negateRational({ n, d: _d }) {
  return { n: -n, d: _d };
}
