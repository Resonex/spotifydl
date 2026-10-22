const spotifyLinkPattern =
  /^https:\/\/open\.spotify\.com\/(track|album|playlist)\/([A-Za-z0-9]{22})(?:\?[^\s#]*)?$/;

function sendJson(response, status, body) {
  return response.status(status).json(body);
}

function artworkUrl(artwork) {
  const sources = artwork && artwork.sources;
  return Array.isArray(sources) && sources.length
    ? sources[sources.length - 1].url
    : "";
}

function formatDate(date) {
  if (!date || !date.year) return "";
  return `${date.year}-${String(date.month || 1).padStart(2, "0")}-${String(
    date.day || 1
  ).padStart(2, "0")}`;
}

async function getSpotifyEntity(type, id) {
  const page = await fetch(`https://open.spotify.com/${type}/${id}`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Spottydesk/1.0)" },
    signal: AbortSignal.timeout(10000)
  });

  if (!page.ok) {
    throw new Error(`Spotify returned HTTP ${page.status}.`);
  }

  const html = await page.text();
  const stateMatch =
    /<script id="initialState" type="text\/plain">(.*?)<\/script>/s.exec(html);
  if (!stateMatch) {
    throw new Error("Spotify metadata was not present in the page.");
  }

  const stateJson = decodeURIComponent(stateMatch[1]);
  const state = JSON.parse(Buffer.from(stateJson, "base64").toString("utf8"));
  const entity = state.entities?.items?.[`spotify:${type}:${id}`];

  if (!entity) {
    throw new Error("Spotify metadata did not include the requested item.");
  }

  return entity;
}

function getTrackMetadata(entity) {
  const artists = [
    ...(entity.firstArtist?.items || []),
    ...(entity.otherArtists?.items || [])
  ]
    .map((item) => item.profile?.name)
    .filter(Boolean);
  const album = entity.albumOfTrack || {};

  return {
    title: entity.name,
    artist: artists.join(", "),
    year: formatDate(album.date),
    album: album.name || "",
    id: entity.id,
    albumCoverURL: artworkUrl(album.coverArt),
    trackNumber: entity.trackNumber
  };
}

function getAlbumMetadata(entity) {
  const artist = (entity.artists?.items || [])
    .map((item) => item.profile?.name)
    .filter(Boolean)
    .join(", ");
  const albumCoverURL = artworkUrl(entity.coverArt);
  const tracks = (entity.tracksV2?.items || [])
    .map((item) => item.track)
    .filter((track) => track && track.name)
    .map((track) => ({
      title: track.name,
      artist:
        (track.artists?.items || [])
          .map((item) => item.profile?.name)
          .filter(Boolean)
          .join(", ") || artist,
      album: entity.name,
      year: formatDate(entity.date),
      trackNumber: track.trackNumber,
      albumCoverURL
    }));

  return {
    name: entity.name,
    artist,
    year: formatDate(entity.date),
    trackCount: entity.tracksV2?.totalCount || tracks.length,
    tracks,
    albumCoverURL
  };
}

function getPlaylistMetadata(entity) {
  const tracks = (entity.content?.items || [])
    .map((item) => item.itemV2?.data)
    .filter((track) => track && track.name)
    .map((track) => ({
      title: track.name,
      artist: (track.artists?.items || [])
        .map((item) => item.profile?.name)
        .filter(Boolean)
        .join(", "),
      album: track.albumOfTrack?.name || "",
      trackNumber: track.trackNumber,
      albumCoverURL: artworkUrl(track.albumOfTrack?.coverArt)
    }));

  return {
    name: entity.name,
    owner: entity.ownerV2?.data?.name || "",
    description: entity.description || "",
    followerCount: entity.followers || 0,
    trackCount: entity.content?.totalCount || tracks.length,
    tracks,
    playlistCoverURL: entity.images?.items?.[0]?.sources?.[0]?.url || ""
  };
}

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
}

module.exports = async function handler(request, response) {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    return response.status(204).end();
  }

  let inputUrl;
  if (request.method === "GET") {
    inputUrl = request.query && request.query.url;
  } else if (request.method === "POST") {
    inputUrl = request.body && request.body.url;
  } else {
    response.setHeader("Allow", "GET, POST, OPTIONS");
    return sendJson(response, 405, {
      error: "Use GET or POST for Spotify lookups."
    });
  }

  if (typeof inputUrl !== "string" || inputUrl.length > 500) {
    return sendJson(response, 400, {
      error: "Provide a Spotify URL in the url query parameter or JSON body."
    });
  }

  const match = spotifyLinkPattern.exec(inputUrl.trim());
  if (!match) {
    return sendJson(response, 400, {
      error: "Use a Spotify track, album, or playlist link."
    });
  }

  const [, type, id] = match;

  try {
    const entity = await getSpotifyEntity(type, id);
    const result =
      type === "track"
        ? getTrackMetadata(entity)
        : type === "album"
          ? getAlbumMetadata(entity)
          : getPlaylistMetadata(entity);

    return sendJson(response, 200, { type, result });
  } catch (error) {
    console.error("Spotify metadata lookup failed:", error);
    return sendJson(response, 502, {
      error: "Spotify metadata could not be read. Try again or check the link."
    });
  }
};
