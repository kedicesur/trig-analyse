// Complex.js - Complex number class module

class Complex {
  constructor(real, imag = 0) {
    this.re = real;
    this.im = imag;
  }

  _ensureComplex(c) {
    if (c instanceof Complex) return c;
    if (typeof c === 'number') return new Complex(c, 0);
    throw new TypeError('Input must be a Complex number or a real number');
  }

  add(c) {
    c = this._ensureComplex(c);
    return new Complex(this.re + c.re, this.im + c.im);
  }

  subtract(c) {
    c = this._ensureComplex(c);
    return new Complex(this.re - c.re, this.im - c.im);
  }

  multiply(c) {
    c = this._ensureComplex(c);
    return new Complex(
      this.re * c.re - this.im * c.im,
      this.re * c.im + this.im * c.re
    );
  }

  divide(c) {
    c = this._ensureComplex(c);
    const denom = c.re * c.re + c.im * c.im;
    if (denom === 0) throw new Error('Division by zero');
    return new Complex(
      (this.re * c.re + this.im * c.im) / denom,
      (this.im * c.re - this.re * c.im) / denom
    );
  }

  magnitude() {
    return Math.hypot(this.re, this.im);
  }

  normalize() {
    const mag = this.magnitude();
    if (mag === 0) return Complex.ZERO;
    return new Complex(this.re / mag, this.im / mag);
  }

  /**
   * Returns the complex conjugate of this number.
   * @returns {Complex}
   */
  conjugate() {
    return new Complex(this.re, -this.im);
  }

  toString(precision = 17) {  // Changed from 15 to 17
    const sign = this.im < 0 ? '-' : '+';
    return `${this.re.toFixed(precision)} ${sign} ${Math.abs(this.im).toFixed(precision)}i`;
  }

  static get ONE() { return new Complex(1, 0); }
  static get ZERO() { return new Complex(0, 0); }
  static get I() { return new Complex(0, 1); }
}

export default Complex;