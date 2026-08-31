# Waypoint API

![CI](https://github.com/vishnumuthyalu/waypoint-api/actions/workflows/ci.yml/badge.svg)

> A production-ready URL shortener built **spec-first**: the OpenAPI contract was written and validated *before* any route handlers existed, and every request and response is validated against it at runtime.

**Live Demo:** *Coming soon – deploying to Render*

## Why This Project Stands Out

Most portfolio APIs are built code-first and documented afterward (if at all). Waypoint API demonstrates a professional spec-driven development workflow:

1. **Contract-first design** – The [OpenAPI 3.1 spec](spec/openapi.yaml) was written and linted before the first endpoint
2. **Runtime validation** – `express-openapi-validator` enforces the contract on every request/response
3. **Contract tests** – Test suite validates implementation against the spec, not just hand-written assertions
4. **Automated CI/CD** – GitHub Actions pipeline lints the spec, type-checks, runs tests, and validates the build
5. **Production-ready architecture** – Multi-stage Docker build, PostgreSQL with Prisma ORM, TypeScript strict mode

This is how real engineering teams ship APIs—the contract is the source of truth.

---

## 🚀 Features

- **URL Shortening** – Generate short codes automatically or use custom aliases
- **Click Analytics** – Track click counts per link
- **Link Expiration** – Set optional expiration dates for time-limited links
- **Pagination** – Efficient paginated listing of all links
- **RESTful Design** – Five endpoints following REST conventions
- **Type Safety** – Full TypeScript coverage with strict mode enabled
- **Database Persistence** – PostgreSQL with Prisma ORM and migrations

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Language** | TypeScript 5.9 |
| **Runtime** | Node.js 20 |
| **Framework** | Express 5 |
| **Validation** | express-openapi-validator |
| **Database** | PostgreSQL (Prisma ORM) |
| **Testing** | Jest + Supertest |
| **Linting** | ESLint 9 with TypeScript support |
| **CI/CD** | GitHub Actions |
| **Containerization** | Docker (multi-stage build) |
| **API Spec** | OpenAPI 3.1.0 |

---

## 📋 API Endpoints

All endpoints are documented in the [OpenAPI specification](spec/openapi.yaml). Quick reference:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/links` | Create a new short link (auto-generated or custom code) |
| `GET` | `/links` | List all links with pagination |
| `GET` | `/links/{code}` | Get statistics for a specific link |
| `DELETE` | `/links/{code}` | Permanently delete a link |
| `GET` | `/{code}` | Redirect to the original URL (increments click count) |

### Example Request

```bash
# Create a short link
curl -X POST http://localhost:3000/links \
  -H "Content-Type: application/json" \
  -d '{
    "originalUrl": "https://github.com/vishnumuthyalu/waypoint-api",
    "customCode": "my-repo"
  }'

# Response (201 Created)
{
  "code": "my-repo",
  "originalUrl": "https://github.com/vishnumuthyalu/waypoint-api",
  "createdAt": "2026-08-31T12:00:00.000Z",
  "expiresAt": null
}

# Use the short link
curl -L http://localhost:3000/my-repo
# → Redirects to your GitHub repo
```

---

## 🏗️ Architecture & Design Decisions

### Spec-Driven Development Process

1. **Design phase** – Wrote `spec/openapi.yaml` defining all endpoints, schemas, and validation rules
2. **Validation** – Linted with Spectral to catch spec errors early
3. **Implementation** – Built route handlers to satisfy the contract
4. **Enforcement** – Middleware validates every request/response against the spec
5. **Contract tests** – Tests verify the implementation matches the spec

**Why this matters:** The spec acts as a single source of truth. Any drift between documentation and implementation causes the request to fail immediately—no silent bugs, no stale docs.

### Key Technical Highlights

- **Nanoid for code generation** – Cryptographically strong, URL-safe random IDs (7 characters, alphanumeric)
- **Prisma migrations** – Version-controlled schema changes, easily reproducible across environments
- **Multi-stage Docker build** – Separates build dependencies from runtime, resulting in a lean production image (~150MB)
- **Error handling strategy** – Central error middleware with spec-compliant error responses
- **PostgreSQL over SQLite** – Production-ready database with proper concurrent access handling

---

## 🚦 Getting Started

### Prerequisites

- Node.js 20+ (via [nvm](https://github.com/nvm-sh/nvm) recommended)
- PostgreSQL database (local or hosted – [Neon](https://neon.tech) free tier works great)
- Docker (optional, for containerized deployment)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/vishnumuthyalu/waypoint-api.git
   cd waypoint-api
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file:
   ```bash
   DATABASE_URL="postgresql://user:password@localhost:5432/waypoint"
   ```
   
   For development, you can use a free [Neon](https://neon.tech) PostgreSQL database.

4. **Run database migrations**
   ```bash
   npx prisma generate
   npx prisma migrate deploy
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```
   
   API will be available at `http://localhost:3000`

