import request from "supertest";
import app from "../src/app";

describe("Waypoint API", () => {
  let createdCode: string;

  it("creates a link", async () => {
    const res = await request(app)
      .post("/links")
      .send({ originalUrl: "https://anthropic.com" });
    expect(res.status).toBe(201);
    expect(res.body.code).toBeDefined();
    createdCode = res.body.code;
  });

  it("rejects an invalid URL per the spec", async () => {
    const res = await request(app).post("/links").send({ originalUrl: "not-a-url" });
    expect(res.status).toBe(400);
  });

  it("redirects and increments the click count", async () => {
    const redirect = await request(app).get(`/${createdCode}`);
    expect(redirect.status).toBe(302);

    const stats = await request(app).get(`/links/${createdCode}`);
    expect(stats.body.clicks).toBe(1);
  });

  it("404s on an unknown code", async () => {
    const res = await request(app).get("/links/doesnotexist");
    expect(res.status).toBe(404);
  });

  it("deletes a link", async () => {
    const res = await request(app).delete(`/links/${createdCode}`);
    expect(res.status).toBe(204);
  });
});