import React from 'react';
import { Database } from 'lucide-react';

/**
 * Displays the data sources used by the AI to produce an analysis.
 * Place at the bottom of any AI analysis output.
 *
 * Props:
 *   sources: string[] — list of data source labels
 */
export default function AIDataSources({ sources }) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-4 pt-3 border-t border-gray-100">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="flex items-center gap-1 text-xs text-gray-400 mr-1 flex-shrink-0">
          <Database className="w-3 h-3" />
          Analysé à partir de :
        </span>
        {sources.map((s, i) => (
          <span
            key={i}
            className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full border border-gray-200"
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
