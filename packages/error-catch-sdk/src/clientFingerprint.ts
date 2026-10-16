import { redactText } from "./redact.js";
import type {
  FrontendErrorBrowser,
  FrontendErrorClient,
  FrontendErrorColorScheme,
  FrontendErrorDeviceType,
  FrontendErrorOs,
} from "./types.js";

const MAX_USER_AGENT_LENGTH = 512;
const BROWSER_VERSION_TOKEN =
  /(Chrome|CriOS|Edg(?:e|A|iOS)?|OPR|SamsungBrowser|Firefox|FxiOS|Version)\/(\d+\.\d+\.\d+\.\d+)/g;
const MAX_LANGUAGES = 8;
const LANGUAGE = /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8}){0,3}$/;
const TIMEZONE = /^[A-Za-z0-9_+-]{1,32}(?:\/[A-Za-z0-9_+-]{1,32}){0,2}$/;
const VERSION = /^\d{1,6}(?:\.\d{1,6}){0,4}$/;
const DEVICE_MEMORY = new Set([0.25, 0.5, 1, 2, 4, 8, 16, 32, 64]);

const WINDOWS_VERSIONS: Record<string, string> = {
  "10.0": "10",
  "6.3": "8.1",
  "6.2": "8",
  "6.1": "7",
};

const BRANDS: ReadonlyArray<[RegExp, FrontendErrorBrowser]> = [
  [/edge/i, "Edge"],
  [/opera/i, "Opera"],
  [/samsung/i, "Samsung Internet"],
  [/firefox/i, "Firefox"],
  [/chrome/i, "Chrome"],
  [/safari/i, "Safari"],
];

const PLATFORMS = new Set<FrontendErrorOs>([
  "Windows",
  "macOS",
  "iOS",
  "Android",
  "Chrome OS",
  "Linux",
]);

export interface ClientFingerprintInput {
  userAgent?: string;
  brands?: ReadonlyArray<{ brand?: string; version?: string }>;
  mobile?: boolean;
  platform?: string;
  language?: string;
  languages?: readonly string[];
  timezone?: string;
  screenWidth?: number;
  screenHeight?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  devicePixelRatio?: number;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  maxTouchPoints?: number;
  online?: boolean;
  colorScheme?: string;
}

function boundedVersion(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().replace(/_/g, ".").replace(/\.+$/g, "");
  return VERSION.test(normalized) ? normalized : undefined;
}

function matchVersion(value: string, pattern: RegExp): string | undefined {
  return boundedVersion(pattern.exec(value)?.[1]);
}

function named<T extends string>(name: T, version: string | undefined): { name: T; version?: string } {
  return version ? { name, version } : { name };
}

