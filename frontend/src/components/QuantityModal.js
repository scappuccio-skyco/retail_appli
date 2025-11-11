import React from 'react';
import { Crown, Loader } from 'lucide-react';

const PLANS = {
  starter: {
    name: 'Starter',
    pricePerSeller: 29,
    minSellers: 1,
    maxSellers: 5,
  },
  professional: {
    name: 'Professional', 
    pricePerSeller: 25,
    minSellers: 6,
    maxSellers: 15,
  }
};

export default function QuantityModal({ 
  isOpen,
  selectedPlan, 
  selectedQuantity, 
  sellerCount, 
  processingPlan, 
  onQuantityChange, 
  onBack, 
  onProceedToPayment 
}) {
  if (!isOpen || !selectedPlan) return null;

  const plan = PLANS[selectedPlan];
  const minQuantity = Math.max(sellerCount, plan.minSellers);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8">
        <h3 className="text-2xl font-bold text-gray-800 mb-2 text-center">
          Nombre de vendeurs
        </h3>
        <p className="text-gray-600 mb-6 text-center">
          Plan {plan.name} - {plan.pricePerSeller}€ par vendeur/mois
        </p>

        {/* Quantity Selector */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <button
              onClick={() => onQuantityChange(-1)}
              disabled={selectedQuantity <= minQuantity}
              className="w-12 h-12 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 rounded-full text-2xl font-bold transition-colors flex items-center justify-center"
            >
              −
            </button>
            
            <div className="text-center">
              <div className="text-6xl font-bold text-[#1E40AF] mb-1">
                {selectedQuantity}
              </div>
              <div className="text-sm text-gray-600">
                vendeur{selectedQuantity > 1 ? 's' : ''}
              </div>
            </div>
            
            <button
              onClick={() => onQuantityChange(1)}
              disabled={selectedQuantity >= plan.maxSellers}
              className="w-12 h-12 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 rounded-full text-2xl font-bold transition-colors flex items-center justify-center"
            >
              +
            </button>
          </div>

          <div className="text-center text-sm text-gray-500">
            Min: {minQuantity} • Max: {plan.maxSellers}
          </div>
        </div>

        {/* Price Calculation */}
        <div className="bg-blue-50 rounded-xl p-6 mb-6 border-2 border-blue-200">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-700">Prix par vendeur</span>
            <span className="font-semibold text-gray-800">
              {plan.pricePerSeller}€
            </span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-700">Quantité</span>
            <span className="font-semibold text-gray-800">
              × {selectedQuantity}
            </span>
          </div>
          <div className="border-t-2 border-blue-300 pt-2 mt-2">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold text-gray-800">Total</span>
              <span className="text-3xl font-bold text-[#1E40AF]">
                {plan.pricePerSeller * selectedQuantity}€
              </span>
            </div>
            <div className="text-right text-sm text-gray-600 mt-1">
              par mois
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onBack}
            disabled={processingPlan}
            className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
          >
            Retour
          </button>
          <button
            onClick={onProceedToPayment}
            disabled={processingPlan}
            className="flex-1 py-3 bg-[#1E40AF] text-white rounded-lg hover:bg-[#1E3A8A] transition-colors font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {processingPlan ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Chargement...
              </>
            ) : (
              <>
                <Crown className="w-5 h-5" />
                Procéder au paiement
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}