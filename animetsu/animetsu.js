const BASE_URL = "https://animetsu.net";
const API_URL = `${BASE_URL}/v2/api/anime`;
const PROXY = "https://swiftstream.top/proxy";

/**
 * Safe fetch wrapper (fixes header + fallback issues)
 */
async function soraFetch(url, options = {}) {
    const headers = options.headers || {};

    if (!headers["User-Agent"]) {
        headers["User-Agent"] =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
    }

    headers["Accept"] = "application/json";
    headers["Referer"] = BASE_URL;

    try {
        if (typeof fetchv2 === "function") {
            return await fetchv2(url, {
                headers,
                method: options.method || "GET",
                body: options.body || null
            });
        }

        return await fetch(url, {
            headers,
            method: options.method || "GET",
            body: options.body || null
        });
    } catch (e) {
        try {
            return await fetch(url, {
                headers,
                method: options.method || "GET",
                body: options.body || null
            });
        } catch (err) {
            return null;
        }
    }
}

/**
 * SEARCH
 */
async function searchResults(keyword) {
    try {
        const response = await soraFetch(
            `${API_URL}/search/?query=${encodeURIComponent(keyword)}`
        );

        if (!response) return JSON.stringify([]);

        const json = await response.json();

        const animeList =
            Array.isArray(json?.data)
                ? json.data
                : Array.isArray(json?.results)
                ? json.results
                : Array.isArray(json)
                ? json
                : [];

        const results = animeList.map((anime) => ({
            title: anime.title || anime.name || "",
            image: anime.poster || anime.image || "",
            href: `${BASE_URL}/anime/${anime.id}`
        }));

        return JSON.stringify(results);
    } catch (e) {
        return JSON.stringify([]);
    }
}

/**
 * DETAILS
 */
async function extractDetails(url) {
    try {
        const parts = url.split("/").filter(Boolean);
        const animeId = parts[parts.length - 1];

        const response = await soraFetch(`${API_URL}/info/${animeId}`);
        if (!response) return JSON.stringify([]);

        const json = await response.json();

        return JSON.stringify([
            {
                description: json.description || json.synopsis || "",
                aliases: (json.alternativeTitles || []).join(", "),
                airdate: json.releaseDate || json.year || ""
            }
        ]);
    } catch (e) {
        return JSON.stringify([]);
    }
}

/**
 * EPISODES
 */
async function extractEpisodes(url) {
    try {
        const parts = url.split("/").filter(Boolean);
        const animeId = parts[parts.length - 1];

        const response = await soraFetch(`${API_URL}/eps/${animeId}`);
        if (!response) return JSON.stringify([]);

        const json = await response.json();

        const epList =
            Array.isArray(json?.episodes)
                ? json.episodes
                : Array.isArray(json?.data)
                ? json.data
                : Array.isArray(json)
                ? json
                : [];

        const episodes = epList.map((ep) => {
            const epNumber = ep.number ?? ep.episodeNumber ?? 0;

            return {
                href: `${animeId}/${epNumber}`,
                number: Number(epNumber)
            };
        });

        return JSON.stringify(episodes);
    } catch (e) {
        return JSON.stringify([]);
    }
}

/**
 * STREAM
 */
async function extractStreamUrl(url) {
    try {
        const parts = url.split("/").filter(Boolean);

        const episode = parts[parts.length - 1];
        const animeId = parts[parts.length - 2];

        const response = await soraFetch(
            `${API_URL}/oppai/${animeId}/${episode}?server=default&source_type=sub`
        );

        if (!response) {
            return JSON.stringify({ streams: [], subtitles: [] });
        }

        const json = await response.json();

        const sources = Array.isArray(json?.sources) ? json.sources : [];

        const streams = sources.map((source) => {
            let streamUrl = source.url;

            if (streamUrl?.startsWith("/")) {
                streamUrl = `${PROXY}${streamUrl}`;
            }

            return {
                title: source.quality || "Auto",
                streamUrl,
                headers: {
                    Referer: BASE_URL
                }
            };
        });

        const subtitles = Array.isArray(json?.subs)
            ? json.subs.map((s) => ({
                  url: s.url,
                  lang: s.lang || "unknown"
              }))
            : [];

        return JSON.stringify({
            streams,
            subtitles
        });
    } catch (e) {
        return JSON.stringify({
            streams: [],
            subtitles: []
        });
    }
}
