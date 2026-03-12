/**
 * Point d'entrée unique pour tous les services API.
 *
 * Usage :
 *   import { sellerService, managerService } from '../services';
 *   import sellerService from '../services/sellerService'; // import direct aussi valide
 */
export { default as authService } from './authService';
export { default as sellerService, debriefService, evaluationService } from './sellerService';
export { default as managerService } from './managerService';
export { default as gerantService } from './gerantService';
export { default as subscriptionService } from './subscriptionService';
export { default as aiService } from './aiService';
export { default as superadminService } from './superadminService';
