#!/bin/bash

# Installation script for barcode scanning dependencies
# For Arch Linux / Manjaro

echo "Installing barcode scanning dependencies..."

# Install system packages
echo "Installing zbar library..."
sudo pacman -S --needed --noconfirm zbar

# Install Python packages via pip
echo "Installing Python packages..."

# Try to find pip
if command -v pip &> /dev/null; then
    PIP_CMD="pip"
elif command -v pip3 &> /dev/null; then
    PIP_CMD="pip3"
elif python3 -m pip --version &> /dev/null; then
    PIP_CMD="python3 -m pip"
elif python -m pip --version &> /dev/null; then
    PIP_CMD="python -m pip"
else
    echo "❌ Error: pip not found. Please install pip first."
    echo "Try: sudo pacman -S python-pip"
    exit 1
fi

echo "Using pip command: $PIP_CMD"

# Install opencv-python and pyzbar
$PIP_CMD install opencv-python pyzbar --user

# Verify installation
echo ""
echo "Verifying installation..."
python3 -c "import cv2; print('✅ OpenCV installed:', cv2.__version__)" 2>&1
python3 -c "import pyzbar; print('✅ pyzbar installed')" 2>&1

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Installation complete!"
    echo "You can now use barcode scanning features."
else
    echo ""
    echo "⚠️  Installation had some issues. Please check the errors above."
    echo ""
    echo "Alternative installation methods:"
    echo "1. System packages: sudo pacman -S python-opencv"
    echo "2. User packages: pip3 install --user opencv-python pyzbar"
    echo "3. Virtual environment: python3 -m venv venv && source venv/bin/activate && pip install opencv-python pyzbar"
fi
