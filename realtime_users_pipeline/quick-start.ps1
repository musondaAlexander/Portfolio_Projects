# Quick Start Script for Real-time User Pipeline
# This script automates the setup of the synthetic user ingestion pipeline

Write-Host "🚀 Real-time User Pipeline - Quick Start" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Step 1: Check Prerequisites
Write-Host "✓ Step 1: Checking prerequisites..." -ForegroundColor Yellow

# Check Docker containers
Write-Host "  Checking Docker containers..." -NoNewline
$containers = docker ps --format "{{.Names}}"
$requiredContainers = @("kestra", "analytics-postgres", "grafana")
$allRunning = $true

foreach ($container in $requiredContainers) {
    if ($containers -notcontains $container) {
        Write-Host " ❌" -ForegroundColor Red
        Write-Host "  ERROR: Container '$container' is not running" -ForegroundColor Red
        Write-Host "  Run: docker-compose up -d" -ForegroundColor Yellow
        $allRunning = $false
    }
}

if ($allRunning) {
    Write-Host " ✅" -ForegroundColor Green
} else {
    exit 1
}

# Check Kestra accessibility
Write-Host "  Checking Kestra accessibility..." -NoNewline
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8090/api/v1/health" -Method GET -ErrorAction Stop -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host " ✅" -ForegroundColor Green
    }
} catch {
    Write-Host " ❌" -ForegroundColor Red
    Write-Host "  ERROR: Cannot reach Kestra at http://localhost:8090" -ForegroundColor Red
    Write-Host "  Check if Kestra container is running: docker ps" -ForegroundColor Yellow
    exit 1
}

# Check Grafana accessibility
Write-Host "  Checking Grafana accessibility..." -NoNewline
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -Method GET -ErrorAction Stop -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host " ✅" -ForegroundColor Green
    }
} catch {
    Write-Host " ❌" -ForegroundColor Red
    Write-Host "  ERROR: Cannot reach Grafana at http://localhost:3000" -ForegroundColor Red
    exit 1
}

