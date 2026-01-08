# Installation Instructions for Barcode Scanning

The barcode scanning feature requires `opencv-python` and `pyzbar` to be installed.

## For Arch Linux Users

### Step 1: Install OpenCV (Already Done ✓)
```bash
sudo pacman -S python-opencv zbar
```

### Step 2: Install pyzbar

Since pyzbar is not in the official Arch repos, you have a few options:

#### Option A: Using pip with ensurepip (Recommended)
```bash
# First, ensure pip is available
python -m ensurepip --upgrade

# Then install pyzbar
python -m pip install pyzbar
```

#### Option B: Using system pip (if available)
```bash
pip install pyzbar --user
```

#### Option C: Install from AUR
```bash
yay -S python-pyzbar
# or
paru -S python-pyzbar
```

#### Option D: Manual installation
```bash
# Download and install manually
git clone https://github.com/NaturalHistoryMuseum/pyzbar
cd pyzbar
python setup.py install --user
```

### Step 3: Verify Installation
```bash
cd backend
python -c "import cv2, pyzbar; print('✓ Barcode scanning ready!')"
```

## For Ubuntu/Debian Users

```bash
sudo apt-get update
sudo apt-get install -y python3-opencv libzbar0
pip install pyzbar
```

## For macOS Users

```bash
brew install zbar
pip install opencv-python pyzbar
```

## For Windows Users

```bash
pip install opencv-python pyzbar
```

Note: pyzbar may require additional setup on Windows.

## Troubleshooting

If you get `ModuleNotFoundError: No module named 'pyzbar'`:

1. Make sure you're using the correct Python environment
2. Try installing with `--user` flag: `python -m pip install pyzbar --user`
3. If using pyenv, switch to a Python version with pip: `pyenv global 3.12.2`
4. As a last resort, the backend will work without barcode scanning - you can enter barcodes manually

## Alternative: Manual Barcode Entry

If you can't install pyzbar, you can still use the product import feature:
- Enter barcodes manually instead of uploading images
- The system will still look up product information from OpenProductFacts and UPCItemDB
- All other features work normally
