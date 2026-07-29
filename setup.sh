#!/bin/bash
# Default Zero — one-time environment setup.
# Run this once from the project root: bash setup.sh

set -e  # stop on first error instead of limping forward with a half-broken environment

echo "== Checking prerequisites =="
command -v node >/dev/null 2>&1 || { echo "Node.js not found. Install it from https://nodejs.org (LTS) first, then re-run this."; exit 1; }

# Windows Python installers (python.org) typically only provide 'python', not 'python3' —
# Git Bash/MINGW64 doesn't create the python3 alias the way Mac/Linux do. Detect either.
if command -v python3 >/dev/null 2>&1; then
  PYTHON=python3
elif command -v python >/dev/null 2>&1; then
  PYTHON=python
else
  echo "Python not found. Install Python 3.11+ from https://python.org first, then re-run this."
  echo "IMPORTANT on Windows: during install, tick 'Add python.exe to PATH' on the first screen — easy to miss."
  exit 1
fi

echo "Node: $(node -v)"
echo "Python: $($PYTHON --version)"

echo ""
echo "== Backend: creating virtual environment and installing dependencies =="
cd backend
$PYTHON -m venv venv
if [ -f "venv/Scripts/activate" ]; then
  source venv/Scripts/activate   # Windows (Git Bash)
else
  source venv/bin/activate       # Mac/Linux
fi
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
[ -f .env ] || cp .env.example .env
deactivate
cd ..

echo ""
echo "== Frontend: installing npm dependencies =="
cd frontend
npm install
[ -f .env ] || cp .env.example .env
cd ..

echo ""
echo "== Installing EAS CLI (for building the shareable APK) =="
npm install -g eas-cli

echo ""
echo "== Done =="
echo "Next steps:"
echo "  1. Fill in backend/.env with your Supabase + Groq keys"
echo "  2. Fill in frontend/.env with your Supabase keys and Render API URL"
echo "  3. Run the Supabase SQL in supabase/schema.sql via the Supabase dashboard"
echo "  4. Backend dev: cd backend && source venv/Scripts/activate (Windows) OR source venv/bin/activate (Mac/Linux) && uvicorn main:app --reload"
echo "  5. Frontend dev: cd frontend && npx expo start"
echo "  6. Build shareable APK: cd frontend && eas login && eas build --platform android --profile preview"
