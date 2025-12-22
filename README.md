# Complex Continued Fraction Convergent Visualizer for Trigonometric Computation

A novel interactive web application that visualizes the continued fraction method for computing trigonometric functions (`cos`, `sin`, `tan`) using complex number theory and exact rational arithmetic with BigInt precision.

## Overview

This project implements and visualizes a sophisticated mathematical approach to trigonometric computation using **continued fractions of complex numbers**. Rather than relying on standard floating-point approximations, it builds convergents (rational approximations) in the complex plane that converge toward the true value of $e^{i\theta}$, where $\theta$ is any input angle.

### Why This Matters

Traditional approaches compute `cos(θ)` and `sin(θ)` using:
- **Hardware implementations** (fast but limited precision)
- **Taylor series** (accurate but requires many terms)
- **CORDIC algorithms** (efficient but still floating-point based)

This project demonstrates an alternative: using **continued fractions with structured patterns** to generate convergents that approach $e^{i\theta}$ with configurable precision and exact rational arithmetic throughout.

## Key Features

### 1. **Exact Rational Arithmetic**
- All intermediate calculations use **BigInt rational numbers** (numerator/denominator pairs)
- No floating-point rounding errors accumulate
- Full precision preserved until final conversion to decimal
- Complex numbers represented as pairs of rational components

### 2. **Interactive Visualization**
- **Complex plane canvas** showing unit circle and convergents
- **Real-time animation** of convergent sequence
- **Zoomable/pannable view** with draggable navigation
- **Tooltip information** on hover for each convergent
- Tracks distance to unit circle for convergence quality

### 3. **Continued Fraction Coefficients**
- **CSCF** (Complex Simple Continued Fractions) pattern generation
- Support for any angle input (decimal or rational form)
- Configurable number of coefficients
- Visual display of coefficients and their role in convergence

### 4. **Trigonometric Comparison**
- **Side-by-side comparison**: Convergent values vs. JavaScript Math library
- **Precision metrics**: Display differences at high precision (16+ decimal places)
- **Convergence quality indicator**: Shows how well the approximation matches reality
- Three trigonometric functions: cos, sin, and tan

### 5. **Iteration Metrics Tracking**
- **Phase 1 (i)**: Count of convergent computation iterations until mathematical limit
- **Phase 2 (j)**: Binary exponentiation iterations ($\lceil \log_2(n) \rceil$)
- **Total effort**: Combined metric showing overall computational complexity
- Visual summary with detailed explanations

### 6. **Flexible Input Methods**
- **Decimal angle input** with automatic rational conversion
- **Rational input** as n/d (numerator/denominator)
- **π approximations** with 10 different rational representations (22/7, 355/113, etc.)
- **Random generation** for exploration
- Input synchronization: changes to one format automatically update others

## Technical Architecture

### Core Modules

#### `Complex.js`
Rational BigInt complex number class with operations:
- Addition, subtraction, multiplication, division
- Magnitude and conjugate calculations
- Float conversion for display
- Proper handling of BigInt arithmetic edge cases

#### `RationalBigInt.js`
Rational number utilities for BigInt operations:
- Arithmetic (add, subtract, multiply, divide)
- Normalization and GCD reduction
- Conversion to/from floating-point
- Rational approximation from decimals

#### `Trig.js`
Core trigonometric computation:
- `generateCoefficients(n, k)`: CSCF coefficient pattern generation
- `computeAllConvergents(coeffs, numerator)`: Builds convergent sequence with mathematical limit detection
- `expWithConvergents(angle, count, rational)`: Full computation pipeline returning convergents and iteration metrics

#### `UI.js`
Interactive visualization layer:
- Canvas rendering (complex plane, unit circle, convergents)
- Event handling (zoom, pan, input synchronization)
- Trigonometric display and comparison updates
- Animation sequencing for convergent visualization

