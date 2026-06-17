/**
 * Luna/Sora Extension Module for Animetsu
 * Target Site: https://animetsu.net
 */

class AnimetsuModule {
    constructor() {
        this.baseUrl = "https://animetsu.net";
    }

    getHeaders() {
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": this.baseUrl
        };
    }

    /**
     * Fetches the latest anime updates from the homepage
     */
    async getLatest(page = 1) {
        try {
            const url = page > 1 ? `${this.baseUrl}/page/${page}/` : this.baseUrl;
            const response = await fetch(url, { headers: this.getHeaders() });
            const html = await response.text();
            
            const items = [];
            // Parse the grid items from the theme (typically wrapped in '.bsx' or '.limheight')
            const regex = /<div class="bsx">([\s\S]*?)<\/div><\/div>/g;
            let match;

            while ((match = regex.exec(html)) !== null) {
                const block = match[1];
                const urlMatch = block.match(/href="([^"]+)"/);
                const titleMatch = block.match(/title="([^"]+)"/);
                const imgMatch = block.match(/src="([^"]+)"/);
                const epMatch = block.match(/<span class="epx">([^<]+)<\/span>/);

                if (urlMatch && titleMatch) {
                    items.push({
                        title: titleMatch[1],
                        url: urlMatch[1],
                        poster: imgMatch ? imgMatch[1] : "",
                        subtitle: epMatch ? epMatch[1].trim() : ""
                    });
                }
            }
            return items;
        } catch (error) {
            console.error(`[Animetsu Latest Error]: ${error}`);
            return [];
        }
    }

    /**
     * Executes a search query using the searchBaseUrl pattern
     */
    async search(query, page = 1) {
        try {
            const url = `${this.baseUrl}/page/${page}/?s=${encodeURIComponent(query)}`;
            const response = await fetch(url, { headers: this.getHeaders() });
            const html = await response.text();
            
            const results = [];
            const regex = /<div class="bsx">([\s\S]*?)<\/div><\/div>/g;
            let match;

            while ((match = regex.exec(html)) !== null) {
                const block = match[1];
                const urlMatch = block.match(/href="([^"]+)"/);
                const titleMatch = block.match(/title="([^"]+)"/);
                const imgMatch = block.match(/src="([^"]+)"/);

                if (urlMatch && titleMatch) {
                    results.push({
                        title: titleMatch[1],
                        url: urlMatch[1],
                        poster: imgMatch ? imgMatch[1] : ""
                    });
                }
            }
            return results;
        } catch (error) {
            console.error(`[Animetsu Search Error]: ${error}`);
            return [];
        }
    }

    /**
     * Parses the detailed info page of an anime and indexes its episode list
     */
    async getDetails(animeUrl) {
        try {
            const response = await fetch(animeUrl, { headers: this.getHeaders() });
            const html = await response.text();
            
            const titleMatch = html.match(/<h1 class="entry-title" itemprop="name">([^<]+)<\/h1>/);
            const descMatch = html.match(/<div class="entry-content" itemprop="description">([\s\S]*?)<\/div>/);
            const posterMatch = html.match(/<img[^>]+class="wp-post-image"[^>]+src="([^"]+)"/);

            const details = {
                title: titleMatch ? titleMatch[1].trim() : "Unknown Anime",
                description: descMatch ? descMatch[1].replace(/<[^>]*>/g, '').trim() : "",
                poster: posterMatch ? posterMatch[1] : "",
                episodes: []
            };

            // Capture the episode links listed in the bottom section
            const epRegex = /<div class="eplister">([\s\S]*?)<\/div>/;
            const epBlock = html.match(epRegex);
            
            if (epBlock) {
                const epLinkRegex = /<a href="([^"]+)"[^>]*>[\s\S]*?<div class="epl-num">([^<]+)<\/div>/g;
                let epMatch;
                while ((epMatch = epLinkRegex.exec(epBlock[1])) !== null) {
                    details.episodes.push({
                        name: `Episode ${epMatch[2].trim()}`,
                        url: epMatch[1]
                    });
                }
            }

            // Standardize listing order from Episode 1 onwards
            details.episodes.reverse();
            return details;
        } catch (error) {
            console.error(`[Animetsu Details Error]: ${error}`);
            return null;
        }
    }

    /**
     * Grabs the direct HLS/MP4 streams or Player Embeds from an episode page
     */
    async getStreamUrls(episodeUrl) {
        try {
            const response = await fetch(episodeUrl, { headers: this.getHeaders() });
            const html = await response.text();
            
            const streams = [];
            
            // Extract player dynamic mirror dropdown frames (e.g., Doodle, Streamtape, or direct HLS)
            const optionRegex = /<option value="([^"]+)"[^>]*>([^<]+)<\/option>/g;
            let match;
            
            while ((match = optionRegex.exec(html)) !== null) {
                let embedData = match[1];
                let serverName = match[2].trim();
                
                // If value is base64 encoded by the theme, decode it
                if (!embedData.startsWith('http') && embedData.length > 10) {
                    try {
                        embedData = atob(embedData);
                    } catch(e) {}
                }

                if (embedData.includes('http')) {
                    // Extract exact source patterns inside the frame if visible
                    const iframeMatch = embedData.match(/src="([^"]+)"/);
                    const sourceUrl = iframeMatch ? iframeMatch[1] : embedData;
                    
                    streams.push({
                        serverName: serverName || "Default Server",
                        url: sourceUrl,
                        type: sourceUrl.includes(".m3u8") ? "HLS" : "embed"
                    });
                }
            }

            return streams;
        } catch (error) {
            console.error(`[Animetsu Stream Error]: ${error}`);
            return [];
        }
    }
}

export default new AnimetsuModule();
