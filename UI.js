// UI.js - User interface and visualization logic

import { generateCoefficients, expWithConvergents } from './Trig.js';

export class ComplexVisualizerUI {
  constructor() {
    // DOM elements
    this.angleInput = document.getElementById('angleInput');
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
      scale: 1.5,
      isDragging: false,
      lastMouseX: 0,
      lastMouseY: 0
    };
    
    // Current convergents and animation state
    this.currentConvergents = [];
    this.currentStep = 0;
    this.animationInterval = null;
    this.isAnimating = false;
    
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
    
    // Set up canvas event listeners for panning
    this.setupCanvasEvents();
    
    // Initial resize and draw
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    
    // Initial plot
    setTimeout(() => this.generateAndPlot(), 100);
  }
  
  setupCanvasEvents() {
    this.canvasContainer.addEventListener('mousedown', (e) => {
      this.viewState.isDragging = true;
      this.viewState.lastMouseX = e.clientX;
      this.viewState.lastMouseY = e.clientY;
      this.canvasContainer.style.cursor = 'grabbing';
    });
    
    this.canvasContainer.addEventListener('mousemove', (e) => {
      if (!this.viewState.isDragging) return;
      
      const deltaX = e.clientX - this.viewState.lastMouseX;
      const deltaY = e.clientY - this.viewState.lastMouseY;
      
      // Convert pixel movement to complex plane movement
      const scaleFactor = this.viewState.scale * (Math.min(this.complexCanvas.width, this.complexCanvas.height) / 10);
      this.viewState.centerX += deltaX / scaleFactor;
      this.viewState.centerY -= deltaY / scaleFactor;
      
      this.viewState.lastMouseX = e.clientX;
      this.viewState.lastMouseY = e.clientY;
      
      this.drawScene();
    });
    
    this.canvasContainer.addEventListener('mouseup', () => {
      this.viewState.isDragging = false;
      this.canvasContainer.style.cursor = 'move';
    });
    
    this.canvasContainer.addEventListener('mouseleave', () => {
      this.viewState.isDragging = false;
      this.canvasContainer.style.cursor = 'move';
    });
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
      
      // Draw convergent label
      this.ctx.fillStyle = '#2c3e50';
      this.ctx.font = i === this.currentConvergents.length - 1 ? 'bold 12px Arial' : '10px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`C${i + 1}`, point.x, point.y + (i === this.currentConvergents.length - 1 ? 25 : 20));
      
      // For the final convergent, also show the value with full precision
      if (i === this.currentConvergents.length - 1) {
        this.ctx.fillStyle = '#7f8c8d';
        this.ctx.font = '10px Arial';
        
        // Use toString method for consistent formatting
        const label = convergent.toString(10);
        // Truncate if too long (for display purposes)
        const displayLabel = label.length > 40 ? label.substring(0, 37) + '...' : label;
        
        this.ctx.fillText(
          displayLabel, 
          point.x, 
          point.y + 40
        );
      }
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
      scale: 1.5,
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
    
    let m = Math.floor(x);
    let x_ = 1 / (x - m);
    let p_ = 1, q_ = 0, p = m, q = 1;
    
    if (x === m) return { n: p, d: q };
    
    while (Math.abs(x - p / q) > Number.EPSILON) {
      m = Math.floor(x_);
      x_ = 1 / (x_ - m);
      [p_, q_, p, q] = [p, q, m * p + p_, m * q + q_];
    }
    
    return { n: p, d: q };
  }
}