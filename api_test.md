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

## Vault Keys API

Test the vault key lifecycle: store, list, delete — and verify the delete-protection logic (block deletion when active tokens exist).

### Prerequisites

- Server running on `http://localhost:3001`
- Logged-in session with a valid `$token` from the Login Request above

### 1. Store a key

```powershell
$body = @{
  name = 'Test Key'
  provider = 'anthropic'
  environment = 'production'
  rawKey = 'sk-ant-test-key-12345'
} | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri 'http://localhost:3001/api/vault/keys' -ContentType 'application/json' -Body $body -Headers @{ Authorization = "Bearer $token" }
```

Expected:
- HTTP `201`
- `message`: `Key stored in vault`
- `key` contains: `_id`, `name`, `provider`, `environment`, `keyPrefix`

### 2. List keys

```powershell
$keys = Invoke-RestMethod -Method Get -Uri 'http://localhost:3001/api/vault/keys' -Headers @{ Authorization = "Bearer $token" }
$keys | ConvertTo-Json -Depth 6
```

Expected:
- HTTP `200`
- `keys` is an array with at least the key created in step 1
- Each key has `_id`, `name`, `provider`, `environment`, `keyPrefix` — **never** the raw key
- Copy the `_id` of a key for the delete step

### 3. Delete a key (with no active tokens)

```powershell
$keyId = 'PASTE_KEY_ID_HERE'
Invoke-RestMethod -Method Delete -Uri "http://localhost:3001/api/vault/keys/$keyId" -Headers @{ Authorization = "Bearer $token" }
```

Expected:
- HTTP `200`
- `message`: `Key deleted from vault`

### 4. Verify deletion

```powershell
$keys = Invoke-RestMethod -Method Get -Uri 'http://localhost:3001/api/vault/keys' -Headers @{ Authorization = "Bearer $token" }
$keys.keys | Where-Object { $_._id -eq $keyId }
```

Expected:
- The deleted key should no longer appear in the list

### 5. Error: delete non-existent key

```powershell
Invoke-RestMethod -Method Delete -Uri 'http://localhost:3001/api/vault/keys/000000000000000000000000' -Headers @{ Authorization = "Bearer $token" }
```

Expected:
- HTTP `404` with error message `Vault key not found`

### 6. Error: delete key that has active tokens

```powershell
# Step 6a: Store a fresh key first
$newKey = Invoke-RestMethod -Method Post -Uri 'http://localhost:3001/api/vault/keys' -ContentType 'application/json' -Body (@{ name = 'Delete-Protected Key'; provider = 'anthropic'; environment = 'production'; rawKey = 'sk-ant-protected-key' } | ConvertTo-Json -Compress) -Headers @{ Authorization = "Bearer $token" }
$newKeyId = $newKey.key._id

# Step 6b: Issue a token referencing that key
$tokenBody = @{ vaultKeyId = $newKeyId } | ConvertTo-Json -Compress
$issuedToken = Invoke-RestMethod -Method Post -Uri 'http://localhost:3001/api/tokens' -ContentType 'application/json' -Body $tokenBody -Headers @{ Authorization = "Bearer $token" }

# Step 6c: Try to delete the key — should cascade-delete the token too
Invoke-RestMethod -Method Delete -Uri "http://localhost:3001/api/vault/keys/$newKeyId" -Headers @{ Authorization = "Bearer $token" }

# Step 6d: Verify the token was also deleted
$allTokens = Invoke-RestMethod -Method Get -Uri 'http://localhost:3001/api/tokens?includeRevoked=true' -Headers @{ Authorization = "Bearer $token" }
$allTokens.tokens | Where-Object { $_.vaultKeyId -eq $newKeyId }
```

Expected:
- Step 6c: HTTP `200` with `message: 'Key deleted from vault'` and `deletedTokens: 1`
- Step 6d: No tokens should reference the deleted key (empty result)

### 7. Error: issue token referencing a non-existent key

```powershell
$badBody = @{ vaultKeyId = '000000000000000000000000' } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri 'http://localhost:3001/api/tokens' -ContentType 'application/json' -Body $badBody -Headers @{ Authorization = "Bearer $token" }
```

Expected:
- HTTP `400` or `404` with an error message that the vault key was not found

## Relevant files (vault keys)

- [apps/server/src/modules/vault/vault.controller.js](apps/server/src/modules/vault/vault.controller.js) — storeKey, listKeys, rotateKey, getKeyTokenCount, deleteKey
- [apps/server/src/modules/vault/vault.service.js](apps/server/src/modules/vault/vault.service.js) — business logic + encryption + cache + cascade delete
- [apps/server/src/modules/vault/vault.routes.js](apps/server/src/modules/vault/vault.routes.js) — routes: `POST/GET /api/vault/keys`, `GET /api/vault/keys/:id/tokens-count`, `PUT /api/vault/keys/:id/rotate`, `DELETE /api/vault/keys/:id`
- [packages/db/schemas/key.schema.js](packages/db/schemas/key.schema.js) — VaultKey schema (encryptedKey, keyPrefix, etc.)
- [apps/web/src/pages/MyKeys.jsx](apps/web/src/pages/MyKeys.jsx) — dashboard UI for managing vault keys

## Notes

- The server route used for the live test is `/api/auth/me`.
- The login flow returns the JWT from the auth controller, not from the proxy token system.
- The demo user was already validated successfully in this workspace.