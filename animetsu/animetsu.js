/**
 * ============================================================================
 * SORA/LUNA NATIVE NETWORK BRIDGE BOILERPLATE
 * ============================================================================
 */
async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    const headers = options.headers || {};
    if (!headers["User-Agent"]) {
        headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    }
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
 * CORE IMPLEMENTATION (Global Scope)
 * ============================================================================
 */

/** Search anime titles by keyword */
async function searchResults(keyword) {
    try {
        // FIXED: Reverted to the direct site endpoint
        const searchUrl = `https://animetsu.net/search?keyword=${encodeURIComponent(keyword)}`;
        const response = await soraFetch(searchUrl);
        if (!response) return JSON.stringify([]);

        const htmlText = await response.text();
        const results = [];

        // FIXED: Highly permissive decoupled RegEx pattern that matches standard structural blocks
        const regex = /<a\s+[^>]*href="([^"]+)"[^>]*>[\s\S]*?<img\s+[^>]*src="([^"]+)"[\s\S]*?>([\s\S]*?)<\/a>/gi;
        let match;

        while ((match = regex.exec(htmlText)) !== null) {
            const rawHref = match[1];
            const rawImg = match[2];
            const innerContent = match[3];

            // Filter out navigation or duplicate links
            if (rawHref.includes('/search') || rawHref === '/' || rawHref.includes('javascript:')) continue;

            // Extract text cleanly by removing lingering interior tags
            const titleStr = innerContent.replace(/<[^>]*>/g, '').trim();
            if (!titleStr) continue;

            results.push({
                title: titleStr,
                image: fixUrl(rawImg),
                href: fixUrl(rawHref)
            });
        }

        // Limit results to avoid memory bloating in QuickJS environments
        return JSON.stringify(results.slice(0, 30));
    } catch (error) {
        return JSON.stringify([]);
    }
}

/** Extract metadata details of a given anime */
async function extractDetails(url) {
    try {
        const response = await soraFetch(url);
        if (!response) return JSON.stringify([{ description: "", aliases: "", airdate: "" }]);

        const htmlText = await response.text();

        let description = "";
        const descMatch = /<div\s+class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(htmlText) ||
                           /<p[^>]*>([\s\S]*?)<\/p>/i.exec(htmlText); // Fallback to first major paragraph block
        if (descMatch) {
            description = descMatch[1].replace(/<[^>]*>/g, '').trim();
        }

        let aliases = "";
        const aliasMatch = /<span\s+class="[^"]*synonyms[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(htmlText);
        if (aliasMatch) {
            aliases = aliasMatch[1].replace(/<[^>]*>/g, '').trim();
        }

        let airdate = "Unknown";
        const airdateMatch = /<span\s+class="[^"]*aired[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(htmlText);
        if (airdateMatch) {
            airdate = airdateMatch[1].replace(/<[^>]*>/g, '').trim();
        }

        return JSON.stringify([{
            description: description,
            aliases: aliases,
            airdate: airdate
        }]);
    } catch (error) {
        return JSON.stringify([{ description: "", aliases: "", airdate: "" }]);
    }
}

/** Extract episodes for a given anime */
async function extractEpisodes(url) {
    try {
        const response = await soraFetch(url);
        if (!response) return JSON.stringify([]);

        const htmlText = await response.text();
        const episodes = [];

        // Captures standard structural pattern configurations for layout loops
        const regex = /<a\s+[^>]*href="([^"]+)"[^>]*>[\s\S]*?(\d+)/gi;
        let match;

        while ((match = regex.exec(htmlText)) !== null) {
            const href = match[1];
            // Verify link points to structural watch/episode routes
            if (href.includes('/watch/') || href.includes('/episode-')) {
                episodes.push({
                    href: fixUrl(href),
                    number: parseInt(match[2], 10)
                });
            }
        }

        const uniqueEpisodes = Array.from(new Map(episodes.map(item => [item.number, item])).values());
        uniqueEpisodes.sort((a, b) => a.number - b.number);

        return JSON.stringify(uniqueEpisodes);
    } catch (error) {
        return JSON.stringify([]);
    }
}

/** Extract streaming options and subtitles */
async function extractStreamUrl(url) {
    try {
        const response = await soraFetch(url);
        if (!response) return JSON.stringify({ streams: [] });

        const htmlText = await response.text();
        const streamDetails = { streams: [], subtitles: "" };

        const streamRegex = /(?:file|src|url)\s*:\s*"([^"]+\.m3u8[^"]*)"/i;
        const match = streamRegex.exec(htmlText);

        if (match) {
            streamDetails.streams.push({
                title: "Animetsu Video Stream",
                streamUrl: match[1],
                headers: {
                    "Referer": "https://animetsu.net/",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
                }
            });
        }

        const iframeRegex = /<iframe\s+[^>]*src="([^"]+)"/i;
        const iframeMatch = iframeRegex.exec(htmlText);
        if (iframeMatch && streamDetails.streams.length === 0) {
            streamDetails.streams.push({
                title: "Mirror Source",
                streamUrl: fixUrl(iframeMatch[1]),
                headers: { "Referer": "https://animetsu.net/" }
            });
        }

        return JSON.stringify(streamDetails);
    } catch (error) {
        return JSON.stringify({ streams: [] });
    }
}
