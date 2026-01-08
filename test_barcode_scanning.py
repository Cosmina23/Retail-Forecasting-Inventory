#!/usr/bin/env python3
"""
Test script for barcode scanning functionality
Tests if opencv-python and pyzbar are properly installed
"""

import sys
import os

def test_imports():
    """Test if required packages can be imported"""
    print("Testing package imports...")
    
    try:
        import cv2
        print(f"✅ OpenCV imported successfully (version {cv2.__version__})")
    except ImportError as e:
        print(f"❌ OpenCV import failed: {e}")
        return False
    
    try:
        from pyzbar.pyzbar import decode
        print(f"✅ pyzbar imported successfully")
    except ImportError as e:
        print(f"❌ pyzbar import failed: {e}")
        print("   Try: pip install --user pyzbar")
        return False
    
    try:
        import numpy as np
        print(f"✅ NumPy imported successfully (version {np.__version__})")
    except ImportError as e:
        print(f"❌ NumPy import failed: {e}")
        return False
    
    return True

def test_barcode_detection(image_path=None):
    """Test barcode detection on an image"""
    import cv2
    import numpy as np
    from pyzbar.pyzbar import decode
    
    if image_path and os.path.exists(image_path):
        print(f"\nTesting barcode detection on: {image_path}")
        image = cv2.imread(image_path)
        
        if image is None:
            print(f"❌ Could not read image: {image_path}")
            return False
        
        barcodes = decode(image)
        
        if barcodes:
            print(f"✅ Detected {len(barcodes)} barcode(s):")
            for barcode in barcodes:
                barcode_data = barcode.data.decode('utf-8')
                barcode_type = barcode.type
                print(f"   - {barcode_type}: {barcode_data}")
            return True
        else:
            print("⚠️  No barcodes detected in image")
            print("   Trying enhanced detection techniques...")
            
            # Try grayscale
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            barcodes = decode(gray)
            if barcodes:
                print(f"✅ Detected with grayscale: {barcodes[0].data.decode('utf-8')}")
                return True
            
            print("   Still no barcodes detected. Try:")
            print("   - Better lighting")
            print("   - Clearer image")
            print("   - Full barcode visible")
            return False
    else:
        print("\n✅ Import test successful!")
        print("   To test with an image, run:")
        print("   python test_barcode_scanning.py <path_to_barcode_image>")
        return True

def main():
    print("=" * 60)
    print("Barcode Scanning Test Script")
    print("=" * 60)
    
    if not test_imports():
        print("\n❌ Package import test failed!")
        print("\nInstallation instructions:")
        print("1. Install zbar: sudo pacman -S zbar")
        print("2. Install Python packages: pip install --user opencv-python pyzbar")
        print("   Or run: ./install_barcode_deps.sh")
        sys.exit(1)
    
    image_path = sys.argv[1] if len(sys.argv) > 1 else None
    
    if test_barcode_detection(image_path):
        print("\n" + "=" * 60)
        print("✅ All tests passed! Barcode scanning is ready.")
        print("=" * 60)
        sys.exit(0)
    else:
        print("\n" + "=" * 60)
        print("⚠️  Tests completed with warnings.")
        print("=" * 60)
        sys.exit(0)

if __name__ == "__main__":
    main()
