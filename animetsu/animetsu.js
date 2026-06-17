const BASE_URL = "https://animetsu.net";
const API = `${BASE_URL}/v2/api/anime`;

async function request(url) {
    try {
        const fn = typeof fetchv2 === "function" ? fetchv2 : fetch;

        const res = await fn(url, {
            method: "GET",
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "Accept": "application/json",
                "Referer": BASE_URL
            }
        });

        return res;
    } catch {
        return null;
    }
}

/* ================= SEARCH ================= */
async function searchResults(keyword) {
    try {
        const res = await request(
            `${API}/search/?query=${encodeURIComponent(keyword)}`
        );

        if (!res) return JSON.stringify([]);

        const json = await res.json();
        const list = json.results || [];

        const results = list.map(item => ({
            title:
                item.title?.english ||
                item.title?.romaji ||
                item.title?.native ||
                "Unknown",
            image: item.cover_image?.large || "",
            href: `${BASE_URL}/anime/${item.id}`
        }));

        return JSON.stringify(results);
    } catch {
        return JSON.stringify([]);
    }
}

/* ================= DETAILS ================= */
async function extractDetails(url) {
    try {
        const id = url.split("/").filter(Boolean).pop();

        const res = await request(`${API}/info/${id}`);
        if (!res) return JSON.stringify([]);

        const data = await res.json();

        return JSON.stringify([
            {
                description: data.description || "",
                aliases: [
                    data.title?.english,
                    data.title?.romaji,
                    data.title?.native
                ].filter(Boolean).join(", "),
                airdate: data.start_date || data.year || ""
            }
        ]);
    } catch {
        return JSON.stringify([]);
    }
}

/* ================= EPISODES ================= */
async function extractEpisodes(url) {
    try {
        const id = url.split("/").filter(Boolean).pop();

        const res = await request(`${API}/eps/${id}`);
        if (!res) return JSON.stringify([]);

        const json = await res.json();
        const list = json.episodes || json.data || json || [];

        const episodes = list.map(ep => ({
            href: `${id}|${ep.ep_num || ep.episodeNumber}`,
            number: Number(ep.ep_num || ep.episodeNumber)
        }));

        return JSON.stringify(episodes);
    } catch {
        return JSON.stringify([]);
    }
}

/* ================= STREAM ================= */
async function extractStreamUrl(url) {
    try {
        const [animeId, episode] = url.split("|");

        if (!animeId || !episode) {
            return JSON.stringify({ streams: [], subtitles: "" });
        }

        // Get servers
        const serverRes = await request(
            `${API}/servers/${animeId}/${episode}`
        );

        const servers = await serverRes.json();

        const server =
            servers?.find(s => s.default)?.id ||
            servers?.[0]?.id ||
            "default";

        // Get stream
        const streamRes = await request(
            `${API}/oppai/${animeId}/${episode}?server=${server}&source_type=sub`
        );

        if (!streamRes) {
            return JSON.stringify({ streams: [], subtitles: "" });
        }

        const data = await streamRes.json();

        const streams = (data.sources || []).map(src => {
            let url = src.url;

            if (url?.startsWith("/")) {
                url = "https://swiftstream.top/proxy" + url;
            }

            return {
                title: src.quality || "Auto",
                streamUrl: url,
                headers: {
                    Referer: BASE_URL,
                    Origin: BASE_URL
                }
            };
        });

        return JSON.stringify({
            streams,
            subtitles: data.subs?.[0]?.url || ""
        });
    } catch {
        return JSON.stringify({
            streams: [],
            subtitles: ""
        });
    }
}

/* REQUIRED EXPORT */
module.exports = {
    searchResults,
    extractDetails,
    extractEpisodes,
    extractStreamUrl
};
