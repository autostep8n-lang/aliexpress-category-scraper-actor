/**
 * TypeScript Interfaces for AliExpress Category Scraper Actor
 * Covers all 17 required data points in clean, structured schema.
 */

export interface ShippingDetails {
    /** Estimated delivery time or delivery date range (e.g., "12-18 Days" or "By Aug 15") */
    time: string | null;
    /** Numeric shipping cost or exact string (e.g., 4.99 or "Free Shipping") */
    price: number | string;
    /** Shipping carrier or method name (e.g., "AliExpress Standard Shipping", "DHL", "ePacket") */
    method: string | null;
}

export interface AliExpressProductItem {
    /** 1. Product ID: The unique identifier of the product on AliExpress (e.g., "1005005829103948") */
    product_id: string;

    /** 2. Product URL: The direct canonical link to the product page */
    product_url: string;

    /** 3. Product Images: An array/list of all high-resolution product image URLs */
    product_images: string[];

    /** 4. Shipping Details: Object containing time, price, and method */
    shipping_details: ShippingDetails;

    /** 5. Original Price: The base price before any discounts (numeric or null if no discount) */
    original_price: number | null;

    /** 6. Discount Percent: The percentage of the discount applied (e.g., "20%" or "45% OFF") */
    discount_percent: string | null;

    /** 7. Final Price: The actual price the customer pays after the discount (numeric) */
    final_price: number | null;

    /** 8. Shipping From: The origin country/warehouse location the product is shipped from (e.g., "CN", "US", "ES", "PL") */
    shipping_from: string | null;

    /** 9. Reviews: An array or sample text of user reviews/feedbacks accessible on the listing */
    reviews: Array<{
        author: string;
        rating: number;
        date: string;
        comment: string;
        country?: string;
    }> | string[];

    /** 10. Order Count / Total Sold: The total number of units sold or orders placed (numeric or clean string like "1,200+ sold") */
    order_count: number | string | null;

    /** 11. Rating: The average star rating (numeric, e.g., 4.8) */
    rating: number | null;

    /** 12. Title: The full product title/name */
    title: string;

    /** 13. Currency: The currency code used for the prices (e.g., "USD", "EGP", "EUR") */
    currency: string;

    /** 14. Selling Point: Key highlights or marketing bullet points displayed on the listing */
    selling_point: string[];

    /** 15. Description: The detailed text description or specifications (stripped of HTML) */
    description: string | null;

    /** 16. In Stock: Boolean (true/false) or stock count indicating availability */
    in_stock: boolean | number;

    /** 17. Country: The target delivery country context used for the scraping session (e.g., "US", "EG", "GB") */
    country: string;

    /** Metadata regarding the extraction timestamp and source category */
    _metadata: {
        scraped_at: string;
        source_category_url: string;
    };
}

export interface InputSchema {
    /** Input AliExpress Category or Search URL */
    category_url: string;
    /** Maximum number of products to scrape across all pages */
    max_items?: number;
    /** Target delivery country code (ISO 2-letter, e.g., "US", "EG", "UK", "DE") */
    target_country?: string;
    /** Target currency code (3-letter, e.g., "USD", "EGP", "EUR") */
    target_currency?: string;
    /** Whether to visit individual product detail pages to get full descriptions/reviews (recommended: true) */
    scrape_product_details?: boolean;
    /** Apify Proxy Configuration */
    proxy_configuration?: {
        useApifyProxy?: boolean;
        apifyProxyGroups?: string[];
        apifyProxyCountry?: string;
    };
}
