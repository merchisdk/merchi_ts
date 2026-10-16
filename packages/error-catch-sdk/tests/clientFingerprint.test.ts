import { describe, expect, it } from "vitest";

import {
  clientFingerprintFrom,
  createFrontendErrorReporter,
  type FrontendErrorEvent,
} from "../src/index.js";

const CHROME_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.130 Safari/537.36";
const EDGE_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.91";
const FIREFOX_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const SAFARI_IPAD =
  "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Mobile Safari/537.36";
const CHROME_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1";

describe("clientFingerprintFrom", () => {
  it("records browser, OS, locale, and display for a desktop Chrome session", () => {
    expect(clientFingerprintFrom({
      userAgent: CHROME_WINDOWS,
      language: "en-AU",
      languages: ["en-AU", "en"],
      timezone: "Australia/Sydney",
      screenWidth: 1920,
      screenHeight: 1080,
      viewportWidth: 1280,
      viewportHeight: 720,
      devicePixelRatio: 1.25,
      hardwareConcurrency: 8,
      deviceMemory: 8,
      maxTouchPoints: 0,
      online: true,
      colorScheme: "dark",
    })).toEqual({
      userAgent: CHROME_WINDOWS,
      browser: "Chrome",
      browserVersion: "120.0.6099.130",
      os: "Windows",
      osVersion: "10",
      platform: "Windows",
      mobile: false,
      deviceType: "desktop",
      language: "en-AU",
      languages: ["en-AU", "en"],
      timezone: "Australia/Sydney",
      screenWidth: 1920,
      screenHeight: 1080,
      viewportWidth: 1280,
      viewportHeight: 720,
      devicePixelRatio: 1.25,
      hardwareConcurrency: 8,
      deviceMemory: 8,
      maxTouchPoints: 0,
      online: true,
      colorScheme: "dark",
    });
  });

  it("distinguishes Edge, Firefox, Safari, and Chrome on iOS", () => {
    expect(clientFingerprintFrom({ userAgent: EDGE_WINDOWS })).toMatchObject({
      browser: "Edge",
      browserVersion: "120.0.2210.91",
      os: "Windows",
      osVersion: "10",
      deviceType: "desktop",
    });
    expect(clientFingerprintFrom({ userAgent: FIREFOX_MAC })).toMatchObject({
      browser: "Firefox",
      browserVersion: "121.0",
      os: "macOS",
      osVersion: "10.15",
      deviceType: "desktop",
    });
    expect(clientFingerprintFrom({ userAgent: SAFARI_IPHONE })).toMatchObject({
      browser: "Safari",
      browserVersion: "17.4",
      os: "iOS",
      osVersion: "17.4",
      mobile: true,
      deviceType: "mobile",
    });
    expect(clientFingerprintFrom({ userAgent: SAFARI_IPAD })).toMatchObject({
      browser: "Safari",
      os: "iOS",
      deviceType: "tablet",
    });
    expect(clientFingerprintFrom({ userAgent: ANDROID_CHROME })).toMatchObject({
      browser: "Chrome",
      os: "Android",
      osVersion: "14",
      mobile: true,
      deviceType: "mobile",
    });
    expect(clientFingerprintFrom({ userAgent: CHROME_IOS })).toMatchObject({
      browser: "Chrome",
      browserVersion: "120.0.6099.119",
      os: "iOS",
      deviceType: "mobile",
    });
    expect(clientFingerprintFrom({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.4998.41",
    })).toMatchObject({ browser: "Opera", browserVersion: "106.0.4998.41", os: "Windows" });
    expect(clientFingerprintFrom({
      userAgent: "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36",
    })).toMatchObject({
      browser: "Samsung Internet",
      browserVersion: "23.0",
      os: "Android",
      deviceType: "mobile",
    });
    expect(clientFingerprintFrom({
      userAgent: "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.130 Safari/537.36",
    })).toMatchObject({ browser: "Chrome", os: "Chrome OS", deviceType: "desktop" });
    expect(clientFingerprintFrom({
      userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0",
    })).toMatchObject({ browser: "Firefox", os: "Linux", deviceType: "desktop" });
    expect(clientFingerprintFrom({
      userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Safari/537.36",
    })).toMatchObject({ os: "Android", deviceType: "tablet", mobile: false });
  });

  it("prefers low-entropy userAgentData for platform and mobile", () => {
    expect(clientFingerprintFrom({
      userAgent: CHROME_WINDOWS,
      brands: [
        { brand: "Not.A/Brand", version: "8" },
        { brand: "Chromium", version: "120" },
        { brand: "Microsoft Edge", version: "120" },
      ],
      platform: "Windows",
      mobile: false,
    })).toMatchObject({
      browser: "Edge",
      browserVersion: "120",
      platform: "Windows",
      mobile: false,
      deviceType: "desktop",
    });
  });

  it("drops invalid locale, timezone, and out-of-range device values", () => {
    const fingerprint = clientFingerprintFrom({
      userAgent: "not a browser",
      language: "en-AU<script>",
      languages: ["??", "en-AU", "en-AU"],
      timezone: "Australia/Sydney; DROP TABLE",
      screenWidth: 0,
      screenHeight: 99_999,
      viewportWidth: 800.5,
      devicePixelRatio: 40,
      hardwareConcurrency: 10_000,
      deviceMemory: 3,
      maxTouchPoints: -1,
      colorScheme: "sepia",
    });
    expect(fingerprint).toEqual({
      userAgent: "not a browser",
      languages: ["en-AU"],
    });
    expect(fingerprint).not.toHaveProperty("ip");
  });

  it("redacts secrets in the user agent and never records an IP", () => {
    const fingerprint = clientFingerprintFrom({
      userAgent: `${CHROME_WINDOWS} person@example.com 203.0.113.10 Bearer secret.token.value`,
    });
    expect(fingerprint?.userAgent).not.toContain("person@example.com");
    expect(fingerprint?.userAgent).not.toContain("203.0.113.10");
    expect(fingerprint?.userAgent).not.toContain("secret.token.value");
    expect(fingerprint).not.toHaveProperty("ip");
    expect(fingerprint?.browser).toBe("Chrome");
    const reduced = clientFingerprintFrom({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    expect(reduced?.userAgent).toContain("Chrome/120.0.0.0");
    expect(reduced?.browserVersion).toBe("120.0.0.0");
  });

  it("returns undefined when the environment is empty", () => {
    expect(clientFingerprintFrom({})).toBeUndefined();
  });
});

describe("error report client fingerprint", () => {
  it("stores the live browser fingerprint on the reported event", () => {
    const originalUserAgent = window.navigator.userAgent;
    const originalLanguage = window.navigator.language;
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: FIREFOX_MAC,
    });
    Object.defineProperty(window.navigator, "language", {
      configurable: true,
      value: "en-AU",
    });

    const events: FrontendErrorEvent[] = [];
    try {
      const reporter = createFrontendErrorReporter({
        endpoint: "https://api.merchi.co/v6/frontend-errors",
        application: "merchi-dashboard",
        enabled: true,
        transport: (_endpoint, event) => {
          events.push(event);
        },
      });
      expect(reporter.captureException(new Error("render failed"))).toBe(true);
    } finally {
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        value: originalUserAgent,
      });
      Object.defineProperty(window.navigator, "language", {
        configurable: true,
        value: originalLanguage,
      });
    }

    expect(events[0]?.client).toMatchObject({
      browser: "Firefox",
      browserVersion: "121.0",
      os: "macOS",
      osVersion: "10.15",
      language: "en-AU",
      deviceType: "desktop",
    });
    expect(events[0]?.client).not.toHaveProperty("ip");
    expect(JSON.stringify(events[0]?.client)).not.toContain("cookie");
  });
});
