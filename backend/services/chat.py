"""
Chat Router - API endpoints for the conversational interface
Handles chat requests and maintains conversation context
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from services.chatbot import get_chat_response

# Create router WITHOUT prefix (prefix is set in main.py)
router = APIRouter(
    tags=["chat"],
    responses={404: {"description": "Not found"}}
)


# --- Pydantic Models for Request/Response Validation ---

class ChatMessage(BaseModel):
    """
    Represents a single message in the conversation history.
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
    """
    if not request.message.strip():
        raise HTTPException(
            status_code=400,
            detail="Message cannot be empty"
        )

    history = None
    if request.history:
        history = [
            {"role": msg.role, "content": msg.content}
            for msg in request.history
        ]

    response_text = get_chat_response(
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
    """Health check endpoint for the chat service."""
    return {"status": "healthy", "service": "chat"}