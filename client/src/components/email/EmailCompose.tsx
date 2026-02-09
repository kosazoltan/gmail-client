import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { useSendEmail, useReplyEmail, type EmailAttachment } from '../../hooks/useEmails';
import {
  Send,
  X,
  Loader2,
  Paperclip,
  File,
  Image,
  FileText,
  Trash2,
  Clock,
  CalendarClock,
} from 'lucide-react';
import { EmailAutocomplete } from './EmailAutocomplete';
import { TemplateSelector } from './TemplateSelector';
import { TemplatesManager } from '../settings/TemplatesManager';
import { ScheduleMenu, ScheduledBadge } from './ScheduleMenu';
import { formatFileSize } from '../../lib/utils';
import { toast } from '../../lib/toast';
import { useSettings, defaultSettings } from '../../hooks/useSettings';
import { useCreateScheduledEmail } from '../../hooks/useScheduledEmails';
import type { Template } from '../../types';

// Alapértelmezett undo send késleltetés másodpercben
const DEFAULT_UNDO_DELAY = 5;

// Lokális melléklet típus (még nem küldött)
interface LocalAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  content: string; // Base64
}

// Melléklet ikon típus alapján
function AttachmentIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  if (mimeType.startsWith('image/')) return <Image className={className} />;
  if (mimeType.includes('pdf')) return <FileText className={className} />;
  return <File className={className} />;
}

// Email body formázása válaszoláshoz
// XSS FIX: Sanitize text before creating HTML
function formatEmailBody(text: string): string {
  if (!text) return '';

  // First escape HTML entities to prevent XSS
  const escapeHtml = (str: string) => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };

  const lines = text.split('\n');
  const formatted = lines.map((line) => {
    if (line.trim() === '') {
      return '<div><br/></div>';
    }
    // Escape HTML in each line to prevent XSS
    return `<div>${escapeHtml(line) || '<br/>'}</div>`;
  });

  // Final sanitization pass
  return DOMPurify.sanitize(formatted.join(''), {
    ALLOWED_TAGS: ['div', 'br'],
    ALLOWED_ATTR: [],
  });
}

