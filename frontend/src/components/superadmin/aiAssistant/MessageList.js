import React from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const MD_COMPONENTS = {
  h1: ({ node, ...props }) => <h1 className="text-xl font-bold text-purple-200 mb-3 mt-4 first:mt-0" {...props} />,
  h2: ({ node, ...props }) => <h2 className="text-lg font-semibold text-purple-300 mb-2 mt-3 first:mt-0" {...props} />,
  h3: ({ node, ...props }) => <h3 className="text-base font-semibold text-purple-300 mb-2 mt-2 first:mt-0" {...props} />,
  p: ({ node, ...props }) => <p className="mb-2 last:mb-0 text-white leading-relaxed" {...props} />,
  ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-3 space-y-1 text-white" {...props} />,
  ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-3 space-y-1 text-white" {...props} />,
  li: ({ node, ...props }) => <li className="ml-2 text-white" {...props} />,
  strong: ({ node, ...props }) => <strong className="font-bold text-purple-200" {...props} />,
  em: ({ node, ...props }) => <em className="italic text-purple-200" {...props} />,
  code: ({ node, inline, ...props }) => inline
    ? <code className="px-1.5 py-0.5 bg-black/30 rounded text-purple-200 text-sm font-mono" {...props} />
    : <code className="block p-2 bg-black/30 rounded text-purple-200 text-sm font-mono my-2 overflow-x-auto" {...props} />,
  blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-purple-500 pl-4 my-2 italic text-purple-200" {...props} />,
  a: ({ node, ...props }) => <a className="text-purple-400 hover:text-purple-300 underline" {...props} />,
  hr: ({ node, ...props }) => <hr className="my-4 border-white/20" {...props} />,
};

const QUICK_PROMPTS = [
  { label: '📊 Analyser les erreurs récentes', text: "Pourquoi ai-je autant d'erreurs dans les logs aujourd'hui ?" },
  { label: '🔍 Vérifier les workspaces', text: 'Quels workspaces ont des problèmes actuellement ?' },
  { label: '💚 État de santé global', text: 'Donne-moi un résumé de la santé de la plateforme' },
  { label: '📜 Actions administratives', text: 'Quelles sont les actions admin récentes ?' },
];

export default function MessageList({ messages, loading, messagesEndRef, onQuickPrompt }) {
  if (messages.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center">
        <Sparkles className="w-16 h-16 text-purple-400 mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">Bienvenue dans l'Assistant IA</h3>
        <p className="text-purple-200 max-w-md mb-6">
          Je peux vous aider à diagnostiquer les problèmes, analyser les logs, et gérer votre plateforme. Posez-moi vos questions !
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
          {QUICK_PROMPTS.map(({ label, text }) => (
            <button
              key={label}
              onClick={() => onQuickPrompt(text)}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-lg text-left text-sm text-white transition-all"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {messages.map((msg, idx) => (
        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[80%] p-4 rounded-lg ${
            msg.role === 'user'
              ? 'bg-purple-600 text-white'
              : 'bg-white/10 text-white border border-white/20'
          }`}>
            {msg.role === 'user' ? (
              <div className="whitespace-pre-wrap">{msg.content}</div>
            ) : (
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown components={MD_COMPONENTS}>{msg.content}</ReactMarkdown>
              </div>
            )}
            <div className="text-xs opacity-70 mt-3">
              {new Date(msg.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      ))}

      {loading && (
        <div className="flex justify-start">
          <div className="bg-white/10 p-4 rounded-lg border border-white/20">
            <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </>
  );
}
