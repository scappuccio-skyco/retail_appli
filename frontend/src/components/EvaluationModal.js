import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, ShoppingBag } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function EvaluationModal({ sales, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    sale_id: '',
    store_name: '',
    total_amount: '',
    accueil: 3,
    decouverte: 3,
    argumentation: 3,
    closing: 3,
    fidelisation: 3,
    auto_comment: ''
  });
  const [createNewSale, setCreateNewSale] = useState(sales.length === 0);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let saleId = formData.sale_id;

      // Create sale if needed
      if (createNewSale) {
        const saleRes = await axios.post(`${API}/sales`, {
          store_name: formData.store_name,
          total_amount: parseFloat(formData.total_amount),
          comments: ''
        });
        saleId = saleRes.data.id;
      }

      // Create evaluation
      await axios.post(`${API}/evaluations`, {
        sale_id: saleId,
        accueil: formData.accueil,
        decouverte: formData.decouverte,
        argumentation: formData.argumentation,
        closing: formData.closing,
        fidelisation: formData.fidelisation,
        auto_comment: formData.auto_comment
      });

      toast.success('Évaluation créée avec succès!');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div data-testid="evaluation-modal" className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">Nouvelle Évaluation</h2>
          <button
            data-testid="close-modal-button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Sale Selection */}
          <div>
            <label className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                checked={createNewSale}
                onChange={(e) => setCreateNewSale(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm font-medium text-gray-700">Créer une nouvelle vente</span>
            </label>

            {createNewSale ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nom du magasin
                  </label>
                  <input
                    data-testid="store-name-input"
                    type="text"
                    required
                    value={formData.store_name}
                    onChange={(e) => setFormData({ ...formData, store_name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffd871] focus:border-transparent"
                    placeholder="Ex: Boutique Paris Centre"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Montant total (€)
                  </label>
                  <input
                    data-testid="total-amount-input"
                    type="number"
                    step="0.01"
                    required
                    value={formData.total_amount}
                    onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffd871] focus:border-transparent"
                    placeholder="Ex: 150.00"
                  />
                </div>
              </div>
            ) : (
              <select
                data-testid="sale-select"
                required
                value={formData.sale_id}
                onChange={(e) => setFormData({ ...formData, sale_id: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Sélectionnez une vente</option>
                {sales.map((sale) => (
                  <option key={sale.id} value={sale.id}>
                    {sale.store_name} - {sale.total_amount}€ - {new Date(sale.date).toLocaleDateString('fr-FR')}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Evaluation Scores */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Évaluez vos compétences (1-5)</h3>
            
            {['accueil', 'decouverte', 'argumentation', 'closing', 'fidelisation'].map((skill) => (
              <div key={skill}>
                <label className="block text-sm font-medium text-gray-700 mb-2 capitalize">
                  {skill}
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      data-testid={`${skill}-${value}`}
                      onClick={() => setFormData({ ...formData, [skill]: value })}
                      className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                        formData[skill] === value
                          ? 'bg-blue-600 text-white shadow-lg scale-105'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Comment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Commentaire (optionnel)
            </label>
            <textarea
              data-testid="comment-textarea"
              value={formData.auto_comment}
              onChange={(e) => setFormData({ ...formData, auto_comment: e.target.value })}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ajoutez vos observations..."
            />
          </div>

          {/* Submit */}
          <button
            data-testid="submit-evaluation-button"
            type="submit"
            disabled={loading}
            className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Création...' : 'Créer l\'\u00c9valuation'}
          </button>
        </form>
      </div>
    </div>
  );
}