#### `Utils.js`
Utility functions:
- Decimal to rational conversion (`toRational`, `toBigIntRational`)
- Number formatting with appropriate precision
- DOM element utilities

### Architecture Flow

```
User Input (angle, rational, π approximation)
  ↓
updateRational/updateDecimal (synchronization)
  ↓
cachedExactRational (BigInt rational storage)
  ↓
generateCoefficients (CSCF pattern)
  ↓
expWithConvergents (core computation with iteration metrics)
  ↓
Convergent sequence + metrics
  ↓
updateResultsGrid (display coefficients & convergents)
displayIterationMetrics (show computational effort)
drawScene (canvas visualization)
updateTrigComparison (precision analysis)
```

## Mathematical Foundation

### CSCF Coefficient Pattern Generation

One of the key insights enabling this method is that **Complex Simple Continued Fraction (CSCF) coefficients for $e^{i/q}$ follow an extremely simple pattern** that can be easily generated without complex computation. This pattern can be "unfolded" deterministically based solely on the denominator $q$.

**Pattern for $e^{i/q}$ coefficients:**

For a given denominator $q$, the CSCF coefficients follow:
- $a_0 = 1$ (always)
- For $k \geq 1$ (odd indices): $a_k = 0 + i \cdot (k \cdot q \cdot (-1)^{(k+1)/2})$
- For $k \geq 2$ (even indices): $a_k = (2 \cdot (-1)^{k/2}) + 0i$

**Examples:**

For $e^{i}$ (q=1):
$$a_0 = 1, \quad a_1 = i, \quad a_2 = -2, \quad a_3 = -3i, \quad a_4 = 2, \quad a_5 = 5i, \ldots$$

For $e^{i/2}$ (q=2):
$$a_0 = 1, \quad a_1 = 2i, \quad a_2 = -2, \quad a_3 = -6i, \quad a_4 = 2, \quad a_5 = 10i, \ldots$$

For $e^{i/3}$ (q=3):
$$a_0 = 1, \quad a_1 = 3i, \quad a_2 = -2, \quad a_3 = -9i, \quad a_4 = 2, \quad a_5 = 15i, \ldots$$

For $e^{i}$ (q=1, in addition to the above pattern, a slight change makes it converge 1 convergent faster):
$$a_0 = 1+i, \quad a_1 = -2+i, \quad a_2 = 1+3i, \quad a_3 = -2, \quad a_4 = -5i, \ldots$$

This deterministic pattern means coefficients can be computed on-demand with $O(1)$ time per coefficient, enabling efficient generation of arbitrarily many terms.

### Computing Any Angle via Exponentiation

Once we have $e^{i/q}$, computing **any angle** $e^{i\cdot p/q}$ is straightforward:

$$e^{i \cdot p/q} = \left(e^{i/q}\right)^p$$

This exponentiation is performed using the **binary squaring method**, which is extremely efficient:
- **Time complexity**: $O(\log p)$ multiplications
- **Method**: For $p = \sum_{j} 2^{j} b_j$ (binary representation), compute by successive squaring of intermediate results
- **Advantage**: Reduces computational cost from $O(p)$ to $O(\log p)$ iterations

**Example**: To compute $e^{i \cdot 17/5}$ from $e^{i/5}$:
$$17 = 16 + 1 = 2^4 + 2^0 \quad \Rightarrow \quad e^{i \cdot 17/5} = (e^{i/5})^{16} \cdot (e^{i/5})^{1}$$

Instead of 17 multiplications, we need only $\log_2(17) \approx 4.1$ squarings plus a final multiplication.

### Continued Fractions for e^(iθ)

The application uses Complex Simple Continued Fractions (CSCF) to approximate $e^{i\theta}$:

$$e^{i\theta} \approx a_0 + \cfrac{1}{a_1 + \cfrac{1}{a_2 + \cfrac{1}{a_3 + \cdots}}}$$

where $a_i$ are complex coefficients generated by the deterministic pattern based on $\theta = n/d$.

