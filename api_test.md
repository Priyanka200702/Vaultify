# Vaultify API Test Guide

This file records the quickest way to verify that the auth API is issuing and accepting JWTs in this workspace.

## What to test

1. Log in with the demo credentials.
2. Confirm the response contains an `accessToken` and `refreshToken`.
3. Use the `accessToken` against a protected route.
4. Confirm the protected route returns `200` and the user payload.

## Demo credentials

- Email: `demo@vaultify.dev`
- Password: `Demo@1234`

## Relevant files

- [apps/server/src/modules/auth/auth.controller.js](apps/server/src/modules/auth/auth.controller.js) - issues JWTs on login/register and returns the auth payload.
- [apps/server/src/modules/auth/auth.routes.js](apps/server/src/modules/auth/auth.routes.js) - exposes `/api/auth/login`, `/api/auth/register`, `/api/auth/me`, and other auth routes.
- [apps/server/src/middleware/auth.middleware.js](apps/server/src/middleware/auth.middleware.js) - wraps the shared JWT middleware with the server secret.
- [packages/auth/jwt.js](packages/auth/jwt.js) - signs and verifies JWTs.
- [packages/auth/middleware.js](packages/auth/middleware.js) - validates `Authorization: Bearer <token>` headers.

## Login request

Run this from PowerShell at the repo root:

```powershell
$body = @{ email = 'demo@vaultify.dev'; password = 'Demo@1234' } | ConvertTo-Json -Compress
$login = Invoke-RestMethod -Method Post -Uri 'http://localhost:3001/api/auth/login' -ContentType 'application/json' -Body $body
$login | ConvertTo-Json -Depth 6
```

Expected result:

- `message` should be `Login successful`
- `accessToken` should be present
- `refreshToken` should be present

## JWT validity check

Take the `accessToken` value and call the protected route:

```powershell
$token = 'PASTE_ACCESS_TOKEN_HERE'
Invoke-RestMethod -Method Get -Uri 'http://localhost:3001/api/auth/me' -Headers @{ Authorization = "Bearer $token" }
```

Expected result:

- HTTP `200`
- Response body should include a `user` object

If the token is invalid, expired, or signed with the wrong secret, the server returns HTTP `401` with `UNAUTHORIZED` or `TOKEN_INVALID`.

## Quick failure checks

- If the header is missing `Bearer`, the request fails auth.
- If the string is not a JWT with three dot-separated parts, it is not a valid access token for this server.
- If the server is not running on port `3001`, the request will fail before auth runs.

## Local verification shortcut

To inspect the token without hitting the API, use the shared verifier:

```powershell
node -e "const { verifyToken } = require('./packages/auth'); const token = 'PASTE_ACCESS_TOKEN_HERE'; const secret = process.env.JWT_SECRET || 'your-jwt-secret'; console.log(verifyToken(token, secret));"
```

## Notes

- The server route used for the live test is `/api/auth/me`.
- The login flow returns the JWT from the auth controller, not from the proxy token system.
- The demo user was already validated successfully in this workspace.