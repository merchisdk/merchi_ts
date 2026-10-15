import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFrontendErrorReporter } from "../src/reporter.js";
import { ReplayBuffer, sanitizeReplayEvent, startStorefrontReplay, type StorefrontReplayController } from "../src/replay.js";

const mock = vi.hoisted(() => ({ record: vi.fn(), stop: vi.fn(), emit: undefined as undefined | ((event: { type: number; timestamp: number; data: unknown }) => void) }));
vi.mock("@rrweb/record", () => ({ record: mock.record }));
const at = 1_800_000_000_000;
const snapshot = (timestamp = at) => ({ type: 2, timestamp, data: { node: { type: 0, id: 1, childNodes: [] }, initialOffset: { top: 0, left: 0 } } });
const meta = (timestamp = at) => ({ type: 4, timestamp, data: { href: "https://shop.example/?token=secret", width: 1000, height: 700 } });
const mutation = (timestamp: number) => ({ type: 3, timestamp, data: { source: 2, id: 2, x: 10, y: 10 } });

describe("replay privacy and rolling buffer", () => {
  it("retains a reconstructable snapshot and rebases metadata when pruning", () => {
    const buffer = new ReplayBuffer(); buffer.push(meta());
    for (let seconds = 0; seconds <= 120; seconds += 10) {
      buffer.push(snapshot(at + seconds * 1000)); buffer.push(mutation(at + seconds * 1000 + 1));
    }
    const events = buffer.snapshot();
    expect(events[0]?.timestamp).toBe(at + 60000);
    expect(events[0]?.type).toBe(4); expect(events[1]?.type).toBe(2);
    expect(events.every((event) => event.timestamp >= at + 60000)).toBe(true);
  });
  it("drops oversized snapshots together with their dependent mutations", () => {
    const buffer = new ReplayBuffer();
    buffer.push({ type: 2, timestamp: at, data: { text: "a".repeat(4 * 1024 * 1024) } });
    buffer.push(mutation(at + 1)); expect(buffer.snapshot()).toEqual([]);
    buffer.push(snapshot(at + 2)); expect(buffer.snapshot()).toHaveLength(1);
  });
  it("masks text, values and private DOM attributes and strips resource URLs", () => {
    const event = { type: 2, timestamp: at, data: { node: {
      tagName: "input", attributes: { value: "card-secret", title: "person@example.com", "data-token": "auth-secret", src: "private-upload.png", class: "flex p-2", style: "background:url(https://private/image);width:10px" },
      childNodes: [{ type: 3, textContent: "person@example.com" }],
    } } };
    const result = JSON.stringify(sanitizeReplayEvent(event));
    for (const secret of ["person@example.com", "card-secret", "auth-secret", "private-upload", "https://private"]) expect(result).not.toContain(secret);
    expect(result).toContain("flex p-2"); expect(result).toContain('"tagName":"input"');
  });

  it("preserves attribute mutation arrays and removals while masking their values", () => {
    const event = { type: 3, timestamp: at, data: { source: 0, texts: [], removes: [], adds: [],
      attributes: [{ id: 7, attributes: { class: "updated", style: null, value: "private-input", title: "private-name" } }] } };
    const result = sanitizeReplayEvent(event);
    expect(result.data).toMatchObject({ attributes: [{ id: 7, attributes: { class: "updated", style: null } }] });
    expect(JSON.stringify(result)).not.toContain("private-");
  });
});

