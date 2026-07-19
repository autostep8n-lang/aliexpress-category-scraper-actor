# AliExpress Category 17-Point Scraper — Apify Actor

An enterprise-grade, highly resilient **Apify Actor** engineered to scrape **AliExpress Category & Search URLs**. Built with **TypeScript**, **Crawlee (`PlaywrightCrawler`)**, and deep **JSON/Window State Interception**, this Actor bypasses JavaScript anti-bot rendering, handles dynamic infinite scroll, and maps product data precisely to a clean **17-field JSON schema**.

---

## 🚀 Key Features

- **Deep Window State Interception (`_runParams` / `__INIT_DATA__`)**: Directly parses internal JSON state embedded by AliExpress before DOM rendering, ensuring 100% data fidelity without fragile CSS selector dependency.
- **Dynamic Playwright Rendering & Auto-Scroll**: Scrolls through category pages to trigger lazy-loaded product cards and intercepts internal pagination endpoints.
- **Target Country & Currency Emulation**: Pre-injects `aep_usuc_f` and `intl_locale` cookies to enforce your exact target country (e.g., `US`, `EG`, `UK`, `DE`) and currency (`USD`, `EGP`, `EUR`).
- **Complete 17-Point Schema**: Cleans and normalizes every data field (strips HTML from descriptions, parses numeric prices, structures shipping breakdown, standardizes order counts).
- **Lightweight vs. Deep Mode**: Switch between high-speed category-level card extraction (`scrape_product_details: false`) or full product detail page extraction (`scrape_product_details: true`).

---

## 📦 Input Configuration (`input.json`)

To run this Actor locally or on Apify Platform, provide the following JSON input:

```json
{
  "category_url": "https://www.aliexpress.com/category/200000343/consumer-electronics.html",
  "max_items": 50,
  "target_country": "US",
  "target_currency": "USD",
  "scrape_product_details": true,
  "proxy_configuration": {
    "useApifyProxy": true,
    "apifyProxyGroups": ["RESIDENTIAL"],
    "apifyProxyCountry": "US"
  }
}
```

### Input Parameters Table

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `category_url` | `string` | **Required** | Target AliExpress category or search link (`https://www.aliexpress.com/category/...` or `/w/wholesale-...html`). |
| `max_items` | `integer`| `100` | Maximum number of total products to extract. |
| `target_country` | `string` | `"US"` | 2-letter ISO country code (`US`, `EG`, `GB`, `DE`) for localized pricing and warehouse stock checks. |
| `target_currency`| `string` | `"USD"` | 3-letter currency code (`USD`, `EGP`, `EUR`, `GBP`). |
| `scrape_product_details` | `boolean` | `true` | If `true`, visits each product listing page for full specifications, reviews, and detailed shipping breakdown. |
| `proxy_configuration` | `object` | `RESIDENTIAL` | Proxy settings. **Note:** AliExpress has strict anti-bot detection; **Residential Proxies** (`apifyProxyGroups: ["RESIDENTIAL"]`) are strongly recommended. |

---

## 📊 Output Schema (17 Required Data Points)

Every product extracted is saved to the default **Apify Dataset** (`apify dataset get-items`) in the exact clean JSON schema:

```json
{
  "product_id": "1005005829103948",
  "product_url": "https://www.aliexpress.com/item/1005005829103948.html",
  "product_images": [
    "https://ae01.alicdn.com/kf/S8f9e0a2c3b4d5e6f7a8b9c0d1e2f3a4b.jpg",
    "https://ae01.alicdn.com/kf/S1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d.jpg"
  ],
  "shipping_details": {
    "time": "12-18 Days",
    "price": "Free Shipping",
    "method": "AliExpress Standard Shipping"
  },
  "original_price": 49.99,
  "discount_percent": "40%",
  "final_price": 29.99,
  "shipping_from": "CN",
  "reviews": [
    {
      "author": "J***n",
      "rating": 5,
      "date": "14 Jul 2026",
      "comment": "Excellent quality, arrived faster than expected to Cairo!",
      "country": "EG"
    }
  ],
  "order_count": 1420,
  "rating": 4.8,
  "title": "2026 Smart Watch Men Women Bluetooth Call Waterproof Fitness Tracker Screen AMOLED",
  "currency": "USD",
  "selling_point": [
    "Display Resolution: 466*466",
    "Battery Capacity: 300-450mAh",
    "Waterproof Grade: Professional Waterproof"
  ],
  "description": "2026 Newest AMOLED Smartwatch with Bluetooth Calling, Heart Rate Monitoring, and 100+ Sports Modes. Compatible with Android and iOS...",
  "in_stock": 842,
  "country": "US",
  "_metadata": {
    "scraped_at": "2026-07-19T14:30:00.000Z",
    "source_category_url": "https://www.aliexpress.com/category/200000343/consumer-electronics.html"
  }
}
```

