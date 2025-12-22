
export const MAX_DEN = 10n ** 30n;

export function bigIntSqrt(value) {
  if (value < 0n) throw new Error('Square root of negative number');
  if (value < 2n) return value;
  
  let x = 1n << BigInt(Math.ceil(value.toString(2).length / 2));
  let y = (x + value / x) >> 1n;
  
  while (y < x) {
    x = y;
    y = (x + value / x) >> 1n;
  }
  return x;
}

export function gcd(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  
  while (b !== 0n) {
    [a, b] = [b, a % b];
  }
  
  return a;
}

export function normalizeRational({ n, d }) {
  if (d === 0n) {
    throw new Error('Division by zero: denominator cannot be zero');
  }
  
  if (n === 0n) {
    return { n: 0n, d: 1n };
  }
  
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

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

export function addRational(a, b) {
  const n = a.n * b.d + b.n * a.d;
  const d = a.d * b.d;
  return normalizeRational({ n, d });
}

export function subtractRational(a, b) {
  const n = a.n * b.d - b.n * a.d;
  const d = a.d * b.d;
  return normalizeRational({ n, d });
}

export function multiplyRational(a, b) {
  const n = a.n * b.n;
  const d = a.d * b.d;
  return normalizeRational({ n, d });
}

export function divideRational(a, b) {
  if (b.n === 0n) {
    throw new Error('Division by zero');
  }
  const n = a.n * b.d;
  const d = a.d * b.n;
  return normalizeRational({ n, d });
}

export function toFloating({ n, d }) {
  if (n === 0n) return 0;
  
  const nAbs = n < 0n ? -n : n;
  
  const nBits = nAbs.toString(2).length;
  const dBits = d.toString(2).length;
  const maxBits = Math.max(nBits, dBits);
  
  if (maxBits > 1000) {
    const shift = BigInt(maxBits - 500);
    return Number(n >> shift) / Number(d >> shift);
  }
  
  return Number(n) / Number(d);
}

export function fromFloating(x, maxDen = MAX_DEN) {
  if (!isFinite(x)) {
    throw new Error('Cannot convert non-finite number to rational');
  }
  
  if (x === 0) {
    return { n: 0n, d: 1n };
  }

  const sign = Math.sign(x);
  x = Math.abs(x);

  const scale = 1e15;
  const numerator = BigInt(Math.round(x * scale));
  const denominator = BigInt(Math.round(scale));
  
  const approx = approxFrac(numerator, denominator, maxDen);
  
  return {
    n: BigInt(sign) * approx.n,
    d: approx.d
  };
}

export function isZero({ n, d: _d }) {
  return n === 0n;
}

export function compareRational(a, b) {
  const diff = a.n * b.d - b.n * a.d;
  if (diff < 0n) return -1;
  if (diff > 0n) return 1;
  return 0;
}

export function fromInteger(n) {
  return { n, d: 1n };
}

export function negateRational({ n, d: _d }) {
  return { n: -n, d: _d };
}
