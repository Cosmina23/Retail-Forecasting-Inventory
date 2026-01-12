from database import (
    products_collection,
    inventory_collection,
    sales_collection,
    import_runs_collection,
    import_logs_collection,
)


def create_indexes() -> None:
    products_collection.create_index([("sku", 1)], unique=True)
    inventory_collection.create_index([("product_id", 1), ("store_id", 1)], unique=True)
    sales_collection.create_index([("product_id", 1), ("sale_date", -1)])
    import_runs_collection.create_index([("run_id", 1)], unique=True)
    import_logs_collection.create_index([("run_id", 1)])