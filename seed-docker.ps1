# Load seed data into the database via Docker
Write-Host "Loading seed data into database..." -ForegroundColor Green
docker exec customer-command-center-api-1 npm run db:seed
Write-Host "Seed data loaded successfully!" -ForegroundColor Green
