'use client';

import React, { useState, useRef } from 'react';
import AudioRecorder, { AudioRecorderRef } from './AudioRecorder';
import { Mic, MessageSquare } from 'lucide-react';
import type { CompanyContextType } from '@/lib/contexts/CompanyContext';
import type { Campaign, CampaignQuestion } from '@/types/campaign';
import { TextQuestion, RatingQuestion, MultipleChoiceQuestion, YesNoQuestion } from './questions/QuestionTypes';

interface FeedbackFormProps {
  orderId: string;
  companyId: string;
  campaignId?: string;
  companyData: CompanyContextType | null;
  campaignData: Campaign | null;
}

export default function FeedbackForm({ 
  orderId, 
  companyId, 
  campaignId,
  companyData,
  campaignData 
}: FeedbackFormProps) {
  const [npsScore, setNpsScore] = useState<number | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [textFeedback, setTextFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'voice' | 'text'>(
    campaignData?.settings?.allowVoice ? 'voice' : 'text'
  );
  const [questionResponses, setQuestionResponses] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const audioRecorderRef = useRef<AudioRecorderRef>(null);
  const [showOrderInput, setShowOrderInput] = useState(!orderId);
  const [localOrderId, setLocalOrderId] = useState(orderId);

  const handleQuestionResponse = (questionId: string, value: any) => {
    setQuestionResponses(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleSubmit = async () => {
    if (!consent) {
      setError('Please accept the consent notice to submit feedback');
      return;
    }

    if (campaignData?.include_nps && !npsScore) {
      setError('Please provide an NPS score');
      return;
    }
    
    if (!localOrderId && showOrderInput && campaignData?.settings.requireOrderId) {
      setError('Please provide an order ID');
      return;
    }

    // Validate required questions
    if (campaignData?.include_additional_questions) {
      const missingRequired = campaignData.questions.some(
        q => q.required && !questionResponses[q.id]
      );

      if (missingRequired) {
        setError('Please answer all required questions');
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (audioRecorderRef.current) {
        audioRecorderRef.current.stopRecording();
      }

      const formData = new FormData();
      if (feedbackType === 'voice' && audioBlob) {
        formData.append('audio', audioBlob);
      } else if (feedbackType === 'text' && textFeedback) {
        formData.append('textFeedback', textFeedback);
      }
      
      formData.append('orderId', localOrderId);
      formData.append('companyId', companyId);
      if (campaignId) {
        formData.append('campaignId', campaignId);
      }
      if (campaignData?.include_nps && npsScore) {
        formData.append('npsScore', npsScore.toString());
      }
      if (Object.keys(questionResponses).length > 0) {
        formData.append('questionResponses', JSON.stringify(questionResponses));
      }

      const response = await fetch('/api/save-feedback', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }

      setSubmitted(true);
    } catch (err) {
      setError('Failed to submit feedback. Please try again.');
      console.error('Submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Thank You!</h2>
        <p className="text-gray-600">Your feedback has been recorded.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        Share Your {companyData?.name || 'Experience'}
      </h1>

      {showOrderInput && campaignData?.settings.requireOrderId && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Order ID
          </label>
          <input
            type="text"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            value={localOrderId}
            onChange={(e) => setLocalOrderId(e.target.value)}
          />
        </div>
      )}

      {/* NPS Question */}
      {campaignData?.include_nps && (
        <div className="mb-8">
          <p className="text-gray-600 mb-4">
            {campaignData.npsQuestion}
          </p>
          <div className="flex justify-between gap-1">
            {[...Array(10)].map((_, i) => {
              const score = i + 1;
              const getScoreColor = (score: number) => {
                if (score <= 6) return ['bg-red-500 hover:bg-red-600', 'bg-red-300'];
                if (score <= 8) return ['bg-yellow-500 hover:bg-yellow-600', 'bg-yellow-300'];
                return ['bg-green-500 hover:bg-green-600', 'bg-green-300'];
              };
              const [activeColor, inactiveColor] = getScoreColor(score);

              return (
                <button
                  key={score}
                  type="button"
                  onClick={() => setNpsScore(score)}
                  className={`w-10 h-10 rounded-full text-white font-semibold transition-all duration-200
                    ${npsScore === score ? activeColor + ' ring-2 ring-blue-500 ring-offset-2' : inactiveColor + ' opacity-60 hover:opacity-80'}`}
                >
                  {score}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-sm text-gray-500">Not likely</span>
            <span className="text-sm text-gray-500">Very likely</span>
          </div>
        </div>
      )}

      {/* Additional Questions */}
      {campaignData?.include_additional_questions && campaignData.questions.length > 0 && (
        <div className="space-y-8 mb-8">
          {campaignData.questions.map((question) => (
            <div key={question.id} className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {question.text}
                {question.required && <span className="text-red-500 ml-1">*</span>}
              </label>

              <div className="mt-1">
                {question.type === 'text' && (
                  <TextQuestion
                    question={question}
                    value={questionResponses[question.id]}
                    onChange={(value) => handleQuestionResponse(question.id, value)}
                  />
                )}
                {question.type === 'rating' && (
                  <RatingQuestion
                    question={question}
                    value={questionResponses[question.id]}
                    onChange={(value) => handleQuestionResponse(question.id, value)}
                  />
                )}
                {question.type === 'multiple_choice' && (
                  <MultipleChoiceQuestion
                    question={question}
                    value={questionResponses[question.id]}
                    onChange={(value) => handleQuestionResponse(question.id, value)}
                  />
                )}
                {question.type === 'yes_no' && (
                  <YesNoQuestion
                    question={question}
                    value={questionResponses[question.id]}
                    onChange={(value) => handleQuestionResponse(question.id, value)}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Voice/Text Feedback Section */}
      <div className="space-y-4 mb-8">
        <p className="text-gray-700">Additional feedback:</p>
        
        {campaignData?.settings.allowVoice && campaignData?.settings.allowText && (
          <div className="flex justify-center space-x-4 mb-6">
            <button
              type="button"
              onClick={() => setFeedbackType('voice')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                feedbackType === 'voice'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Mic className="w-5 h-5" />
              Voice Feedback
            </button>
            <button
              type="button"
              onClick={() => setFeedbackType('text')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                feedbackType === 'text'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
              Text Feedback
            </button>
          </div>
        )}

        {feedbackType === 'voice' && campaignData?.settings.allowVoice ? (
          <div>
            <p className="text-gray-600 mb-4">
              Record your feedback (max 5 minutes):
            </p>
            <AudioRecorder 
              onRecordingComplete={setAudioBlob}
              ref={audioRecorderRef}
            />
          </div>
        ) : campaignData?.settings.allowText ? (
          <div>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md h-32"
              value={textFeedback}
              onChange={(e) => setTextFeedback(e.target.value)}
              placeholder="Please share your thoughts..."
            />
          </div>
        ) : null}
      </div>

      {/* Consent and Submit */}
      <div className="space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1"
          />
          <span className="text-sm text-gray-600">
            I consent to {companyData?.name || 'the company'} collecting and processing my feedback
            {feedbackType === 'voice' && ' and voice recording'}, 
            including processing on US-based servers. I understand this data will be used to improve products and services. 
            View our full <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>.
          </span>
        </label>

        {error && (
          <div className="p-3 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 
                   disabled:cursor-not-allowed text-white font-semibold py-3 
                   px-4 rounded-lg flex items-center justify-center gap-2"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
        </button>
      </div>
    </div>
  );
}