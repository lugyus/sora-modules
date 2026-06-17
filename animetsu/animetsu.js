const BASE_URL = "https://animetsu.net";
const API_URL = BASE_URL + "/v2/api/anime";

async function soraFetch(url, options = { headers: {}, method: "GET", body: null }) {
    const headers = options.headers || {};

    if (!headers["User-Agent"]) {
        headers["User-Agent"] =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
    }

    try {
        return await fetchv2(
            url,
            headers,
            options.method || "GET",
            options.body || null
        );
    } catch (e) {
        try {
            return await fetch(url, options);
        } catch (err) {
            return null;
        }
    }
}

async function searchResults(keyword) {
    try {
        const response = await soraFetch(
            `${API_URL}/search/?query=${encodeURIComponent(keyword)}`
        );

        if (!response) return JSON.stringify([]);

        const json = await response.json();

        const results = [];

        const animeList = json.data || json.results || json;

        for (const anime of animeList) {
            results.push({
                title: anime.title || anime.name || "",
                image: anime.poster || anime.image || "",
                href: `${BASE_URL}/anime/${anime.id}`
            });
        }

        return JSON.stringify(results);
    } catch (e) {
        return JSON.stringify([]);
    }
}

async function extractDetails(url) {
    try {
        const animeId = url.split("/").pop();

        const response = await soraFetch(
            `${API_URL}/info/${animeId}`
        );

        if (!response) return JSON.stringify([]);

        const json = await response.json();

        return JSON.stringify([
            {
                description:
                    json.description ||
                    json.synopsis ||
                    "",
                aliases:
                    (json.alternativeTitles || []).join(", "),
                airdate:
                    json.releaseDate ||
                    json.year ||
                    ""
            }
        ]);
    } catch (e) {
        return JSON.stringify([]);
    }
}

async function extractEpisodes(url) {
    try {
        const animeId = url.split("/").pop();

        const response = await soraFetch(
            `${API_URL}/eps/${animeId}`
        );

        if (!response) return JSON.stringify([]);

        const json = await response.json();

        const episodes = [];

        const epList = json.episodes || json.data || json;

        for (const ep of epList) {
            episodes.push({
                href: `${animeId}/${ep.number || ep.episodeNumber}`,
                number: Number(ep.number || ep.episodeNumber)
            });
        }

        return JSON.stringify(episodes);

    } catch (e) {
        return JSON.stringify([]);
    }
}

async function extractStreamUrl(url) {
    try {

        const parts = url.split("/");

        const episode =
            parts[parts.length - 1];

        const animeId =
            parts[parts.length - 2];

        const response = await soraFetch(
            `${API_URL}/oppai/${animeId}/${episode}?server=default&source_type=sub`
        );

        if (!response) {
            return JSON.stringify({
                streams: []
            });
        }

        const json = await response.json();

        const streams = [];

        const sources = json.sources || [];

        for (const source of sources) {

            let streamUrl = source.url;

            if (streamUrl.startsWith("/")) {
                streamUrl =
                    "https://swiftstream.top/proxy" +
                    streamUrl;
            }

            streams.push({
                title:
                    source.quality || "Auto",
                streamUrl,
                headers: {
                    Referer: "https://animetsu.net/"
                }
            });
        }

        let subtitle = "";

        if (
            json.subs &&
            json.subs.length > 0
        ) {
            subtitle =
                json.subs[0].url;
        }

        return JSON.stringify({
            streams,
            subtitles: subtitle
        });

    } catch (e) {

        return JSON.stringify({
            streams: []
        });

    }
}
