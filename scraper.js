const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

async function getFearAndGreedIndex(retryCount = 0) {
    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920x1080'
            ]
        });

        const page = await browser.newPage();

        // Set a realistic user agent
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        // Set viewport
        await page.setViewport({
            width: 1920,
            height: 1080
        });

        // Add header to look more like a real browser
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br'
        });

        console.log('Navigating to CNN Fear & Greed page...');
        await page.goto('https://edition.cnn.com/markets/fear-and-greed', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        // Wait for the page to be fully loaded
        await page.waitForFunction(() => document.readyState === 'complete', { timeout: 5000 });

        console.log('Checking for content...');
        
        // Try multiple possible selectors
        const data = await page.evaluate(() => {
            // Try different possible selectors
            const selectors = [
                '[class*="fear-greed"] [class*="value"]',
                '[class*="fear-greed"] [class*="score"]',
                '[class*="fear-greed"] [class*="number"]',
                '[class*="fear-greed"] [class*="index"]',
                '[class*="fear-greed"]',
                '[class*="market-mood"] [class*="value"]',
                '[class*="market-mood"] [class*="score"]',
                '[class*="market-mood"] [class*="number"]',
                '[class*="market-mood"] [class*="index"]',
                '[class*="market-mood"]',
                // Add more potential selectors here
            ];

            let scoreElement = null;
            let moodElement = null;

            // Try each selector until we find one that works
            for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                    const text = element.textContent.trim();
                    const value = parseInt(text);
                    if (!isNaN(value) && value >= 0 && value <= 100) {
                        scoreElement = element;
                        break;
                    }
                }
                if (scoreElement) break;
            }

            // Similar approach for mood
            const moodSelectors = [
                '[class*="fear-greed"] [class*="status"]',
                '[class*="fear-greed"] [class*="label"]',
                '[class*="fear-greed"] [class*="text"]',
                '[class*="market-mood"] [class*="status"]',
                '[class*="market-mood"] [class*="label"]',
                '[class*="market-mood"] [class*="text"]',
                // Add more potential selectors here
            ];

            for (const selector of moodSelectors) {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                    const text = element.textContent.trim().toLowerCase();
                    if (text && (text.includes('fear') || text.includes('greed') || text.includes('neutral'))) {
                        moodElement = element;
                        break;
                    }
                }
                if (moodElement) break;
            }

            // If we still can't find the elements, try to get any visible number in the relevant area
            if (!scoreElement) {
                // Get all text nodes in the document
                const walker = document.createTreeWalker(
                    document.body,
                    NodeFilter.SHOW_TEXT,
                    null,
                    false
                );

                let node;
                while (node = walker.nextNode()) {
                    const text = node.textContent.trim();
                    const value = parseInt(text);
                    if (!isNaN(value) && value >= 0 && value <= 100) {
                        scoreElement = { textContent: value.toString() };
                        break;
                    }
                }
            }

            return {
                score: scoreElement ? scoreElement.textContent.trim() : null,
                mood: moodElement ? moodElement.textContent.trim() : null,
                timestamp: new Date().toISOString()
            };
        });

        if (!data.score) {
            throw new Error('Failed to extract Fear and Greed Index data');
        }

        console.log('Successfully extracted data:', data);
        return data;

    } catch (error) {
        console.error(`Attempt ${retryCount + 1} failed:`, error.message);
        
        if (browser) {
            await browser.close();
        }

        // Retry logic
        if (retryCount < 3) {
            console.log(`Retrying... (${retryCount + 1}/3)`);
            await new Promise(resolve => setTimeout(resolve, 5000 * (retryCount + 1))); // Exponential backoff
            return getFearAndGreedIndex(retryCount + 1);
        }

        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

async function updateDataFile() {
    try {
        const currentData = await getFearAndGreedIndex();
        if (!currentData) {
            throw new Error('No data retrieved');
        }

        const dataFilePath = path.join(__dirname, 'public', 'data.json');
        let existingData = { current: null, history: [] };

        try {
            const fileContent = await fs.readFile(dataFilePath, 'utf8');
            existingData = JSON.parse(fileContent);
        } catch (error) {
            console.log('No existing data file found, creating new one');
        }

        // Ensure public directory exists
        await fs.mkdir(path.join(__dirname, 'public'), { recursive: true });

        // Update current data
        existingData.current = currentData;

        // Add to history (keep last 30 days)
        existingData.history.push(currentData);
        existingData.history = existingData.history.slice(-30);

        // Save the updated data
        await fs.writeFile(dataFilePath, JSON.stringify(existingData, null, 2));
        console.log('Data file updated successfully');
    } catch (error) {
        console.error('Failed to update data file:', error);
        process.exit(1);
    }
}

updateDataFile(); 