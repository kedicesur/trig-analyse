
import Complex from './Complex.js';

function _powUnitComplex(base, exponent) {
  // PROPOSED FIX: Normalize base ONCE before the loop
  let currentBase = base.normalize();
  
  let result = Complex.ONE;
  let power = Math.abs(exponent);
  
  // Standard binary exponentiation without internal normalization
  while (power > 0) {
    if (power % 2 === 1) {
      result = result.multiply(currentBase);
      // We still normalize result to keep it clean, but arguably we could skip this too if base is perfect
      // But keeping result normalized is good practice and O(1) per set bit, not per loop
      result = result.normalize(); 
    }
    currentBase = currentBase.multiply(currentBase);
    // currentBase normalization is commented out as per user constraint
    // currentBase = currentBase.normalize();
    power >>= 1;
  }

  return exponent < 0 ? result.conjugate() : result;
}

const angle = 1000000;
// Simulate the first convergent for denominator 1: 1 + 1i
const c0 = new Complex(1, 1);

console.log(`Testing with base: ${c0.toString()} (Mag: ${c0.magnitude()})`);
console.log(`Exponent: ${angle}`);

try {
  const res = _powUnitComplex(c0, angle);
  console.log(`Result: ${res.toString()}`);
} catch (e) {
  console.error(e);
}
