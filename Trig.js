// Trig.js - Trigonometric functions using continued fractions with BigInt rationals

import Complex from './Complex.js';
import { toRational } from './Utils.js';
import { addRational, multiplyRational } from './RationalBigInt.js';

/**
 * Generates the first k CSCF coefficients for e^(i*1/n) where n > 1.
 * Now returns Complex numbers with BigInt rational components
 * @param {number} n - Denominator
 * @param {number} k - Number of coefficients to generate
 * @returns {Complex[]} Array of coefficients
 */
export function generateCoefficients(n, k) {
  if (n === 1) {
    // Special case for n=1, hardcoded coefficients
    const hardcodedCoeffs = [
      new Complex(1n, 1n, 1n, 1n),      // 1 + 1i
      new Complex(-2n, 1n, 1n, 1n),     // -2 + 1i
      new Complex(1n, 1n, 3n, 1n),      // 1 + 3i
      new Complex(-2n, 1n, 0n, 1n),     // -2 + 0i
      new Complex(0n, 1n, -5n, 1n),     // 0 - 5i
      new Complex(2n, 1n, 0n, 1n),      // 2 + 0i
      new Complex(0n, 1n, 7n, 1n),      // 0 + 7i
      new Complex(-2n, 1n, 0n, 1n),     // -2 + 0i
      new Complex(0n, 1n, -9n, 1n),     // 0 - 9i
      new Complex(2n, 1n, 0n, 1n),      // 2 + 0i
      new Complex(0n, 1n, 11n, 1n),     // 0 + 11i
      new Complex(-2n, 1n, 0n, 1n),     // -2 + 0i
      new Complex(0n, 1n, -13n, 1n),    // 0 - 13i
      new Complex(2n, 1n, 0n, 1n),      // 2 + 0i
      new Complex(0n, 1n, 15n, 1n),     // 0 + 15i
      new Complex(-2n, 1n, 0n, 1n),     // -2 + 0i
      new Complex(0n, 1n, -17n, 1n),    // 0 - 17i
      new Complex(2n, 1n, 0n, 1n),      // 2 + 0i
      new Complex(0n, 1n, 19n, 1n),     // 0 + 19i
      new Complex(-2n, 1n, 0n, 1n),     // -2 + 0i
      new Complex(0n, 1n, -21n, 1n),    // 0 - 21i
      new Complex(2n, 1n, 0n, 1n),      // 2 + 0i
      new Complex(0n, 1n, 23n, 1n),     // 0 + 23i
      new Complex(-2n, 1n, 0n, 1n),     // -2 + 0i
    ];
    return hardcodedCoeffs.slice(0, k);
  }
  
  const coefficients = [];
  const nBig = BigInt(n);
  
  for (let c = 0; c < k; c++) {
    const cBig = BigInt(c);
    
    if (c === 0) {
      // First coefficient: 1 + 0i
      coefficients.push(new Complex(1n, 1n, 0n, 1n));
    } else if (c % 2 !== 0) {
      // Odd index: 0 + (c * n * (-1)^((c+1)/2))i
      const power = (c + 1) / 2;
      const sign = (power % 2 === 0) ? 1n : -1n;
      const imagValue = sign * cBig * nBig;
      coefficients.push(new Complex(0n, 1n, imagValue, 1n));
    } else {
      // Even index: (2 * (-1)^(c/2)) + 0i
      const power = c / 2;
      const sign = (power % 2 === 0) ? 1n : -1n;
      const realValue = 2n * sign;
      coefficients.push(new Complex(realValue, 1n, 0n, 1n));
    }
  }
  
  return coefficients;
}

/**
 * Computes ALL convergents (not just the final one) for given coefficients.
 * Uses rational BigInt arithmetic throughout
 * Includes mathematical stopping criterion: |q_n|^4 * |a_{n+1}|^2 > |n|^2 * 2^106
 * @param {Complex[]} coefficients - Array of coefficients
 * @param {bigint} numerator - The numerator of the rational angle (to account for error magnification)
 * @returns {Object} { convergents: Complex[], mathLimitIndex: number }
 */
