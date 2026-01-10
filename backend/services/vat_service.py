"""
Service de validation des numéros de TVA intracommunautaires via VIES (VAT Information Exchange System)
API de la Commission Européenne: https://ec.europa.eu/taxation_customs/vies/
"""
import logging
import httpx
from typing import Dict, Optional, Tuple
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Liste des codes pays UE (ISO 3166-1 alpha-2)
EU_COUNTRIES = {
    'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI',
    'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT',
    'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK'
}

VIES_API_URL = "https://ec.europa.eu/taxation_customs/vies/rest-api/ms/{country_code}/vat/{vat_number}"


async def validate_vat_number(vat_number: str, country_code: str) -> Tuple[bool, Optional[Dict], Optional[str]]:
    """
    Valide un numéro de TVA intracommunautaire via l'API VIES.
    
    Args:
        vat_number: Numéro de TVA sans préfixe pays (ex: "12345678901" pour FR)
        country_code: Code pays ISO 2 lettres (ex: "FR", "DE")
    
    Returns:
        Tuple de (is_valid, validation_data, error_message)
        - is_valid: True si le numéro est valide
        - validation_data: Dict avec les informations de validation (nom, adresse, etc.)
        - error_message: Message d'erreur si la validation a échoué
    
    Exemple de réponse VIES:
    {
        "isValid": true,
        "name": "COMPANY NAME",
        "address": "RUE DE LA REPUBLIQUE 1, 75001 PARIS",
        "requestDate": "2024-01-15+01:00",
        "userError": "VALID",
        "countryCode": "FR",
        "vatNumber": "12345678901"
    }
    """
    # Nettoyer le numéro de TVA (retirer le préfixe pays si présent)
    vat_number = vat_number.upper().strip().replace(' ', '')
    country_code = country_code.upper().strip()
    
    # Si le numéro commence par le code pays (ex: "FR12345678901"), l'extraire
    if vat_number.startswith(country_code):
        vat_number = vat_number[len(country_code):]
    
    # Vérifier que le pays est dans l'UE
    if country_code not in EU_COUNTRIES:
        return False, None, f"Le pays {country_code} n'est pas membre de l'Union Européenne"
    
    # Pour la France, on peut valider localement le format, mais on ne peut pas vérifier l'existence via VIES
    # car VIES ne permet pas de valider les numéros français depuis l'extérieur
    # On vérifie seulement le format
    if country_code == 'FR':
        if not vat_number.isdigit() or len(vat_number) != 11:
            return False, None, "Format TVA FR invalide. Format attendu: 2 chiffres + 9 chiffres (ex: 12345678901)"
        # Format correct: FR + 2 chiffres (clé) + 9 chiffres (SIREN)
        return True, {
            "isValid": True,
            "countryCode": "FR",
            "vatNumber": vat_number,
            "requestDate": datetime.now(timezone.utc).isoformat(),
            "note": "Validation format uniquement (VIES ne permet pas la validation des numéros FR depuis l'extérieur)"
        }, None
    
    # Pour les autres pays UE, appeler l'API VIES
    url = VIES_API_URL.format(
        country_code=country_code,
        vat_number=vat_number
    )
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            
            if response.status_code == 200:
                data = response.json()
                
                # VIES retourne isValid: true/false
                is_valid = data.get("isValid", False)
                
                if is_valid:
                    validation_data = {
                        "isValid": True,
                        "countryCode": data.get("countryCode", country_code),
                        "vatNumber": data.get("vatNumber", vat_number),
                        "name": data.get("name", ""),
                        "address": data.get("address", ""),
                        "requestDate": data.get("requestDate", datetime.now(timezone.utc).isoformat()),
                        "userError": data.get("userError", "VALID")
                    }
                    logger.info(f"VAT number validated via VIES: {country_code}{vat_number} - Name: {validation_data.get('name', 'N/A')}")
                    return True, validation_data, None
                else:
                    error_msg = data.get("userError", "Numéro de TVA invalide")
                    logger.warning(f"VAT number invalid via VIES: {country_code}{vat_number} - Error: {error_msg}")
                    return False, None, error_msg
            else:
                error_msg = f"Erreur lors de l'appel à l'API VIES (code {response.status_code})"
                logger.error(f"VIES API error for {country_code}{vat_number}: {error_msg}")
                return False, None, error_msg
                
    except httpx.TimeoutException:
        error_msg = "Timeout lors de la validation VIES. Veuillez réessayer."
        logger.error(f"VIES timeout for {country_code}{vat_number}")
        return False, None, error_msg
    except Exception as e:
        error_msg = f"Erreur lors de la validation VIES: {str(e)}"
        logger.error(f"VIES error for {country_code}{vat_number}: {error_msg}", exc_info=True)
        return False, None, error_msg


def calculate_vat_rate(country_code: str, has_valid_vat: bool, is_vat_exempt: bool) -> Tuple[float, str]:
    """
    Calcule le taux de TVA et la mention légale selon le pays et le statut TVA.
    
    Args:
        country_code: Code pays ISO 2 lettres
        has_valid_vat: True si un numéro de TVA valide est présent
        is_vat_exempt: True si auto-liquidation (UE hors FR avec VAT)
    
    Returns:
        Tuple de (vat_rate, legal_mention)
        - vat_rate: Taux de TVA (0.0 à 1.0, ex: 0.20 pour 20%)
        - legal_mention: Mention légale à afficher sur la facture
    """
    country_code = country_code.upper()
    
    # France: TVA 20% (toujours)
    if country_code == 'FR':
        return 0.20, "TVA applicable au taux de 20%"
    
    # UE hors FR avec VAT valide: TVA 0% (auto-liquidation)
    if country_code in EU_COUNTRIES and has_valid_vat and is_vat_exempt:
        return 0.0, "Autoliquidation – article 196 directive 2006/112/CE"
    
    # Par défaut, si pas de VAT ou pays hors UE: TVA 20% (France par défaut pour sécurité)
    return 0.20, "TVA applicable au taux de 20%"


def is_eu_country(country_code: str) -> bool:
    """Vérifie si un pays est membre de l'UE"""
    return country_code.upper() in EU_COUNTRIES
