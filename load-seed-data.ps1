#!/usr/bin/env pwsh
# Load seed data into the Contract Transparency Portal database
# This script executes the seed command inside the Docker API container

Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "Loading Seed Data" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
try {
    docker ps | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Docker is not running. Please start Docker Desktop and try again." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Docker command not found. Please install Docker and try again." -ForegroundColor Red
    exit 1
}

# Check if API container is running
$apiContainer = docker ps --filter "name=customer-command-center-api-1" --format "{{.Names}}"
if (-not $apiContainer) {
    Write-Host "❌ API container is not running." -ForegroundColor Red
    Write-Host "   Run: docker compose up -d" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Docker is running" -ForegroundColor Green
Write-Host "✅ API container found: $apiContainer" -ForegroundColor Green
Write-Host ""

# Execute seed command
Write-Host "Loading seed data..." -ForegroundColor Yellow
docker exec $apiContainer npm run db:seed

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "====================================" -ForegroundColor Green
    Write-Host "✅ Seed Data Loaded Successfully!" -ForegroundColor Green
    Write-Host "====================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "The database now contains:" -ForegroundColor Cyan
    Write-Host "  • 10 call orders" -ForegroundColor White
    Write-Host "  • 35+ staff members" -ForegroundColor White
    Write-Host "  • Labor categories" -ForegroundColor White
    Write-Host "  • 1 weekly report" -ForegroundColor White
    Write-Host "  • 1 monthly report (June 2026)" -ForegroundColor White
    Write-Host ""
    Write-Host "Refresh your browser at http://localhost:5173 to see the data!" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Failed to load seed data" -ForegroundColor Red
    Write-Host "Check the error messages above for details." -ForegroundColor Yellow
    exit 1
}
