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

    // Number of coefficients/convergents to generate
    this.COEFFICIENT_COUNT = 16;

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

    // Trigonometric comparison elements
    this.convergentCosElement = document.getElementById('convergentCos');
    this.jsCosElement = document.getElementById('jsCos');
    this.diffCosElement = document.getElementById('diffCos');

    this.convergentSinElement = document.getElementById('convergentSin');
    this.jsSinElement = document.getElementById('jsSin');
    this.diffSinElement = document.getElementById('diffSin');

    this.convergentTanElement = document.getElementById('convergentTan');
    this.jsTanElement = document.getElementById('jsTan');
    this.diffTanElement = document.getElementById('diffTan');

    this.convergenceBarElement = document.getElementById('convergenceBar');
    this.convergenceStatusElement = document.getElementById('convergenceStatus');

    // Store last generated angle for comparison
    this.lastGeneratedAngle = null;

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
        const scaleFactor = this.viewState.scale * (Math.min(this.complexCanvas.width, this.complexCanvas.height) / 2.4); // 2.4 = maxBound - minBound

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

  /**
  * Find the index where convergents stop changing (within Number.EPSILON)
  * @param {Complex[]} convergents - Array of convergents
  * @returns {number} Index of first redundant convergent, or -1 if none
  */
  findConvergenceIndex(convergents) {
    if (convergents.length < 2) return -1;

    for (let i = 1; i < convergents.length - 1; i++) {
      const current = convergents[i];
      const next = convergents[i + 1];

      const reDiff = Math.abs(current.re - next.re);
      const imDiff = Math.abs(current.im - next.im);

      // Check if any one of real or imaginary parts are within EPSILON
      if (reDiff <= Number.EPSILON || imDiff <= Number.EPSILON) {
        return i + 1; // Return index of the first redundant convergent
      }
    }

    return -1; // No redundant convergents found
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
      this.showTooltip();
    } else {
      this.hideTooltip();
    }
  }

  showTooltip() {
    if (!this.hoveredConvergent) return;

    const conv = this.hoveredConvergent.convergent;
    const index = this.hoveredConvergent.index;

    // Format content
    const realStr = conv.re.toFixed(17).replace(/\.?0+$/, '');
    const imagStr = Math.abs(conv.im).toFixed(17).replace(/\.?0+$/, '');
    const sign = conv.im >= 0 ? '+' : '-';
    const magnitudeStr = conv.magnitude().toFixed(17).replace(/\.?0+$/, '');

    this.tooltip.innerHTML = `
      <h4>Convergent C${index}</h4>
      <div class="value">${realStr} ${sign} ${imagStr}i</div>
      <div class="magnitude">Magnitude: ${magnitudeStr}</div>
    `;

    const containerRect = this.canvasContainer.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;

    const convPoint = {
      x: this.hoveredConvergent.canvasX,
      y: this.hoveredConvergent.canvasY
    };

    this.tooltip.style.display = 'block';
    const tooltipWidth = this.tooltip.offsetWidth;
    const tooltipHeight = this.tooltip.offsetHeight;

    // Simple rule: 
    // - If convergent is on left half, show tooltip to the right
    // - If convergent is on right half, show tooltip to the left
    // - If convergent is on top half, show tooltip below
    // - If convergent is on bottom half, show tooltip above

    // Horizontal positioning
    let posX;
    if (convPoint.x < containerWidth / 2) {
      // Convergent on left → tooltip on right
      posX = convPoint.x + 15;
    } else {
      // Convergent on right → tooltip on left
      posX = convPoint.x - tooltipWidth - 15;
    }

    // Vertical positioning
    let posY;
    if (convPoint.y < containerHeight / 2) {
      // Convergent on top → tooltip below
      posY = convPoint.y + 15;
    } else {
      // Convergent on bottom → tooltip above
      posY = convPoint.y - tooltipHeight - 15;
    }

    // Clamp to container (prevents going outside)
    posX = Math.max(10, Math.min(containerWidth - tooltipWidth - 10, posX));
    posY = Math.max(10, Math.min(containerHeight - tooltipHeight - 10, posY));

    this.tooltip.style.left = `${posX}px`;
    this.tooltip.style.top = `${posY}px`;

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

  drawVisibleUnitCircle() {
    // Only draw unit circle if it intersects the current viewport
    this.ctx.strokeStyle = '#e74c3c';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);

    // Get viewport bounds
    const topLeft = this.mapFromCanvas(0, 0);
    const bottomRight = this.mapFromCanvas(this.complexCanvas.width, this.complexCanvas.height);

    const viewport = {
      minReal: Math.min(topLeft.real, bottomRight.real),
      maxReal: Math.max(topLeft.real, bottomRight.real),
      minImag: Math.min(topLeft.imag, bottomRight.imag),
      maxImag: Math.max(topLeft.imag, bottomRight.imag)
    };

    // Quick check: Is the unit circle possibly visible?
    const circleRadius = 1;
    const circleVisible =
      viewport.minReal <= circleRadius && viewport.maxReal >= -circleRadius &&
      viewport.minImag <= circleRadius && viewport.maxImag >= -circleRadius;

    if (!circleVisible) {
      this.ctx.setLineDash([]);
      return;
    }

    // Determine visible angle range
    // If origin is in viewport, we might see the full circle
    let startAngle = 0;
    let endAngle = 2 * Math.PI;

    const originInViewport =
      viewport.minReal <= 0 && viewport.maxReal >= 0 &&
      viewport.minImag <= 0 && viewport.maxImag >= 0;

    if (!originInViewport) {
      // Calculate angles from origin to viewport corners
      const corners = [
        { x: viewport.minReal, y: viewport.minImag },
        { x: viewport.minReal, y: viewport.maxImag },
        { x: viewport.maxReal, y: viewport.minImag },
        { x: viewport.maxReal, y: viewport.maxImag }
      ];

      const angles = corners.map(corner => {
        const angle = Math.atan2(corner.y, corner.x);
        return angle < 0 ? angle + 2 * Math.PI : angle;
      });

      startAngle = Math.min(...angles);
      endAngle = Math.max(...angles);

      // If the angle range is very large, just draw full circle
      if (endAngle - startAngle > Math.PI * 1.5) {
        startAngle = 0;
        endAngle = 2 * Math.PI;
      }
    }

    // Draw the visible arc
    this.drawUnitCircleArc(startAngle, endAngle);
    this.ctx.setLineDash([]);
  }

  drawUnitCircleArc(startAngle, endAngle) {
    // Calculate number of segments based on zoom level and arc length
    const angleSpan = endAngle - startAngle;
    const segmentCount = Math.max(32, Math.min(360, Math.floor(angleSpan * 180 / Math.PI * this.viewState.scale)));

    const angleStep = angleSpan / segmentCount;

    this.ctx.beginPath();

    for (let i = 0; i <= segmentCount; i++) {
      const angle = startAngle + i * angleStep;
      const x = Math.cos(angle);
      const y = Math.sin(angle);

      const point = this.mapToCanvas(x, y);

      if (i === 0) {
        this.ctx.moveTo(point.x, point.y);
      } else {
        this.ctx.lineTo(point.x, point.y);
      }
    }

    this.ctx.stroke();
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
    this.ctx.textAlign = 'left';
    this.ctx.fillText('Imaginary (i)', zeroX + 10, 30);

    this.ctx.textAlign = 'center';
    this.ctx.fillText('Real', this.complexCanvas.width - 30, zeroY - 10);

    this.drawVisibleUnitCircle();

    // Draw unit circle label
    const center = this.mapToCanvas(0, 0);
    const radiusPoint = this.mapToCanvas(1, 0);
    const radius = Math.abs(radiusPoint.x - center.x);
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

    // Start from the first convergent (C0)
    const firstPoint = this.mapToCanvas(this.currentConvergents[0].re, this.currentConvergents[0].im);
    this.ctx.moveTo(firstPoint.x, firstPoint.y);

    // Connect to subsequent convergents up to current step
    const stepsToShow = this.isAnimating ?
      Math.min(this.currentStep + 1, this.currentConvergents.length) :
      this.currentConvergents.length;

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

      // Draw convergent label (C0, C1, C2, ...)
      this.ctx.fillStyle = '#2c3e50';
      this.ctx.font = i === this.currentConvergents.length - 1 ? 'bold 12px Open Sans' : '10px Open Sans';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`C${i}`, point.x, point.y + (i === this.currentConvergents.length - 1 ? 25 : 20));
    }

    // Update display info - show count of VALID convergents
    if (this.currentConvergents.length > 0) {
      const currentIndex = this.isAnimating ?
        Math.min(this.currentStep, this.currentConvergents.length - 1) :
        this.currentConvergents.length - 1;
      const currentConv = this.currentConvergents[currentIndex];

      // Update basic info
      this.currentConvergentElement.textContent = `C${currentIndex}`;
      this.totalConvergentsElement.textContent = this.currentConvergents.length; // Only valid ones

      // Calculate distance to unit circle with full precision
      const distance = Math.abs(currentConv.magnitude() - 1);
      this.distanceToUnitCircleElement.textContent = distance.toFixed(17).replace(/\.?0+$/, '');
        
      // Update trigonometric comparison (use last generated angle)
      if (this.lastGeneratedAngle !== null) {
          this.updateTrigComparison(currentConv, this.lastGeneratedAngle);
      }
    }
  }

  drawScene() {
    this.drawComplexPlane();
    this.drawConvergents();
  }

  updateCoefficientsList(coefficients, redundantStartIndex) {
    this.coefficientsList.innerHTML = '';

    coefficients.forEach((coeff, index) => {
      const coeffElement = document.createElement('div');
      coeffElement.className = 'point-item';

      // Determine if this coefficient is redundant
      if (redundantStartIndex >= 0 && index >= redundantStartIndex) {
        coeffElement.classList.add('redundant');
      } else {
        coeffElement.classList.add('valid');
      }

      // Display coefficient as integers
      const realInt = Math.round(coeff.re);
      const imagInt = Math.round(coeff.im);
      const sign = imagInt >= 0 ? '+' : '';
      coeffElement.textContent = `a${index}: ${realInt} ${sign} ${imagInt}i`;
      this.coefficientsList.appendChild(coeffElement);
    });
  }

  updateConvergentsList(convergents, redundantStartIndex) {
    this.convergentsList.innerHTML = '';

    convergents.forEach((conv, index) => {
      const convElement = document.createElement('div');
      convElement.className = 'point-item';

      // Determine if this convergent is redundant
      if (redundantStartIndex >= 0 && index >= redundantStartIndex) {
        convElement.classList.add('redundant');
      } else {
        convElement.classList.add('valid');
      }

      // Display convergent with precision
      const realStr = conv.re.toFixed(17).replace(/\.?0+$/, '');
      const imagStr = Math.abs(conv.im).toFixed(17).replace(/\.?0+$/, '');
      const sign = conv.im >= 0 ? '+' : '-';
      convElement.textContent = `C${index}: ${realStr} ${sign} ${imagStr}i`;
      this.convergentsList.appendChild(convElement);
    });
  }

  generateAndPlot() {
    const angle = parseFloat(this.angleInput.value);

    if (isNaN(angle)) {
      alert('Please enter a valid angle value.');
      return;
    }
    
    // Store the angle for trigonometric comparison
    this.lastGeneratedAngle = angle;

    // Stop any existing animation
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.isAnimating = false;
    }

    // Reset view to default (1:1 zoom, centered)
    this.resetView();

    // Reset animation state
    this.currentStep = 0;

    try {
      // Generate coefficients with fixed count
      const { d: denominator } = this._toRational(angle);
      const coefficients = generateCoefficients(denominator, this.COEFFICIENT_COUNT);

      // Calculate convergents
      const allConvergents = expWithConvergents(angle, this.COEFFICIENT_COUNT);

      // Find where convergents become redundant
      const redundantStartIndex = this.findConvergenceIndex(allConvergents);

      // Store only valid convergents (for canvas display)
      if (redundantStartIndex >= 0) {
        this.currentConvergents = allConvergents.slice(0, redundantStartIndex);
      } else {
        this.currentConvergents = allConvergents;
      }

      // Update displays with redundancy information
      this.updateCoefficientsList(coefficients, redundantStartIndex);
      this.updateConvergentsList(allConvergents, redundantStartIndex);

      // Draw the scene
      this.drawScene();

      // Start animation (only for valid convergents)
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

    // Animate only valid convergents
    this.animationInterval = setInterval(() => {
      this.currentStep++;
      this.drawScene();

      // Stop when we've shown all valid convergents
      if (this.currentStep >= this.currentConvergents.length) {
        clearInterval(this.animationInterval);
        this.isAnimating = false;
        // Show final state
        this.drawScene();
      }
    }, 100); // 0.8 seconds per step
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

  zoomToLastConvergent() {
    // Use currentConvergents which already excludes redundant convergents
    if (this.currentConvergents.length < 2) {
      alert('Need at least 2 valid convergents to zoom.');
      return;
    }

    const lastIndex = this.currentConvergents.length - 1;
    const lastConv = this.currentConvergents[lastIndex];
    const prevConv = this.currentConvergents[lastIndex - 1]; // Second-to-last is guaranteed to exist

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

  /**
 * Update the trigonometric comparison display
 * @param {Complex} convergent - The latest convergent
 * @param {number} angle - Angle in radians
 */

  updateTrigComparison(convergent, angle) {
    // Store the angle for potential reuse
    this.lastGeneratedAngle = angle;

    // Get JavaScript's trigonometric values
    const jsCos = Math.cos(angle);
    const jsSin = Math.sin(angle);
    let jsTan;

    // Handle tangent (avoid division by zero)
    if (Math.abs(jsCos) < 1e-15) {
      jsTan = jsSin > 0 ? Infinity : -Infinity;
    } else {
      jsTan = Math.tan(angle);
    }

    // Our convergent values (cos = real part, sin = imaginary part)
    const convCos = convergent.re;
    const convSin = convergent.im;
    let convTan;

    // Calculate our tangent (handle division by zero)
    if (Math.abs(convCos) < 1e-15) {
      convTan = convSin > 0 ? Infinity : -Infinity;
    } else {
      convTan = convSin / convCos;
    }

    // Calculate differences
    const diffCos = Math.abs(jsCos - convCos);
    const diffSin = Math.abs(jsSin - convSin);
    let diffTan;

    // Handle special cases for tangent difference
    if (Math.abs(jsTan) === Infinity && Math.abs(convTan) === Infinity) {
      // Both are infinite - check if they have same sign
      diffTan = (jsTan === convTan) ? 0 : Infinity;
    } else if (Math.abs(jsTan) === Infinity || Math.abs(convTan) === Infinity) {
      // One is infinite, the other is not
      diffTan = Infinity;
    } else {
      diffTan = Math.abs(jsTan - convTan);
    }

    // Formatting function for full double precision (17 digits)
    const formatFullPrecision = (value) => {
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

      // Use toPrecision(17) for maximum double precision
      if (absValue >= 1e15 || absValue <= 1e-15) {
        // For extremely large or small numbers, use scientific notation
        return value.toExponential(16); // 16 digits after decimal in scientific notation
      }

      // For regular numbers, use toFixed(17)
      return value.toFixed(17);
    };

    // Clean trailing zeros
    const cleanTrailingZeros = (str) => {
      return str.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
    };

    // Helper function to set value and tooltip
    const setValueWithTooltip = (element, value, isDiff = false) => {
      let formatted = formatFullPrecision(value);

      // For differences, use scientific notation for very small values
      if (isDiff) {
        const absValue = Math.abs(value);
        if (absValue < 1e-15) {
          formatted = value.toExponential(16);
        } else if (absValue < 1e-10) {
          formatted = value.toExponential(10);
        } else if (absValue < 0.0001) {
          formatted = value.toExponential(6);
        }
      }

      // Clean trailing zeros for fixed-point notation
      if (!formatted.includes('e') && !formatted.includes('∞')) {
        formatted = cleanTrailingZeros(formatted);
      }

      element.textContent = formatted;
      element.title = `${formatted}\nRaw value: ${value}`;
    };

    // Update cosine display
    setValueWithTooltip(this.convergentCosElement, convCos);
    setValueWithTooltip(this.jsCosElement, jsCos);
    setValueWithTooltip(this.diffCosElement, diffCos, true);

    // Update sine display
    setValueWithTooltip(this.convergentSinElement, convSin);
    setValueWithTooltip(this.jsSinElement, jsSin);
    setValueWithTooltip(this.diffSinElement, diffSin, true);

    // Update tangent display
    setValueWithTooltip(this.convergentTanElement, convTan);
    setValueWithTooltip(this.jsTanElement, jsTan);
    setValueWithTooltip(this.diffTanElement, diffTan, true);

    // Add highlight animation
    const highlightElement = (element) => {
      element.classList.remove('updated');
      void element.offsetWidth; // Trigger reflow
      element.classList.add('updated');
    };

    highlightElement(this.convergentCosElement);
    highlightElement(this.jsCosElement);
    highlightElement(this.diffCosElement);
    highlightElement(this.convergentSinElement);
    highlightElement(this.jsSinElement);
    highlightElement(this.diffSinElement);
    highlightElement(this.convergentTanElement);
    highlightElement(this.jsTanElement);
    highlightElement(this.diffTanElement);

    // Animate indicator bar
    this.convergenceBarElement.classList.add('animating');
    setTimeout(() => {
      this.convergenceBarElement.classList.remove('animating');
    }, 2000);

    // Update convergence indicator
    this.updateConvergenceIndicator(diffCos, diffSin, diffTan);
  }

  /**
   * Update the convergence quality indicator
   * @param {number} diffCos - Cosine difference
   * @param {number} diffSin - Sine difference
   * @param {number} diffTan - Tangent difference
   */
  updateConvergenceIndicator(diffCos, diffSin, diffTan) {
    // Calculate average error (skip tangent if it's problematic)
    const errors = [diffCos, diffSin];

    if (diffTan !== Infinity && !isNaN(diffTan)) {
      errors.push(diffTan);
    }

    const avgError = errors.reduce((sum, err) => sum + err, 0) / errors.length;

    // Convert error to convergence percentage (log scale)
    let convergencePercent;
    let statusText;

    if (avgError === 0) {
      convergencePercent = 100;
      statusText = "Perfect convergence! 🎯";
    } else if (avgError < 1e-15) {
      convergencePercent = 99.9;
      statusText = "Excellent convergence! ⭐";
    } else if (avgError < 1e-12) {
      convergencePercent = 99;
      statusText = "Very good convergence ✨";
    } else if (avgError < 1e-9) {
      convergencePercent = 95;
      statusText = "Good convergence ✓";
    } else if (avgError < 1e-6) {
      convergencePercent = 85;
      statusText = "Moderate convergence ~";
    } else if (avgError < 1e-3) {
      convergencePercent = 70;
      statusText = "Fair convergence";
    } else if (avgError < 0.1) {
      convergencePercent = 40;
      statusText = "Poor convergence";
    } else {
      convergencePercent = 10;
      statusText = "Needs more coefficients";
    }

    // Update the indicator bar
    this.convergenceBarElement.style.width = `${convergencePercent}%`;

    // Update status with color coding
    let statusColor;
    if (convergencePercent >= 90) statusColor = '#2ecc71';
    else if (convergencePercent >= 70) statusColor = '#f39c12';
    else statusColor = '#e74c3c';

    this.convergenceStatusElement.textContent = statusText;
    this.convergenceStatusElement.style.color = statusColor;

    // Add highlight animation
    const highlightElement = (element) => {
        element.classList.remove('updated');
        void element.offsetWidth; // Trigger reflow
        element.classList.add('updated');
    };
    
    highlightElement(this.convergentCosElement);
    highlightElement(this.jsCosElement);
    highlightElement(this.diffCosElement);
    highlightElement(this.convergentSinElement);
    highlightElement(this.jsSinElement);
    highlightElement(this.diffSinElement);
    highlightElement(this.convergentTanElement);
    highlightElement(this.jsTanElement);
    highlightElement(this.diffTanElement);
    
    // Animate indicator bar
    this.convergenceBarElement.classList.add('animating');
    setTimeout(() => {
        this.convergenceBarElement.classList.remove('animating');
    }, 2000);

    // Add tooltip with exact error
    this.convergenceStatusElement.title = `Average error: ${avgError.toExponential(6)}`;
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