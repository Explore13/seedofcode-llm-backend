# SeedOfCode LLM Platform — Architecture, API Spec & 3-Day Build Plan

**Domain:** `llm.seedofcode.dev`
**Goal:** Turn a bare `nginx → Ollama` box into a proper self-hosted AI-credits platform (auth, API keys, credits/usage, rate limiting, queueing) that a *second* project can consume as a backend service.
**Explicitly out of scope for now:** model fine-tuning, RAG/vector DB, multi-provider routing, admin/analytics dashboards, Stripe billing UI. These are listed under "Phase 2+" at the end so nothing is lost, but they are **not** part of the 3-day build.

---

## 1. Current State vs Target State

**Current:**
```
Internet → Cloudflare DNS → Nginx → Ollama
```
This works, but it means Ollama is directly internet-facing (via Nginx) with no auth, no per-user credits, no rate limiting, no logging, and no queueing — so a second project can't safely consume it as a shared service, and one heavy request can block everyone else.

**Target (end of 3-day build):**
```
Internet
   │
Cloudflare (proxied, orange-cloud, Full-Strict SSL)
   │
Nginx  (origin TLS via Let's Encrypt, reverse proxy, gzip, security headers)
   │
NestJS API Gateway
   ├─ Auth (JWT, for you / future dashboard)
   ├─ API Keys (for the other project + any external consumer)
   ├─ Credits Guard (checks balance BEFORE queueing a job)
   └─ Rate Limiter (per plan/tier)
   │
BullMQ + Redis (queue)  ── Redis: self-hosted in Docker on the VM, no persistence
   │
Worker Service (consumes jobs, streams from Ollama, writes usage + deducts credits)
   │
Ollama → Gemma / Llama / Qwen / DeepSeek / Mistral   ── on VM disk (this is what eats the 200GB)
   │
PostgreSQL (TypeORM) — managed on Neon, not on the VM
   users, api_keys, credit_wallets, credit_transactions, usage_logs, models
```

**Why change Nginx → NestJS instead of Nginx → Ollama:** Nginx should stop pointing at Ollama's port entirely. It should reverse-proxy `llm.seedofcode.dev` to the NestJS app (e.g. `localhost:3000`), and only the NestJS Worker talks to Ollama's local port (`127.0.0.1:11434`), which is **not** exposed publicly. This is the key architectural fix — right now Ollama itself is one hop from the internet.

---

## 2. Tech Stack (trimmed to what's actually needed in 3 days)

| Layer | Choice | Notes |
|---|---|---|
| Server | Ubuntu on Oracle Cloud VM | 200GB total disk (Always Free tier) — shared by OS, Docker, Ollama models, logs |
| Edge | Cloudflare (proxied) | DNS + SSL edge + basic DDoS/WAF, free tier is enough |
| Reverse proxy | Nginx + Let's Encrypt | origin cert, points to NestJS not Ollama |
| API | NestJS + TypeScript | unchanged |
| ORM/DB | TypeORM + **Postgres on Neon** (managed, not on the VM) | durable, off-VM — see §3a. Use Neon's *pooled* connection string |
| Queue/Cache | **Redis, self-hosted in Docker on the VM** (persistence disabled) | rate-limit counters only — disposable, latency-sensitive, kept local |
| Auth | JWT (access + refresh) + API Keys (hashed) | both coexist, see §4 |
| Inference | Ollama (local, not public) | Gemma/Llama/Qwen already pulled — **the main consumer of the 200GB disk**, budget model storage deliberately |
| Logging | Pino (structured, to stdout/file) | Prometheus/Grafana/Loki deferred — not needed for MVP |

Deferred entirely for now: Prometheus, Grafana, Loki, Stripe, Qdrant, MinIO, Kafka/RabbitMQ — all listed in §7 Future Roadmap.

---

### 2a. Data Layer Placement — Why Postgres Is Managed and Redis Isn't

This split is deliberate, not arbitrary:

