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
  constructor(reN, reD = 1n, imN = 0n, imD = 1n) {
    if (typeof reN === 'number') reN = BigInt(Math.round(reN));
    if (typeof reD === 'number') reD = BigInt(Math.round(reD));
    if (typeof imN === 'number') imN = BigInt(Math.round(imN));
    if (typeof imD === 'number') imD = BigInt(Math.round(imD));
    
    this.re = normalizeRational({ n: reN, d: reD });
    this.im = normalizeRational({ n: imN, d: imD });
  }

  _ensureComplex(c) {
    if (c instanceof Complex) return c;
    if (typeof c === 'number') {
      const rational = fromFloating(c);
      return new Complex(rational.n, rational.d, 0n, 1n);
    }
    throw new TypeError('Input must be a Complex number or a real number');
  }

  add(c) {
    c = this._ensureComplex(c);
    const newRe = addRational(this.re, c.re);
    const newIm = addRational(this.im, c.im);
    return new Complex(newRe.n, newRe.d, newIm.n, newIm.d);
  }

  subtract(c) {
    c = this._ensureComplex(c);
    const newRe = subtractRational(this.re, c.re);
    const newIm = subtractRational(this.im, c.im);
    return new Complex(newRe.n, newRe.d, newIm.n, newIm.d);
  }

  multiply(c) {
    c = this._ensureComplex(c);
    
    const ac = multiplyRational(this.re, c.re);
    const bd = multiplyRational(this.im, c.im);
    const realPart = subtractRational(ac, bd);
    
    const ad = multiplyRational(this.re, c.im);
    const bc = multiplyRational(this.im, c.re);
    const imagPart = addRational(ad, bc);
    
    const result = new Complex(realPart.n, realPart.d, imagPart.n, imagPart.d);
    
    return result;
  }

  divide(c) {
    c = this._ensureComplex(c);
    
    const c_sq = multiplyRational(c.re, c.re);
    const d_sq = multiplyRational(c.im, c.im);
    const denom = addRational(c_sq, d_sq);
    
    if (isZero(denom)) {
      throw new Error('Division by zero');
    }
    
    const conjugate = new Complex(c.re.n, c.re.d, -c.im.n, c.im.d);
    const numerator = new Complex(this.re.n, this.re.d, this.im.n, this.im.d);
    
    const ac = multiplyRational(numerator.re, conjugate.re);
    const bd = multiplyRational(numerator.im, conjugate.im);
    const realPart = subtractRational(ac, bd);
    
    const ad = multiplyRational(numerator.re, conjugate.im);
    const bc = multiplyRational(numerator.im, conjugate.re);
    const imagPart = addRational(ad, bc);
    
    const finalRe = divideRational(realPart, denom);
    const finalIm = divideRational(imagPart, denom);
    
    const result = new Complex(finalRe.n, finalRe.d, finalIm.n, finalIm.d);
    
    return result;
  }

  magnitudeSquaredRational() {
    const reSq = multiplyRational(this.re, this.re);
    const imSq = multiplyRational(this.im, this.im);
    return addRational(reSq, imSq);
  }

  magnitude() {
    const re = toFloating(this.re);
    const im = toFloating(this.im);
    return Math.hypot(re, im);
  }

  normalize() {
    const mag = this.magnitude();
    if (mag === 0) return Complex.ZERO;
    const re = toFloating(this.re) / mag;
    const im = toFloating(this.im) / mag;
    
    const reRational = fromFloating(re);
    const imRational = fromFloating(im);
    
    return new Complex(reRational.n, reRational.d, imRational.n, imRational.d);
  }

  conjugate() {
    return new Complex(this.re.n, this.re.d, -this.im.n, this.im.d);
  }

  toString(precision = 17) {
    const re = toFloating(this.re);
    const im = toFloating(this.im);
    const sign = im < 0 ? '-' : '+';
    return `${re.toFixed(precision)} ${sign} ${Math.abs(im).toFixed(precision)}i`;
  }

  static normalizeComplex(z) {
    if (isZero(z.re) && isZero(z.im)) return Complex.ZERO;

    const xSq = multiplyRational(z.re, z.re);
    const ySq = multiplyRational(z.im, z.im);
    const magSq = addRational(xSq, ySq);
    
    if (magSq.n === 0n) return Complex.ZERO;

    const precisionScale = 10n ** 60n;
    const precisionScaleSq = precisionScale * precisionScale;
    
    const S2 = (magSq.d * precisionScaleSq) / magSq.n;
    const S = bigIntSqrt(S2);
    
    const newReN = z.re.n * S;
    const newReD = z.re.d * precisionScale;
    const newImN = z.im.n * S;
    const newImD = z.im.d * precisionScale;

    const reApprox = approxFrac(newReN, newReD, MAX_DEN);
    const imApprox = approxFrac(newImN, newImD, MAX_DEN);

    return new Complex(reApprox.n, reApprox.d, imApprox.n, imApprox.d);
  }

  static fromFloat(real, imag = 0) {
    const reRational = fromFloating(real);
    const imRational = fromFloating(imag);
    return new Complex(reRational.n, reRational.d, imRational.n, imRational.d);
  }

  toFloat() {
    return {
      re: toFloating(this.re),
      im: toFloating(this.im)
    };
  }

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