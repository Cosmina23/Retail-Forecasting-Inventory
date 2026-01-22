from typing import List, Optional
from datetime import datetime
from bson import ObjectId


class ExpensesRepository:
    def __init__(self, db):
        self.collection = db["expenses"]

    def create_expense(self, expense_data: dict) -> dict:
        """Create a new expense"""
        expense_data["created_at"] = datetime.utcnow()
        result = self.collection.insert_one(expense_data)
        
        # Retrieve the inserted document
        inserted_doc = self.collection.find_one({"_id": result.inserted_id})
        if inserted_doc:
            inserted_doc["_id"] = str(inserted_doc["_id"])
        return inserted_doc

    def get_all_expenses(
        self, 
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        category: Optional[str] = None
    ) -> List[dict]:
        """Get all expenses with optional filters"""
        query = {}
        
        if start_date or end_date:
            date_query = {}
            if start_date:
                date_query["$gte"] = start_date
            if end_date:
                date_query["$lte"] = end_date
            query["date"] = date_query
        
        if category:
            query["category"] = category
        
        cursor = self.collection.find(query).sort("date", -1)
        expenses = list(cursor)
        
        for expense in expenses:
            expense["_id"] = str(expense["_id"])
        
        return expenses

    def get_expense_by_id(self, expense_id: str) -> Optional[dict]:
        """Get expense by ID"""
        expense = self.collection.find_one({"_id": ObjectId(expense_id)})
        if expense:
            expense["_id"] = str(expense["_id"])
        return expense

    def update_expense(self, expense_id: str, expense_data: dict) -> Optional[dict]:
        """Update an expense"""
        expense_data["updated_at"] = datetime.utcnow()
        result = self.collection.find_one_and_update(
            {"_id": ObjectId(expense_id)},
            {"$set": expense_data},
            return_document=True
        )
        if result:
            result["_id"] = str(result["_id"])
        return result

    def delete_expense(self, expense_id: str) -> bool:
        """Delete an expense"""
        result = self.collection.delete_one({"_id": ObjectId(expense_id)})
        return result.deleted_count > 0

    def get_expenses_by_category(self, start_date: datetime, end_date: datetime) -> List[dict]:
        """Get expenses grouped by category"""
        pipeline = [
            {
                "$match": {
                    "date": {
                        "$gte": start_date,
                        "$lte": end_date
                    }
                }
            },
            {
                "$group": {
                    "_id": "$category",
                    "total": {"$sum": "$amount"},
                    "count": {"$sum": 1}
                }
            },
            {
                "$project": {
                    "category": "$_id",
                    "total": 1,
                    "count": 1,
                    "_id": 0
                }
            }
        ]
        
        cursor = self.collection.aggregate(pipeline)
        return list(cursor)

    def get_total_expenses(self, start_date: datetime, end_date: datetime) -> float:
        """Get total expenses for a period"""
        pipeline = [
            {
                "$match": {
                    "date": {
                        "$gte": start_date,
                        "$lte": end_date
                    }
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total": {"$sum": "$amount"}
                }
            }
        ]
        
        cursor = self.collection.aggregate(pipeline)
        result = list(cursor)
        
        return result[0]["total"] if result else 0.0