| | Redis (self-hosted, Docker on VM) | Postgres (managed, Neon) |
|---|---|---|
| What it holds | Rate-limit counters — disposable, short TTL | Credit ledger, usage logs, users — cannot be lost |
| Sits in hot path | Yes — `RateLimitGuard` runs on **every** LLM request | Yes, but a small round trip is negligible next to seconds-long inference |
| Persistence needed | No — losing counters on restart is harmless | Yes — this is the one dataset you can't afford to lose |
| Storage footprint | RAM only (a few MB); disable RDB/AOF (`--save ""`, `appendonly no`) so it never touches the 200GB disk at all | Not on the VM at all — doesn't compete with Ollama model storage |
| Why this placement | Local = fastest possible latency for a value you don't need to keep | Managed = automated backups + point-in-time restore for the data that actually matters |

**Practical notes:**
- Redis still needs a named Docker volume to start, but with persistence explicitly disabled it will not grow — it is not a contributor to disk pressure on the VM.
- Use Neon's **pooled** connection string in `TypeOrmModule.forRootAsync()`, since NestJS holds a connection pool open.
- Pick Neon's region as close as possible to your Oracle Cloud VM's region to keep the added round-trip small.
- Neon's free tier auto-suspends when idle — the first request after idle time will have a noticeable cold-start delay. Fine for now; revisit if `/chat` latency spikes intermittently in production.
- The 200GB VM disk is now used almost entirely by **Ollama model weights** + Docker/OS + logs. Budget this deliberately — don't keep every model pulled (Gemma/Llama/Qwen/DeepSeek/Mistral) if the other project only actually calls 1–2 of them; `ollama rm` the rest. Set up log rotation (Pino + nginx + docker logs) from Day 1 so logs don't silently fill the disk.

---

## 3. Database Schema (TypeORM) — MVP only

Entities below use the standard `@Entity()` decorator style. Each would live in its own `*.entity.ts` file under its module (e.g. `users/user.entity.ts`), which is the conventional NestJS + TypeORM layout.

```typescript
// user.entity.ts
export enum Plan {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  name?: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string; // hashed (argon2/bcrypt)

  @Column({ type: 'enum', enum: Plan, default: Plan.FREE })
  plan: Plan;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole; // gates /admin/* routes via RolesGuard, see §4

  @Column({ default: false })
  verified: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;

  @OneToMany(() => ApiKey, (apiKey) => apiKey.user)
  apiKeys: ApiKey[];

  @OneToOne(() => CreditWallet, (wallet) => wallet.user)
  wallet: CreditWallet;

  @OneToMany(() => RefreshToken, (token) => token.user)
  refreshTokens: RefreshToken[];
}
```

```typescript
// api-key.entity.ts
@Entity('api_keys')
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.apiKeys)
  user: User;

  @Column()
  userId: string;

  @Column()
  name: string;

  @Column({ unique: true })
  keyHash: string; // store SHA-256 hash, never the raw key

  @Column()
  keyPrefix: string; // e.g. "sk_live_ab12" shown in UI for identification

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
```

```typescript
// credit-wallet.entity.ts
@Entity('credit_wallets')
export class CreditWallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, (user) => user.wallet)
  @JoinColumn()
  user: User;

  @Column({ unique: true })
  userId: string;

  @Column({ type: 'int', default: 1000 })
  balance: number; // credits, not raw tokens — see §5

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
```

```typescript
// credit-transaction.entity.ts
export enum CreditTransactionReason {
  CHAT_COMPLETION = 'chat_completion',
  REFUND = 'refund',
  TOPUP = 'topup',
  SIGNUP_BONUS = 'signup_bonus',
}

@Entity('credit_transactions')
export class CreditTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ type: 'int' })
  amount: number; // negative = debit, positive = credit/refund

  @Column({ type: 'enum', enum: CreditTransactionReason })
  reason: CreditTransactionReason;

  @Column({ nullable: true })
  usageLogId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
```

