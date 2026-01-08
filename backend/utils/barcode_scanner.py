import cv2
from pyzbar.pyzbar import decode
import requests
import sys
import os

UPC_API_KEY = "YOUR_API_KEY"


# -------------------------
# OpenProductFacts Lookup
# -------------------------
def search_openproductfacts(barcode):
    url = f"https://world.openproductsfacts.org/api/v0/product/{barcode}.json"
    r = requests.get(url)

    if r.status_code != 200:
        return None

    data = r.json()
    if data.get("status") != 1:
        return None

    product = data["product"]
    return {
        "source": "OpenProductFacts",
        "name": product.get("product_name"),
        "brand": product.get("brands"),
        "category": product.get("categories"),
    }


# -------------------------
# UPCItemDB Lookup
# -------------------------
def search_upcitemdb(barcode):
    url = f"https://api.upcitemdb.com/prod/trial/lookup?upc={barcode}"
    r = requests.get(url)

    if r.status_code != 200:
        return None

    data = r.json()
    items = data.get("items")
    if not items:
        return None

    item = items[0]
    return {
        "source": "UPCItemDB",
        "name": item.get("title"),
        "brand": item.get("brand"),
        "category": item.get("category"),
    }


# -------------------------
# Process barcode results
# -------------------------
def display_barcode_info(code):
    print("\n==============================")
    print(f"📦 BARCODE DETECTED: {code}")
    print("==============================")

    # Search both APIs
    opf_result = search_openproductfacts(code)
    upc_result = search_upcitemdb(code)

    print("\n🔍 RESULTS:")

    if opf_result:
        print("\n[OpenProductFacts]")
        print(f"Name:     {opf_result['name']}")
        print(f"Brand:    {opf_result['brand']}")
        print(f"Category: {opf_result['category']}")
    else:
        print("\n[OpenProductFacts] No result.")

    if upc_result:
        print("\n[UPCItemDB]")
        print(f"Name:     {upc_result['name']}")
        print(f"Brand:    {upc_result['brand']}")
        print(f"Category: {upc_result['category']}")
    else:
        print("\n[UPCItemDB] No result.")

    print("\nChoose the result you prefer manually.")


# -------------------------
# Image Scanner
# -------------------------
def scan_image(image_path):
    if not os.path.exists(image_path):
        print(f"❌ Error: Image file '{image_path}' not found.")
        return

    print(f"📷 Loading image: {image_path}")
    frame = cv2.imread(image_path)
    
    if frame is None:
        print(f"❌ Error: Could not read image file.")
        return

    barcodes = decode(frame)
    
    if not barcodes:
        print("❌ No barcodes detected in the image.")
        print("💡 Tips:")
        print("   - Make sure the barcode is clearly visible")
        print("   - Try a higher resolution image")
        print("   - Ensure good lighting and contrast")
        return

    print(f"✅ Found {len(barcodes)} barcode(s)")
    
    for barcode in barcodes:
        code = barcode.data.decode("utf-8")
        display_barcode_info(code)
        
        # Draw bounding box
        pts = barcode.polygon
        if pts and len(pts) >= 3:
            pts = [(p.x, p.y) for p in pts]
            pts.append(pts[0])
            
            for i in range(len(pts) - 1):
                cv2.line(frame, pts[i], pts[i + 1], (0, 255, 0), 3)
    
    # Display the image with bounding boxes
    cv2.imshow("Barcode Detection Result", frame)
    print("\n👁️  Displaying image with detected barcode(s)...")
    cv2.waitKey(0)
    cv2.destroyAllWindows()


# -------------------------
# Webcam Scanner
# -------------------------
def start_scanner():
    cap = cv2.VideoCapture(0)
    scanned = set()

    print("Scanning… Press 'q' to quit.")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        for barcode in decode(frame):
            code = barcode.data.decode("utf-8")

            if code not in scanned:
                scanned.add(code)
                display_barcode_info(code)

            # Draw a bounding box
            pts = barcode.polygon
            if pts and len(pts) >= 3:
                pts = [(p.x, p.y) for p in pts]
                pts.append(pts[0])

                for i in range(len(pts) - 1):
                    cv2.line(frame, pts[i], pts[i + 1], (0, 255, 0), 3)

        cv2.imshow("Barcode Scanner", frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Image mode - support multiple images
        image_paths = sys.argv[1:]
        print(f"📸 Processing {len(image_paths)} image(s)...\n")
        
        for idx, image_path in enumerate(image_paths, 1):
            print(f"\n{'='*60}")
            print(f"IMAGE {idx}/{len(image_paths)}")
            print(f"{'='*60}")
            scan_image(image_path)
            
            if idx < len(image_paths):
                print("\n⏩ Press any key to continue to next image...")
                cv2.waitKey(0)
                cv2.destroyAllWindows()
    else:
        # Webcam mode
        print("🎥 Starting webcam mode...")
        print("💡 Tip: To scan image file(s), run: python barcodescanning.py <image_path1> <image_path2> ...")
        print()
        start_scanner()
