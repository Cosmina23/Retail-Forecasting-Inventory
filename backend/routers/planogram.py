from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
import json
import os
from pathlib import Path
from utils.auth import get_current_user

router = APIRouter(prefix="/api/planogram", tags=["planogram"])

# Directory for storing planogram files
PLANOGRAM_DIR = Path("planogram_data")
PLANOGRAM_DIR.mkdir(exist_ok=True)


class ShelfData(BaseModel):
    shelfNumber: int
    productName: str
    quantity: int


class StoreItem(BaseModel):
    id: str
    type: str
    name: str
    x: float
    y: float
    rotation: int
    shelves: Optional[List[ShelfData]] = None


class PlanogramData(BaseModel):
    storeItems: List[StoreItem]
    itemCounters: Dict[str, int]
    timestamp: str


@router.post("/save")
async def save_planogram(
    data: PlanogramData,
    current_user: dict = Depends(get_current_user)
):
    """
    Save planogram to a text file
    """
    try:
        user_id = current_user.get("id", "unknown")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"planogram_{user_id}_{timestamp}.txt"
        filepath = PLANOGRAM_DIR / filename
        
        # Create a readable text format
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write("=" * 80 + "\n")
            f.write("STORE PLANOGRAM REPORT\n")
            f.write("=" * 80 + "\n")
            f.write(f"User ID: {user_id}\n")
            f.write(f"Saved at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write("=" * 80 + "\n\n")
            
            # Summary
            f.write("SUMMARY\n")
            f.write("-" * 80 + "\n")
            f.write(f"Total Doors: {data.itemCounters.get('door', 0)}\n")
            f.write(f"Total Fridges: {data.itemCounters.get('fridge', 0)}\n")
            f.write(f"Total Shelves: {data.itemCounters.get('shelf', 0)}\n")
            f.write(f"Total Cashiers: {data.itemCounters.get('cashier', 0)}\n")
            f.write(f"Total Items: {len(data.storeItems)}\n")
            f.write("\n")
            
            # Detailed items
            f.write("STORE LAYOUT\n")
            f.write("-" * 80 + "\n")
            for item in data.storeItems:
                f.write(f"\n{item.name} ({item.type.upper()})\n")
                f.write(f"  Position: X={item.x}, Y={item.y}\n")
                f.write(f"  Rotation: {item.rotation}°\n")
                
                if item.shelves and len(item.shelves) > 0:
                    f.write(f"  Products:\n")
                    for shelf in item.shelves:
                        f.write(f"    Shelf {shelf.shelfNumber}: {shelf.productName} (Qty: {shelf.quantity})\n")
                else:
                    f.write(f"  Products: None assigned\n")
            
            f.write("\n")
            f.write("=" * 80 + "\n")
            f.write("END OF REPORT\n")
            f.write("=" * 80 + "\n")
        
        # Also save as JSON for easy loading
        json_filename = f"planogram_{user_id}_latest.json"
        json_filepath = PLANOGRAM_DIR / json_filename
        
        with open(json_filepath, 'w', encoding='utf-8') as f:
            json.dump(data.dict(), f, indent=2, ensure_ascii=False)
        
        return {
            "success": True,
            "message": "Planogram saved successfully",
            "text_file": str(filepath),
            "json_file": str(json_filepath),
            "timestamp": timestamp
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save planogram: {str(e)}"
        )


@router.get("/load")
async def load_planogram(
    current_user: dict = Depends(get_current_user)
):
    """
    Load the latest planogram for the current user
    """
    try:
        user_id = current_user.get("id", "unknown")
        json_filename = f"planogram_{user_id}_latest.json"
        json_filepath = PLANOGRAM_DIR / json_filename
        
        if not json_filepath.exists():
            return {
                "success": False,
                "message": "No saved planogram found",
                "data": None
            }
        
        with open(json_filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return {
            "success": True,
            "message": "Planogram loaded successfully",
            "data": data
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load planogram: {str(e)}"
        )


@router.get("/list")
async def list_planograms(
    current_user: dict = Depends(get_current_user)
):
    """
    List all saved planograms for the current user
    """
    try:
        user_id = current_user.get("id", "unknown")
        planograms = []
        
        for filepath in PLANOGRAM_DIR.glob(f"planogram_{user_id}_*.txt"):
            stat = filepath.stat()
            planograms.append({
                "filename": filepath.name,
                "created": datetime.fromtimestamp(stat.st_ctime).strftime('%Y-%m-%d %H:%M:%S'),
                "size": stat.st_size
            })
        
        planograms.sort(key=lambda x: x['created'], reverse=True)
        
        return {
            "success": True,
            "count": len(planograms),
            "planograms": planograms
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list planograms: {str(e)}"
        )
