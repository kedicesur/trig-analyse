/**
 * Convert a decimal number to a rational approximation
 * @param {number} x - Decimal number to convert
 * @returns {{n: number, d: number}} Object with numerator and denominator
 */
export function toRational(x) {
  if (!isFinite(x)) return { n: NaN, d: NaN };
  if (x === 0) return { n: 0, d: 1 };

  const sign = Math.sign(x);
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
 * Format a number to full double precision (17 digits)
 * @param {number} value - Value to format
 * @returns {string} Formatted string
 */
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

/**
 * Clean trailing zeros from a number string
 * @param {string} str - String to clean
 * @returns {string} Cleaned string
 */
export function cleanTrailingZeros(str) {
  return str.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

/**
 * Format a number for display with precision
 * @param {number} value - Value to format
 * @param {number} precision - Decimal places (default 17)
 * @returns {string} Formatted string
 */
export function formatDisplayNumber(value, precision = 17) {
  const formatted = value.toFixed(precision);
  return cleanTrailingZeros(formatted);
}

/**
 * Format difference values (use scientific notation for very small values)
 * @param {number} value - Difference value
 * @returns {string} Formatted string
 */
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

/**
 * Trigger highlight animation on an element
 * @param {HTMLElement} element - Element to highlight
 */
export function highlightElement(element) {
  element.classList.remove('updated');
  void element.offsetWidth; // Trigger reflow
  element.classList.add('updated');
}