### Convergent Sequence

Each convergent $C_k$ is computed recursively:
$$p_k = a_k \cdot p_{k-1} + p_{k-2}$$
$$q_k = a_k \cdot q_{k-1} + q_{k-2}$$
$$C_k = \frac{p_k}{q_k}$$

### Mathematical Limit Detection

Convergents become unreliable when:
$$|q_n|^4 \cdot |a_{n+1}|^2 > |n|^2 \cdot 2^{106}$$

Beyond this point, numerical errors dominate. The visualizer marks this threshold and stops computing valid convergents.

### Iteration Metrics

**Convergent iterations (i)**: Computed until the mathematical limit or maximum coefficients
$$i = \begin{cases} \text{mathLimitIndex} + 1 & \text{if limit reached} \\ \text{total coefficients} & \text{otherwise} \end{cases}$$

**Exponentiation iterations (j)**: Based on the numerator's bit length
$$j = \lceil \log_2(|n|) \rceil$$

This represents binary exponentiation cost for computing $a^n$ in the actual trigonometric algorithm.

## Getting Started

### Prerequisites
- **Deno** runtime (v1.40+)
- Modern web browser with ES modules support
- No external dependencies (uses only Deno standard library for server)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd trig-analyse

# Install dependencies (Deno caches automatically)
deno cache --reload main.ts
```

### Running the Application

```bash
# Start the development server
deno task dev

# Or manually run the server
deno run --allow-read --allow-net main.ts
```

The application will be available at `http://localhost:8080`

## Usage Guide

### Basic Workflow

1. **Input an angle** in decimal form (e.g., `1.5` for 1.5 radians)
2. **Adjust rational representation** or select a π approximation
3. **Click "Generate Coefficients"** to compute convergents
4. **Watch the animation** showing convergent sequence progression
5. **Zoom and pan** the complex plane to examine convergents closely
6. **Observe metrics** showing iteration counts and convergence quality

### Input Methods

- **Decimal Angle**: Direct radian input, auto-converted to rational
- **Rational n/d**: Manual numerator/denominator entry
- **π Approximations**: Predefined rational approximations of π
- **Random Generation**: Generates random angle for exploration

### Visualization Controls

- **Mouse Wheel**: Zoom in/out on the complex plane
- **Click & Drag**: Pan the view
- **Hover on Points**: Show convergent details in tooltip
- **Buttons**:
  - "Reset View": Return to default zoom/position
  - "Zoom to Last": Focus on final convergent
  - "Zoom to Reference": Compare convergent with true value

### Interpreting Results

- **Convergent Colors**:
  - 🔵 Blue: Intermediate convergents
  - 🟢 Green: Final convergent (valid)
  - 🟣 Purple: JavaScript Math reference value (true answer)
  - 🔴 Red: During animation, current convergent
  - 🔽 Pink (faded): Redundant convergents (beyond math limit)

- **Metrics Panel**:
  - **Convergent Iterations**: How many steps to reach mathematical limit
  - **Exponentiation Iterations**: Log₂ of the numerator
  - **Total**: Combined computational effort

- **Trigonometric Comparison**:
  - Precision of each function shown to 16+ decimal places
  - Differences highlighted in orange (error magnitude)
  - Convergence quality bar with descriptive status

## Implementation Details

### Exact Rational Arithmetic

All complex numbers maintain exact representations:
```javascript
// Complex = { re: {n, d}, im: {n, d} }
// Where n is numerator, d is denominator (both BigInt)
// Example: 1/2 + 3/4*i = { re: {n:1n, d:2n}, im: {n:3n, d:4n} }
```

Operations preserve exactness:
- Addition: $(a/b) + (c/d) = (ad + bc)/(bd)$
- Division: $(a/b) / (c/d) = (ad)/(bc)$
- All intermediate results normalized (GCD reduction)

### BigInt for Unlimited Precision

