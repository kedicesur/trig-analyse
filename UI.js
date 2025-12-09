// UI.js - User interface and visualization logic

import { generateCoefficients, expWithConvergents } from './Trig.js';

export class ComplexVisualizerUI {
  constructor() {
    // DOM elements
    this.angleInput = document.getElementById('angleInput');
    this.numeratorInput = document.getElementById('numeratorInput');
    this.denominatorInput = document.getElementById('denominatorInput');
    this.piDropdown = document.getElementById('piDropdown');
    this.coefficientCountInput = document.getElementById('coefficientCount');
    this.plotButton = document.getElementById('plotButton');
    this.generateRandomButton = document.getElementById('generateCoefficients');
    this.complexCanvas = document.getElementById('complexCanvas');
    this.canvasContainer = document.getElementById('canvasContainer');
    this.coefficientsList = document.getElementById('coefficientsList');
    this.convergentsList = document.getElementById('convergentsList');
    this.resetViewButton = document.getElementById('resetView');
    this.zoomToLastButton = document.getElementById('zoomToLast');
    this.currentConvergentElement = document.getElementById('currentConvergent');
    this.totalConvergentsElement = document.getElementById('totalConvergents');
    this.distanceToUnitCircleElement = document.getElementById('distanceToUnitCircle');

    // Canvas context
    this.ctx = this.complexCanvas.getContext('2d');

    // View state for zooming and panning with fixed bounds [-1.2, 1.2]
    this.viewState = {
      centerX: 0,
      centerY: 0,
      scale: 1.0,
      isDragging: false,
      lastMouseX: 0,
      lastMouseY: 0,
      minBound: -1.2,
      maxBound: 1.2
    };

    // Current convergents and animation state
    this.currentConvergents = [];
    this.currentStep = 0;
    this.animationInterval = null;
    this.isAnimating = false;

    // Tooltip state
    this.tooltip = null;
    this.hoveredConvergent = null;
    this.tooltipTimeout = null;

    // Input synchronization flags
    this.isUpdatingFromDecimal = false;
    this.isUpdatingFromRational = false;

    // Initialize
    this.init();
  }

  init() {
    // Set up event listeners
    this.plotButton.addEventListener('click', () => this.generateAndPlot());
    this.generateRandomButton.addEventListener('click', () => this.generateRandomAngle());
    this.resetViewButton.addEventListener('click', () => this.resetView());
    this.zoomToLastButton.addEventListener('click', () => this.zoomToLastConvergent());

    // Set up input synchronization event listeners
    this.setupInputEvents();

    // Set up canvas event listeners for panning and zooming
    this.setupCanvasEvents();

    // Create tooltip element
    this.createTooltip();

    // Initial resize and draw
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Initial plot
    setTimeout(() => {
      // Update rational input from initial decimal value
      this.updateRationalFromDecimal();
      this.generateAndPlot();
    }, 100);
  }

  setupInputEvents() {
    // Decimal input -> update rational
    this.angleInput.addEventListener('input', () => {
      if (!this.isUpdatingFromRational) {
        this.isUpdatingFromDecimal = true;
        this.updateRationalFromDecimal();
        this.isUpdatingFromDecimal = false;
      }
    });

    // Rational inputs -> update decimal
    this.numeratorInput.addEventListener('input', () => {
      if (!this.isUpdatingFromDecimal) {
        this.isUpdatingFromRational = true;
        this.updateDecimalFromRational();
        this.isUpdatingFromRational = false;
      }
    });

    this.denominatorInput.addEventListener('input', () => {
      if (!this.isUpdatingFromDecimal) {
        this.isUpdatingFromRational = true;
        this.updateDecimalFromRational();
        this.isUpdatingFromRational = false;
      }
    });

    // Pi dropdown changes -> update both
    this.piDropdown.addEventListener('change', () => {
      // When π changes, we need to update rational from decimal
      if (!this.isUpdatingFromDecimal) {
        this.isUpdatingFromRational = true;
        this.updateRationalFromDecimal();
        this.isUpdatingFromRational = false;
      }
    });
  }

