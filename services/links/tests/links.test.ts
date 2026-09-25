import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/db";

afterAll(() => prisma.$disconnect());

describe("links-service", () => {
  let createdCode: string;

  it("creates a link", async () => {
    const res = await request(app).post("/links").send({ originalUrl: "https://anthropic.com" });
    expect(res.status).toBe(201);
    expect(res.body.code).toBeDefined();
    createdCode = res.body.code;
  });

  it("rejects an invalid URL per the spec", async () => {
    const res = await request(app).post("/links").send({ originalUrl: "not-a-url" });
    expect(res.status).toBe(400);
  });

  it("gets a link by code", async () => {
    const res = await request(app).get(`/links/${createdCode}`);
    expect(res.status).toBe(200);
    expect(res.body.originalUrl).toBe("https://anthropic.com");
  });

  it("404s on an unknown code", async () => {
    const res = await request(app).get("/links/doesnotexist");
    expect(res.status).toBe(404);
  });

  it("returns 409 when a custom code is taken", async () => {
    const body = { originalUrl: "https://example.com", customCode: `dup${Date.now() % 100000}` };
    expect((await request(app).post("/links").send(body)).status).toBe(201);
    expect((await request(app).post("/links").send(body)).status).toBe(409);
  });

  it("lists links newest first", async () => {
    const res = await request(app).get("/links?limit=2");
    expect(res.status).toBe(200);
    const [a, b] = res.body.data;
    expect(new Date(a.createdAt).getTime()).toBeGreaterThanOrEqual(new Date(b.createdAt).getTime());
  });

  it("reports ready when the database is reachable", async () => {
    expect((await request(app).get("/readyz")).status).toBe(200);
  });

  it("deletes a link", async () => {
    expect((await request(app).delete(`/links/${createdCode}`)).status).toBe(204);
  });

  it("404s when deleting an unknown code", async () => {
    expect((await request(app).delete("/links/nope1234")).status).toBe(404);
  });
});