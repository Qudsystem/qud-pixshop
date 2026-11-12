const express = require('express');
const path = require('path');
const monitor = require('./monitor');

const app = express();
const PORT = process.env.MONITOR_PORT || 3001;

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// API endpoint for metrics
app.get('/api/metrics', (req, res) => {
  const metrics = monitor.getMetrics();
  res.json(metrics);
});

// Dashboard HTML
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>AI Studio Monitor Dashboard</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #333;
          min-height: 100vh;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { 
          background: rgba(255, 255, 255, 0.95);
          padding: 20px;
          border-radius: 10px;
          margin-bottom: 20px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .metrics-grid { 
          display: grid; 
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          margin-bottom: 20px;
        }
        .metric-card {
          background: rgba(255, 255, 255, 0.95);
          padding: 20px;
          border-radius: 10px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          text-align: center;
        }
        .metric-value {
          font-size: 2em;
          font-weight: bold;
          color: #4CAF50;
          margin: 10px 0;
        }
        .metric-label {
          font-size: 0.9em;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .status-indicator {
          display: inline-block;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          margin-right: 8px;
        }
        .status-healthy { background: #4CAF50; }
        .status-warning { background: #FF9800; }
        .status-error { background: #F44336; }
        .chart-container {
          background: rgba(255, 255, 255, 0.95);
          padding: 20px;
          border-radius: 10px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          margin-bottom: 20px;
        }
        .refresh-info {
          text-align: center;
          color: #666;
          font-size: 0.9em;
          margin-top: 20px;
        }
        h1, h2 { color: #333; margin-bottom: 10px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🤖 AI Studio Automation Monitor</h1>
          <p>Real-time system performance monitoring</p>
        </div>
        
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">Total Requests</div>
            <div class="metric-value" id="requests">0</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-label">Error Rate</div>
            <div class="metric-value" id="errorRate">0%</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-label">Avg Response Time</div>
            <div class="metric-value" id="avgResponseTime">0ms</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-label">Active Sessions</div>
            <div class="metric-value" id="activeSessions">0</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-label">Queue Length</div>
            <div class="metric-value" id="queueLength">0</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-label">System Status</div>
            <div class="metric-value">
              <span class="status-indicator status-healthy"></span>
              <span id="systemStatus">Healthy</span>
            </div>
          </div>
        </div>
        
        <div class="chart-container">
          <h2>📊 Performance Trends</h2>
          <canvas id="performanceChart" width="400" height="200"></canvas>
        </div>
        
        <div class="refresh-info">
          <p>Dashboard refreshes every 5 seconds • Last updated: <span id="lastUpdate">Never</span></p>
        </div>
      </div>

      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <script>
        let performanceChart;
        const maxDataPoints = 20;
        const chartData = {
          labels: [],
          datasets: [{
            label: 'Response Time (ms)',
            data: [],
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            tension: 0.4
          }, {
            label: 'Request Count',
            data: [],
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            tension: 0.4
          }]
        };

        function initChart() {
          const ctx = document.getElementById('performanceChart').getContext('2d');
          performanceChart = new Chart(ctx, {
            type: 'line',
            data: chartData,
            options: {
              responsive: true,
              scales: {
                y: {
                  beginAtZero: true
                }
              }
            }
          });
        }

        function updateChart(requests, avgResponseTime) {
          const now = new Date().toLocaleTimeString();
          
          chartData.labels.push(now);
          chartData.datasets[0].data.push(avgResponseTime);
          chartData.datasets[1].data.push(requests);
          
          // Keep only last N data points
          if (chartData.labels.length > maxDataPoints) {
            chartData.labels.shift();
            chartData.datasets.forEach(dataset => dataset.data.shift());
          }
          
          performanceChart.update();
        }

        async function fetchMetrics() {
          try {
            const response = await fetch('/api/metrics');
            const data = await response.json();
            
            document.getElementById('requests').textContent = data.requests.toLocaleString();
            document.getElementById('errorRate').textContent = data.errorRate.toFixed(2) + '%';
            document.getElementById('avgResponseTime').textContent = data.averageResponseTime.toFixed(0) + 'ms';
            document.getElementById('activeSessions').textContent = data.activeSessions.toLocaleString();
            document.getElementById('queueLength').textContent = data.queueLength.toLocaleString();
            
            // Update system status
            const statusElement = document.getElementById('systemStatus');
            const statusIndicator = document.querySelector('.status-indicator');
            
            if (data.errorRate > 10) {
              statusElement.textContent = 'Critical';
              statusIndicator.className = 'status-indicator status-error';
            } else if (data.errorRate > 5) {
              statusElement.textContent = 'Warning';
              statusIndicator.className = 'status-indicator status-warning';
            } else {
              statusElement.textContent = 'Healthy';
              statusIndicator.className = 'status-indicator status-healthy';
            }
            
            // Update chart
            updateChart(data.requests, data.averageResponseTime);
            
            document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
          } catch (error) {
            console.error('Failed to fetch metrics:', error);
            document.getElementById('systemStatus').textContent = 'Connection Error';
            document.querySelector('.status-indicator').className = 'status-indicator status-error';
          }
        }

        // Initialize
        initChart();
        fetchMetrics();
        
        // Refresh every 5 seconds
        setInterval(fetchMetrics, 5000);
      </script>
    </body>
    </html>
  `);
});

// Start the monitoring dashboard
app.listen(PORT, () => {
  console.log(`🚀 AI Studio Monitor Dashboard running on http://localhost:${PORT}`);
  console.log(`📊 Real-time metrics and performance monitoring available`);
});

module.exports = app;