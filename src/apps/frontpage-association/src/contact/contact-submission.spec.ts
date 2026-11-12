import { TurnstileLoader } from "./turnstile-loader";
import { turnstileProviders } from "./turnstile-testing";
import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import {
    provideHttpClientTesting,
    HttpTestingController,
} from "@angular/common/http/testing";
import { provideRouter } from "@angular/router";
import { ContactForm } from "./contact-form";
import { CONTACT_API_BASE_URL } from "./contact-api-config";

const url = "http://localhost:5081/contact";

describe("association contact submission", () => {
    beforeEach(() =>
        TestBed.configureTestingModule({
            imports: [ContactForm],
            providers: [
                ...turnstileProviders(),
                provideRouter([]),
                provideHttpClient(),
                provideHttpClientTesting(),
                {
                    provide: CONTACT_API_BASE_URL,
                    useValue: "http://localhost:5081",
                },
            ],
        }),
    );
    afterEach(() => TestBed.inject(HttpTestingController).verify());

    async function setup() {
        const fixture = TestBed.createComponent(ContactForm);
        await fixture.whenStable();
        const element = fixture.nativeElement as HTMLElement;
        const set = (key: string, value: string) => {
            const input = element.querySelector(
                `[formControlName="${key}"]`,
            ) as HTMLInputElement;
            input.value = value;
            input.dispatchEvent(new Event("input"));
        };
        const submit = () =>
            element.querySelector("form")!.dispatchEvent(new Event("submit"));
        const fill = () => {
            set("name", "Jan");
            set("email", "jan@example.nl");
            set("message", "Hallo");
        };
        return {
            fixture,
            element,
            set,
            submit,
            fill,
            http: TestBed.inject(HttpTestingController),
        };
    }

    it("rejects empty, whitespace, invalid email and oversized fields locally", async () => {
        const { fixture, set, submit, fill, http, element } = await setup();
        submit();
        await fixture.whenStable();
        expect(element.querySelectorAll(".error").length).toBe(3);
        fill();
        set("name", "   ");
        submit();
        set("name", "x".repeat(201));
        submit();
        set("name", "Jan");
        set("email", "bad");
        submit();
        set("email", "jan@example.nl");
        set("message", "x".repeat(10001));
        submit();
        http.expectNone(url);
    });

    it("posts once while pending and resets only after receipt", async () => {
        const { fixture, element, fill, submit, http } = await setup();
        fill();
        submit();
        submit();
        await fixture.whenStable();
        const request = http.expectOne(url);
        expect(request.request.body.source).toBe("association");
        expect(
            (
                element.querySelector(
                    'button[type="submit"]',
                ) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
        expect(
            (
                element.querySelector(
                    '[formControlName="name"]',
                ) as HTMLInputElement
            ).disabled,
        ).toBe(true);
        expect(element.textContent).not.toContain("bericht is ontvangen");
        request.flush(null, { status: 204, statusText: "No Content" });
        await fixture.whenStable();
        await vi.waitFor(() =>
            expect(element.textContent).toContain("bericht is ontvangen"),
        );
        expect(
            (
                element.querySelector(
                    '[formControlName="name"]',
                ) as HTMLInputElement
            ).value,
        ).toBe("");
    });

    it("preserves input on failure and allows retry", async () => {
        const { fixture, element, fill, submit, http } = await setup();
        fill();
        submit();
        http.expectOne(url).error(new ProgressEvent("error"));
        await fixture.whenStable();
        expect(element.querySelector('[role="alert"]')).toBeTruthy();
        expect(
            (
                element.querySelector(
                    '[formControlName="name"]',
                ) as HTMLInputElement
            ).value,
        ).toBe("Jan");
        submit();
        http.expectOne(url).flush(null, {
            status: 204,
            statusText: "No Content",
        });
        await fixture.whenStable();
        await vi.waitFor(() =>
            expect(element.textContent).toContain("bericht is ontvangen"),
        );
    });

    it("maps server field errors and submits again after correction", async () => {
        const { fixture, element, fill, set, submit, http } = await setup();
        fill();
        submit();
        http.expectOne(url).flush(
            { errors: { name: ["invalid"] } },
            { status: 400, statusText: "Bad Request" },
        );
        await fixture.whenStable();
        expect(
            element
                .querySelector('[formControlName="name"]')!
                .getAttribute("aria-invalid"),
        ).toBe("true");
        expect(element.textContent).toContain("Controleer dit veld");
        submit();
        http.expectNone(url);
        set("name", "Jan Jansen");
        submit();
        http.expectOne(url).flush(null, {
            status: 204,
            statusText: "No Content",
        });
        await fixture.whenStable();
        await vi.waitFor(() =>
            expect(element.textContent).toContain("bericht is ontvangen"),
        );
    });

    it("disables submissions when unconfigured", async () => {
        TestBed.overrideProvider(CONTACT_API_BASE_URL, { useValue: "" });
        const { fixture, element, fill, submit, http } = await setup();
        fill();
        submit();
        await fixture.whenStable();
        expect(element.textContent).toContain("tijdelijk niet beschikbaar");
        expect(
            (
                element.querySelector(
                    'button[type="submit"]',
                ) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
        http.expectNone(url);
    });
    it.each([403, 503])(
        "requires a fresh token after verification failure %s",
        async (status) => {
            const { fixture, element, fill, submit, http } = await setup();
            const api = await TestBed.inject(TurnstileLoader).load();
            vi.mocked(api.reset).mockImplementation(() => {});
            const options = vi.mocked(api.render).mock.calls[0][1];
            fill();
            options["expired-callback"]();
            submit();
            http.expectNone(url);
            options.callback("fresh-token");
            submit();
            const request = http.expectOne(url);
            expect(request.request.body.turnstileToken).toBe("fresh-token");
            request.flush({}, { status, statusText: "Verification failed" });
            await fixture.whenStable();
            expect(
                (
                    element.querySelector(
                        '[formControlName="name"]',
                    ) as HTMLInputElement
                ).value,
            ).toBe("Jan");
            expect(
                (
                    element.querySelector(
                        'button[type="submit"]',
                    ) as HTMLButtonElement
                ).disabled,
            ).toBe(true);
            submit();
            http.expectNone(url);
            options.callback("next-token");
            submit();
            const retry = http.expectOne(url);
            expect(retry.request.body.turnstileToken).toBe("next-token");
            retry.flush(null, { status: 204, statusText: "No Content" });
            await fixture.whenStable();
        },
    );
});
