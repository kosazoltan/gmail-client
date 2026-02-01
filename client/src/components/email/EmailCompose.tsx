import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSendEmail, useReplyEmail, type EmailAttachment } from '../../hooks/useEmails';
import { Send, X, Loader2, Paperclip, File, Image, FileText, Trash2 } from 'lucide-react';
import { EmailAutocomplete } from './EmailAutocomplete';
import { TemplateSelector } from './TemplateSelector';
import { TemplatesManager } from '../settings/TemplatesManager';
import { formatFileSize } from '../../lib/utils';
import type { Template } from '../../types';

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
function formatEmailBody(text: string): string {
  if (!text) return '';

  const lines = text.split('\n');
  const formatted = lines.map((line) => {
    if (line.trim() === '') {
      return '<div><br/></div>';
    }
    // Nincs inline style - a szülő elem CSS fogja meghatározni a színt
    return `<div>${line || '<br/>'}</div>`;
  });

  return formatted.join('');
}

export function EmailCompose() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sendEmail = useSendEmail();
  const replyEmail = useReplyEmail();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bodyEditorRef = useRef<HTMLDivElement>(null);

  const isReply = searchParams.get('reply') === 'true';
  const isForward = searchParams.has('body') && !isReply;
  const [to, setTo] = useState(searchParams.get('to') || '');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(searchParams.get('subject') || '');
  const [body, setBody] = useState(searchParams.get('body') || '');
  const [showCc, setShowCc] = useState(false);
  const [showTemplatesManager, setShowTemplatesManager] = useState(false);
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);

  const threadId = searchParams.get('threadId') || undefined;

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
        alert(`A mellékletek össz mérete meghaladja a limitet (max ~35MB). A "${file.name}" nem lett hozzáadva.`);
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
        const result = reader.result as string;
        // Data URL-ből csak a base64 rész kell
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSend = async () => {
    if (!to || !body) return;

    // Mellékletek konvertálása az API formátumba
    const emailAttachments: EmailAttachment[] = attachments.map((a) => ({
      filename: a.filename,
      mimeType: a.mimeType,
      content: a.content,
    }));

    try {
      if (isReply) {
        await replyEmail.mutateAsync({
          to,
          subject,
          body,
          cc,
          threadId,
          attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
        });
      } else {
        await sendEmail.mutateAsync({
          to,
          subject,
          body,
          cc,
          attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
        });
      }
      navigate(-1);
    } catch (error) {
      console.error('Küldési hiba:', error);
    }
  };

  const isPending = sendEmail.isPending || replyEmail.isPending;

  // Összes melléklet mérete
  const totalAttachmentSize = attachments.reduce((sum, a) => sum + a.size, 0);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="bg-white dark:bg-dark-bg-secondary rounded-xl shadow-sm border border-gray-200 dark:border-dark-border">
        {/* Fejléc */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-dark-border">
          <h2 className="font-medium text-gray-800 dark:text-dark-text">
            {isReply ? 'Válasz' : isForward ? 'Továbbítás' : 'Új levél'}
          </h2>
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary text-gray-400 dark:text-dark-text-muted"
            aria-label="Bezárás"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Űrlap */}
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 dark:text-dark-text-secondary w-16">Címzett:</label>
            <EmailAutocomplete
              value={to}
              onChange={setTo}
              placeholder="pelda@gmail.com"
              className="flex-1 px-3 py-1.5 text-sm border-b border-gray-200 dark:border-dark-border focus:border-blue-400 outline-none bg-transparent dark:text-dark-text"
            />
            {!showCc && (
              <button
                onClick={() => setShowCc(true)}
                className="text-xs text-blue-500 hover:text-blue-600"
              >
                Másolat
              </button>
            )}
          </div>

          {showCc && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500 dark:text-dark-text-secondary w-16">Másolat:</label>
              <EmailAutocomplete
                value={cc}
                onChange={setCc}
                placeholder="masik@gmail.com"
                className="flex-1 px-3 py-1.5 text-sm border-b border-gray-200 dark:border-dark-border focus:border-blue-400 outline-none bg-transparent dark:text-dark-text"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 dark:text-dark-text-secondary w-16">Tárgy:</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Levél tárgya"
              className="flex-1 px-3 py-1.5 text-sm border-b border-gray-200 dark:border-dark-border focus:border-blue-400 outline-none bg-transparent dark:text-dark-text"
            />
          </div>

          <div
            ref={bodyEditorRef}
            contentEditable
            onInput={handleBodyInput}
            onKeyDown={handleKeyDown}
            className="w-full px-3 py-2 text-sm outline-none bg-transparent text-gray-900 dark:text-gray-300 min-h-[240px] max-h-[500px] overflow-y-auto border border-gray-200 dark:border-dark-border rounded-lg focus:border-blue-400 focus:ring-1 focus:ring-blue-400 [&_div]:!text-[inherit] [&_*]:!text-[inherit]"
            style={{
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
            }}
            data-placeholder={body ? '' : 'Levél szövege... (Válaszoláskor az új szöveged kék színnel jelenik meg)'}
          />

          {/* Mellékletek */}
          {attachments.length > 0 && (
            <div className="border-t border-gray-100 dark:border-dark-border pt-3">
              <div className="flex items-center gap-2 mb-2">
                <Paperclip className="h-4 w-4 text-gray-400" />
                <span className="text-xs text-gray-500 dark:text-dark-text-secondary">
                  {attachments.length} melléklet ({formatFileSize(totalAttachmentSize)})
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-dark-bg-tertiary rounded-lg group"
                  >
                    <AttachmentIcon mimeType={att.mimeType} className="h-4 w-4 text-gray-500" />
                    <span className="text-xs text-gray-700 dark:text-dark-text max-w-[150px] truncate">
                      {att.filename}
                    </span>
                    <span className="text-xs text-gray-400">{formatFileSize(att.size)}</span>
                    <button
                      onClick={() => removeAttachment(att.id)}
                      className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-500/20 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
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

        {/* Küldés gomb */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-dark-border">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSend}
              disabled={!to || !body || isPending}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Küldés
            </button>

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
              className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary rounded-lg transition-colors"
              title="Melléklet csatolása"
            >
              <Paperclip className="h-4 w-4" />
              <span className="hidden sm:inline text-sm">Csatolás</span>
            </button>

            <TemplateSelector
              onSelect={handleTemplateSelect}
              onManage={() => setShowTemplatesManager(true)}
            />
          </div>

          <button
            onClick={() => navigate(-1)}
            className="text-sm text-gray-500 dark:text-dark-text-secondary hover:text-gray-700 dark:hover:text-dark-text"
          >
            Elvetés
          </button>
        </div>
      </div>

      {/* Sablonkezelő modal */}
      {showTemplatesManager && (
        <TemplatesManager onClose={() => setShowTemplatesManager(false)} />
      )}
    </div>
  );
}
