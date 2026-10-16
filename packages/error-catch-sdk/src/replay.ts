import { containsPaymentReplayContent, isPaymentRelatedReplayPath, PAYMENT_REPLAY_SELECTOR } from "./replayPrivacy.js";
export { isPaymentRelatedReplayPath } from "./replayPrivacy.js";
import type { FrontendErrorReporter } from "./reporter.js";
import type { FrontendErrorEvent, FrontendErrorReceipt } from "./types.js";

type ReplayEvent = { type: number; timestamp: number; data: unknown };
type Segment = { events: ReplayEvent[]; bytes: number; timestamp: number };
type Clip = {
  before: ReplayEvent[]; after: ReplayEvent[]; bytes: number; errorAt: number;
  grant?: { id: string; uploadToken: string }; timer?: ReturnType<typeof setTimeout>;
  chain: Promise<void>; closed: boolean; complete: boolean; generation: number;
};

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_EVENTS = 20_000;
const BEFORE_MS = 60_000;
const AFTER_MS = 15_000;
const mask = (value: string): string => value.replace(/\S/g, "*");
const safeCss = (value: string): string => value
  .replace(/url\s*\([^)]*\)/gi, "url()")
  .replace(/@import[^;]+;?/gi, "")
  .replace(/(^|[;{])\s*content\s*:[^;}]+/gi, "$1content:none");

/** Defense in depth: rrweb's input masking does not remove DOM attributes. */
export function sanitizeReplayEvent(event: ReplayEvent): ReplayEvent {
  const clean = (value: unknown, key = "", style = false): unknown => {
    if (typeof value === "string") {
      if (key === "tagName") return /^[a-zA-Z0-9-]{1,40}$/.test(value) ? value : "div";
      if (["cssText", "rule", "style"].includes(key) || (key === "textContent" && style)) return safeCss(value);
      return mask(value);
    }
    if (Array.isArray(value)) return value.map((entry) => clean(entry, key));
    if (!value || typeof value !== "object") return value;
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [name, entry] of Object.entries(input)) {
      if (name === "attributes" && entry && typeof entry === "object" && !Array.isArray(entry)) {
        const attrs: Record<string, unknown> = {};
        for (const [attr, content] of Object.entries(entry)) {
          if (["_cssText", "style", "class", "type", "role", "disabled", "checked", "selected", "width", "height", "colspan", "rowspan", "rr_width", "rr_height"].includes(attr)) {
            if (content === null) { attrs[attr] = null; continue; }
            // Classes preserve layout; long/generated identifiers are excluded.
            if (attr === "class") attrs[attr] = String(content).split(/\s+/).filter((token) => /^[a-zA-Z_-][a-zA-Z0-9_:/.[\]%-]{0,60}$/.test(token)).join(" ");
            else if (attr === "style" || attr === "_cssText") attrs[attr] = safeCss(String(content));
            else if (/^[a-zA-Z0-9 .%-]{0,60}$/.test(String(content))) attrs[attr] = content;
          }
        }
        output[name] = attrs;
      } else if (name === "href") {
        output[name] = "/";
      } else if (name === "compatMode") {
        output[name] = entry === "BackCompat" ? "BackCompat" : "CSS1Compat";
      } else if (input.type === 1 && name === "name") {
        output[name] = "html";
      } else if (name === "publicId" || name === "systemId") {
        output[name] = "";
      } else {
        output[name] = clean(entry, name, input.isStyle === true);
      }
    }
    return output;
  };
  return clean(event) as ReplayEvent;
}

/** Keep complete snapshot segments rather than trimming dependent mutations. */
export class ReplayBuffer {
  #segments: Segment[] = [];
  #meta: ReplayEvent | undefined;
  #bytes = 0;
  #count = 0;