  setupCanvasEvents() {
    this.canvasContainer.addEventListener('mousedown', (e) => {
      this.viewState.isDragging = true;
      this.viewState.lastMouseX = e.clientX;
      this.viewState.lastMouseY = e.clientY;
      this.canvasContainer.style.cursor = 'grabbing';
    });

    this.canvasContainer.addEventListener('mousemove', (e) => {
      if (!this.viewState.isDragging) {
        // Handle mouseover for tooltips
        this.handleMouseMove(e);
      } else {
        const deltaX = e.clientX - this.viewState.lastMouseX;
        const deltaY = e.clientY - this.viewState.lastMouseY;

        // Convert pixel movement to complex plane movement
        const scaleFactor = this.viewState.scale * (Math.min(this.complexCanvas.width, this.complexCanvas.height) / (2.4)); // 2.4 = maxBound - minBound

        // Update center with bounds checking
        const newCenterX = this.viewState.centerX + deltaX / scaleFactor;
        const newCenterY = this.viewState.centerY - deltaY / scaleFactor;

        // Apply bounds to keep within [-1.2, 1.2] range
        this.viewState.centerX = newCenterX;
        this.viewState.centerY = newCenterY;

        this.viewState.lastMouseX = e.clientX;
        this.viewState.lastMouseY = e.clientY;

        this.drawScene();
      }
    });

    this.canvasContainer.addEventListener('mouseup', () => {
      this.viewState.isDragging = false;
      this.canvasContainer.style.cursor = 'move';
    });

    this.canvasContainer.addEventListener('mouseleave', () => {
      this.viewState.isDragging = false;
      this.canvasContainer.style.cursor = 'move';
      // Hide tooltip when mouse leaves canvas
      this.hideTooltip();
    });

    // Mouse wheel zoom with bounds
    this.canvasContainer.addEventListener('wheel', (e) => {
      e.preventDefault();

      // Get mouse position relative to canvas
      const rect = this.complexCanvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Get complex coordinates at mouse position before zoom
      const complexBeforeZoom = this.mapFromCanvas(mouseX, mouseY);

      // Determine zoom factor based on wheel direction
      const zoomFactor = 1.2;
      if (e.deltaY < 0) {
        // Zoom in
        this.viewState.scale *= zoomFactor;
      } else {
        // Zoom out
        this.viewState.scale /= zoomFactor;
        // Dont zoom out from initial scale
        if (this.viewState.scale < 1) this.viewState.scale = 1;
      }

      // Get complex coordinates at mouse position after zoom (with same center)
      const complexAfterZoom = this.mapFromCanvas(mouseX, mouseY);

      // Adjust center to keep the point under the mouse stationary
      const deltaX = complexBeforeZoom.real - complexAfterZoom.real;
      const deltaY = complexBeforeZoom.imag - complexAfterZoom.imag;
      
      this.viewState.centerX += deltaX;
      this.viewState.centerY += deltaY;

      this.drawScene();
    });
  }

  // Convert π string to numeric value
  parsePiValue(piStr) {
    if (piStr === '1') return 1;
    if (piStr.includes('/')) {
      const [num, den] = piStr.split('/').map(Number);
      return num / den;
    }
    return parseFloat(piStr);
  }

  // Update rational input from decimal
  updateRationalFromDecimal() {
    const decimal = parseFloat(this.angleInput.value);
    if (isNaN(decimal)) return;

    const piStr = this.piDropdown.value;
    const piValue = this.parsePiValue(piStr);

    // If π = 1, angleWithoutPi = decimal
    // Otherwise, angleWithoutPi = decimal / π
    const angleWithoutPi = decimal / piValue;

    // Convert to rational
    const rational = this._toRational(angleWithoutPi);

    // Update rational inputs
    this.numeratorInput.value = rational.n;
    this.denominatorInput.value = rational.d;
  }

