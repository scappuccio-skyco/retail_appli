import React from 'react';

export default function DiagnosticQuestions({ questions, responses, onAnswer, isModal }) {
  return (
    <div className={`p-6 ${isModal ? 'max-h-[60vh] overflow-y-auto' : ''}`}>
      {questions.map((section, sectionIdx) => (
        <div key={sectionIdx} className="mb-8">
          <h3 className="text-lg font-bold text-gray-800 mb-4">{section.section}</h3>

          {section.items.map((question) => (
            <div key={question.id} className="mb-6 bg-gray-50 rounded-xl p-5">
              <p className="text-gray-800 font-medium mb-4">
                {question.id}. {question.text}
              </p>

              {question.type === 'choice' && (
                <div className="space-y-2">
                  {question.options.map((option, optionIdx) => {
                    const isSelected = responses[question.id] === option;
                    return (
                      <button
                        key={optionIdx}
                        onClick={() => onAnswer(question.id, option)}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                          isSelected
                            ? 'border-[#ffd871] bg-[#ffd871] bg-opacity-20 font-medium'
                            : 'border-gray-200 hover:border-[#ffd871] hover:bg-gray-100'
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
