import { useEffect, useState, useMemo, useRef } from 'react';
import DOMPurify from 'dompurify';
import { useEmailDetail, useMarkRead, useDeleteEmail } from '../../hooks/useEmails';
import { AttachmentView } from './AttachmentView';
import {
  formatFullDate,
  displaySender,
  getInitials,
  emailToColor,
} from '../../lib/utils';
import {
  ArrowLeft,
  Reply,
  ReplyAll,
  Forward,
  Trash2,
  Loader2,
  Paperclip,
  MoreHorizontal,
  Clock,
  Mail,
  ChevronDown,
  ChevronUp,
  Tag,
  Download,
  FileText,
  Languages,
  X,
} from 'lucide-react';
import { api } from '../../lib/api';
import { SnoozeMenu } from './SnoozeMenu';
import { ReminderMenu } from './ReminderMenu';
import { LabelManager } from './LabelManager';
import { exportEmailToPdf } from '../../lib/pdfExport';
import { toast } from '../../lib/toast';
import { useEmailTranslation } from '../../hooks/useTranslate';

interface EmailDetailProps {
  emailId: string | null;
  accountId?: string;
  onBack: () => void;
  onReply: (email: { to: string; subject: string; threadId?: string; body?: string; fromName?: string; date?: number }) => void;
  onReplyAll?: (email: { to: string; cc?: string; subject: string; threadId?: string; body?: string; fromName?: string; date?: number }) => void;
  onForward?: (email: { subject: string; body: string }) => void;
}

