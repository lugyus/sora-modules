/**
 * ============================================================================
 * ENHANCED NETWORK ENGINE (Handles advanced headers)
 * ============================================================================
 */
async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    const headers = options.headers || {};
    
    // Total browser spoofing matrix
    headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
    headers["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8";
    headers["Accept-Language"] = "en-US,en;q=0.9";
    headers["Cache-Control"] = "no-cache";
    headers["Connection"] = "keep-alive";
    headers["Upgrade-Insecure-Requests"] = "1";
    headers["Sec-Fetch-Dest"] = "document";
    headers["Sec-Fetch-Mode"] = "navigate";
    headers["Sec-Fetch-Site"] = "none";
    headers["Sec-Fetch-User"] = "?1";

    try {
        const res = await fetchv2(url, headers, options.method || 'GET', options.body || null);
        if (res) return res;
    } catch (e) {}
    
    try { 
        return await fetch(url, options); 
    } catch (error) { 
        return null; 
    }
}

function fixUrl(href) {
    if (!href) return "";
    if (href.startsWith('//')) return 'https:' + href;
    if (href.startsWith('/')) return 'https://animetsu.net' + href;
    return href;
}

/**
 * ============================================================================
 * CORE IMPLEMENTATION
 * ============================================================================
 */

async function searchResults(keyword) {
    try {
        const searchUrl = `https://animetsu.net/search?keyword=${encodeURIComponent(keyword)}`;
        const response = await soraFetch(searchUrl);
        if (!response) {
            return JSON.stringify([{ title: "Network connection refused", image: "", href: "" }]);
        }

        const htmlText = await response.text();

        // 1. Direct Cloudflare Validation
        if (htmlText.includes("cloudflare") || htmlText.includes("Just a moment") || htmlText.length < 200) {
            return JSON.stringify([{
                title: "Cloudflare Security Blocked Request",
                image: "https://animetsu.net/favicon.ico",
                href: "https://animetsu.net"
            }]);
        }

        const results = [];

        // 2. AGGRESIVE FLOATING EXTRACTOR (Ignores element layouts completely)
        // This looks for ANY anchor tag wrapping or adjacent to an image source.
        const looseRegex = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        const imgSrcRegex = /src="([^"]+)"/i;
        const titleAttrRegex = /title="([^"]+)"/i;

        let match;
        while ((match = looseRegex.exec(htmlText)) !== null) {
            const href = match[1];
            const innerHtml = match[2];

            // Filter out system links
            if (href.includes('/search') || href === '/' || href.includes('javascript:')) continue;

            // Check if this anchor node contains an image asset
            const imgMatch = imgSrcRegex.exec(innerHtml);
            if (!imgMatch) continue;

            let title = "";
            // Look for clean titles inside the image tag properties or header text
            const titleAttr = titleAttrRegex.exec(innerHtml) || titleAttrRegex.exec(match[0]);
            
            if (titleAttr) {
                title = titleAttr[1].trim();
            } else {
                // Strip structural tags out to see if text nodes exist
                const textStrip = innerHtml.replace(/<[^>]*>/g, '').trim();
                if (textStrip.length > 1) {
                    title = textStrip;
                }
            }

            if (!title) title = "Anime Content";

            results.push({
                title: title,
                image: fixUrl(imgMatch[1]),
                href: fixUrl(href)
            });
        }

        // 3. ULTRA FALLBACK (Flat token pairing)
        if (results.length === 0) {
            const allLinks = [];
            const linkExtract = /href="([^"]+)"/gi;
            let lMatch;
            while((lMatch = linkExtract.exec(htmlText)) !== null) {
                if(!lMatch[1].includes('/search') && lMatch[1].length > 1) {
                    allLinks.push(fixUrl(lMatch[1]));
                }
            }
            
            if(allLinks.length > 0) {
                return JSON.stringify(allLinks.slice(0, 10).map((link, idx) => ({
                    title: `Discovered Link Match #${idx + 1}`,
                    image: "https://animetsu.net/favicon.ico",
                    href: link
                })));
            }
        }

        return JSON.stringify(results.slice(0, 24));
    } catch (error) {
        return JSON.stringify([{ title: "Parsing failed internally", image: "", href: "" }]);
    }
}

async function extractDetails(url) {
    try {
        const response = await soraFetch(url);
        if (!response) return JSON.stringify([{ description: "Failed to load source", aliases: "", airdate: "" }]);

        const htmlText = await response.text();
        let description = "No summary available.";

        const descMatch = htmlText.replace(/<[^>]*>/g, ' ').substring(0, 500);
        
        return JSON.stringify([{
            description: descMatch.trim() + "...",
            aliases: "N/A",
            airdate: "N/A"
        }]);
    } catch (error) {
        return JSON.stringify([{ description: "Error pulling data context", aliases: "", airdate: "" }]);
    }
}

async function extractEpisodes(url) {
    try {
        const response = await soraFetch(url);
        if (!response) return JSON.stringify([]);
        const htmlText = await response.text();
        
        const episodes = [];
        const regex = /href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        let match;

        while ((match = regex.exec(htmlText)) !== null) {
            const href = match[1];
            const text = match[2].replace(/<[^>]*>/g, '');
            if (href.includes('/watch/') || href.includes('-episode-') || /\b(\d+)\b/.test(text)) {
                const numMatch = /\b(\d+)\b/.exec(text);
                episodes.push({
                    href: fixUrl(href),
                    number: numMatch ? parseInt(numMatch[1], 10) : 1
                });
            }
        }
        return JSON.stringify(episodes.slice(0, 100));
    } catch (error) {
        return JSON.stringify([]);
    }
}

async function extractStreamUrl(url) {
    try {
        const response = await soraFetch(url);
        if (!response) return JSON.stringify({ streams: [] });
        const htmlText = await response.text();

        const iframeRegex = /<iframe\s+[^>]*src="([^"]+)"/i;
        const iframeMatch = iframeRegex.exec(htmlText);
        
        if (iframeMatch) {
            return JSON.stringify({
                streams: [{
                    title: "Default Mirror Source",
                    streamUrl: fixUrl(iframeMatch[1]),
                    headers: { "Referer": "https://animetsu.net/" }
                }]
            });
        }
        return JSON.stringify({ streams: [] });
    } catch (error) {
        return JSON.stringify({ streams: [] });
    }
}
