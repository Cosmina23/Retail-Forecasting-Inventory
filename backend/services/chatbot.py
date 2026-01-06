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

    This function queries all relevant collections to build a complete
    picture of the store's current state for the LLM to analyze.

    Args:
        store_id: The unique identifier for the store

    Returns:
        Dictionary containing products, inventory, sales, and forecasts
    """

    # Fetch products - limit to 50 to avoid token overflow
    # Exclude MongoDB _id field as it's not JSON serializable
    products = list(
        products_collection.find(
            {"store_id": store_id},
            {"_id": 0}
        ).limit(50)
    )

    # Fetch current inventory levels
    inventory = list(
        inventory_collection.find(
            {"store_id": store_id},
            {"_id": 0}
        ).limit(50)
    )

    # Fetch recent sales - sorted by date descending (newest first)
    sales = list(
        sales_collection.find(
            {"store_id": store_id},
            {"_id": 0}
        ).sort("date", -1).limit(100)
    )

    # Fetch demand forecasts
    forecasts = list(
        forecasts_collection.find(
            {"store_id": store_id},
            {"_id": 0}
        ).limit(20)
    )

    return {
        "products": products,
        "inventory": inventory,
        "recent_sales": sales,
        "forecasts": forecasts
    }


def build_system_prompt(store_data: dict) -> str:
    """
    Build the system prompt that defines the chatbot's behavior and context.

    The system prompt tells the LLM:
    1. What role it plays (inventory assistant)
    2. What data it has access to
    3. How it should respond

    Args:
        store_data: Dictionary containing all store data

    Returns:
        Formatted system prompt string
    """

    # Safely convert data to JSON strings for the prompt
    # Limit data shown to avoid exceeding token limits
    products_preview = json.dumps(store_data['products'][:10], default=str, indent=2)
    inventory_preview = json.dumps(store_data['inventory'][:10], default=str, indent=2)
    sales_preview = json.dumps(store_data['recent_sales'][:10], default=str, indent=2)
    forecasts_preview = json.dumps(store_data['forecasts'][:5], default=str, indent=2)

    return f"""You are an intelligent inventory management assistant for a retail store.
Your role is to help store managers make informed decisions about inventory, orders, and sales.

CAPABILITIES:
- Analyze inventory levels and identify low-stock items
- Review sales trends and patterns
- Provide reorder recommendations based on forecasts
- Explain why certain products are performing well or poorly
- Calculate optimal order quantities considering lead times

CURRENT STORE DATA SUMMARY:
- Total Products: {len(store_data['products'])} items in catalog
- Inventory Records: {len(store_data['inventory'])} stock entries
- Recent Sales: {len(store_data['recent_sales'])} transactions available
- Forecasts: {len(store_data['forecasts'])} predictions available

DETAILED DATA (sample):

Products:
{products_preview}

Current Inventory:
{inventory_preview}

Recent Sales (newest first):
{sales_preview}

Demand Forecasts:
{forecasts_preview}

RESPONSE GUIDELINES:
1. Be concise but thorough - provide specific numbers when available
2. If data is empty or missing, acknowledge it and explain what data would be needed
3. When recommending orders, consider:
   - Current stock levels
   - Forecast demand
   - Typical lead times (assume 3-5 days if not specified)
   - Safety stock (recommend 20% buffer)
4. Use natural, conversational language
5. If you cannot answer a question with available data, say so clearly
6. Format lists and numbers for easy reading
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


async def get_chat_response(
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