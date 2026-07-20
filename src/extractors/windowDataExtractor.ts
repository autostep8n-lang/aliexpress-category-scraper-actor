/**
 * Deep extraction engine for AliExpress page data.
 * Extracts the 17 required data points from window._runParams, window.__INIT_DATA__, and DOM elements.
 */

import { CheerioAPI } from 'cheerio';
import { AliExpressProductItem, ShippingDetails } from '../types.js';

import {
    stripHtml,
    parsePriceToNumber,
    extractProductId,
    cleanDiscountPercent,
    parseOrderCount,
    toHighResImage
} from '../utils/cleaners.js';

/**
 * Extracts product details from window object embedded inside product listing or details pages.
 */
export function extractFromProductDetailPage(
    $: CheerioAPI,
    url: string,
    windowData: any,
    defaultCountry: string,
    defaultCurrency: string
): AliExpressProductItem {
    // Attempt to locate structured modules from window._runParams or window.__INIT_DATA__
const data =
    windowData?.DCData ||
    windowData?.data ||
    windowData ||
    {};    const priceModule = data.priceModule || {};
    const shippingModule = data.shippingModule || data.webGeneralShipping || {};
    const skuModule = data.skuModule || {};
    const titleModule = data.titleModule || {};
    const reviewsModule = data.reviewsModule || data.feedbackModule || {};
    const descriptionModule = data.descriptionModule || {};
    const commonModule = data.commonModule || {};
    const specsModule = data.specsModule || {};

    // 1. Product ID
    let productId = extractProductId(
        titleModule.id ||
        data.actionModule?.productId ||
        commonModule.productId ||
        url
    );
    if (!productId) {
        productId = extractProductId(url) || 'unknown_id';
    }

    // 2. Product URL
    const productUrl = `https://www.aliexpress.com/item/${productId}.html`;

    // 3. Product Images
    let productImages: string[] = [];
    if (data.imageModule?.imagePathList && Array.isArray(data.imageModule.imagePathList)) {
        productImages = data.imageModule.imagePathList.map((img: string) => toHighResImage(img)!).filter(Boolean);
    } else {
        // Fallback DOM extraction for images
        $('img.magnifier-image, .slider--img--1cI1_Z_, div[class*="image-view"] img').each((_, el) => {
            const src = $(el).attr('src') || $(el).attr('data-src');
            if (src) {
                const highRes = toHighResImage(src);
                if (highRes && !productImages.includes(highRes)) {
                    productImages.push(highRes);
                }
            }
        });
    }

    // 4. Shipping Details
    const shippingDetails: ShippingDetails = {
        time: null,
        price: 'Unknown',
        method: null
    };

    if (shippingModule.generalShippingDTO || shippingModule.shippingFeeText) {
        const genShip = shippingModule.generalShippingDTO || {};
        shippingDetails.method = genShip.shippingMethod || shippingModule.companyName || 'AliExpress Standard Shipping';
        shippingDetails.time = genShip.deliveryTimeRange || genShip.estimatedDeliveryTime || shippingModule.deliveryDate || null;
        
        const fee = genShip.shippingFeeText || shippingModule.shippingFeeText || '';
        if (/free/i.test(fee) || genShip.shippingFee === 0) {
            shippingDetails.price = 'Free Shipping';
        } else {
            const numFee = parsePriceToNumber(fee || genShip.shippingFee);
            shippingDetails.price = numFee !== null ? numFee : fee || 'Free Shipping';
        }
    } else {
        // Fallback DOM extraction for shipping
        const shipText = $('div[class*="shipping"], span[class*="delivery"]').text();
        if (/free shipping/i.test(shipText)) {
            shippingDetails.price = 'Free Shipping';
        }
        const timeMatch = shipText.match(/(\d+\s*-\s*\d+\s*Days|By\s+[A-Za-z]+\s+\d+)/i);
        if (timeMatch) shippingDetails.time = timeMatch[1];
    }

    // 5. Original Price
    let originalPrice = parsePriceToNumber(
        priceModule.minAmount?.value ||
        priceModule.formatedActivityPrice ||
        priceModule.originalPrice ||
        priceModule.skuPriceList?.[0]?.skuPrice?.originalPrice
    );

    // 6. Discount Percent
    let discountPercent = cleanDiscountPercent(
        priceModule.discount ||
        priceModule.discountRatio ||
        priceModule.skuPriceList?.[0]?.skuPrice?.discount
    );

    // 7. Final Price
    let finalPrice = parsePriceToNumber(
        priceModule.minActivityAmount?.value ||
        priceModule.formatedPrice ||
        priceModule.actMinPrice ||
        priceModule.skuPriceList?.[0]?.skuPrice?.skuVal?.actSkuPrice ||
        priceModule.skuPriceList?.[0]?.skuPrice?.skuVal?.skuPrice
    );

    // If final price isn't found, try DOM
    if (finalPrice === null) {
        const domPriceText = $('span[class*="price--current--"], span.uniform-banner-box-price, div[class*="product-price-value"]').first().text();
        finalPrice = parsePriceToNumber(domPriceText);
    }
    if (originalPrice === null && finalPrice !== null && discountPercent) {
        const pct = parseInt(discountPercent.replace('%', ''), 10);
        if (!isNaN(pct) && pct > 0 && pct < 100) {
            originalPrice = parseFloat((finalPrice / (1 - pct / 100)).toFixed(2));
        }
    }
    if (originalPrice === null && finalPrice !== null) {
        originalPrice = finalPrice;
    }

    // 8. Shipping From
    let shippingFrom: string | null = null;
    if (skuModule.productSKUPropertyList && Array.isArray(skuModule.productSKUPropertyList)) {
        const shipProp = skuModule.productSKUPropertyList.find((p: any) =>
            /ships? from|origin/i.test(p.skuPropertyName || p.propertyValueName || '')
        );
        if (shipProp && shipProp.skuPropertyValues?.[0]) {
            shippingFrom = shipProp.skuPropertyValues[0].propertyValueDisplayName || shipProp.skuPropertyValues[0].propertyValueName;
        }
    }
    if (!shippingFrom) {
        shippingFrom = data.shippingModule?.fromCountry || commonModule.sellerCountry || 'CN';
    }

    // 9. Reviews
    const reviews: Array<any> = [];
    if (reviewsModule.evaluationList && Array.isArray(reviewsModule.evaluationList)) {
        reviewsModule.evaluationList.slice(0, 10).forEach((rev: any) => {
            reviews.push({
                author: rev.buyerName || rev.buyerInfo?.name || 'Shopper',
                rating: rev.buyerEval || rev.star || 5,
                date: rev.evalDate || rev.date || '',
                comment: rev.buyerFeedback || rev.feedback || '',
                country: rev.buyerCountry || rev.country || defaultCountry
            });
        });
    } else {
        $('div[class*="feedback--item--"], div.list-item').slice(0, 5).each((_, el) => {
            const comment = $(el).find('div[class*="content"], div.buyer-feedback').text().trim();
            if (comment) {
                reviews.push({
                    author: $(el).find('span[class*="user"], span.user-name').text().trim() || 'Shopper',
                    rating: 5,
                    date: $(el).find('span[class*="time"], span.r-time').text().trim(),
                    comment
                });
            }
        });
    }

    // 10. Order Count / Total Sold
    let orderCount = parseOrderCount(
        titleModule.formatTradeCount ||
        titleModule.tradeCount ||
        data.tradeModule?.formatTradeCount ||
        $('span[class*="trade--trade--"], span[class*="sold--sold--"], span.order-num').text()
    );

    // 11. Rating
    let rating: number | null = null;
    const rawRating = titleModule.feedbackRating?.averageStar || reviewsModule.averageStar || reviewsModule.rating;
    if (rawRating) {
        rating = parseFloat(String(rawRating));
    } else {
        const domRating = $('span[class*="overview--rating--"], span.percent-num').first().text();
        const parsedDom = parseFloat(domRating);
        if (!isNaN(parsedDom)) rating = parsedDom;
    }

    // 12. Title
    const title = titleModule.subject || $('h1[class*="title--"], h1.product-title-text').first().text().trim() || `AliExpress Product ${productId}`;

    // 13. Currency
    const currency = priceModule.minAmount?.currency || priceModule.currency || defaultCurrency || 'USD';

    // 14. Selling Point
    const sellingPoint: string[] = [];
    if (specsModule.props && Array.isArray(specsModule.props)) {
        specsModule.props.slice(0, 8).forEach((p: any) => {
            if (p.attrName && p.attrValue) {
                sellingPoint.push(`${p.attrName}: ${p.attrValue}`);
            }
        });
    }
    $('ul[class*="specs--"], div[class*="selling-point"] li').each((_, el) => {
        const text = $(el).text().trim();
        if (text && !sellingPoint.includes(text)) {
            sellingPoint.push(text);
        }
    });

    // 15. Description
    let description = stripHtml(descriptionModule.descriptionUrl ? `Product description loaded from ${descriptionModule.descriptionUrl}` : null);
    if (!description || description.length < 10) {
        const domDesc = stripHtml($('div[id="product-description"], div[class*="detail--content--"]').html());
        description = domDesc || (sellingPoint.length > 0 ? sellingPoint.join('\n') : title);
    }

    // 16. In Stock
    let inStock: boolean | number = true;
    if (skuModule.skuPriceList && Array.isArray(skuModule.skuPriceList)) {
        const totalAvail = skuModule.skuPriceList.reduce((acc: number, curr: any) => acc + (curr.skuVal?.availQuantity || 0), 0);
        inStock = totalAvail > 0 ? totalAvail : false;
    } else if (data.actionModule?.itemStatus === 'sold_out' || /out of stock/i.test($('button[class*="buy-btn"]').text())) {
        inStock = false;
    }

    // 17. Country
    const country = defaultCountry || 'US';

    return {
        product_id: productId,
        product_url: productUrl,
        product_images: productImages,
        shipping_details: shippingDetails,
        original_price: originalPrice,
        discount_percent: discountPercent,
        final_price: finalPrice,
        shipping_from: shippingFrom,
        reviews,
        order_count: orderCount,
        rating,
        title,
        currency,
        selling_point: sellingPoint,
        description,
        in_stock: inStock,
        country,
        _metadata: {
            scraped_at: new Date().toISOString(),
            source_category_url: url
        }
    };
}