# Check PostgreSQL
Write-Host "  Checking PostgreSQL accessibility..." -NoNewline
try {
    $pgCheck = docker exec analytics-postgres pg_isready -U analytics_user 2>&1
    if ($pgCheck -like "*accepting connections*") {
        Write-Host " ✅" -ForegroundColor Green
    } else {
        Write-Host " ❌" -ForegroundColor Red
        Write-Host "  ERROR: PostgreSQL is not ready" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host " ❌" -ForegroundColor Red
    Write-Host "  ERROR: Cannot check PostgreSQL" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Deploy Kestra Workflow
Write-Host "✓ Step 2: Deploying Kestra workflow..." -ForegroundColor Yellow

$workflowPath = "kestra\synthetic_users_realtime.yml"
if (-not (Test-Path $workflowPath)) {
    Write-Host "  ❌ ERROR: Workflow file not found: $workflowPath" -ForegroundColor Red
    exit 1
}

Write-Host "  NOTE: Please upload the workflow manually:" -ForegroundColor Cyan
Write-Host "  1. Open: http://localhost:8090" -ForegroundColor White
Write-Host "  2. Login: musondaalexander97@gmail.com / Admin1234" -ForegroundColor White
Write-Host "  3. Go to: Flows → Create" -ForegroundColor White
Write-Host "  4. Copy content from: $workflowPath" -ForegroundColor White
Write-Host "  5. Click: Save" -ForegroundColor White
Write-Host ""
Write-Host "  Press Enter after uploading the workflow..." -ForegroundColor Yellow
Read-Host

# Step 3: Import Grafana Dashboard
Write-Host "✓ Step 3: Importing Grafana dashboard..." -ForegroundColor Yellow

$dashboardPath = "grafana\realtime_user_analytics.json"
if (-not (Test-Path $dashboardPath)) {
    Write-Host "  ❌ ERROR: Dashboard file not found: $dashboardPath" -ForegroundColor Red
    exit 1
}

Write-Host "  NOTE: Please import the dashboard manually:" -ForegroundColor Cyan
Write-Host "  1. Open: http://localhost:3000" -ForegroundColor White
Write-Host "  2. Login: admin / admin123" -ForegroundColor White
Write-Host "  3. Go to: Dashboards → Import" -ForegroundColor White
Write-Host "  4. Click: Upload JSON file" -ForegroundColor White
Write-Host "  5. Select: $dashboardPath" -ForegroundColor White
Write-Host "  6. Click: Import" -ForegroundColor White
Write-Host ""
Write-Host "  Press Enter after importing the dashboard..." -ForegroundColor Yellow
Read-Host

# Step 4: Trigger Initial Execution
Write-Host "✓ Step 4: Triggering initial workflow execution..." -ForegroundColor Yellow

Write-Host "  NOTE: Please trigger the workflow manually:" -ForegroundColor Cyan
Write-Host "  1. In Kestra UI, navigate to: demo.synthetic_users_realtime" -ForegroundColor White
Write-Host "  2. Click: Execute button" -ForegroundColor White
Write-Host "  3. Set batch_size: 10 (or leave default)" -ForegroundColor White
Write-Host "  4. Click: Execute" -ForegroundColor White
Write-Host ""
Write-Host "  Press Enter after triggering the workflow..." -ForegroundColor Yellow
Read-Host

Write-Host "  Waiting 30 seconds for workflow to complete..." -ForegroundColor Cyan
Start-Sleep -Seconds 30

# Step 5: Verification
Write-Host "`n✓ Step 5: Verifying setup..." -ForegroundColor Yellow

# Check database table
Write-Host "  Checking database table..." -NoNewline
try {
    $tableCheck = docker exec analytics-postgres psql -U analytics_user -d analytics -t -c "SELECT COUNT(*) FROM public.incoming_users;" 2>&1
    $count = [int]($tableCheck.Trim())
    if ($count -gt 0) {
        Write-Host " ✅ ($count users)" -ForegroundColor Green
    } else {
        Write-Host " ⚠️  (0 users - workflow may not have completed yet)" -ForegroundColor Yellow
        Write-Host "  Wait a few minutes and check Kestra execution logs" -ForegroundColor Yellow
    }
} catch {
    Write-Host " ❌" -ForegroundColor Red
    Write-Host "  ERROR: Cannot query database. Check if workflow created the table." -ForegroundColor Red
    Write-Host "  Run: docker exec -it analytics-postgres psql -U analytics_user -d analytics -c '\dt public.incoming_users'" -ForegroundColor Yellow
}

Write-Host ""

# Final Summary
Write-Host "🎉 Setup Complete!" -ForegroundColor Green
Write-Host "==================`n" -ForegroundColor Green

Write-Host "📊 Dashboard URL:" -ForegroundColor Cyan
Write-Host "   http://localhost:3000/d/realtime_users_001" -ForegroundColor White
Write-Host ""

Write-Host "⚙️  Workflow URL:" -ForegroundColor Cyan
Write-Host "   http://localhost:8090/ui/flows/demo/synthetic_users_realtime" -ForegroundColor White
Write-Host ""

Write-Host "📈 What happens next:" -ForegroundColor Cyan
Write-Host "   - Workflow runs automatically every 1 minute" -ForegroundColor White
Write-Host "   - 10 new users ingested per execution" -ForegroundColor White
Write-Host "   - Dashboard refreshes every 5 seconds" -ForegroundColor White
Write-Host ""

Write-Host "🔍 Monitoring:" -ForegroundColor Cyan
Write-Host "   - Check executions: http://localhost:8090/ui/executions" -ForegroundColor White
Write-Host "   - View logs: docker logs kestra -f" -ForegroundColor White
Write-Host "   - Query data: docker exec -it analytics-postgres psql -U analytics_user -d analytics" -ForegroundColor White
Write-Host ""

Write-Host "📚 Documentation:" -ForegroundColor Cyan
Write-Host "   - Setup Guide: docs\SETUP_GUIDE.md" -ForegroundColor White
Write-Host "   - Troubleshooting: docs\TROUBLESHOOTING.md" -ForegroundColor White
Write-Host "   - API Reference: docs\API_REFERENCE.md" -ForegroundColor White
Write-Host ""

Write-Host "✨ Enjoy your real-time user pipeline!" -ForegroundColor Green
