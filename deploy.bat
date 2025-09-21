@echo off
cd /d "%~dp0"

echo --- Cleaning up previous git directory if it exists...
if exist .git (
    rmdir /s /q .git
)

echo --- Initializing new git repository...
git init

echo --- Staging all files...
git add .

echo --- Committing files...
git commit -m "Initial commit: Add web application files"

echo --- Setting branch to main...
git branch -M main

echo --- Removing old remote origin if it exists...
git remote remove origin >nul 2>&1

echo --- Adding new remote origin...
git remote add origin https://github.com/zaijun91/ColorAlarm-1.git

echo --- Pushing to GitHub...
git push -u origin main

echo --- Deployment script finished.
del "%~f0"