export function EmailCompose() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sendEmail = useSendEmail();
  const replyEmail = useReplyEmail();
  const createScheduledEmail = useCreateScheduledEmail();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bodyEditorRef = useRef<HTMLDivElement>(null);
  const sendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoToastIdRef = useRef<string | null>(null);
  const { data: settings } = useSettings();

  const isReply = searchParams.get('reply') === 'true';
  const isForward = searchParams.has('body') && !isReply;
  const [to, setTo] = useState(searchParams.get('to') || '');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(searchParams.get('subject') || '');
  const [body, setBody] = useState(searchParams.get('body') || '');
  const [showCc, setShowCc] = useState(false);
  const [showTemplatesManager, setShowTemplatesManager] = useState(false);
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [isSendPending, setIsSendPending] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<number | null>(null);

  const threadId = searchParams.get('threadId') || undefined;

  // FIX: Ref to store email data snapshot for undo send feature
  // This prevents stale closure issues during the undo delay window
  interface SendSnapshot {
    to: string;
    cc: string;
    subject: string;
    body: string;
    attachments: LocalAttachment[];
    threadId: string | undefined;
  }
  const sendSnapshotRef = useRef<SendSnapshot | null>(null);

  // Undo send késleltetés beállításból vagy alapértelmezett
  const undoSendDelay =
    settings?.undoSendDelay ?? defaultSettings.undoSendDelay ?? DEFAULT_UNDO_DELAY;

  // Cleanup timeout, toast, and snapshot on unmount
  useEffect(() => {
    return () => {
      if (sendTimeoutRef.current) {
        clearTimeout(sendTimeoutRef.current);
        sendTimeoutRef.current = null;
      }
      if (undoToastIdRef.current) {
        toast.dismiss(undoToastIdRef.current);
        undoToastIdRef.current = null;
      }
      sendSnapshotRef.current = null;
    };
  }, []);

  // Inicializálás: contenteditable div feltöltése formázott szöveggel
  useEffect(() => {
    if (bodyEditorRef.current && body) {
      bodyEditorRef.current.innerHTML = formatEmailBody(body);
      // Kurzor a szöveg elejére helyezése (íráshoz)
      bodyEditorRef.current.focus();
      const range = document.createRange();
      range.selectNodeContents(bodyEditorRef.current);
      range.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }, []);

  // Body frissítése contenteditable div-ből
  const handleBodyInput = () => {
    if (bodyEditorRef.current) {
      setBody(bodyEditorRef.current.innerText);
    }
  };

  // Billentyűzet esemény - új szöveg kék színűvé tétele
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Ha válaszolunk (isReply), akkor az új szöveg kék legyen
    if (isReply && bodyEditorRef.current) {
      // Beállítjuk a szöveg színét kékre az új karakterekhez
      document.execCommand('foreColor', false, '#2563eb');
    }
  };

  const handleTemplateSelect = (template: Template) => {
    if (template.subject && !subject) {
      setSubject(template.subject);
    }
    setBody((prev) => (prev ? prev + '\n\n' + template.body : template.body));
  };

  // Fájl kiválasztása
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: LocalAttachment[] = [];

    // Összes méret ellenőrzése (Gmail ~35MB limit)
    const MAX_TOTAL_SIZE = 35 * 1024 * 1024;
    const MAX_FILE_SIZE = 25 * 1024 * 1024;

    let currentTotal = attachments.reduce((sum, a) => sum + a.size, 0);

    for (const file of Array.from(files)) {
      // Max 25MB per file (Gmail limit)
      if (file.size > MAX_FILE_SIZE) {
        alert(`A "${file.name}" fájl túl nagy (max 25MB)`);
        continue;
      }

      // Össz méret ellenőrzése
      if (currentTotal + file.size > MAX_TOTAL_SIZE) {
        alert(
          `A mellékletek össz mérete meghaladja a limitet (max ~35MB). A "${file.name}" nem lett hozzáadva.`,
        );
        break;
      }

      // Base64-be konvertálás
      const content = await fileToBase64(file);

      newAttachments.push({
        id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        content,
      });

      currentTotal += file.size;
    }

    setAttachments((prev) => [...prev, ...newAttachments]);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Melléklet eltávolítása
  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Fájl Base64-be konvertálása
  const fileToBase64 = (file: globalThis.File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== 'string') {
          reject(new Error('FileReader result is not a string'));
          return;
        }
        // Data URL-ből csak a base64 rész kell
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Tényleges email küldés - FIX: Use snapshot ref to avoid stale closure issues
  const actualSend = useCallback(async () => {
    // Use snapshot if available (from delayed send), otherwise use current state
    const snapshot = sendSnapshotRef.current;
    const sendTo = snapshot?.to ?? to;
    const sendCc = snapshot?.cc ?? cc;
    const sendSubject = snapshot?.subject ?? subject;
    const sendBody = snapshot?.body ?? body;
    const sendAttachments = snapshot?.attachments ?? attachments;
    const sendThreadId = snapshot?.threadId ?? threadId;

    const emailAttachments: EmailAttachment[] = sendAttachments.map((a) => ({
      filename: a.filename,
      mimeType: a.mimeType,
      content: a.content,
    }));

    try {
      if (isReply) {
        await replyEmail.mutateAsync({
          to: sendTo,
          subject: sendSubject,
          body: sendBody,
          cc: sendCc,
          threadId: sendThreadId,
          attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
        });
      } else {
        await sendEmail.mutateAsync({
          to: sendTo,
          subject: sendSubject,
          body: sendBody,
          cc: sendCc,
          attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
        });
      }
      sendSnapshotRef.current = null; // Clear snapshot after successful send
      toast.success('Email elküldve!');
      navigate(-1);
    } catch (error) {
      console.error('Küldési hiba:', error);
      toast.error('Nem sikerült elküldeni az emailt. Kérlek próbáld újra.');
      sendSnapshotRef.current = null; // Clear snapshot on error too
      setIsSendPending(false);
    }
  }, [to, subject, body, cc, threadId, attachments, isReply, replyEmail, sendEmail, navigate]);

  // Küldés visszavonása
  const cancelSend = useCallback(() => {
    if (sendTimeoutRef.current) {
      clearTimeout(sendTimeoutRef.current);
      sendTimeoutRef.current = null;
    }
    if (undoToastIdRef.current) {
      toast.dismiss(undoToastIdRef.current);
      undoToastIdRef.current = null;
    }
    sendSnapshotRef.current = null; // FIX: Clear snapshot on cancel
    setIsSendPending(false);
    toast.info('Küldés visszavonva');
  }, []);

  // Küldés gomb kezelése - késleltetett küldés undo lehetőséggel
  const handleSend = async () => {
    if (!to || !body) return;

    // Ha nincs undo delay (0), azonnal küldjük
    if (!undoSendDelay || undoSendDelay <= 0) {
      setIsSendPending(true);
      await actualSend();
      return;
    }

    // FIX: Capture state snapshot BEFORE starting the delay
    // This ensures we send with the values at the time user clicked Send
    sendSnapshotRef.current = {
      to,
      cc,
      subject,
      body,
      attachments: [...attachments], // Clone array to prevent mutations
      threadId,
    };

    // Késleltetett küldés undo lehetőséggel
    setIsSendPending(true);

    // Toast megjelenítése visszavonás lehetőséggel
    undoToastIdRef.current = toast.undoable(
      `Email küldése ${undoSendDelay} másodperc múlva...`,
      cancelSend,
      undoSendDelay * 1000,
    );

    // Időzítő beállítása a tényleges küldéshez
    sendTimeoutRef.current = setTimeout(() => {
      sendTimeoutRef.current = null;
      undoToastIdRef.current = null;
      actualSend();
    }, undoSendDelay * 1000);
  };

  // Ütemezett küldés kezelése
  const handleSchedule = async (timestamp: number) => {
    if (!to) {
      toast.error('Kérlek add meg a címzettet');
      return;
    }

    setScheduledAt(timestamp);
  };

  // Ütemezett email mentése és küldés a megfelelő időpontban
  const handleScheduledSend = async () => {
    if (!to || !scheduledAt) return;

    try {
      setIsSendPending(true);
      await createScheduledEmail.mutateAsync({
        to,
        cc: cc || undefined,
        subject: subject || undefined,
        body: body || undefined,
        scheduledAt,
      });
      toast.success('Email sikeresen ütemezve!');
      navigate(-1);
    } catch (error) {
      console.error('Ütemezési hiba:', error);
      toast.error('Nem sikerült ütemezni az emailt');
      setIsSendPending(false);
    }
  };

  const isPending =
    sendEmail.isPending || replyEmail.isPending || isSendPending || createScheduledEmail.isPending;

  // Összes melléklet mérete
  const totalAttachmentSize = attachments.reduce((sum, a) => sum + a.size, 0);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="dark:bg-dark-bg-secondary dark:border-dark-border rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Fejléc */}
        <div className="dark:border-dark-border flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="dark:text-dark-text font-medium text-gray-800">
            {isReply ? 'Válasz' : isForward ? 'Továbbítás' : 'Új levél'}
          </h2>
          <div className="flex items-center gap-2">
            {undoSendDelay > 0 && (
              <span
                className="dark:text-dark-text-muted flex items-center gap-1 text-xs text-gray-400"
                title="Küldés visszavonható ennyi ideig"
              >
                <Clock className="h-3 w-3" />
                {undoSendDelay}mp
              </span>
            )}
            <button
              onClick={() => navigate(-1)}
              className="dark:hover:bg-dark-bg-tertiary dark:text-dark-text-muted rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100"
              aria-label="Bezárás"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Űrlap */}
        <div className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <label className="dark:text-dark-text-secondary w-20 shrink-0 text-sm text-gray-500">
              Címzett:
            </label>
            <EmailAutocomplete
              value={to}
              onChange={setTo}
              placeholder="pelda@gmail.com"
              className="dark:border-dark-border dark:text-dark-text w-full min-w-0 flex-1 rounded-xl border border-gray-200 bg-transparent px-3 py-1.5 text-sm transition-colors outline-none focus:border-[#4f6ef7]/50 focus:ring-2 focus:ring-[#4f6ef7]/20"
            />
            {!showCc && (
              <button
                onClick={() => setShowCc(true)}
                className="shrink-0 text-xs text-[#4f6ef7] transition-colors hover:text-[#3d5ce5]"
              >
                Másolat
              </button>
            )}
          </div>

          {showCc && (
            <div className="flex items-center gap-2">
              <label className="dark:text-dark-text-secondary w-20 shrink-0 text-sm text-gray-500">
                Másolat:
              </label>
              <EmailAutocomplete
                value={cc}
                onChange={setCc}
                placeholder="masik@gmail.com"
                className="dark:border-dark-border dark:text-dark-text w-full min-w-0 flex-1 rounded-xl border border-gray-200 bg-transparent px-3 py-1.5 text-sm transition-colors outline-none focus:border-[#4f6ef7]/50 focus:ring-2 focus:ring-[#4f6ef7]/20"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="dark:text-dark-text-secondary w-20 shrink-0 text-sm text-gray-500">
              Tárgy:
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Levél tárgya"
              className="dark:border-dark-border dark:text-dark-text min-w-0 flex-1 rounded-xl border border-gray-200 bg-transparent px-3 py-1.5 text-sm transition-colors outline-none focus:border-[#4f6ef7]/50 focus:ring-2 focus:ring-[#4f6ef7]/20"
            />
          </div>

          <div
            ref={bodyEditorRef}
            contentEditable
            onInput={handleBodyInput}
            onKeyDown={handleKeyDown}
            className="dark:border-dark-border max-h-[500px] min-h-[240px] w-full overflow-y-auto rounded-xl border border-gray-200 bg-transparent px-3 py-2 text-sm text-gray-900 transition-colors outline-none focus:border-[#4f6ef7]/50 focus:ring-2 focus:ring-[#4f6ef7]/20 dark:text-gray-300 [&_*]:!text-[inherit] [&_div]:!text-[inherit]"
            style={{
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
            }}
            data-placeholder={
              body ? '' : 'Levél szövege... (Válaszoláskor az új szöveged kék színnel jelenik meg)'
            }
          />

          {/* Mellékletek */}
          {attachments.length > 0 && (
            <div className="dark:border-dark-border border-t border-gray-100 pt-3">
              <div className="mb-2 flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-gray-400" />
                <span className="dark:text-dark-text-secondary text-xs text-gray-500">
                  {attachments.length} melléklet ({formatFileSize(totalAttachmentSize)})
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="dark:bg-dark-bg-tertiary group flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5"
                  >
                    <AttachmentIcon mimeType={att.mimeType} className="h-4 w-4 text-gray-500" />
                    <span className="dark:text-dark-text max-w-[150px] truncate text-xs text-gray-700">
                      {att.filename}
                    </span>
                    <span className="text-xs text-gray-400">{formatFileSize(att.size)}</span>
                    <button
                      onClick={() => removeAttachment(att.id)}
                      className="rounded p-0.5 text-gray-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-500/20"
                      aria-label="Melléklet eltávolítása"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Scheduled badge */}
        {scheduledAt && (
          <div className="dark:border-dark-border border-t border-gray-100 px-4 py-2">
            <ScheduledBadge scheduledAt={scheduledAt} onCancel={() => setScheduledAt(null)} />
          </div>
        )}

        {/* Küldés gomb */}
        <div className="dark:border-dark-border flex items-center justify-between border-t border-gray-200 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {scheduledAt ? (
              /* Ütemezett küldés gomb */
              <button
                onClick={handleScheduledSend}
                disabled={!to || isPending}
                className="flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-2 text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CalendarClock className="h-4 w-4" />
                )}
                Ütemezés
              </button>
            ) : (
              /* Azonnali küldés gomb */
              <button
                onClick={handleSend}
                disabled={!to || !body || isPending}
                className="flex items-center gap-2 rounded-lg bg-[#4f6ef7] px-6 py-2 text-white transition-colors hover:bg-[#3d5ce5] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Küldés
              </button>
            )}

            {/* Ütemezés menü - csak ha nincs már ütemezve */}
            {!scheduledAt && !isReply && (
              <ScheduleMenu onSchedule={handleSchedule} disabled={isPending} />
            )}

            {/* Melléklet csatolás gomb */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              accept="*/*"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="dark:text-dark-text-secondary dark:hover:bg-dark-bg-tertiary flex items-center gap-2 rounded-lg px-4 py-2 text-gray-600 transition-colors hover:bg-gray-100"
              title="Melléklet csatolása"
            >
              <Paperclip className="h-4 w-4" />
              <span className="hidden text-sm sm:inline">Csatolás</span>
            </button>

            <TemplateSelector
              onSelect={handleTemplateSelect}
              onManage={() => setShowTemplatesManager(true)}
            />
          </div>

          <button
            onClick={() => navigate(-1)}
            className="dark:text-dark-text-secondary dark:hover:text-dark-text text-sm text-gray-500 transition-colors hover:text-gray-700"
          >
            Elvetés
          </button>
        </div>
      </div>

      {/* Sablonkezelő modal */}
      {showTemplatesManager && <TemplatesManager onClose={() => setShowTemplatesManager(false)} />}
    </div>
  );
}
