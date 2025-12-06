// Trig.js - Trigonometric functions using continued fractions

import Complex from './Complex.js';

/**
 * Convert a decimal number to a rational approximation
 * @private
 */
function _toRational(x) {
  if (!isFinite(x)) return { n: NaN, d: NaN };
  
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);

  let m = Math.floor(x);
  if (x === m) return { n: sign * m, d: 1 };

  let x_ = 1 / (x - m);
  let p_ = 1, q_ = 0, p = m, q = 1;

  while (Math.abs(x - p / q) > Number.EPSILON) {
    m = Math.floor(x_);
    x_ = 1 / (x_ - m);
    [p_, q_, p, q] = [p, q, m * p + p_, m * q + q_];
  }
  return { n: sign * p, d: q };
}

/**
 * Generates the first k CSCF coefficients for e^(i*1/n) where n > 1.
 * @param {number} n - Denominator
 * @param {number} k - Number of coefficients to generate
 * @returns {Complex[]} Array of coefficients
 */
export function generateCoefficients(n, k) {
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

/**
 * Calculates e^(i/n) by finding its convergent.
 * @private
 */
function _getBaseUnit(n, terms) {
  if (n === 1) {
    return new Complex(0.5403023058681398, 0.8414709848078965);
  }

  const coefficients = generateCoefficients(n, terms);
  const convergents = computeAllConvergents(coefficients);
  return convergents[convergents.length - 1];
}

function _powUnitComplex(base, exponent) {
  let result = Complex.ONE;
  let currentBase = base;
  let power = Math.abs(exponent);

  while (power > 0) {
    if (power % 2 === 1) {
      result = result.multiply(currentBase);
      result = result.normalize();
    }
    currentBase = currentBase.multiply(currentBase);
    currentBase = currentBase.normalize();
    power = Math.floor(power / 2);
  }

  return exponent < 0 ? result.conjugate() : result;
}

/**
 * Main function to calculate e^(i*angle) using continued fractions
 * Returns all convergents (approximations) at each step
 * @param {number} angle - Angle in radians
 * @param {number} terms - Number of terms to use
 * @returns {Complex[]} Array of convergents
 */
export function expWithConvergents(angle, terms = 12) {
  if (typeof angle !== 'number' || isNaN(angle)) {
    throw new TypeError('Angle must be a valid number.');
  }

  if (angle === 0) {
    return [Complex.ONE];
  }

  const { n: numerator, d: denominator } = _toRational(angle);
  
  // Generate coefficients for the denominator
  const coefficients = generateCoefficients(denominator, terms);
  
  // Get all convergents for e^(i/denominator)
  const baseConvergents = computeAllConvergents(coefficients);
  
  // Raise each convergent to the numerator to get approximations for e^(i * numerator/denominator)
  const finalConvergents = baseConvergents.map(conv => _powUnitComplex(conv, numerator));
  
  return finalConvergents;
}

/**
 * Simplified exp function for general use
 * @param {number} angle - Angle in radians
 * @param {number} terms - Number of terms
 * @returns {Complex} e^(i*angle)
 */
export function exp(angle, terms = 12) {
  const convergents = expWithConvergents(angle, terms);
  return convergents[convergents.length - 1];
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