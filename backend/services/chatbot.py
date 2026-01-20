"""
Chatbot Service - Handles LLM interactions for inventory queries
Uses OpenAI GPT-4o-mini for cost-effective natural language processing
"""

from openai import OpenAI
from database import (
    products_collection,
    sales_collection,
    inventory_collection,
    forecasts_collection
)
import os
from dotenv import load_dotenv
from typing import Optional
import json

# Load environment variables
load_dotenv(dotenv_path="../.env")

# Initialize OpenAI client
# The client automatically reads OPENAI_API_KEY from environment
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Model configuration
MODEL_NAME = "gpt-4o-mini"  # Cheap and fast, ~$0.15/1M input tokens
MAX_TOKENS = 500            # Limit response length
TEMPERATURE = 0.7           # Balance between creativity and consistency


def get_store_context(store_id: str) -> dict:
    """
    Fetch relevant data from MongoDB for the chatbot context.
    Limits reduced to avoid token overflow.
    """

    # Reduce limits significantly
    products = list(
        products_collection.find(
            {"store_id": store_id},
            {"_id": 0, "name": 1, "category": 1, "price": 1, "sku": 1}
        ).limit(15)
    )

    inventory = list(
        inventory_collection.find(
            {"store_id": store_id},
            {"_id": 0, "product_name": 1, "stock_quantity": 1, "reorder_point": 1}
        ).limit(15)
    )

    sales = list(
        sales_collection.find(
            {"store_id": store_id},
            {"_id": 0, "product_name": 1, "quantity": 1, "date": 1, "total": 1}
        ).sort("date", -1).limit(20)
    )

    forecasts = list(
        forecasts_collection.find(
            {"store_id": store_id},
            {"_id": 0, "product_name": 1, "predicted_demand": 1, "date": 1}
        ).limit(10)
    )

    return {
        "products": products,
        "inventory": inventory,
        "recent_sales": sales,
        "forecasts": forecasts
    }


def build_system_prompt(store_data: dict) -> str:
    """Build the system prompt with reduced data previews."""

    # Show fewer items in previews
    products_preview = json.dumps(store_data['products'][:5], default=str, indent=2)
    inventory_preview = json.dumps(store_data['inventory'][:5], default=str, indent=2)
    sales_preview = json.dumps(store_data['recent_sales'][:5], default=str, indent=2)
    forecasts_preview = json.dumps(store_data['forecasts'][:3], default=str, indent=2)

    return f"""You are an intelligent inventory management assistant for a retail store.

CAPABILITIES:
- Analyze inventory levels and identify low-stock items
- Review sales trends and provide reorder recommendations
- Explain product performance

STORE SUMMARY:
- Products: {len(store_data['products'])} items
- Inventory: {len(store_data['inventory'])} records
- Recent Sales: {len(store_data['recent_sales'])} transactions
- Forecasts: {len(store_data['forecasts'])} predictions

SAMPLE DATA:

Products:
{products_preview}

Inventory:
{inventory_preview}

Recent Sales:
{sales_preview}

Forecasts:
{forecasts_preview}

GUIDELINES:
1. Be concise - provide specific numbers when available
2. If data is missing, acknowledge it
3. Use natural language
"""



def format_conversation_history(history: Optional[list]) -> list:
    """
    Format conversation history for the OpenAI API.

    Keeps only the last 10 messages to avoid token overflow while
    maintaining enough context for coherent conversation.

    Args:
        history: List of previous messages with 'role' and 'content'

    Returns:
        Formatted list of message dictionaries
    """
    if not history:
        return []

    # Keep only last 10 messages (5 exchanges)
    recent_history = history[-10:]

    # Ensure proper format
    formatted = []
    for msg in recent_history:
        if isinstance(msg, dict) and 'role' in msg and 'content' in msg:
            formatted.append({
                "role": msg["role"],
                "content": msg["content"]
            })

    return formatted


def get_chat_response(
    store_id: str,
    user_message: str,
    conversation_history: Optional[list] = None
) -> str:
    """
    Generate a chatbot response using OpenAI GPT-4o-mini.

    This is the main function that:
    1. Fetches store data from MongoDB
    2. Builds the system prompt with context
    3. Sends the request to OpenAI
    4. Returns the generated response

    Args:
        store_id: The store to query data for
        user_message: The user's question or request
        conversation_history: Previous messages for context (optional)

    Returns:
        The assistant's response as a string
    """

    # Step 1: Fetch all relevant store data
    store_data = get_store_context(store_id)

    # Step 2: Build the messages array for OpenAI
    messages = [
        {
            "role": "system",
            "content": build_system_prompt(store_data)
        }
    ]

    # Step 3: Add conversation history if provided
    if conversation_history:
        formatted_history = format_conversation_history(conversation_history)
        messages.extend(formatted_history)

    # Step 4: Add the current user message
    messages.append({
        "role": "user",
        "content": user_message
    })

    # Step 5: Call OpenAI API
    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=messages,
            max_tokens=MAX_TOKENS,
            temperature=TEMPERATURE
        )

        # Extract and return the response text
        return response.choices[0].message.content

    except Exception as e:
        # Log the error and return a user-friendly message
        print(f"OpenAI API Error: {str(e)}")
        return f"I'm sorry, I encountered an error processing your request. Please try again later. Error: {str(e)}"