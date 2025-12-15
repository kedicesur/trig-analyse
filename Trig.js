// Trig.js - Trigonometric functions using continued fractions

import Complex from './Complex.js';
import { toRational } from './Utils.js';

/**
 * Generates the first k CSCF coefficients for e^(i*1/n) where n > 1.
 * @param {number} n - Denominator
 * @param {number} k - Number of coefficients to generate
 * @returns {Complex[]} Array of coefficients
 */
export function generateCoefficients(n, k) {
  if (n === 1) return [ new Complex(1, 1)
                      , new Complex(-2, 1)
                      , new Complex(1, 3)
                      , new Complex(-2, 0)
                      , new Complex(0, -5)
                      , new Complex(2, 0)
                      , new Complex(0, 7)
                      , new Complex(-2, 0)
                      , new Complex(0, -9)
                      , new Complex(2, 0)
                      , new Complex(0, 11)
                      , new Complex(-2, 0)
                      , new Complex(0, -13)
                      , new Complex(2, 0)
                      , new Complex(0, 15)
                      , new Complex(-2, 0)
                      , new Complex(0, -17)
                      , new Complex(2, 0)
                      , new Complex(0, 19)
                      , new Complex(-2, 0)
                      , new Complex(0, -21)
                      , new Complex(2, 0)
                      , new Complex(0, 23)
                      , new Complex(-2, 0)
                      ].slice(0,k);
  const coefficients = [];
  for (let c = 0; c < k; c++) {
    let re = 0, im = 0;

    if (c === 0) {
      re = 1;
      im = 0;
    } else if (c % 2 !== 0) { // Odd index
      re = 0;
      im = c * n * Math.pow(-1, (c + 1) / 2);
    } else { // Even index
      re = 2 * Math.pow(-1, c / 2);
      im = 0;
    }
    coefficients.push(new Complex(re, im));
  }
  return coefficients;
}

/**
 * Computes ALL convergents (not just the final one) for given coefficients.
 * @param {Complex[]} coefficients - Array of coefficients
 * @returns {Complex[]} Array of convergents at each step
 */
export function computeAllConvergents(coefficients) {
  const convergents = [];
  
  if (coefficients.length === 0) return convergents;
  
  if (coefficients.length === 1) {
    convergents.push(coefficients[0]);
    return convergents;
  }

  let p_prev_prev = Complex.ZERO;
  let p_prev = Complex.ONE;
  let q_prev_prev = Complex.ONE;
  let q_prev = Complex.ZERO;

  for (let i = 0; i < coefficients.length; i++) {
    const a = coefficients[i];
    const p_n = a.multiply(p_prev).add(p_prev_prev);
    const q_n = a.multiply(q_prev).add(q_prev_prev);

    // Store the convergent at this step
    convergents.push(p_n.divide(q_n));

    // Update for next iteration
    p_prev_prev = p_prev;
    p_prev = p_n;
    q_prev_prev = q_prev;
    q_prev = q_n;
  }

  return convergents;
}

function _powUnitComplex(base, exponent) {
  // Normalize base once before exponentiation loops to prevent overflow
  // This handles cases where the base convergent magnitude > 1 (e.g. 1+1i for q=1)
  // let currentBase = base.normalize();
  
  let result = Complex.ONE;
  let power = Math.abs(exponent);

  while (power > 0) {
    if (power % 2 === 1) {
      result = result.multiply(base);
      //dont use excess normalization here
      //result = result.normalize();
    }
      base = base.multiply(base);
      //dont use excess normalization here
      //currentBase = currentBase.normalize();
      power >>= 1;
  }

  return exponent < 0 ? result.normalize().conjugate() : result.normalize();
}

/**
 * Main function to calculate e^(i*angle) using continued fractions
 * Returns both base and final convergents
 * @param {number} angle - Angle in radians
 * @param {number} terms - Number of terms to use
 * @param {Object} [exactRational] - Optional {n, d} object to bypass toRational
 * @returns {Object} { baseConvergents: Complex[], finalConvergents: Complex[] }
 */
export function expWithConvergents(angle, terms = 12, exactRational = null) {
  if (typeof angle !== 'number' || isNaN(angle)) {
    throw new TypeError('Angle must be a valid number.');
  }

  if (angle === 0) {
    return { 
        baseConvergents: [Complex.ONE], 
        finalConvergents: [Complex.ONE] 
    };
  }

  let numerator, denominator;

  // Use exact rational if provided and valid
  if (exactRational && typeof exactRational.n === 'number' && typeof exactRational.d === 'number') {
    numerator = exactRational.n;
    denominator = exactRational.d;
  } else {
    // Otherwise fall back to converting the float
    const rational = toRational(angle);
    numerator = rational.n;
    denominator = rational.d;
  }
  
  // Generate coefficients for the denominator
  const coefficients = generateCoefficients(denominator, terms);
  
  // Get all convergents for e^(i/denominator)
  const baseConvergents = computeAllConvergents(coefficients);
  
  // Raise each convergent to the numerator to get approximations for e^(i * numerator/denominator)
  const finalConvergents = baseConvergents.map(conv => _powUnitComplex(conv, numerator));
  
  return { baseConvergents, finalConvergents };
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
  return exp(angle, terms).re;
}

/**
 * Sine function using continued fractions
 * @param {number} angle - Angle in radians
 * @param {number} terms - Number of terms
 * @returns {number} Sine of the angle
 */
export function sin(angle, terms = 12) {
  return exp(angle, terms).im;
}