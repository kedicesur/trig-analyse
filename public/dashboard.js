// 📊 Dashboard JavaScript for Visitor Analytics

// Country code to flag emoji mapping
const countryFlags = {
  'US': '🇺🇸', 'GB': '🇬🇧', 'CA': '🇨🇦', 'AU': '🇦🇺', 'DE': '🇩🇪',
  'FR': '🇫🇷', 'IT': '🇮🇹', 'ES': '🇪🇸', 'NL': '🇳🇱', 'BR': '🇧🇷',
  'IN': '🇮🇳', 'CN': '🇨🇳', 'JP': '🇯🇵', 'KR': '🇰🇷', 'MX': '🇲🇽',
  'RU': '🇷🇺', 'TR': '🇹🇷', 'SA': '🇸🇦', 'AE': '🇦🇪', 'SG': '🇸🇬',
  'SE': '🇸🇪', 'NO': '🇳🇴', 'DK': '🇩🇰', 'FI': '🇫🇮', 'PL': '🇵🇱',
  'PT': '🇵🇹', 'GR': '🇬🇷', 'CZ': '🇨🇿', 'BE': '🇧🇪', 'CH': '🇨🇭',
  'AT': '🇦🇹', 'IE': '🇮🇪', 'NZ': '🇳🇿', 'ZA': '🇿🇦', 'AR': '🇦🇷',
  'CL': '🇨🇱', 'CO': '🇨🇴', 'PE': '🇵🇪', 'VE': '🇻🇪', 'IL': '🇮🇱',
  'EG': '🇪🇬', 'NG': '🇳🇬', 'KE': '🇰🇪', 'TH': '🇹🇭', 'VN': '🇻🇳',
  'PH': '🇵🇭', 'ID': '🇮🇩', 'MY': '🇲🇾', 'PK': '🇵🇰', 'BD': '🇧🇩',
};

// Global data storage
let statsData = null;
let currentTimeRange = 'weekly';

// 🔄 Load statistics from the API
async function loadStats() {
  const errorContainer = document.getElementById('error-container');
  const loading = document.getElementById('loading');
  const dashboard = document.getElementById('dashboard');

  try {
    loading.style.display = 'block';
    dashboard.style.display = 'none';
    errorContainer.innerHTML = '';

    const response = await fetch('/api/stats?limit=100');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    statsData = data; // Store globally
    
    // Update summary stats
    updateSummaryStats(data);
    
    // Update time-series graph
    updateTimeSeriesGraph();
    
    // Update charts
    updateChart('countries-chart', data.topCountries, true);
    updateChart('referers-chart', data.topReferers, false);
    updateChart('paths-chart', data.topPaths, false);
    
    // Update recent visits table
    updateVisitsTable(data.recentVisits);
    
    // Update last updated time
    document.getElementById('last-updated').textContent = 
      `Last updated: ${new Date().toLocaleTimeString()}`;
    
    loading.style.display = 'none';
    dashboard.style.display = 'block';
  } catch (error) {
    loading.style.display = 'none';
    errorContainer.innerHTML = `
      <div class="error">
        ❌ Failed to load analytics: ${error.message}
      </div>
    `;
  }
}

// 📈 Update summary statistics
function updateSummaryStats(data) {
  document.getElementById('total-visits').textContent = data.totalVisits;
  
  // Calculate unique IPs
  const uniqueIPs = new Set(data.recentVisits.map(v => v.ip)).size;
  document.getElementById('unique-ips').textContent = uniqueIPs;
  
  // Count countries
  const countriesCount = Object.keys(data.topCountries).length;
  document.getElementById('total-countries').textContent = countriesCount;
  
  // Today's visits
  const today = new Date().toISOString().split('T')[0];
  const todayVisits = data.dailyStats[today] || 0;
  document.getElementById('today-visits').textContent = todayVisits;
}

// 📊 Create a horizontal bar chart
function updateChart(elementId, data, isCountry = false) {
  const container = document.getElementById(elementId);
  if (!container) return;
  
  // Sort by value (descending) and take top 10
  const sortedData = Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  if (sortedData.length === 0) {
    container.innerHTML = '<p style="color: #999; text-align: center; padding: 2rem;">No data yet</p>';
    return;
  }
  
  const maxValue = Math.max(...sortedData.map(([_, v]) => v));
  
  container.innerHTML = sortedData.map(([label, value]) => {
    const percentage = (value / maxValue) * 100;
    const displayLabel = isCountry 
      ? `${countryFlags[label] || '🌍'} ${label}` 
      : truncateString(label, 40);
    
    return `
      <div class="chart-item">
        <div class="chart-label">${displayLabel}</div>
        <div class="chart-bar-container">
          <div class="chart-bar" style="width: ${percentage}%"></div>
          <div class="chart-value">${value}</div>
        </div>
      </div>
    `;
  }).join('');
}

