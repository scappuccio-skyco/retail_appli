import React from 'react';
import { Building2, MapPin, Phone, Mail, Edit2, Save, X, Users, Loader2 } from 'lucide-react';

const STORE_COLORS = [
  { bg: 'bg-orange-50', border: 'border-orange-200', header: 'bg-gradient-to-r from-orange-500 to-orange-600', text: 'text-orange-600' },
  { bg: 'bg-blue-50', border: 'border-blue-200', header: 'bg-gradient-to-r from-blue-500 to-blue-600', text: 'text-blue-600' },
  { bg: 'bg-purple-50', border: 'border-purple-200', header: 'bg-gradient-to-r from-purple-500 to-purple-600', text: 'text-purple-600' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', header: 'bg-gradient-to-r from-emerald-500 to-emerald-600', text: 'text-emerald-600' },
  { bg: 'bg-pink-50', border: 'border-pink-200', header: 'bg-gradient-to-r from-pink-500 to-pink-600', text: 'text-pink-600' },
  { bg: 'bg-cyan-50', border: 'border-cyan-200', header: 'bg-gradient-to-r from-cyan-500 to-cyan-600', text: 'text-cyan-600' },
];

const INPUT_CLASS = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500';

const EDIT_FIELDS = [
  { key: 'name', label: 'Nom du magasin *', type: 'text', placeholder: 'Ex: Boutique Centre-Ville' },
  { key: 'location', label: 'Ville / Localisation', type: 'text', placeholder: 'Ex: Paris 8ème' },
  { key: 'address', label: 'Adresse complète', type: 'text', placeholder: 'Ex: 123 Rue de la Paix, 75008 Paris' },
  { key: 'phone', label: 'Téléphone', type: 'tel', placeholder: 'Ex: 01 23 45 67 89' },
  { key: 'email', label: 'Email du magasin', type: 'email', placeholder: 'Ex: contact@boutique.fr' },
  { key: 'description', label: 'Description / Notes', type: 'text', placeholder: 'Ex: Flagship store, ouvert 7j/7' },
];

export default function StoreCard({ store, colorIndex, isEditing, editForm, saving, isReadOnly, onEdit, onSave, onCancel, onInputChange }) {
  const colors = STORE_COLORS[colorIndex % STORE_COLORS.length];

  return (
    <div className={`rounded-xl overflow-hidden border-2 ${colors.border} ${colors.bg} shadow-sm hover:shadow-md transition-all`}>
      {/* Header */}
      <div className={`${colors.header} px-6 py-4 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{store.name}</h3>
            <p className="text-white/80 text-sm flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {store.location || 'Non définie'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{store.manager_count || 0}</p>
            <p className="text-white/80 text-xs">Manager{(store.manager_count || 0) > 1 ? 's' : ''}</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{store.seller_count || 0}</p>
            <p className="text-white/80 text-xs">Vendeur{(store.seller_count || 0) > 1 ? 's' : ''}</p>
          </div>

          {isEditing ? (
            <div className="flex gap-2">
              <button onClick={() => onSave(store.id)} disabled={saving} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors" title="Enregistrer">
                {saving ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Save className="w-5 h-5 text-white" />}
              </button>
              <button onClick={onCancel} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors" title="Annuler">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onEdit(store)}
              disabled={isReadOnly}
              className={`p-2 rounded-lg transition-colors ${isReadOnly ? 'bg-white/10 cursor-not-allowed' : 'bg-white/20 hover:bg-white/30'}`}
              title={isReadOnly ? 'Mode lecture seule' : 'Modifier'}
            >
              <Edit2 className="w-5 h-5 text-white" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-6">
        {isEditing ? (
          <div className="grid md:grid-cols-2 gap-4">
            {EDIT_FIELDS.map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input
                  type={type}
                  value={editForm[key] || ''}
                  onChange={(e) => onInputChange(key, e.target.value)}
                  className={INPUT_CLASS}
                  placeholder={placeholder}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <h4 className={`text-sm font-semibold ${colors.text} uppercase tracking-wide`}>Coordonnées</h4>
              {store.address && <p className="text-gray-700 text-sm flex items-start gap-2"><MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />{store.address}</p>}
              {store.phone && <p className="text-gray-700 text-sm flex items-center gap-2"><Phone className="w-4 h-4 text-gray-400" />{store.phone}</p>}
              {store.email && <p className="text-gray-700 text-sm flex items-center gap-2"><Mail className="w-4 h-4 text-gray-400" />{store.email}</p>}
              {!store.address && !store.phone && !store.email && <p className="text-gray-400 text-sm italic">Aucune coordonnée renseignée</p>}
            </div>
            <div className="space-y-3">
              <h4 className={`text-sm font-semibold ${colors.text} uppercase tracking-wide`}>Équipe</h4>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2"><Users className="w-4 h-4 text-gray-400" /><span className="text-gray-700"><strong>{store.manager_count || 0}</strong> manager{(store.manager_count || 0) > 1 ? 's' : ''}</span></div>
                <div className="flex items-center gap-2"><Users className="w-4 h-4 text-gray-400" /><span className="text-gray-700"><strong>{store.seller_count || 0}</strong> vendeur{(store.seller_count || 0) > 1 ? 's' : ''}</span></div>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className={`text-sm font-semibold ${colors.text} uppercase tracking-wide`}>Notes</h4>
              {store.description ? <p className="text-gray-700 text-sm">{store.description}</p> : <p className="text-gray-400 text-sm italic">Aucune description</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
