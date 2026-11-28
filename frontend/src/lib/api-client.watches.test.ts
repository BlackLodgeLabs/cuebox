import { afterEach, describe, expect, it, vi } from "vitest";
import { createFilmWatch, deleteFilmWatch, updateFilmWatch } from "@/lib/api-client";

function mockJson(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("watch client", () => {
  it("posts a score-only star tap and keeps an explicit null date", async () => {
    const fetchMock = mockJson(200, { id: "film-1", watches: [{ id: "watch-1" }] });
    vi.stubGlobal("fetch", fetchMock);

    await createFilmWatch("film-1", { score: 4, watched_at: null });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/films/film-1/watches",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ score: 4, watched_at: null }),
      }),
    );
  });

  it("patches only the provided fields", async () => {
    const fetchMock = mockJson(200, { id: "watch-1", notes: "late" });
    vi.stubGlobal("fetch", fetchMock);

    await updateFilmWatch("film-1", "watch-1", { notes: "late" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/films/film-1/watches/watch-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ notes: "late" }),
      }),
    );
  });

  it("deletes a watch and accepts an empty 204", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => {
        throw new Error("no body");
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteFilmWatch("film-1", "watch-1")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/films/film-1/watches/watch-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