  push(event: ReplayEvent): void {
    if (event.type === 4) { this.#meta = event; return; }
    if (event.type === 2) {
      this.#segments.push({ events: [], timestamp: event.timestamp, bytes: 0 });
      if (this.#meta) this.#append({ ...this.#meta, timestamp: event.timestamp });
    }
    if (!this.#segments.length) return;
    this.#append(event);
    while (this.#segments.length > 1 && (
      this.#segments[1]!.timestamp <= event.timestamp - BEFORE_MS ||
      this.#bytes > MAX_BYTES || this.#count > MAX_EVENTS
    )) {
      const old = this.#segments.shift()!;
      this.#bytes -= old.bytes;
      this.#count -= old.events.length;
    }
    if (this.#bytes > MAX_BYTES || this.#count > MAX_EVENTS) this.clear();
  }

  #append(event: ReplayEvent): void {
    const bytes = new TextEncoder().encode(JSON.stringify(event)).length;
    const segment = this.#segments[this.#segments.length - 1]!;
    segment.events.push(event); segment.bytes += bytes;
    this.#bytes += bytes; this.#count += 1;
  }

  snapshot(): ReplayEvent[] { return this.#segments.flatMap((segment) => segment.events); }
  clear(): void { this.#segments = []; this.#bytes = 0; this.#count = 0; this.#meta = undefined; }
}

export interface StorefrontReplayOptions {
  apiUrl: string;
  /** Controlled by storefront configuration, never by a visitor prompt. */
  enabled: boolean;
}

export interface StorefrontReplayController {
  setEnabled(enabled: boolean): void;
  /** For payment UI that mounts outside the default route/DOM boundaries. */
  setSensitiveContext(active: boolean): void;
  stop(): void;
}

const controllers = new WeakMap<FrontendErrorReporter, StorefrontReplayController>();

export function startStorefrontReplay(reporter: FrontendErrorReporter, options: StorefrontReplayOptions): StorefrontReplayController {
  const existing = controllers.get(reporter);
  if (existing) return existing;
  const buffer = new ReplayBuffer();
  const clips = new Map<string, Clip>();
  const uploads = new Set<AbortController>();
  let enabled = options.enabled === true;
  let sensitive = false;
  let active = false;
  let generation = 0;
  let stopRecord: (() => void) | undefined;
  let takeSnapshot: (() => void) | undefined;
  let stopped = false;
  let count = 0;
  const endpoint = new URL("frontend-replays/", options.apiUrl).href;

  const permitted = (): boolean => {
    try {
      return !stopped && enabled && !sensitive && typeof window !== "undefined" &&
        !isPaymentRelatedReplayPath(window.location.href) && !document.querySelector(PAYMENT_REPLAY_SELECTOR);
    } catch { return false; }
  };
  const pause = (): void => {
    active = false; generation += 1;
    for (const upload of uploads) upload.abort();
    uploads.clear();
    stopRecord?.(); stopRecord = undefined; takeSnapshot = undefined; buffer.clear();
    for (const clip of clips.values()) if (clip.timer) clearTimeout(clip.timer);
    clips.clear();
  };
  const mayUseClip = (clip: Clip): boolean => {
    if (!permitted()) { if (active) pause(); return false; }
    return active && clip.generation === generation;
  };
  const upload = (clip: Clip, part: number, events: ReplayEvent[]): void => {
    if (!clip.grant || (!events.length && part === 0)) return;
    const grant = clip.grant;
    clip.chain = clip.chain.then(async () => {
      if (!mayUseClip(clip)) return;
      const json = JSON.stringify({ schemaVersion: 1, events, errorAt: clip.errorAt, complete: part === 1 && clip.complete });
      const blob = new Blob([json], { type: "application/json" });
      let body: Blob = blob;
      if (typeof CompressionStream !== "undefined" && typeof blob.stream === "function") {
        body = await new Response(blob.stream().pipeThrough(new CompressionStream("gzip"))).blob();
      }
      if (body.size > MAX_BYTES || !mayUseClip(clip)) return;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        if (!mayUseClip(clip)) return;
        const abort = new AbortController();
        uploads.add(abort);
        const timeout = setTimeout(() => abort.abort(), 10_000);
        try {
          const response = await fetch(`${endpoint}${grant.id}/parts/${part}`, {
            method: "POST", body, signal: abort.signal,
            headers: { "Content-Type": body === blob ? "application/json" : "application/gzip", "X-Replay-Token": grant.uploadToken },
            credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer",
            keepalive: body.size < 48_000,
          });
          if (response.ok || response.status < 500) return;
        } catch { /* Retry once while this page is still alive and eligible. */ }
        finally { clearTimeout(timeout); uploads.delete(abort); }
      }
    }).catch(() => undefined);
  };
  const finish = (clip: Clip, complete = false): void => {
    if (clip.closed || !mayUseClip(clip)) return;
    clip.closed = true; clip.complete = complete;
    if (clip.timer) clearTimeout(clip.timer);
    const end = Math.max(clip.after[clip.after.length - 1]?.timestamp ?? clip.errorAt,
      Math.min(Date.now(), clip.errorAt + AFTER_MS));
    clip.after.push({ type: 0, timestamp: end, data: {} });
    upload(clip, 1, clip.after);
  };
  const removeIntegration = reporter.addIntegration({
    prepare(event: FrontendErrorEvent) {
      if (!permitted()) { if (active) pause(); return; }
      if (!active || count >= 3 || clips.size >= 3 ||
          (event.route && isPaymentRelatedReplayPath(event.route)) ||
          /^(?:checkout|payment)\./i.test(event.operation?.name ?? "")) return;
      if ((buffer.snapshot()[0]?.timestamp ?? 0) < Date.now() - 75_000) takeSnapshot?.();
      if (!active || !permitted()) return;
      const before = buffer.snapshot();
      if (!before.some((entry) => entry.type === 2)) return;
      const clip: Clip = {
        before, after: [], bytes: new TextEncoder().encode(JSON.stringify(before)).length,
        errorAt: Date.now(), chain: Promise.resolve(), closed: false, complete: false, generation,
      };
      clips.set(event.eventId, clip); count += 1;
      event.replayRequested = true;
      clip.timer = setTimeout(() => finish(clip, true), AFTER_MS);
      setTimeout(() => { clips.delete(event.eventId); }, 120_000);
    },
    accepted(event: FrontendErrorEvent, receipt: FrontendErrorReceipt) {
      const clip = clips.get(event.eventId);
      if (!clip || !receipt.replay || !mayUseClip(clip)) return;
      clip.grant = receipt.replay;
      upload(clip, 0, clip.before);
      if (clip.closed) upload(clip, 1, clip.after);
    },
  });

  const refresh = (): void => {
    if (!permitted()) { if (active) pause(); return; }
    if (active) return;
    active = true;
    const startedGeneration = generation;
    void import("@rrweb/record").then(({ record }) => {
      if (!active || generation !== startedGeneration || !permitted()) return;
      takeSnapshot = () => record.takeFullSnapshot();
      // record() emits the initial snapshot synchronously, before returning cleanup.
      const stop = record({
        maskAllInputs: true, maskTextSelector: "*", recordCanvas: false,
        recordCrossOriginIframes: false, collectFonts: false,
        blockSelector: "iframe, img, picture, video, audio, canvas, svg, object, embed, [data-replay-block], [data-replay-payment], .rr-block",
        checkoutEveryNms: 10_000,
        sampling: { mousemove: 100, scroll: 150 },
        emit(raw) {
          try {
            if (!active || generation !== startedGeneration) return;
            if (!permitted() || containsPaymentReplayContent(raw)) { pause(); return; }
            if (raw.type === 5 || raw.type === 6) return;
            const event = sanitizeReplayEvent(raw);
            buffer.push(event);
            const bytes = new TextEncoder().encode(JSON.stringify(event)).length;
            for (const clip of clips.values()) {
              if (clip.closed || event.timestamp > clip.errorAt + AFTER_MS) continue;
              if (clip.bytes + bytes > MAX_BYTES || clip.after.length >= MAX_EVENTS) { finish(clip); continue; }
              clip.after.push(event); clip.bytes += bytes;
            }
          } catch { /* Never interfere with the storefront. */ }
        },
      });
      if (!active || generation !== startedGeneration || !permitted()) stop?.();
      else stopRecord = stop;
    }).catch(() => { if (generation === startedGeneration) pause(); });
  };
  const onPageHide = (): void => { for (const clip of clips.values()) finish(clip); };
  const restorers: Array<() => void> = [];
  let observer: MutationObserver | undefined;
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    for (const method of ["pushState", "replaceState"] as const) {
      const original = window.history[method];
      const guarded: History[typeof method] = function (this: History, ...args) {
        original.apply(this, args); refresh();
      };
      window.history[method] = guarded;
      restorers.push(() => { if (window.history[method] === guarded) window.history[method] = original; });
    }
    window.addEventListener("popstate", refresh);
    window.addEventListener("pageshow", refresh);
    window.addEventListener("pagehide", onPageHide);
    observer = new MutationObserver(refresh);
    observer.observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "src", "data-replay-payment"] });
  }
  const controller: StorefrontReplayController = {
    setEnabled(value) { if (stopped) return; enabled = value; refresh(); },
    setSensitiveContext(value) { if (stopped) return; sensitive = value; refresh(); },
    stop() {
      stopped = true; pause(); removeIntegration(); observer?.disconnect();
      for (const restore of restorers) restore();
      if (typeof window !== "undefined") {
        window.removeEventListener("popstate", refresh);
        window.removeEventListener("pageshow", refresh);
        window.removeEventListener("pagehide", onPageHide);
      }
      controllers.delete(reporter);
    },
  };
  controllers.set(reporter, controller); refresh();
  return controller;
}
