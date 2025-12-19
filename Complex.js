// Complex.js - Complex number class using rational BigInt arithmetic

import { 
  addRational, 
  subtractRational, 
  multiplyRational, 
  divideRational,
  toFloating,
  fromFloating,
  normalizeRational,
  approxFrac,
  isZero,
  bigIntSqrt,
  MAX_DEN
} from './RationalBigInt.js';

class Complex {
  /**
   * Create a complex number with rational BigInt components
   * @param {bigint} reN - Real part numerator
   * @param {bigint} reD - Real part denominator (default 1n)
   * @param {bigint} imN - Imaginary part numerator (default 0n)
   * @param {bigint} imD - Imaginary part denominator (default 1n)
   */
  constructor(reN, reD = 1n, imN = 0n, imD = 1n) {
    // Convert to BigInt if needed (for backward compatibility)
    if (typeof reN === 'number') reN = BigInt(Math.round(reN));
    if (typeof reD === 'number') reD = BigInt(Math.round(reD));
    if (typeof imN === 'number') imN = BigInt(Math.round(imN));
    if (typeof imD === 'number') imD = BigInt(Math.round(imD));
    
    this.re = normalizeRational({ n: reN, d: reD });
    this.im = normalizeRational({ n: imN, d: imD });
  }

  /**
   * Ensure input is a Complex number
   * @param {Complex|number} c - Input value
   * @returns {Complex} Complex number
   */
  _ensureComplex(c) {
    if (c instanceof Complex) return c;
    if (typeof c === 'number') {
      const rational = fromFloating(c);
      return new Complex(rational.n, rational.d, 0n, 1n);
    }
    throw new TypeError('Input must be a Complex number or a real number');
  }

  /**
   * Add two complex numbers
   * @param {Complex|number} c - Value to add
   * @returns {Complex} Sum
   */
  add(c) {
    c = this._ensureComplex(c);
    const newRe = addRational(this.re, c.re);
    const newIm = addRational(this.im, c.im);
    return new Complex(newRe.n, newRe.d, newIm.n, newIm.d);
  }

  /**
   * Subtract two complex numbers
   * @param {Complex|number} c - Value to subtract
   * @returns {Complex} Difference
   */
  subtract(c) {
    c = this._ensureComplex(c);
    const newRe = subtractRational(this.re, c.re);
    const newIm = subtractRational(this.im, c.im);
    return new Complex(newRe.n, newRe.d, newIm.n, newIm.d);
  }

  /**
   * Multiply two complex numbers with normalization
   * (a + bi)(c + di) = (ac - bd) + (ad + bc)i
   * @param {Complex|number} c - Value to multiply
   * @returns {Complex} Product
   */
  multiply(c) {
    c = this._ensureComplex(c);
    
    // ac - bd (real part)
    const ac = multiplyRational(this.re, c.re);
    const bd = multiplyRational(this.im, c.im);
    const realPart = subtractRational(ac, bd);
    
    // ad + bc (imaginary part)
    const ad = multiplyRational(this.re, c.im);
    const bc = multiplyRational(this.im, c.re);
    const imagPart = addRational(ad, bc);
    
    const result = new Complex(realPart.n, realPart.d, imagPart.n, imagPart.d);
    
    // Return without normalization - let caller decide when to normalize (e.g. in powComplexStable)
    return result;
  }

  /**
   * Divide two complex numbers
   * (a + bi) / (c + di) = [(a + bi)(c - di)] / (c² + d²)
   * @param {Complex|number} c - Divisor
   * @returns {Complex} Quotient
   */
  divide(c) {
    c = this._ensureComplex(c);
    
    // Calculate denominator: c² + d²
    const c_sq = multiplyRational(c.re, c.re);
    const d_sq = multiplyRational(c.im, c.im);
    const denom = addRational(c_sq, d_sq);
    
    if (isZero(denom)) {
      throw new Error('Division by zero');
    }
    
    // Multiply by conjugate: (a + bi)(c - di)
    const conjugate = new Complex(c.re.n, c.re.d, -c.im.n, c.im.d);
    const numerator = new Complex(this.re.n, this.re.d, this.im.n, this.im.d);
    
    // Don't normalize during intermediate multiply
    const ac = multiplyRational(numerator.re, conjugate.re);
    const bd = multiplyRational(numerator.im, conjugate.im);
    const realPart = subtractRational(ac, bd);
    
    const ad = multiplyRational(numerator.re, conjugate.im);
    const bc = multiplyRational(numerator.im, conjugate.re);
    const imagPart = addRational(ad, bc);
    
    // Divide both parts by denominator
    const finalRe = divideRational(realPart, denom);
    const finalIm = divideRational(imagPart, denom);
    
    const result = new Complex(finalRe.n, finalRe.d, finalIm.n, finalIm.d);
    
    // Return without automatic normalization
    return result;
  }