/**
 * Extracts lightweight product items from Category listing card when details page scraping is disabled or as initial seed.
 */
export function extractFromCategoryCard(
    card: any,
    sourceCategoryUrl: string,
    defaultCountry: string,
    defaultCurrency: string
): AliExpressProductItem {
    const productId = extractProductId(card.productId || card.id || card.item_id || card.product_id) || String(Math.floor(Math.random() * 1e12));
    const productUrl = `https://www.aliexpress.com/item/${productId}.html`;
    const title = card.title?.displayTitle || card.title || card.subject || 'AliExpress Item';
    const image = toHighResImage(card.image?.imgUrl || card.image || card.imageUrl);
    const productImages = image ? [image] : [];

    const finalPrice = parsePriceToNumber(card.prices?.salePrice?.minPrice || card.salePrice || card.price || card.current_price);
    const originalPrice = parsePriceToNumber(card.prices?.originalPrice?.minPrice || card.originalPrice || finalPrice);
    const discountPercent = cleanDiscountPercent(card.prices?.discount || card.discount);

    const orderCount = parseOrderCount(card.trade?.tradeDesc || card.soldCount || card.orders);
    const rating = card.evaluation?.starRating || card.rating || null;

    const shippingDetails: ShippingDetails = {
        time: card.logistics?.deliveryTime || null,
        price: /free/i.test(card.logistics?.shippingFee || '') ? 'Free Shipping' : parsePriceToNumber(card.logistics?.shippingFee) || 'Free Shipping',
        method: card.logistics?.logisticsCompany || 'AliExpress Standard Shipping'
    };

    return {
        product_id: productId,
        product_url: productUrl,
        product_images: productImages,
        shipping_details: shippingDetails,
        original_price: originalPrice,
        discount_percent: discountPercent,
        final_price: finalPrice,
        shipping_from: card.originCountry || 'CN',
        reviews: [],
        order_count: orderCount,
        rating,
        title,
        currency: defaultCurrency || 'USD',
        selling_point: card.sellingPoints || [],
        description: title,
        in_stock: true,
        country: defaultCountry || 'US',
        _metadata: {
            scraped_at: new Date().toISOString(),
            source_category_url: sourceCategoryUrl
        }
    };
}