export function computeAllConvergents(coefficients, numerator = 1n) {
  const convergents = [];
  let mathLimitIndex = -1;
  const nAbs = numerator < 0n ? -numerator : numerator;
  const nSq = nAbs * nAbs;
  const baseLimit = 2n ** 106n; 
  const LIMIT = nSq > 0n ? baseLimit * nSq : baseLimit;
  
  if (coefficients.length === 0) return { convergents, mathLimitIndex };
  
  if (coefficients.length === 1) {
    convergents.push(coefficients[0]);
    return { convergents, mathLimitIndex };
  }

  let p_prev_prev = Complex.ZERO;
  let p_prev = Complex.ONE;
  let q_prev_prev = Complex.ONE;
  let q_prev = Complex.ZERO;

  for (let i = 0; i < coefficients.length; i++) {
    const a = coefficients[i];
    
    // p_n = a * p_prev + p_prev_prev
    const p_n = a.multiply(p_prev).add(p_prev_prev);
    
    // q_n = a * q_prev + q_prev_prev
    const q_n = a.multiply(q_prev).add(q_prev_prev);

    // convergent = p_n / q_n
    const convergent = p_n.divide(q_n);
    convergents.push(convergent);

    // Check mathematical stopping criterion
    // |q_n|^4 * |a_{n+1}|^2 > 2^106
    if (mathLimitIndex === -1 && i < coefficients.length - 1) {
      const a_next = coefficients[i+1];
      
      // |q_n|^2 = q_n.re^2 + q_n.im^2
      const qn_re_sq = multiplyRational(q_n.re, q_n.re);
      const qn_im_sq = multiplyRational(q_n.im, q_n.im);
      const qn_mag_sq = addRational(qn_re_sq, qn_im_sq);
      
      // |q_n|^4 = qn_mag_sq * qn_mag_sq
      const qn_mag_quat = multiplyRational(qn_mag_sq, qn_mag_sq);
      
      // |a_{n+1}|^2 = a_next.re^2 + a_next.im^2
      const anext_re_sq = multiplyRational(a_next.re, a_next.re);
      const anext_im_sq = multiplyRational(a_next.im, a_next.im);
      const anext_mag_sq = addRational(anext_re_sq, anext_im_sq);
      
      // |q_n|^4 * |a_{n+1}|^2
      const product = multiplyRational(qn_mag_quat, anext_mag_sq);
      
      // Compare with LIMIT
      // product.n / product.d > LIMIT  => product.n > LIMIT * product.d
      if (product.n > LIMIT * product.d) {
        mathLimitIndex = i;
      }
    }

    // Update for next iteration
    p_prev_prev = p_prev;
    p_prev = p_n;
    q_prev_prev = q_prev;
    q_prev = q_n;
  }

  return { convergents, mathLimitIndex };
}

/**
 * Stable complex exponentiation using binary exponentiation with normalization
 * Based on your reference implementation (powComplexStable)
 * @param {Complex} base - Base complex number
 * @param {bigint|number} exponent - Exponent (will be converted to BigInt)
 * @returns {Complex} base^exponent
 */
function powComplexStable(base, exponent) {
  // Convert exponent to BigInt if needed
  let exp = typeof exponent === 'bigint' ? exponent : BigInt(Math.abs(Math.round(exponent)));
  const isNegative = (typeof exponent === 'number' && exponent < 0);
  
  let result = Complex.ONE;
  let x = base;

  while (exp > 0n) {
    if (exp & 1n) {
      result = result.multiply(x);
      // Normalize EVERY iteration using the now-safe normalizeComplex
      result = Complex.normalizeComplex(result);
    }
    x = x.multiply(x);
    // Normalize x EVERY iteration - absolute necessity to prevent digit explosion
    x = Complex.normalizeComplex(x);
    exp >>= 1n;
  }
  
  // Handle negative exponent by taking conjugate (for unit complex)
  return isNegative ? result.conjugate() : result;
}

/**
 * Main function to calculate e^(i*angle) using continued fractions
 * Returns both base and final convergents
 * @param {number} angle - Angle in radians
 * @param {number} terms - Number of terms to use
 * @param {Object} [exactRational] - Optional {n, d} object with BigInt values
 * @returns {Object} { baseConvergents: Complex[], finalConvergents: Complex[], mathLimitIndex: number }
 */
export function expWithConvergents(angle, terms = 12, exactRational = null) {
  if (typeof angle !== 'number' || isNaN(angle)) {
    throw new TypeError('Angle must be a valid number.');
  }

  if (angle === 0) {
    return { 
        baseConvergents: [Complex.ONE], 
        finalConvergents: [Complex.ONE],
        mathLimitIndex: -1
    };
  }

  let numerator, denominator;

  // Use exact rational if provided
  if (exactRational && exactRational.n !== undefined && exactRational.d !== undefined) {
    // Convert to BigInt if not already
    numerator = typeof exactRational.n === 'bigint' ? exactRational.n : BigInt(exactRational.n);
    denominator = typeof exactRational.d === 'bigint' ? exactRational.d : BigInt(exactRational.d);
  } else {
    // Otherwise fall back to converting the float
    const rational = toRational(angle);
    numerator = BigInt(rational.n);
    denominator = BigInt(rational.d);
  }
  
  // Convert denominator to number for coefficient generation
  // This is safe because toRational produces reasonable denominators
  const denominatorNum = Number(denominator);
  
  // Generate coefficients for the denominator
  const coefficients = generateCoefficients(denominatorNum, terms);
  
  // Get all convergents for e^(i/denominator)
  const { convergents: baseConvergents, mathLimitIndex } = computeAllConvergents(coefficients, numerator);
  
  // Raise each convergent to the numerator to get approximations for e^(i * numerator/denominator)
  const finalConvergents = baseConvergents.map(conv => powComplexStable(conv, numerator));
  
  return { baseConvergents, finalConvergents, mathLimitIndex };
}

/**
 * Simplified exp function for general use
 * @param {number} angle - Angle in radians
 * @param {number} terms - Number of terms
 * @returns {Complex} e^(i*angle)
 */
export function exp(angle, terms = 12) {
  const { finalConvergents } = expWithConvergents(angle, terms);
  return finalConvergents[finalConvergents.length - 1];
}

/**
 * Cosine function using continued fractions
 * @param {number} angle - Angle in radians
 * @param {number} terms - Number of terms
 * @returns {number} Cosine of the angle
 */
export function cos(angle, terms = 12) {
  const result = exp(angle, terms);
  return result.toFloat().re;
}

/**
 * Sine function using continued fractions
 * @param {number} angle - Angle in radians
 * @param {number} terms - Number of terms
 * @returns {number} Sine of the angle
 */
export function sin(angle, terms = 12) {
  const result = exp(angle, terms);
  return result.toFloat().im;
}