/**
 * ============================================================================
 * SORA/LUNA NATIVE NETWORK BRIDGE BOILERPLATE
 * ============================================================================
 */
async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    const headers = options.headers || {};
    headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
    try {
        return await fetchv2(url, headers, options.method || 'GET', options.body || null);
    } catch (e) {
        try { 
            return await fetch(url, options); 
        } catch (error) { 
            return null; 
        }
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
 * CORE IMPLEMENTATION (Proxied Matrix)
 * ============================================================================
 */

async function searchResults(keyword) {
    try {
        // Target target destination wrapped completely into a CORS utility engine
        const targetUrl = `https://animetsu.net/search?keyword=${encodeURIComponent(keyword)}`;
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
        
        const response = await soraFetch(proxyUrl);
        if (!response) return JSON.stringify([{ title: "Proxy server down", image: "", href: "" }]);

        // AllOrigins returns data wrapped as a JSON object: { contents: "<html>...</html>" }
        const resJson = await response.json();
        const htmlText = resJson.contents || "";

        if (!htmlText || htmlText.includes("cloudflare") || htmlText.includes("Just a moment")) {
            return JSON.stringify([{
                title: "Proxy blocked by Cloudflare challenge",
                image: "https://animetsu.net/favicon.ico",
                href: "https://animetsu.net"
            }]);
        }

        const results = [];
        const looseRegex = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        const imgSrcRegex = /src="([^"]+)"/i;
        const titleAttrRegex = /title="([^"]+)"/i;

        let match;
        while ((match = looseRegex.exec(htmlText)) !== null) {
            const href = match[1];
            const innerHtml = match[2];

            if (href.includes('/search') || href === '/' || href.includes('javascript:')) continue;

            const imgMatch = imgSrcRegex.exec(innerHtml);
            if (!imgMatch) continue;

            let title = "";
            const titleAttr = titleAttrRegex.exec(innerHtml) || titleAttrRegex.exec(match[0]);
            
            if (titleAttr) {
                title = titleAttr[1].trim();
            } else {
                const textStrip = innerHtml.replace(/<[^>]*>/g, '').trim();
                if (textStrip.length > 1) title = textStrip;
            }

            if (!title) title = "Anime Content";

            results.push({
                title: title,
                image: fixUrl(imgMatch[1]),
                href: fixUrl(href)
            });
        }

        return JSON.stringify(results.slice(0, 24));
    } catch (error) {
        return JSON.stringify([{ title: "Parsing failed internally", image: "", href: "" }]);
    }
}

async function extractDetails(url) {
    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await soraFetch(proxyUrl);
        if (!response) return JSON.stringify([{ description: "Failed to load details", aliases: "", airdate: "" }]);

        const resJson = await response.json();
        const htmlText = resJson.contents || "";
        
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
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await soraFetch(proxyUrl);
        if (!response) return JSON.stringify([]);
        
        const resJson = await response.json();
        const htmlText = resJson.contents || "";
        
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
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await soraFetch(proxyUrl);
        if (!response) return JSON.stringify({ streams: [] });
        
        const resJson = await response.json();
        const htmlText = resJson.contents || "";

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