### Development Commands

```bash
npm run dev          # Start development server with hot-reload
npm run build        # Compile TypeScript to dist/
npm start            # Run compiled production build
npm test             # Run Jest test suite
npm run lint         # Lint code with ESLint
npm run typecheck    # Type-check without emitting files
```

---

## 🧪 Testing

The test suite uses **Jest + Supertest** for integration testing. Because `validateResponses: true` is enabled in the OpenAPI validator middleware, these are effectively **contract tests**—if a handler returns a response that doesn't match the spec, the request fails before the test assertion even runs.

```bash
npm test
```

**Test coverage:**
- ✅ Link creation with auto-generated codes
- ✅ Custom code validation (spec enforces 4-12 character alphanumeric pattern)
- ✅ Redirect behavior and click tracking
- ✅ Link deletion
- ✅ 404 handling for unknown codes
- ✅ Spec validation rejection (malformed URLs, invalid fields)

---

## 🔄 CI/CD Pipeline

Every push to `main` triggers a GitHub Actions workflow that:

1. Lints the OpenAPI spec with Spectral
2. Installs dependencies and generates Prisma client
3. Runs database migrations
4. Type-checks the entire codebase
5. Lints code with ESLint
6. Runs the test suite
7. Compiles the TypeScript build

The pipeline ensures the implementation never drifts from the contract—spec changes that break the code fail CI immediately.

See [.github/workflows/ci.yml](.github/workflows/ci.yml) for the full workflow.

---

## 🐳 Docker

The project includes a **multi-stage Dockerfile** optimized for production:

- **Stage 1 (deps):** Installs production dependencies only
- **Stage 2 (build):** Installs all dependencies, compiles TypeScript, generates Prisma client
- **Stage 3 (runtime):** Combines prod dependencies + compiled output, runs migrations on startup

```bash
# Build the image
docker build -t waypoint-api .

# Run locally (requires DATABASE_URL)
docker run -p 3000:3000 -e DATABASE_URL="your-connection-string" waypoint-api
```

**Image size:** ~150MB (Node 20 Alpine + compiled app)

---

## 🌐 Deployment (Coming Soon)

Planned deployment to [Render](https://render.com) with:
- Automatic deploys from the `main` branch
- PostgreSQL managed database (Neon or Render-hosted)
- Environment-based configuration
- Zero-downtime migrations via `prisma migrate deploy` in startup command

---

## 📂 Project Structure

```
waypoint-api/
├── .github/workflows/
│   └── ci.yml                    # GitHub Actions CI pipeline
├── prisma/
│   ├── schema.prisma             # Prisma schema (PostgreSQL)
│   └── migrations/               # Version-controlled migrations
├── spec/
│   └── openapi.yaml              # OpenAPI 3.1 contract (source of truth)
├── src/
│   ├── app.ts                    # Express app with OpenAPI validator
│   ├── server.ts                 # Server entry point
│   ├── db.ts                     # Prisma client singleton
│   ├── routes/
│   │   └── links.ts              # All five endpoint handlers
│   └── generated/                # Prisma-generated client (gitignored)
├── tests/
│   └── links.test.ts             # Integration/contract tests
├── Dockerfile                    # Multi-stage production build
├── jest.config.js                # Jest + ts-jest configuration
├── tsconfig.json                 # TypeScript strict mode config
├── package.json                  # Dependencies and scripts
└── README.md                     # You are here
```

---

## 🎯 What I Learned Building This

1. **Spec-first ≠ more work** – Writing the OpenAPI spec first actually *saved* time by catching design issues before implementation
2. **Runtime validation is powerful** – No more "the docs say X but the API returns Y" bugs
3. **Prisma's new generator** – Migrated from `prisma-client-js` to `prisma-client` mid-project (generates to `src/generated/` instead of `node_modules`)
4. **Docker multi-stage builds** – Reduced image size by 60% vs. a naive single-stage build
5. **PostgreSQL ≠ just swap the connection string** – Had to regenerate migrations when switching from SQLite (different SQL dialects)

---

## 🔮 Future Enhancements

- [ ] Deploy to Render with live demo URL
- [ ] Add authentication (API keys or JWT)
- [ ] QR code generation for each short link
- [ ] Detailed analytics (geographic data, referrers, device types)
- [ ] Rate limiting with Redis
- [ ] Swagger UI auto-generated from the OpenAPI spec
- [ ] Link preview metadata scraping (Open Graph)

---

## 📝 License

This project is licensed under the ISC License.

---

## 🤝 Contact

**Vishnu Muthyalu**  
📧 vm17college@gmail.com  
🔗 [GitHub](https://github.com/vishnumuthyalu)  
💼 [LinkedIn](https://linkedin.com/in/vishnumuthyalu)

---

**Built with a spec-first mindset. The contract is the code.**