  /**
   * Calculate magnitude (convert to float for sqrt)
   * @returns {number} Magnitude
   */
  magnitude() {
    const re = toFloating(this.re);
    const im = toFloating(this.im);
    return Math.hypot(re, im);
  }

  /**
   * Normalize to unit magnitude with approximation
   * @returns {Complex} Normalized complex number
   */
  normalize() {
    const mag = this.magnitude();
    if (mag === 0) return Complex.ZERO;
    
    // Convert to float, normalize, then back to rational
    const re = toFloating(this.re) / mag;
    const im = toFloating(this.im) / mag;
    
    const reRational = fromFloating(re);
    const imRational = fromFloating(im);
    
    return new Complex(reRational.n, reRational.d, imRational.n, imRational.d);
  }

  /**
   * Complex conjugate (negate imaginary part)
   * @returns {Complex} Conjugate
   */
  conjugate() {
    return new Complex(this.re.n, this.re.d, -this.im.n, this.im.d);
  }

  /**
   * Convert to string representation with specified precision
   * @param {number} precision - Decimal places (default 17)
   * @returns {string} String representation
   */
  toString(precision = 17) {
    const re = toFloating(this.re);
    const im = toFloating(this.im);
    const sign = im < 0 ? '-' : '+';
    return `${re.toFixed(precision)} ${sign} ${Math.abs(im).toFixed(precision)}i`;
  }

  /**
   * Normalize a complex number to prevent denominator overflow
   * Uses purely rational arithmetic and BigInt square root for high precision.
   * @param {Complex} z - Complex number to normalize
   * @returns {Complex} Normalized complex number
   */
  static normalizeComplex(z) {
    if (isZero(z.re) && isZero(z.im)) return Complex.ZERO;

    // 1. Compute magnitude squared: magSq = x^2 + y^2 exactly as a rational N/D
    const xSq = multiplyRational(z.re, z.re);
    const ySq = multiplyRational(z.im, z.im);
    const magSq = addRational(xSq, ySq);
    
    if (magSq.n === 0n) return Complex.ZERO;

    // 2. We want to scale by 1/sqrt(magSq) = sqrt(D/N).
    // Use a large scale factor to maintain precision during BigInt square root.
    // Scale factor 10^60 gives ~60 digits of precision.
    const precisionScale = 10n ** 60n;
    const precisionScaleSq = precisionScale * precisionScale;
    
    // Target: S/precisionScale ≈ sqrt(D/N)
    // S^2 ≈ (D * precisionScale^2) / N
    const S2 = (magSq.d * precisionScaleSq) / magSq.n;
    const S = bigIntSqrt(S2);
    
    // 3. New components: x' = x * (S/precisionScale), y' = y * (S/precisionScale)
    // x' = (n_x/d_x) * (S/scale) = (n_x * S) / (d_x * scale)
    const newReN = z.re.n * S;
    const newReD = z.re.d * precisionScale;
    const newImN = z.im.n * S;
    const newImD = z.im.d * precisionScale;

    // Approximate to bounded denominator to keep calculations efficient
    const reApprox = approxFrac(newReN, newReD, MAX_DEN);
    const imApprox = approxFrac(newImN, newImD, MAX_DEN);

    return new Complex(reApprox.n, reApprox.d, imApprox.n, imApprox.d);
  }

  /**
   * Create a complex number from floating-point values
   * @param {number} real - Real part
   * @param {number} imag - Imaginary part (default 0)
   * @returns {Complex} Complex number
   */
  static fromFloat(real, imag = 0) {
    const reRational = fromFloating(real);
    const imRational = fromFloating(imag);
    return new Complex(reRational.n, reRational.d, imRational.n, imRational.d);
  }

  /**
   * Get complex number as floating-point object
   * @returns {{re: number, im: number}} Floating-point representation
   */
  toFloat() {
    return {
      re: toFloating(this.re),
      im: toFloating(this.im)
    };
  }

  // Static constants
  static get ONE() { 
    return new Complex(1n, 1n, 0n, 1n); 
  }
  
  static get ZERO() { 
    return new Complex(0n, 1n, 0n, 1n); 
  }
  
  static get I() { 
    return new Complex(0n, 1n, 1n, 1n); 
  }
}

export default Complex;