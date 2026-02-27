# 🔐 Bypass Bodyguard - Admin Technical Documentation

> ⚠️ **CONFIDENTIAL**: This document contains internal implementation details. Do not share publicly.

---

## 📋 Table of Contents

1. [System Architecture](#system-architecture)
2. [Database Models](#database-models)
3. [Step-by-Step Flow](#step-by-step-flow)
4. [Security Checkpoints](#security-checkpoints)
5. [Error Handling](#error-handling)

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER REQUEST                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      routes/views.js                            │
│   • Generates Session Token                                     │
│   • Creates Challenge (hoopX, hoopY, challengeId)               │
│   • Injects data into HTML                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    routes/basketball.js                         │
│   • /init - Creates new challenge                               │
│   • /validate - Validates physics + creates completion ticket   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    middleware/shield.js                         │
│   • Blocks direct access to Step 2                              │
│   • Validates completion ticket                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Models

### 1. Link (models/Link.js)

Stores the protected destination URLs.

| Field       | Type   | Description                                          |
| ----------- | ------ | ---------------------------------------------------- |
| `linkId`    | String | Unique 6-char identifier (e.g., `xdl97c`)            |
| `targetUrl` | String | The actual destination URL (never exposed to client) |
| `shortLink` | String | External shortener URL for Step 2 redirect           |
| `slug`      | String | 12-char random string for Step 1 URL (`?s=xxxx`)     |
| `createdAt` | Date   | Auto-generated, used for TTL cleanup                 |

---

### 2. AccessSession (models/AccessSession.js)

Tracks each user's verification journey.

| Field          | Type   | Description                                 |
| -------------- | ------ | ------------------------------------------- |
| `ip`           | String | User's IP address (bound to session)        |
| `token`        | String | Random 13-char session token                |
| `activeLinkId` | String | Which link this session is trying to access |
| `status`       | String | `PENDING` → `COMPLETED`                     |
| `createdAt`    | Date   | Used for anti-speedrun time check           |

**TTL**: 15 minutes (auto-deleted via MongoDB TTL index)

---

### 3. BasketballChallenge (models/BasketballChallenge.js)

Stores the physics challenge parameters.

| Field         | Type   | Description                           |
| ------------- | ------ | ------------------------------------- |
| `challengeId` | String | Unique 8-char identifier              |
| `hoopX`       | Number | Target X position (0-1 ratio)         |
| `hoopY`       | Number | Target Y position (0-1 ratio)         |
| `linkId`      | String | Associated link (nullable for Step 1) |
| `createdAt`   | Date   | Auto-expiry timestamp                 |

**TTL**: 15 minutes

---

### 4. Step1Completion (models/Step1Completion.js)

One-time tickets proving Step 1 was completed.

| Field       | Type   | Description                      |
| ----------- | ------ | -------------------------------- |
| `ip`        | String | User's IP (must match on Step 2) |
| `linkId`    | String | Which link was completed         |
| `userAgent` | String | Browser fingerprint              |
| `createdAt` | Date   | Ticket creation time             |

**TTL**: 15 minutes (consumed/deleted after Step 2 success)

---

## 🚶 Step-by-Step Flow

### Phase 1: Link Generation

```
Admin calls: POST /api/generate { targetUrl: "https://example.com" }
                    │
                    ▼
    ┌───────────────────────────────────┐
    │ 1. Generate linkId (6 chars)      │
    │ 2. Generate slug (12 chars)       │
    │ 3. Create Step 2 URL with linkId  │
    │ 4. Shorten Step 2 URL             │
    │ 5. Save Link document to MongoDB  │
    │ 6. Return Step 1 URL: /?s=slug    │
    └───────────────────────────────────┘
```

---

### Phase 2: User Visits Step 1 (/)

```
User visits: https://domain.com/?s=abc123xyz456
                    │
                    ▼
    ┌───────────────────────────────────┐
    │ routes/views.js GET /             │
    ├───────────────────────────────────┤
    │ 1. Extract slug from ?s= param    │
    │ 2. Generate sessionToken (13 ch)  │
    │ 3. Generate challengeId (8 char)  │
    │ 4. Generate hoopX, hoopY (random) │
    │                                   │
    │ 5. await connectDB()              │
    │ 6. Find Link by slug → get linkId │
    │                                   │
    │ 7. Create AccessSession:          │
    │    - ip: req.ip                   │
    │    - token: sessionToken          │
    │    - activeLinkId: linkId         │
    │                                   │
    │ 8. Create BasketballChallenge:    │
    │    - challengeId, hoopX, hoopY    │
    │    - linkId                       │
    │                                   │
    │ 9. await Promise.all([save both]) │
    │                                   │
    │ 10. Inject into HTML:             │
    │     window.SESSION_TOKEN = "..."  │
    │     window.INITIAL_CHALLENGE = {} │
    │                                   │
    │ 11. Send HTML to user             │
    └───────────────────────────────────┘
```

---

### Phase 3: User Plays & Hits Target

```
User throws dart and hits target
                    │
                    ▼
    ┌───────────────────────────────────┐
    │ Client-side: shared.js            │
    ├───────────────────────────────────┤
    │ 1. evaluateHit() detects success  │
    │ 2. Show "BULLSEYE!" message       │
    │ 3. After 1s delay, show Verifying │
    │ 4. Call window.validateShot()     │
    └───────────────────────────────────┘
                    │
                    ▼
    ┌───────────────────────────────────┐
    │ POST /api/basketball/validate     │
    │ routes/basketball.js              │
    ├───────────────────────────────────┤
    │ Payload:                          │
    │ - challengeId                     │
    │ - angle, power, dragDuration      │
    │ - dragPath (array of points)      │
    │ - screenWidth, screenHeight       │
    │ - sessionToken                    │
    ├───────────────────────────────────┤
    │ Checks:                           │
    │ 1. Find challenge by challengeId  │
    │ 2. validateDragPath() - human?    │
    │ 3. validateBasketballShot() -     │
    │    physics simulation             │
    │                                   │
    │ If MISS: return { error: 'miss' } │
    │                                   │
    │ If HIT:                           │
    │ 4. Find Link → get shortLink      │
    │ 5. Create Step1Completion:        │
    │    - ip: req.ip                   │
    │    - linkId                       │
    │    - userAgent                    │
    │ 6. Return { redirect: shortLink } │
    └───────────────────────────────────┘
```

---

### Phase 4: Redirect Through Shortener

```
Client receives shortLink (e.g., gplinks/adrino)
                    │
                    ▼
    ┌───────────────────────────────────┐
    │ User clicks/auto-redirects        │
    │ to external shortener             │
    │                                   │
    │ After completing shortener:       │
    │ Redirects to Step 2 URL:          │
    │ /final.html?id=xdl97c             │
    └───────────────────────────────────┘
```

---

### Phase 5: User Arrives at Step 2 (/final.html)

```
User visits: /final.html?id=xdl97c
                    │
                    ▼
    ┌───────────────────────────────────┐
    │ middleware/shield.js              │
    │ step2Shield()                     │
    ├───────────────────────────────────┤
    │ CHECK 1: Referer Header           │
    │ - Must exist (not direct access)  │
    │ - If missing → 403 Forbidden      │
    │                                   │
    │ CHECK 2: LinkId Parameter         │
    │ - Must have ?id= in URL           │
    │ - If missing → 400 Bad Request    │
    │                                   │
    │ CHECK 3: Completion Ticket        │
    │ - Query: Step1Completion.findOne  │
    │   { ip, linkId, userAgent }       │
    │                                   │
    │ - Fallback: try without userAgent │
    │   { ip, linkId }                  │
    │                                   │
    │ - If no ticket → 403 Forbidden    │
    │   "You must complete Step 1"      │
    │                                   │
    │ ALL PASSED → next()               │
    └───────────────────────────────────┘
                    │
                    ▼
    ┌───────────────────────────────────┐
    │ routes/views.js                   │
    │ GET /final.html                   │
    ├───────────────────────────────────┤
    │ 1. Generate new challenge         │
    │ 2. Save to MongoDB                │
    │ 3. Inject INITIAL_CHALLENGE       │
    │ 4. Send HTML                      │
    └───────────────────────────────────┘
```

---

### Phase 6: User Completes Step 2

```
User hits target on Step 2
                    │
                    ▼
    ┌───────────────────────────────────┐
    │ POST /api/step2/validate          │
    │ routes/views.js                   │
    ├───────────────────────────────────┤
    │ Payload:                          │
    │ - challengeId, linkId             │
    │ - angle, power, dragDuration      │
    │ - dragPath, screen dimensions     │
    ├───────────────────────────────────┤
    │ CHECK 1: Challenge Exists         │
    │ - BasketballChallenge.findOne()   │
    │                                   │
    │ CHECK 2: Session Exists           │
    │ - AccessSession.findOne()         │
    │ - { ip, activeLinkId: linkId }    │
    │                                   │
    │ CHECK 3: Completion Ticket        │
    │ - Step1Completion.findOne()       │
    │ - { ip, linkId }                  │
    │ - If missing → 403                │
    │                                   │
    │ CHECK 4: Anti-Speedrun            │
    │ - (now - session.createdAt) > 10s │
    │ - If too fast → 403               │
    │   "Too fast! Please try again."   │
    │                                   │
    │ CHECK 5: Human Validation         │
    │ - validateDragPath()              │
    │ - validateBasketballShot()        │
    │                                   │
    │ ALL PASSED:                       │
    │ 1. Find Link → get targetUrl      │
    │ 2. DELETE completion ticket       │
    │ 3. Update session → COMPLETED     │
    │ 4. DELETE challenge               │
    │ 5. Return { destination: url }    │
    └───────────────────────────────────┘
```

---

## 🔒 Security Checkpoints Summary

| Checkpoint             | Location                  | What It Checks                   |
| ---------------------- | ------------------------- | -------------------------------- |
| **IP Binding**         | All models                | Every record includes `req.ip`   |
| **Session Token**      | views.js, basketball.js   | Random 13-char token per session |
| **Referer Header**     | shield.js                 | Must have valid origin           |
| **LinkId Chain**       | All routes                | Same linkId from start to finish |
| **Completion Ticket**  | shield.js, views.js       | One-time use, IP-bound           |
| **Anti-Speedrun**      | views.js (step2/validate) | Minimum 10 seconds elapsed       |
| **User Agent**         | shield.js                 | Optional fingerprint match       |
| **Physics Validation** | basketball.js             | Simulates trajectory             |
| **Drag Path Analysis** | security.js               | Detects bot-like patterns        |

---

## 🗑️ Auto-Cleanup (TTL Indexes)

| Collection          | TTL    | Purpose                  |
| ------------------- | ------ | ------------------------ |
| AccessSession       | 15 min | Prevent stale sessions   |
| BasketballChallenge | 15 min | Expire unused challenges |
| Step1Completion     | 15 min | Tickets expire if unused |

---

## ⚠️ Error Responses

| Code | Message                        | Cause                   |
| ---- | ------------------------------ | ----------------------- |
| 400  | Missing link identifier        | No `?id=` on Step 2     |
| 403  | Direct access not allowed      | No Referer header       |
| 403  | Access denied. Step 1 required | No completion ticket    |
| 403  | Too fast!                      | Anti-speedrun triggered |
| 403  | Abnormal behavior detected     | Failed drag path check  |
| 403  | Verification failed            | Physics check failed    |
| 404  | Challenge expired              | Challenge TTL expired   |
| 404  | Link not found                 | Invalid linkId          |
| 500  | Internal Server Error          | MongoDB/server issue    |

---

## 🔧 MongoDB Connection (config/db.js)

```
Options:
- serverSelectionTimeoutMS: 15000
- connectTimeoutMS: 15000
- socketTimeoutMS: 45000
- maxPoolSize: 10
- heartbeatFrequencyMS: 10000
- retryWrites: true
- w: 'majority'

Retry Logic:
- 5 attempts with 2s delay between each
- await connectDB() called before every route
```

---

## 📝 Key Files Reference

| File                   | Purpose                            |
| ---------------------- | ---------------------------------- |
| `server.js`            | Main entry, route registration     |
| `routes/views.js`      | Page delivery + Step 2 validation  |
| `routes/basketball.js` | Challenge init + Step 1 validation |
| `routes/generator.js`  | Link creation API                  |
| `middleware/shield.js` | Step 2 access protection           |
| `utils/physics.js`     | Shot trajectory simulation         |
| `utils/security.js`    | Drag path validation               |
| `utils/shortener.js`   | External shortener integration     |
| `config/db.js`         | MongoDB connection management      |

---

_Last Updated: January 2026_
