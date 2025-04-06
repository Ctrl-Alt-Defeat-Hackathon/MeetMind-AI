import React, { useState, useRef, useEffect } from 'react';
import { Upload, Youtube, FileVideo, FileAudio, X, Link, Send, MessageSquare, Volume2, ChevronDown, RefreshCw, Download, Calendar, ClipboardList, Mail } from 'lucide-react';

interface AnalysisState {
  file?: File;
  youtubeUrl?: string;
  isAnalyzing: boolean;
}

interface TranscriptResponse {
  transcript?: string;
  labeled_transcript?: {
    speaker: string;
    text: string;
  }[];
  error?: string;
}

interface TranslationResponse {
  translated_text: string;
  error?: string;
}

interface ToneResponse {
  tone: string;
  tone_emoji?: string;
  error?: string;
}

interface ActionItemsResponse {
  actions: string[];
  error?: string;
}

interface ChatbotResponse {
  answer?: string;
  error?: string;
}

interface ChatMessage {
  text: string;
  isUser: boolean;
}

interface TranscriptInput {
  transcript_text: string;
  filename?: string;
}

function App() {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('english');
  const [isLoading, setIsLoading] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const [originalTranscript, setOriginalTranscript] = useState<string>('');
  const [labeledTranscript, setLabeledTranscript] = useState<{speaker: string, text: string}[]>([]);
  const [error, setError] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [toneInfo, setToneInfo] = useState<any>('');
  const [isAnalyzingTone, setIsAnalyzingTone] = useState(false);
  const [actionItems, setActionItems] = useState<string[]>([
    'Summarize the key points discussed in the video',
    'Extract all action items mentioned',
    'Identify main speakers and their roles',
    'List all technical terms used',
    'Create a timeline of events discussed',
    'Note any deadlines or important dates mentioned'
  ]);
  const [isLoadingActionItems, setIsLoadingActionItems] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { text: 'How can I help you with the video analysis?', isUser: false }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isLabelingSpeakers, setIsLabelingSpeakers] = useState(false);
  const [isCreatingJiraDeal, setIsCreatingJiraDeal] = useState(false);
  const [showLanguagePopup, setShowLanguagePopup] = useState(false);
  const [popupContent, setPopupContent] = useState('');

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

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

  const translateTranscript = async (language: string) => {
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
        setPopupContent(data.translated_text);
        setShowLanguagePopup(true);
      }
    } catch (err) {
      setError('Failed to translate text. Please try again.');
      console.error('Translation error:', err);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = e.target.value;
    setSelectedLanguage(newLanguage);
    
    if (showAnalysis && originalTranscript) {
      translateTranscript(newLanguage);
    }
  };

  const analyzeTone = async () => {
    if (!originalTranscript || isAnalyzingTone) return;
    
    setIsAnalyzingTone(true);
    setError('');

    try {
      const response = await fetch('/api/analyze-tone/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript_text: originalTranscript
        }),
      });

      const data: ToneResponse = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else if (data) {
        setToneInfo(data);
        fetchActionItems(originalTranscript, data.tone);
      }
    } catch (err) {
      setError('Failed to analyze tone. Please try again.');
      console.error('Tone analysis error:', err);
    } finally {
      setIsAnalyzingTone(false);
    }
  };

  const fetchActionItems = async (transcriptText: string, tone: string) => {
    if (!transcriptText || !tone || isLoadingActionItems) return;
    
    setIsLoadingActionItems(true);
    setError('');

    try {
      const response = await fetch('/api/action-items/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript: transcriptText,
          tone: tone
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        try {
          let parsedData;
          if (typeof data === 'string') {
            try {
              parsedData = JSON.parse(data);
            } catch (parseErr) {
              console.warn('Response is not valid JSON, treating as plain text');
              parsedData = { actions: [data] };
            }
          } else {
            parsedData = data;
          }
          
          if (parsedData.actions && Array.isArray(parsedData.actions)) {
            setActionItems(parsedData.actions);
          } else if (parsedData.actions) {
            setActionItems([parsedData.actions]);
          } else {
            console.warn('Response does not contain actions array', parsedData);
            setActionItems(['No specific actions found. Please try again.']);
          }
        } catch (parseErr) {
          console.error('Error processing action items:', parseErr);
          setError('Failed to process action items response.');
        }
      }
    } catch (err) {
      setError('Failed to fetch action items. Please try again.');
      console.error('Action items error:', err);
    } finally {
      setIsLoadingActionItems(false);
    }
  };

  const formatTranscriptWithSpeakers = (transcriptText: string) => {
    if (!transcriptText) return [];
    
    // Split the transcript by newlines
    const lines = transcriptText.split('\n');
    
    // Parse each line into speaker and text
    return lines
      .filter(line => line.trim().length > 0) // Remove empty lines
      .map(line => {
        // Try to extract speaker and text (format: "Speaker: text")
        const match = line.match(/^([^:]+):(.*)$/);
        
        if (match) {
          return {
            speaker: match[1].trim(),
            text: match[2].trim()
          };
        } else {
          // If line doesn't match the expected format, treat it as speaker-less text
          return {
            speaker: '',
            text: line.trim()
          };
        }
      });
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
        
        const languageCode = languageCodeMap[selectedLanguage] || 'en';
        
        formData.append('language_code', languageCode);

        const response = await fetch('/api/transcribe-audio/', {
          method: 'POST',
          body: formData,
        });

        const data: TranscriptResponse = await response.json();
        if (data.error) {
          setError(data.error);
        } else if (data.transcript) {
          setOriginalTranscript(data.transcript);
          setTranscript(data.transcript);
          
          // Parse the transcript text to extract speaker labels
          const parsedTranscript = formatTranscriptWithSpeakers(data.transcript);
          setLabeledTranscript(parsedTranscript);
          
          setShowAnalysis(true);
          await analyzeTone();
        }
      } catch (err) {
        setError('Failed to transcribe audio. Please try again.');
        console.error('Transcription error:', err);
      } finally {
        setIsLoading(false);
      }
    } else if (youtubeUrl) {
      setIsLoading(false);
      setShowAnalysis(true);
    }
  };

  const assignSpeakers = async (transcriptText: string) => {
    if (!transcriptText || isLabelingSpeakers) return;
    
    setIsLabelingSpeakers(true);
    setError('');

    try {
      const response = await fetch('/api/assign_speakers_with_gpt/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript: transcriptText
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else if (data.labeled_transcript && Array.isArray(data.labeled_transcript)) {
        setLabeledTranscript(data.labeled_transcript);
      }
    } catch (err) {
      console.error('Speaker labeling error:', err);
      setError('Failed to assign speakers to transcript. Please try again.');
    } finally {
      setIsLabelingSpeakers(false);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || isSendingChat) return;
    
    const question = chatInput.trim();
    setChatInput('');
    setIsSendingChat(true);
    
    setChatMessages(prev => [...prev, { text: question, isUser: true }]);
    
    try {
      const response = await fetch('/api/chatbot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: question
        }),
      });

      const data: ChatbotResponse = await response.json();
      
      let messageText = 'Sorry, I couldn\'t process your question. Please try again.';
      
      if (data.error) {
        messageText = `Error: ${data.error || 'An unknown error occurred'}`;
      } else if (data.answer) {
        messageText = data.answer;
      }
      
      setChatMessages(prev => [...prev, { text: messageText, isUser: false }]);
    } catch (err) {
      console.error('Chatbot error:', err);
      setChatMessages(prev => [...prev, { 
        text: 'Failed to connect to the chatbot service. Please try again later.', 
        isUser: false 
      }]);
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendChatMessage();
  };

  const downloadReport = async () => {
    if (!originalTranscript || isDownloading) return;
    
    setIsDownloading(true);
    setError('');

    try {
      const payload: TranscriptInput = {
        transcript_text: originalTranscript,
        filename: 'meeting_minutes.pdf'
      };
      
      const response = await fetch('/api/download-report/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        throw new Error('Failed to download report');
      }
      
      // Get the blob from the response
      const blob = await response.blob();
      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);
      // Create a temporary anchor element
      const a = document.createElement('a');
      a.href = url;
      a.download = 'meeting_minutes.pdf';
      // Append the anchor to the document
      document.body.appendChild(a);
      // Programmatically click the anchor to trigger the download
      a.click();
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (err) {
      setError('Failed to download report. Please try again.');
      console.error('Download error:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const createJiraDeal = async () => {
    if (!originalTranscript || isCreatingJiraDeal) return;
    
    setIsCreatingJiraDeal(true);
    setError('');

    try {
      const payload: TranscriptInput = {
        transcript_text: originalTranscript
      };
      
      const response = await fetch('/api/jira-deal-creation/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create Jira deal');
      }
      
      const data = await response.json();
      alert('Jira deal created successfully!');
      
    } catch (err) {
      setError('Failed to create Jira deal. Please try again.');
      console.error('Jira deal creation error:', err);
    } finally {
      setIsCreatingJiraDeal(false);
    }
  };

  // Popup modal component
  const LanguagePopup = () => {
    if (!showLanguagePopup) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="font-medium text-lg">Translated Transcript in {languages.find(lang => lang.toLowerCase() === selectedLanguage)}</h3>
            <button
              onClick={() => setShowLanguagePopup(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4 overflow-y-auto flex-grow">
            <pre className="whitespace-pre-wrap text-gray-700">{popupContent}</pre>
          </div>
          <div className="p-4 border-t flex justify-end">
            <button
              onClick={() => setShowLanguagePopup(false)}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (showAnalysis) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 overflow-hidden">
        <div className="grid grid-cols-12 gap-6 h-[calc(100vh-3rem)]">
          <div className="col-span-12 lg:col-span-6 space-y-6 flex flex-col max-h-[calc(100vh-3rem)] overflow-hidden">
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

            <div className="bg-white rounded-lg shadow-sm p-4 flex-grow overflow-auto">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Actions to Take</h3>
                {isLoadingActionItems && <p className="text-sm text-purple-500">Loading...</p>}
              </div>
              <div className="pr-2">
                {actionItems.length > 0 ? (
                  actionItems.map((item, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded mb-2">
                      <p className="text-gray-600">{item}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center p-4">No action items available.</p>
                )}
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-6 space-y-6 flex flex-col max-h-[calc(100vh-3rem)] overflow-hidden">
            <div className="bg-white rounded-lg shadow-sm p-4 flex flex-col">
              <div className="p-4 bg-gray-50 rounded flex-grow overflow-hidden flex flex-col">
                <div className="flex-grow overflow-y-auto mb-4 max-h-[50vh] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 pr-2">
                  {error ? (
                    <p className="text-red-500">{error}</p>
                  ) : labeledTranscript.length > 0 ? (
                    <div className="space-y-2">
                      {labeledTranscript.map((segment, idx) => (
                        <p key={idx} className="mb-2">
                          {segment.speaker && (
                            <span className="font-bold text-indigo-600">{segment.speaker}: </span>
                          )}
                          <span className="text-gray-600">{segment.text}</span>
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-600">
                      {transcript || 'No transcript available.'}
                    </p>
                  )}
                  {isLabelingSpeakers && <p className="text-purple-500 mt-4">Identifying speakers...</p>}
                </div>
                
                <div className="relative mt-auto pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-medium text-gray-500">Choose language of transcript</h3>
                    {isTranslating && <p className="text-xs text-purple-500">Translating...</p>}
                  </div>
                  <div className="relative mt-1">
                    <div className="flex space-x-2">
                      <div className="flex-grow">
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
                      <button
                        onClick={() => setShowLanguagePopup(true)}
                        disabled={!transcript || isTranslating}
                        className="px-3 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:bg-indigo-300 flex items-center"
                      >
                        <span>View Translation</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <button 
                  onClick={analyzeTone}
                  disabled={isAnalyzingTone || !originalTranscript}
                  className="ml-auto text-purple-500 hover:text-purple-700 disabled:text-gray-300"
                  title="Refresh tone analysis"
                >
                  <RefreshCw className={`w-4 h-4 ${isAnalyzingTone ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="flex items-center">
                {isAnalyzingTone ? (
                  <p className="text-gray-700 text-xl">Analyzing tone...</p>
                ) : toneInfo.tone ? (
                  <div className="flex items-center w-full">
                    <p className="text-xl font-medium text-gray-700 mr-2">
                      Tone Detected to be
                    </p>
                    <div className="flex items-center">
                      <span className="inline-block px-2 py-1 text-sm bg-indigo-100 text-indigo-800 rounded-full font-medium uppercase">
                        {toneInfo.tone}
                      </span>
                      <span className="text-2xl ml-2">{toneInfo.tone_emoji}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-400 italic text-lg">No tone detected yet</p>
                )}
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-medium mb-3">Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={downloadReport}
                  disabled={isDownloading || !originalTranscript}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg flex items-center justify-center space-x-2 disabled:bg-purple-300 text-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>{isDownloading ? 'Downloading...' : 'Download Report'}</span>
                </button>
                
                <button
                  onClick={() => {}}
                  disabled={!originalTranscript}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg flex items-center justify-center space-x-2 disabled:bg-purple-300 text-sm"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Add to Calendar</span>
                </button>
                
                <button
                  onClick={createJiraDeal}
                  disabled={isCreatingJiraDeal || !originalTranscript}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg flex items-center justify-center space-x-2 disabled:bg-purple-300 text-sm"
                >
                  <ClipboardList className="w-4 h-4" />
                  <span>{isCreatingJiraDeal ? 'Creating...' : 'Add deal to Jira'}</span>
                </button>
                
                <button
                  onClick={() => {}}
                  disabled={!originalTranscript}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg flex items-center justify-center space-x-2 disabled:bg-purple-300 text-sm"
                >
                  <Mail className="w-4 h-4" />
                  <span>Create MOM email</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowChat(!showChat)}
          className="fixed bottom-6 right-6 p-4 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          <MessageSquare className="w-6 h-6" />
        </button>

        {showChat && (
          <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-lg transform transition-transform duration-300 ease-in-out flex flex-col">
            <div className="p-4 border-b">
              <div className="flex justify-between items-center">
                <h3 className="font-medium">Ask about the transcript</h3>
                <button
                  onClick={() => setShowChat(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 flex-grow overflow-y-auto">
              <div className="space-y-4">
                {chatMessages.map((msg, idx) => (
                  <div 
                    key={idx} 
                    className={`p-3 rounded-lg ${
                      msg.isUser 
                        ? 'bg-purple-100 ml-6' 
                        : 'bg-gray-100 mr-6'
                    }`}
                  >
                    <p className="text-gray-600">{msg.text}</p>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            </div>
            <div className="p-4 border-t mt-auto">
              <form onSubmit={handleChatSubmit} className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Ask about the transcript..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={isSendingChat}
                  className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button 
                  type="submit"
                  disabled={isSendingChat}
                  className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </div>
        )}

        <LanguagePopup />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-purple-50 to-white">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12 py-10">
            <img 
              src="/logo.png" 
              alt="DeepMind AI Logo" 
              className="w-20 mx-auto mb-4 drop-shadow-lg"
            />
            <h1 className="text-4xl font-bold text-center">
              DeepMind AI
            </h1>
            <p className="text-lg text-gray-500 mt-2 text-center">
              Speak Freely. We'll Handle the Rest.
            </p>
          </div>

          <div 
            className={`
              border-2 border-dashed rounded-xl p-8 mb-6 transition-all duration-300 ease-in-out
              shadow-lg hover:scale-105 hover:shadow-indigo-300 
              bg-white/40 backdrop-blur-sm
              ${dragActive ? 'border-purple-500 bg-purple-50' : 'border-gray-300 bg-white'}
            `}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="text-center">
              <Upload className="w-16 h-16 text-indigo-500 mx-auto mb-4" />
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

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg mt-4">
              {error}
            </div>
          )}

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