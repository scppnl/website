<#
.SYNOPSIS
    Links the project to its billing account again after the budget guard switched billing off.

.DESCRIPTION
    Only re-links billing and checks the result. It does not touch the budget: the amount is
    owned by Terraform (variable monthly_budget_eur, see README.md in this folder).

    If this month's spend is still at or above the budget, the guard switches billing off
    again at the next budget notification (usually within a few hours). Either wait for the
    new month, or raise the budget for this month first:

        terraform -chdir=infra/billing-guard apply -var=monthly_budget_eur=40

    Anything that was shut down while billing was off (for example Compute Engine VMs)
    stays off and has to be started again by hand.

.PARAMETER BillingAccount
    Billing account ID. Defaults to the TF_VAR_billing_account environment variable.

.PARAMETER ProjectId
    Project to link. Defaults to websites-514515.

.EXAMPLE
    .\infra\billing-guard\Enable-ProjectBilling.ps1
#>
[CmdletBinding()]
param(
    [string]$BillingAccount = $env:TF_VAR_billing_account,
    [string]$ProjectId = "websites-514515"
)

# gcloud writes harmless warnings to stderr, which PowerShell would treat as fatal errors
# under $ErrorActionPreference = 'Stop', so the exit code is checked instead.
function Invoke-Gcloud {
    param([string[]]$Arguments)

    $output = & gcloud $Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "gcloud $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
    }
    return $output
}

if ([string]::IsNullOrWhiteSpace($BillingAccount)) {
    throw "No billing account. Pass -BillingAccount, or set `$env:TF_VAR_billing_account. List your accounts with: gcloud billing accounts list"
}
if ($BillingAccount -notmatch '^[0-9A-F]{6}-[0-9A-F]{6}-[0-9A-F]{6}$') {
    throw "'$BillingAccount' does not look like a billing account ID (for example 012345-6789AB-CDEF01)."
}

Write-Host "Project:         $ProjectId"
Write-Host "Billing account: $BillingAccount"
Write-Host ""

$enabled = Invoke-Gcloud @('billing', 'projects', 'describe', $ProjectId, '--format=value(billingEnabled)')

if ($enabled -eq 'True') {
    Write-Host "Billing is already enabled; nothing to do."
    return
}

Write-Host "Billing is disabled. Linking the billing account..."
Invoke-Gcloud @('billing', 'projects', 'link', $ProjectId, "--billing-account=$BillingAccount") | Out-Null

$enabled = Invoke-Gcloud @('billing', 'projects', 'describe', $ProjectId, '--format=value(billingEnabled)')
if ($enabled -ne 'True') {
    throw "Billing still reports as disabled after linking. Check the project under Billing in the Cloud Console."
}

Write-Host "Billing is enabled again."
Write-Host ""
Write-Host "Reminder: if this month's spend is at or above the budget, the guard switches billing off again"
Write-Host "at the next budget notification. Raise the budget for this month with Terraform, or wait for the 1st."