describe("error-triggered replay lifecycle", () => {
  let controller: StorefrontReplayController | undefined;
  beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(at);
    mock.record.mockReset(); mock.stop.mockReset(); mock.emit = undefined;
    mock.record.mockImplementation((options) => { mock.emit = options.emit; options.emit(meta()); options.emit(snapshot()); return mock.stop; });
  });
  afterEach(() => { controller?.stop(); controller = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); });

  function setup() {
    const transport = vi.fn().mockResolvedValue({ accepted: true, replay: { id: "server-id", uploadToken: "scoped-grant" } });
    const reporter = createFrontendErrorReporter({ endpoint: "https://api.example/v6/frontend-errors", application: "merchi-storefront-1", enabled: true, transport });
    controller = startStorefrontReplay(reporter, { enabled: true, apiUrl: "https://api.example/v6/" });
    return { reporter, transport };
  }

  it("does not load or record before consent, and clears data on withdrawal", async () => {
    const { reporter, transport } = setup();
    reporter.captureException(new Error("before consent"));
    expect(mock.record).not.toHaveBeenCalled();
    expect(transport.mock.calls[0]?.[1]).not.toHaveProperty("replayRequested");
    controller!.setConsent(true); await vi.advanceTimersByTimeAsync(0);
    expect(mock.record).toHaveBeenCalledOnce();
    controller!.setConsent(false);
    expect(mock.stop).toHaveBeenCalledOnce();
    reporter.captureException(new Error("after withdrawal"));
    expect(transport.mock.calls[1]?.[1]).not.toHaveProperty("replayRequested");
  });

  it("uploads a baseline immediately and appends 15 seconds; suppressed duplicates upload nothing", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal("fetch", fetch);
    const { reporter, transport } = setup(); controller!.setConsent(true);
    await vi.advanceTimersByTimeAsync(0);
    const error = new Error("checkout failed");
    reporter.captureException(error); reporter.captureException(error);
    await vi.advanceTimersByTimeAsync(1);
    expect(transport).toHaveBeenCalledOnce(); expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]?.[0]).toBe("https://api.example/v6/frontend-replays/server-id/parts/0");
    mock.emit?.(mutation(at + 10000));
    await vi.advanceTimersByTimeAsync(15000);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1]?.[0]).toContain("/parts/1");
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ credentials: "omit", referrerPolicy: "no-referrer", headers: { "X-Replay-Token": "scoped-grant" } });
  });

  it("never uploads when the server suppresses the report or consent is withdrawn", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const { reporter, transport } = setup(); controller!.setConsent(true); await vi.advanceTimersByTimeAsync(0);
    transport.mockResolvedValue({ accepted: true, disposition: "suppressed" });
    reporter.captureException(new Error("handled"));
    await vi.advanceTimersByTimeAsync(16000); expect(fetch).not.toHaveBeenCalled();
    transport.mockResolvedValue({ accepted: true, replay: { id: "x", uploadToken: "t" } });
    reporter.captureException(new Error("late response")); controller!.setConsent(false);
    await vi.advanceTimersByTimeAsync(16000); expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps error reporting working when an integration throws", async () => {
    const transport = vi.fn().mockResolvedValue({ accepted: true });
    const reporter = createFrontendErrorReporter({ endpoint: "https://api.example", application: "storefront", enabled: true, transport });
    reporter.addIntegration({ prepare() { throw Error("recorder crashed"); }, accepted() { throw Error("callback crashed"); } });
    expect(reporter.captureException(new Error("real failure"))).toBe(true);
    await vi.advanceTimersByTimeAsync(0); expect(transport).toHaveBeenCalledOnce();
  });

  it("finishes a quiet post-error window and aborts uploads when consent is withdrawn", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal("fetch", fetch);
    const { reporter } = setup(); controller!.setConsent(true); await vi.advanceTimersByTimeAsync(0);
    reporter.captureException(new Error("quiet failure")); await vi.advanceTimersByTimeAsync(15001);
    expect(fetch).toHaveBeenCalledTimes(2);
    fetch.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("aborted")));
    }));
    reporter.captureException(new Error("later failure")); await vi.advanceTimersByTimeAsync(0);
    const signal = fetch.mock.calls[2]?.[1].signal;
    expect(signal.aborted).toBe(false);
    controller!.setConsent(false); expect(signal.aborted).toBe(true);
  });
});