// 📈 Set time range for the graph
function setTimeRange(range) {
  currentTimeRange = range;
  
  // Update button states
  document.querySelectorAll('.time-range-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-range="${range}"]`).classList.add('active');
  
  // Redraw graph
  updateTimeSeriesGraph();
}

// 📊 Update time-series graph
function updateTimeSeriesGraph() {
  if (!statsData) return;
  
  const canvas = document.getElementById('time-series-canvas');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  
  // Set canvas size to match display size
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * window.devicePixelRatio;
  canvas.height = rect.height * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  
  const width = rect.width;
  const height = rect.height;
  
  // Get data based on time range
  const timeSeriesData = getTimeSeriesData();
  
  if (timeSeriesData.length === 0) {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#999';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data yet', width / 2, height / 2);
    return;
  }
  
  // Clear canvas
  ctx.clearRect(0, 0, width, height);
  
  // Padding
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  // Find max value
  const maxValue = Math.max(...timeSeriesData.map(d => d.value));
  const yScale = chartHeight / (maxValue * 1.1); // Add 10% padding
  const xStep = chartWidth / (timeSeriesData.length - 1 || 1);
  
  // Draw grid lines
  ctx.strokeStyle = '#f0f0f0';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = padding.top + (chartHeight / 5) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    
    // Y-axis labels
    const value = Math.round(maxValue * (1 - i / 5));
    ctx.fillStyle = '#666';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(value.toString(), padding.left - 10, y + 4);
  }
  
  // Draw area under line (gradient)
  const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
  gradient.addColorStop(0, 'rgba(102, 126, 234, 0.3)');
  gradient.addColorStop(1, 'rgba(102, 126, 234, 0.05)');
  
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(padding.left, height - padding.bottom);
  
  timeSeriesData.forEach((point, i) => {
    const x = padding.left + i * xStep;
    const y = height - padding.bottom - point.value * yScale;
    if (i === 0) {
      ctx.lineTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  
  ctx.lineTo(padding.left + (timeSeriesData.length - 1) * xStep, height - padding.bottom);
  ctx.closePath();
  ctx.fill();
  
  // Draw line
  ctx.strokeStyle = '#667eea';
  ctx.lineWidth = 3;
  ctx.beginPath();
  
  timeSeriesData.forEach((point, i) => {
    const x = padding.left + i * xStep;
    const y = height - padding.bottom - point.value * yScale;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  
  ctx.stroke();
  
  // Draw points
  timeSeriesData.forEach((point, i) => {
    const x = padding.left + i * xStep;
    const y = height - padding.bottom - point.value * yScale;
    
    ctx.fillStyle = '#667eea';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
  
  // X-axis labels
  ctx.fillStyle = '#666';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  
  const labelStep = Math.ceil(timeSeriesData.length / 10); // Show max 10 labels
  timeSeriesData.forEach((point, i) => {
    if (i % labelStep === 0 || i === timeSeriesData.length - 1) {
      const x = padding.left + i * xStep;
      const label = formatDateLabel(point.date);
      ctx.save();
      ctx.translate(x, height - padding.bottom + 20);
      ctx.rotate(-Math.PI / 6); // Rotate 30 degrees
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }
  });
}

// 📅 Get time-series data based on current range
function getTimeSeriesData() {
  if (!statsData) return [];
  
  let data;
  let aggregateByYear = false;
  
  switch (currentTimeRange) {
    case 'daily':
      data = statsData.dailyStats;
      break;
    case 'weekly':
      data = statsData.weeklyStats;
      break;
    case 'monthly':
      data = statsData.monthlyStats;
      break;
    case 'yearly':
      // Aggregate monthly data by year
      data = {};
      Object.entries(statsData.monthlyStats).forEach(([month, count]) => {
        const year = month.split('-')[0];
        data[year] = (data[year] || 0) + count;
      });
      aggregateByYear = true;
      break;
    case 'max':
      // Use weekly data for max view
      data = statsData.weeklyStats;
      break;
    default:
      data = statsData.weeklyStats;
  }
  
  // Convert to array and sort
  const sortedData = Object.entries(data)
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
  
  // Limit data based on time range
  if (currentTimeRange === 'daily') {
    return sortedData.slice(-30); // Last 30 days
  } else if (currentTimeRange === 'weekly') {
    return sortedData.slice(-12); // Last 12 weeks
  } else if (currentTimeRange === 'monthly') {
    return sortedData.slice(-12); // Last 12 months
  } else if (currentTimeRange === 'yearly' || currentTimeRange === 'max') {
    return sortedData; // All data
  }
  
  return sortedData;
}

// 🗓️ Format date label based on time range
function formatDateLabel(dateStr) {
  if (currentTimeRange === 'yearly') {
    return dateStr; // Already just the year
  }
  
  if (currentTimeRange === 'weekly' || currentTimeRange === 'max') {
    // Format: "2025-W51" -> "W51"
    return dateStr.split('-')[1];
  }
  
  if (currentTimeRange === 'monthly') {
    // Format: "2025-12" -> "Dec 25"
    const [year, month] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  }
  
  // Daily: "2025-12-23" -> "Dec 23"
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// 📋 Update visits table
function updateVisitsTable(visits) {
  const tbody = document.getElementById('visits-tbody');
  if (!tbody) return;
  
  tbody.innerHTML = visits.slice(0, 50).map(visit => {
    const time = new Date(visit.timestamp).toLocaleString();
    const country = visit.country 
      ? `${countryFlags[visit.country] || '🌍'} ${visit.country}` 
      : '-';
    const referer = visit.referer 
      ? truncateString(visit.referer, 30)
      : '<span class="badge">Direct</span>';
    const userAgent = truncateString(visit.userAgent || '-', 40);
    
    return `
      <tr>
        <td>${time}</td>
        <td>${visit.ip}</td>
        <td>${country}</td>
        <td><a href="${visit.path}" class="path-link">${visit.path}</a></td>
        <td>${referer}</td>
        <td>${userAgent}</td>
      </tr>
    `;
  }).join('');
}

// 🔧 Utility function to truncate strings
function truncateString(str, maxLength) {
  if (!str) return '-';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

// 🚀 Load stats on page load
document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  
  // Auto-refresh every 30 seconds
  setInterval(loadStats, 30000);
});
