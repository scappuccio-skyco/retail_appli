--- backend/api/dependencies.py
+++ backend/api/dependencies.py
@@ -176,6 +176,6 @@ def get_integration_service(db: AsyncIOMotorDatabase = Depends(get_db)) -> IntegrationService:
         return await integration_service.create_api_key(...)
     """
     integration_repo = IntegrationRepository(db)
-    return IntegrationService(integration_repo)
+    return IntegrationService(integration_repo, db)
 
 
 # API Key Service (for manager routes)

