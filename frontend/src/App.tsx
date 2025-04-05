import React, { useState, useRef, useEffect } from 'react';
import { Upload, Youtube, FileVideo, FileAudio, X, Link, Send, MessageSquare, Volume2, ChevronDown, RefreshCw } from 'lucide-react';

interface AnalysisState {
  file?: File;
  youtubeUrl?: string;
  isAnalyzing: boolean;
}

interface TranscriptResponse {
  transcript?: string;
  error?: string;
}

interface TranslationResponse {
  translated_text: string;
  error?: string;
}

interface ToneResponse {
  tone: string;
  error?: string;
}

function App() {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('english');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const [originalTranscript, setOriginalTranscript] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [toneInfo, setToneInfo] = useState<any>('');
  const [isAnalyzingTone, setIsAnalyzingTone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const languages = [
    'English', 'Spanish', 'French', 'German', 'Italian', 
    'Portuguese', 'Russian', 'Japanese', 'Korean', 'Chinese'
  ];

  const languageCodeMap: Record<string, string> = {
    'english': 'en',
    'spanish': 'es',
    'french': 'fr',
    'german': 'de',
    'italian': 'it',
    'portuguese': 'pt',
    'russian': 'ru',
    'japanese': 'ja',
    'korean': 'ko',
    'chinese': 'zh'
  };

  const actionItems = [
    'Summarize the key points discussed in the video',
    'Extract all action items mentioned',
    'Identify main speakers and their roles',
    'List all technical terms used',
    'Create a timeline of events discussed',
    'Note any deadlines or important dates mentioned'
  ];

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type.startsWith('audio/') || file.type.startsWith('video/')
    );
    
    if (droppedFiles.length > 0) {
      setFiles(prev => [...prev, ...droppedFiles]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(
        file => file.type.startsWith('audio/') || file.type.startsWith('video/')
      );
      setFiles(prev => [...prev, ...selectedFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Function to translate text when language changes
  const translateTranscript = async (language: string) => {
    // Don't translate if there's no transcript or we're already translating
    if (!originalTranscript || isTranslating) return;
    
    setIsTranslating(true);
    setError('');

    try {
      const response = await fetch('/api/translate-text/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language: languageCodeMap[language] || 'en'
        }),
      });

      const data: TranslationResponse = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else if (data.translated_text) {
        setTranscript(data.translated_text);
      }
    } catch (err) {
      setError('Failed to translate text. Please try again.');
      console.error('Translation error:', err);
    } finally {
      setIsTranslating(false);
    }
  };

  // Handle language change
  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = e.target.value;
    setSelectedLanguage(newLanguage);
    
    // If we're in analysis mode and have a transcript, translate it
    if (showAnalysis && originalTranscript) {
      translateTranscript(newLanguage);
    }
  };

  // Function to analyze tone
  const analyzeTone = async () => {
    // Don't analyze if there's no transcript or we're already analyzing
    if (!originalTranscript || isAnalyzingTone) return;
    
    setIsAnalyzingTone(true);
    setError('');

    try {
      const response = await fetch('/api/analyze-tone/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const data: ToneResponse = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else if (data) {
        setToneInfo(data);
      }
    } catch (err) {
      setError('Failed to analyze tone. Please try again.');
      console.error('Tone analysis error:', err);
    } finally {
      setIsAnalyzingTone(false);
    }
  };

  const handleSubmit = async () => {
    if (files.length === 0 && !youtubeUrl) {
      return;
    }

    setIsLoading(true);
    setError('');

    if (files.length > 0) {
      try {
        const formData = new FormData();
        formData.append('file', files[0]);
        
        // Get the language code from the selected language
        const languageCode = languageCodeMap[selectedLanguage] || 'en';
        
        // Append the language code to the form data
        formData.append('language_code', languageCode);

        const response = await fetch('/api/transcribe-audio/', {
          method: 'POST',
          body: formData,
        });

        const data: TranscriptResponse = await response.json();
        if (data.error) {
          setError(data.error);
        } else if (data.transcript) {
          setOriginalTranscript(data.transcript); // Store the original transcript
          setTranscript(data.transcript);
          setShowAnalysis(true);
          
          // Analyze tone after successful transcription
          await analyzeTone();
        }
      } catch (err) {
        setError('Failed to transcribe audio. Please try again.');
        console.error('Transcription error:', err);
      } finally {
        setIsLoading(false);
      }
    } else if (youtubeUrl) {
      // Handle YouTube URL (would need a different endpoint)
      setIsLoading(false);
      setShowAnalysis(true);
    }
  };

  const handleSendEmail = () => {
    if (email) {
      console.log('Sending email to:', email);
      setEmail('');
    }
  };

  if (showAnalysis) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column */}
          <div className="col-span-12 lg:col-span-7 space-y-6">
            {/* Video Player */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              {files.length > 0 ? (
                <video 
                  controls 
                  className="w-full aspect-video bg-black rounded"
                  src={URL.createObjectURL(files[0])}
                />
              ) : (
                <div className="w-full aspect-video bg-gray-100 rounded flex items-center justify-center">
                  <p className="text-gray-500">YouTube Video: {youtubeUrl}</p>
                </div>
              )}
            </div>

            {/* Language Selector */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="relative">
                <select
                  value={selectedLanguage}
                  onChange={handleLanguageChange}
                  className="w-full p-2 border border-gray-300 rounded-lg appearance-none pr-10 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  disabled={isTranslating}
                >
                  {languages.map((lang) => (
                    <option key={lang.toLowerCase()} value={lang.toLowerCase()}>
                      {lang}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
              {isTranslating && <p className="mt-2 text-sm text-purple-500">Translating...</p>}
            </div>

            {/* Transcript */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-medium mb-3">Transcript</h3>
              <div className="h-64 overflow-y-auto p-4 bg-gray-50 rounded">
                {error ? (
                  <p className="text-red-500">{error}</p>
                ) : (
                  <p className="text-gray-600">
                    {transcript || 'No transcript available.'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="col-span-12 lg:col-span-5 space-y-6">
            {/* Actions to Take */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-medium mb-3">Actions to Take</h3>
              <div className="h-48 overflow-y-auto pr-2">
                {actionItems.map((item, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded mb-2">
                    <p className="text-gray-600">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Email Input */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex space-x-2">
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  onClick={handleSendEmail}
                  className="p-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Speaker Tone */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Speaker Tone</h3>
                <button 
                  onClick={analyzeTone}
                  disabled={isAnalyzingTone || !originalTranscript}
                  className="text-purple-500 hover:text-purple-700 disabled:text-gray-300"
                  title="Refresh tone analysis"
                >
                  <RefreshCw className={`w-4 h-4 ${isAnalyzingTone ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="flex items-center space-x-3 mb-2">
                <Volume2 className="w-5 h-5 text-purple-500" />
                <span className="text-gray-700 font-medium">
                  {isAnalyzingTone ? 'Analyzing...' : (`${toneInfo.tone} ${toneInfo.tone_emoji}` || 'Not analyzed')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Button */}
        <button
          onClick={() => setShowChat(!showChat)}
          className="fixed bottom-6 right-6 p-4 bg-purple-500 text-white rounded-full shadow-lg hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
        >
          <MessageSquare className="w-6 h-6" />
        </button>

        {/* Chat Panel */}
        {showChat && (
          <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-lg transform transition-transform duration-300 ease-in-out">
            <div className="p-4 border-b">
              <div className="flex justify-between items-center">
                <h3 className="font-medium">Chat</h3>
                <button
                  onClick={() => setShowChat(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 h-[calc(100%-8rem)] overflow-y-auto">
              {/* Chat messages would go here */}
              <div className="space-y-4">
                <div className="bg-gray-100 p-3 rounded-lg">
                  <p className="text-gray-600">How can I help you with the video analysis?</p>
                </div>
              </div>
            </div>
            <div className="p-4 border-t">
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Type your message..."
                  className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button className="p-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600">
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-purple-50 to-white">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 bg-clip-text text-transparent">
              Media Uploader
            </h1>
            <p className="text-gray-600 mt-4 text-lg">
              Upload your media files or paste a YouTube link
            </p>
          </div>

          {/* Upload Area */}
          <div 
            className={`
              border-2 border-dashed rounded-xl p-8 mb-6 transition-all
              ${dragActive ? 'border-purple-500 bg-purple-50' : 'border-gray-300 bg-white'}
            `}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="text-center">
              <Upload className="w-12 h-12 text-purple-500 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">
                Drag and drop your media files here, or{' '}
                <button
                  className="text-purple-600 hover:text-purple-700 font-medium"
                  onClick={() => inputRef.current?.click()}
                >
                  browse
                </button>
              </p>
              <p className="text-sm text-gray-500">
                Supported formats: MP3, MP4, WAV, AVI, and more
              </p>
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                multiple
                accept="audio/*,video/*"
                onChange={handleFileInput}
              />
            </div>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="bg-white rounded-lg p-4 mb-6 shadow-sm">
              <h3 className="font-medium mb-3">Selected Files:</h3>
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                    <div className="flex items-center space-x-3">
                      {file.type.startsWith('video/') ? (
                        <FileVideo className="w-5 h-5 text-blue-500" />
                      ) : (
                        <FileAudio className="w-5 h-5 text-green-500" />
                      )}
                      <span className="text-sm text-gray-600">{file.name}</span>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* YouTube Link Input */}
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center mb-4">
              <Youtube className="w-6 h-6 text-red-500 mr-2" />
              <h3 className="font-medium">Or paste a YouTube link</h3>
            </div>
            <div className="flex space-x-3">
              <div className="flex-1 relative">
                <Link className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="https://youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg mt-4">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className={`w-full mt-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 px-6 rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
              isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:from-purple-700 hover:to-indigo-700'
            }`}
          >
            {isLoading ? 'Processing...' : 'Upload Media'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;