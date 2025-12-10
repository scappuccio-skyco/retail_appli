"""
Pydantic models for data validation
Centralized exports for easy imports
"""

# Common models
from models.common import BaseResponse, PaginationParams, DateRangeFilter

# User models
from models.users import (
    User, UserCreate, UserLogin,
    ForgotPasswordRequest, ResetPasswordRequest,
    Invitation, InvitationCreate, RegisterWithInvite,
    GerantInvitation, GerantInvitationCreate, RegisterWithGerantInvite,
    CreateAdminRequest
)

# Store models
from models.stores import (
    Store, StoreCreate, StoreUpdate,
    Workspace, WorkspaceCreate,
    ManagerTransfer, SellerTransfer, ManagerAssignment
)

# KPI models
from models.kpis import (
    KPIEntry, KPIEntryCreate,
    KPIConfiguration, KPIConfigUpdate,
    ManagerKPI, ManagerKPICreate,
    StoreKPI, StoreKPICreate
)

# Subscription models
from models.subscriptions import (
    Subscription, SubscriptionHistory,
    AIUsageLog, PaymentTransaction,
    CheckoutRequest, GerantCheckoutRequest, UpdateSeatsRequest
)

# Sales models
from models.sales import (
    Sale, SaleCreate,
    Evaluation, EvaluationCreate,
    Debrief, DebriefCreate
)

# Diagnostic models
from models.diagnostics import (
    DiagnosticResult, DiagnosticCreate,
    ManagerDiagnosticResult, ManagerDiagnosticCreate,
    TeamBilan, SellerBilan
)

# Challenge models
from models.challenges import (
    Challenge, ChallengeCreate, ChallengeProgressUpdate,
    DailyChallenge, DailyChallengeComplete
)

# Objective models
from models.objectives import (
    ManagerObjectives, ManagerObjectivesCreate, ObjectiveProgressUpdate
)

# Manager tools models
from models.manager_tools import (
    ManagerRequest, ManagerRequestCreate, ManagerRequestResponse,
    ConflictResolution, ConflictResolutionCreate, RelationshipAdviceRequest
)

# Chat models
from models.chat import ChatMessage, ChatRequest, ActionRequest

# Integration models
from models.integrations import (
    APIKeyCreate, APIKeyResponse,
    KPIEntryIntegration, KPISyncRequest,
    APIStoreCreate, APIManagerCreate, APISellerCreate, APIUserUpdate,
    SeedDatabaseRequest
)

__all__ = [
    # Common
    'BaseResponse', 'PaginationParams', 'DateRangeFilter',
    
    # Users
    'User', 'UserCreate', 'UserLogin',
    'ForgotPasswordRequest', 'ResetPasswordRequest',
    'Invitation', 'InvitationCreate', 'RegisterWithInvite',
    'GerantInvitation', 'GerantInvitationCreate', 'RegisterWithGerantInvite',
    'CreateAdminRequest',
    
    # Stores
    'Store', 'StoreCreate', 'StoreUpdate',
    'Workspace', 'WorkspaceCreate',
    'ManagerTransfer', 'SellerTransfer', 'ManagerAssignment',
    
    # KPIs
    'KPIEntry', 'KPIEntryCreate',
    'KPIConfiguration', 'KPIConfigUpdate',
    'ManagerKPI', 'ManagerKPICreate',
    'StoreKPI', 'StoreKPICreate',
    
    # Subscriptions
    'Subscription', 'SubscriptionHistory',
    'AIUsageLog', 'PaymentTransaction',
    'CheckoutRequest', 'GerantCheckoutRequest', 'UpdateSeatsRequest',
    
    # Sales
    'Sale', 'SaleCreate',
    'Evaluation', 'EvaluationCreate',
    'Debrief', 'DebriefCreate',
    
    # Diagnostics
    'DiagnosticResult', 'DiagnosticCreate',
    'ManagerDiagnosticResult', 'ManagerDiagnosticCreate',
    'TeamBilan', 'SellerBilan',
    
    # Challenges
    'Challenge', 'ChallengeCreate', 'ChallengeProgressUpdate',
    'DailyChallenge', 'DailyChallengeComplete',
    
    # Objectives
    'ManagerObjectives', 'ManagerObjectivesCreate', 'ObjectiveProgressUpdate',
    
    # Manager Tools
    'ManagerRequest', 'ManagerRequestCreate', 'ManagerRequestResponse',
    'ConflictResolution', 'ConflictResolutionCreate', 'RelationshipAdviceRequest',
    
    # Chat
    'ChatMessage', 'ChatRequest', 'ActionRequest',
    
    # Integrations
    'APIKeyCreate', 'APIKeyResponse',
    'KPIEntryIntegration', 'KPISyncRequest',
    'APIStoreCreate', 'APIManagerCreate', 'APISellerCreate', 'APIUserUpdate',
    'SeedDatabaseRequest',
]
