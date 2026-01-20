"""
Script to populate holidays and seasonal events in the database
Run this to add holiday data for better forecasting
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from datetime import datetime
from dal.holidays_repo import create_holiday


def populate_holidays():
    """
    Add common holidays and seasonal events for Germany
    """
    holidays_data = [
        # Public Holidays - 2026
        {
            "name": "New Year's Day",
            "event_type": "public_holiday",
            "date": datetime(2026, 1, 1),
            "market": "Germany",
            "impact_level": "medium",
            "typical_demand_change": 0.2,
            "affected_categories": ["Food", "Electronics"]
        },
        {
            "name": "Easter",
            "event_type": "public_holiday",
            "date": datetime(2026, 4, 5),
            "market": "Germany",
            "impact_level": "high",
            "typical_demand_change": 0.3,
            "affected_categories": ["Food", "Clothing"]
        },
        {
            "name": "Christmas",
            "event_type": "public_holiday",
            "date": datetime(2026, 12, 25),
            "market": "Germany",
            "impact_level": "high",
            "typical_demand_change": 1.5,
            "affected_categories": ["Food", "Electronics", "Clothing"]
        },
        {
            "name": "Christmas Eve",
            "event_type": "shopping_event",
            "date": datetime(2026, 12, 24),
            "market": "Germany",
            "impact_level": "high",
            "typical_demand_change": 2.0,
            "affected_categories": ["Food", "Electronics"]
        },
        {
            "name": "Oktoberfest",
            "event_type": "shopping_event",
            "date": datetime(2026, 9, 19),
            "market": "Germany",
            "impact_level": "high",
            "typical_demand_change": 0.8,
            "affected_categories": ["Food", "Clothing"]
        },
        
        # Shopping Events
        {
            "name": "Black Friday",
            "event_type": "shopping_event",
            "date": datetime(2026, 11, 27),
            "market": "Germany",
            "impact_level": "high",
            "typical_demand_change": 2.5,
            "affected_categories": ["Electronics", "Clothing"]
        },
        {
            "name": "Cyber Monday",
            "event_type": "shopping_event",
            "date": datetime(2026, 11, 30),
            "market": "Germany",
            "impact_level": "high",
            "typical_demand_change": 2.0,
            "affected_categories": ["Electronics"]
        },
        {
            "name": "Valentine's Day",
            "event_type": "shopping_event",
            "date": datetime(2026, 2, 14),
            "market": "Germany",
            "impact_level": "medium",
            "typical_demand_change": 0.5,
            "affected_categories": ["Food", "Clothing"]
        },
        
        # Seasonal Events
        {
            "name": "Winter Season Start",
            "event_type": "seasonal",
            "date": datetime(2025, 12, 1),
            "market": "Germany",
            "impact_level": "high",
            "typical_demand_change": 0.5,
            "affected_categories": ["Clothing"]
        },
        {
            "name": "Summer Season Start",
            "event_type": "seasonal",
            "date": datetime(2026, 6, 1),
            "market": "Germany",
            "impact_level": "high",
            "typical_demand_change": 0.5,
            "affected_categories": ["Clothing"]
        },
        {
            "name": "Back to School",
            "event_type": "seasonal",
            "date": datetime(2026, 9, 1),
            "market": "Germany",
            "impact_level": "high",
            "typical_demand_change": 0.8,
            "affected_categories": ["Electronics", "Clothing"]
        }
    ]
    
    print("📅 Populating holidays and events...")
    
    for holiday in holidays_data:
        try:
            result = create_holiday(**holiday)
            print(f"✅ Added: {holiday['name']} ({holiday['event_type']}) on {holiday['date'].strftime('%Y-%m-%d')}")
        except Exception as e:
            print(f"❌ Error adding {holiday['name']}: {e}")
    
    print(f"\n✅ Successfully populated {len(holidays_data)} holidays/events!")


if __name__ == "__main__":
    populate_holidays()
