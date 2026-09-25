import http from "k6/http";
import { check } from "k6";

export const options = {
  scenarios: {
    redirects: {
      executor: "constant-arrival-rate",
      rate: 500,
      timeUnit: "1s",
      duration: "60s",
      preAllocatedVUs: 100,
      maxVUs: 300,
    },
  },
  thresholds: { http_req_duration: ["p(99)<100"], http_req_failed: ["rate<0.01"] },
};

const BASE = __ENV.BASE || "http://localhost";
const CREATE_PATH = __ENV.CREATE_PATH || "/api/links"; // v1 has no BFF: pass -e CREATE_PATH=/links

export function setup() {
  const code = `k6-${Date.now().toString(36).slice(-6)}`;
  http.post(`${BASE}${CREATE_PATH}`, JSON.stringify({ originalUrl: "https://example.com", customCode: code }), {
    headers: { "Content-Type": "application/json" },
  });
  return { code };
}

export default function (data) {
  const res = http.get(`${BASE}/${data.code}`, { redirects: 0 });
  check(res, { "is 302": (r) => r.status === 302 });
}

export function teardown(data) {
  console.log(`dashboard: ${BASE}/api/dashboard/links/${data.code}`);
}