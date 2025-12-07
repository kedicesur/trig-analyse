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
    this.zoomInButton = document.getElementById('zoomIn');
    this.zoomOutButton = document.getElementById('zoomOut');
    this.resetViewButton = document.getElementById('resetView');
    this.currentConvergentElement = document.getElementById('currentConvergent');
    this.totalConvergentsElement = document.getElementById('totalConvergents');
    this.distanceToUnitCircleElement = document.getElementById('distanceToUnitCircle');
    
    // Canvas context
    this.ctx = this.complexCanvas.getContext('2d');
    
    // View state for zooming and panning
    this.viewState = {
      centerX: 0,
      centerY: 0,
      scale: 4.0,
      isDragging: false,
      lastMouseX: 0,
      lastMouseY: 0
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
    this.zoomInButton.addEventListener('click', () => this.zoomIn());
    this.zoomOutButton.addEventListener('click', () => this.zoomOut());
    this.resetViewButton.addEventListener('click', () => this.resetView());
    
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
        const scaleFactor = this.viewState.scale * (Math.min(this.complexCanvas.width, this.complexCanvas.height) / 10);
        this.viewState.centerX += deltaX / scaleFactor;
        this.viewState.centerY -= deltaY / scaleFactor;
        
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
    
    // Mouse wheel zoom
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
        if (this.viewState.scale < 0.1) this.viewState.scale = 0.1;
      }
      
      // Get complex coordinates at mouse position after zoom (with same center)
      const complexAfterZoom = this.mapFromCanvas(mouseX, mouseY);
      
      // Adjust center to keep the point under the mouse stationary
      this.viewState.centerX += (complexBeforeZoom.real - complexAfterZoom.real);
      this.viewState.centerY += (complexBeforeZoom.imag - complexAfterZoom.imag);
      
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
    this.tooltip.style.position = 'absolute';
    this.tooltip.style.display = 'none';
    this.tooltip.style.background = 'rgba(255, 255, 255, 0.95)';
    this.tooltip.style.border = '1px solid #3498db';
    this.tooltip.style.borderRadius = '4px';
    this.tooltip.style.padding = '8px 12px';
    this.tooltip.style.fontFamily = 'monospace';
    this.tooltip.style.fontSize = '12px';
    this.tooltip.style.color = '#2c3e50';
    this.tooltip.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
    this.tooltip.style.pointerEvents = 'none';
    this.tooltip.style.zIndex = '1000';
    this.tooltip.style.maxWidth = '300px';
    this.tooltip.style.wordBreak = 'break-all';
    
    this.canvasContainer.appendChild(this.tooltip);
  }
  
  handleMouseMove(e) {
    const rect = this.complexCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Check if mouse is near any convergent point
    this.hoveredConvergent = null;
    const hoverRadius = 15; // pixels
    
    if (this.currentConvergents.length > 0) {
      const stepsToCheck = this.isAnimating ? 
        Math.min(this.currentStep + 1, this.currentConvergents.length) : 
        this.currentConvergents.length;
      
      for (let i = 0; i < stepsToCheck; i++) {
        const convergent = this.currentConvergents[i];
        const point = this.mapToCanvas(convergent.re, convergent.im);
        
        const distance = Math.sqrt(
          Math.pow(mouseX - point.x, 2) + 
          Math.pow(mouseY - point.y, 2)
        );
        
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
    
    this.tooltip.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 4px;">Convergent C${index + 1}</div>
      <div>${conv.toString(10)}</div>
      <div style="margin-top: 4px; font-size: 11px; color: #7f8c8d;">
        Magnitude: ${conv.magnitude().toFixed(10)}
      </div>
    `;
    
    // Position tooltip (avoid going off screen)
    const tooltipWidth = this.tooltip.offsetWidth;
    const tooltipHeight = this.tooltip.offsetHeight;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    let posX = x + 15;
    let posY = y - 15;
    
    // Adjust if tooltip would go off the right edge
    if (posX + tooltipWidth > windowWidth - 20) {
      posX = x - tooltipWidth - 15;
    }
    
    // Adjust if tooltip would go off the bottom edge
    if (posY + tooltipHeight > windowHeight - 20) {
      posY = windowHeight - tooltipHeight - 20;
    }
    
    // Adjust if tooltip would go off the top edge
    if (posY < 20) {
      posY = 20;
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
    }, 100);
  }
  
  resizeCanvas() {
    this.complexCanvas.width = this.canvasContainer.clientWidth;
    this.complexCanvas.height = this.canvasContainer.clientHeight;
    this.drawScene();
  }
  
  mapToCanvas(real, imag) {
    // Use the minimum of width and height to maintain aspect ratio
    const scaleFactor = this.viewState.scale * (Math.min(this.complexCanvas.width, this.complexCanvas.height) / 10);
    const x = this.complexCanvas.width / 2 + (real + this.viewState.centerX) * scaleFactor;
    const y = this.complexCanvas.height / 2 - (imag + this.viewState.centerY) * scaleFactor;
    return { x, y };
  }
  
  mapFromCanvas(x, y) {
    const scaleFactor = this.viewState.scale * (Math.min(this.complexCanvas.width, this.complexCanvas.height) / 10);
    const real = (x - this.complexCanvas.width / 2) / scaleFactor - this.viewState.centerX;
    const imag = (this.complexCanvas.height / 2 - y) / scaleFactor - this.viewState.centerY;
    return { real, imag };
  }
  
  drawComplexPlane() {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.complexCanvas.width, this.complexCanvas.height);
    
    // Draw background
    this.ctx.fillStyle = '#f8f9fa';
    this.ctx.fillRect(0, 0, this.complexCanvas.width, this.complexCanvas.height);
    
    // Determine grid spacing based on scale
    const gridSpacing = 1.0;
    
    // Calculate scale factor (same for both axes)
    const scaleFactor = this.viewState.scale * (Math.min(this.complexCanvas.width, this.complexCanvas.height) / 10);
    
    // Calculate grid step in complex coordinates
    const gridStep = gridSpacing / this.viewState.scale;
    
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
      
      // Draw label
      if (Math.abs(real) > 0.01) {
        this.ctx.fillStyle = '#7f8c8d';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(real.toFixed(4), pos.x, this.complexCanvas.height - 10);
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
      
      // Draw label
      if (Math.abs(imag) > 0.001) {
        this.ctx.fillStyle = '#7f8c8d';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(imag.toFixed(4) + 'i', 40, pos.y + 4);
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
    this.ctx.font = 'bold 14px Arial';
    this.ctx.textAlign = 'right';
    this.ctx.fillText('Imaginary (i)', 50, 20);
    
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Real', this.complexCanvas.width - 30, zeroY - 10);
    
    // Draw unit circle
    this.ctx.strokeStyle = '#e74c3c';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    
    const center = this.mapToCanvas(0, 0);
    const radius = scaleFactor;
    
    this.ctx.beginPath();
    this.ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    
    // Draw unit circle label
    this.ctx.fillStyle = '#e74c3c';
    this.ctx.font = 'bold 14px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Unit Circle', center.x + radius + 40, center.y);
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
      this.ctx.font = i === this.currentConvergents.length - 1 ? 'bold 12px Arial' : '10px Arial';
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
      this.distanceToUnitCircleElement.textContent = distance.toString();
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
      coeffElement.textContent = `a${index}: ${coeff.toString(10)}`;
      this.coefficientsList.appendChild(coeffElement);
    });
  }
  
  updateConvergentsList(convergents) {
    this.convergentsList.innerHTML = '';
    
    convergents.forEach((conv, index) => {
      const convElement = document.createElement('div');
      convElement.className = 'point-item';
      convElement.textContent = `C${index + 1}: ${conv.toString(10)}`;
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
  
  zoomIn() {
    this.viewState.scale *= 1.2;
    this.drawScene();
  }
  
  zoomOut() {
    this.viewState.scale /= 1.2;
    if (this.viewState.scale < 0.1) this.viewState.scale = 0.1;
    this.drawScene();
  }
  
  resetView() {
    this.viewState = {
      centerX: 0,
      centerY: 0,
      scale: 4.0,
      isDragging: false,
      lastMouseX: 0,
      lastMouseY: 0
    };
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