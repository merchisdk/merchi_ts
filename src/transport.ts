import type { FrontendErrorTransport } from "./types.js";

export const fetchTransport: FrontendErrorTransport = async (endpoint, event) => {
  if (typeof fetch !== "function") return;
  await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(event),
    credentials: "omit",
    cache: "no-store",
    keepalive: true,
    referrerPolicy: "no-referrer",
  });
};
