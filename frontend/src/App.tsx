import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
} from '@headlessui/react';
import {
  Upload, FileVideo, FileAudio, X, Send, MessageSquare,
  ChevronDown, RefreshCw, Download, Calendar, ClipboardList,
  Mail, ExternalLink, Check, Sun, Moon,
} from 'lucide-react';

// ── Interfaces ────────────────────────────────────────────────────────────────

interface TranscriptResponse {
  transcript?: string;
  labeled_transcript?: { speaker: string; text: string }[];
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

interface ChatMessage {
  text: string;
  isUser: boolean;
}

interface TranscriptInput {
  transcript_text: string;
  filename?: string;
}

interface CalendarEventItem {
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  description?: string;
  attendees?: string | string[];
}

// ── Calendar URL helpers ──────────────────────────────────────────────────────

function formatGoogleCalendarDates(date: string, startTime: string, endTime: string): string {
  const ymd = date.replace(/\D/g, '').slice(0, 8);
  const [sh = '09', sm = '00'] = (startTime || '09:00').split(':');
  const [eh = '10', em = '00'] = (endTime || '10:00').split(':');
  return `${ymd}T${sh.padStart(2, '0')}${sm.padStart(2, '0')}00/${ymd}T${eh.padStart(2, '0')}${em.padStart(2, '0')}00`;
}

function buildGoogleCalendarUrl(ev: CalendarEventItem): string {
  const dates = formatGoogleCalendarDates(ev.date, ev.start_time, ev.end_time);
  const params = new URLSearchParams({
    action: 'TEMPLATE', text: ev.title || 'Event', dates, details: ev.description || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildOutlookWebUrl(ev: CalendarEventItem): string {
  const d = ev.date || new Date().toISOString().slice(0, 10);
  const [sh = '09', sm = '00'] = (ev.start_time || '09:00').split(':');
  const [eh = '10', em = '00'] = (ev.end_time || '10:00').split(':');
  const startdt = `${d}T${sh.padStart(2, '0')}:${sm.padStart(2, '0')}:00`;
  const enddt   = `${d}T${eh.padStart(2, '0')}:${em.padStart(2, '0')}:00`;
  const q = new URLSearchParams({ subject: ev.title || 'Event', startdt, enddt, body: ev.description || '' });
  return `https://outlook.office.com/calendar/0/deeplink/compose?${q.toString()}`;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Italian',
  'Portuguese', 'Russian', 'Japanese', 'Korean', 'Chinese',
];

const LANGUAGE_CODE_MAP: Record<string, string> = {
  english: 'en', spanish: 'es', french: 'fr', german: 'de', italian: 'it',
  portuguese: 'pt', russian: 'ru', japanese: 'ja', korean: 'ko', chinese: 'zh',
};

// ── Theme tokens ──────────────────────────────────────────────────────────────

function buildTokens(isDark: boolean) {
  if (isDark) {
    return {
      dotColor: 'rgba(255,255,255,0.09)',
      pageBg: 'bg-black',
      card: 'bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-lg shadow-black/40',
      cardInner: 'bg-white/[0.03] rounded-lg',
      textPrimary: 'text-white',
      textSecondary: 'text-white/70',
      textMuted: 'text-white/40',
      textLabel: 'text-white/55',
      divider: 'border-white/[0.08]',
      listItem: 'bg-white/[0.04] border border-white/[0.06] rounded-lg',
      listBorder: 'border border-white/[0.08] rounded-lg',
      listDivide: 'divide-white/[0.06]',
      optFocus: 'bg-white/15 text-white',
      optDefault: 'text-white/80',
      modal: 'bg-gray-950/95 backdrop-blur-2xl border border-white/[0.1] rounded-2xl shadow-2xl shadow-black',
      modalBackdrop: 'bg-black/70 backdrop-blur-sm',
      input: 'bg-white/[0.06] border border-white/[0.12] text-white placeholder-white/30 focus:ring-white/20',
      btnPrimary: 'bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm rounded-lg transition-colors',
      btnCta: 'bg-white text-black hover:bg-white/90 shadow-[0_0_30px_rgba(255,255,255,0.12)]',
      btnCancel: 'bg-white/[0.06] hover:bg-white/10 border border-white/[0.12] text-white/70 hover:text-white rounded-lg transition-colors',
      btnSend: 'bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm rounded-lg transition-colors',
      fab: 'bg-white/15 hover:bg-white/25 text-white border border-white/20 backdrop-blur-sm',
      themeBtnBg: 'bg-white/10 hover:bg-white/20 border border-white/20 text-white',
      dropzone: 'border-white/[0.14] bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.05]',
      dropzoneActive: 'border-white/50 bg-white/[0.08] shadow-[0_0_40px_rgba(255,255,255,0.06)]',
      uploadIcon: 'text-white/30',
      uploadText: 'text-white/55',
      uploadSub: 'text-white/30',
      browseBtn: 'text-white hover:text-white/75 underline underline-offset-2',
      errorBg: 'bg-red-900/20 border border-red-500/20 text-red-400',
      errorText: 'text-red-400',
      successText: 'text-emerald-400',
      speakerName: 'text-white/90 font-bold',
      transcriptText: 'text-white/65',
      toneBadge: 'bg-white/10 text-white/90 border border-white/20 rounded-full',
      toneLabel: 'text-white/80',
      toneNone: 'text-white/30 italic',
      refreshBtn: 'text-white/35 hover:text-white/70',
      chatPanel: 'bg-gray-950/95 backdrop-blur-2xl border-l border-white/[0.08]',
      chatUser: 'bg-white/15 border border-white/20 ml-6',
      chatBot: 'bg-white/[0.05] border border-white/[0.06] mr-6',
      chatMsgText: 'text-white/80',
      calGoogleBtn: 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-500/30',
      calOutlookBtn: 'bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 border border-sky-500/30',
      externalLink: 'text-white/55 hover:text-white/90',
      fileRowBg: 'bg-white/[0.04] border border-white/[0.06] rounded-lg',
      fileVideo: 'text-blue-400/80',
      fileAudio: 'text-emerald-400/80',
      removeFile: 'text-white/30 hover:text-red-400',
      loadingText: 'text-white/50',
      jiraTaskTitle: 'text-white/90',
      jiraTaskDesc: 'text-xs text-white/40',
      jiraFailed: 'text-red-400',
    };
  }
  return {
    dotColor: 'rgba(0,0,0,0.07)',
    pageBg: 'bg-gray-50',
    card: 'bg-white border border-gray-200 rounded-xl shadow-sm',
    cardInner: 'bg-gray-50 rounded-lg',
    textPrimary: 'text-gray-900',
    textSecondary: 'text-gray-600',
    textMuted: 'text-gray-400',
    textLabel: 'text-gray-500',
    divider: 'border-gray-200',
    listItem: 'bg-gray-50 border border-gray-100 rounded-lg',
    listBorder: 'border border-gray-200 rounded-lg',
    listDivide: 'divide-gray-100',
    optFocus: 'bg-gray-100 text-gray-900',
    optDefault: 'text-gray-700',
    modal: 'bg-white border border-gray-200 rounded-2xl shadow-xl',
    modalBackdrop: 'bg-black/40',
    input: 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:ring-gray-400',
    btnPrimary: 'bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors',
    btnCta: 'bg-gray-900 text-white hover:bg-gray-800',
    btnCancel: 'bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 rounded-lg transition-colors',
    btnSend: 'bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors',
    fab: 'bg-gray-900 hover:bg-gray-800 text-white shadow-lg',
    themeBtnBg: 'bg-white hover:bg-gray-100 border border-gray-300 text-gray-700',
    dropzone: 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50',
    dropzoneActive: 'border-gray-600 bg-gray-100',
    uploadIcon: 'text-gray-400',
    uploadText: 'text-gray-500',
    uploadSub: 'text-gray-400',
    browseBtn: 'text-gray-900 hover:text-gray-700 underline underline-offset-2',
    errorBg: 'bg-red-50 border border-red-200 text-red-600',
    errorText: 'text-red-600',
    successText: 'text-green-700',
    speakerName: 'text-gray-900 font-bold',
    transcriptText: 'text-gray-600',
    toneBadge: 'bg-gray-100 text-gray-800 border border-gray-200 rounded-full',
    toneLabel: 'text-gray-700',
    toneNone: 'text-gray-400 italic',
    refreshBtn: 'text-gray-400 hover:text-gray-700',
    chatPanel: 'bg-white border-l border-gray-200',
    chatUser: 'bg-gray-900 ml-6',
    chatBot: 'bg-gray-100 mr-6',
    chatMsgText: 'text-gray-700',
    calGoogleBtn: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200',
    calOutlookBtn: 'bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200',
    externalLink: 'text-gray-500 hover:text-gray-900',
    fileRowBg: 'bg-gray-50 border border-gray-100 rounded-lg',
    fileVideo: 'text-blue-500',
    fileAudio: 'text-green-500',
    removeFile: 'text-gray-400 hover:text-red-500',
    loadingText: 'text-gray-400',
    jiraTaskTitle: 'text-gray-900',
    jiraTaskDesc: 'text-xs text-gray-500',
    jiraFailed: 'text-red-600',
  };
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  // ── Theme ──────────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const isDark = theme === 'dark';
  const t = buildTokens(isDark);

  const dotBg: React.CSSProperties = {
    backgroundImage: `radial-gradient(circle, ${t.dotColor} 1px, transparent 1px)`,
    backgroundSize: '22px 22px',
  };

  // ── State ──────────────────────────────────────────────────────────────────
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('english');
  const [isLoading, setIsLoading] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [originalTranscript, setOriginalTranscript] = useState('');
  const [labeledTranscript, setLabeledTranscript] = useState<{ speaker: string; text: string }[]>([]);
  const [error, setError] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [toneInfo, setToneInfo] = useState<any>(null);
  const [isAnalyzingTone, setIsAnalyzingTone] = useState(false);
  const [actionItems, setActionItems] = useState<string[]>([
    'Summarize the key points discussed in the video',
    'Extract all action items mentioned',
    'Identify main speakers and their roles',
    'List all technical terms used',
    'Create a timeline of events discussed',
    'Note any deadlines or important dates mentioned',
  ]);
  const [isLoadingActionItems, setIsLoadingActionItems] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { text: 'How can I help you with the video analysis?', isUser: false },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isLabelingSpeakers, setIsLabelingSpeakers] = useState(false);

  const [showChat, setShowChat] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [translatedContent, setTranslatedContent] = useState('');
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventItem[] | null>(null);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [calendarModalError, setCalendarModalError] = useState('');
  const [isDownloadingIcs, setIsDownloadingIcs] = useState(false);
  const [showJiraModal, setShowJiraModal] = useState(false);
  const [jiraProjects, setJiraProjects] = useState<{ key: string; name: string }[]>([]);
  const [selectedJiraProject, setSelectedJiraProject] = useState('');
  const [isLoadingJiraProjects, setIsLoadingJiraProjects] = useState(false);
  const [isCreatingJiraTasks, setIsCreatingJiraTasks] = useState(false);
  const [jiraTaskResults, setJiraTaskResults] = useState<{
    created: { key: string; summary: string; description?: string; url: string }[];
    failed: { summary: string; error: string }[];
  } | null>(null);
  const [jiraModalError, setJiraModalError] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    const dropped = Array.from(e.dataTransfer.files).filter(
      f => f.type.startsWith('audio/') || f.type.startsWith('video/'),
    );
    if (dropped.length) setFiles(prev => [...prev, ...dropped]);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selected = Array.from(e.target.files).filter(
      f => f.type.startsWith('audio/') || f.type.startsWith('video/'),
    );
    setFiles(prev => [...prev, ...selected]);
  };

  const removeFile = (i: number) => setFiles(prev => prev.filter((_, idx) => idx !== i));

  const translateTranscript = async (language: string) => {
    if (!originalTranscript || isTranslating) return;
    setIsTranslating(true); setError('');
    try {
      const languageName = LANGUAGES.find(l => l.toLowerCase() === language) || language;
      const res = await fetch('/api/translate-text/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: languageName }),
      });
      const data: TranslationResponse = await res.json();
      if (data.error) { setError(data.error); return; }
      if (data.translated_text) {
        setTranslatedContent(data.translated_text);
        setShowLanguageModal(true);
      }
    } catch { setError('Failed to translate text. Please try again.'); }
    finally { setIsTranslating(false); }
  };

  const analyzeTone = async () => {
    if (!originalTranscript || isAnalyzingTone) return;
    setIsAnalyzingTone(true); setError('');
    try {
      const res = await fetch('/api/analyze-tone/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript_text: originalTranscript }),
      });
      const data: ToneResponse = await res.json();
      if (data.error) { setError(data.error); return; }
      setToneInfo(data);
      fetchActionItems(originalTranscript, data.tone);
    } catch { setError('Failed to analyze tone.'); }
    finally { setIsAnalyzingTone(false); }
  };

