require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const { CohereClient } = require('cohere-ai');

const app = express();
const PORT = process.env.PORT || 3000;

const cohere = new CohereClient({ apiKey: process.env.COHERE_API_KEY });

app.use(cors());
app.use(express.static(path.join(__dirname)));

function extractJSON(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch (err) {
      console.error('JSON parse error:', err.message);
      throw err;
    }
  }
  throw new Error('No JSON found');
}

app.get('/api/market-data', async (req, res) => {
  const type = req.query.type?.trim() || 'generic';
  try {
    const prompt = `You are a market analyst and product manager for a company trying to determine if there is an opportunity to be sucessful by launching a new product category. For the product category "${type}", return a realistic JSON object with the following structure:

- competitors: An array of the top 5 current real-world brand or company names currently selling this type of product (avoid fictional names and discontinued product lines)
- avgPrice: Realistic average retail price in USD based on typical consumer pricing
- salesByCountry: Object mapping these regions to estimated **annual unit sales**, scaled by economic activity and product popularity: US, Canada, Mexico, Europe, South America. should be realistic and match up with population density unless there are other factors that affect location usage
- opportunityScore: Integer from 0 (low) to 100 (high), based on how likely it is for a new player to succeed in this market considering saturation, brand loyalty, and growth potential and how many competitors are already in the market
- opportunityExplanation: A short 1–2 sentence explanation of what factors influenced the opportunity score (e.g. market saturation, number of major competitors, regional barriers, or brand concentration)
- repairRate: Realistic annual repair/failure percentage (typically between 1%–10% but can be higher )
- competitorShares: Array of { name, share } where shares total ~100% and reflect real market leaders
- recommendation: 1–2 sentence insightful market entry strategy (e.g. targeting underserved markets or unique positioning)
- trendData: Object with:
    - labels: A sequence of 24 recent monthly points ending with the current month and year (e.g. ["Jan 2025", "Feb 2025", ..., "Dec 2025"])
    - values: Estimated monthly search volumes in thousands. Adjust for seasonality. For example:
        - Automotive thermostats should peak in colder months (Nov–Feb) and dip in summer (Jun–Aug).
        - HVAC, heating, or winter-related products should show stronger interest in Q4–Q1.
        - Ensure values reflect real-world trends in North America, not generic patterns.

Focus on realism. Ensure sales and trends reflect product type, geographic market size, and industry seasonality. Only return valid JSON — no explanation.`;

    const response = await cohere.generate({
      model: 'command-r-plus',
      prompt: prompt,
      maxTokens: 800,
      temperature: 0.2
    });

    const content = response.generations[0].text;
    console.log("AI raw content:\n", content);
    const data = extractJSON(content);

    // Calculate growth percentage if trendData is present
    if (data.trendData?.values?.length >= 2) {
      const first = data.trendData.values[0];
      const last = data.trendData.values[data.trendData.values.length - 1];
      const growthRate = (((last - first) / first) * 100).toFixed(2);
      data.trendGrowthPercent = growthRate;

      // Add AI confidence score based on opportunity and trend growth
      const opportunity = parseInt(data.opportunityScore);
      const growth = parseFloat(growthRate);
      if (!isNaN(opportunity) && !isNaN(growth)) {
        data.confidenceScore = Math.round(opportunity * 0.7 + growth * 0.3);
      }
    }

    res.json(data);
  } catch (error) {
    console.error('Error in /api/market-data:', error.message);
    res.status(500).json({ error: 'Failed to fetch market data' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on 0.0.0.0:${PORT}`);
});
