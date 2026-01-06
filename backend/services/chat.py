"""
Chat Router - API endpoints for the conversational interface
Handles chat requests and maintains conversation context
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from services.chatbot import get_chat_response

# Create router with prefix and tags for API documentation
router = APIRouter(
    prefix="/chat",
    tags=["chat"],
    responses={404: {"description": "Not found"}}
)


# --- Pydantic Models for Request/Response Validation ---

class ChatMessage(BaseModel):
    """
    Represents a single message in the conversation history.

    Attributes:
        role: Either 'user' or 'assistant'
        content: The message text
    """
    role: str = Field(..., description="Message role: 'user' or 'assistant'")
    content: str = Field(..., description="Message content")

    class Config:
        json_schema_extra = {
            "example": {
                "role": "user",
                "content": "What should I order this week?"
            }
        }


class ChatRequest(BaseModel):
    """
    Request body for the chat endpoint.

    Attributes:
        store_id: The store to query data for
        message: The user's question
        history: Previous conversation messages (optional)
    """
    store_id: str = Field(..., description="Store identifier")
    message: str = Field(..., min_length=1, description="User's message")
    history: Optional[List[ChatMessage]] = Field(
        default=None,
        description="Previous conversation messages"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "store_id": "store_123",
                "message": "What products are running low on stock?",
                "history": []
            }
        }


class ChatResponse(BaseModel):
    """
    Response body from the chat endpoint.

    Attributes:
        response: The assistant's reply
        store_id: Echo of the store that was queried
    """
    response: str = Field(..., description="Assistant's response")
    store_id: str = Field(..., description="Store identifier")

    class Config:
        json_schema_extra = {
            "example": {
                "response": "Based on current inventory levels, you should consider ordering...",
                "store_id": "store_123"
            }
        }


# --- API Endpoints ---

@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Process a chat message and return an AI-generated response.

    This endpoint:
    1. Validates the request
    2. Fetches store data from MongoDB
    3. Sends the query to OpenAI with context
    4. Returns the generated response

    Example questions:
    - "What should I order this week?"
    - "Why are sales dropping for Product X?"
    - "Show me low stock items"
    - "What's the forecast for next week?"
    """

    # Validate message is not empty or whitespace
    if not request.message.strip():
        raise HTTPException(
            status_code=400,
            detail="Message cannot be empty"
        )

    # Convert Pydantic models to dictionaries for the service
    history = None
    if request.history:
        history = [
            {"role": msg.role, "content": msg.content}
            for msg in request.history
        ]

    # Get response from chatbot service
    response_text = await get_chat_response(
        store_id=request.store_id,
        user_message=request.message,
        conversation_history=history
    )

    return ChatResponse(
        response=response_text,
        store_id=request.store_id
    )


@router.get("/health")
async def chat_health():
    """
    Health check endpoint for the chat service.
    Use this to verify the chat API is running.
    """
    return {"status": "healthy", "service": "chat"}