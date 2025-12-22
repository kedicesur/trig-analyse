import { ComplexVisualizerUI } from './UI.js';

document.addEventListener('DOMContentLoaded', () => {
  try {
    const ui = new ComplexVisualizerUI();
    
    window.complexVisualizerUI = ui;
    
    console.log('Complex Continued Fraction Visualizer initialized successfully');
  } catch (error) {
    console.error('Failed to initialize application:', error);
    alert('Failed to initialize application. Please check console for details.');
  }
});