  // Update decimal input from rational
  updateDecimalFromRational() {
    const numerator = parseFloat(this.numeratorInput.value);
    const denominator = parseFloat(this.denominatorInput.value);

    if (isNaN(numerator) || isNaN(denominator) || denominator === 0) {
      return;
    }

    const piStr = this.piDropdown.value;
    const piValue = this.parsePiValue(piStr);

    // Calculate decimal: (numerator/denominator) * π
    const decimal = (numerator / denominator) * piValue;

    // Update decimal input
    this.angleInput.value = decimal;
  }

  createTooltip() {
    this.tooltip = document.createElement('div');
    this.tooltip.id = 'convergentTooltip';
    this.tooltip.className = 'convergent-tooltip';
    this.tooltip.style.display = 'none';
    
    // Ensure tooltip is properly positioned within the container
    this.tooltip.style.position = 'absolute';
    this.tooltip.style.zIndex = '1000';

    this.canvasContainer.appendChild(this.tooltip);
  }

  handleMouseMove(e) {
    const rect = this.complexCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Check if mouse is near any convergent point
    this.hoveredConvergent = null;
    const hoverRadius = 20; // pixels

    if (this.currentConvergents.length > 0) {
      const stepsToCheck = this.isAnimating ?
        Math.min(this.currentStep + 1, this.currentConvergents.length) :
        this.currentConvergents.length;

      for (let i = 0; i < stepsToCheck; i++) {
        const convergent = this.currentConvergents[i];
        const point = this.mapToCanvas(convergent.re, convergent.im);

        const distance = Math.hypot(mouseX - point.x, mouseY - point.y);
        this.hoveredConvergent = null;

        if (distance < hoverRadius) {
          this.hoveredConvergent = {
            index: i,
            convergent: convergent,
            canvasX: point.x,
            canvasY: point.y
          };
          break;
        }
      }
    }

    // Show or hide tooltip based on hover state
    if (this.hoveredConvergent) {
      this.showTooltip(e.clientX, e.clientY);
    } else {
      this.hideTooltip();
    }
  }

  showTooltip(x, y) {
    if (!this.hoveredConvergent) return;

    const conv = this.hoveredConvergent.convergent;
    const index = this.hoveredConvergent.index;

    // FIX 6: Use .toFixed(18) for full precision display
    const realStr = conv.re.toFixed(18).replace(/\.?0+$/, '');
    const imagStr = Math.abs(conv.im).toFixed(18).replace(/\.?0+$/, '');
    const sign = conv.im >= 0 ? '+' : '-';
    const magnitudeStr = conv.magnitude().toFixed(18).replace(/\.?0+$/, '');

    this.tooltip.innerHTML = `
      <h4>Convergent C${index + 1}</h4>
      <div class="value">${realStr} ${sign} ${imagStr}i</div>
      <div class="magnitude">Magnitude: ${magnitudeStr}</div>
    `;
    
    // Get canvas container position relative to viewport
    const containerRect = this.canvasContainer.getBoundingClientRect();
    
    // Convert window coordinates to container-relative coordinates
    const containerX = x - containerRect.left;
    const containerY = y - containerRect.top;

    // Position tooltip near mouse pointer (right and slightly below)
    const tooltipWidth = this.tooltip.offsetWidth;
    const tooltipHeight = this.tooltip.offsetHeight;
    
    // Default position: to the right of the cursor
    let posX = containerX + 10;
    let posY = containerY + 10;
    
    // Container dimensions
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;

    // Adjust if tooltip would go off the right edge
    if (posX + tooltipWidth > containerWidth - 10) {
      posX = containerX - tooltipWidth - 10;
    }

    // Adjust if tooltip would go off the bottom edge
    if (posY + tooltipHeight > containerHeight - 10) {
      posY = containerY - tooltipHeight - 10;
    }
    
    // Adjust if tooltip would go off the left edge of container
    if (posX < 10) {
        posX = 10;
    }

    // Adjust if tooltip would go off the top edge
    if (posY < 10) {
      posY = 10;
    }

    this.tooltip.style.left = `${posX}px`;
    this.tooltip.style.top = `${posY}px`;
    this.tooltip.style.display = 'block';

    // Clear any existing timeout
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
    }
  }

  hideTooltip() {
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
    }

    this.tooltipTimeout = setTimeout(() => {
      this.tooltip.style.display = 'none';
      this.hoveredConvergent = null;
    }, 50);
  }

