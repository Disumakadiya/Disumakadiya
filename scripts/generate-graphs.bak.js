// scripts/generate-neon-graph.js
import fetch from "node-fetch";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import fs from "fs";
import path from "path";

const USERNAME = process.env.GH_USER || "Disumakadiya";
const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) {
  console.error("❌ GITHUB_TOKEN env var is required.");
  process.exit(1);
}

const OUT = path.join(process.cwd(), "dist");
fs.mkdirSync(OUT, { recursive: true });

const query = `
query ($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        weeks {
          contributionDays {
            contributionCount
          }
        }
      }
    }
  }
}
`;

async function fetchWeeklyTotals(login) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables: { login } }),
  });
  const json = await res.json();
  if (!json.data) throw new Error(JSON.stringify(json, null, 2));
  const weeks = json.data.user.contributionsCollection.contributionCalendar.weeks;
  // sum each week to get 52 weekly totals
  const weeklyTotals = weeks.map(w =>
    w.contributionDays.reduce((s, d) => s + d.contributionCount, 0)
  );
  return weeklyTotals;
}

function colorFor(val, max) {
  if (max === 0) return "rgba(128,128,128,0.6)";
  const t = val / max; // 0..1
  // hue from cyan -> magenta -> yellow -> green
  const hue = Math.round(180 + t * 160);
  const light = Math.round(35 + t * 20);
  return `hsl(${hue} ${95}% ${light}%)`;
}

(async () => {
  try {
    console.log("⏳ fetching contribution data for", USERNAME);
    const weekly = await fetchWeeklyTotals(USERNAME);
    const max = Math.max(...weekly, 1);
    const labels = weekly.map((_, i) => `W${i + 1}`);
    const bgColors = weekly.map(v => colorFor(v, max));

    const width = 1400;
    const height = 420;
    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, backgroundColour: "#07121a" });

    const config = {
      type: "bar",
      data: {
        labels,
        datasets: [{
          data: weekly,
          backgroundColor: bgColors,
          borderColor: bgColors,
          borderWidth: 1,
          borderRadius: 6,
          barThickness: 18
        }]
      },
      options: {
        responsive: false,
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: `${USERNAME}'s Weekly Contributions (neon)`,
            color: "#e6c3ff",
            font: { size: 20 }
          }
        },
        scales: {
          x: { display: false },
          y: {
            ticks: { color: "#cfd7df" },
            grid: { color: "rgba(255,255,255,0.04)" }
          }
        }
      }
    };

    const buffer = await chartJSNodeCanvas.renderToBuffer(config);
    const outPath = path.join(OUT, "neon-contributions.png");
    fs.writeFileSync(outPath, buffer);
    console.log("✅ Neon graph saved to", outPath);
  } catch (err) {
    console.error("❌ Error generating neon graph:", err);
    process.exit(1);
  }
})();