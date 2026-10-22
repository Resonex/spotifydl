"use strict";

const { lookup, SpotifyError } = require("../lib/spotify");

const MAX_URL_LENGTH = 500;

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader(
    "Access-Control-Allow-Methods",
    "GET, HEAD, POST, OPTIONS"
  );
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Max-Age", "86400");
  response.setHeader(
    "Cache-Control",
    "public, s-maxage=300, stale-while-revalidate=600"
  );
}

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function readUrl(request) {
  if (request.method === "GET" || request.method === "HEAD") {
    return firstValue(request.query?.url);
  }

  const body = request.body;

  if (typeof body === "string") {
    try {
      return JSON.parse(body)?.url;
    } catch {
      return undefined;
    }
  }

  return body?.url;
}

function readBoolean(value) {
  const raw = firstValue(value);
  if (typeof raw === "boolean") return raw;
  if (typeof raw !== "string") return false;
  return ["1", "true", "yes", "on", "raw"].includes(raw.toLowerCase());
}

function readFields(value) {
  const raw = firstValue(value);
  if (typeof raw !== "string") return null;

  const fields = raw
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean);

  return fields.length ? fields : null;
}

function pickFields(result, fields) {
  if (!fields) return result;

  return fields.reduce((picked, field) => {
    if (Object.prototype.hasOwnProperty.call(result, field)) {
      picked[field] = result[field];
    }
    return picked;
  }, {});
}

module.exports = async function handler(request, response) {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    return response.status(204).end();
  }

  const allowed = ["GET", "HEAD", "POST"];
  if (!allowed.includes(request.method)) {
    response.setHeader("Allow", `${allowed.join(", ")}, OPTIONS`);
    return response.status(405).json({
      error: "Use GET or POST for Spotify lookups."
    });
  }

  const inputUrl = readUrl(request);

  if (typeof inputUrl !== "string" || !inputUrl.trim()) {
    return response.status(400).json({
      error: "Provide a Spotify URL in the url query parameter or JSON body."
    });
  }

  if (inputUrl.length > MAX_URL_LENGTH) {
    return response.status(400).json({
      error: `Spotify URL must be ${MAX_URL_LENGTH} characters or fewer.`
    });
  }

  const includeRaw = readBoolean(request.query?.raw);
  const fields = readFields(request.query?.fields);

  try {
    const { type, result, entity } = await lookup(inputUrl);

    const body = { type, result: pickFields(result, fields) };
    if (includeRaw && !fields) {
      body.raw = entity;
    }

    if (request.method === "HEAD") {
      return response.status(200).end();
    }

    return response.status(200).json(body);
  } catch (error) {
    const status = error instanceof SpotifyError ? error.status : 502;
    console.error("Spotify lookup failed:", error?.message || error);

    return response.status(status).json({
      error:
        error instanceof SpotifyError
          ? error.message
          : "Spotify metadata could not be read. Try again or check the link."
    });
  }
};
