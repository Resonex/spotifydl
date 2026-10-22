# Spottydesk API

A Vercel serverless API for looking up Spotify track, album, and playlist metadata. This project exposes API endpoints only; non-API routes return `404`.

The API reads publicly available Spotify page metadata. It does not download or stream audio. Spotify may change its page format, which can temporarily break lookups.

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. In Vercel, select **Add New → Project** and import the repository.
3. Keep the project root at the repository root. No framework preset or environment variables are required.
4. Deploy. The API is available at `https://YOUR-PROJECT.vercel.app/api`.

## API

### `GET /api`

Returns JSON endpoint information.

### `GET /api/lookup?url=SPOTIFY_URL`

```sh
curl --get "https://YOUR-PROJECT.vercel.app/api/lookup" \
  --data-urlencode "url=https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT"
```

### `POST /api/lookup`

```sh
curl -X POST "https://YOUR-PROJECT.vercel.app/api/lookup" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"https://open.spotify.com/album/2mxFsS5yylSTHNivV53HoA\"}"
```

Provide a Spotify track, album, or playlist URL in the `url` field. Successful responses have this shape:

```json
{
  "type": "track",
  "result": {
    "title": "Track title",
    "artist": "Artist",
    "album": "Album",
    "year": "2024-01-01",
    "id": "Spotify track ID",
    "albumCoverURL": "https://...",
    "trackNumber": 1
  }
}
```

Album results contain `name`, `artist`, `year`, `trackCount`, `tracks`, and `albumCoverURL`. Playlist results contain `name`, `owner`, `description`, `followerCount`, `trackCount`, `tracks`, and `playlistCoverURL`. Spotify pages may expose only a subset of long playlists; compare `trackCount` with the number of returned tracks.

### Errors

- `400` — missing, malformed, or unsupported Spotify URL.
- `405` — unsupported HTTP method.
- `502` — Spotify metadata is unavailable or its page format changed.

Cross-origin requests are enabled. The API has no authentication or rate limiting by default; add an API gateway or other protection before relying on a public endpoint at scale.

## Run locally

```sh
npm install
npx vercel login
npx vercel link
npm run dev
```

The Vercel CLI runs the serverless functions locally and requires a Vercel account. Alternatively, deploy through the Vercel dashboard by importing the GitHub repository.