JavaScript's `BigInt` allows arbitrary-precision integers. This enables:
- Large numerators/denominators without overflow
- Exact rational representation indefinitely
- Automatic overflow detection (unlike Number)

### Tangent Calculation Using Rational Division

Tangent is computed exactly:
$$\tan(\theta) = \frac{\sin(\theta)}{\cos(\theta)} = \frac{\text{Im}(C_k)}{\text{Re}(C_k)}$$

Using rational division:
$$\frac{(n_i/d_i)}{(n_r/d_r)} = \frac{n_i \cdot d_r}{d_i \cdot n_r}$$

Result converted to decimal only at final display.

### Convergence Quality Metrics

Error magnitude compared across three metrics:
- Cosine difference: $|\text{Re}(C_k) - \cos(\theta)|$
- Sine difference: $|\text{Im}(C_k) - \sin(\theta)|$
- Tangent difference: computed from rational tangent vs. Math.tan()

Convergence indicator uses log-scale:
- $< 10^{-15}$: Excellent (99.9%)
- $< 10^{-12}$: Very Good (99%)
- $< 10^{-9}$: Good (95%)
- $< 10^{-6}$: Moderate (85%)

## Project Structure

```
trig-analyse/
├── README.md                           # This file
├── LICENSE                             # MIT License
├── deno.json                           # Deno configuration
├── main.ts                             # Server entry point
├── ITERATION_METRICS_DOCUMENTATION.md  # Detailed metrics documentation
├── public/
│   ├── index.html                      # HTML UI structure
│   ├── style.css                       # Styling and layout
│   ├── main.js                         # Client entry point
│   ├── UI.js                           # Visualization and interaction
│   ├── Trig.js                         # Trigonometric computation
│   ├── Complex.js                      # Complex number class
│   ├── RationalBigInt.js              # Rational arithmetic utilities
│   └── Utils.js                        # Helper functions
└── .vscode/                            # VS Code settings
```

## Performance Considerations

### Computational Complexity
- Convergent computation: O(k) where k is number of coefficients
- Rational operations: O(M²) where M is bit-length (BigInt arithmetic)
- Canvas rendering: O(k) for k convergents
- Display update: O(k) for iteration metrics

### Optimization Strategies
1. **Lazy evaluation**: Computation deferred until user requests
2. **Caching**: Exact rational form cached after input synchronization
3. **Efficient BigInt**: Native JavaScript BigInt with minimal allocations
4. **Canvas optimization**: Viewport clipping, arc segment calculation

### Browser Compatibility
- Chrome/Edge 67+
- Firefox 93+
- Safari 14.1+
- Requires: ES2020 (BigInt), ES6 Modules, Canvas API

## Known Limitations

1. **Very large numerators**: Conversions to Number may lose precision (>2^53)
2. **Mathematical limit**: Continued fractions lose accuracy beyond the calculated threshold
3. **Display precision**: Limited to 16-17 decimal places in floating-point
4. **Animation**: Smooth at 60fps but may slow with 50+ coefficients

## Future Enhancements

- [ ] Export results as CSV/JSON
- [ ] Comparison of multiple angles simultaneously
- [ ] Alternative continued fraction patterns
- [ ] Performance profiling visualization
- [ ] Unit tests with QUnit or Vitest
- [ ] WebGL rendering for massive coefficient counts
- [ ] Numerical stability analysis charts

## Contributing

Contributions are welcome! Areas for improvement:
- Documentation and tutorials
- Additional test cases
- Performance optimizations
- UI/UX enhancements
- Mathematical analysis and visualizations

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

**Ömer Kaşdarma** - Developed as an exploration of continued fraction methods for trigonometric computation, combining mathematical theory with interactive web visualization.

## Support

For issues, questions, or suggestions, please open an issue on the repository or contact the maintainer.

---

**Last Updated**: December 2025
**Version**: 1.0.0
