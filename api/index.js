module.exports = function handler(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Cache-Control", "public, max-age=3600");

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD");
    return response.status(405).json({ error: "Use GET for API information." });
  }

  return response.status(200).json({
    name: "Spottydesk API",
    version: "2.0.0",
    description:
      "Serverless Spotify metadata for tracks, albums, playlists, artists, episodes, and shows.",
    endpoints: {
      lookup: {
        url: "/api/lookup",
        methods: ["GET", "HEAD", "POST"],
        description:
          "Look up metadata for a Spotify track, album, playlist, artist, episode, or show.",
        get: "GET /api/lookup?url=https%3A%2F%2Fopen.spotify.com%2Ftrack%2F...",
        post: {
          contentType: "application/json",
          body: { url: "https://open.spotify.com/track/..." }
        },
        query: {
          raw: "Set to 1 to include the raw Spotify entity.",
          fields: "Comma-separated list of top-level result fields to keep."
        },
        response: {
          type: "track | album | playlist | artist | episode | show",
          result: "Spotify metadata for the requested item."
        }
      },
      batch: {
        url: "/api/batch",
        methods: ["GET", "HEAD", "POST"],
        description: `Look up to 20 Spotify URLs in one request.`,
        get: "GET /api/batch?urls=https%3A%2F%2Fopen.spotify.com%2Ftrack%2F...,...",
        post: {
          contentType: "application/json",
          body: { urls: ["https://open.spotify.com/track/..."] }
        }
      }
    },
    notes: [
      "Metadata lookup only. This API does not download or stream audio.",
      "Spotify may change its page format, which can temporarily break lookups.",
      "Results are cached in-memory per instance for 5 minutes and at the edge via Cache-Control."
    ]
  });
};
