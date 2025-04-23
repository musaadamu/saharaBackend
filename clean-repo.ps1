# PowerShell script to clean up sensitive information from the repository
# Run this script from the root of your repository

Write-Host "Sahara Journal Repository Cleanup Script" -ForegroundColor Green
Write-Host "This script will help you clean up sensitive information from your Git repository." -ForegroundColor Yellow
Write-Host "IMPORTANT: This will modify your Git history. Make sure you have a backup before proceeding." -ForegroundColor Red
Write-Host ""

# Check if git is installed
try {
    git --version | Out-Null
} catch {
    Write-Host "Git is not installed or not in your PATH. Please install Git and try again." -ForegroundColor Red
    exit 1
}

# Function to check if a file exists in the repository
function Test-GitFile {
    param (
        [string]$FilePath
    )
    
    $result = git ls-files $FilePath 2>$null
    return $result -ne $null -and $result -ne ""
}

# Remove sensitive files from the current commit
Write-Host "Step 1: Removing sensitive files from the current working directory..." -ForegroundColor Cyan

# List of files to check and remove
$filesToRemove = @(
    ".env",
    ".env.production",
    "google-credentials.json",
    "production-readme.md"
)

foreach ($file in $filesToRemove) {
    if (Test-Path $file) {
        Write-Host "  Removing $file from the working directory..." -ForegroundColor Yellow
        Remove-Item -Force $file
        Write-Host "  Done." -ForegroundColor Green
    } else {
        Write-Host "  $file not found in working directory. Skipping." -ForegroundColor Gray
    }
    
    if (Test-GitFile $file) {
        Write-Host "  Removing $file from Git tracking..." -ForegroundColor Yellow
        git rm --cached $file
        Write-Host "  Done." -ForegroundColor Green
    } else {
        Write-Host "  $file not tracked by Git. Skipping." -ForegroundColor Gray
    }
}

# Create a .gitignore file if it doesn't exist
if (-not (Test-Path ".gitignore")) {
    Write-Host "Creating .gitignore file..." -ForegroundColor Yellow
    @"
# Node.js
node_modules/
npm-debug.log
yarn-debug.log
yarn-error.log

# Environment variables
.env
.env.local
.env.development
.env.test
.env.production

# Credentials
google-credentials.json
*credentials*.json
*.pem
*.key
*.keystore
*secret*
*token*
*oauth*

# Logs
logs
*.log

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Directory for uploaded files
uploads/
temp/

# Coverage directory
coverage/

# IDE files
.idea/
.vscode/
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db
"@ | Out-File -FilePath ".gitignore" -Encoding utf8
    Write-Host "Done." -ForegroundColor Green
} else {
    Write-Host ".gitignore already exists. Skipping creation." -ForegroundColor Gray
}

# Commit the changes
Write-Host "Step 2: Committing the changes..." -ForegroundColor Cyan
git add .gitignore
git add CREDENTIALS-GUIDE.md
git add .env.sample
git add production-readme-clean.md

git commit -m "Remove sensitive information and add security documentation"
Write-Host "Changes committed." -ForegroundColor Green

# Instructions for pushing to GitHub
Write-Host ""
Write-Host "Step 3: Pushing to GitHub" -ForegroundColor Cyan
Write-Host "You have two options to push these changes to GitHub:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Option 1: Allow the secrets through GitHub's push protection (quickest)" -ForegroundColor Magenta
Write-Host "  1. Try pushing with: git push" -ForegroundColor White
Write-Host "  2. When you get the error, click on each link provided in the error message" -ForegroundColor White
Write-Host "  3. For each link, select a reason for allowing the secret and click 'Allow secret'" -ForegroundColor White
Write-Host "  4. After allowing all secrets, try pushing again" -ForegroundColor White
Write-Host ""
Write-Host "Option 2: Create a new repository (cleanest)" -ForegroundColor Magenta
Write-Host "  1. Create a new repository on GitHub" -ForegroundColor White
Write-Host "  2. Push your current code to the new repository:" -ForegroundColor White
Write-Host "     git remote remove origin" -ForegroundColor White
Write-Host "     git remote add origin https://github.com/yourusername/new-repo-name.git" -ForegroundColor White
Write-Host "     git push -u origin main" -ForegroundColor White
Write-Host ""
Write-Host "IMPORTANT: After pushing, you should consider your credentials compromised and rotate them." -ForegroundColor Red
Write-Host "See CREDENTIALS-GUIDE.md for instructions on credential management." -ForegroundColor Yellow
