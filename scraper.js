const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

// Ensure the public directory exists
async function ensurePublicDirectory() {
    const publicDir = path.join(__dirname, 'public');
    try {
        await fs.access(publicDir);
    } catch {
        await fs.mkdir(publicDir, { recursive: true });
    }
    return publicDir;
}

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

        // Wait for the page to be fully loaded and the gauge to be visible
        await page.waitForFunction(() => document.readyState === 'complete', { timeout: 5000 });
        
        // Additional wait for dynamic content
        await page.waitForFunction(() => {
            const gaugeElements = document.querySelectorAll('[class*="gauge"], [class*="Gauge"]');
            return Array.from(gaugeElements).some(el => {
                const text = el.textContent.trim();
                const value = parseInt(text);
                return !isNaN(value) && value >= 0 && value <= 100;
            });
        }, { timeout: 10000 });

        // Take a screenshot for debugging
        await page.screenshot({ path: 'debug-screenshot.png', fullPage: true });
        console.log('::debug::Screenshot saved as debug-screenshot.png');

        console.log('::group::Checking for content...');
        
        // Try multiple possible selectors
        const data = await page.evaluate(() => {
            // Try different possible selectors focusing on the gauge
            const selectors = [
                // Gauge-specific selectors
                '[class*="gauge"] text',
                '[class*="Gauge"] text',
                '[class*="gauge-value"]',
                '[class*="gauge"] [class*="value"]',
                '[class*="Gauge"] [class*="Value"]',
                // SVG text elements that might contain the value
                'text[class*="value"]',
                'text[class*="number"]',
                // General selectors as fallback
                '[class*="fear-greed"] [class*="value"]',
                '[class*="fear-greed"] [class*="number"]',
                '[class*="market-mood"] [class*="value"]'
            ];

            let scoreElement = null;
            let moodElement = null;

            // Log all elements found with their text content
            console.log('::debug::Searching for elements...');
            
            // First try to find the value in SVG text elements
            const svgTexts = document.querySelectorAll('svg text');
            for (const text of svgTexts) {
                const content = text.textContent.trim();
                console.log(`::debug::SVG text content: "${content}"`);
                const value = parseInt(content);
                if (!isNaN(value) && value >= 0 && value <= 100) {
                    console.log(`::debug::Found valid score in SVG: ${value}`);
                    scoreElement = text;
                    break;
                }
            }

            // If SVG approach didn't work, try the regular selectors
            if (!scoreElement) {
                for (const selector of selectors) {
                    const elements = document.querySelectorAll(selector);
                    console.log(`::debug::Found ${elements.length} elements for selector: ${selector}`);
                    for (const element of elements) {
                        const text = element.textContent.trim();
                        console.log(`::debug::Element text: "${text}"`);
                        const value = parseInt(text);
                        if (!isNaN(value) && value >= 0 && value <= 100) {
                            console.log(`::debug::Found valid score: ${value}`);
                            scoreElement = element;
                            break;
                        }
                    }
                    if (scoreElement) break;
                }
            }

            // Similar approach for mood
            const moodSelectors = [
                '[class*="gauge"] [class*="label"]',
                '[class*="Gauge"] [class*="Label"]',
                '[class*="fear-greed"] [class*="status"]',
                '[class*="fear-greed"] [class*="label"]',
                '[class*="market-mood"] [class*="status"]'
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

            return {
                score: scoreElement ? scoreElement.textContent.trim() : null,
                mood: moodElement ? moodElement.textContent.trim().toLowerCase() : null,
                timestamp: new Date().toISOString().split('.')[0] + 'Z'  // Format: YYYY-MM-DDTHH:mm:ssZ
            };
        });

        if (!data.score) {
            throw new Error('Failed to extract Fear and Greed Index data');
        }

        console.log('::endgroup::');
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

        // Ensure public directory exists and get its path
        const publicDir = await ensurePublicDirectory();
        const dataFilePath = path.join(publicDir, 'data.json');
        
        let existingData = { current: null, history: [] };

        try {
            const fileContent = await fs.readFile(dataFilePath, 'utf8');
            existingData = JSON.parse(fileContent);
            console.log('Loaded existing data file');
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
        
        // Verify the file exists and is readable
        try {
            const verifyContent = await fs.readFile(dataFilePath, 'utf8');
            const verifyData = JSON.parse(verifyContent);
            console.log('Verified data file:', verifyData.current.score);
        } catch (error) {
            console.error('Error verifying data file:', error);
            throw error;
        }
    } catch (error) {
        console.error('Failed to update data file:', error);
        process.exit(1);
    }
}

updateDataFile(); 