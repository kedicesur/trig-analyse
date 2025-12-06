// main.js - Main entry point for the application

import { ComplexVisualizerUI } from './UI.js';

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  try {
    // Create and initialize the UI
    const ui = new ComplexVisualizerUI();
    
    // Make UI available globally for debugging if needed
    window.complexVisualizerUI = ui;
    
    console.log('Complex Continued Fraction Visualizer initialized successfully');
  } catch (error) {
    console.error('Failed to initialize application:', error);
    alert('Failed to initialize application. Please check console for details.');
  }
});