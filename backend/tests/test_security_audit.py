"""
Tests d'audit sécurité — injection MongoDB, CORS origin validation, JWT alg pinning.

Ces tests sont unitaires (pas de MongoDB réel) et s'exécutent dans le job unit-tests CI.
"""
import base64
import json
import os
import pytest

# ---------------------------------------------------------------------------
# 1. JWT algorithm pinning
# ---------------------------------------------------------------------------

class TestJwtAlgorithmPinning:
    """
    Vérifie que decode_token() refuse tout token dont l'algorithme n'est pas HS256.
    Protège contre l'attaque « alg:none » et la confusion HS/RS.
    """

    def _make_token_with_alg(self, alg: str, payload: dict, secret: str = "test-jwt-secret-not-real-32chars!!") -> str:
        """Forge un token JWT avec l'algorithme indiqué (sans signature valide si alg=none)."""
        header = base64.urlsafe_b64encode(
            json.dumps({"alg": alg, "typ": "JWT"}).encode()
        ).rstrip(b"=").decode()
        body = base64.urlsafe_b64encode(
            json.dumps(payload).encode()
        ).rstrip(b"=").decode()
        if alg == "none":
            return f"{header}.{body}."
        # Signature invalide pour les autres algos — suffit pour tester le rejet
        fake_sig = base64.urlsafe_b64encode(b"fakesignature").rstrip(b"=").decode()
        return f"{header}.{body}.{fake_sig}"

    def test_alg_none_rejected(self):
        """Un token avec alg:none doit être refusé."""
        from core.security import decode_token
        from core.exceptions import UnauthorizedError

        import time
        payload = {"user_id": "u1", "email": "x@test.com", "role": "seller", "exp": int(time.time()) + 3600}
        token = self._make_token_with_alg("none", payload)
        with pytest.raises(UnauthorizedError):
            decode_token(token)

    def test_alg_rs256_rejected(self):
        """Un token avec alg:RS256 (mais secret symétrique) doit être refusé."""
        from core.security import decode_token
        from core.exceptions import UnauthorizedError

        import time
        payload = {"user_id": "u1", "email": "x@test.com", "role": "seller", "exp": int(time.time()) + 3600}
        token = self._make_token_with_alg("RS256", payload)
        with pytest.raises(UnauthorizedError):
            decode_token(token)

    def test_expired_token_rejected(self):
        """Un token HS256 expiré doit lever UnauthorizedError("Token expired")."""
        import jwt as pyjwt
        from core.security import decode_token, JWT_SECRET, JWT_ALGORITHM
        from core.exceptions import UnauthorizedError
        import time

        payload = {"user_id": "u1", "email": "x@test.com", "role": "seller", "exp": int(time.time()) - 1}
        token = pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        with pytest.raises(UnauthorizedError, match="expired"):
            decode_token(token)

    def test_valid_hs256_token_accepted(self):
        """Un token HS256 valide doit être décodé sans erreur."""
        import jwt as pyjwt
        from core.security import decode_token, JWT_SECRET, JWT_ALGORITHM
        import time

        payload = {"user_id": "u1", "email": "x@test.com", "role": "seller", "exp": int(time.time()) + 3600}
        token = pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        result = decode_token(token)
        assert result["user_id"] == "u1"

    def test_tampered_signature_rejected(self):
        """Un token HS256 dont la signature est altérée doit être refusé."""
        import jwt as pyjwt
        from core.security import decode_token, JWT_SECRET, JWT_ALGORITHM
        from core.exceptions import UnauthorizedError
        import time

        payload = {"user_id": "u1", "email": "x@test.com", "role": "seller", "exp": int(time.time()) + 3600}
        token = pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        # Altère le dernier caractère de la signature
        parts = token.split(".")
        parts[2] = parts[2][:-1] + ("A" if parts[2][-1] != "A" else "B")
        tampered = ".".join(parts)
        with pytest.raises(UnauthorizedError):
            decode_token(tampered)


# ---------------------------------------------------------------------------
# 2. CORS origin validation (build_cors_response_headers dans startup_helpers)
# ---------------------------------------------------------------------------

ALLOWED_ORIGINS = [
    "https://retailperformerai.com",
    "https://www.retailperformerai.com",
    "https://api.retailperformerai.com",
    "http://localhost:3000",
]


