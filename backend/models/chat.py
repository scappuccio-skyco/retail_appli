"""
Chat and conversational AI models

All Pydantic models for chat domain
"""
from __future__ import annotations  # For forward references
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional, List, Dict
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import uuid


class ChatMessage(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str
    timestamp: Optional[str] = None
    context: Optional[Dict] = None



class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None



class ActionRequest(BaseModel):
    action_type: str  # e.g., 'reactivate_workspace', 'change_plan'
    target_id: str
    params: Optional[Dict] = None

