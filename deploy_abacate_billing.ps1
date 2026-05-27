param(
    [string]$ProjectRef = "avlefzsipbqvollukgyt",
    [string]$DbPassword,
    [string]$AbacateApiKey = $env:ABACATE_API_KEY,
    [string]$AbacateWebhookSecret = $env:ABACATE_WEBHOOK_SECRET,
    [string]$AbacateWebhookPublicKey = $env:ABACATE_WEBHOOK_PUBLIC_KEY,
    [switch]$SkipDbPush
)

$ErrorActionPreference = "Stop"

function Invoke-Step {
    param(
        [string]$Label,
        [scriptblock]$Action
    )

    Write-Host ""
    Write-Host "==> $Label" -ForegroundColor Cyan
    & $Action
}

Invoke-Step "Verificando acesso ao projeto Supabase" {
    npx supabase link --project-ref $ProjectRef --yes | Out-Host
}

if (-not $SkipDbPush) {
    if (-not $DbPassword) {
        throw "Informe -DbPassword para aplicar as migrations remotas ou rode com -SkipDbPush."
    }

    Invoke-Step "Aplicando migrations remotas" {
        npx supabase db push --password $DbPassword --include-all | Out-Host
    }
}

if (-not $AbacateApiKey -or -not $AbacateWebhookSecret) {
    throw "Defina ABACATE_API_KEY e ABACATE_WEBHOOK_SECRET no ambiente ou passe pelos parametros."
}

Invoke-Step "Atualizando secrets das Edge Functions" {
    npx supabase secrets set `
        "ABACATE_API_KEY=$AbacateApiKey" `
        "ABACATE_WEBHOOK_SECRET=$AbacateWebhookSecret" `
        "ABACATE_WEBHOOK_PUBLIC_KEY=$AbacateWebhookPublicKey" `
        --project-ref $ProjectRef | Out-Host
}

Invoke-Step "Deploy da function abacate-create-pix-checkout" {
    npx supabase functions deploy abacate-create-pix-checkout --project-ref $ProjectRef --use-api --no-verify-jwt | Out-Host
}

Invoke-Step "Deploy da function abacate-create-subscription-checkout" {
    npx supabase functions deploy abacate-create-subscription-checkout --project-ref $ProjectRef --use-api --no-verify-jwt | Out-Host
}

Invoke-Step "Deploy da function abacate-cancel-subscription" {
    npx supabase functions deploy abacate-cancel-subscription --project-ref $ProjectRef --use-api --no-verify-jwt | Out-Host
}

Invoke-Step "Deploy da function abacate-webhook" {
    npx supabase functions deploy abacate-webhook --project-ref $ProjectRef --use-api --no-verify-jwt | Out-Host
}

Invoke-Step "Deploy da function abacate-runtime-diagnostic" {
    npx supabase functions deploy abacate-runtime-diagnostic --project-ref $ProjectRef --use-api --no-verify-jwt | Out-Host
}

Write-Host ""
Write-Host "Concluido." -ForegroundColor Green
Write-Host "Configure no AbacatePay este endpoint de webhook:" -ForegroundColor Yellow
Write-Host "https://$ProjectRef.supabase.co/functions/v1/abacate-webhook?webhookSecret=$AbacateWebhookSecret"
Write-Host ""
Write-Host "Eventos minimos:"
Write-Host "- transparent.completed"
Write-Host "- checkout.completed"
Write-Host "- subscription.completed"
Write-Host "- subscription.renewed"
Write-Host "- subscription.cancelled"
