# Inventory Optimization Documentation

## Overview
The inventory optimization system provides intelligent recommendations for managing stock levels, reorder points, and order quantities using statistical analysis and demand forecasting.

## Key Features

### 1. Reorder Point (ROP) Calculation
**Formula:** `ROP = (Average Daily Demand × Lead Time) + Safety Stock`

The reorder point tells you **when to place a new order** based on:
- Historical demand patterns
- Lead time (time from ordering to receiving goods)
- Safety stock buffer

**Example:** If a product sells 100 units/day on average, lead time is 7 days, and safety stock is 150 units:
- ROP = (100 × 7) + 150 = **850 units**
- Place an order when inventory drops to 850 units

### 2. Safety Stock Calculation
**Formula:** `Safety Stock = Z-score × Standard Deviation × √Lead Time`

Safety stock acts as a **buffer against uncertainty** to prevent stockouts:

**Service Levels:**
- **90%**: Z-score = 1.28 (lower buffer, cost-effective)
- **95%**: Z-score = 1.65 (balanced approach, recommended)
- **99%**: Z-score = 2.33 (high certainty, higher inventory costs)

**Example:** Product with demand std dev of 20 units, 7-day lead time, 95% service level:
- Safety Stock = 1.65 × 20 × √7 = **87 units**

### 3. Economic Order Quantity (EOQ)
**Formula:** `EOQ = √((2 × Annual Demand × Ordering Cost) / Holding Cost)`

EOQ determines the **optimal order quantity** that minimizes total inventory costs:
- Balances ordering costs (setup, shipping) with holding costs (storage, insurance)
- Used for calculating recommended order quantities

**Parameters:**
- **Ordering Cost:** $50 per order (default)
- **Holding Cost:** 25% of product value per year (default)

**Example:** Product with 36,000 annual demand, $100 value, $50 ordering cost:
- Annual holding cost = $100 × 0.25 = $25
- EOQ = √((2 × 36,000 × 50) / 25) = **268 units**

### 4. ABC Classification
Categorizes products by revenue contribution using Pareto principle:

| Class | Revenue % | Inventory Treatment |
|-------|-----------|---------------------|
| **A** | 80% | Tight control, frequent reviews, high priority |
| **B** | 15% | Moderate control, periodic reviews |
| **C** | 5% | Simple controls, bulk ordering |

**Calculation:**
1. Calculate annual revenue per product (avg_daily_demand × 365 × price)
2. Sort products by revenue (descending)
3. Calculate cumulative % of total revenue
4. Assign classes: A (0-80%), B (80-95%), C (95-100%)

## Stock Status Indicators

| Status | Condition | Action |
|--------|-----------|--------|
| **Critical** | Stock < 25% of ROP | **ORDER IMMEDIATELY** - Risk of stockout |
| **Low - Order Now** | Stock < 50% of ROP | **ORDER SOON** - Below reorder point |
| **Moderate** | Stock < ROP | **MONITOR** - Approaching reorder point |
| **Healthy** | Stock ≥ ROP | **OK** - Sufficient inventory |

## API Usage

### Endpoint
```
GET /api/inventory/optimize/{store_id}
```

### Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `lead_time_days` | int | 7 | Supplier lead time (3-30 days) |
| `service_level` | float | 0.95 | Target service level (0.90-0.99) |

### Example Request
```bash
GET /api/inventory/optimize/1?lead_time_days=7&service_level=0.95
```

### Response Structure
```json
{
  "store_id": "1",
  "total_products": 9,
  "total_annual_revenue": 1234567.89,
  "abc_summary": {
    "A": 3,
    "B": 3,
    "C": 3
  },
  "metrics": [
    {
      "product": "Laptop",
      "category": "Electronics",
      "current_stock": 150,
      "avg_daily_demand": 95.3,
      "demand_std": 18.5,
      "reorder_point": 698,
      "safety_stock": 31,
      "recommended_order_qty": 234,
      "abc_classification": "A",
      "annual_revenue": 456789.12,
      "stock_days": 1.57,
      "status": "Critical"
    }
  ]
}
```

## Frontend Integration

### Configuration Options
1. **Store Selection** - Choose which store to optimize
2. **Lead Time** - Select 3, 7, 14, or 30 days
3. **Service Level** - Choose 90%, 95%, or 99%

