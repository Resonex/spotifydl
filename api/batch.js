"use strict";

const { lookup, SpotifyError } = require("../lib/spotify");

const MAX_URLS = 20;
const CONCURRENCY = 5;

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader(
    "Access-Control-Allow-Methods",
    "GET, HEAD, POST, OPTIONS"
  );
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Max-Age", "86400");
  response.setHeader("Cache-Control", "no-store");
}

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function readUrls(request) {
  if (request.method === "GET" || request.method === "HEAD") {
    const value = request.query?.urls ?? request.query?.url;
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      return value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
    return [];
  }

  const body = request.body;
  const parsed = typeof body === "string" ? safeParse(body) : body;
  const urls = parsed?.urls ?? parsed?.url;

  if (Array.isArray(urls)) return urls;
  if (typeof urls === "string") return [urls];
  return [];
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await worker(items[index], index);
      }
    }
  );

  await Promise.all(runners);
  return results;
}

module.exports = async function handler(request, response) {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    return response.status(204).end();
  }

  if (!["GET", "HEAD", "POST"].includes(request.method)) {
    response.setHeader("Allow", "GET, HEAD, POST, OPTIONS");
    return response.status(405).json({
      error: "Use GET or POST for batch lookups."
    });
  }

  const urls = readUrls(request);

  if (!urls.length) {
    return response.status(400).json({
      error: "Provide one or more Spotify URLs."
    });
  }

  if (urls.length > MAX_URLS) {
    return response.status(400).json({
      error: `Batch lookups are limited to ${MAX_URLS} URLs.`
    });
  }

  const results = await mapWithConcurrency(urls, CONCURRENCY, async (url) => {
    try {
      const { type, result } = await lookup(url);
      return { url, ok: true, type, result };
    } catch (error) {
      const status = error instanceof SpotifyError ? error.status : 502;
      return {
        url,
        ok: false,
        status,
        error:
          error instanceof SpotifyError ? error.message : "Lookup failed."
      };
    }
  });

  if (request.method === "HEAD") {
    return response.status(200).end();
  }

  return response.status(200).json({ count: results.length, results });
};
