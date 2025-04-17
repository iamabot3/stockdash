const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

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
        return null;
    }
}

async function updateDataFile() {
    const currentData = await getFearAndGreedIndex();
    if (!currentData) return;

    const dataFilePath = path.join(__dirname, 'public', 'data.json');
    let existingData = { current: null, history: [] };

    try {
        const fileContent = await fs.readFile(dataFilePath, 'utf8');
        existingData = JSON.parse(fileContent);
    } catch (error) {
        console.log('No existing data file found, creating new one');
    }

    // Update current data
    existingData.current = currentData;

    // Add to history (keep last 30 days)
    existingData.history.push(currentData);
    existingData.history = existingData.history.slice(-30);

    // Save the updated data
    await fs.writeFile(dataFilePath, JSON.stringify(existingData, null, 2));
    console.log('Data file updated successfully');
}

updateDataFile(); 