// scripts/generate-graphs.js

import { execSync } from "child_process";
import fetch from "node-fetch";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import fs from "fs";
import path from "path";

const USERNAME = "Disumakadiya"; // Your GitHub username

// Ensure output dir exists
const outputDir = path.join(process.cwd(), "dist");
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// 1. Generate Pac-Man contribution graph
console.log("🎮 Generating Pac-Man graph...");
execSync(
  `npx @abozanona/pacman-contribution-graph --github_user_name=${USERNAME} --output=${path.join(
    outputDir,
    "pacman-graph.svg"
  )}`,
  { stdio: "inherit" }
);

// 2. Generate Neon glowing contribution chart
console.log("💡 Fetching GitHub contributions for neon chart...");
const query = `
query {
  user(login: "${USERNAME}") {
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
}`;

(async () => {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  const data = await response.json();
  if (!data.data) {
    console.error("❌ Failed to fetch contributions:", data);
    process.exit(1);
  }

  const weeks = data.data.user.contributionsCollection.contributionCalendar.weeks;
  const dailyContributions = weeks.flatMap((week) =>
    week.contributionDays.map((day) => day.contributionCount)
  );

  // Chart setup
  const width = 800;
  const height = 400;
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

  const configuration = {
    type: "bar",
    data: {
      labels: dailyContributions.map((_, i) => `Day ${i + 1}`),
      datasets: [
        {
          label: "GitHub Contributions",
          data: dailyContributions,
          backgroundColor: "rgba(0,255,255,0.8)",
          borderColor: "rgba(0,255,255,1)",
          borderWidth: 2,
          borderRadius: 5,
        },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        legend: {
          labels: {
            color: "rgba(0,255,255,1)",
          },
        },
      },
      scales: {
        x: {
          ticks: { color: "rgba(0,255,255,1)" },
        },
        y: {
          ticks: { color: "rgba(0,255,255,1)" },
        },
      },
    },
  };

  const image = await chartJSNodeCanvas.renderToBuffer(configuration);
  fs.writeFileSync(path.join(outputDir, "neon-graph.png"), image);
  console.log("✅ Neon graph generated at dist/neon-graph.png");
})();
