'use client';

import { useState } from 'react';
import { FileText, Code, Table, Clock, DollarSign, Copy, Download, CheckCircle } from 'lucide-react';

interface ResultViewerProps {
  results: {
    raw_text?: string;
    markdown?: string;
    json?: any;
    metrics?: {
      duration_ms: number;
      estimated_cost_usd: number;
      model: string;
    };
  };
}

export default function ResultViewer({ results }: ResultViewerProps) {
  const [activeTab, setActiveTab] = useState<'raw' | 'markdown' | 'json'>('raw');
  const [copied, setCopied] = useState(false);

  const tabs = [
    { id: 'raw', label: 'Testo Raw', icon: FileText },
    { id: 'markdown', label: 'Markdown', icon: Table },
    { id: 'json', label: 'JSON', icon: Code },
  ];

  const getCurrentContent = () => {
    switch (activeTab) {
      case 'raw':
        return results.raw_text || '';
      case 'markdown':
        return results.markdown || '';
      case 'json':
        return JSON.stringify(results.json, null, 2) || '';
      default:
        return '';
    }
  };

  const handleCopy = async () => {
    const content = getCurrentContent();
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const content = getCurrentContent();
    const extension = activeTab === 'json' ? 'json' : activeTab === 'markdown' ? 'md' : 'txt';
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ocr-result.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header with Tabs */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    activeTab === tab.id
                      ? 'bg-white text-indigo-600 shadow-md'
                      : 'text-gray-600 hover:bg-white/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-white transition-colors"
              title="Copia negli appunti"
            >
              {copied ? (
                <>
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-green-600">Copiato!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copia
                </>
              )}
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-white transition-colors"
              title="Scarica file"
            >
              <Download className="w-4 h-4" />
              Scarica
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-6">
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 max-h-[600px] overflow-auto">
          {activeTab === 'json' ? (
            <pre className="text-sm font-mono text-gray-800 whitespace-pre-wrap">
              {getCurrentContent()}
            </pre>
          ) : activeTab === 'markdown' ? (
            <div className="prose prose-sm max-w-none">
              <pre className="text-sm font-mono text-gray-800 whitespace-pre-wrap">
                {getCurrentContent()}
              </pre>
            </div>
          ) : (
            <pre className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
              {getCurrentContent()}
            </pre>
          )}
        </div>
      </div>

      {/* Metrics Footer */}
      {results.metrics && (
        <div className="border-t border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                <span className="text-sm text-gray-700">
                  <strong className="font-semibold">Tempo:</strong>{' '}
                  {(results.metrics.duration_ms / 1000).toFixed(2)}s
                </span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-700">
                  <strong className="font-semibold">Costo:</strong>{' '}
                  ${results.metrics.estimated_cost_usd.toFixed(4)}
                </span>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              Model: {results.metrics.model}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
