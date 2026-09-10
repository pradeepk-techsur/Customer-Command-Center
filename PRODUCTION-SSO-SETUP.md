# Production SSO Configuration Guide

Complete instructions for configuring Microsoft Azure AD Single Sign-On (SSO) for the Contract Transparency Portal in a production environment.

## Overview

This guide covers:
- Azure AD app registration for production
- Environment configuration
- DNS and SSL requirements
- Security best practices
- Testing and validation

---

## Prerequisites

Before starting, ensure you have:

✅ **Azure Access**: Administrator permissions in TechSur's Azure Portal to register applications  
✅ **Production Domain**: Your production domain name (e.g., `portal.techsur.com`)  
✅ **SSL Certificate**: HTTPS enabled on your production domain  
✅ **Database Access**: PostgreSQL database deployed and accessible  
✅ **Deployment Platform**: Application deployed (Azure App Service, AWS, etc.)

---

## Part 1: Azure AD Application Registration

### Step 1: Create New App Registration

1. Navigate to [Azure Portal](https://portal.azure.com)
2. Go to **Azure Active Directory** → **App registrations**
3. Click **New registration**
4. Fill in the form:

   ```
   Name: Contract Transparency Portal - Production
   Supported account types: Accounts in this organizational directory only (TechSur only - Single tenant)
   
   Redirect URI:
   Platform: Web
   URI: https://your-production-domain.com/api/auth/microsoft/callback
   ```

   **Example:**
   ```
   URI: https://portal.techsur.com/api/auth/microsoft/callback
   ```

5. Click **Register**

### Step 2: Note Your Configuration IDs

From the **Overview** page, copy these values (you'll need them later):

```
Application (client) ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Directory (tenant) ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### Step 3: Configure API Permissions

1. In the left sidebar, click **API permissions**
2. Click **Add a permission** → **Microsoft Graph** → **Delegated permissions**
3. Select these permissions:
   - ✅ `openid` - Sign users in
   - ✅ `profile` - View users' basic profile
   - ✅ `email` - View users' email address
   - ✅ `User.Read` - Sign in and read user profile

4. Click **Add permissions**
5. Click **Grant admin consent for TechSur** (requires tenant admin)
6. Confirm the consent prompt

**Verification:** All permissions should show green checkmarks under "Status"

### Step 4: Create Client Secret

1. Go to **Certificates & secrets** → **Client secrets** tab
2. Click **New client secret**
3. Configure:
   ```
   Description: Production Portal Secret
   Expires: 24 months (recommended for production)
   ```
4. Click **Add**
5. **CRITICAL**: Copy the secret **Value** immediately
   - This value is shown **only once**
   - You cannot retrieve it later
   - Store it in a secure password manager

### Step 5: Configure Authentication Settings

1. Go to **Authentication** in the left sidebar
2. Under **Platform configurations** → **Web**, verify your redirect URI is listed:
   ```
   https://your-production-domain.com/api/auth/microsoft/callback
   ```

3. Under **Implicit grant and hybrid flows**, ensure these are **unchecked** (not needed):
   - ⬜ Access tokens
   - ⬜ ID tokens

4. Under **Advanced settings**:
   - Allow public client flows: **No**

5. Click **Save**

---

## Part 2: Production Environment Configuration

### Step 1: Create Production .env File

On your production server, create a `.env` file with these Azure configuration values:

```bash
# ============================================================================
# Azure AD / Microsoft Entra ID SSO Configuration
# ============================================================================

# Your organization's Azure tenant ID
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Application (client) ID from Azure app registration
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Client secret from Azure (handle with extreme care)
AZURE_CLIENT_SECRET=your-client-secret-value-here

# Production callback URL (MUST match Azure app registration exactly)
AZURE_REDIRECT_URI=https://your-production-domain.com/api/auth/microsoft/callback

# ============================================================================
# Authentication & Security
# ============================================================================

# Generate new secrets for production (DO NOT use development secrets!)
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

JWT_SECRET=<generate-new-64-char-hex-string>
SESSION_SECRET=<generate-new-64-char-hex-string>

# Token expiration (adjust based on your security requirements)
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# ============================================================================
# Server Configuration
# ============================================================================

# Production settings
NODE_ENV=production
PORT=3000

# Your production frontend URL
FRONTEND_URL=https://your-production-domain.com

# ============================================================================
# Database Configuration
# ============================================================================

# Production PostgreSQL connection
DATABASE_URL=postgres://username:password@your-db-host:5432/contract_portal

# ============================================================================
# Email Service (Optional - for password resets)
# ============================================================================

EMAIL_HOST=smtp.your-provider.com
EMAIL_PORT=587
EMAIL_USER=your-email@techsur.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@techsur.com
```

### Step 2: Generate Secure Secrets

**On your production server**, run these commands to generate secure random secrets:

```bash
# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate session secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy each generated value into your `.env` file.

### Step 3: Secure Your .env File

```bash
# Set restrictive permissions (Linux/Unix)
chmod 600 .env
chown root:root .env

# Verify it's not in version control
echo ".env" >> .gitignore
```

---

## Part 3: DNS and SSL Configuration

### DNS Configuration

Ensure your domain points to your production server:

```
Type: A Record
Name: portal (or @ for apex domain)
Value: <your-server-ip>
TTL: 3600
```

**Verify DNS propagation:**
```bash
nslookup portal.techsur.com
```

### SSL/TLS Certificate

Your production domain **must** use HTTPS. Options:

1. **Let's Encrypt** (free, automated):
   ```bash
   # Using certbot
   sudo certbot --nginx -d portal.techsur.com
   ```

2. **Commercial Certificate**: Purchase from CA (Digicert, GlobalSign, etc.)

3. **Cloud Provider**: Use Azure App Service SSL, AWS Certificate Manager, etc.

**Verify SSL:**
```bash
curl -I https://portal.techsur.com
# Should show: HTTP/2 200
```

---

## Part 4: Application Deployment

### Deploy Application

1. **Build your application:**
   ```bash
   # Build frontend
   npm run build
   
   # Verify build output
   ls -la dist/
   ```

2. **Deploy to production server** (method varies by platform)

3. **Start the application:**
   ```bash
   # Using PM2 (recommended)
   pm2 start npm --name "portal" -- start
   pm2 save
   
   # Or using systemd, Docker, etc.
   ```

4. **Verify application is running:**
   ```bash
   curl http://localhost:3000/api/health
   # Should return: {"status":"ok"}
   ```

---

## Part 5: Testing and Validation

### Step 1: Test Azure Configuration

Run the configuration test script:

```bash
# If using Docker
docker exec <container-name> npx tsx server/test-azure-auth.ts

# If running directly
npx tsx server/test-azure-auth.ts
```

**Expected output:**
```
✅ Tenant ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
✅ Client ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
✅ Client Secret: ✓ (configured)
✅ Redirect URI: https://portal.techsur.com/api/auth/microsoft/callback
✅ Configuration valid
```

### Step 2: Test Full SSO Flow

1. **Navigate to your production URL:**
   ```
   https://portal.techsur.com
   ```

2. **Click "Sign in with Microsoft"**

3. **You should be redirected to Microsoft login:**
   ```
   https://login.microsoftonline.com/...
   ```

4. **Enter TechSur credentials** (with MFA if enabled)

5. **Verify successful redirect back:**
   ```
   https://portal.techsur.com
   ```
   - Should be logged in
   - Should see your name in the header
   - Should have appropriate role (pm, program_manager, etc.)

6. **Check browser console** for any errors

7. **Verify role assignment:**
   ```bash
   # Check database
   docker exec <db-container> psql -U postgres -d contract_portal -c \
     "SELECT email, role, auth_provider FROM users WHERE email = 'your-email@techsur.com';"
   ```

### Step 3: Test Role-Based Access

As a TechSur Project Manager, verify:

- ✅ Can access Call Orders
- ✅ Can create/edit Weekly Reports
- ✅ Can view Monthly Reports
- ✅ Cannot access Admin panel (unless admin role)

---

## Part 6: Security Best Practices

### 1. Secret Management

**DO:**
- ✅ Use environment variables for all secrets
- ✅ Rotate client secrets every 12-24 months
- ✅ Use secret management services (Azure Key Vault, AWS Secrets Manager)
- ✅ Set calendar reminders for secret expiration

**DON'T:**
- ❌ Never commit secrets to version control
- ❌ Never share secrets via email or chat
- ❌ Never use development secrets in production

### 2. Access Control

- ✅ Enable Azure AD MFA for all TechSur accounts
- ✅ Restrict app registration to minimum required permissions
- ✅ Grant admin consent only to necessary API permissions
- ✅ Review Azure AD sign-in logs regularly

### 3. Certificate Management

- ✅ Use automated SSL renewal (Let's Encrypt certbot)
- ✅ Set up monitoring for certificate expiration
- ✅ Use strong cipher suites (TLS 1.2+)

### 4. Monitoring

Set up alerts for:
- Failed authentication attempts
- Token validation errors
- SSL certificate expiration
- Client secret expiration

---

## Part 7: Troubleshooting

### Error: "AADSTS50011: Reply URL mismatch"

**Problem:** The redirect URI doesn't match Azure registration

**Solution:**
1. Check exact URL in Azure app registration
2. Verify your `.env` file has matching URL:
   ```bash
   echo $AZURE_REDIRECT_URI
   # Must match Azure exactly (no trailing slash, correct protocol)
   ```
3. Common issues:
   - `http://` vs `https://`
   - Trailing slash: `/callback/` vs `/callback`
   - Port number included when not needed

### Error: "AADSTS700016: Application not found"

**Problem:** Client ID or Tenant ID is incorrect

**Solution:**
1. Verify `AZURE_CLIENT_ID` in Azure Portal → App registrations → Overview
2. Verify `AZURE_TENANT_ID` in Azure Portal → Azure Active Directory → Overview
3. Ensure you're using the production app registration (not development)

### Error: "AADSTS7000215: Invalid client secret"

**Problem:** Client secret expired or incorrect

**Solution:**
1. Go to Azure Portal → App registration → Certificates & secrets
2. Check expiration date of existing secret
3. Generate new secret if expired
4. Update `.env` file with new secret
5. Restart application

### Error: "AADSTS65001: Consent not granted"

**Problem:** Admin consent not granted for API permissions

**Solution:**
1. Azure Portal → App registration → API permissions
2. Click "Grant admin consent for TechSur"
3. Ensure all permissions show green checkmarks

### Users Assigned Wrong Role

**Problem:** TechSur users getting wrong role (not 'pm')

**Solution:**

1. Check role assignment logic in `server/azure-auth.ts`:
   ```typescript
   // Should automatically assign 'pm' role for Azure users
   const role = 'pm';
   ```

2. Manually update if needed:
   ```sql
   UPDATE users 
   SET role = 'pm' 
   WHERE email = 'user@techsur.com' AND auth_provider = 'microsoft';
   ```

### SSL/HTTPS Issues

**Problem:** Mixed content warnings or SSL errors

**Solution:**
1. Ensure `FRONTEND_URL` uses `https://`
2. Verify `AZURE_REDIRECT_URI` uses `https://`
3. Check SSL certificate validity:
   ```bash
   openssl s_client -connect portal.techsur.com:443 -servername portal.techsur.com
   ```

---

## Part 8: Post-Deployment Checklist

After completing setup, verify:

- [ ] Azure app registration created for production
- [ ] Client secret generated and stored securely
- [ ] Production `.env` file configured with all Azure values
- [ ] JWT and session secrets generated and unique for production
- [ ] DNS points to production server
- [ ] SSL certificate installed and valid
- [ ] Application deployed and running
- [ ] SSO test successful (can log in with Microsoft)
- [ ] Role assignment correct (TechSur users get 'pm' role)
- [ ] Monitoring and alerts configured
- [ ] Secret expiration reminders set
- [ ] Documentation updated with production URLs

---

## Part 9: Ongoing Maintenance

### Monthly Tasks

- Review Azure AD sign-in logs for suspicious activity
- Check application logs for authentication errors

### Quarterly Tasks

- Review and rotate secrets if security policy requires
- Update dependencies (npm audit)
- Review API permissions (remove unused)

### Annual Tasks

- Rotate client secret (before expiration)
- Review and update SSL certificates
- Security audit of authentication flow
- Test disaster recovery procedures

---

## Support and Resources

### Documentation
- [AZURE_SETUP.md](./AZURE_SETUP.md) - Detailed Azure configuration
- [AUTH_GUIDE.md](./AUTH_GUIDE.md) - Authentication architecture
- [README.md](./README.md) - General application documentation

### Microsoft Resources
- [Azure AD Documentation](https://docs.microsoft.com/en-us/azure/active-directory/)
- [Microsoft Identity Platform](https://docs.microsoft.com/en-us/azure/active-directory/develop/)
- [OAuth 2.0 Authorization Code Flow](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow)

### Emergency Contacts
- Azure Administrator: [Your Azure Admin Contact]
- DevOps Team: [Your DevOps Team Contact]
- Security Team: [Your Security Team Contact]

---

## Summary

You've now configured production SSO for the Contract Transparency Portal! 

**Key Points to Remember:**
1. Keep Azure client secrets secure and rotate regularly
2. Monitor for failed authentication attempts
3. Ensure SSL certificates don't expire
4. Test SSO flow after any infrastructure changes
5. Document any production-specific configuration changes

For questions or issues, refer to the troubleshooting section or contact your Azure administrator.