resizeCanvas() {
    // Critical: Match canvas drawing buffer to CSS display size
    // Prevents blurry rendering when CSS scales the canvas
    const container = this.canvasContainer;
    const displayWidth = container.clientWidth;
    const displayHeight = container.clientHeight;
    
    // Only update if size actually changed
    if (this.complexCanvas.width !== displayWidth || this.complexCanvas.height !== displayHeight) {
        this.complexCanvas.width = displayWidth;
        this.complexCanvas.height = displayHeight;
        this.drawScene();
    }
}

  // Map complex coordinates to canvas coordinates with fixed bounds [-1.2, 1.2]
  mapToCanvas(real, imag) {
    // Calculate scale factor based on canvas size and bounds
    const canvasSize = this.complexCanvas.width; // Use width since it's square
    const boundsRange = 2.4; // 1.2 - (-1.2)

    // Scale to fit bounds in canvas
    const scaleFactor = (canvasSize / boundsRange) * this.viewState.scale;

    // Center of canvas
    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;

    // Apply transformation with center offset
    const x = centerX + (real + this.viewState.centerX) * scaleFactor;
    const y = centerY - (imag + this.viewState.centerY) * scaleFactor;

    return { x, y };
  }

  // Map canvas coordinates to complex coordinates
  mapFromCanvas(x, y) {
    const canvasSize = this.complexCanvas.width;
    const boundsRange = 2.4;
    const scaleFactor = (canvasSize / boundsRange) * this.viewState.scale;

    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;

    const real = (x - centerX) / scaleFactor - this.viewState.centerX;
    const imag = (centerY - y) / scaleFactor - this.viewState.centerY;

    return { real, imag };
  }

  drawComplexPlane() {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.complexCanvas.width, this.complexCanvas.height);

    // Draw background
    this.ctx.fillStyle = '#f8f9fa';
    this.ctx.fillRect(0, 0, this.complexCanvas.width, this.complexCanvas.height);

    // Determine grid spacing (0.2 units for [-1.2, 1.2] range)
    const gridStep = 0.2;

    // Get visible bounds
    const topLeft = this.mapFromCanvas(0, 0);
    const bottomRight = this.mapFromCanvas(this.complexCanvas.width, this.complexCanvas.height);
    const minReal = Math.min(topLeft.real, bottomRight.real);
    const maxReal = Math.max(topLeft.real, bottomRight.real);
    const minImag = Math.min(topLeft.imag, bottomRight.imag);
    const maxImag = Math.max(topLeft.imag, bottomRight.imag);

    // Draw grid lines
    this.ctx.strokeStyle = '#e0e0e0';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([]);

    // Vertical grid lines (real axis)
    const firstVerticalLine = Math.ceil(minReal / gridStep) * gridStep;
    for (let real = firstVerticalLine; real <= maxReal; real += gridStep) {
      const pos = this.mapToCanvas(real, 0);
      this.ctx.beginPath();
      this.ctx.moveTo(pos.x, 0);
      this.ctx.lineTo(pos.x, this.complexCanvas.height);
      this.ctx.stroke();

      // Draw label for integer or half-integer values
      if (Math.abs(real) < 0.001) {
        this.ctx.fillStyle = '#2c3e50';
        this.ctx.font = 'bold 12px Roboto';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('0', pos.x, this.complexCanvas.height - 10);
      } else if (Math.abs(Math.round(real * 10) - real * 10) < 0.001) {
        this.ctx.fillStyle = '#7f8c8d';
        this.ctx.font = '11px Roboto';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(real.toFixed(1), pos.x, this.complexCanvas.height - 10);
      }
    }

    // Horizontal grid lines (imaginary axis)
    const firstHorizontalLine = Math.ceil(minImag / gridStep) * gridStep;
    for (let imag = firstHorizontalLine; imag <= maxImag; imag += gridStep) {
      const pos = this.mapToCanvas(0, imag);
      this.ctx.beginPath();
      this.ctx.moveTo(0, pos.y);
      this.ctx.lineTo(this.complexCanvas.width, pos.y);
      this.ctx.stroke();

      // Draw label for integer or half-integer values
      if (Math.abs(imag) < 0.001) {
        this.ctx.fillStyle = '#2c3e50';
        this.ctx.font = 'bold 12px Roboto';
        this.ctx.textAlign = 'right';
        this.ctx.fillText('0', 35, pos.y + 4);
      } else if (Math.abs(Math.round(imag * 10) - imag * 10) < 0.001) {
        this.ctx.fillStyle = '#7f8c8d';
        this.ctx.font = '11px Roboto';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(imag.toFixed(1) + 'i', 35, pos.y + 4);
      }
    }

    // Draw axes
    this.ctx.strokeStyle = '#2c3e50';
    this.ctx.lineWidth = 2;

    // Real axis (horizontal)
    const zeroY = this.mapToCanvas(0, 0).y;
    this.ctx.beginPath();
    this.ctx.moveTo(0, zeroY);
    this.ctx.lineTo(this.complexCanvas.width, zeroY);
    this.ctx.stroke();

    // Imaginary axis (vertical)
    const zeroX = this.mapToCanvas(0, 0).x;
    this.ctx.beginPath();
    this.ctx.moveTo(zeroX, 0);
    this.ctx.lineTo(zeroX, this.complexCanvas.height);
    this.ctx.stroke();

    // Draw axis labels
    this.ctx.fillStyle = '#2c3e50';
    this.ctx.font = 'bold 14px Open Sans';
    this.ctx.textAlign = 'right';
    this.ctx.fillText('Imaginary (i)', 50, 20);

    this.ctx.textAlign = 'center';
    this.ctx.fillText('Real', this.complexCanvas.width - 30, zeroY - 10);

    // Draw unit circle
    this.ctx.strokeStyle = '#e74c3c';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);

    const center = this.mapToCanvas(0, 0);
    const radiusPoint = this.mapToCanvas(1, 0);
    const radius = Math.abs(radiusPoint.x - center.x);

    this.ctx.beginPath();
    this.ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // Draw unit circle label
    this.ctx.fillStyle = '#e74c3c';
    this.ctx.font = 'bold 14px Open Sans';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Unit Circle', center.x + radius + 30, center.y);
  }

  drawConvergents() {
    if (this.currentConvergents.length === 0) return;

    // Draw connecting edges (lines between consecutive convergents)
    this.ctx.strokeStyle = '#3498db';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();

    // Start from the first convergent
    const firstPoint = this.mapToCanvas(this.currentConvergents[0].re, this.currentConvergents[0].im);
    this.ctx.moveTo(firstPoint.x, firstPoint.y);

    // Connect to subsequent convergents up to current step
    const stepsToShow = this.isAnimating ? Math.min(this.currentStep + 1, this.currentConvergents.length) : this.currentConvergents.length;

    for (let i = 1; i < stepsToShow; i++) {
      const point = this.mapToCanvas(this.currentConvergents[i].re, this.currentConvergents[i].im);
      this.ctx.lineTo(point.x, point.y);
    }

    this.ctx.stroke();

    // Draw convergents as points
    for (let i = 0; i < stepsToShow; i++) {
      const convergent = this.currentConvergents[i];
      const point = this.mapToCanvas(convergent.re, convergent.im);

      // Determine color based on position in sequence
      let color;
      if (i === stepsToShow - 1 && this.isAnimating) {
        color = '#e74c3c'; // Current convergent (if animating)
      } else if (i === this.currentConvergents.length - 1) {
        color = '#2ecc71'; // Final convergent
      } else {
        color = '#3498db'; // Intermediate convergents
      }

      // Draw point
      this.ctx.fillStyle = color;
      this.ctx.beginPath();

      // Make the current or final convergent larger
      const radius = (i === stepsToShow - 1 && this.isAnimating) || i === this.currentConvergents.length - 1 ? 8 : 6;
      this.ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      this.ctx.fill();

      // Draw white border
      this.ctx.strokeStyle = 'white';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      // Draw convergent label (just the number)
      this.ctx.fillStyle = '#2c3e50';
      this.ctx.font = i === this.currentConvergents.length - 1 ? 'bold 12px Open Sans' : '10px Open Sans';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`C${i + 1}`, point.x, point.y + (i === this.currentConvergents.length - 1 ? 25 : 20));
    }

    // Update display info
    if (this.currentConvergents.length > 0) {
      const currentIndex = this.isAnimating ? Math.min(this.currentStep, this.currentConvergents.length - 1) : this.currentConvergents.length - 1;
      const currentConv = this.currentConvergents[currentIndex];
      this.currentConvergentElement.textContent = `C${currentIndex + 1}`;
      this.totalConvergentsElement.textContent = this.currentConvergents.length;

      // Calculate distance to unit circle with full precision
      const distance = Math.abs(currentConv.magnitude() - 1);
      this.distanceToUnitCircleElement.textContent = distance.toFixed(18).replace(/\.?0+$/, '');
    }
  }

  drawScene() {
    this.drawComplexPlane();
    this.drawConvergents();
  }

  updateCoefficientsList(coefficients) {
    this.coefficientsList.innerHTML = '';

    coefficients.forEach((coeff, index) => {
      const coeffElement = document.createElement('div');
      coeffElement.className = 'point-item';
      // FIX 5.1: Display coefficients as integers (a + bi)
      const realInt = Math.round(coeff.re);
      const imagInt = Math.round(coeff.im);
      const sign = imagInt >= 0 ? '+' : '';
      coeffElement.textContent = `a${index}: ${realInt} ${sign} ${imagInt}i`;
      this.coefficientsList.appendChild(coeffElement);
    });
  }

  updateConvergentsList(convergents) {
    this.convergentsList.innerHTML = '';

    convergents.forEach((conv, index) => {
      const convElement = document.createElement('div');
      convElement.className = 'point-item';
      // FIX 5.2: Display convergents with .toFixed(18) precision
      const realStr = conv.re.toFixed(18).replace(/\.?0+$/, '');
      const imagStr = Math.abs(conv.im).toFixed(18).replace(/\.?0+$/, '');
      const sign = conv.im >= 0 ? '+' : '-';
      convElement.textContent = `C${index + 1}: ${realStr} ${sign} ${imagStr}i`;
      this.convergentsList.appendChild(convElement);
    });
  }

  generateAndPlot() {
    const angle = parseFloat(this.angleInput.value);
    const count = parseInt(this.coefficientCountInput.value);

    if (isNaN(angle) || isNaN(count) || count < 1) {
      alert('Please enter valid angle and coefficient count values.');
      return;
    }

    // Stop any existing animation
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.isAnimating = false;
    }

    // Reset animation state
    this.currentStep = 0;

    try {
      // Generate coefficients
      const { d: denominator } = this._toRational(angle);
      const coefficients = generateCoefficients(denominator, count);

      // Calculate convergents
      this.currentConvergents = expWithConvergents(angle, count);

      // Update displays
      this.updateCoefficientsList(coefficients);
      this.updateConvergentsList(this.currentConvergents);

      // Draw the scene
      this.drawScene();

      // Start animation
      this.startAnimation();
    } catch (error) {
      alert(`Error: ${error.message}`);
      console.error(error);
    }
  }

  startAnimation() {
    if (this.currentConvergents.length === 0) return;

    // Stop any existing animation
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
    }

    this.isAnimating = true;
    this.currentStep = 0;

    // Animate step by step
    this.animationInterval = setInterval(() => {
      this.currentStep++;
      this.drawScene();

      // Stop when we've shown all convergents
      if (this.currentStep >= this.currentConvergents.length) {
        clearInterval(this.animationInterval);
        this.isAnimating = false;
        // Show final state
        this.drawScene();
      }
    }, 800); // 0.8 seconds per step
  }

  generateRandomAngle() {
    // Generate a random angle between 0.1 and 3.0 radians
    const randomAngle = (Math.random() * 2.9 + 0.1).toFixed(2);
    this.angleInput.value = randomAngle;

    // Update rational input from decimal
    this.isUpdatingFromRational = true;
    this.updateRationalFromDecimal();
    this.isUpdatingFromRational = false;

    // Generate and plot
    this.generateAndPlot();
  }

  resetView() {
    this.viewState = {
      centerX: 0,
      centerY: 0,
      scale: 1.0,
      isDragging: false,
      lastMouseX: 0,
      lastMouseY: 0
      // Removed: minBound and maxBound
    };
    this.drawScene();
  }

  // Zoom to the last convergent and one previous convergent with different value
  zoomToLastConvergent() {
    if (this.currentConvergents.length < 2) {
      alert('Need at least 2 convergents to zoom.');
      return;
    }

    const lastIndex = this.currentConvergents.length - 1;
    const lastConv = this.currentConvergents[lastIndex];

    // Find the previous convergent with a different value (with high precision comparison)
    const epsilon = 1e-15;
    let prevIndex = lastIndex - 1;
    let foundDifferent = false;

    while (prevIndex >= 0) {
      const prevConv = this.currentConvergents[prevIndex];

      // Compare real and imaginary parts with high precision
      const reDiff = Math.abs(prevConv.re - lastConv.re);
      const imDiff = Math.abs(prevConv.im - lastConv.im);

      if (reDiff > epsilon || imDiff > epsilon) {
        foundDifferent = true;
        break;
      }
      prevIndex--;
    }

    if (!foundDifferent) {
      alert('All convergents have the same value (within floating point precision).');
      return;
    }

    const prevConv = this.currentConvergents[prevIndex];

    // Calculate the bounding box that contains both convergents
    const minReal = Math.min(lastConv.re, prevConv.re);
    const maxReal = Math.max(lastConv.re, prevConv.re);
    const minImag = Math.min(lastConv.im, prevConv.im);
    const maxImag = Math.max(lastConv.im, prevConv.im);

    // Calculate the center of the bounding box
    const centerReal = (minReal + maxReal) / 2;
    const centerImag = (minImag + maxImag) / 2;

    // Calculate the dimensions of the bounding box
    const width = maxReal - minReal;
    const height = maxImag - minImag;

    // Add padding around the points (20% of the dimensions)
    const padding = 0.2;
    const paddedWidth = width * (1 + 2 * padding);
    const paddedHeight = height * (1 + 2 * padding);

    // We want the padded bounding box to fill most of the canvas
    const canvasSize = this.complexCanvas.width;
    const boundsRange = 2.4;

    // Calculate the required scale to fit the padded bounding box
    // The scale factor relates to how much of the [-1.2, 1.2] range we show
    const requiredScaleX = canvasSize / paddedWidth;
    const requiredScaleY = canvasSize / paddedHeight;
    const requiredScale = Math.min(requiredScaleX, requiredScaleY) * (boundsRange / canvasSize);

    // Update the view state
    this.viewState.centerX = -centerReal;
    this.viewState.centerY = -centerImag;
    this.viewState.scale = requiredScale * 1.1; // Add a little extra padding

    // Ensure we don't zoom out too much
    if (this.viewState.scale < 0.8) {
      this.viewState.scale = 0.8;
    }

    // Redraw the scene
    this.drawScene();
  }

  // Helper function to convert decimal to rational (simplified version)
  _toRational(x) {
    // Handle special cases
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
}