// src/components/questions/VoiceTextQuestion.tsx
'use client';

import { useState, useRef } from 'react';
import { Mic, MessageSquare, Square, Play, Pause, Trash2 } from 'lucide-react';
import AudioRecorder, { AudioRecorderRef } from '../AudioRecorder';
import { translate } from '@/lib/translations';

interface VoiceTextQuestionProps {
  question: any;
  textValue: string;
  onTextChange: (value: string) => void;
  onVoiceRecording: (blob: Blob | null) => void;
  companyColor?: string | null;
  language?: string;
  enableGamification?: boolean; // Add support for gamification toggle
}

export default function VoiceTextQuestion({
  question,
  textValue,
  onTextChange,
  onVoiceRecording,
  companyColor = '#657567',
  language = 'en',
  enableGamification = true // Default to true to maintain backward compatibility
}: VoiceTextQuestionProps) {
  const [responseType, setResponseType] = useState<'text' | 'voice'>(
    (question.allowVoice) ? 'voice' : 'text'
  );
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const audioRecorderRef = useRef<AudioRecorderRef>(null);
  

  // Helper function for translations
  const t = (key: string, replacements: Record<string, string> = {}) => {
    return translate(language, key, replacements);
  };

  // Handle recording complete
  const handleRecordingComplete = (blob: Blob | null) => {
    setAudioBlob(blob);
    onVoiceRecording(blob);
  };

  // Handle playback
  const togglePlayback = () => {
    if (!audioBlob) return;

    if (!audioPlayerRef.current) {
      audioPlayerRef.current = new Audio(URL.createObjectURL(audioBlob));
      audioPlayerRef.current.onended = () => setIsPlaying(false);
    }

    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  // Handle discarding recording
  const discardRecording = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    setAudioBlob(null);
    setIsPlaying(false);
    onVoiceRecording(null);
  };

  // Only show tabs if both voice and text are allowed
  const showTabs = question.allowVoice && question.allowText;

  return (
    <div className="space-y-4">
{showTabs && (
  <div className="flex justify-center space-x-2 mt-6 mb-4">
{question.allowVoice && (
  <button
    type="button"
    onClick={() => setResponseType('voice')}
    className={`px-6 py-3 rounded-lg text-sm flex items-center gap-2 transition-all transform hover:scale-105 
      ${responseType === 'voice' ? 
        'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg ring-2 ring-green-500 ring-offset-2' : 
        'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
  >
    <Mic className="w-5 h-5" />
    <span className="font-semibold">
      {responseType === 'voice' 
        ? `${t('form.voiceSelected')}` 
        : `${t('form.useVoiceRecommended')}`}
    </span>
  </button>
)}
    {question.allowText && (
      <button
        type="button"
        onClick={() => setResponseType('text')}
        className={`px-3 py-2 rounded-lg text-sm flex items-center gap-1 transition-colors 
          ${responseType === 'text' ? 
            'bg-gray-700 text-white' : 
            'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
      >
        <MessageSquare className="w-4 h-4" />
        {t('form.textResponse')}
      </button>
    )}
  </div>
)}

      {responseType === 'text' && question.allowText && (
        <textarea
          value={textValue}
          onChange={(e) => onTextChange(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg font-manrope h-24 focus:outline-none"
          placeholder={t('form.typeAnswerHere')}
        />
      )}

      {responseType === 'voice' && question.allowVoice && (
        <div className="border border-gray-200 rounded-lg p-4">
          {!audioBlob ? (
            <AudioRecorder
              onRecordingComplete={handleRecordingComplete}
              ref={audioRecorderRef}
              companyColor={companyColor || '#657567'}
              language={language}
              enableGamification={enableGamification} // Pass the gamification toggle
            />
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="flex gap-3">
                <button
                  onClick={togglePlayback}
                  className="p-3 rounded-full transition-colors duration-200"
                  style={{ backgroundColor: companyColor || '#657567' }}
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6 text-white" />
                  ) : (
                    <Play className="w-6 h-6 text-white" />
                  )}
                </button>
                <button
                  onClick={discardRecording}
                  className="p-3 rounded-full bg-red-500 hover:bg-red-600 transition-colors duration-200"
                  aria-label="Discard recording"
                >
                  <Trash2 className="w-6 h-6 text-white" />
                </button>
              </div>
              <p className="text-sm text-gray-600">
                {t('form.recordingComplete')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}