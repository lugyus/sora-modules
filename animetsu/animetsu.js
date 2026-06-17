const BASE_URL = "https://animetsu.net";

async function soraFetch(url, options = {}) {
    const headers = options.headers || {};

    headers["User-Agent"] =
        headers["User-Agent"] ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";

    headers["Accept"] = "application/json";
    headers["Referer"] = BASE_URL;

    const fn = typeof fetchv2 === "function" ? fetchv2 : fetch;

    try {
        return await fn(url, {
            method: options.method || "GET",
            headers,
            body: options.body || null
        });
    } catch {
        return null;
    }
}

/* ================= SEARCH ================= */
async function searchResults(keyword) {
    try {
        const res = await soraFetch(
            `${BASE_URL}/v2/api/anime/search/?query=${encodeURIComponent(keyword)}`
        );

        if (!res) return [];

        const json = await res.json();
        const list = json.results || [];

        return list.map(item => ({
            title:
                item.title?.english ||
                item.title?.romaji ||
                item.title?.native ||
                "Unknown",
            image: item.cover_image?.large || "",
            href: `${BASE_URL}/anime/${item.id}`
        }));
    } catch {
        return [];
    }
}

/* ================= DETAILS ================= */
async function extractDetails(url) {
    try {
        const id = url.split("/").filter(Boolean).pop();

        const res = await soraFetch(
            `${BASE_URL}/v2/api/anime/info/${id}`
        );

        if (!res) return [];

        const data = await res.json();

        return [
            {
                description: data.description || "",
                aliases: [
                    data.title?.english,
                    data.title?.romaji,
                    data.title?.native
                ].filter(Boolean).join(", "),
                airdate: data.start_date || ""
            }
        ];
    } catch {
        return [];
    }
}

/* ================= EPISODES ================= */
async function extractEpisodes(url) {
    try {
        const id = url.split("/").filter(Boolean).pop();

        const res = await soraFetch(
            `${BASE_URL}/v2/api/anime/eps/${id}`
        );

        if (!res) return [];

        const json = await res.json();
        const list = Array.isArray(json) ? json : [];

        return list.map(ep => ({
            href: `${id}|${ep.ep_num}`,
            number: Number(ep.ep_num)
        }));
    } catch {
        return [];
    }
}

/* ================= STREAM ================= */
async function extractStreamUrl(url) {
    try {
        const [animeId, episode] = url.split("|");

        const serverRes = await soraFetch(
            `${BASE_URL}/v2/api/anime/servers/${animeId}/${episode}`
        );

        const servers = await serverRes.json();
        const server =
            servers?.find(x => x.default)?.id ||
            servers?.[0]?.id ||
            "kite";

        const streamRes = await soraFetch(
            `${BASE_URL}/v2/api/anime/oppai/${animeId}/${episode}?server=${server}&source_type=sub`
        );

        const data = await streamRes.json();

        const streams = (data.sources || []).map(src => ({
            title: src.quality || "Auto",
            streamUrl: src.need_proxy
                ? "https://swiftstream.top/proxy" + src.url
                : src.url,
            headers: {
                Referer: BASE_URL,
                Origin: BASE_URL
            }
        }));

        return {
            streams,
            subtitles: data.subs?.[0]?.url || ""
        };
    } catch {
        return {
            streams: [],
            subtitles: ""
        };
    }
}

/* REQUIRED EXPORT (VERY IMPORTANT FOR ANIMEX) */
module.exports = {
    searchResults,
    extractDetails,
    extractEpisodes,
    extractStreamUrl
};
