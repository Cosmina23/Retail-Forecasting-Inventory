from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timedelta
from utils.auth import get_current_user
from database import get_database
from dal.expenses_repo import ExpensesRepository
from dal import sales_repo, purchase_orders_repo
from dateutil.parser import parse as parse_date

router = APIRouter(prefix="/api/finances", tags=["finances"])


def parse_order_date(order_date_value) -> Optional[datetime]:
    """Safely parse order_date which may be string or datetime."""
    if order_date_value is None:
        return None
    if isinstance(order_date_value, datetime):
        return order_date_value
    if isinstance(order_date_value, str):
        try:
            return parse_date(order_date_value)
        except Exception:
            return None
    return None


class ExpenseCreate(BaseModel):
    category: str = Field(..., description="Expense category (utilities, rent, salaries, etc.)")
    description: str = Field(..., description="Description of the expense")
    amount: float = Field(..., gt=0, description="Amount in currency")
    date: datetime = Field(default_factory=datetime.utcnow)
    recurring: bool = Field(default=False, description="Is this a recurring expense?")
    recurring_period: Optional[str] = Field(None, description="monthly, weekly, yearly")
    notes: Optional[str] = None


class ExpenseResponse(ExpenseCreate):
    id: str
    created_at: datetime


class ProfitLossReport(BaseModel):
    period_start: datetime
    period_end: datetime
    total_revenue: float
    total_expenses: float
    gross_profit: float
    expense_breakdown: List[dict]
    purchase_orders_cost: float
    operational_expenses: float


@router.post("/expenses", response_model=ExpenseResponse)
async def create_expense(
    expense: ExpenseCreate,
    current_user: str = Depends(get_current_user),
    db = Depends(get_database)
):
    """Create a new expense"""
    try:
        print(f"Creating expense: {expense.dict()}")
        print(f"Current user ID: {current_user}")

        repo = ExpensesRepository(db)
        expense_data = expense.dict()
        expense_data["user_id"] = current_user

        print(f"Expense data to save: {expense_data}")
        result = repo.create_expense(expense_data)
        print(f"Saved result: {result}")

        response = ExpenseResponse(
            id=str(result["_id"]),
            category=result["category"],
            description=result["description"],
            amount=result["amount"],
            date=result["date"],
            recurring=result.get("recurring", False),
            recurring_period=result.get("recurring_period"),
            notes=result.get("notes"),
            created_at=result.get("created_at", datetime.utcnow())
        )
        print(f"Response to return: {response}")
        return response
    except Exception as e:
        print(f"ERROR creating expense: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create expense: {str(e)}")


