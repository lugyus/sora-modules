/**
 * ============================================================================
 * SORA/LUNA NATIVE NETWORK BRIDGE BOILERPLATE
 * ============================================================================
 */
async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    const headers = options.headers || {};
    
    // Mimic an active modern desktop browser signature to handle basic protection layers
    headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
    headers["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8";
    headers["Accept-Language"] = "en-US,en;q=0.9";
    headers["Cache-Control"] = "no-cache";
    headers["Pragma"] = "no-cache";

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
        const searchUrl = `https://animetsu.net/search?keyword=${encodeURIComponent(keyword)}`;
        const response = await soraFetch(searchUrl);
        if (!response) return JSON.stringify([]);

        const htmlText = await response.text();

        // Anti-Bot Check Validation: If Cloudflare catches us, fail gracefully rather than locking the loop
        if (htmlText.includes("cloudflare") || htmlText.includes("Just a moment")) {
            return JSON.stringify([{
                title: "Error: Cloudflare protection active. Please reload.",
                image: "https://animetsu.net/favicon.ico",
                href: "https://animetsu.net"
            }]);
        }

        const results = [];

        // SOLUTION: Split extraction by structural card blocks first to prevent loose tag skipping
        // Captures standard card wrappers (like grid-items, anime-blocks, or uniform card divs)
        const blockRegex = /<div\s+class="[^"]*(?:anime|card|item|entry|poster)[^"]*"[^>]*>([\s\S]*?)<\/div><\/div>/gi;
        
        // Secondary regex checklist applied inside isolated card contexts
        const hrefRegex = /href="([^"]+)"/i;
        const imgRegex = /src="([^"]+)"/i;
        const fallbackTitleRegex = />([^<>\n\r]+)</;

        let blockMatch;
        while ((blockMatch = blockRegex.exec(htmlText)) !== null) {
            const cardHtml = blockMatch[1];

            const hrefCheck = hrefRegex.exec(cardHtml);
            const imgCheck = imgRegex.exec(cardHtml);

            if (!hrefCheck) continue;

            const targetHref = hrefCheck[1];
            if (targetHref.includes('/search') || targetHref === '/' || targetHref.includes('javascript:')) continue;

            // Isolate clean textual nodes to parse title safely
            let titleText = "";
            const titleElementMatch = /<h\d[^>]*>([\s\S]*?)<\/h\d>/i.exec(cardHtml) || 
                                      /<span\s+class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(cardHtml);

            if (titleElementMatch) {
                titleText = titleElementMatch[1].replace(/<[^>]*>/g, '').trim();
            } else {
                // Fallback catch for loose strings inside the parent blocks
                const rawLines = cardHtml.replace(/<[^>]*>/g, '\n').split('\n');
                for (let line of rawLines) {
                    if (line.trim().length > 2) {
                        titleText = line.trim();
                        break;
                    }
                }
            }

            if (!titleText) continue;

            results.push({
                title: titleText,
                image: imgCheck ? fixUrl(imgCheck[1]) : "https://animetsu.net/favicon.ico",
                href: fixUrl(targetHref)
            });
        }

        // UNIVERSAL BACKUP: If structural card isolation fails, try loose image link binding pairs
        if (results.length === 0) {
            const backupRegex = /<a\s+[^>]*href="([^"]+)"[^>]*>[\s\S]*?<img\s+[^>]*src="([^"]+)"[^>]*>[\s\S]*?<\/a>/gi;
            let backMatch;
            while ((backMatch = backupRegex.exec(htmlText)) !== null) {
                if (backMatch[1].includes('/search') || backMatch[1] === '/') continue;
                results.push({
                    title: "Anime Match", 
                    image: fixUrl(backMatch[2]),
                    href: fixUrl(backMatch[1])
                });
            }
        }

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
                          /<p[^>]*class="[^"]*(?:plot|synopsis|text)[^"]*"[^>]*>([\s\S]*?)<\/p>/i.exec(htmlText);
        if (descMatch) {
            description = descMatch[1].replace(/<[^>]*>/g, '').trim();
        }

        let aliases = "";
        const aliasMatch = /Synonyms:[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i.exec(htmlText);
        if (aliasMatch) {
            aliases = aliasMatch[1].replace(/<[^>]*>/g, '').trim();
        }

        let airdate = "Unknown";
        const airdateMatch = /Aired:[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i.exec(htmlText);
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

        const regex = /<a\s+[^>]*href="([^"]+)"[^>]*>[\s\S]*?(?:Episode|Ep)?\s*(\d+)/gi;
        let match;

        while ((match = regex.exec(htmlText)) !== null) {
            const href = match[1];
            if (href.includes('/watch/') || href.includes('-episode-') || href.includes('/ep-')) {
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
                title: "Animetsu HLS Stream",
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
                title: "Mirror Stream Player",
                streamUrl: fixUrl(iframeMatch[1]),
                headers: { "Referer": "https://animetsu.net/" }
            });
        }

        return JSON.stringify(streamDetails);
    } catch (error) {
        return JSON.stringify({ streams: [] });
    }
}
