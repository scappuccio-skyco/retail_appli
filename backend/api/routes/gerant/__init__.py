"""
Gérant routes package.
Assembles all gérant sub-routers under the /gerant prefix.
"""
from fastapi import APIRouter

from api.routes.gerant.profile import router as profile_router
from api.routes.gerant.stores import router as stores_router
from api.routes.gerant.staff import router as staff_router
from api.routes.gerant.subscription_status import router as subscription_status_router
from api.routes.gerant.subscription_seats import router as subscription_seats_router
from api.routes.gerant.subscription_stripe import router as subscription_stripe_router
from api.routes.gerant.subscription_lifecycle import router as subscription_lifecycle_router
from api.routes.gerant.billing import router as billing_router
from api.routes.gerant.misc import router as misc_router

router = APIRouter(prefix="/gerant", tags=["Gérant"])

router.include_router(profile_router)
router.include_router(stores_router)
router.include_router(staff_router)
router.include_router(subscription_status_router)
router.include_router(subscription_seats_router)
router.include_router(subscription_stripe_router)
router.include_router(subscription_lifecycle_router)
router.include_router(billing_router)
router.include_router(misc_router)