---

## 🛠️ Immediate Deployment & Execution

### Option A: Deploy via Apify CLI (Recommended & Fastest)

If you have the [Apify CLI](https://docs.apify.com/cli) installed:

```bash
# 1. Login to your Apify account
apify login

# 2. Navigate to the actor workspace directory
cd /home/user/aliexpress-category-scraper-actor

# 3. Push and deploy directly to your Apify Cloud account
apify push
```

Once pushed, your Actor will appear on your [Apify Console](https://console.apify.com/actors) ready to run!

---

### Option B: Deploy via GitHub / Apify Web Console

1. Push this folder to a GitHub repository (`git init && git remote add origin <repo_url> && git push`).
2. Log into **[Apify Console](https://console.apify.com/actors/new)** → Click **"Develop new Actor"** → **"Link Git Repository"**.
3. Paste your Git repo URL and click **Create**. Apify will automatically build the `Dockerfile` and read `.actor/actor.json`.

---

### Option C: Run Locally (Test Environment)

To run right now on your local machine or server without deploying to Apify Cloud:

```bash
cd /home/user/aliexpress-category-scraper-actor

# Install dependencies and build TypeScript
npm install
npm run build

# Create a local storage folder and run with test input
mkdir -p storage/key_value_stores/default
cat << 'EOF' > storage/key_value_stores/default/INPUT.json
{
  "category_url": "https://www.aliexpress.com/category/200000343/consumer-electronics.html",
  "max_items": 10,
  "target_country": "US",
  "target_currency": "USD",
  "scrape_product_details": true
}
EOF

# Execute local crawl
npm start
```

The output JSON records will be stored in `storage/datasets/default/*.json`.

---

## 🔗 Webhook & Database Integration

### Setting Up Apify Webhooks

When your scraping run finishes, Apify can automatically send the extracted dataset to your backend API, n8n, Make, Zapier, or database ingestion service.

In your **Apify Console** under your Actor's **Integrations / Webhooks** tab:
- **Event:** `Run succeeded` (`ACTOR.RUN.SUCCEEDED`)
- **Target URL:** `https://your-api.com/webhooks/aliexpress-ingest`
- **Payload Template:**
```json
{
  "event": "RUN_SUCCEEDED",
  "actorId": "{{actorId}}",
  "runId": "{{runId}}",
  "datasetId": "{{resource.defaultDatasetId}}",
  "datasetUrl": "https://api.apify.com/v2/datasets/{{resource.defaultDatasetId}}/items?format=json&clean=true"
}
```

### Sample Node.js / Express Webhook Receiver & Database Ingestion

Here is an example backend endpoint to receive the webhook, fetch the 17-point dataset, and insert it into **PostgreSQL / Supabase**:

```javascript
import express from 'express';
import axios from 'express';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(express.json());

const supabase = createClient('https://your-supabase.supabase.co', 'YOUR_SERVICE_ROLE_KEY');

app.post('/webhooks/aliexpress-ingest', async (req, res) => {
  const { datasetUrl } = req.body;
  if (!datasetUrl) return res.status(400).send('Missing datasetUrl');

  try {
    // 1. Fetch clean JSON items from Apify Dataset API
    const response = await axios.get(datasetUrl);
    const products = response.data; // Array of 17-field product records

    console.log(`Received ${products.length} products from Apify. Inserting into database...`);

    // 2. Prepare records for SQL insertion
    const dbRecords = products.map(item => ({
      product_id: item.product_id,
      product_url: item.product_url,
      images: JSON.stringify(item.product_images),
      shipping_time: item.shipping_details.time,
      shipping_price: item.shipping_details.price,
      shipping_method: item.shipping_details.method,
      original_price: item.original_price,
      discount_percent: item.discount_percent,
      final_price: item.final_price,
      shipping_from: item.shipping_from,
      reviews: JSON.stringify(item.reviews),
      order_count: typeof item.order_count === 'number' ? item.order_count : 0,
      rating: item.rating,
      title: item.title,
      currency: item.currency,
      selling_points: JSON.stringify(item.selling_point),
      description: item.description,
      in_stock: Boolean(item.in_stock),
      country_context: item.country,
      updated_at: new Date()
    }));

    // 3. Upsert into database table 'aliexpress_products'
    const { error } = await supabase
      .from('aliexpress_products')
      .upsert(dbRecords, { onConflict: 'product_id' });

    if (error) throw error;

    res.status(200).json({ success: true, count: products.length });
  } catch (err) {
    console.error('Webhook ingestion error:', err.message);
    res.status(500).send('Ingestion failed');
  }
});

app.listen(3000, () => console.log('Webhook server running on port 3000'));
```