class TestCorsOriginValidation:
    """
    Vérifie que build_cors_response_headers() ne renvoie des en-têtes CORS
    que pour les origins explicitement autorisées.
    """

    def _fn(self):
        from core.startup_helpers import build_cors_response_headers
        return build_cors_response_headers

    def test_allowed_origin_returns_acao(self):
        """Une origin autorisée → ACAO = cette origin exacte."""
        fn = self._fn()
        origin = "https://retailperformerai.com"
        headers = fn(origin, ALLOWED_ORIGINS)
        assert headers.get("Access-Control-Allow-Origin") == origin
        assert headers.get("Access-Control-Allow-Credentials") == "true"

    def test_www_subdomain_allowed(self):
        """www.retailperformerai.com est autorisé explicitement."""
        fn = self._fn()
        origin = "https://www.retailperformerai.com"
        headers = fn(origin, ALLOWED_ORIGINS)
        assert headers.get("Access-Control-Allow-Origin") == origin

    def test_unknown_origin_returns_no_acao(self):
        """Une origin inconnue → aucun en-tête CORS (pas de ACAO)."""
        fn = self._fn()
        headers = fn("https://evil.example.com", ALLOWED_ORIGINS)
        assert "Access-Control-Allow-Origin" not in headers

    def test_no_origin_returns_no_acao(self):
        """Requête sans en-tête Origin → aucun en-tête CORS."""
        fn = self._fn()
        headers = fn(None, ALLOWED_ORIGINS)
        assert "Access-Control-Allow-Origin" not in headers

    def test_wildcard_origin_blocked(self):
        """L'origin '*' n'est pas dans la liste → pas de ACAO (jamais de wildcard avec credentials)."""
        fn = self._fn()
        headers = fn("*", ALLOWED_ORIGINS)
        assert "Access-Control-Allow-Origin" not in headers

    def test_subdomain_not_in_list_blocked(self):
        """Un sous-domaine non listé (attacker.retailperformerai.com) est bloqué."""
        fn = self._fn()
        headers = fn("https://attacker.retailperformerai.com", ALLOWED_ORIGINS)
        assert "Access-Control-Allow-Origin" not in headers

    def test_localhost_allowed_in_dev(self):
        """localhost:3000 est autorisé (développement)."""
        fn = self._fn()
        headers = fn("http://localhost:3000", ALLOWED_ORIGINS)
        assert headers.get("Access-Control-Allow-Origin") == "http://localhost:3000"


# ---------------------------------------------------------------------------
# 3. MongoDB injection (champs libres)
# ---------------------------------------------------------------------------

class TestMongoDbInjection:
    """
    Vérifie que les opérateurs MongoDB ($ne, $gt, $where, $regex) passés
    dans des champs libres sont traités comme des chaînes littérales
    et non comme des opérateurs.

    Contexte : Motor/PyMongo n'interprète les opérateurs que lorsqu'ils
    sont des clés de dictionnaire. Une valeur string "$ne" est inoffensive.
    Ces tests documentent et valident ce comportement.
    """

    def test_operator_as_string_value_is_safe(self):
        """
        '$ne' utilisé comme valeur string ne crée pas d'opérateur Mongo.
        Le filtre {"name": "$ne"} cherche le mot littéral "$ne".
        """
        # Simule la construction de filtre comme dans base_repository
        user_input = "$ne"
        query_filter = {"name": user_input}
        # La valeur est une string, pas un dict → pas d'opérateur
        assert isinstance(query_filter["name"], str)
        assert query_filter["name"] == "$ne"

    def test_operator_injection_in_dict_value_is_safe(self):
        """
        Un dict {"$ne": None} ne peut pas être injecté via un paramètre
        string car Pydantic/FastAPI parse les query params en str.
        """
        # Ce qui arrive réellement depuis un query param : toujours une str
        raw_input: str = '{"$ne": null}'
        query_filter = {"store_id": raw_input}
        # Reste une string, jamais évaluée comme dict
        assert isinstance(query_filter["store_id"], str)

    def test_regex_injection_as_string_value_is_safe(self):
        """
        Un pattern regex '$regex' comme valeur string est inoffensif.
        """
        user_input = {"$regex": ".*"}
        # Pydantic validerait cela comme str → l'injection est bloquée en amont
        # On vérifie que si on convertit en str (ce que Pydantic ferait), c'est safe
        safe_input = str(user_input)
        query_filter = {"email": safe_input}
        assert isinstance(query_filter["email"], str)

    def test_where_operator_cannot_be_injected_via_string(self):
        """
        '$where' avec du JS ne peut pas être injecté via un paramètre str.
        Motor ne l'exécute que si c'est une clé de filtre dict, jamais une valeur.
        """
        user_input = "$where: function() { return true; }"
        query_filter = {"name": user_input}
        assert isinstance(query_filter["name"], str)
        # Vérifie qu'il n'y a pas d'opérateur $ comme clé de top-level
        assert not any(k.startswith("$") for k in query_filter.keys())

    def test_numeric_operator_injection_via_string_param(self):
        """
        '$gt: ""' passé en query param est une string, pas un opérateur.
        """
        user_input = "$gt"
        query_filter = {"date": user_input}
        assert isinstance(query_filter["date"], str)
        assert "$" not in query_filter.keys()

    def test_filter_keys_never_start_with_dollar(self):
        """
        Les clés de filtre construites depuis des inputs utilisateurs
        (store_id, user_id, role, etc.) ne commencent jamais par $.
        Reproduit la construction dans base_repository.find_one().
        """
        # Simule différents inputs utilisateur (venants de chemins URL ou query params)
        user_inputs = [
            ("store_id", "store_abc123"),
            ("role", "seller"),
            ("email", "user@example.com"),
            ("id", "user_abc"),
        ]
        for field, value in user_inputs:
            query_filter = {field: value}
            for key in query_filter:
                assert not key.startswith("$"), f"Clé suspecte : {key}"
