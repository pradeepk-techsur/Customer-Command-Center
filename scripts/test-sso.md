# SSO Testing Guide

## Quick Start

### 1. Verify Configuration
```bash
npx tsx scripts/verify-azure-config.ts
```

If configuration incomplete, follow the output instructions.

---

## Testing Checklist

### ✅ Prerequisites
- [ ] Azure AD app registered
- [ ] `.env` configured with Azure credentials
- [ ] JWT secrets generated
- [ ] API restarted: `docker compose restart api`

### ✅ Phase 1: Basic SSO (10 min)
- [ ] Click "Sign in with Microsoft" → Redirects to Microsoft
- [ ] First login with new account → User auto-created as PM
- [ ] Check database: `azure_oid` populated
- [ ] Logout and login again → Works instantly

### ✅ Phase 2: Token Handling (20 min)
- [ ] Wait 15 min → Action still works (token refreshes)
- [ ] Multiple browsers → Independent sessions
- [ ] Token tampering → Rejected with 401

### ✅ Phase 3: RBAC Integration (15 min)
- [ ] PM sees all call orders
- [ ] Customer sees only assigned call orders
- [ ] Admin can edit SSO user roles/assignments

### ✅ Phase 4: Edge Cases (10 min)
- [ ] Suspend user → Logged out on next action
- [ ] Cancel Microsoft login → Error message shown
- [ ] Invalid config → 503 error with clear message

---

## Manual Tests

### Test 1: First-Time PM Login
1. Open http://localhost:5173/login
2. Click "Sign in with Microsoft"
3. Login with Microsoft account from TechSur tenant
4. Verify: Redirected to portal, role badge shows "PM"
5. Database check:
   ```sql
   SELECT id, email, name, role, auth_provider, azure_oid
   FROM users WHERE email = 'yourname@techsur.com';
   ```
   Expected: `role='pm'`, `auth_provider='microsoft'`, `azure_oid` not null

### Test 2: Token Refresh
1. Login via SSO
2. In browser console, check token expiry:
   ```js
   const token = localStorage.getItem('accessToken');
   const payload = JSON.parse(atob(token.split('.')[1]));
   console.log('Expires:', new Date(payload.exp * 1000));
   ```
3. Wait 15 minutes
4. Navigate to any tab (e.g., Financials)
5. Open DevTools → Network tab
6. Verify: See `/api/auth/refresh` call → 200 response
7. Action completes successfully without logout

### Test 3: Customer RBAC
1. Login as admin
2. Create customer user with Microsoft email
3. Assign to 2 specific call orders
4. Logout, login as that customer via Microsoft
5. Verify: Only 2 call orders visible in register
6. Try accessing unassigned call order:
   ```bash
   curl http://localhost:3000/api/call-orders/Call_X.X/spend \
     -H "Authorization: Bearer <token>" \
     -X PATCH \
     -H "Content-Type: application/json" \
     -d '{"spend": 50000}'
   ```
   Expected: 403 Forbidden

---

## Database Queries

### Check SSO Users
```sql
SELECT id, email, name, role, auth_provider, azure_oid, last_login_at
FROM users
WHERE auth_provider = 'microsoft'
ORDER BY last_login_at DESC;
```

### Check Active Sessions
```sql
SELECT u.email, s.created_at, s.expires_at, 
       s.expires_at > now() AS is_active
FROM sessions s
JOIN users u ON u.id = s.user_id
ORDER BY s.created_at DESC
LIMIT 10;
```

### Check User Assignments
```sql
SELECT u.email, u.role, co.name AS call_order, uco.assigned_at
FROM users u
LEFT JOIN user_call_orders uco ON uco.user_id = u.id
LEFT JOIN call_orders co ON co.id = uco.call_order_id
WHERE u.auth_provider = 'microsoft'
ORDER BY u.email, co.name;
```

---

## Troubleshooting

### "Microsoft authentication not configured"
**Cause**: Missing Azure env vars  
**Fix**:
1. Check `.env` has AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
2. Restart API: `docker compose restart api`
3. Verify: `npx tsx scripts/verify-azure-config.ts`

### Stuck on loading screen after redirect
**Cause**: Tokens not extracted from URL  
**Debug**:
1. Check URL has `?accessToken=` and `refreshToken=`
2. Browser console for errors
3. API logs: `docker compose logs api -f`

### 403 "Access denied to call order"
**Cause**: Customer not assigned to call order  
**Fix**:
1. Login as admin
2. Edit customer user
3. Check call order assignments
4. Save and re-test

### Token refresh fails
**Cause**: Session expired or deleted  
**Debug**:
```sql
SELECT * FROM sessions 
WHERE user_id = (SELECT id FROM users WHERE email = 'your@email.com')
ORDER BY created_at DESC;
```
**Fix**: If no active session, re-login required

---

## Success Criteria

### ✅ Must Pass
- [ ] First-time PM login creates user automatically
- [ ] Repeat login updates `last_login_at`
- [ ] Token refresh works without logout
- [ ] PM sees all call orders
- [ ] Customer sees only assigned call orders
- [ ] Admin can manage SSO users

### ✅ Should Pass
- [ ] Email account migration preserves user ID
- [ ] Concurrent sessions work independently
- [ ] OAuth cancellation handled gracefully
- [ ] Suspended users blocked immediately

---

## Production Notes

**Current Implementation Status:**
- ✅ OAuth 2.0 authorization code flow
- ✅ User auto-provisioning (PMs) and account linking
- ✅ JWT access + refresh tokens
- ✅ Token auto-refresh on expiry
- ✅ RBAC integration (customers see assigned call orders only)
- ✅ Session management (database-backed)

**Known Limitations:**
- ⚠️ State parameter not validated (CSRF protection TODO)
- ⚠️ SSO endpoints not rate-limited
- ⚠️ Session cleanup not scheduled
- ⚠️ Logout doesn't sign out from Microsoft

**Recommendation**: Address limitations before production or document as acceptable risks.
