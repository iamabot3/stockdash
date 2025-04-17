const puppeteer = require('puppeteer');
const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

async function getFearAndGreedIndex() {
    try {
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        await page.goto('https://edition.cnn.com/markets/fear-and-greed', {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        // Wait for the fear and greed value to load
        await page.waitForSelector('[class*="FearAndGreedIndex-score"]');

        const data = await page.evaluate(() => {
            const scoreElement = document.querySelector('[class*="FearAndGreedIndex-score"]');
            const moodElement = document.querySelector('[class*="FearAndGreedIndex-status"]');
            
            return {
                score: scoreElement ? scoreElement.textContent.trim() : null,
                mood: moodElement ? moodElement.textContent.trim() : null,
                timestamp: new Date().toISOString()
            };
        });

        await browser.close();
        return data;
    } catch (error) {
        console.error('Error scraping Fear and Greed Index:', error);
        return {
            error: 'Failed to fetch Fear and Greed Index',
            timestamp: new Date().toISOString()
        };
    }
}

app.get('/', async (req, res) => {
    const data = await getFearAndGreedIndex();
    res.json(data);
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
}); 