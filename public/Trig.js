import Complex from './Complex.js';
import { toRational } from './Utils.js';
import { multiplyRational } from './RationalBigInt.js';

export function generateCoefficients(n, k) {
  if (n === 1) {
    const hardcodedCoeffs = [
      new Complex(1n, 1n, 1n, 1n),
      new Complex(-2n, 1n, 1n, 1n),
      new Complex(1n, 1n, 3n, 1n),
      new Complex(-2n, 1n, 0n, 1n),
      new Complex(0n, 1n, -5n, 1n),
      new Complex(2n, 1n, 0n, 1n),
      new Complex(0n, 1n, 7n, 1n),
      new Complex(-2n, 1n, 0n, 1n),
      new Complex(0n, 1n, -9n, 1n),
      new Complex(2n, 1n, 0n, 1n),
      new Complex(0n, 1n, 11n, 1n),
      new Complex(-2n, 1n, 0n, 1n),
      new Complex(0n, 1n, -13n, 1n),
      new Complex(2n, 1n, 0n, 1n),
      new Complex(0n, 1n, 15n, 1n),
      new Complex(-2n, 1n, 0n, 1n),
      new Complex(0n, 1n, -17n, 1n),
      new Complex(2n, 1n, 0n, 1n),
      new Complex(0n, 1n, 19n, 1n),
      new Complex(-2n, 1n, 0n, 1n),
      new Complex(0n, 1n, -21n, 1n),
      new Complex(2n, 1n, 0n, 1n),
      new Complex(0n, 1n, 23n, 1n),
      new Complex(-2n, 1n, 0n, 1n),
    ];
    return hardcodedCoeffs.slice(0, k);
  }
  
  const coefficients = [];
  const nBig = BigInt(n);
  
  for (let c = 0; c < k; c++) {
    const cBig = BigInt(c);
    
    if (c === 0) {
      coefficients.push(new Complex(1n, 1n, 0n, 1n));
    } else if (c % 2 !== 0) {
      const power = (c + 1) / 2;
      const sign = (power % 2 === 0) ? 1n : -1n;
      const imagValue = sign * cBig * nBig;
      coefficients.push(new Complex(0n, 1n, imagValue, 1n));
    } else {
      const power = c / 2;
      const sign = (power % 2 === 0) ? 1n : -1n;
      const realValue = 2n * sign;
      coefficients.push(new Complex(realValue, 1n, 0n, 1n));
    }
  }
  
  return coefficients;
}


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
    
    const p_n = a.multiply(p_prev).add(p_prev_prev);
    
    const q_n = a.multiply(q_prev).add(q_prev_prev);

    const convergent = p_n.divide(q_n);
    convergents.push(convergent);


    if (mathLimitIndex === -1 && i < coefficients.length - 1) {
      const a_next = coefficients[i+1];
      
      const qn_mag_sq = q_n.magnitudeSquaredRational();
      
      const qn_mag_quat = multiplyRational(qn_mag_sq, qn_mag_sq);
      
      const anext_mag_sq = a_next.magnitudeSquaredRational();
      
      const product = multiplyRational(qn_mag_quat, anext_mag_sq);
      
      if (product.n > LIMIT * product.d) {
        mathLimitIndex = i;
      }
    }

    p_prev_prev = p_prev;
    p_prev = p_n;
    q_prev_prev = q_prev;
    q_prev = q_n;
  }

  return { convergents, mathLimitIndex };
}


function powComplexStable(base, exponent) {
  let exp = typeof exponent === 'bigint' ? exponent : BigInt(Math.abs(Math.round(exponent)));
  const isNegative = (typeof exponent === 'number' && exponent < 0);
  
  let result = Complex.ONE;
  let x = base;

  while (exp > 0n) {
    if (exp & 1n) {
      result = result.multiply(x);
      result = Complex.normalizeComplex(result);
    }
    x = x.multiply(x);
    x = Complex.normalizeComplex(x);
    exp >>= 1n;
  }
  
  return isNegative ? result.conjugate() : result;
}


export function expWithConvergents(angle, terms = 12, exactRational = null) {
  if (typeof angle !== 'number' || isNaN(angle)) {
    throw new TypeError('Angle must be a valid number.');
  }

  if (angle === 0) {
    return { 
        baseConvergents: [Complex.ONE], 
        finalConvergents: [Complex.ONE],
        mathLimitIndex: -1,
        iterationMetrics: {
          convergentIterations: 0,
          exponentIterations: 0,
          totalIterations: 0
        }
    };
  }

  let numerator, denominator;

  if (exactRational && exactRational.n !== undefined && exactRational.d !== undefined) {
    numerator = typeof exactRational.n === 'bigint' ? exactRational.n : BigInt(exactRational.n);
    denominator = typeof exactRational.d === 'bigint' ? exactRational.d : BigInt(exactRational.d);
  } else {
    const rational = toRational(angle);
    numerator = BigInt(rational.n);
    denominator = BigInt(rational.d);
  }
  
  const denominatorNum = Number(denominator);
  
  const coefficients = generateCoefficients(denominatorNum, terms);
  
  const { convergents: baseConvergents, mathLimitIndex } = computeAllConvergents(coefficients, numerator);
  
  const convergentIterations = mathLimitIndex >= 0 ? mathLimitIndex + 1 : baseConvergents.length;
  
  const absNumerator = numerator < 0n ? -numerator : numerator;
  const exponentIterations = absNumerator === 0n ? 0 : Math.ceil(Math.log2(Number(absNumerator)));
  
  const totalIterations = convergentIterations + exponentIterations;
  
  const finalConvergents = baseConvergents.map(conv => powComplexStable(conv, numerator));
  
  return { 
    baseConvergents, 
    finalConvergents, 
    mathLimitIndex,
    iterationMetrics: {
      convergentIterations,
      exponentIterations,
      totalIterations
    }
  };
}


export function exp(angle, terms = 12) {
  const { finalConvergents } = expWithConvergents(angle, terms);
  return finalConvergents[finalConvergents.length - 1];
}


export function cos(angle, terms = 12) {
  const result = exp(angle, terms);
  return result.toFloat().re;
}


export function sin(angle, terms = 12) {
  const result = exp(angle, terms);
  return result.toFloat().im;
}