/**
 * Utility functions for cleaning and normalizing AliExpress data.
 */

/**
 * Strips HTML tags and decodes common entities to return clean plaintext description.
 */
export function stripHtml(html: string | null | undefined): string | null {
    if (!html) return null;
    return html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<\/div>|<\/p>|<\/li>|<\/h[1-6]>/gi, '\n')
        .replace(/<br\s*[\/]?>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n\s*\n/g, '\n\n')
        .replace(/[ \t]+/g, ' ')
        .trim();
}

/**
 * Parses numeric price from string or number.
 * Examples: "$12.99" -> 12.99, "EGP 450.50" -> 450.5, "US $1,234.00" -> 1234.00
 */
export function parsePriceToNumber(rawPrice: string | number | null | undefined): number | null {
    if (typeof rawPrice === 'number') return isNaN(rawPrice) ? null : rawPrice;
    if (!rawPrice) return null;
    
    // Clean string: remove currency symbols and letters, replace commas
    const cleaned = String(rawPrice)
        .replace(/^[^\d\.\,]+/g, '')
        .replace(/[^\d\.\,]/g, '')
        .replace(/,/g, '');
    
    // If there are multiple ranges like "12.99 - 15.99", take the first price
    const match = cleaned.match(/(\d+(?:\.\d+)?)/);
    if (match && match[1]) {
        const parsed = parseFloat(match[1]);
        return isNaN(parsed) ? null : parsed;
    }
    return null;
}

/**
 * Extracts the clean 16-digit product ID from an AliExpress URL or string.
 */
export function extractProductId(urlOrId: string | number | null | undefined): string | null {
    if (!urlOrId) return null;
    const str = String(urlOrId);
    // Direct ID check
    if (/^\d{10,18}$/.test(str)) {
        return str;
    }
    // Extract from URL (e.g., https://www.aliexpress.com/item/1005005829103948.html)
    const match = str.match(/\/item\/(\d{10,18})\.html/i) || str.match(/productId=(\d{10,18})/i) || str.match(/(\d{11,18})/);
    return match ? match[1] : null;
}

/**
 * Normalizes discount percentage string (e.g., "-20%", "20% OFF", "0.2" -> "20%")
 */
export function cleanDiscountPercent(rawDiscount: string | number | null | undefined): string | null {
    if (!rawDiscount) return null;
    const str = String(rawDiscount).trim();
    if (str === '0' || str === '0%' || str === '' || str.toLowerCase() === 'null') return null;
    
    const numMatch = str.match(/(\d+)/);
    if (numMatch) {
        return `${numMatch[1]}%`;
    }
    return str;
}

/**
 * Normalizes order count / total sold to a clean integer or standard string if range.
 * e.g., "1,200+ sold" -> 1200, "5000+ orders" -> 5000
 */
export function parseOrderCount(rawSold: string | number | null | undefined): number | string | null {
    if (typeof rawSold === 'number') return rawSold;
    if (!rawSold) return null;
    const str = String(rawSold).trim();
    const match = str.replace(/,/g, '').match(/(\d+)/);
    if (match && match[1]) {
        return parseInt(match[1], 10);
    }
    return str || null;
}

/**
 * Formats high-resolution image URL (converts thumbnail _50x50.jpg / _220x220.jpg to original .jpg)
 */
export function toHighResImage(imgUrl: string | null | undefined): string | null {
    if (!imgUrl) return null;
    let clean = imgUrl.startsWith('//') ? `https:${imgUrl}` : imgUrl;
    // Remove AliExpress resize suffixes like _.webp, _220x220.jpg, _50x50.jpg
    clean = clean.replace(/_\d+x\d+\.(jpg|png|webp).*$/i, '');
    clean = clean.replace(/\.jpg_.*$/i, '.jpg');
    clean = clean.replace(/\.png_.*$/i, '.png');
    clean = clean.replace(/\.webp_.*$/i, '.webp');
    return clean;
}
