import { TestBed } from "@angular/core/testing";
import { DOCUMENT } from "@angular/core";
import { TurnstileApi, TurnstileLoader } from "./turnstile-loader";

describe("Turnstile script loader", () => {
    afterEach(() => {
        document
            .querySelectorAll('script[src*="challenges.cloudflare.com"]')
            .forEach((script) => script.remove());
        delete (window as Window & { turnstile?: TurnstileApi }).turnstile;
        vi.useRealTimers();
    });

    it("shares one script request and supports retry after a failed load", async () => {
        const loader = TestBed.inject(TurnstileLoader);
        const first = loader.load();
        expect(loader.load()).toBe(first);
        const rejected = expect(first).rejects.toThrow();
        const script = TestBed.inject(DOCUMENT).querySelector(
            'script[src*="challenges.cloudflare.com"]',
        )!;
        script.dispatchEvent(new Event("error"));
        await rejected;
        expect(document.contains(script)).toBe(false);
        const next = loader.load();
        const api = { render: vi.fn(), reset: vi.fn(), remove: vi.fn() };
        (window as Window & { turnstile?: TurnstileApi }).turnstile = api;
        document
            .querySelector('script[src*="challenges.cloudflare.com"]')!
            .dispatchEvent(new Event("load"));
        expect(await next).toBe(api);
    });

    it("times out a script blocked without an error event", async () => {
        vi.useFakeTimers();
        const pending = TestBed.inject(TurnstileLoader).load();
        const assertion = expect(pending).rejects.toThrow();
        await vi.advanceTimersByTimeAsync(15_000);
        await assertion;
        expect(
            document.querySelector('script[src*="challenges.cloudflare.com"]'),
        ).toBe(null);
    });
});
