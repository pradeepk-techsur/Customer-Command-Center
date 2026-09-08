# Authentication System Guide

## Overview

The Contract Transparency Portal uses a hybrid JWT-based authentication system with two authentication providers:

1. **Email/Password** - For external customers
2. **Microsoft Azure AD** - For TechSur Project Managers (SSO)

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
│  - Login forms (email/password, Microsoft button)                │
│  - Token storage (localStorage)                                  │
│  - Authorization header injection (Bearer <token>)               │
└─────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────┐
│                    API Server (Express)                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Authentication Middleware (auth-middleware.ts)           │  │
│  │  - Extracts Bearer token from Authorization header        │  │
│  │  - Validates JWT signature and expiry                     │  │
│  │  - Fetches user from database                             │  │
│  │  - Attaches req.user and req.actor                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Authorization Middleware                                 │  │
│  │  - requirePm: Only PMs and admins                         │  │
│  │  - requireAdmin: Only admins                              │  │
│  │  - requirePmOrAdmin: PMs or admins                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Auth Services                                            │  │
│  │  - auth-service.ts: JWT, bcrypt, sessions                 │  │
│  │  - azure-auth.ts: Azure AD OAuth 2.0                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                           │
│  - users: User accounts and profiles                             │
│  - sessions: Active JWT refresh tokens                           │
│  - password_resets: Password reset tokens                        │
│  - audit_log: User actions with user_id                          │
└─────────────────────────────────────────────────────────────────┘
```

## User Roles

| Role     | Description                          | Permissions                                    |
|----------|--------------------------------------|------------------------------------------------|
| customer | External contract customers          | Read-only access to call orders and reports    |
| pm       | TechSur Project Managers             | Full read/write access to portal data          |
| admin    | System administrators                | User management, audit logs, all PM permissions|

## Authentication Flow

### Email/Password Authentication

```mermaid
sequenceDiagram
    User->>Frontend: Enter email/password
    Frontend->>API: POST /api/auth/login
    API->>Database: Fetch user by email
    Database-->>API: User record
    API->>API: Verify password (bcrypt)
    API->>API: Generate JWT tokens
    API->>Database: Create session record
    API-->>Frontend: {accessToken, refreshToken, user}
    Frontend->>Frontend: Store tokens in localStorage
    Frontend->>Frontend: Set Authorization header
```

### Microsoft Authentication (Azure AD)

```mermaid
sequenceDiagram
    User->>Frontend: Click "Sign in with Microsoft"
    Frontend->>API: GET /api/auth/microsoft/login
    API->>Azure AD: Redirect to login
    Azure AD->>User: Microsoft login page
    User->>Azure AD: Enter credentials + MFA
    Azure AD->>API: Redirect with auth code
    API->>Azure AD: Exchange code for tokens
    Azure AD-->>API: ID token + profile
    API->>Database: Get or create user
    API->>API: Generate JWT tokens
    API->>Database: Create session record
    API-->>Frontend: Redirect with tokens
    Frontend->>Frontend: Store tokens
```

## JWT Token Structure

### Access Token (15 minutes expiry)
```json
{
  "userId": 1,
  "email": "pm@techsur.com",
  "role": "pm",
  "type": "access",
  "iat": 1693747200,
  "exp": 1693748100
}
```

### Refresh Token (7 days expiry)
```json
{
  "userId": 1,
  "email": "pm@techsur.com",
  "role": "pm",
  "type": "refresh",
  "iat": 1693747200,
  "exp": 1694352000
}
```

## Middleware Usage

### Protecting Routes

```typescript
import { authenticateRequest, requirePm, requireAdmin } from "./auth.ts";

// Require authentication (any role)
app.get("/api/portal", authenticateRequest, (req, res) => {
  // req.user is available here
  const userId = req.user!.id;
  const role = req.user!.role;
  // ...
});

// Require PM or admin role
app.post("/api/call-orders", authenticateRequest, requirePm, (req, res) => {
  // Only PMs and admins can access this
});

// Require admin role
app.get("/api/admin/users", authenticateRequest, requireAdmin, (req, res) => {
  // Only admins can access this
});

// Optional authentication (public endpoint with enhanced data for authenticated users)
import { optionalAuth } from "./auth.ts";

app.get("/api/public-data", optionalAuth, (req, res) => {
  if (req.user) {
    // Return enhanced data for authenticated users
  } else {
    // Return basic data for anonymous users
  }
});
```

### Audit Logging

The `actorOf()` function now uses authenticated user data:

```typescript
import { actorOf } from "./auth.ts";

