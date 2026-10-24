@echo off
echo ========================================================
echo  FieldAssist - Publishing to GitHub
echo ========================================================
echo.

cd /d "%~dp0"
set "PATH=%PATH%;C:\Users\bakar\AppData\Local\MinGit\cmd"

echo Pushing code to https://github.com/Akarsh5555/fieldassist-backend-foundation ...
echo.
echo If a GitHub browser window opens, click "Sign in with your browser" / "Authorize".
echo.

git push -u origin main --force

echo.
echo ========================================================
if %ERRORLEVEL% EQU 0 (
    echo  SUCCESS! Code published to GitHub successfully!
) else (
    echo  Push encountered an issue. See message above.
)
echo ========================================================
pause
