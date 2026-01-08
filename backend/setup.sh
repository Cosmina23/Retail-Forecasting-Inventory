#!/bin/bash

# Backend setup script for Arch Linux
# This installs all required Python packages

echo "Setting up Retail Forecasting & Inventory Backend..."
echo "===================================================="

cd "$(dirname "$0")"

# Check if requirements.txt exists
if [ ! -f "requirements.txt" ]; then
    echo "❌ Error: requirements.txt not found"
    exit 1
fi

# Try to find a working pip command
echo "Finding pip..."
if command -v pip &> /dev/null; then
    PIP_CMD="pip"
elif command -v pip3 &> /dev/null; then
    PIP_CMD="pip3"
else
    echo "pip not found. Installing pip..."
    sudo pacman -S --needed --noconfirm python-pip
    PIP_CMD="pip"
fi

echo "Using: $PIP_CMD"

# Install dependencies
echo ""
echo "Installing Python dependencies..."
echo "Note: Using --break-system-packages for Arch Linux"
$PIP_CMD install --break-system-packages -r requirements.txt

# Verify key packages
echo ""
echo "Verifying installation..."
python -c "import fastapi; print('✅ FastAPI installed')" 2>&1
python -c "import pymongo; print('✅ PyMongo installed')" 2>&1
python -c "import pandas; print('✅ Pandas installed')" 2>&1
python -c "import sklearn; print('✅ Scikit-learn installed')" 2>&1

echo ""
echo "===================================================="
echo "✅ Backend setup complete!"
echo ""
echo "To start the backend:"
echo "  cd backend"
echo "  python main.py"
echo "===================================================="
