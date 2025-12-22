export function toRational(x) {
  if (!isFinite(x)) return { n: NaN, d: NaN };
  if (x === 0) return { n: 0, d: 1 };

  const sign = Math.sign(x);
  x = Math.abs(x);

  let m = Math.floor(x);
  if (x === m) return { n: sign * m, d: 1 };

  let x_ = 1 / (x - m);
  let p_ = 1, q_ = 0, p = m, q = 1;

  const MAX_ITERATIONS = 100;
  const MAX_DENOMINATOR = 1e15;
  let iterations = 0;

  while (Math.abs(x - p / q) > Number.EPSILON) {
    if (++iterations > MAX_ITERATIONS) {
      break;
    }

    if (!isFinite(x_) || x_ === 0) {
      break;
    }

    m = Math.floor(x_);
    x_ = 1 / (x_ - m);
    [p_, q_, p, q] = [p, q, m * p + p_, m * q + q_];

    if (q > MAX_DENOMINATOR || q > Number.MAX_SAFE_INTEGER) {
      break;
    }
  }

  return { n: sign * p, d: q };
}

export function toBigIntRational(x) {
  if (!isFinite(x)) {
    throw new Error('Cannot convert non-finite number to BigInt rational');
  }
  if (x === 0) return { n: 0n, d: 1n };

  const sign = Math.sign(x);
  x = Math.abs(x);

  let m = Math.floor(x);
  if (x === m) return { n: BigInt(sign * m), d: 1n };

  let x_ = 1 / (x - m);
  let p_ = 1n, q_ = 0n, p = BigInt(m), q = 1n;

  const MAX_ITERATIONS = 100;
  const MAX_DENOMINATOR = 10n ** 15n; // Limit denominator size
  let iterations = 0;

  while (Math.abs(x - Number(p) / Number(q)) > Number.EPSILON) {
    if (++iterations > MAX_ITERATIONS) {
      break; // Exit if too many iterations
    }

    if (!isFinite(x_) || x_ === 0) {
      break; // Exit if x_ is infinite, NaN, or zero
    }

    m = BigInt(Math.floor(x_));
    x_ = 1 / (x_ - Number(m));
    [p_, q_, p, q] = [p, q, m * p + p_, m * q + q_];

    if (q > MAX_DENOMINATOR) {
      break; // Exit if denominator grows too large
    }

    if (q > Number.MAX_SAFE_INTEGER) {
      break; // Exit if we've lost precision in the convergence check
    }
  }

  return { n: BigInt(sign) * p, d: q };
}


export function formatFullPrecision(value) {
  if (Math.abs(value) === Infinity) {
    return value > 0 ? '∞' : '-∞';
  }

  if (isNaN(value)) {
    return 'NaN';
  }

  if (value === 0) {
    return '0';
  }

  const absValue = Math.abs(value);

  if (absValue >= 1e15 || absValue <= 1e-15) {
    return value.toExponential(16);
  }

  return value.toFixed(17);
}

export function cleanTrailingZeros(str) {
  return str.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

export function formatDisplayNumber(value, precision = 17) {
  const formatted = value.toFixed(precision);
  return cleanTrailingZeros(formatted);
}

export function formatDifference(value) {
  const absValue = Math.abs(value);

  if (absValue < 1e-15) {
    return value.toExponential(16);
  } else if (absValue < 1e-10) {
    return value.toExponential(10);
  } else if (absValue < 0.0001) {
    return value.toExponential(6);
  }

  return formatFullPrecision(value);
}

export function highlightElement(element) {
  element.classList.remove('updated');
  void element.offsetWidth; // Trigger reflow
  element.classList.add('updated');
}