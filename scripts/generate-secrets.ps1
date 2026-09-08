# Generate JWT secrets for .env file
# Run: .\scripts\generate-secrets.ps1

Write-Host "`n🔑 Generating JWT Secrets for SSO Configuration`n" -ForegroundColor Cyan
Write-Host ("=" * 60) -ForegroundColor Gray

# Generate two random secrets using .NET crypto
Add-Type -AssemblyName System.Security
$rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider

function New-Secret {
    $bytes = New-Object byte[] 32
    $rng.GetBytes($bytes)
    return [Convert]::ToBase64String($bytes)
}

$jwtSecret = New-Secret
$sessionSecret = New-Secret

Write-Host "`nGenerated Secrets:" -ForegroundColor Green
Write-Host "`nJWT_SECRET=$jwtSecret" -ForegroundColor Yellow
Write-Host "SESSION_SECRET=$sessionSecret" -ForegroundColor Yellow

Write-Host "`n📝 Copy these values to your .env file:" -ForegroundColor Cyan
Write-Host "   Replace 'your-jwt-secret-here-change-in-production'" -ForegroundColor Gray
Write-Host "   Replace 'your-session-secret-here-change-in-production'" -ForegroundColor Gray

Write-Host "`n" + ("=" * 60) -ForegroundColor Gray
Write-Host ""
