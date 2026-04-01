import { compatibilityMatrix } from './compatibilityMatrix';

export const getCompatibilityResult = (managementType, sellingStyle) => {
  if (!managementType || !sellingStyle) return null;
  return compatibilityMatrix[managementType]?.[sellingStyle] || null;
};
