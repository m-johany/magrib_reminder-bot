import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { GeocodeError, resolveCityName } from "../src/geocode";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("resolveCityName", () => {
  it("resolves a bare city name to city + country", async () => {
    server.use(
      http.get("https://geocoding-api.open-meteo.com/v1/search", () =>
        HttpResponse.json({
          results: [{ name: "Dhaka", country: "Bangladesh" }],
        })
      )
    );

    expect(await resolveCityName("Dhaka")).toEqual({
      city: "Dhaka",
      country: "Bangladesh",
    });
  });

  it("requests the top match in English", async () => {
    let requestedUrl = "";
    server.use(
      http.get("https://geocoding-api.open-meteo.com/v1/search", ({ request }) => {
        requestedUrl = request.url;
        return HttpResponse.json({ results: [{ name: "Dhaka", country: "Bangladesh" }] });
      })
    );

    await resolveCityName("Dhaka");
    const url = new URL(requestedUrl);
    expect(url.searchParams.get("name")).toBe("Dhaka");
    expect(url.searchParams.get("count")).toBe("1");
    expect(url.searchParams.get("language")).toBe("en");
  });

  it("returns null when the name matches nothing", async () => {
    server.use(
      http.get("https://geocoding-api.open-meteo.com/v1/search", () =>
        HttpResponse.json({ results: null })
      )
    );

    expect(await resolveCityName("Qwertyzzz9")).toBeNull();
  });

  it("throws GeocodeError on HTTP failures", async () => {
    server.use(
      http.get("https://geocoding-api.open-meteo.com/v1/search", () =>
        HttpResponse.json({ error: "boom" }, { status: 500 })
      )
    );

    await expect(resolveCityName("Dhaka")).rejects.toBeInstanceOf(GeocodeError);
  });

  it("throws GeocodeError when the geocoder is unreachable", async () => {
    server.use(
      http.get("https://geocoding-api.open-meteo.com/v1/search", () =>
        HttpResponse.error()
      )
    );

    await expect(resolveCityName("Dhaka")).rejects.toBeInstanceOf(GeocodeError);
  });
});