async function audit(db, req, action, entity, entityId, details) {
  const actor = actorOf(req);
  await db.query(
    `insert into audit_log (actor, role, action, entity, entity_id, details, user_id)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [actor.name, actor.role, action, entity, entityId, details, actor.userId]
  );
}
```

## API Endpoints (Phase 5 - To Be Implemented)

### Authentication

| Method | Endpoint                            | Description                      |
|--------|-------------------------------------|----------------------------------|
| POST   | /api/auth/register                  | Register new customer account    |
| POST   | /api/auth/login                     | Email/password login             |
| POST   | /api/auth/logout                    | Invalidate session               |
| GET    | /api/auth/me                        | Get current user                 |
| POST   | /api/auth/refresh                   | Refresh access token             |
| POST   | /api/auth/password-reset/request    | Request password reset email     |
| POST   | /api/auth/password-reset/confirm    | Confirm password reset           |
| GET    | /api/auth/microsoft/login           | Redirect to Microsoft login      |
| GET    | /api/auth/microsoft/callback        | Handle OAuth callback            |

### Admin User Management

| Method | Endpoint                            | Description                      |
|--------|-------------------------------------|----------------------------------|
| GET    | /api/admin/users                    | List all users                   |
| POST   | /api/admin/users                    | Create user                      |
| PATCH  | /api/admin/users/:id                | Update user                      |
| DELETE | /api/admin/users/:id                | Delete user                      |
| POST   | /api/admin/users/:id/reset-password | Force password reset             |

## Security Best Practices

### Token Storage
- ✅ Store access token in memory (React state)
- ✅ Store refresh token in httpOnly cookie (most secure) or localStorage (convenience)
- ❌ Never store tokens in sessionStorage or regular cookies without httpOnly flag

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Token Expiry
- Access tokens: 15 minutes (short-lived for security)
- Refresh tokens: 7 days (stored in database for revocation)
- Password reset tokens: 1 hour

### Rate Limiting (Phase 5)
```typescript
import rateLimit from "express-rate-limit";

// Login rate limiting
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: "Too many login attempts, please try again later"
});

app.post("/api/auth/login", loginLimiter, async (req, res) => {
  // ...
});
```

## Testing

### Run Middleware Tests
```powershell
docker exec customer-command-center-api-1 npx tsx server/test-auth-middleware.ts
```

### Manual Testing with curl

#### Get access token
```bash
# Login as PM
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"pm@techsur.com","password":"password123"}'

# Response: {"accessToken":"eyJ...","refreshToken":"eyJ...","user":{...}}
```

#### Use access token
```bash
curl http://localhost:3000/api/portal \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

#### Expected responses
```bash
# 401 Unauthorized - Missing or invalid token
{"error":"Authentication required","message":"..."}

# 403 Forbidden - Insufficient permissions
{"error":"Insufficient permissions","message":"Only Project Managers can modify portal data"}

# 200 OK - Success
{"data":{...}}
```

## Migration from Mock Auth

The system currently supports both JWT authentication and legacy mock headers for backward compatibility:

```typescript
// Legacy (mock) - DEPRECATED, will be removed
headers: {
  'x-portal-role': 'pm',
  'x-portal-user': 'John Doe'
}

// New (JWT) - PREFERRED
headers: {
  'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
}
```

**Migration Steps:**
1. ✅ Phase 4 Complete: Authentication middleware implemented
2. Phase 5: Add authentication API endpoints
3. Phase 6: Update frontend to use JWT authentication
4. Phase 7: Remove legacy header support from `actorOf()`

## Troubleshooting

### "Authentication required"
- **Cause**: No Authorization header or invalid Bearer token
- **Solution**: Ensure requests include `Authorization: Bearer <token>` header

### "Token is invalid, expired, or malformed"
- **Cause**: JWT signature verification failed or token expired
- **Solution**: Refresh token or re-authenticate

### "User not found or inactive"
- **Cause**: User account deleted or status set to 'inactive'/'suspended'
- **Solution**: Check user status in database: `select * from users where id = X`

### "Insufficient permissions"
- **Cause**: User role doesn't have permission for this endpoint
- **Solution**: Verify user role matches endpoint requirements (customer/pm/admin)

## Environment Variables

Required for authentication:
```env
# JWT Configuration
JWT_SECRET=your-secret-key-here-minimum-32-chars
SESSION_SECRET=your-session-secret-here-minimum-32-chars
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# Azure AD (for Microsoft auth)
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_SECRET=your-secret-from-azure-portal
AZURE_REDIRECT_URI=http://localhost:3000/api/auth/microsoft/callback

# Email (for password resets)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@example.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@techsur.com

# Frontend
FRONTEND_URL=http://localhost:5173
```

## Files Reference

| File                        | Purpose                                        |
|-----------------------------|------------------------------------------------|
| server/auth.ts              | Re-exports from auth-middleware (compatibility)|
| server/auth-middleware.ts   | JWT validation, role-based authorization       |
| server/auth-service.ts      | Bcrypt, JWT, session management utilities      |
| server/azure-auth.ts        | Azure AD OAuth 2.0 integration                 |
| server/schema.sql           | Database tables (users, sessions, etc.)        |
| .env.example                | Environment variable template                  |
| AUTH_GUIDE.md               | This file                                      |
| AZURE_SETUP.md              | Azure Portal setup guide                       |
