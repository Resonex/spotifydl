module.exports = function handler(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Cache-Control", "public, max-age=3600");

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD");
    return response.status(405).json({ error: "Use GET for API information." });
  }

  return response.status(200).json({
    name: "Spottydesk API",
    version: "1.0.0",
    endpoints: {
      lookup: {
        url: "/api/lookup",
        methods: ["GET", "POST"],
        description: "Look up metadata for a Spotify track, album, or playlist.",
        get: "GET /api/lookup?url=https%3A%2F%2Fopen.spotify.com%2Ftrack%2F...",
        post: {
          contentType: "application/json",
          body: { url: "https://open.spotify.com/track/..." }
        },
        response: {
          type: "track | album | playlist",
          result: "Spotify metadata for the requested item."
        }
      }
    },
    note: "Metadata lookup only. This API does not download audio."
  });
};
