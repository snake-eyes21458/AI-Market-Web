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
    const prompt = `For the product category "${type}", return a JSON object with the following structure:

- competitors: an array of 5 real-world brand or company names currently selling this type of product
- avgPrice: realistic average retail price in USD
- salesByCountry: object mapping these regions to estimated annual unit sales: US, Canada, Mexico, Europe, South America
- opportunityScore: integer from 0 (low) to 100 (high)
- repairRate: realistic annual failure or repair percentage (1-10%)
- competitorShares: array of { name, share } where shares sum to ~100%
- recommendation: a short go-to-market recommendation (1-2 sentences)
- trendData: object with 'labels' (e.g. years or months) and 'values' (numeric values representing relative search interest between 0 and 100)

Only return raw JSON.`;

    const response = await cohere.generate({
      model: 'command-r-plus',
      prompt: prompt,
      maxTokens: 800,
      temperature: 0.3
    });

    const content = response.generations[0].text;
    const data = extractJSON(content);

    res.json(data);
  } catch (error) {
    console.error('Error in /api/market-data:', error.message);
    res.status(500).json({ error: 'Failed to fetch market data' });
  }
});
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
