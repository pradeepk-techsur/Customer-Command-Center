# Azure AD Setup Guide

This guide walks through registering the Contract Transparency Portal in Azure AD to enable Microsoft authentication for TechSur Project Managers.

## Prerequisites

- Access to TechSur's Azure Portal with permissions to register applications
- Admin consent permissions for the TechSur tenant

## Step 1: Register Application in Azure Portal

1. Navigate to [Azure Portal](https://portal.azure.com)
2. Go to **Azure Active Directory** → **App registrations** → **New registration**
3. Fill in the registration form:
   - **Name**: `Contract Transparency Portal`
   - **Supported account types**: `Accounts in this organizational directory only (TechSur only - Single tenant)`
   - **Redirect URI**: 
     - Type: `Web`
     - URI: `http://localhost:3000/api/auth/microsoft/callback` (for development)
     - For production, add: `https://your-production-domain.com/api/auth/microsoft/callback`
4. Click **Register**

## Step 2: Configure API Permissions

1. In your app registration, go to **API permissions**
2. Click **Add a permission** → **Microsoft Graph** → **Delegated permissions**
3. Add the following permissions:
   - ✅ `openid` (Sign users in)
   - ✅ `profile` (View users' basic profile)
   - ✅ `email` (View users' email address)
   - ✅ `User.Read` (Sign in and read user profile)
4. Click **Add permissions**
5. Click **Grant admin consent for TechSur** (requires admin)
6. Confirm the consent prompt

## Step 3: Create Client Secret

1. Go to **Certificates & secrets** → **Client secrets**
2. Click **New client secret**
3. Add description: `Contract Portal Secret`
4. Set expiration: `24 months` (recommended)
5. Click **Add**
6. **IMPORTANT**: Copy the secret **Value** immediately (shown only once)
   - This is your `AZURE_CLIENT_SECRET`
   - Store it securely - you cannot retrieve it again

## Step 4: Get Configuration Values

From the app registration **Overview** page, copy:

1. **Application (client) ID** → This is your `AZURE_CLIENT_ID`
2. **Directory (tenant) ID** → This is your `AZURE_TENANT_ID`

## Step 5: Update Environment Variables

Add these values to your `.env` file:

```env
# Azure AD Configuration
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_SECRET=your-secret-value-from-step-3
AZURE_REDIRECT_URI=http://localhost:3000/api/auth/microsoft/callback
```

**For production**, update the redirect URI:
```env
AZURE_REDIRECT_URI=https://your-domain.com/api/auth/microsoft/callback
```

## Step 6: Add Production Redirect URI

When deploying to production:

1. Go back to your Azure app registration
2. Navigate to **Authentication** → **Platform configurations** → **Web**
3. Click **Add URI** under **Redirect URIs**
4. Add: `https://your-production-domain.com/api/auth/microsoft/callback`
5. Click **Save**

## Step 7: Test the Configuration

Run the test script to verify configuration:

```powershell
docker exec customer-command-center-api-1 npx tsx server/test-azure-auth.ts
```

Expected output:
```
✅ Tenant ID: ✓
✅ Client ID: ✓
✅ Client Secret: ✓
✅ Auth URL generated successfully
```

## Step 8: Test Full OAuth Flow

1. Start the application: `docker-compose up`
2. Navigate to: `http://localhost:5173`
3. Click **Sign in with Microsoft**
4. You should be redirected to Microsoft login
5. After authentication, you should be redirected back with a session

## Troubleshooting

### "AADSTS50011: The reply URL specified in the request does not match..."

**Solution**: Ensure the redirect URI in Azure matches exactly (including `http://` vs `https://`, trailing slashes, ports)

### "AADSTS700016: Application not found in directory..."

**Solution**: 
- Verify `AZURE_TENANT_ID` is correct
- Ensure app is registered in the correct Azure tenant
- Check that you're using the TechSur tenant, not personal Microsoft account

### "AADSTS65001: The user or administrator has not consented..."

**Solution**: 
- Go to app registration → API permissions
- Click "Grant admin consent for TechSur"
- Or have users consent individually (less preferred)

### "Invalid client secret"

**Solution**: 
- Client secret may have expired (check expiration date in Azure)
- Generate a new secret and update `.env` file
- Ensure secret was copied correctly (no extra spaces/newlines)

### Users not getting 'pm' role

**Solution**: 
- Azure-authenticated users automatically get `pm` role
- Check `users` table in database: `docker exec customer-command-center-db-1 psql -U postgres -d contract_portal -c "select email, role, auth_provider from users;"`
- If wrong role, update manually or adjust `getOrCreateUser()` logic in `server/azure-auth.ts`

## Security Best Practices

1. **Rotate Secrets Regularly**: Set reminders to rotate client secrets before expiration
2. **Use Separate Registrations**: Create separate app registrations for dev/staging/production
3. **Restrict Permissions**: Only request the minimum required API permissions
4. **Monitor Sign-ins**: Regularly review Azure AD sign-in logs for suspicious activity
5. **Enable MFA**: Require multi-factor authentication for all TechSur accounts

## Additional Resources

- [Microsoft Identity Platform Documentation](https://docs.microsoft.com/en-us/azure/active-directory/develop/)
- [MSAL Node Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js/tree/dev/lib/msal-node)
- [Azure AD OAuth 2.0 Authorization Code Flow](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow)