function browserFromUserAgent(userAgent: string): { name?: FrontendErrorBrowser; version?: string } {
  const edge = matchVersion(userAgent, /Edg(?:e|A|iOS)?\/(\d+(?:\.\d+)*)/);
  if (edge) return named("Edge", edge);
  const opera = matchVersion(userAgent, /OPR\/(\d+(?:\.\d+)*)/);
  if (opera) return named("Opera", opera);
  const samsung = matchVersion(userAgent, /SamsungBrowser\/(\d+(?:\.\d+)*)/);
  if (samsung) return named("Samsung Internet", samsung);
  const firefox = matchVersion(userAgent, /FxiOS\/(\d+(?:\.\d+)*)/)
    ?? matchVersion(userAgent, /Firefox\/(\d+(?:\.\d+)*)/);
  if (firefox) return named("Firefox", firefox);
  const chromeIos = matchVersion(userAgent, /CriOS\/(\d+(?:\.\d+)*)/);
  if (chromeIos) return named("Chrome", chromeIos);
  const chrome = matchVersion(userAgent, /Chrome\/(\d+(?:\.\d+)*)/);
  if (chrome) return named("Chrome", chrome);
  const safari = matchVersion(userAgent, /Version\/(\d+(?:\.\d+)*)/);
  if (safari && /Safari\//.test(userAgent)) return named("Safari", safari);
  return {};
}

function browserFromBrands(
  brands: ClientFingerprintInput["brands"],
): { name?: FrontendErrorBrowser; version?: string } {
  if (!brands) return {};
  for (const [pattern, name] of BRANDS) {
    const match = brands.find((brand) => {
      const label = brand.brand ?? "";
      return pattern.test(label) && !/not.?a.?brand|chromium/i.test(label);
    });
    if (match) return named(name, boundedVersion(match.version));
  }
  return {};
}

function osFromUserAgent(userAgent: string): { name?: FrontendErrorOs; version?: string } {
  if (/iPhone|iPad|iPod/.test(userAgent)) {
    return named("iOS", matchVersion(userAgent, /OS (\d+(?:[_.]\d+)*)/));
  }
  if (/Android/.test(userAgent)) {
    return named("Android", matchVersion(userAgent, /Android (\d+(?:\.\d+)*)/));
  }
  if (/Windows NT/.test(userAgent)) {
    const nt = /Windows NT (\d+\.\d+)/.exec(userAgent)?.[1];
    const mapped = nt ? WINDOWS_VERSIONS[nt] : undefined;
    return named("Windows", mapped ?? (nt ? boundedVersion(nt) : undefined));
  }
  if (/Mac OS X/.test(userAgent)) {
    return named("macOS", matchVersion(userAgent, /Mac OS X (\d+(?:[_.]\d+)*)/));
  }
  if (/CrOS/.test(userAgent)) return { name: "Chrome OS" };
  if (/Linux/.test(userAgent)) return { name: "Linux" };
  return {};
}

function allowlistedPlatform(value: string | undefined): FrontendErrorOs | undefined {
  const trimmed = value?.trim();
  return trimmed && PLATFORMS.has(trimmed as FrontendErrorOs)
    ? trimmed as FrontendErrorOs
    : undefined;
}

function deviceTypeFor(
  userAgent: string,
  mobileHint: boolean | undefined,
  os: FrontendErrorOs | undefined,
): FrontendErrorDeviceType | undefined {
  if (/iPad/.test(userAgent)) return "tablet";
  if (os === "Android" && !/Mobile/.test(userAgent) && mobileHint !== true) return "tablet";
  if (mobileHint === true || (mobileHint === undefined && /Mobile|iPhone|iPod/.test(userAgent))) {
    return "mobile";
  }
  if (
    mobileHint === false
    || os === "Windows"
    || os === "macOS"
    || os === "Linux"
    || os === "Chrome OS"
  ) {
    return "desktop";
  }
  return undefined;
}

function redactUserAgent(value: string): string {
  const versions: string[] = [];
  BROWSER_VERSION_TOKEN.lastIndex = 0;
  const masked = value.replace(BROWSER_VERSION_TOKEN, (token) => {
    const marker = `__UA_${versions.length}__`;
    versions.push(token);
    return marker;
  });
  const redacted = redactText(masked, MAX_USER_AGENT_LENGTH + 200);
  const restored = redacted.replace(/__UA_(\d+)__/g, (_marker, index: string) => versions[Number(index)] ?? "");
  return restored.slice(0, MAX_USER_AGENT_LENGTH);
}

function languageTag(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && LANGUAGE.test(trimmed) ? trimmed : undefined;
}

function dimension(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 20_000
    ? value
    : undefined;
}

function pixelRatio(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 10) {
    return undefined;
  }
  return Math.round(value * 100) / 100;
}

function hardwareConcurrency(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 128
    ? value
    : undefined;
}

function deviceMemory(value: number | undefined): number | undefined {
  return typeof value === "number" && DEVICE_MEMORY.has(value) ? value : undefined;
}

function touchPoints(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 256
    ? value
    : undefined;
}

function colorScheme(value: string | undefined): FrontendErrorColorScheme | undefined {
  return value === "light" || value === "dark" ? value : undefined;
}