### Dashboard Components
- **Summary Cards** - Total products, critical items, revenue, avg stock days
- **ABC Pie Chart** - Visual distribution of product value classes
- **Metrics Table** - Detailed inventory metrics per product
- **Legend** - Explains ROP, Safety Stock, EOQ, and Days Left

### Key Metrics Displayed
- **Stock**: Current inventory level
- **ROP**: Reorder point threshold
- **Safety Stock**: Buffer inventory amount
- **EOQ**: Recommended order quantity
- **Days Left**: Inventory coverage at current demand rate
- **Status**: Color-coded health indicator

## Business Logic

### When to Order
**Trigger:** Current stock ≤ Reorder Point
**Action:** Place an order for EOQ quantity

**Example Workflow:**
1. Laptop currently has 150 units in stock
2. ROP is calculated as 698 units
3. Status shows "Critical" (150 < 25% of 698)
4. System recommends ordering EOQ = 234 units
5. Order placed, stock will arrive in 7 days
6. Safety stock (31 units) provides buffer during lead time

### Optimization Benefits
- **Reduced Stockouts**: Safety stock prevents demand spikes
- **Lower Costs**: EOQ minimizes total inventory costs
- **Better Planning**: ABC analysis focuses effort on high-value items
- **Data-Driven**: Based on actual historical demand patterns

## Formulas Summary

```python
# Safety Stock
safety_stock = z_score * std_deviation * sqrt(lead_time_days)

# Reorder Point
reorder_point = (avg_daily_demand * lead_time_days) + safety_stock

# Economic Order Quantity
eoq = sqrt((2 * annual_demand * ordering_cost) / holding_cost)

# Days of Inventory
stock_days = current_stock / avg_daily_demand

# Stock Status
if stock < rop * 0.25: status = "Critical"
elif stock < rop * 0.5: status = "Low - Order Now"
elif stock < rop: status = "Moderate"
else: status = "Healthy"
```

## Best Practices

### 1. Service Level Selection
- **90%**: Low-value items (Class C), acceptable stockout risk
- **95%**: Most items (Class B, some A), balanced approach
- **99%**: Critical items (Class A), minimal stockout risk

### 2. Lead Time Configuration
- **3-7 days**: Fast-moving consumer goods, local suppliers
- **7-14 days**: Standard retail, regional suppliers
- **14-30 days**: International shipping, special orders

### 3. ABC Analysis Usage
- **Class A**: Daily monitoring, tight controls, frequent orders
- **Class B**: Weekly reviews, moderate safety stock
- **Class C**: Monthly reviews, larger order quantities, lower priority

### 4. Monitoring Frequency
- **Critical Items**: Check daily
- **Low Stock Items**: Check every 2-3 days
- **Moderate Stock**: Check weekly
- **Healthy Stock**: Check bi-weekly

## Technical Notes

### Data Requirements
- **Minimum History**: 30 days of sales data recommended
- **Update Frequency**: Daily sales data updates
- **Stock Accuracy**: Current inventory must be accurate

### Calculation Assumptions
- Demand follows normal distribution
- Lead time is constant
- No quantity discounts or constraints
- Ordering cost: $50 per order
- Holding cost: 25% of product value annually

### Limitations
- Does not account for seasonal variations (use forecasting module)
- Assumes independent demand per product
- Does not consider storage space constraints
- Fixed ordering and holding costs

## Integration with Forecasting

The inventory optimization works best when combined with the forecasting module:

1. **Forecasting Module** → Predicts future demand for next 7-30 days
2. **Inventory Module** → Uses historical demand stats for ROP/Safety Stock
3. **Combined View** → Make informed decisions based on both past and future

**Example:**
- Inventory shows ROP = 698 units (based on historical avg of 95.3/day)
- Forecast predicts 120 units/day for next week (promotional period)
- Decision: Order more than EOQ to accommodate forecasted increase

## Support & Troubleshooting

### Common Issues

**Issue**: "No optimization data"
- **Solution**: Ensure sales history exists for the selected store

**Issue**: "Negative safety stock"
- **Solution**: Check if std deviation is calculated correctly (need minimum 2 data points)

**Issue**: "Unrealistic EOQ values"
- **Solution**: Verify product prices are set correctly, adjust ordering/holding costs

### Contact
For questions or issues, refer to the main README or backend logs for debugging information.
