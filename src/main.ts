/**
 * Entry Point for AliExpress Category Scraper Apify Actor.
 * Initializes Actor, loads input schema, sets up Proxy and PlaywrightCrawler.
 */

import { Actor } from 'apify';
import { PlaywrightCrawler, log, ProxyConfiguration } from 'crawlee';
import { router } from './routes';
import { InputSchema } from './types';

// Initialize the Apify Actor environment
await Actor.init();

try {
    log.info(`[Main] Starting AliExpress Category Scraper Actor...`);

    // 1. Load Input from Apify UI or input.json
    const input = await Actor.getInput<InputSchema>();
    if (!input || !input.category_url) {
        throw new Error(`Input parameter 'category_url' is required! Please provide a valid AliExpress Category URL.`);
    }

    const {
        category_url,
        max_items = 100,
        target_country = 'US',
        target_currency = 'USD',
        scrape_product_details = true,
        proxy_configuration
    } = input;

    log.info(`[Main] Configuration loaded:
      - Category URL: ${category_url}
      - Max Items: ${max_items}
      - Target Country: ${target_country}
      - Target Currency: ${target_currency}
      - Scrape Product Details: ${scrape_product_details}`);

    // 2. Configure Apify Proxy for high anonymity and anti-bot bypass
    let proxyConfiguration: ProxyConfiguration | undefined;
    if (proxy_configuration && proxy_configuration.useApifyProxy) {
        proxyConfiguration = await Actor.createProxyConfiguration({
            groups: proxy_configuration.apifyProxyGroups || ['RESIDENTIAL'],
            countryCode: proxy_configuration.apifyProxyCountry || target_country || 'US'
        });
        log.info(`[Main] Using Apify Residential Proxy (Country: ${proxy_configuration.apifyProxyCountry || target_country || 'US'})`);
    } else {
        log.warning(`[Main] No residential proxy configured. Note that AliExpress uses bot protection which may block datacenter IPs.`);
    }

    // 3. Initialize PlaywrightCrawler with stealth configurations
    const crawler = new PlaywrightCrawler({
        proxyConfiguration,
        requestHandler: router,
        maxRequestsPerCrawl: max_items ? max_items + 20 : 500, // Allowance for pagination pages
        navigationTimeoutSecs: 60,
        requestHandlerTimeoutSecs: 120,
        headless: true,
        useSessionPool: true,
        sessionPoolOptions: {
            maxPoolSize: 20,
            sessionOptions: {
                maxUsageCount: 5
            }
        },
        launchContext: {
            launchOptions: {
                args: [
                    '--disable-gpu',
                    '--disable-dev-shm-usage',
                    '--disable-setuid-sandbox',
                    '--no-sandbox',
                    '--disable-blink-features=AutomationControlled'
                ]
            }
        },
        // Pre-navigation hook to set cookies for region & currency context (Requirement #13 & #17)
        preNavigationHooks: [
            async ({ page, session }, gotoOptions) => {
                const domain = '.aliexpress.com';
                // Set region and currency cookie 'aep_usuc_f'
                const cookieValue = `region=${target_country.toUpperCase()}&b_locale=en_US&c_tp=${target_currency.toUpperCase()}`;
                await page.context().addCookies([
                    { name: 'aep_usuc_f', value: cookieValue, domain, path: '/' },
                    { name: 'intl_locale', value: 'en_US', domain, path: '/' },
                    { name: 'xman_us_f', value: `x_locale=en_US&x_l=0&x_c_tp=${target_currency.toUpperCase()}&region=${target_country.toUpperCase()}`, domain, path: '/' }
                ]);
                
                // Emulate human-like viewport and User-Agent
                await page.setExtraHTTPHeaders({
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Sec-Ch-Ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"'
                });
            }
        ]
    });

    // 4. Add the starting category URL to the request queue
    await crawler.run([
        {
            url: category_url,
            label: 'CATEGORY',
            userData: {
                target_country,
                target_currency,
                scrape_product_details,
                max_items
            }
        }
    ]);

    log.info(`[Main] Crawl finished successfully! Check Apify Dataset for the clean 17-field JSON output.`);
} catch (error) {
    log.error(`[Main] Actor execution failed: ${error instanceof Error ? error.message : String(error)}`);
} finally {
    // Exit Apify Actor environment cleanly
    await Actor.exit();
}
