// scripts/generate.js
const fs = require('fs');
const path = require('path');
const { graphql } = require('@octokit/graphql');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

const OUT = path.join(process.cwd(), 'dist');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);

const WIDTH = 1400;
const HEIGHT = 420;

const TOKEN = process.env.GITHUB_TOKEN;
const USER = process.env.GH_USER || 'Disumakadiya'; // default to your username
const MODE = (process.env.CHART_MODE || 'bar').toLowerCase(); // 'bar' or 'line'

if (!TOKEN) {
  console.error('GITHUB_TOKEN is required in env');
  process.exit(1);
}

const graphqlWithAuth = graphql.defaults({
  headers: { authorization: `token ${TOKEN}` }
});

async function fetchWeeklyTotals(username) {
  const query = `
    query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
        }
      }
    }
  `;
  const res = await graphqlWithAuth(query, { login: username });
  const weeks = res.user.contributionsCollection.contributionCalendar.weeks;
  // Map each week -> sum of 7 days
  return weeks.map(w => w.contributionDays.reduce((s, d) => s + d.contributionCount, 0));
}

function createGradient(ctx, chartArea) {
  const grad = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  grad.addColorStop(0, '#00fff7');   // cyan
  grad.addColorStop(0.45, '#ff3af0'); // magenta
  grad.addColorStop(0.75, '#ffb86b'); // warm
  grad.addColorStop(1, '#7fff00');   // green
  return grad;
}

(async () => {
  try {
    console.log('Fetching contributions for', USER);
    const weekly = await fetchWeeklyTotals(USER); // array of ~52 numbers
    const labels = weekly.map((_, i) => `W${i+1}`);

    const chartJSNodeCanvas = new ChartJSNodeCanvas({
      width: WIDTH,
      height: HEIGHT,
      backgroundColour: '#07121a' // dark background
    });

    const config = {
      type: MODE === 'line' ? 'line' : 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Contributions',
          data: weekly,
          // backgroundColor / borderColor are provided as functions so we can use canvas gradients
          backgroundColor: (ctx) => {
            const chart = ctx.chart;
            const { ctx: cctx, chartArea } = chart;
            if (!chartArea) return '#ffffff';
            return createGradient(cctx, chartArea);
          },
          borderColor: (ctx) => {
            const chart = ctx.chart;
            const { ctx: cctx, chartArea } = chart;
            if (!chartArea) return '#fff';
            // a top-to-bottom gradient for line border
            return createGradient(cctx, chartArea);
          },
          borderWidth: 2,
          fill: MODE === 'line' ? true : false,
          tension: MODE === 'line' ? 0.4 : 0,
          borderRadius: MODE === 'bar' ? 6 : 0,
          barThickness: MODE === 'bar' ? 18 : undefined,
          pointRadius: MODE === 'line' ? 3 : 0,
          pointHoverRadius: MODE === 'line' ? 6 : 0
        }]
      },
      options: {
        responsive: false,
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: `${USER}'s Weekly Contributions`,
            color: '#d7b0e6',
            font: { size: 20 }
          }
        },
        scales: {
          x: { display: false },
          y: {
            ticks: { color: '#c9c9d0' },
            grid: { color: 'rgba(255,255,255,0.04)' }
          }
        },
        animation: false
      },
      plugins: [{
        id: 'neon-glow',
        beforeDatasetsDraw(chart) {
          // apply a soft neon shadow while drawing datasets
          const ctx = chart.ctx;
          ctx.save();
          ctx.shadowBlur = 20;
          ctx.shadowColor = 'rgba(255, 80, 200, 0.45)';
        },
        afterDatasetsDraw(chart) {
          chart.ctx.restore();
        }
      }]
    };

    const buffer = await chartJSNodeCanvas.renderToBuffer(config);
    const outPath = path.join(OUT, 'neon-contributions.png');
    fs.writeFileSync(outPath, buffer);
    console.log('Saved image to', outPath);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
