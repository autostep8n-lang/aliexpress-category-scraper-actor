/**
 * Crawler Routing Setup using Crawlee PlaywrightRouter.
 * Handles scrolling, pagination, and data extraction for both Category listings and Product Details.
 */

import { createPlaywrightRouter, Dataset, log } from 'crawlee';
import * as cheerio from 'cheerio';
import { extractFromProductDetailPage, extractFromCategoryCard } from './extractors/windowDataExtractor.js';
import { extractProductId } from './utils/cleaners.js';

export const router = createPlaywrightRouter();

/**
 * Route: CATEGORY
 * Navigates through AliExpress category URLs, scrolls to trigger lazy-loaded items,
 * intercepts JSON pagination APIs or extracts item links from DOM.
 */
router.addHandler('CATEGORY', async ({ page, request, enqueueLinks, crawler }) => {
    log.info(`[Category Route] Processing category page: ${request.url}`);
    
    const { target_country = 'US', target_currency = 'USD', scrape_product_details = true, max_items = 100 } = request.userData;

    // 1. Scroll down repeatedly to load lazy-loaded product cards on dynamic category pages
    log.info(`[Category Route] Auto-scrolling page to trigger dynamic loading...`);
    for (let i = 0; i < 6; i++) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
        await page.waitForTimeout(1500);
    }

    // 2. Try extracting embedded window JSON state first
    const windowState = await page.evaluate(() => {
        return (window as any)._runParams || (window as any).__INIT_DATA__ || (window as any).runParams || null;
    });

    const discoveredProductIds = new Set<string>();
    const productLinksToEnqueue: string[] = [];

    if (windowState) {
        log.info(`[Category Route] Found embedded window JSON state. Parsing items...`);
        // Search recursively inside windowState for product arrays
        const searchItems = (obj: any) => {
            if (!obj || typeof obj !== 'object') return;
            if (Array.isArray(obj)) {
                obj.forEach(item => {
                    if (item && (item.productId || item.item_id || (item.title && item.prices))) {
                        const pid = extractProductId(item.productId || item.item_id || item.id);
                        if (pid && !discoveredProductIds.has(pid)) {
                            discoveredProductIds.add(pid);
                            if (!scrape_product_details) {
                                const cleanItem = extractFromCategoryCard(item, request.url, target_country, target_currency);
                                Dataset.pushData(cleanItem);
                            } else {
                                productLinksToEnqueue.push(`https://www.aliexpress.com/item/${pid}.html`);
                            }
                        }
                    }
                });
            } else {
                for (const key of Object.keys(obj)) {
                    searchItems(obj[key]);
                }
            }
        };
        searchItems(windowState);
    }

    // 3. Fallback/Augment via DOM extraction (links matching /item/xxxxx.html)
    const domLinks = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a[href*="/item/"]'));
        return anchors.map(a => (a as HTMLAnchorElement).href);
    });

    for (const link of domLinks) {
        const pid = extractProductId(link);
        if (pid && !discoveredProductIds.has(pid)) {
            discoveredProductIds.add(pid);
            productLinksToEnqueue.push(`https://www.aliexpress.com/item/${pid}.html`);
        }
    }

    log.info(`[Category Route] Discovered ${discoveredProductIds.size} unique products on this page.`);

    // 4. Enqueue for deep scraping or check max_items threshold
    if (scrape_product_details && productLinksToEnqueue.length > 0) {
        const limitedLinks = max_items ? productLinksToEnqueue.slice(0, max_items) : productLinksToEnqueue;
        await crawler.addRequests(
            limitedLinks.map(url => ({
                url,
                label: 'PRODUCT_DETAIL',
                userData: { target_country, target_currency, source_category_url: request.url }
            }))
        );
        log.info(`[Category Route] Enqueued ${limitedLinks.length} product detail pages for rich extraction.`);
    }

    // 5. Check if there is a Next Page button and enqueue it if max_items is not reached yet
    const nextBtn = await page.$('a[class*="pagination--next--"], button[class*="next"], a.ui-pagination-next');
    if (nextBtn && discoveredProductIds.size < (max_items || 500)) {
        const nextUrl = await page.evaluate(el => (el as HTMLAnchorElement).href, nextBtn);
        if (nextUrl && nextUrl !== request.url) {
            log.info(`[Category Route] Enqueuing next category page: ${nextUrl}`);
            await crawler.addRequests([{
                url: nextUrl,
                label: 'CATEGORY',
                userData: request.userData
            }]);
        }
    }
});

/**
 * Route: PRODUCT_DETAIL
 * Visits canonical item page, extracts all 17 required data points precisely.
 */
router.addHandler('PRODUCT_DETAIL', async ({ page, request }) => {
    log.info(`[Product Detail Route] Scraping: ${request.url}`);
    
    const { target_country = 'US', target_currency = 'USD', source_category_url = request.url } = request.userData;

    // Wait for main title or price module to settle in DOM
    try {
        await page.waitForSelector('h1, [class*="title"], [class*="price"]', { timeout: 10000 });
    } catch (e) {
        log.warning(`[Product Detail Route] Timeout waiting for selectors on ${request.url}. Proceeding with extraction anyway...`);
    }

    // Extract window state and raw HTML
   const { windowData, html } = await page.evaluate(() => ({
    windowData: (window as any)._runParams || (window as any).__INIT_DATA__ || null,
    html: document.documentElement.outerHTML
}));

log.info(`windowData exists: ${!!windowData}`);

if (windowData) {
    log.info(`windowData keys: ${Object.keys(windowData).join(", ")}`);
}

    const $ = cheerio.load(html);

    // Run our comprehensive 17-point extraction engine
    const extractedData = extractFromProductDetailPage($, request.url, windowData, target_country, target_currency);
    extractedData._metadata.source_category_url = source_category_url;

    // Push the perfectly formatted JSON record directly to the Apify Dataset
    await Dataset.pushData(extractedData);
    log.info(`[Product Detail Route] Successfully extracted and saved item: ${extractedData.product_id} (${extractedData.title.substring(0, 40)}...)`);
});
