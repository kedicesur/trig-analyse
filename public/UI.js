
import { generateCoefficients, expWithConvergents } from './Trig.js';
import { toRational
       , toBigIntRational
       , formatFullPrecision
       , cleanTrailingZeros
       , formatDifference
       , highlightElement
       } from "./Utils.js";

export class ComplexVisualizerUI {
  constructor() {
    this.angleInput = document.getElementById('angleInput');
    this.numeratorInput = document.getElementById('numeratorInput');
    this.denominatorInput = document.getElementById('denominatorInput');
    this.piDropdown = document.getElementById('piDropdown');
    this.plotButton = document.getElementById('plotButton');
    this.generateRandomButton = document.getElementById('generateCoefficients');
    this.complexCanvas = document.getElementById('complexCanvas');
    this.canvasContainer = document.getElementById('canvasContainer');
    this.resetViewButton = document.getElementById('resetView');
    this.zoomToLastButton = document.getElementById('zoomToLast');
    this.zoomToReferenceButton = document.getElementById('zoomToReference');
    this.currentConvergentElement = document.getElementById('currentConvergent');
    this.totalConvergentsElement = document.getElementById('totalConvergents');
    this.distanceToUnitCircleElement = document.getElementById('distanceToUnitCircle');
    this.headerFormula = document.getElementById('headerFormula');

    this.ctx = this.complexCanvas.getContext('2d');

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

    this.COEFFICIENT_COUNT = 24;

    this.currentConvergents = [];
    this.currentStep = 0;
    this.animationInterval = null;
    this.isAnimating = false;
    this.allConvergents = [];
    this.redundantStartIndex = -1;
    this.REDUNDANT_DISPLAY_COUNT = 4;
    
    this.inputSource = 'decimal';

    this.tooltip = null;
    this.hoveredConvergent = null;
    this.tooltipTimeout = null;

    this.isUpdatingFromDecimal = false;
    this.isUpdatingFromRational = false;

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

    this.lastGeneratedAngle = null;

    this.cachedExactRational = null;

    this.init();
}

  init() {
    this.plotButton.addEventListener('click', () => this.generateAndPlot());
    this.generateRandomButton.addEventListener('click', () => {
      this.inputSource = 'decimal';
      this.generateRandomAngle();
    });
    this.resetViewButton.addEventListener('click', () => this.resetView());
    this.zoomToLastButton.addEventListener('click', () => this.zoomToLastConvergent());
    this.zoomToReferenceButton.addEventListener('click', () => this.zoomToReference());

    this.setupInputEvents();

    this.setupCanvasEvents();

    this.setupSynchronizedScrolling();

    this.createTooltip();

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    requestAnimationFrame(() => {
      this.updateRationalFromDecimal();
      this.generateAndPlot();
    });
  }

