import type { FrontendErrorReceipt, FrontendErrorTransport } from "./types.js";

export const fetchTransport: FrontendErrorTransport = async (endpoint, event) => {
  if (typeof fetch !== "function") return;
  const response = await fetch(endpoint, {
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
  if (!response.ok) return;
  try {
    return await response.json() as FrontendErrorReceipt;
  } catch {
    // Older collectors may return an empty successful response.
    return;
  }
};