```typescript
// usage-log.entity.ts
export enum UsageStatus {
  SUCCESS = 'success',
  ERROR = 'error',
  TIMEOUT = 'timeout',
}

@Entity('usage_logs')
export class UsageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ nullable: true })
  apiKeyId?: string;

  @Column()
  model: string;

  @Column({ type: 'int' })
  promptTokens: number;

  @Column({ type: 'int' })
  completionTokens: number;

  @Column({ type: 'int' })
  latencyMs: number;

  @Column({ type: 'enum', enum: UsageStatus })
  status: UsageStatus;

  @Column({ type: 'int' })
  creditsCost: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
```

```typescript
// model-info.entity.ts
export enum ModelProvider {
  OLLAMA = 'ollama',
}

@Entity('models')
export class ModelInfo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string; // "llama3.1:8b" — Ollama's tag, the lookup key everywhere

  @Column({ type: 'enum', enum: ModelProvider, default: ModelProvider.OLLAMA })
  provider: ModelProvider;

  @Column({ default: true })
  enabled: boolean;

  @Column({ type: 'int', nullable: true })
  maxContext: number; // from model_info's dynamic "*.context_length" key

  @Column({ type: 'jsonb', default: [] })
  capabilities: string[]; // straight from Ollama: ["completion","vision","tools",...]

  @Column({ nullable: true })
  family: string;

  @Column({ nullable: true })
  parameterSize: string; // "8.0B" — display string

  @Column({ type: 'bigint', nullable: true })
  parameterCount: string; // "7996157674" — precise, sortable

  @Column({ nullable: true })
  quantizationLevel: string;

  @Column({ type: 'bigint', nullable: true })
  sizeBytes: string;

  @Column({ nullable: true })
  digest: string;

  @Column({ type: 'int', default: 0 })
  creditsPerInputToken: number; // per 1000 tokens, per earlier pricing discussion

  @Column({ type: 'int', default: 0 })
  creditsPerOutputToken: number;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
```

```typescript
// refresh-token.entity.ts
@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string; // Acts as JTI (JWT ID) for token rotation

  @ManyToOne(() => User, (user) => user.refreshTokens)
  user: User;

  @Column()
  userId: string;

  @Column()
  tokenHash: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ default: false })
  revoked: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
```

```typescript
// email-otp.entity.ts
// Used for email verification on signup only — no password reset or 2FA flows in this build.
export enum OtpPurpose {
  EMAIL_VERIFICATION = 'email_verification',
  PASSWORD_RESET = 'password_reset',
}

@Entity('email_otps')
export class EmailOtp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: OtpPurpose, default: OtpPurpose.EMAIL_VERIFICATION })
  purpose: OtpPurpose;

  @Column({ nullable: true })
  userId?: string;

  @Column()
  email: string;

  @Column()
  otp: string; // hashed with bcrypt, never stored plaintext

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  verifiedAt?: Date;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
```

**TypeORM-specific setup notes:**
- Use the TypeORM CLI (`typeorm migration:generate` / `migration:run`) for versioned migrations — do **not** rely on `synchronize: true` beyond local dev, since it can silently drop/alter columns in a way that's dangerous once real credit balances exist.
- Register `TypeOrmModule.forFeature([...])` per module (e.g. `apikeys` module only imports `ApiKey`), and a single `TypeOrmModule.forRootAsync()` in `AppModule` reading DB config from `.env`.
- For the atomic reserve/deduct/refund logic in §5, use a `DataSource.transaction()` (or `QueryRunner` with manual `startTransaction()/commit()/rollback()`) wrapping the `CreditWallet` update + `CreditTransaction` insert + `UsageLog` insert together.

`conversations` / `messages` entities from your original draft are **optional** — only add them if the other project needs server-side chat history. If that project already stores its own conversation history, skip these two entities entirely for now to save time; they're easy to bolt on later without a migration headache.

---

## 4. Auth Model: JWT vs API Keys — use both, for different consumers

