"""
Test Email Delivery - Validation du système d'envoi d'emails
Test de tir réel avec Brevo API
"""
import sys
import os
sys.path.insert(0, '/app/backend')

from email_service import send_password_reset_email, get_brevo_api_instance
import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException


def test_brevo_connection():
    """Test 1: Vérifier que l'API Brevo est accessible"""
    print("\n🔍 TEST 1: Connexion à l'API Brevo...")
    
    try:
        api_instance = get_brevo_api_instance()
        
        # Vérifier que l'API key est configurée
        brevo_key = os.environ.get('BREVO_API_KEY')
        if not brevo_key:
            print("❌ ÉCHEC: BREVO_API_KEY n'est pas définie dans l'environnement")
            return False
        
        print(f"✅ API Key configurée: {brevo_key[:10]}...{brevo_key[-4:]}")
        print("✅ Instance API Brevo créée avec succès")
        return True
    except Exception as e:
        print(f"❌ ÉCHEC: Erreur lors de la création de l'instance API: {e}")
        return False


def test_simple_email():
    """Test 2: Envoyer un email simple de test"""
    print("\n📧 TEST 2: Envoi d'un email simple...")
    
    test_email = "test@example.com"  # Remplacez par votre email de test
    sender_email = os.environ.get('SENDER_EMAIL', 'hello@retailperformerai.com')
    sender_name = os.environ.get('SENDER_NAME', 'Retail Performer AI')
    
    html_content = """
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h1 style="color: #667eea;">✅ Test Email - Architecture OK</h1>
        <p>Cet email confirme que le système d'envoi d'emails fonctionne correctement.</p>
        <p><strong>Timestamp:</strong> {timestamp}</p>
    </body>
    </html>
    """.format(timestamp=__import__('datetime').datetime.now().isoformat())
    
    try:
        send_email = sib_api_v3_sdk.SendSmtpEmail(
            to=[{"email": test_email, "name": "Test User"}],
            sender={"email": sender_email, "name": sender_name},
            subject="🧪 Test Architecture - Email Delivery",
            html_content=html_content
        )
        
        api_instance = get_brevo_api_instance()
        api_response = api_instance.send_transac_email(send_email)
        
        print(f"✅ Email envoyé avec succès !")
        print(f"   📬 Destinataire: {test_email}")
        print(f"   📨 Message ID: {api_response.message_id}")
        print(f"   🔗 Réponse API: {api_response}")
        return True
    except ApiException as e:
        print(f"❌ ÉCHEC: Erreur API Brevo")
        print(f"   Status code: {e.status}")
        print(f"   Reason: {e.reason}")
        print(f"   Body: {e.body}")
        return False
    except Exception as e:
        print(f"❌ ÉCHEC: Erreur inattendue: {e}")
        return False


def test_password_reset_email():
    """Test 3: Tester la fonction send_password_reset_email"""
    print("\n🔐 TEST 3: Test de l'email de réinitialisation de mot de passe...")
    
    test_email = "test@example.com"  # Remplacez par votre email de test
    test_name = "Utilisateur Test"
    test_token = "test_token_123456789"
    
    try:
        result = send_password_reset_email(test_email, test_name, test_token)
        
        if result:
            print(f"✅ Email de réinitialisation envoyé avec succès !")
            print(f"   📬 Destinataire: {test_email}")
            print(f"   👤 Nom: {test_name}")
            print(f"   🔑 Token: {test_token[:10]}...")
            return True
        else:
            print(f"❌ ÉCHEC: La fonction a retourné False")
            return False
    except Exception as e:
        print(f"❌ ÉCHEC: Exception levée: {e}")
        import traceback
        traceback.print_exc()
        return False


def check_environment():
    """Vérifier les variables d'environnement nécessaires"""
    print("\n🔧 VÉRIFICATION DE LA CONFIGURATION:")
    print("=" * 60)
    
    required_vars = {
        'BREVO_API_KEY': 'Clé API Brevo',
        'SENDER_EMAIL': 'Email expéditeur',
        'SENDER_NAME': 'Nom expéditeur',
        'FRONTEND_URL': 'URL frontend'
    }
    
    all_ok = True
    for var, description in required_vars.items():
        value = os.environ.get(var)
        if value:
            # Masquer partiellement les valeurs sensibles
            if 'KEY' in var or 'SECRET' in var:
                display_value = f"{value[:10]}...{value[-4:]}" if len(value) > 14 else "***"
            else:
                display_value = value
            print(f"✅ {description:20} ({var:20}): {display_value}")
        else:
            print(f"❌ {description:20} ({var:20}): NON DÉFINIE")
            all_ok = False
    
    print("=" * 60)
    return all_ok


def main():
    """Exécuter tous les tests"""
    print("\n" + "=" * 60)
    print("🧪 TEST DE LIVRAISON D'EMAILS - RETAIL PERFORMER AI")
    print("=" * 60)
    
    # Vérifier l'environnement
    if not check_environment():
        print("\n⚠️  ATTENTION: Certaines variables d'environnement sont manquantes")
        print("   Les tests pourraient échouer.")
    
    # Exécuter les tests
    results = []
    results.append(("Connexion Brevo API", test_brevo_connection()))
    results.append(("Email simple", test_simple_email()))
    results.append(("Email reset password", test_password_reset_email()))
    
    # Afficher le résumé
    print("\n" + "=" * 60)
    print("📊 RÉSUMÉ DES TESTS")
    print("=" * 60)
    
    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    total_passed = sum(1 for _, passed in results if passed)
    total_tests = len(results)
    success_rate = (total_passed / total_tests) * 100 if total_tests > 0 else 0
    
    print("\n" + "=" * 60)
    print(f"🎯 RÉSULTAT: {total_passed}/{total_tests} tests réussis ({success_rate:.0f}%)")
    print("=" * 60)
    
    if total_passed == total_tests:
        print("\n🎉 TOUS LES TESTS ONT RÉUSSI ! Le système d'email fonctionne correctement.")
    else:
        print("\n⚠️  CERTAINS TESTS ONT ÉCHOUÉ. Vérifiez les erreurs ci-dessus.")


if __name__ == "__main__":
    main()
