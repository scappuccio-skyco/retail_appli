import React from 'react';
import { X } from 'lucide-react';
import NewBriefTab from './morningBrief/NewBriefTab';
import HistoryTab from './morningBrief/HistoryTab';
import useMorningBrief from './morningBrief/useMorningBrief';

const MorningBriefModal = ({ isOpen, onClose, storeName, managerName, storeId }) => {
  const {
    comments, setComments,
    objectiveDaily, setObjectiveDaily,
    isLoading, brief,
    copied, activeTab, setActiveTab,
    history, loadingHistory,
    expandedItems, setExpandedItems,
    exportingPDF, briefContentRef,
    handleGenerate, handleDeleteBrief, handleCopy, handleRegenerate, handleClose,
    handleExportPDF,
  } = useMorningBrief({ storeId, storeName, onClose });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-white">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <span>☕</span> Brief du Matin
            </h2>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-6">
          <div className="flex gap-4">
            {['new', 'history'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 font-semibold transition-colors border-b-2 ${
                  activeTab === tab
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                {tab === 'new' ? 'Nouveau Brief' : `Historique (${history.length})`}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 max-h-[calc(80vh-180px)]">
          {activeTab === 'new' && (
            <NewBriefTab
              storeName={storeName}
              managerName={managerName}
              objectiveDaily={objectiveDaily}
              setObjectiveDaily={setObjectiveDaily}
              comments={comments}
              setComments={setComments}
              isLoading={isLoading}
              brief={brief}
              handleGenerate={handleGenerate}
              handleRegenerate={handleRegenerate}
              handleCopy={handleCopy}
              handleClose={handleClose}
              exportBriefToPDF={handleExportPDF}
              copied={copied}
              exportingPDF={exportingPDF}
              briefContentRef={briefContentRef}
            />
          )}
          {activeTab === 'history' && (
            <HistoryTab
              history={history}
              loadingHistory={loadingHistory}
              expandedItems={expandedItems}
              setExpandedItems={setExpandedItems}
              setActiveTab={setActiveTab}
              handleDeleteBrief={handleDeleteBrief}
              handleCopy={handleCopy}
              exportBriefToPDF={handleExportPDF}
            />
          )}
        </div>

        {/* Footer */}
        {activeTab === 'new' && !brief && !isLoading && (
          <div className="border-t border-gray-100 p-4 bg-gray-50">
            <p className="text-xs text-gray-500 text-center">
              💡 Lisez ce brief à voix haute à votre équipe en 3 minutes max !
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MorningBriefModal;