export function EmailDetail({
  emailId,
  accountId,
  onBack,
  onReply,
  onReplyAll,
  onForward,
}: EmailDetailProps) {
  const { data: email, isLoading } = useEmailDetail(emailId, accountId);
  const markRead = useMarkRead();
  const deleteEmail = useDeleteEmail();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showLabelManager, setShowLabelManager] = useState(false);
  const { translatedContent, isTranslating, translateEmail, clearTranslation } = useEmailTranslation();

  // HTML szanitizálás XSS elleni védelem - hook-nak a return előtt kell lennie
  const sanitizedHtml = useMemo(() => {
    if (!email?.bodyHtml) return '';
    return DOMPurify.sanitize(email.bodyHtml, {
      ALLOWED_TAGS: [
        // Text formatting
        'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'strike', 'sub', 'sup', 'small', 'big',
        // Links and media
        'a', 'img',
        // Lists
        'ul', 'ol', 'li', 'dl', 'dt', 'dd',
        // Headings
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        // Block elements
        'blockquote', 'pre', 'code', 'div', 'span', 'hr', 'address', 'center',
        // Tables - full support
        'table', 'caption', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'colgroup', 'col',
        // Typography and formatting
        'font', 'label', 'abbr', 'acronym', 'cite', 'dfn', 'kbd', 'samp', 'var', 'mark',
      ],
      ALLOWED_ATTR: [
        'href', 'src', 'alt', 'title', 'class', 'style', 'target', 'rel',
        'width', 'height', 'border', 'cellpadding', 'cellspacing',
        'align', 'valign', 'bgcolor', 'color', 'face', 'size',
        'colspan', 'rowspan', 'scope', 'headers',
        'dir', 'lang', 'id', 'name',
      ],
      ALLOW_DATA_ATTR: false,
      ADD_ATTR: ['target'],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'select', 'textarea'],
    });
  }, [email?.bodyHtml]);

  // Automatikus olvasottnak jelölés - ref-fel elkerüljük a felesleges újrafutást
  const markReadRef = useRef(markRead);
  // BUG #9 Fix: Move ref mutation to useEffect instead of render phase
  useEffect(() => {
    markReadRef.current = markRead;
  }, [markRead]);

  useEffect(() => {
    if (email && !email.isRead && !markRead.isPending) {
      markReadRef.current.mutate({ emailId: email.id, isRead: true });
    }
  }, [email?.id, email?.isRead, markRead.isPending]);

  if (!emailId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-dark-text-muted">
        <Mail className="h-16 w-16 mb-4 opacity-20" />
        <p className="text-lg">Válassz ki egy levelet</p>
        <p className="text-sm mt-1 opacity-60">a megtekintéshez</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="text-sm text-gray-400 dark:text-dark-text-muted">Betöltés...</span>
        </div>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-dark-text-muted">
        <Mail className="h-16 w-16 mb-4 opacity-20" />
        <p>Email nem található</p>
      </div>
    );
  }

  const sender = displaySender(email.fromName, email.from);
  const initials = getInitials(sender);
  const avatarColor = emailToColor(email.from || '');

  // Időformázás rövidebb verzió
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-dark-bg">
      {/* Kompakt fejléc */}
      <div className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-1.5 sm:py-2 bg-white dark:bg-dark-bg-secondary border-b border-gray-100 dark:border-dark-border">
        <button
          onClick={onBack}
          className="p-1.5 sm:p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary text-gray-500 dark:text-dark-text-secondary lg:hidden transition-colors"
          aria-label="Vissza"
        >
          <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-dark-text truncate">
            {email.subject || '(Nincs tárgy)'}
          </h1>
        </div>

        {/* Fő akciók */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          <button
            onClick={() =>
              onReply({
                to: email.from || '',
                subject: `Re: ${email.subject || ''}`,
                threadId: email.threadId || undefined,
                body: email.body || email.snippet || '',
                fromName: email.fromName || email.from || '',
                date: email.date,
              })
            }
            className="p-1.5 sm:p-2.5 rounded-full hover:bg-blue-50 dark:hover:bg-blue-500/10 text-gray-500 dark:text-dark-text-secondary hover:text-blue-600 dark:hover:text-blue-400 transition-colors touch-manipulation"
            aria-label="Válasz"
            title="Válasz"
          >
            <Reply className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>

          <button
            onClick={() => {
              // FIX: Guard against missing callback and email.from
              if (!onReplyAll || !email.from) return;
              // Válasz mindenkinek: eredeti küldő + minden címzett (kivéve magunkat)
              const allRecipients = [email.to, email.cc].filter(Boolean).join(', ');
              onReplyAll({
                to: email.from,
                cc: allRecipients || undefined,
                subject: `Re: ${email.subject || ''}`,
                threadId: email.threadId || undefined,
                body: email.body || email.snippet || '',
                fromName: email.fromName || email.from,
                date: email.date,
              });
            }}
            disabled={!onReplyAll || !email.from}
            className="p-1.5 sm:p-2.5 rounded-full hover:bg-blue-50 dark:hover:bg-blue-500/10 text-gray-500 dark:text-dark-text-secondary hover:text-blue-600 dark:hover:text-blue-400 transition-colors touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Válasz mindenkinek"
            title="Válasz mindenkinek"
          >
            <ReplyAll className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>

          <button
            onClick={() => {
              // FIX: Guard against missing callback
              if (!onForward) return;
              onForward({
                subject: `Fwd: ${email.subject || ''}`,
                body: `\n\n---------- Továbbított üzenet ----------\nKüldő: ${email.fromName || ''} <${email.from || ''}>\nDátum: ${formatFullDate(email.date)}\nTárgy: ${email.subject || ''}\nCímzett: ${email.to || ''}\n\n${email.body || ''}`,
              });
            }}
            disabled={!onForward}
            className="p-1.5 sm:p-2.5 rounded-full hover:bg-blue-50 dark:hover:bg-blue-500/10 text-gray-500 dark:text-dark-text-secondary hover:text-blue-600 dark:hover:text-blue-400 transition-colors touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Továbbítás"
            title="Továbbítás"
          >
            <Forward className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>

          {/* Közvetlen törlés gomb */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-1.5 sm:p-2.5 rounded-full hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-500 dark:text-dark-text-secondary hover:text-red-600 dark:hover:text-red-400 transition-colors touch-manipulation"
            aria-label="Törlés"
            title="Törlés"
          >
            <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>

          {/* Címkék gomb */}
          <div className="relative">
            <button
              onClick={() => setShowLabelManager(!showLabelManager)}
              className="p-1.5 sm:p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary text-gray-500 dark:text-dark-text-secondary transition-colors touch-manipulation"
              aria-label="Címkék"
              title="Címkék"
            >
              <Tag className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            {showLabelManager && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowLabelManager(false)}
                />
                <LabelManager
                  emailId={email.id}
                  currentLabels={email.labels || []}
                  onClose={() => setShowLabelManager(false)}
                />
              </>
            )}
          </div>

          {/* További műveletek dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowMoreActions(!showMoreActions)}
              className="p-1.5 sm:p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary text-gray-500 dark:text-dark-text-secondary transition-colors touch-manipulation"
              aria-label="További műveletek"
            >
              <MoreHorizontal className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>

            {showMoreActions && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowMoreActions(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-dark-bg-secondary rounded-xl shadow-lg border border-gray-100 dark:border-dark-border py-1 z-50">
                  <div className="px-1">
                    <SnoozeMenu emailId={email.id} variant="menu-item" onClose={() => setShowMoreActions(false)} />
                  </div>
                  <div className="px-1">
                    <ReminderMenu emailId={email.id} variant="menu-item" onClose={() => setShowMoreActions(false)} />
                  </div>
                  <div className="border-t border-gray-100 dark:border-dark-border my-1" />
                  <button
                    onClick={async () => {
                      setShowMoreActions(false);
                      try {
                        await exportEmailToPdf(email);
                        toast.success('PDF sikeresen exportálva');
                      } catch (error) {
                        toast.error('PDF exportálás sikertelen');
                      }
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary transition-colors"
                  >
                    <FileText className="h-5 w-5" />
                    <span>Mentés PDF-ként</span>
                  </button>
                  <button
                    onClick={async () => {
                      setShowMoreActions(false);
                      if (translatedContent) {
                        clearTranslation();
                      } else {
                        try {
                          await translateEmail(email.subject, email.body || email.snippet, 'hu');
                          toast.success('Fordítás kész');
                        } catch (error) {
                          toast.error('Fordítás sikertelen');
                        }
                      }
                    }}
                    disabled={isTranslating}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary transition-colors disabled:opacity-50"
                  >
                    <Languages className="h-5 w-5" />
                    <span>{isTranslating ? 'Fordítás...' : translatedContent ? 'Eredeti mutatása' : 'Fordítás magyarra'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Törlés megerősítő modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-bg-secondary rounded-2xl p-6 max-w-sm mx-4 shadow-2xl dark:border dark:border-dark-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-full bg-red-100 dark:bg-red-500/20">
                <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text">
                  Email törlése
                </h3>
                <p className="text-sm text-gray-500 dark:text-dark-text-secondary">
                  A levél a kukába kerül
                </p>
              </div>
            </div>
            {deleteError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg text-sm text-red-600 dark:text-red-400">
                {deleteError}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteError(null);
                }}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl border border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary dark:text-dark-text transition-colors"
              >
                Mégse
              </button>
              <button
                onClick={() => {
                  setDeleteError(null);
                  deleteEmail.mutate(email.id, {
                    onSuccess: () => {
                      setShowDeleteConfirm(false);
                      onBack();
                    },
                    onError: (error) => {
                      console.error('Delete failed:', error);
                      setDeleteError('Nem sikerült törölni az emailt. Próbáld újra.');
                    },
                  });
                }}
                disabled={deleteEmail.isPending}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleteEmail.isPending ? 'Törlés...' : 'Törlés'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email tartalom - scrollozható */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-2 sm:p-4">
          {/* Küldő kártya */}
          <div className="bg-white dark:bg-dark-bg-secondary rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border mb-2 sm:mb-4 overflow-hidden">
            <div className="p-2.5 sm:p-4">
              <div className="flex items-start gap-2 sm:gap-3">
                {/* Avatar */}
                <div
                  className="flex-shrink-0 w-9 h-9 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white text-sm sm:text-base font-semibold shadow-sm"
                  style={{ backgroundColor: avatarColor }}
                >
                  {initials}
                </div>

                {/* Küldő infó */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 sm:gap-2">
                    <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                      <span className="text-sm sm:text-base font-semibold text-gray-900 dark:text-dark-text truncate">
                        {sender}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                      <div className="flex items-center gap-1 text-[10px] sm:text-xs text-gray-400 dark:text-dark-text-muted">
                        <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        <span>{formatTime(email.date)}</span>
                      </div>
                      {/* Törlés gomb a küldő kártyában */}
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="p-1.5 sm:p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 dark:text-dark-text-muted hover:text-red-600 dark:hover:text-red-400 transition-colors touch-manipulation"
                        aria-label="Törlés"
                        title="Törlés"
                      >
                        <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="text-xs sm:text-sm text-gray-500 dark:text-dark-text-secondary mt-0.5 truncate">
                    {email.from}
                  </div>

                  {/* Részletek toggle */}
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="flex items-center gap-1 mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-gray-400 dark:text-dark-text-muted hover:text-gray-600 dark:hover:text-dark-text-secondary transition-colors"
                  >
                    {showDetails ? (
                      <>
                        <ChevronUp className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        <span>Részletek elrejtése</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        <span>Részletek mutatása</span>
                      </>
                    )}
                  </button>

                  {/* Részletes infó */}
                  {showDetails && (
                    <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-100 dark:border-dark-border space-y-1 sm:space-y-1.5 text-[10px] sm:text-xs">
                      <div className="flex gap-2">
                        <span className="text-gray-400 dark:text-dark-text-muted w-16">Küldő:</span>
                        <span className="text-gray-600 dark:text-dark-text-secondary">
                          {email.fromName ? `${email.fromName} <${email.from}>` : email.from}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-gray-400 dark:text-dark-text-muted w-16">Címzett:</span>
                        <span className="text-gray-600 dark:text-dark-text-secondary">{email.to}</span>
                      </div>
                      {email.cc && (
                        <div className="flex gap-2">
                          <span className="text-gray-400 dark:text-dark-text-muted w-16">Másolat:</span>
                          <span className="text-gray-600 dark:text-dark-text-secondary">{email.cc}</span>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <span className="text-gray-400 dark:text-dark-text-muted w-16">Dátum:</span>
                        <span className="text-gray-600 dark:text-dark-text-secondary">{formatFullDate(email.date)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Email body kártya */}
          <div className="bg-white dark:bg-dark-bg-secondary rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border overflow-hidden">
            {/* Translation banner */}
            {translatedContent && (
              <div className="flex items-center justify-between px-3 sm:px-5 py-2 bg-blue-50 dark:bg-blue-500/10 border-b border-blue-100 dark:border-blue-500/20">
                <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                  <Languages className="h-4 w-4" />
                  <span>Lefordítva magyarra</span>
                  {translatedContent.detectedLang && (
                    <span className="text-xs text-blue-500 dark:text-blue-400">
                      (eredeti: {translatedContent.detectedLang})
                    </span>
                  )}
                </div>
                <button
                  onClick={clearTranslation}
                  className="p-1 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded text-blue-600 dark:text-blue-400"
                  title="Eredeti mutatása"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="p-3 sm:p-5 md:p-6">
              {translatedContent?.body ? (
                <pre className="whitespace-pre-wrap text-xs sm:text-sm text-gray-700 dark:text-dark-text-secondary font-sans leading-relaxed">
                  {translatedContent.body}
                </pre>
              ) : sanitizedHtml ? (
                <div
                  className="email-content prose prose-sm max-w-none
                    text-gray-900 dark:text-gray-300
                    prose-img:rounded-lg prose-img:shadow-md"
                  dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                />
              ) : email.body ? (
                <pre className="whitespace-pre-wrap text-xs sm:text-sm text-gray-700 dark:text-dark-text-secondary font-sans leading-relaxed">
                  {email.body}
                </pre>
              ) : (
                <p className="text-gray-400 dark:text-dark-text-muted italic text-center py-4 sm:py-8 text-sm">
                  Nincs megjeleníthető tartalom
                </p>
              )}
            </div>

            {/* Mellékletek */}
            {email.attachments && email.attachments.length > 0 && (
              <div className="border-t border-gray-100 dark:border-dark-border bg-gray-50 dark:bg-dark-bg-tertiary/50 p-2.5 sm:p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-500/20">
                      <Paperclip className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-dark-text">
                      {email.attachments.length} melléklet
                    </span>
                  </div>
                  {email.attachments.length > 1 && (
                    <button
                      onClick={() => {
                        // Download all attachments one by one
                        email.attachments?.forEach((att, index) => {
                          setTimeout(() => {
                            const url = api.attachments.downloadUrl(att.id);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = att.filename;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }, index * 500); // Stagger downloads to avoid browser blocking
                        });
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-lg transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Összes letöltése
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {email.attachments.map((att) => (
                    <AttachmentView key={att.id} attachment={att} />
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