- **JWT (access + refresh):** for you / any future dashboard where a human logs in with email+password.
- **API Keys:** for your *other project* and any machine-to-machine consumer. This is the one that matters for your stated use case.

API key flow:
1. `POST /apikeys` (requires JWT) → generates a raw key, returns it **once**, stores only `SHA-256(key)` + a short prefix for display.
2. Consumer sends `Authorization: Bearer sk_live_xxxxx` on every request to `/chat`, `/generate`, etc.
3. `ApiKeyGuard` hashes the incoming key, looks up `ApiKey` by `keyHash`, confirms `isActive`, attaches `userId` to the request, updates `lastUsedAt` (batched/async, don't block the request on this write).

**Role-based access (`role` on `User`, `RolesGuard` + `@Roles()`):** the auth module now ships `UserRole.USER` / `UserRole.ADMIN`. This is what gates `/admin/*` once those routes get built (§7 Phase 2+) — no new mechanism needed, just decorate those controllers with `@Roles(UserRole.ADMIN)`.

**Email OTP — verification only, no 2FA or password reset in this build:**
- `POST /auth/otp/generate` and `POST /auth/otp/verify` exist and work: a 6-digit OTP is generated, bcrypt-hashed, stored in `email_otps` with an expiry and attempt counter, and emailed via nodemailer.
- Scope is deliberately narrow — **email verification on signup only.** No 2FA-gated login, no password-reset flow. If either becomes a real requirement later, the `EmailOtp` entity and generate/verify endpoints already support it; it's an enforcement change (e.g. gating `/auth/login` on `requires_2fa`), not a new subsystem.
- Whether verification is currently *enforced* (i.e. unverified users blocked from something) is a product decision to make when you wire it into registration — the endpoints existing doesn't by itself restrict anything yet.

---

## 5. Credits System (the core of an "AI credits platform")

Keep it simple for the 3-day build — token-based credits, 1:1 or with a small multiplier per model:

1. **Reserve before queueing:** when a request comes in, estimate a rough max cost (e.g. based on `max_tokens` requested) and check `wallet.balance >= estimatedCost`. If not, reject with `402 Payment Required` *before* it ever touches the queue — don't waste a worker slot on a request that can't be paid for.
2. **Deduct actual cost after completion:** once Ollama returns, compute real cost from actual `promptTokens + completionTokens` (pull from Ollama's response, which reports token counts), write a `UsageLog` row and a negative `CreditTransaction`, and update `wallet.balance` — all inside one TypeORM `DataSource.transaction()` (or `QueryRunner`) so it's atomic.
3. **Refund on failure:** if the job errors or times out after being dequeued, write a compensating positive `CreditTransaction` so the user isn't charged for a failed generation.
4. **Signup bonus:** give every new user a starting balance (e.g. 1000 credits) via the same transaction table so the ledger is always the source of truth — `wallet.balance` is a cached sum, `CreditTransaction` is the audit log.

This ledger design means `GET /usage` and `GET /billing/history` later can be built from the same table — no rework needed when Stripe top-ups get added in Phase 2.

---

## 6. API Surface — MVP (only what's needed in 3 days)

```
Auth  [DONE — see standalone Auth Module doc for full spec]
  POST   /auth/register
  POST   /auth/login
  POST   /auth/refresh
  POST   /auth/logout
  GET    /auth/me
  POST   /auth/otp/generate    (email verification only)
  POST   /auth/otp/verify

API Keys
  GET    /apikeys
  POST   /apikeys
  PATCH  /apikeys/:id
  DELETE /apikeys/:id
  POST   /apikeys/:id/regenerate

Credits / Usage
  GET    /credits/balance
  GET    /usage
  GET    /usage/today

Models
  GET    /models              (proxied/cached from `ollama list`)
  GET    /models/:name
  GET    /models/family/:family

Admin (Models)
  POST   /admin/models/sync   (syncs with Ollama and saves to DB)
  PATCH  /admin/models/:id    (updates model info in DB)

Inference  (the actual product surface for the other project)
  POST   /chat
  POST   /chat/stream
  POST   /generate
  POST   /generate/stream

Health
  GET    /health
  GET    /health/database
  GET    /health/redis
  GET    /health/ollama
```

Everything else from your original draft (`/billing`, `/admin/*`, `/analytics/*`, `/embeddings`, `/vision`, `/audio/*`, `/images/generate`, `/webhooks/*`) is real and worth keeping in the doc, but pushed to Phase 2+ (§7) — building all of it now would blow past 3 days. `/admin/*` will use the `RolesGuard` that already exists from the Auth module, so no new access-control work is needed when it's built.

---

## 7. Rate Limiting (per plan, enforced in NestJS, not Nginx)

| Plan | Requests/min | Daily cap | Starting credits |
|---|---|---|---|
| Free | 20 | 500 | 1,000 |
| Pro | 120 | Unlimited | 20,000 |
| Enterprise | Custom | Custom | Custom |

Use `@nestjs/throttler` with a custom storage adapter backed by Redis (so it works correctly across multiple worker/API instances later, not just in-memory). Guest/unauthenticated traffic should be blocked outright at this stage — no anonymous access, since credits require an identified wallet.

---

## 8. Request Flow (sequence, MVP)

```
1. Client → POST /chat/stream  (Authorization: Bearer <api_key>)
2. ApiKeyGuard        → resolves userId, checks isActive
3. RateLimitGuard      → checks Redis counter for userId+plan
4. CreditsGuard        → checks wallet.balance >= estimatedCost
5. NestJS enqueues job → BullMQ (priority = plan tier, Pro jobs jump the Free queue)
6. Worker dequeues     → calls Ollama /api/chat with stream:true
7. Worker streams tokens back to client via SSE/WebSocket relay
8. On completion       → Worker writes UsageLog + CreditTransaction (atomic), updates wallet
9. On error/timeout    → Worker writes refund CreditTransaction, marks UsageLog status=error
```

---

## 9. Nginx Change Required (do this early, Day 1)

Current config presumably proxies straight to Ollama's port. Change it to proxy to the NestJS app instead, and make sure Ollama's `11434` is bound to `127.0.0.1` only (check `OLLAMA_HOST` env var) so it's unreachable from outside the box even if Nginx is misconfigured later.

```nginx
server {
    listen 443 ssl;
    server_name llm.seedofcode.dev;

    location / {
        proxy_pass http://127.0.0.1:3000;   # NestJS, not Ollama
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;                # needed for SSE streaming
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 10. 3-Day Implementation Roadmap

### **Day 1 — Foundation & Auth**  ✅ Auth + OTP (email verification) shipped
- [x] Scaffold NestJS project (`nest new`), set up `.env`, TypeORM + PostgreSQL connection (`TypeOrmModule.forRootAsync`, pointed at **Neon's pooled connection string**)
- [x] Write entities from §3, generate + run initial TypeORM migration against Neon
- [x] Stand up Redis in Docker on the VM with persistence disabled (`--save ""`, `appendonly no`) — rate-limit counters only, no volume growth expected
- [x] Build `auth` module: register/login/refresh/logout, JWT strategy, password hashing (argon2/bcrypt), OTP generate/verify (email verification only)
- [x] Build `apikeys` module: create/list/delete, key hashing, `ApiKeyGuard`
- [] Update Nginx to proxy to NestJS (§9); confirm Ollama is bound to localhost only
- [x] Global middleware: Helmet, CORS, compression, request ID, Pino request logger

### **Day 2 — Queue & Inference Gateway**
- [ ] Add Redis + BullMQ, create `generation` queue with priority by plan
- [ ] Build `worker` service: consumes queue, calls Ollama (`/api/chat`, `/api/generate`), handles streaming responses back through SSE
- [x] Build `/models` endpoint (list from Ollama, cache in `ModelInfo` table)
- [x] Build `/chat`, `/chat/stream`, `/generate`, `/generate/stream` controllers → enqueue jobs, relay worker output to client
- [ ] Health endpoints: `/health/database`, `/health/redis`, `/health/ollama`

### **Day 3 — Credits, Rate Limiting & Hardening**
- [ ] Build `credits` module: wallet creation on signup, `CreditsGuard` (pre-check), post-completion deduction logic (atomic transaction), refund-on-failure logic
- [ ] Build `usage` module: `GET /usage`, `GET /usage/today` from `UsageLog`
- [ ] Wire up `@nestjs/throttler` with Redis store per §7 table
- [ ] End-to-end test: register → create API key → call `/chat/stream` from the *other project* → confirm credits deduct correctly → confirm rate limit triggers correctly → confirm refund-on-error works (simulate by killing Ollama mid-request)
- [ ] Write a short internal README for the other project: base URL, auth header format, endpoint list, error codes (`401`, `402`, `429`)

By end of Day 3, the other project can authenticate with an API key, send chat/generate requests, get streamed responses, and have credits tracked and enforced — which is the actual bar for "AI credits platform" MVP.

---

## 11. Phase 2+ — Future Roadmap (not in the 3-day scope, kept for reference)

- Stripe billing integration + `/billing`, `/subscription/*`, `/webhooks/stripe`
- Admin dashboard: `/admin/*`, `/analytics/*`, online users, queue length, revenue
- Monitoring stack: Prometheus, Grafana, Loki
- Next.js user dashboard: usage graphs, API key management UI, playground
- Multi-provider routing (OpenAI, Anthropic, Groq, Gemini) with fallback
- Embeddings, vision, audio endpoints (`/embeddings`, `/vision`, `/audio/*`)
- RAG pipeline + Qdrant vector DB + document upload/file search
- Semantic caching, load balancing across multiple Ollama servers
- Team workspaces / organization accounts / shared API keys
- Fine-tuned models, prompt versioning, prompt playground
- Conversation/message persistence tables (only if the other project doesn't already store its own history)

---

## Summary of Changes from Your Original Draft

1. **Nginx now proxies to NestJS, not Ollama** — Ollama is bound to localhost only. This was the biggest gap in the original diagram.
2. **Scope cut to fit 3 days**: billing UI, admin dashboard, analytics, monitoring stack (Prometheus/Grafana/Loki), embeddings/vision/audio, RAG — all moved to Phase 2+. Trying to build all of the original doc's modules in 3 days isn't realistic; this MVP is what makes the platform *usable* by your other project immediately.
3. **Added an explicit credits ledger design** (`CreditWallet` + `CreditTransaction`) — your original schema had `usage` tracking but no actual credits/wallet mechanism, which is the core requirement of a "credits platform."
4. **Added a reserve → deduct → refund flow** so failed/timed-out generations don't silently charge users, and so requests that can't be paid for never hit the queue.
5. **Clarified API Key vs JWT roles** — JWT for humans, API keys for the other project/machine consumers, since your original doc didn't distinguish who uses what.
6. **Switched ORM from Prisma to TypeORM** — schema in §3 is now written as TypeORM entity classes, migrations run via the TypeORM CLI (avoid `synchronize: true` once real credit balances exist), and the atomic reserve/deduct/refund flow in §5 uses `DataSource.transaction()` instead of Prisma's `$transaction`.
7. **Split the data layer**: Postgres moved to managed Neon (durable, off-VM, doesn't compete with your 200GB disk which Ollama models mostly consume), while Redis stays self-hosted in Docker on the VM with persistence disabled (rate-limit counters are disposable and latency-sensitive, so local beats managed here). See §2a for the full reasoning.
8. **Auth module completed and merged in** — added `role` (`UserRole.USER`/`ADMIN`) to the `User` entity and a new `EmailOtp` entity to §3, wired `RolesGuard` as the mechanism that will gate `/admin/*` when those routes get built. OTP is scoped to **email verification only** — no 2FA, no password reset — matching what was actually built.