@router.get("/expenses", response_model=List[ExpenseResponse])
async def get_expenses(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    category: Optional[str] = Query(None),
    current_user: str = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get all expenses with optional filters"""
    repo = ExpensesRepository(db)
    expenses = repo.get_all_expenses(start_date, end_date, category)

    return [
        ExpenseResponse(
            id=str(expense["_id"]),
            category=expense["category"],
            description=expense["description"],
            amount=expense["amount"],
            date=expense.get("date", datetime.utcnow()),
            recurring=expense.get("recurring", False),
            recurring_period=expense.get("recurring_period"),
            notes=expense.get("notes"),
            created_at=expense.get("created_at", datetime.utcnow())
        )
        for expense in expenses
    ]


@router.delete("/expenses/{expense_id}")
async def delete_expense(
    expense_id: str,
    current_user: str = Depends(get_current_user),
    db = Depends(get_database)
):
    """Delete an expense"""
    repo = ExpensesRepository(db)
    success = repo.delete_expense(expense_id)

    if not success:
        raise HTTPException(status_code=404, detail="Expense not found")

    return {"success": True, "message": "Expense deleted"}


@router.get("/profit-loss", response_model=ProfitLossReport)
async def get_profit_loss(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    current_user: str = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get profit & loss report for a period"""
    if not end_date:
        end_date = datetime.utcnow()
    if not start_date:
        start_date = end_date - timedelta(days=30)

    current_sales = sales_repo.get_sales_by_date_range(start_date, end_date, skip=0, limit=100000)
    total_revenue = sum(sale.get("total_amount", 0) for sale in current_sales)

    all_pos = purchase_orders_repo.list_purchase_orders(skip=0, limit=100000)
    purchase_orders_cost = 0
    for po in all_pos:
        order_date = parse_order_date(po.get("order_date"))
        if order_date and start_date <= order_date <= end_date:
            purchase_orders_cost += po.get("total_cost", 0)

    expenses_repo = ExpensesRepository(db)
    operational_expenses = expenses_repo.get_total_expenses(start_date, end_date)
    expense_breakdown = expenses_repo.get_expenses_by_category(start_date, end_date)

    total_expenses = purchase_orders_cost + operational_expenses
    gross_profit = total_revenue - total_expenses

    return ProfitLossReport(
        period_start=start_date,
        period_end=end_date,
        total_revenue=total_revenue,
        total_expenses=total_expenses,
        gross_profit=gross_profit,
        expense_breakdown=expense_breakdown,
        purchase_orders_cost=purchase_orders_cost,
        operational_expenses=operational_expenses
    )


@router.get("/dashboard-stats")
async def get_dashboard_stats(
    current_user: str = Depends(get_current_user),
    db = Depends(get_database),
    days: int = Query(30, description="Number of days to look back")
):
    """Get key financial metrics for dashboard"""
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    prev_end = start_date
    prev_start = prev_end - timedelta(days=30)

    current_sales = sales_repo.get_sales_by_date_range(start_date, end_date, skip=0, limit=100000)
    current_revenue = sum(s.get("total_amount", 0) for s in current_sales)

    expenses_repo_instance = ExpensesRepository(db)
    current_expenses = expenses_repo_instance.get_total_expenses(start_date, end_date)

    all_pos = purchase_orders_repo.list_purchase_orders(skip=0, limit=100000)

    current_po_cost = 0
    prev_po_cost = 0

    for po in all_pos:
        order_date_raw = po.get("order_date")
        order_date = parse_order_date(order_date_raw)

        if order_date:
            # Make order_date timezone-naive for comparison
            if order_date.tzinfo is not None:
                order_date = order_date.replace(tzinfo=None)

            if start_date <= order_date <= end_date:
                current_po_cost += po.get("total_cost", 0)
            if prev_start <= order_date <= prev_end:
                prev_po_cost += po.get("total_cost", 0)

    current_total_expenses = current_expenses + current_po_cost
    current_profit = current_revenue - current_total_expenses

    prev_sales = sales_repo.get_sales_by_date_range(prev_start, prev_end, skip=0, limit=100000)
    prev_revenue = sum(s.get("total_amount", 0) for s in prev_sales)

    prev_expenses = expenses_repo_instance.get_total_expenses(prev_start, prev_end)
    prev_total_expenses = prev_expenses + prev_po_cost
    prev_profit = prev_revenue - prev_total_expenses

    revenue_change = ((current_revenue - prev_revenue) / prev_revenue * 100) if prev_revenue > 0 else 0
    expense_change = ((current_total_expenses - prev_total_expenses) / prev_total_expenses * 100) if prev_total_expenses > 0 else 0
    profit_change = ((current_profit - prev_profit) / abs(prev_profit) * 100) if prev_profit != 0 else 0

    return {
        "revenue": {
            "current": current_revenue,
            "previous": prev_revenue,
            "change_percent": revenue_change
        },
        "expenses": {
            "current": current_total_expenses,
            "previous": prev_total_expenses,
            "change_percent": expense_change,
            "operational": current_expenses,
            "purchase_orders": current_po_cost
        },
        "profit": {
            "current": current_profit,
            "previous": prev_profit,
            "change_percent": profit_change,
            "margin_percent": (current_profit / current_revenue * 100) if current_revenue > 0 else 0
        }
    }