  setupInputEvents() {
    this.angleInput.addEventListener('input', () => {
      if (!this.isUpdatingFromRational) {
        this.inputSource = 'decimal';
        this.isUpdatingFromDecimal = true;
        this.updateRationalFromDecimal();
        this.isUpdatingFromDecimal = false;
      }
    });

    this.numeratorInput.addEventListener('input', () => {
      if (!this.isUpdatingFromDecimal) {
        this.inputSource = 'rational';
        this.isUpdatingFromRational = true;
        this.updateDecimalFromRational();
        this.isUpdatingFromRational = false;
      }
    });

    this.denominatorInput.addEventListener('input', () => {
      if (!this.isUpdatingFromDecimal) {
        this.inputSource = 'rational';
        this.isUpdatingFromRational = true;
        this.updateDecimalFromRational();
        this.isUpdatingFromRational = false;
      }
    });

    this.piDropdown.addEventListener('change', () => {
      if (!this.isUpdatingFromDecimal) {
        this.inputSource = 'rational';
        this.isUpdatingFromRational = true;
        this.updateDecimalFromRational();
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
        this.handleMouseMove(e);
      } else {
        const deltaX = e.clientX - this.viewState.lastMouseX;
        const deltaY = e.clientY - this.viewState.lastMouseY;

        const scaleFactor = this.viewState.scale * (Math.min(this.complexCanvas.width, this.complexCanvas.height) / 2.4);

        const newCenterX = this.viewState.centerX + deltaX / scaleFactor;
        const newCenterY = this.viewState.centerY - deltaY / scaleFactor;

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
      this.hideTooltip();
    });

    this.canvasContainer.addEventListener('wheel', (e) => {
      e.preventDefault();

      const rect = this.complexCanvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const complexBeforeZoom = this.mapFromCanvas(mouseX, mouseY);

      const zoomFactor = 1.2;
      if (e.deltaY < 0) {
        this.viewState.scale *= zoomFactor;
      } else {
        this.viewState.scale /= zoomFactor;
        if (this.viewState.scale < 1) this.viewState.scale = 1;
      }

      const complexAfterZoom = this.mapFromCanvas(mouseX, mouseY);

      const deltaX = complexBeforeZoom.real - complexAfterZoom.real;
      const deltaY = complexBeforeZoom.imag - complexAfterZoom.imag;

      this.viewState.centerX += deltaX;
      this.viewState.centerY += deltaY;

      this.drawScene();
    });
  }

  setupSynchronizedScrolling() {
  
    const indicesList = document.getElementById('indicesList');
    const coefficientsList = document.getElementById('coefficientsList');
    const baseConvergentsList = document.getElementById('baseConvergentsList');
    const finalConvergentsList = document.getElementById('finalConvergentsList');

    let isScrolling = false;

    const isVisible = (element) => {
      if (!element) return false;
      const style = window.getComputedStyle(element);
      return style.display !== 'none';
    };

    const getVisibleColumns = () => {
      const columns = [];
      if (isVisible(indicesList)) columns.push(indicesList);
      if (isVisible(coefficientsList)) columns.push(coefficientsList);
      if (isVisible(baseConvergentsList)) columns.push(baseConvergentsList);
      if (isVisible(finalConvergentsList)) columns.push(finalConvergentsList);
      return columns;
    };

    const synchronizeScroll = (sourceElement) => {
      if (isScrolling) return;
      isScrolling = true;

      const visibleColumns = getVisibleColumns();
      const scrollTop = sourceElement.scrollTop;

      requestAnimationFrame(() => {
        visibleColumns.forEach(column => {
          if (column !== sourceElement) {
            column.scrollTop = scrollTop;
          }
        });
        isScrolling = false;
      });
    };

    const columns = [indicesList, coefficientsList, baseConvergentsList, finalConvergentsList];
    columns.forEach(column => {
      if (column) {
        column.addEventListener('scroll', (e) => {
          synchronizeScroll(e.currentTarget);
        }, { passive: true });
      }
    });

    window.addEventListener('resize', () => {
      // No action needed - the scroll event listeners will automatically
      // work with the currently visible columns
    });
  }

  parsePiValue(piStr) {
    if (piStr === '1') return 1;
    if (piStr.includes('/')) {
      const [num, den] = piStr.split('/').map(Number);
      return num / den;
    }
    return parseFloat(piStr);
  }

  updateRationalFromDecimal() {
    const decimal = parseFloat(this.angleInput.value);
    if (isNaN(decimal)) return;

    const piStr = this.piDropdown.value;
    const piValue = this.parsePiValue(piStr);

    const angleWithoutPi = decimal / piValue;

    const rational = toRational(angleWithoutPi);

    this.isUpdatingFromDecimal = true;
    
    this.numeratorInput.value = rational.n;
    this.denominatorInput.value = rational.d;
    
    this.isUpdatingFromDecimal = false;
    
    this.cachedExactRational = toBigIntRational(decimal);

    this.updateHeaderFormula();
  }

  updateDecimalFromRational() {
    const numerator = parseFloat(this.numeratorInput.value);
    const denominator = parseFloat(this.denominatorInput.value);

    if (isNaN(numerator) || isNaN(denominator) || denominator === 0) {
      return;
    }

    const piStr = this.piDropdown.value;
    
    let piNum = 1;
    let piDen = 1;

    if (piStr === '1') {
        piNum = 1;
        piDen = 1;
    } else if (piStr.includes('/')) {
        const parts = piStr.split('/');
        piNum = parseFloat(parts[0]);
        piDen = parseFloat(parts[1]);
    } else {
        piNum = parseFloat(piStr);
        piDen = 1;
    }

    const combinedNumerator = numerator * piNum;
    const combinedDenominator = denominator * piDen;
    const decimal = combinedNumerator / combinedDenominator;

    this.isUpdatingFromRational = true;
    
    this.angleInput.value = decimal;
    
    this.isUpdatingFromRational = false;
    
    this.cachedExactRational = toBigIntRational(decimal);

    this.updateHeaderFormula();
  }

  createTooltip() {
    this.tooltip = document.createElement('div');
    this.tooltip.id = 'convergentTooltip';
    this.tooltip.className = 'convergent-tooltip';
    this.tooltip.style.display = 'none';

    this.tooltip.style.position = 'absolute';
    this.tooltip.style.zIndex = '1000';

    this.canvasContainer.appendChild(this.tooltip);
  }

  handleMouseMove(e) {
    const rect = this.complexCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    this.hoveredConvergent = null;
    const hoverRadius = 20;

    if (this.currentConvergents.length > 0) {
      const stepsToCheck = this.isAnimating ?
        Math.min(this.currentStep + 1, this.currentConvergents.length) :
        this.currentConvergents.length;

      for (let i = 0; i < stepsToCheck; i++) {
        const convergent = this.currentConvergents[i];
        const convFloat = convergent.toFloat();
        const point = this.mapToCanvas(convFloat.re, convFloat.im);

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

    const convFloat = conv.toFloat();
    
    const realStr = convFloat.re.toFixed(16).replace(/\.?0+$/, '');
    const imagStr = Math.abs(convFloat.im).toFixed(16).replace(/\.?0+$/, '');
    const sign = convFloat.im >= 0 ? '+' : '-';
    const magnitudeStr = conv.magnitude().toFixed(16).replace(/\.?0+$/, '');

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


    let posX;
    if (convPoint.x < containerWidth / 2) {
      posX = convPoint.x + 15;
    } else {
      posX = convPoint.x - tooltipWidth - 15;
    }

    let posY;
    if (convPoint.y < containerHeight / 2) {
      posY = convPoint.y + 15;
    } else {
      posY = convPoint.y - tooltipHeight - 15;
    }

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
    const container = this.canvasContainer;
    const displayWidth = container.clientWidth;
    const displayHeight = container.clientHeight;

    if (this.complexCanvas.width !== displayWidth || this.complexCanvas.height !== displayHeight) {
      this.complexCanvas.width = displayWidth;
      this.complexCanvas.height = displayHeight;
      this.drawScene();
    }
  }

  mapToCanvas(real, imag) {
    const canvasSize = this.complexCanvas.width; 
    const boundsRange = 2.4;

    const scaleFactor = (canvasSize / boundsRange) * this.viewState.scale;

    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;

    const x = centerX + (real + this.viewState.centerX) * scaleFactor;
    const y = centerY - (imag + this.viewState.centerY) * scaleFactor;

    return { x, y };
  }

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

  getTrueReferenceAngle() {
    if (!this.cachedExactRational || this.cachedExactRational.d === 0n) {
      return null;
    }
    return Number(this.cachedExactRational.n) / Number(this.cachedExactRational.d);
  }

  drawVisibleUnitCircle() {
    this.ctx.strokeStyle = '#e74c3c';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);

    const topLeft = this.mapFromCanvas(0, 0);
    const bottomRight = this.mapFromCanvas(this.complexCanvas.width, this.complexCanvas.height);

    const viewport = {
      minReal: Math.min(topLeft.real, bottomRight.real),
      maxReal: Math.max(topLeft.real, bottomRight.real),
      minImag: Math.min(topLeft.imag, bottomRight.imag),
      maxImag: Math.max(topLeft.imag, bottomRight.imag)
    };

    const circleRadius = 1;
    const circleVisible =
      viewport.minReal <= circleRadius && viewport.maxReal >= -circleRadius &&
      viewport.minImag <= circleRadius && viewport.maxImag >= -circleRadius;

    if (!circleVisible) {
      this.ctx.setLineDash([]);
      return;
    }

    let startAngle = 0;
    let endAngle = 2 * Math.PI;

    const originInViewport =
      viewport.minReal <= 0 && viewport.maxReal >= 0 &&
      viewport.minImag <= 0 && viewport.maxImag >= 0;

    if (!originInViewport) {
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

      if (endAngle - startAngle > Math.PI * 1.5) {
        startAngle = 0;
        endAngle = 2 * Math.PI;
      }
    }

    this.drawUnitCircleArc(startAngle, endAngle);
    this.ctx.setLineDash([]);
  }

  drawUnitCircleArc(startAngle, endAngle) {
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
    this.ctx.clearRect(0, 0, this.complexCanvas.width, this.complexCanvas.height);

    this.ctx.fillStyle = '#f8f9fa';
    this.ctx.fillRect(0, 0, this.complexCanvas.width, this.complexCanvas.height);

    const gridStep = 0.2;

    const topLeft = this.mapFromCanvas(0, 0);
    const bottomRight = this.mapFromCanvas(this.complexCanvas.width, this.complexCanvas.height);
    const minReal = Math.min(topLeft.real, bottomRight.real);
    const maxReal = Math.max(topLeft.real, bottomRight.real);
    const minImag = Math.min(topLeft.imag, bottomRight.imag);
    const maxImag = Math.max(topLeft.imag, bottomRight.imag);

    this.ctx.strokeStyle = '#e0e0e0';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([]);

    const firstVerticalLine = Math.ceil(minReal / gridStep) * gridStep;
    for (let real = firstVerticalLine; real <= maxReal; real += gridStep) {
      const pos = this.mapToCanvas(real, 0);
      this.ctx.beginPath();
      this.ctx.moveTo(pos.x, 0);
      this.ctx.lineTo(pos.x, this.complexCanvas.height);
      this.ctx.stroke();

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

    const firstHorizontalLine = Math.ceil(minImag / gridStep) * gridStep;
    for (let imag = firstHorizontalLine; imag <= maxImag; imag += gridStep) {
      const pos = this.mapToCanvas(0, imag);
      this.ctx.beginPath();
      this.ctx.moveTo(0, pos.y);
      this.ctx.lineTo(this.complexCanvas.width, pos.y);
      this.ctx.stroke();

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

    this.ctx.strokeStyle = '#2c3e50';
    this.ctx.lineWidth = 2;

    const zeroY = this.mapToCanvas(0, 0).y;
    this.ctx.beginPath();
    this.ctx.moveTo(0, zeroY);
    this.ctx.lineTo(this.complexCanvas.width, zeroY);
    this.ctx.stroke();

    const zeroX = this.mapToCanvas(0, 0).x;
    this.ctx.beginPath();
    this.ctx.moveTo(zeroX, 0);
    this.ctx.lineTo(zeroX, this.complexCanvas.height);
    this.ctx.stroke();

    this.ctx.fillStyle = '#2c3e50';
    this.ctx.font = 'bold 14px Open Sans';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('Imaginary (i)', zeroX + 10, 30);

    this.ctx.textAlign = 'center';
    this.ctx.fillText('Real', this.complexCanvas.width - 30, zeroY - 10);

    this.drawVisibleUnitCircle();

    const center = this.mapToCanvas(0, 0);
    const radiusPoint = this.mapToCanvas(1, 0);
    const radius = Math.abs(radiusPoint.x - center.x);
    this.ctx.fillStyle = '#e74c3c';
    this.ctx.font = 'bold 14px Open Sans';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Unit Circle', center.x + radius/Math.sqrt(2)+30, center.y + radius/Math.sqrt(2)+30);
  }

  drawConvergents() {
    if (this.currentConvergents.length === 0) return;

    this.ctx.strokeStyle = '#3498db';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();

    const firstFloat = this.currentConvergents[0].toFloat();
    const firstPoint = this.mapToCanvas(firstFloat.re, firstFloat.im);
    this.ctx.moveTo(firstPoint.x, firstPoint.y);

    const stepsToShow = this.isAnimating ?
      Math.min(this.currentStep + 1, this.currentConvergents.length) :
      this.currentConvergents.length;

    for (let i = 1; i < stepsToShow; i++) {
      const convFloat = this.currentConvergents[i].toFloat();
      const point = this.mapToCanvas(convFloat.re, convFloat.im);
      this.ctx.lineTo(point.x, point.y);
    }

    this.ctx.stroke();

    for (let i = 0; i < stepsToShow; i++) {
      const convergent = this.currentConvergents[i];
      const convFloat = convergent.toFloat();
      const point = this.mapToCanvas(convFloat.re, convFloat.im);

      let color;
      if (i === stepsToShow - 1 && this.isAnimating) {
        color = '#e74c3c';
      } else if (i === this.currentConvergents.length - 1) {
        color = '#2ecc71';
      } else {
        color = '#3498db';
      }

      this.ctx.fillStyle = color;
      this.ctx.beginPath();

      const radius = (i === stepsToShow - 1 && this.isAnimating) || i === this.currentConvergents.length - 1 ? 8 : 6;
      this.ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.strokeStyle = 'white';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      this.ctx.fillStyle = '#2c3e50';
      this.ctx.font = i === this.currentConvergents.length - 1 ? 'bold 12px Open Sans' : '10px Open Sans';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`C${i}`, point.x, point.y + (i === this.currentConvergents.length - 1 ? 25 : 20));
    }

    if (this.currentConvergents.length > 0) {
      const currentIndex = this.isAnimating ?
        Math.min(this.currentStep, this.currentConvergents.length - 1) :
        this.currentConvergents.length - 1;
      const currentConv = this.currentConvergents[currentIndex];

      this.currentConvergentElement.textContent = `C${currentIndex}`;
      this.totalConvergentsElement.textContent = this.currentConvergents.length;

      const distance = Math.abs(currentConv.magnitude() - 1);
      this.distanceToUnitCircleElement.textContent = distance.toFixed(16).replace(/\.?0+$/, '');
        
      if (this.lastGeneratedAngle !== null) {
          this.updateTrigComparison(currentConv);
      }
    }

    if (this.redundantStartIndex >= 0 && Array.isArray(this.allConvergents) && this.allConvergents.length > this.redundantStartIndex) {
      const start = this.redundantStartIndex;
      const end = Math.min(this.allConvergents.length, start + this.REDUNDANT_DISPLAY_COUNT);

      const prevAlpha = this.ctx.globalAlpha;
      this.ctx.globalAlpha = 0.45;

      for (let i = start; i < end; i++) {
        const convergent = this.allConvergents[i];
        const convFloat = convergent.toFloat();
        const point = this.mapToCanvas(convFloat.re, convFloat.im);

        const baseColor = '#f8d7da';

        this.ctx.fillStyle = baseColor;
        this.ctx.beginPath();
        this.ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();

        this.ctx.globalAlpha = 1.0;
        this.ctx.fillStyle = '#2c3e50';
        this.ctx.font = '10px Open Sans';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`C${i}`, point.x, point.y - 10);
        this.ctx.globalAlpha = 0.45;
      }

      this.ctx.globalAlpha = prevAlpha;
    }
  }

  drawScene() {
    this.drawComplexPlane();
    this.drawConvergents();
    this.drawJSComparison();
  }

  drawJSComparison() {
    const refAngle = this.getTrueReferenceAngle();
    if (refAngle === null) return;

    const jsRe = Math.cos(refAngle);
    const jsIm = Math.sin(refAngle);
    const point = this.mapToCanvas(jsRe, jsIm);

    this.ctx.fillStyle = '#9b59b6';
    this.ctx.beginPath();
    
    const size = 6;
    this.ctx.fillRect(point.x - size, point.y - size, size * 2, size * 2);
    
    this.ctx.strokeStyle = 'white';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(point.x - size, point.y - size, size * 2, size * 2);

    this.ctx.fillStyle = '#8e44ad';
    this.ctx.font = 'bold 11px Open Sans';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('JS', point.x, point.y - 15);
  }

  updateResultsGrid(coefficients, baseConvergents, finalConvergents, redundantStartIndex, mathLimitIndex) {
    
    
    const indicesList = document.getElementById('indicesList');
    const coefficientsList = document.getElementById('coefficientsList');
    const baseConvergentsList = document.getElementById('baseConvergentsList');
    const finalConvergentsList = document.getElementById('finalConvergentsList');
    
    if (!indicesList || !coefficientsList || !baseConvergentsList || !finalConvergentsList) return;

    indicesList.innerHTML = '';
    coefficientsList.innerHTML = '';
    baseConvergentsList.innerHTML = '';
    finalConvergentsList.innerHTML = '';

    const count = Math.max(coefficients.length, baseConvergents.length, finalConvergents.length);

    for (let i = 0; i < count; i++) {
        const isRedundant = redundantStartIndex >= 0 && i >= redundantStartIndex;
        const isMathLimit = i === mathLimitIndex;
        const className = `point-item ${isRedundant ? 'redundant' : 'valid'} ${isMathLimit ? 'math-limit' : ''}`;

        const indexEl = document.createElement('div');
        indexEl.className = className;
        indexEl.textContent = i;
        indicesList.appendChild(indexEl);

        const coeffEl = document.createElement('div');
        coeffEl.className = className;
        coeffEl.setAttribute('data-index', i);
        if (i < coefficients.length) {
            const c = coefficients[i];
            const cFloat = c.toFloat();
            const realInt = Math.round(cFloat.re);
            const imagInt = Math.round(cFloat.im);
            const sign = imagInt >= 0 ? '+' : '';
            coeffEl.textContent = `${realInt} ${sign} ${imagInt}i`;
        }
        coefficientsList.appendChild(coeffEl);

        const baseEl = document.createElement('div');
        baseEl.className = className;
        baseEl.setAttribute('data-index', i);
        if (i < baseConvergents.length) {
            const b = baseConvergents[i];
            const bFloat = b.toFloat();
            const realStr = bFloat.re.toFixed(17);
            const imagStr = Math.abs(bFloat.im).toFixed(17);
            const sign = bFloat.im >= 0 ? '+' : '-';
            baseEl.textContent = `${realStr} ${sign} ${imagStr}i`;
        }
        baseConvergentsList.appendChild(baseEl);

        const finalEl = document.createElement('div');
        finalEl.className = className;
        finalEl.setAttribute('data-index', i);
        if (i < finalConvergents.length) {
            const f = finalConvergents[i];
            const fFloat = f.toFloat();
            const realStr = fFloat.re.toFixed(17);
            const imagStr = Math.abs(fFloat.im).toFixed(17);
            const sign = fFloat.im >= 0 ? '+' : '-';
            finalEl.textContent = `${realStr} ${sign} ${imagStr}i`;
        }
        finalConvergentsList.appendChild(finalEl);
    }
  }

  displayIterationMetrics(iterationMetrics) {
    const summaryContainer = document.getElementById('iterationMetricsSummary');
    if (!summaryContainer) return;

    const convergentIterValue = document.getElementById('convergentIterationsValue');
    const exponentiationIterValue = document.getElementById('exponentiationIterationsValue');
    const totalIterValue = document.getElementById('totalIterationsValue');

    if (convergentIterValue && exponentiationIterValue && totalIterValue) {
      convergentIterValue.textContent = iterationMetrics.convergentIterations;
      exponentiationIterValue.textContent = iterationMetrics.exponentIterations;
      totalIterValue.textContent = iterationMetrics.totalIterations;
      
      summaryContainer.style.display = 'block';
    }
  }

  generateAndPlot() {
    const angle = parseFloat(this.angleInput.value);

    if (isNaN(angle)) {
      alert('Please enter a valid angle value.');
      return;
    }
    
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.isAnimating = false;
    }

    this.resetView();

    this.currentStep = 0;

    try {

    let minimalRational = this.cachedExactRational;
    if (!minimalRational) {
        minimalRational = toBigIntRational(angle);
        this.cachedExactRational = minimalRational;
    }
    
    this.updateHeaderFormula();

    let angleForCalculation = angle;
    if (minimalRational && minimalRational.d !== 0n) {
        angleForCalculation = Number(minimalRational.n) / Number(minimalRational.d);
    }
    this.lastGeneratedAngle = angleForCalculation;
    
    const coefficients = generateCoefficients(Number(minimalRational.d), this.COEFFICIENT_COUNT);

    const { 
      baseConvergents, 
      finalConvergents: allConvergents, 
      mathLimitIndex,
      iterationMetrics 
    } = expWithConvergents(angleForCalculation, this.COEFFICIENT_COUNT, minimalRational);

      const redundantStartIndex = mathLimitIndex >= 0 ? mathLimitIndex + 1 : -1;

      this.allConvergents = allConvergents;
      this.redundantStartIndex = redundantStartIndex;

      if (redundantStartIndex >= 0) {
        this.currentConvergents = allConvergents.slice(0, redundantStartIndex);
      } else {
        this.currentConvergents = allConvergents;
      }

      this.updateResultsGrid(coefficients, baseConvergents, allConvergents, redundantStartIndex, mathLimitIndex);

      this.displayIterationMetrics(iterationMetrics);

      this.drawScene();

      this.startAnimation();
    } catch (error) {
      alert(`Error: ${error.message}`);
      console.error(error);
    }
  }

  startAnimation() {
    if (this.currentConvergents.length === 0) return;

    if (this.animationInterval) {
      clearInterval(this.animationInterval);
    }

    this.isAnimating = true;
    this.currentStep = 0;

    this.animationInterval = setInterval(() => {
      this.currentStep++;
      this.drawScene();

      if (this.currentStep >= this.currentConvergents.length) {
        clearInterval(this.animationInterval);
        this.isAnimating = false;
        this.drawScene();
      }
    }, 100);
  }

  generateRandomAngle() {
    const randomAngle = (Math.random() * 2 * Math.PI).toFixed(6);
    this.angleInput.value = randomAngle;

    this.angleInput.dispatchEvent(new Event('input'));

    setTimeout(() => {
        this.generateAndPlot();
    }, 0);
  }

  resetView() {
    this.viewState = {
      centerX: 0,
      centerY: 0,
      scale: 1.0,
      isDragging: false,
      lastMouseX: 0,
      lastMouseY: 0
    };
    this.drawScene();
  }

  zoomToLastConvergent() {
    if (this.currentConvergents.length < 2) {
      alert('Need at least 2 valid convergents to zoom.');
      return;
    }

    const lastIndex = this.currentConvergents.length - 1;
    const lastConv = this.currentConvergents[lastIndex].toFloat();
    const prevConv = this.currentConvergents[lastIndex - 1].toFloat();

    const minReal = Math.min(lastConv.re, prevConv.re);
    const maxReal = Math.max(lastConv.re, prevConv.re);
    const minImag = Math.min(lastConv.im, prevConv.im);
    const maxImag = Math.max(lastConv.im, prevConv.im);

    const centerReal = (minReal + maxReal) / 2;
    const centerImag = (minImag + maxImag) / 2;

    let width = maxReal - minReal;
    let height = maxImag - minImag;

    const minSize = 1e-15;
    if (width < minSize) width = minSize;
    if (height < minSize) height = minSize;

    const padding = 0.2;
    const paddedWidth = width * (1 + 2 * padding);
    const paddedHeight = height * (1 + 2 * padding);

    const canvasSize = this.complexCanvas.width;
    const boundsRange = 2.4;

    const requiredScaleX = canvasSize / paddedWidth;
    const requiredScaleY = canvasSize / paddedHeight;
    const requiredScale = Math.min(requiredScaleX, requiredScaleY) * (boundsRange / canvasSize);

    this.viewState.centerX = -centerReal;
    this.viewState.centerY = -centerImag;
    this.viewState.scale = requiredScale * 1.1;

    if (this.viewState.scale < 0.8) {
      this.viewState.scale = 0.8;
    }

    this.drawScene();
  }

  zoomToReference() {
    const refAngle = this.getTrueReferenceAngle();
    if (this.currentConvergents.length === 0 || refAngle === null) {
      alert('Need valid convergents and reference angle to zoom.');
      return;
    }

    const refRe = Math.cos(refAngle);
    const refIm = Math.sin(refAngle);

    const lastConv = this.currentConvergents[this.currentConvergents.length - 1].toFloat();

    const minReal = Math.min(lastConv.re, refRe);
    const maxReal = Math.max(lastConv.re, refRe);
    const minImag = Math.min(lastConv.im, refIm);
    const maxImag = Math.max(lastConv.im, refIm);

    const centerReal = (minReal + maxReal) / 2;
    const centerImag = (minImag + maxImag) / 2;

    let width = maxReal - minReal;
    let height = maxImag - minImag;

    const minSize = 1e-15;
    if (width < minSize) width = minSize;
    if (height < minSize) height = minSize;

    const padding = 0.2;
    const paddedWidth = width * (1 + 2 * padding);
    const paddedHeight = height * (1 + 2 * padding);

    const canvasSize = this.complexCanvas.width;
    const boundsRange = 2.4;

    const requiredScaleX = canvasSize / paddedWidth;
    const requiredScaleY = canvasSize / paddedHeight;
    const requiredScale = Math.min(requiredScaleX, requiredScaleY) * (boundsRange / canvasSize);

    this.viewState.centerX = -centerReal;
    this.viewState.centerY = -centerImag;
    this.viewState.scale = requiredScale * 1.1;

    if (this.viewState.scale < 0.8) {
      this.viewState.scale = 0.8;
    }

    this.drawScene();
  }


  updateTrigComparison(convergent) {
    const refAngle = this.getTrueReferenceAngle();
    if (refAngle === null) return;
    
    const jsCos = Math.cos(refAngle);
    const jsSin = Math.sin(refAngle);
    let jsTan;

    if (Math.abs(jsCos) < 1e-15) {
      jsTan = jsSin > 0 ? Infinity : -Infinity;
    } else {
      jsTan = Math.tan(refAngle);
    }

    const convFloat = convergent.toFloat();
    const convCos = convFloat.re;
    const convSin = convFloat.im;
    let convTan;

    if (convergent.re.n === 0n) {
      convTan = convergent.im.n > 0n ? Infinity : -Infinity;
    } else {
      const tanRational = {
        n: convergent.im.n * convergent.re.d,
        d: convergent.im.d * convergent.re.n
      };
      
      if (tanRational.d < 0n) {
        tanRational.n = -tanRational.n;
        tanRational.d = -tanRational.d;
      }
      
      convTan = Number(tanRational.n) / Number(tanRational.d);
    }

    const diffCos = Math.abs(jsCos - convCos);
    const diffSin = Math.abs(jsSin - convSin);
    let diffTan;

    if (Math.abs(jsTan) === Infinity && Math.abs(convTan) === Infinity) {
      diffTan = (jsTan === convTan) ? 0 : Infinity;
    } else if (Math.abs(jsTan) === Infinity || Math.abs(convTan) === Infinity) {
      diffTan = Infinity;
    } else {
      diffTan = Math.abs(jsTan - convTan);
    }

    const setValueWithTooltip = (element, value, isDiff = false) => {
      let formatted = isDiff ? formatDifference(value) : formatFullPrecision(value);
      
      if (!formatted.includes('e') && !formatted.includes('∞')) {
        formatted = cleanTrailingZeros(formatted);
      }

      element.textContent = formatted;
      element.title = `${formatted}\nRaw value: ${value}`;
    };

    setValueWithTooltip(this.convergentCosElement, convCos);
    setValueWithTooltip(this.jsCosElement, jsCos);
    setValueWithTooltip(this.diffCosElement, diffCos, true);

    setValueWithTooltip(this.convergentSinElement, convSin);
    setValueWithTooltip(this.jsSinElement, jsSin);
    setValueWithTooltip(this.diffSinElement, diffSin, true);

    setValueWithTooltip(this.convergentTanElement, convTan);
    setValueWithTooltip(this.jsTanElement, jsTan);
    setValueWithTooltip(this.diffTanElement, diffTan, true);

    highlightElement(this.convergentCosElement);
    highlightElement(this.jsCosElement);
    highlightElement(this.diffCosElement);
    highlightElement(this.convergentSinElement);
    highlightElement(this.jsSinElement);
    highlightElement(this.diffSinElement);
    highlightElement(this.convergentTanElement);
    highlightElement(this.jsTanElement);
    highlightElement(this.diffTanElement);

    this.updateConvergenceIndicator(diffCos, diffSin, diffTan);
  }

  updateConvergenceIndicator(diffCos, diffSin, diffTan) {
    const errors = [diffCos, diffSin];

    if (diffTan !== Infinity && !isNaN(diffTan)) {
      errors.push(diffTan);
    }

    const avgError = errors.reduce((sum, err) => sum + err, 0) / errors.length;

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

    this.convergenceBarElement.style.width = `${convergencePercent}%`;

    let statusColor;
    if (convergencePercent >= 90) statusColor = '#2ecc71';
    else if (convergencePercent >= 70) statusColor = '#f39c12';
    else statusColor = '#e74c3c';

    this.convergenceStatusElement.textContent = statusText;
    this.convergenceStatusElement.style.color = statusColor;

    this.convergenceBarElement.classList.add('animating');
    setTimeout(() => {
        this.convergenceBarElement.classList.remove('animating');
    }, 2000);

    this.convergenceStatusElement.title = `Average error: ${avgError.toExponential(6)}`;
  }

  updateHeaderFormula() {
    if (!this.headerFormula || !this.cachedExactRational) return;
    
    const { n, d } = this.cachedExactRational;
    
    let nFinal = n;
    let dFinal = d;
    if (dFinal < 0n) {
        nFinal = -nFinal;
        dFinal = -dFinal;
    }

    let headerHTML = 'Calculate for ';
    
    if (nFinal === 1n && dFinal === 1n) {
      headerHTML += '<span class="base-e">e</span><span class="exponent">i</span>';
    } else if (nFinal === 1n) {
       const fractionHTML = `
        <div class="header-fraction">
          <span class="num">1</span>
          <div class="vinculum"></div>
          <span class="den">${dFinal}</span>
        </div>
      `;
      headerHTML += `<span class="base-e">e</span><span class="exponent">i &middot; ${fractionHTML}</span>`;
    } else if (dFinal === 1n) {
       headerHTML += `<span class="base-e">e</span><span class="exponent">i &middot; ${nFinal}</span>`;
    } else {
      const fractionHTML = `
        <div class="header-fraction">
          <span class="num">${nFinal}</span>
          <div class="vinculum"></div>
          <span class="den">${dFinal}</span>
        </div>
      `;
      headerHTML += `<span class="base-e">e</span><span class="exponent">i &middot; ${fractionHTML}</span>`;
    }
    
    this.headerFormula.innerHTML = headerHTML;
  }
}
