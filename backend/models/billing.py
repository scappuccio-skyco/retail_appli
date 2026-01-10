"""
Modèles Pydantic pour la gestion de la facturation B2B
Conformité fiscale France / UE
"""
from pydantic import BaseModel, Field, EmailStr, field_validator, model_validator
from typing import Optional
from datetime import datetime, timezone
import re


class BillingProfileBase(BaseModel):
    """Modèle de base pour le profil de facturation B2B"""
    company_name: str = Field(..., min_length=1, max_length=200, description="Raison sociale")
    billing_email: EmailStr = Field(..., description="Email de facturation")
    address_line1: str = Field(..., min_length=1, max_length=200, description="Adresse ligne 1")
    address_line2: Optional[str] = Field(None, max_length=200, description="Adresse ligne 2 (complément)")
    postal_code: str = Field(..., min_length=2, max_length=20, description="Code postal")
    city: str = Field(..., min_length=1, max_length=100, description="Ville")
    country: str = Field(..., min_length=2, max_length=2, description="Code pays ISO 2 lettres (ex: FR, DE)")
    country_code: str = Field(..., min_length=2, max_length=2, description="Code pays pour facturation (identique à country)")
    vat_number: Optional[str] = Field(None, max_length=50, description="Numéro de TVA intracommunautaire (obligatoire si country != FR)")
    siren: Optional[str] = Field(None, max_length=9, description="SIREN (optionnel mais recommandé pour France)")
    is_vat_exempt: bool = Field(default=False, description="Auto-liquidation TVA (true si UE hors FR avec VAT valide)")
    
    @field_validator('country', 'country_code')
    @classmethod
    def validate_country_code(cls, v):
        if not v or len(v) != 2:
            raise ValueError("Le code pays doit contenir exactement 2 lettres (ISO 3166-1 alpha-2)")
        return v.upper()
    
    @field_validator('vat_number')
    @classmethod
    def validate_vat_format(cls, v, info):
        """Valide le format du numéro de TVA selon le pays"""
        if not v:
            return v
        
        # Extraire le code pays depuis le contexte si disponible
        country = info.data.get('country') if hasattr(info, 'data') else None
        
        if country and country.upper() == 'FR':
            # Format FR: FR + 2 chiffres + 9 chiffres (ex: FR12345678901)
            pattern = r'^FR\d{2}\d{9}$'
            if not re.match(pattern, v.replace(' ', '').upper()):
                raise ValueError("Format TVA FR invalide. Format attendu: FR12345678901")
        elif country:
            # Format UE: 2 lettres pays + jusqu'à 12 caractères alphanumériques
            pattern = r'^[A-Z]{2}[A-Z0-9]{2,12}$'
            if not re.match(pattern, v.replace(' ', '').upper()):
                raise ValueError(f"Format TVA {country} invalide. Format attendu: {country.upper()} suivi de 2-12 caractères alphanumériques")
        
        return v.replace(' ', '').upper()
    
    @field_validator('siren')
    @classmethod
    def validate_siren(cls, v):
        """Valide le format SIREN (9 chiffres)"""
        if not v:
            return v
        if not re.match(r'^\d{9}$', v.replace(' ', '')):
            raise ValueError("Le SIREN doit contenir exactement 9 chiffres")
        return v.replace(' ', '')
    
    @field_validator('postal_code')
    @classmethod
    def validate_postal_code(cls, v):
        """Valide le format du code postal selon le pays (basique)"""
        if not v or len(v) < 2:
            raise ValueError("Le code postal est invalide")
        return v.strip().upper()


class BillingProfileCreate(BillingProfileBase):
    """Modèle pour créer un profil de facturation"""
    pass


class BillingProfileUpdate(BaseModel):
    """Modèle pour mettre à jour un profil de facturation (tous les champs optionnels)"""
    company_name: Optional[str] = Field(None, min_length=1, max_length=200)
    billing_email: Optional[EmailStr] = None
    address_line1: Optional[str] = Field(None, min_length=1, max_length=200)
    address_line2: Optional[str] = Field(None, max_length=200)
    postal_code: Optional[str] = Field(None, min_length=2, max_length=20)
    city: Optional[str] = Field(None, min_length=1, max_length=100)
    country: Optional[str] = Field(None, min_length=2, max_length=2)
    country_code: Optional[str] = Field(None, min_length=2, max_length=2)
    vat_number: Optional[str] = Field(None, max_length=50)
    siren: Optional[str] = Field(None, max_length=9)
    is_vat_exempt: Optional[bool] = None
    
    @field_validator('country', 'country_code', mode='before')
    @classmethod
    def validate_country_code(cls, v):
        if v is not None and len(v) != 2:
            raise ValueError("Le code pays doit contenir exactement 2 lettres")
        return v.upper() if v else v
    
    @field_validator('vat_number', mode='before')
    @classmethod
    def validate_vat_format(cls, v):
        if not v:
            return v
        return v.replace(' ', '').upper()
    
    @field_validator('siren', mode='before')
    @classmethod
    def validate_siren(cls, v):
        if not v:
            return v
        if not re.match(r'^\d{9}$', v.replace(' ', '')):
            raise ValueError("Le SIREN doit contenir exactement 9 chiffres")
        return v.replace(' ', '')


class BillingProfile(BillingProfileBase):
    """Modèle complet du profil de facturation avec métadonnées"""
    id: str
    gerant_id: str = Field(..., description="ID du gérant propriétaire")
    billing_profile_completed: bool = Field(default=False, description="Flag indiquant si le profil est complet et valide")
    has_invoices: bool = Field(default=False, description="Indique si des factures ont déjà été générées (verrouille certains champs)")
    vat_number_validated: bool = Field(default=False, description="Indique si le numéro de TVA a été validé via VIES")
    vat_validation_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BillingProfileResponse(BillingProfile):
    """Réponse API pour le profil de facturation"""
    pass
