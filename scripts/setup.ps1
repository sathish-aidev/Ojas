# Run once after cloning — requires Docker Desktop running
Write-Host "Starting PostgreSQL..." -ForegroundColor Cyan
docker compose up -d

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example" -ForegroundColor Green
}

Write-Host "Installing dependencies..." -ForegroundColor Cyan
npm install

Write-Host "Pushing database schema..." -ForegroundColor Cyan
npm run db:push

Write-Host "Seeding demo data..." -ForegroundColor Cyan
npm run db:seed

Write-Host ""
Write-Host "Setup complete! Run: npm run dev" -ForegroundColor Green
Write-Host "Login: owner@impackt.gym / password123" -ForegroundColor Yellow