  const fetchActionItems = async (transcriptText: string, tone: string) => {
    if (!transcriptText || !tone || isLoadingActionItems) return;
    setIsLoadingActionItems(true); setError('');
    try {
      const res = await fetch('/api/action-items/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: transcriptText, tone }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      if (Array.isArray(parsed.actions)) setActionItems(parsed.actions);
      else setActionItems(['No specific actions found.']);
    } catch { setError('Failed to fetch action items.'); }
    finally { setIsLoadingActionItems(false); }
  };

  const formatTranscriptWithSpeakers = (text: string) =>
    text.split('\n').filter(l => l.trim()).map(line => {
      const m = line.match(/^([^:]+):(.*)$/);
      return m ? { speaker: m[1].trim(), text: m[2].trim() } : { speaker: '', text: line.trim() };
    });

  const handleSubmit = async () => {
    if (!files.length) return;
    setIsLoading(true); setError('');
    try {
      const formData = new FormData();
      formData.append('file', files[0]);
      formData.append('language_code', LANGUAGE_CODE_MAP[selectedLanguage] || 'en');
      const res = await fetch('/api/transcribe-audio/', { method: 'POST', body: formData });
      const data: TranscriptResponse = await res.json();
      if (data.error) { setError(data.error); return; }
      if (data.transcript) {
        setOriginalTranscript(data.transcript);
        setTranscript(data.transcript);
        setLabeledTranscript(formatTranscriptWithSpeakers(data.transcript));
        setShowAnalysis(true);
        await analyzeTone();
      }
    } catch { setError('Failed to transcribe audio. Please try again.'); }
    finally { setIsLoading(false); }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || isSendingChat) return;
    const question = chatInput.trim();
    setChatInput(''); setIsSendingChat(true);
    setChatMessages(prev => [...prev, { text: question, isUser: true }]);
    try {
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, {
        text: data.answer || data.error || 'Sorry, could not process that.',
        isUser: false,
      }]);
    } catch {
      setChatMessages(prev => [...prev, { text: 'Failed to connect to chatbot.', isUser: false }]);
    } finally { setIsSendingChat(false); }
  };

  const downloadReport = async () => {
    const text = originalTranscript || transcript;
    if (!text.trim() || isDownloading) return;
    setIsDownloading(true); setError('');
    try {
      const res = await fetch('/api/download-report/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript_text: text, filename: 'meeting_minutes.pdf' } as TranscriptInput),
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'meeting_minutes.pdf';
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (err) { setError(err instanceof Error ? err.message : 'Download failed.'); }
    finally { setIsDownloading(false); }
  };

  const openCalendarModal = async () => {
    const text = (originalTranscript || transcript).trim();
    if (!text) return;
    setShowCalendarModal(true); setCalendarModalError(''); setCalendarEvents(null); setIsCalendarLoading(true);
    try {
      const res = await fetch('/api/calendar-events/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Failed');
      const data = await res.json();
      setCalendarEvents(Array.isArray(data.events) ? data.events : []);
    } catch (err) { setCalendarModalError(err instanceof Error ? err.message : 'Failed to load events'); }
    finally { setIsCalendarLoading(false); }
  };

  const downloadCalendarIcs = async () => {
    const text = (originalTranscript || transcript).trim();
    if (!text) return;
    setIsDownloadingIcs(true); setCalendarModalError('');
    try {
      const body: any = { transcript: text };
      if (calendarEvents?.length) body.events = calendarEvents;
      const res = await fetch('/api/download-calendar/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'meeting_events.ics';
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (err) { setCalendarModalError(err instanceof Error ? err.message : 'Download failed'); }
    finally { setIsDownloadingIcs(false); }
  };

  const openJiraModal = async () => {
    setShowJiraModal(true); setJiraTaskResults(null); setJiraModalError('');
    setSelectedJiraProject(''); setIsLoadingJiraProjects(true);
    try {
      const res = await fetch('/api/jira-projects/');
      if (!res.ok) throw new Error((await res.json()).detail || 'Failed');
      const data = await res.json();
      setJiraProjects(data.projects || []);
      if (data.projects?.length) setSelectedJiraProject(data.projects[0].key);
    } catch (err) { setJiraModalError(err instanceof Error ? err.message : 'Failed to load projects'); }
    finally { setIsLoadingJiraProjects(false); }
  };

  const pushActionItemsToJira = async () => {
    if (!selectedJiraProject || !actionItems.length) return;
    setIsCreatingJiraTasks(true); setJiraModalError('');
    try {
      const res = await fetch('/api/jira-action-items/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_items: actionItems, project_key: selectedJiraProject }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Failed');
      setJiraTaskResults(await res.json());
    } catch (err) { setJiraModalError(err instanceof Error ? err.message : 'Failed to create tasks'); }
    finally { setIsCreatingJiraTasks(false); }
  };

  // ── Modal transition helpers ───────────────────────────────────────────────
  const bdEnter = 'ease-out duration-200'; const bdFrom = 'opacity-0'; const bdTo = 'opacity-100';
  const bdLeave = 'ease-in duration-150';
  const pnEnter = 'ease-out duration-200'; const pnFrom = 'opacity-0 scale-95'; const pnTo = 'opacity-100 scale-100';
  const pnLeave = 'ease-in duration-150'; const pnLFrom = 'opacity-100 scale-100'; const pnLTo = 'opacity-0 scale-95';

  const listboxOptionCls = ({ focus, selected }: { focus: boolean; selected: boolean }) =>
    `relative cursor-pointer select-none px-3 py-2 text-sm flex items-center justify-between gap-2 ${
      focus ? t.optFocus : t.optDefault
    } ${selected ? 'font-medium' : ''}`;

  // ── Theme toggle button ────────────────────────────────────────────────────
  const ThemeToggle = () => (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`fixed top-4 right-4 z-50 p-2.5 rounded-xl border transition-colors backdrop-blur-sm ${t.themeBtnBg}`}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );

  // ── Analysis view ──────────────────────────────────────────────────────────
  if (showAnalysis) {
    return (
      <div className={`min-h-screen ${t.pageBg} p-6 overflow-hidden`} style={dotBg}>
        <ThemeToggle />
        <div className="grid grid-cols-12 gap-6 h-[calc(100vh-3rem)]">

          {/* LEFT COLUMN */}
          <div className="col-span-12 lg:col-span-6 space-y-6 flex flex-col max-h-[calc(100vh-3rem)] overflow-hidden">

            {/* Video player */}
            <div className={`${t.card} p-4`}>
              {files.length > 0 ? (
                <video controls className="w-full aspect-video bg-black rounded-lg"
                  src={URL.createObjectURL(files[0])} />
              ) : (
                <div className={`w-full aspect-video ${t.cardInner} flex items-center justify-center`}>
                  <p className={t.textMuted}>No video loaded.</p>
                </div>
              )}
            </div>

            {/* Action items */}
            <div className={`${t.card} p-4 flex-grow overflow-auto`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`font-medium ${t.textPrimary}`}>Actions to Take</h3>
                {isLoadingActionItems && <p className={`text-sm ${t.loadingText}`}>Loading…</p>}
              </div>
              <div className="pr-2">
                {actionItems.length > 0 ? actionItems.map((item, i) => (
                  <div key={i} className={`${t.listItem} p-3 mb-2`}>
                    <p className={t.textSecondary}>{item}</p>
                  </div>
                )) : (
                  <p className={`${t.textMuted} text-center p-4`}>No action items available.</p>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="col-span-12 lg:col-span-6 space-y-6 flex flex-col max-h-[calc(100vh-3rem)] overflow-hidden">

            {/* Transcript + language */}
            <div className={`${t.card} p-4 flex flex-col`}>
              <div className={`p-4 ${t.cardInner} flex-grow overflow-hidden flex flex-col`}>
                <div className="flex-grow overflow-y-auto mb-4 max-h-[50vh] pr-2">
                  {error ? (
                    <p className={t.errorText}>{error}</p>
                  ) : labeledTranscript.length > 0 ? (
                    <div className="space-y-2">
                      {labeledTranscript.map((seg, i) => (
                        <p key={i} className="mb-2">
                          {seg.speaker && <span className={t.speakerName}>{seg.speaker}: </span>}
                          <span className={t.transcriptText}>{seg.text}</span>
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className={t.transcriptText}>{transcript || 'No transcript available.'}</p>
                  )}
                  {isLabelingSpeakers && <p className={`${t.loadingText} mt-4`}>Identifying speakers…</p>}
                </div>

                {/* Language selector */}
                <div className={`mt-auto pt-3 border-t ${t.divider}`}>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className={`text-sm font-medium ${t.textLabel}`}>Choose language of transcript</h3>
                    {isTranslating && <p className={`text-xs ${t.loadingText}`}>Translating…</p>}
                  </div>
                  <div className="flex space-x-2 mt-1">
                    <div className="flex-grow relative">
                      <Listbox value={selectedLanguage} onChange={v => setSelectedLanguage(v)} disabled={isTranslating}>
                        <ListboxButton className={`w-full flex items-center justify-between p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 disabled:opacity-50 ${t.input}`}>
                          <span>{LANGUAGES.find(l => l.toLowerCase() === selectedLanguage) || 'English'}</span>
                          <ChevronDown className={`w-4 h-4 ${t.textMuted}`} />
                        </ListboxButton>
                        <ListboxOptions className={`absolute z-20 mt-1 w-full ${isDark ? 'bg-gray-900/95 backdrop-blur-xl border border-white/[0.1]' : 'bg-white border border-gray-200'} rounded-lg shadow-2xl max-h-48 overflow-auto focus:outline-none`}>
                          {LANGUAGES.map(lang => (
                            <ListboxOption key={lang} value={lang.toLowerCase()} className={listboxOptionCls}>
                              {({ selected }) => (
                                <>
                                  <span>{lang}</span>
                                  {selected && <Check className={`w-4 h-4 ${t.textLabel} shrink-0`} />}
                                </>
                              )}
                            </ListboxOption>
                          ))}
                        </ListboxOptions>
                      </Listbox>
                    </div>
                    <button
                      onClick={() => translateTranscript(selectedLanguage)}
                      disabled={!originalTranscript || isTranslating}
                      className={`${t.btnPrimary} px-3 py-2 text-sm disabled:opacity-30 disabled:cursor-not-allowed`}
                    >
                      {isTranslating ? 'Translating…' : 'Translate'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Tone */}
            <div className={`${t.card} p-4`}>
              <div className="flex justify-end mb-2">
                <button onClick={analyzeTone} disabled={isAnalyzingTone || !originalTranscript}
                  className={`${t.refreshBtn} disabled:opacity-20 transition-colors`} title="Refresh tone">
                  <RefreshCw className={`w-4 h-4 ${isAnalyzingTone ? 'animate-spin' : ''}`} />
                </button>
              </div>
              {isAnalyzingTone ? (
                <p className={`text-xl ${t.loadingText}`}>Analyzing tone…</p>
              ) : toneInfo?.tone ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-xl font-medium ${t.toneLabel}`}>Tone Detected to be</p>
                  <span className={`px-2 py-1 text-sm font-medium uppercase ${t.toneBadge}`}>{toneInfo.tone}</span>
                  <span className="text-2xl">{toneInfo.tone_emoji}</span>
                </div>
              ) : (
                <p className={`text-lg ${t.toneNone}`}>No tone detected yet</p>
              )}
            </div>

            {/* Action buttons */}
            <div className={`${t.card} p-4`}>
              <h3 className={`font-medium mb-3 ${t.textPrimary}`}>Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={downloadReport}
                  disabled={isDownloading || !(originalTranscript || transcript).trim()}
                  className={`${t.btnPrimary} px-3 py-2 flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed text-sm`}>
                  <Download className="w-4 h-4" />
                  <span>{isDownloading ? 'Downloading…' : 'Download Report'}</span>
                </button>

                <button onClick={openCalendarModal}
                  disabled={!(originalTranscript || transcript).trim()}
                  className={`${t.btnPrimary} px-3 py-2 flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed text-sm`}>
                  <Calendar className="w-4 h-4" />
                  <span>Add to Calendar</span>
                </button>

                <button onClick={openJiraModal}
                  disabled={!originalTranscript || !actionItems.length}
                  className={`${t.btnPrimary} px-3 py-2 flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed text-sm`}>
                  <ClipboardList className="w-4 h-4" />
                  <span>Push to Jira</span>
                </button>

                <button disabled={!originalTranscript}
                  className={`${t.btnPrimary} px-3 py-2 flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed text-sm`}>
                  <Mail className="w-4 h-4" />
                  <span>Create MOM email</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Chat FAB */}
        <button onClick={() => setShowChat(true)}
          className={`fixed bottom-6 right-6 p-4 ${t.fab} rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors`}>
          <MessageSquare className="w-6 h-6" />
        </button>

        {/* ── CHAT PANEL ─────────────────────────────────────────────────── */}
        <Transition show={showChat}>
          <Dialog onClose={() => setShowChat(false)} className="relative z-50">
            <TransitionChild enter="ease-in-out duration-300" enterFrom="opacity-0" enterTo="opacity-100"
              leave="ease-in-out duration-300" leaveFrom="opacity-100" leaveTo="opacity-0">
              <div className={`fixed inset-0 ${t.modalBackdrop}`} aria-hidden="true" />
            </TransitionChild>
            <div className="fixed inset-0 overflow-hidden">
              <div className="absolute inset-0 overflow-hidden">
                <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full">
                  <TransitionChild
                    enter="transform transition ease-in-out duration-300"
                    enterFrom="translate-x-full" enterTo="translate-x-0"
                    leave="transform transition ease-in-out duration-300"
                    leaveFrom="translate-x-0" leaveTo="translate-x-full">
                    <DialogPanel className={`pointer-events-auto w-96 ${t.chatPanel} flex flex-col h-full shadow-2xl`}>
                      <div className={`p-4 border-b ${t.divider} flex justify-between items-center`}>
                        <DialogTitle className={`font-medium ${t.textPrimary}`}>Ask about the transcript</DialogTitle>
                        <button onClick={() => setShowChat(false)} className={`${t.textMuted} hover:${t.textSecondary} transition-colors`}>
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="p-4 flex-grow overflow-y-auto space-y-4">
                        {chatMessages.map((msg, i) => (
                          <div key={i} className={`p-3 rounded-lg ${msg.isUser ? t.chatUser : t.chatBot}`}>
                            <p className={t.chatMsgText}>{msg.text}</p>
                          </div>
                        ))}
                        <div ref={chatEndRef} />
                      </div>
                      <div className={`p-4 border-t ${t.divider}`}>
                        <form onSubmit={e => { e.preventDefault(); sendChatMessage(); }} className="flex gap-2">
                          <input
                            type="text" placeholder="Ask about the transcript…"
                            value={chatInput} onChange={e => setChatInput(e.target.value)}
                            disabled={isSendingChat}
                            className={`flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50 ${t.input}`}
                          />
                          <button type="submit" disabled={isSendingChat}
                            className={`${t.btnSend} p-2 disabled:opacity-30`}>
                            <Send className="w-5 h-5" />
                          </button>
                        </form>
                      </div>
                    </DialogPanel>
                  </TransitionChild>
                </div>
              </div>
            </div>
          </Dialog>
        </Transition>

        {/* ── TRANSLATION MODAL ──────────────────────────────────────────── */}
        <Transition show={showLanguageModal}>
          <Dialog onClose={() => setShowLanguageModal(false)} className="relative z-50">
            <TransitionChild enter={bdEnter} enterFrom={bdFrom} enterTo={bdTo} leave={bdLeave} leaveFrom={bdTo} leaveTo={bdFrom}>
              <div className={`fixed inset-0 ${t.modalBackdrop}`} aria-hidden="true" />
            </TransitionChild>
            <div className="fixed inset-0 flex items-center justify-center p-4">
              <TransitionChild enter={pnEnter} enterFrom={pnFrom} enterTo={pnTo} leave={pnLeave} leaveFrom={pnLFrom} leaveTo={pnLTo}>
                <DialogPanel className={`w-full max-w-3xl max-h-[80vh] ${t.modal} flex flex-col`}>
                  <div className={`p-4 border-b ${t.divider} flex justify-between items-center`}>
                    <DialogTitle className={`font-medium text-lg ${t.textPrimary}`}>
                      Translated Transcript — {LANGUAGES.find(l => l.toLowerCase() === selectedLanguage)}
                    </DialogTitle>
                    <button onClick={() => setShowLanguageModal(false)} className={`${t.textMuted} transition-colors`}>
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-4 overflow-y-auto flex-grow">
                    <pre className={`whitespace-pre-wrap text-sm ${t.textSecondary}`}>{translatedContent}</pre>
                  </div>
                  <div className={`p-4 border-t ${t.divider} flex justify-end`}>
                    <button onClick={() => setShowLanguageModal(false)} className={`${t.btnPrimary} px-4 py-2`}>
                      Close
                    </button>
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </Dialog>
        </Transition>

        {/* ── JIRA MODAL ─────────────────────────────────────────────────── */}
        <Transition show={showJiraModal}>
          <Dialog onClose={() => setShowJiraModal(false)} className="relative z-50">
            <TransitionChild enter={bdEnter} enterFrom={bdFrom} enterTo={bdTo} leave={bdLeave} leaveFrom={bdTo} leaveTo={bdFrom}>
              <div className={`fixed inset-0 ${t.modalBackdrop}`} aria-hidden="true" />
            </TransitionChild>
            <div className="fixed inset-0 flex items-center justify-center p-4">
              <TransitionChild enter={pnEnter} enterFrom={pnFrom} enterTo={pnTo} leave={pnLeave} leaveFrom={pnLFrom} leaveTo={pnLTo}>
                <DialogPanel className={`w-full max-w-lg max-h-[85vh] ${t.modal} flex flex-col`}>
                  <div className={`p-4 border-b ${t.divider} flex justify-between items-center`}>
                    <DialogTitle className={`font-medium text-lg ${t.textPrimary}`}>Push Action Items to Jira</DialogTitle>
                    <button onClick={() => setShowJiraModal(false)} className={`${t.textMuted} transition-colors`}>
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-4 overflow-y-auto flex-grow space-y-4">
                    {jiraModalError && <p className={`text-sm ${t.errorText}`}>{jiraModalError}</p>}
                    {!jiraTaskResults && (
                      <>
                        {isLoadingJiraProjects ? (
                          <p className={`text-sm ${t.loadingText}`}>Loading projects…</p>
                        ) : jiraProjects.length > 0 ? (
                          <div>
                            <label className={`block text-sm font-medium mb-1 ${t.textLabel}`}>Select Jira Project</label>
                            <div className="relative">
                              <Listbox value={selectedJiraProject} onChange={setSelectedJiraProject}>
                                <ListboxButton className={`w-full flex items-center justify-between p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${t.input}`}>
                                  <span>
                                    {jiraProjects.find(p => p.key === selectedJiraProject)
                                      ? `${jiraProjects.find(p => p.key === selectedJiraProject)!.name} (${selectedJiraProject})`
                                      : 'Select project'}
                                  </span>
                                  <ChevronDown className={`w-4 h-4 ${t.textMuted}`} />
                                </ListboxButton>
                                <ListboxOptions className={`absolute z-20 mt-1 w-full ${isDark ? 'bg-gray-900/95 backdrop-blur-xl border border-white/[0.1]' : 'bg-white border border-gray-200'} rounded-lg shadow-2xl max-h-48 overflow-auto focus:outline-none`}>
                                  {jiraProjects.map(p => (
                                    <ListboxOption key={p.key} value={p.key} className={listboxOptionCls}>
                                      {({ selected }) => (
                                        <>
                                          <span>{p.name} ({p.key})</span>
                                          {selected && <Check className={`w-4 h-4 ${t.textLabel} shrink-0`} />}
                                        </>
                                      )}
                                    </ListboxOption>
                                  ))}
                                </ListboxOptions>
                              </Listbox>
                            </div>
                          </div>
                        ) : !jiraModalError && (
                          <p className={`text-sm ${t.textMuted}`}>No projects found.</p>
                        )}
                        {actionItems.length > 0 && !isLoadingJiraProjects && (
                          <div>
                            <p className={`text-sm font-medium mb-2 ${t.textLabel}`}>Tasks to create ({actionItems.length})</p>
                            <ul className={`${t.listBorder} ${t.listDivide} divide-y max-h-48 overflow-y-auto`}>
                              {actionItems.map((item, i) => (
                                <li key={i} className={`px-3 py-2 text-sm ${t.textSecondary}`}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                    {jiraTaskResults && (
                      <div className="space-y-3">
                        {jiraTaskResults.created.length > 0 && (
                          <div>
                            <p className={`text-sm font-medium ${t.successText} mb-2`}>
                              ✅ {jiraTaskResults.created.length} task{jiraTaskResults.created.length > 1 ? 's' : ''} created
                            </p>
                            <ul className={`${t.listBorder} ${t.listDivide} divide-y`}>
                              {jiraTaskResults.created.map((issue, i) => (
                                <li key={i} className="px-3 py-2 text-sm">
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className={`font-medium ${t.jiraTaskTitle}`}>{issue.summary}</span>
                                    <a href={issue.url} target="_blank" rel="noopener noreferrer"
                                      className={`inline-flex items-center gap-1 text-xs font-medium ${t.externalLink} shrink-0 transition-colors`}>
                                      {issue.key} <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>
                                  {issue.description && <p className={t.jiraTaskDesc}>{issue.description}</p>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {jiraTaskResults.failed.length > 0 && (
                          <div>
                            <p className={`text-sm font-medium ${t.jiraFailed} mb-2`}>❌ {jiraTaskResults.failed.length} failed</p>
                            <ul className={`${t.listBorder} ${t.listDivide} divide-y`}>
                              {jiraTaskResults.failed.map((f, i) => (
                                <li key={i} className={`px-3 py-2 text-sm ${t.jiraFailed}`}>{f.summary} — {f.error}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className={`p-4 border-t ${t.divider} flex gap-2 justify-end`}>
                    <button onClick={() => setShowJiraModal(false)} className={`${t.btnCancel} px-4 py-2`}>
                      {jiraTaskResults ? 'Close' : 'Cancel'}
                    </button>
                    {!jiraTaskResults && (
                      <button onClick={pushActionItemsToJira}
                        disabled={isCreatingJiraTasks || isLoadingJiraProjects || !selectedJiraProject || !actionItems.length}
                        className={`${t.btnPrimary} px-4 py-2 flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed`}>
                        <ClipboardList className="w-4 h-4" />
                        {isCreatingJiraTasks ? 'Creating tasks…' : 'Create Tasks'}
                      </button>
                    )}
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </Dialog>
        </Transition>

        {/* ── CALENDAR MODAL ─────────────────────────────────────────────── */}
        <Transition show={showCalendarModal}>
          <Dialog onClose={() => setShowCalendarModal(false)} className="relative z-50">
            <TransitionChild enter={bdEnter} enterFrom={bdFrom} enterTo={bdTo} leave={bdLeave} leaveFrom={bdTo} leaveTo={bdFrom}>
              <div className={`fixed inset-0 ${t.modalBackdrop}`} aria-hidden="true" />
            </TransitionChild>
            <div className="fixed inset-0 flex items-center justify-center p-4">
              <TransitionChild enter={pnEnter} enterFrom={pnFrom} enterTo={pnTo} leave={pnLeave} leaveFrom={pnLFrom} leaveTo={pnLTo}>
                <DialogPanel className={`w-full max-w-lg max-h-[85vh] ${t.modal} flex flex-col`}>
                  <div className={`p-4 border-b ${t.divider} flex justify-between items-center`}>
                    <DialogTitle className={`font-medium text-lg ${t.textPrimary}`}>Add to Calendar</DialogTitle>
                    <button onClick={() => setShowCalendarModal(false)} className={`${t.textMuted} transition-colors`}>
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-4 overflow-y-auto flex-grow space-y-4">
                    <p className={`text-sm ${t.textSecondary}`}>
                      We extract dates and times from your transcript. Download an{' '}
                      <strong className={t.textPrimary}>.ics</strong> file for Apple Calendar or Outlook desktop,
                      or open directly in Google Calendar or Outlook on the web.
                    </p>
                    {isCalendarLoading && <p className={`text-sm ${t.loadingText}`}>Extracting events…</p>}
                    {calendarModalError && <p className={`text-sm ${t.errorText}`}>{calendarModalError}</p>}
                    {!isCalendarLoading && calendarEvents && calendarEvents.length > 0 && (
                      <ul className={`space-y-3 ${t.listBorder} ${t.listDivide} divide-y`}>
                        {calendarEvents.map((ev, i) => (
                          <li key={i} className="p-3 text-sm">
                            <p className={`font-medium ${t.textPrimary}`}>{ev.title || 'Event'}</p>
                            <p className={t.textSecondary}>{ev.date} · {ev.start_time}–{ev.end_time}</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              <a href={buildGoogleCalendarUrl(ev)} target="_blank" rel="noopener noreferrer"
                                className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors ${t.calGoogleBtn}`}>
                                Google Calendar <ExternalLink className="w-3 h-3" />
                              </a>
                              <a href={buildOutlookWebUrl(ev)} target="_blank" rel="noopener noreferrer"
                                className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors ${t.calOutlookBtn}`}>
                                Outlook (web) <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    {!isCalendarLoading && calendarEvents?.length === 0 && !calendarModalError && (
                      <p className={`text-sm ${t.textMuted}`}>No events detected. You can still download a default follow-up .ics.</p>
                    )}
                  </div>
                  <div className={`p-4 border-t ${t.divider} flex gap-2 justify-end`}>
                    <button onClick={() => setShowCalendarModal(false)} className={`${t.btnCancel} px-4 py-2`}>
                      Close
                    </button>
                    <button onClick={downloadCalendarIcs} disabled={isDownloadingIcs || isCalendarLoading}
                      className={`${t.btnPrimary} px-4 py-2 flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed`}>
                      <Download className="w-4 h-4" />
                      {isDownloadingIcs ? 'Preparing…' : 'Download .ics'}
                    </button>
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </Dialog>
        </Transition>
      </div>
    );
  }

  // ── Upload page ────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen ${t.pageBg}`} style={dotBg}>
      <ThemeToggle />
      {/* Radial glow for dark theme only */}
      {isDark && (
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(255,255,255,0.04),transparent)]" />
        </div>
      )}
      <div className="relative container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">

          {/* Header */}
          <div className="text-center mb-12 py-10">
            <img src="/logo.png" alt="Logo" className="w-20 mx-auto mb-4 drop-shadow-lg" />
            <h1 className={`text-4xl font-bold ${t.textPrimary}`}>DeepMind AI</h1>
            <p className={`text-lg mt-2 ${t.textMuted}`}>Speak Freely. We'll Handle the Rest.</p>
          </div>

          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-2xl p-8 mb-6 transition-all duration-300 ${
              dragActive ? t.dropzoneActive : t.dropzone
            }`}
            onDragEnter={handleDrag} onDragLeave={handleDrag}
            onDragOver={handleDrag} onDrop={handleDrop}
          >
            <div className="text-center">
              <Upload className={`w-16 h-16 mx-auto mb-4 ${t.uploadIcon}`} />
              <p className={`mb-2 ${t.uploadText}`}>
                Drag and drop your media files here, or{' '}
                <button className={`font-medium transition-colors ${t.browseBtn}`}
                  onClick={() => inputRef.current?.click()}>
                  browse
                </button>
              </p>
              <p className={`text-sm ${t.uploadSub}`}>Supported formats: MP3, MP4, WAV</p>
              <input ref={inputRef} type="file" className="hidden" multiple
                accept="audio/*,video/*" onChange={handleFileInput} />
            </div>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className={`${t.card} p-4 mb-6`}>
              <h3 className={`font-medium mb-3 ${t.textPrimary}`}>Selected Files</h3>
              <div className="space-y-2">
                {files.map((file, i) => (
                  <div key={i} className={`flex items-center justify-between ${t.fileRowBg} p-3`}>
                    <div className="flex items-center gap-3">
                      {file.type.startsWith('video/')
                        ? <FileVideo className={`w-5 h-5 ${t.fileVideo}`} />
                        : <FileAudio className={`w-5 h-5 ${t.fileAudio}`} />}
                      <span className={`text-sm ${t.textSecondary}`}>{file.name}</span>
                    </div>
                    <button onClick={() => removeFile(i)} className={`transition-colors ${t.removeFile}`}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className={`p-4 rounded-xl mt-4 ${t.errorBg}`}>{error}</div>
          )}

          {/* Submit */}
          <button onClick={handleSubmit} disabled={isLoading || !files.length}
            className={`w-full mt-6 py-3 px-6 rounded-xl font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${t.btnCta} ${
              isLoading || !files.length ? 'opacity-30 cursor-not-allowed' : ''
            }`}>
            {isLoading ? 'Processing…' : 'Upload Media'}
          </button>

        </div>
      </div>
    </div>
  );
}