/** Build the allowlisted client fingerprint from already-read environment values. */
export function clientFingerprintFrom(input: ClientFingerprintInput): FrontendErrorClient | undefined {
  const userAgentRaw = typeof input.userAgent === "string" ? input.userAgent.trim() : "";
  const fromUserAgent = browserFromUserAgent(userAgentRaw);
  const fromBrands = browserFromBrands(input.brands);
  const browser = fromBrands.name ?? fromUserAgent.name;
  const browserVersion = fromBrands.name
    ? (fromBrands.name === fromUserAgent.name ? fromUserAgent.version ?? fromBrands.version : fromBrands.version)
    : fromUserAgent.version;
  const fromOs = osFromUserAgent(userAgentRaw);
  const platformHint = allowlistedPlatform(input.platform);
  const os = fromOs.name ?? platformHint;
  const osVersion = fromOs.version;
  const platform = platformHint ?? os;
  const mobileHint = typeof input.mobile === "boolean" ? input.mobile : undefined;
  const deviceType = deviceTypeFor(userAgentRaw, mobileHint, os);
  const mobile = mobileHint ?? (deviceType === "mobile" ? true : deviceType ? false : undefined);
  const language = languageTag(input.language);
  const languages = [...new Set(
    (input.languages ?? [])
      .map((value) => languageTag(value))
      .filter((value): value is string => Boolean(value)),
  )].slice(0, MAX_LANGUAGES);
  const timezone = input.timezone && TIMEZONE.test(input.timezone.trim()) ? input.timezone.trim() : undefined;
  const userAgent = userAgentRaw ? redactUserAgent(userAgentRaw) : "";

  const client: FrontendErrorClient = {};
  if (userAgent) client.userAgent = userAgent;
  if (browser) client.browser = browser;
  if (browserVersion) client.browserVersion = browserVersion;
  if (os) client.os = os;
  if (osVersion) client.osVersion = osVersion;
  if (platform) client.platform = platform;
  if (mobile !== undefined) client.mobile = mobile;
  if (deviceType) client.deviceType = deviceType;
  if (language) client.language = language;
  if (languages.length > 0) client.languages = languages;
  if (timezone) client.timezone = timezone;
  const screenWidth = dimension(input.screenWidth);
  const screenHeight = dimension(input.screenHeight);
  const viewportWidth = dimension(input.viewportWidth);
  const viewportHeight = dimension(input.viewportHeight);
  const ratio = pixelRatio(input.devicePixelRatio);
  const cores = hardwareConcurrency(input.hardwareConcurrency);
  const memory = deviceMemory(input.deviceMemory);
  const touches = touchPoints(input.maxTouchPoints);
  const scheme = colorScheme(input.colorScheme);
  if (screenWidth !== undefined) client.screenWidth = screenWidth;
  if (screenHeight !== undefined) client.screenHeight = screenHeight;
  if (viewportWidth !== undefined) client.viewportWidth = viewportWidth;
  if (viewportHeight !== undefined) client.viewportHeight = viewportHeight;
  if (ratio !== undefined) client.devicePixelRatio = ratio;
  if (cores !== undefined) client.hardwareConcurrency = cores;
  if (memory !== undefined) client.deviceMemory = memory;
  if (touches !== undefined) client.maxTouchPoints = touches;
  if (typeof input.online === "boolean") client.online = input.online;
  if (scheme) client.colorScheme = scheme;
  return Object.keys(client).length > 0 ? client : undefined;
}

interface UserAgentData {
  brands?: Array<{ brand?: string; version?: string }>;
  mobile?: boolean;
  platform?: string;
}

function readColorScheme(): FrontendErrorColorScheme | undefined {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
  try {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
    if (window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
  } catch {
    return undefined;
  }
  return undefined;
}

function readTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

/** Read the current browser environment. Returns undefined outside a browser. */
export function collectClientFingerprint(): FrontendErrorClient | undefined {
  if (typeof window === "undefined" || typeof navigator === "undefined") return undefined;
  const nav = navigator as Navigator & { userAgentData?: UserAgentData; deviceMemory?: number };
  const input: ClientFingerprintInput = {
    userAgent: nav.userAgent,
    language: nav.language,
    languages: nav.languages,
    screenWidth: window.screen?.width,
    screenHeight: window.screen?.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    hardwareConcurrency: nav.hardwareConcurrency,
    maxTouchPoints: nav.maxTouchPoints,
    online: nav.onLine,
  };
  const timezone = readTimezone();
  const scheme = readColorScheme();
  if (timezone) input.timezone = timezone;
  if (scheme) input.colorScheme = scheme;
  if (nav.userAgentData) {
    if (nav.userAgentData.brands) input.brands = nav.userAgentData.brands;
    if (typeof nav.userAgentData.mobile === "boolean") input.mobile = nav.userAgentData.mobile;
    if (nav.userAgentData.platform) input.platform = nav.userAgentData.platform;
  }
  if (typeof nav.deviceMemory === "number") input.deviceMemory = nav.deviceMemory;
  return clientFingerprintFrom(input);
}
