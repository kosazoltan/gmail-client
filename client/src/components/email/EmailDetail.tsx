import { useEffect, useState, useMemo, useRef } from 'react';
import DOMPurify from 'dompurify';
import {
  useEmailDetail,
  useMarkRead,
  useDeleteEmail,
  useThreadConversation,
  useReplyEmail,
} from '../../hooks/useEmails';
import { AttachmentView } from './AttachmentView';
import { ConversationView } from './ConversationView';
import { formatFullDate, displaySender, getInitials, emailToColor } from '../../lib/utils';
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
  MessageSquare,
  Send,
} from 'lucide-react';
import { api } from '../../lib/api';
import { SnoozeMenu } from './SnoozeMenu';
import { ReminderMenu } from './ReminderMenu';
import { LabelManager } from './LabelManager';
import { exportEmailToPdf } from '../../lib/pdfExport';
import { toast } from '../../lib/toast';
import { useEmailTranslation } from '../../hooks/useTranslate';
import type { ThreadEmail } from '../../types';
import { InlineCopilotBar } from '../ai/InlineCopilotBar';

interface EmailDetailProps {
  emailId: string | null;
  accountId?: string;
  onBack: () => void;
  onReply: (email: {
    to: string;
    subject: string;
    threadId?: string;
    body?: string;
    fromName?: string;
    date?: number;
  }) => void;
  onReplyAll?: (email: {
    to: string;
    cc?: string;
    subject: string;
    threadId?: string;
    body?: string;
    fromName?: string;
    date?: number;
  }) => void;
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
  const { data: threadData, isLoading: isThreadLoading } = useThreadConversation(
    emailId,
    accountId,
  );
  const markRead = useMarkRead();
  const deleteEmail = useDeleteEmail();
  const replyEmail = useReplyEmail();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showLabelManager, setShowLabelManager] = useState(false);
  const [showConversation, setShowConversation] = useState(true);
  const { translatedContent, isTranslating, translateEmail, clearTranslation } =
    useEmailTranslation();
  const [quickReplyText, setQuickReplyText] = useState('');
  const [showQuickReply, setShowQuickReply] = useState(false);
  const [sendingQuickReply, setSendingQuickReply] = useState(false);

  // Thread adatok
  const threadEmails = useMemo(() => threadData?.emails ?? [], [threadData?.emails]);
  const hasThread = threadEmails.length > 1;
  const threadAccountEmail = threadData?.accountEmail || null;

  // FIX: Track download timeouts for cleanup on unmount
  const downloadTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // HTML szanitizálás XSS elleni védelem - hook-nak a return előtt kell lennie
  const sanitizedHtml = useMemo(() => {
    if (!email?.bodyHtml) return '';
    return DOMPurify.sanitize(email.bodyHtml, {
      ALLOWED_TAGS: [
        // Text formatting
        'p',
        'br',
        'strong',
        'em',
        'b',
        'i',
        'u',
        's',
        'strike',
        'sub',
        'sup',
        'small',
        'big',
        // Links and media
        'a',
        'img',
        // Lists
        'ul',
        'ol',
        'li',
        'dl',
        'dt',
        'dd',
        // Headings
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        // Block elements
        'blockquote',
        'pre',
        'code',
        'div',
        'span',
        'hr',
        'address',
        'center',
        // Tables - full support
        'table',
        'caption',
        'thead',
        'tbody',
        'tfoot',
        'tr',
        'th',
        'td',
        'colgroup',
        'col',
        // Typography and formatting
        'font',
        'label',
        'abbr',
        'acronym',
        'cite',
        'dfn',
        'kbd',
        'samp',
        'var',
        'mark',
      ],
      ALLOWED_ATTR: [
        'href',
        'src',
        'alt',
        'title',
        'class',
        'style',
        'target',
        'rel',
        'width',
        'height',
        'border',
        'cellpadding',
        'cellspacing',
        'align',
        'valign',
        'bgcolor',
        'color',
        'face',
        'size',
        'colspan',
        'rowspan',
        'scope',
        'headers',
        'dir',
        'lang',
        'id',
        'name',
      ],
      ALLOW_DATA_ATTR: false,
      ADD_ATTR: ['target'],
      FORBID_TAGS: [
        'script',
        'iframe',
        'object',
        'embed',
        'form',
        'input',
        'button',
        'select',
        'textarea',
      ],
      // Engedélyezzük a data: URI-kat képekhez (base64 inline images)
      ALLOWED_URI_REGEXP:
        /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
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
      markReadRef.current.mutate({ emailId: email.id, isRead: true, accountId });
    }
  }, [email, markRead.isPending, accountId]);

  // FIX: Cleanup download timeouts on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      downloadTimeoutsRef.current.forEach(clearTimeout);
      downloadTimeoutsRef.current = [];
    };
  }, []);

  if (!emailId) {
    return (
      <div className="dark:text-dark-text-muted flex h-full flex-col items-center justify-center text-gray-400">
        <Mail className="mb-4 h-16 w-16 opacity-20" />
        <p className="text-lg">Válassz ki egy levelet</p>
        <p className="mt-1 text-sm opacity-60">a megtekintéshez</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="dark:text-dark-text-muted text-sm text-gray-400">Betöltés...</span>
        </div>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="dark:text-dark-text-muted flex h-full flex-col items-center justify-center text-gray-400">
        <Mail className="mb-4 h-16 w-16 opacity-20" />
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

  const handleQuickReply = async () => {
    if (!quickReplyText.trim() || !email.from) return;
    setSendingQuickReply(true);
    try {
      await replyEmail.mutateAsync({
        to: email.from,
        subject: `Re: ${email.subject || ''}`,
        body: quickReplyText.trim(),
        threadId: email.threadId || undefined,
      });
      toast.success('Válasz elküldve');
      setQuickReplyText('');
      setShowQuickReply(false);
    } catch {
      toast.error('Hiba a válasz küldésekor');
    } finally {
      setSendingQuickReply(false);
    }
  };

  return (
    <div className="dark:bg-dark-bg flex h-full flex-col bg-gray-50">
      {/* Kompakt fejléc */}
      <div className="dark:bg-dark-bg-secondary dark:border-dark-border flex items-center gap-2 border-b border-gray-100 bg-white px-2 py-1.5 sm:gap-3 sm:px-4 sm:py-2">
        <button
          onClick={onBack}
          className="dark:hover:bg-dark-bg-tertiary dark:text-dark-text-secondary rounded-lg p-1.5 text-gray-500 transition-all duration-200 hover:bg-gray-100 sm:p-2 lg:hidden"
          aria-label="Vissza"
        >
          <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="dark:text-dark-text truncate text-sm font-semibold text-gray-900 sm:text-base">
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
            className="dark:text-dark-text-secondary touch-manipulation rounded-lg p-1.5 text-gray-500 transition-all duration-200 hover:bg-blue-50 hover:text-blue-600 sm:p-2.5 dark:hover:bg-blue-500/10 dark:hover:text-blue-400"
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
            className="dark:text-dark-text-secondary touch-manipulation rounded-lg p-1.5 text-gray-500 transition-all duration-200 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50 sm:p-2.5 dark:hover:bg-blue-500/10 dark:hover:text-blue-400"
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
            className="dark:text-dark-text-secondary touch-manipulation rounded-lg p-1.5 text-gray-500 transition-all duration-200 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50 sm:p-2.5 dark:hover:bg-blue-500/10 dark:hover:text-blue-400"
            aria-label="Továbbítás"
            title="Továbbítás"
          >
            <Forward className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>

          {/* PDF Export közvetlen gomb */}
          <button
            onClick={async () => {
              try {
                await exportEmailToPdf(email);
                toast.success('PDF sikeresen exportálva');
              } catch {
                toast.error('PDF exportálás sikertelen');
              }
            }}
            className="dark:text-dark-text-secondary touch-manipulation rounded-lg p-1.5 text-gray-500 transition-all duration-200 hover:bg-purple-50 hover:text-purple-600 sm:p-2.5 dark:hover:bg-purple-500/10 dark:hover:text-purple-400"
            aria-label="Exportálás PDF-be"
            title="Exportálás PDF-be"
          >
            <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>

          {/* Közvetlen törlés gomb */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="dark:text-dark-text-secondary touch-manipulation rounded-lg p-1.5 text-gray-500 transition-all duration-200 hover:bg-red-50 hover:text-red-600 sm:p-2.5 dark:hover:bg-red-500/10 dark:hover:text-red-400"
            aria-label="Törlés"
            title="Törlés"
          >
            <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>

          {/* Címkék gomb */}
          <div className="relative">
            <button
              onClick={() => setShowLabelManager(!showLabelManager)}
              className="dark:hover:bg-dark-bg-tertiary dark:text-dark-text-secondary touch-manipulation rounded-lg p-1.5 text-gray-500 transition-all duration-200 hover:bg-gray-100 sm:p-2.5"
              aria-label="Címkék"
              title="Címkék"
            >
              <Tag className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            {showLabelManager && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowLabelManager(false)} />
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
              className="dark:hover:bg-dark-bg-tertiary dark:text-dark-text-secondary touch-manipulation rounded-lg p-1.5 text-gray-500 transition-all duration-200 hover:bg-gray-100 sm:p-2.5"
              aria-label="További műveletek"
            >
              <MoreHorizontal className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>

            {showMoreActions && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMoreActions(false)} />
                <div className="dark:bg-dark-bg-secondary dark:border-dark-border absolute top-full right-0 z-50 mt-1 w-48 rounded-xl border border-gray-100 bg-white py-1 shadow-lg">
                  <div className="px-1">
                    <SnoozeMenu
                      emailId={email.id}
                      variant="menu-item"
                      onClose={() => setShowMoreActions(false)}
                    />
                  </div>
                  <div className="px-1">
                    <ReminderMenu
                      emailId={email.id}
                      variant="menu-item"
                      onClose={() => setShowMoreActions(false)}
                    />
                  </div>
                  <div className="dark:border-dark-border my-1 border-t border-gray-100" />
                  <button
                    onClick={async () => {
                      setShowMoreActions(false);
                      try {
                        await exportEmailToPdf(email);
                        toast.success('PDF sikeresen exportálva');
                      } catch {
                        toast.error('PDF exportálás sikertelen');
                      }
                    }}
                    className="dark:text-dark-text dark:hover:bg-dark-bg-tertiary flex w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 transition-colors hover:bg-gray-100"
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
                        } catch {
                          toast.error('Fordítás sikertelen');
                        }
                      }
                    }}
                    disabled={isTranslating}
                    className="dark:text-dark-text dark:hover:bg-dark-bg-tertiary flex w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
                  >
                    <Languages className="h-5 w-5" />
                    <span>
                      {isTranslating
                        ? 'Fordítás...'
                        : translatedContent
                          ? 'Eredeti mutatása'
                          : 'Fordítás magyarra'}
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Törlés megerősítő modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="dark:bg-dark-bg-secondary dark:border-dark-border mx-4 max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:border">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-full bg-red-100 p-3 dark:bg-red-500/20">
                <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="dark:text-dark-text text-lg font-semibold text-gray-900">
                  Email törlése
                </h3>
                <p className="dark:text-dark-text-secondary text-sm text-gray-500">
                  A levél a kukába kerül
                </p>
              </div>
            </div>
            {deleteError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
                {deleteError}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteError(null);
                }}
                className="dark:border-dark-border dark:hover:bg-dark-bg-tertiary dark:text-dark-text flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-gray-50"
              >
                Mégse
              </button>
              <button
                onClick={() => {
                  setDeleteError(null);
                  deleteEmail.mutate({ emailId: email.id, accountId }, {
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
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deleteEmail.isPending ? 'Törlés...' : 'Törlés'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email tartalom - scrollozható */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-4xl p-2 sm:p-4">
          {/* Küldő kártya */}
          <div className="dark:bg-dark-bg-secondary dark:border-dark-border overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm sm:rounded-2xl">
            <div className="p-2.5 sm:p-4">
              <div className="flex items-start gap-2 sm:gap-3">
                {/* Avatar */}
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white shadow-sm sm:h-12 sm:w-12 sm:text-base"
                  style={{ backgroundColor: avatarColor }}
                >
                  {initials}
                </div>

                {/* Küldő infó */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1 sm:gap-2">
                    <div className="flex min-w-0 items-center gap-1 sm:gap-2">
                      <span className="dark:text-dark-text truncate text-sm font-semibold text-gray-900 sm:text-base">
                        {sender}
                      </span>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
                      <div className="dark:text-dark-text-muted flex items-center gap-1 text-[10px] text-gray-400 sm:text-xs">
                        <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        <span>{formatTime(email.date)}</span>
                      </div>
                      {/* Törlés gomb a küldő kártyában */}
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="dark:text-dark-text-muted touch-manipulation rounded-lg p-1.5 text-gray-400 transition-all duration-200 hover:bg-red-50 hover:text-red-600 sm:p-2 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                        aria-label="Törlés"
                        title="Törlés"
                      >
                        <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="dark:text-dark-text-secondary mt-0.5 truncate text-xs text-gray-500 sm:text-sm">
                    {email.from}
                  </div>

                  {/* Részletek toggle */}
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="dark:text-dark-text-muted dark:hover:text-dark-text-secondary mt-1.5 flex items-center gap-1 text-[10px] text-gray-400 transition-colors hover:text-gray-600 sm:mt-2 sm:text-xs"
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
                    <div className="dark:border-dark-border mt-2 space-y-1 border-t border-gray-100 pt-2 text-[10px] sm:mt-3 sm:space-y-1.5 sm:pt-3 sm:text-xs">
                      <div className="flex gap-2">
                        <span className="dark:text-dark-text-muted w-16 text-gray-400">Küldő:</span>
                        <span className="dark:text-dark-text-secondary text-gray-600">
                          {email.fromName ? `${email.fromName} <${email.from}>` : email.from}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className="dark:text-dark-text-muted w-16 text-gray-400">
                          Címzett:
                        </span>
                        <span className="dark:text-dark-text-secondary text-gray-600">
                          {email.to}
                        </span>
                      </div>
                      {email.cc && (
                        <div className="flex gap-2">
                          <span className="dark:text-dark-text-muted w-16 text-gray-400">
                            Másolat:
                          </span>
                          <span className="dark:text-dark-text-secondary text-gray-600">
                            {email.cc}
                          </span>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <span className="dark:text-dark-text-muted w-16 text-gray-400">Dátum:</span>
                        <span className="dark:text-dark-text-secondary text-gray-600">
                          {formatFullDate(email.date)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Separator between header and body */}
          <div className="my-1 flex items-center gap-3 px-2 sm:my-2">
            <div className="dark:via-dark-border h-px flex-1 bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
          </div>

          {/* AI Copilot Bar */}
          <div className="mb-2 sm:mb-3">
            <InlineCopilotBar
              emailId={email.id}
              emailSubject={email.subject}
              emailBody={email.body}
              emailSnippet={email.snippet}
              emailFrom={email.from}
            />
          </div>

          {/* Thread conversation nézet vagy egyedi email body */}
          {hasThread && showConversation ? (
            <div className="dark:bg-dark-bg/30 dark:border-dark-border rounded-xl border border-gray-100 bg-gray-50/50 p-2 sm:rounded-2xl sm:p-3">
              {/* Thread fejléc */}
              <div className="mb-2 flex items-center justify-between px-1 sm:mb-3 sm:px-2">
                <div className="dark:text-dark-text flex items-center gap-2 text-xs font-medium text-gray-700 sm:text-sm">
                  <MessageSquare className="h-4 w-4 text-blue-500" />
                  Beszélgetés ({threadEmails.length} üzenet)
                </div>
                <button
                  onClick={() => setShowConversation(false)}
                  className="dark:text-dark-text-secondary dark:hover:text-dark-text dark:hover:bg-dark-bg-tertiary rounded px-2 py-1 text-[10px] text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 sm:text-xs"
                >
                  Csak ez az email
                </button>
              </div>

              {isThreadLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                  <span className="dark:text-dark-text-secondary ml-2 text-sm text-gray-500">
                    Beszélgetés betöltése...
                  </span>
                </div>
              ) : (
                <ConversationView
                  emails={threadEmails}
                  accountEmail={threadAccountEmail}
                  onDelete={(threadEmailId: string) => {
                    deleteEmail.mutate({ emailId: threadEmailId, accountId });
                  }}
                  onReply={(threadEmail: ThreadEmail) => {
                    onReply({
                      to: threadEmail.from || '',
                      subject: `Re: ${threadEmail.subject || ''}`,
                      threadId: threadEmail.threadId || undefined,
                      body: threadEmail.body || threadEmail.snippet || '',
                      fromName: threadEmail.fromName || threadEmail.from || '',
                      date: threadEmail.date,
                    });
                  }}
                  onReplyAll={
                    onReplyAll
                      ? (threadEmail: ThreadEmail) => {
                          const allRecipients = [threadEmail.to, threadEmail.cc]
                            .filter(Boolean)
                            .join(', ');
                          onReplyAll!({
                            to: threadEmail.from || '',
                            cc: allRecipients || undefined,
                            subject: `Re: ${threadEmail.subject || ''}`,
                            threadId: threadEmail.threadId || undefined,
                            body: threadEmail.body || threadEmail.snippet || '',
                            fromName: threadEmail.fromName || threadEmail.from || '',
                            date: threadEmail.date,
                          });
                        }
                      : undefined
                  }
                  onForward={
                    onForward
                      ? (threadEmail: ThreadEmail) => {
                          onForward!({
                            subject: `Fwd: ${threadEmail.subject || ''}`,
                            body: `\n\n---------- Továbbított üzenet ----------\nKüldő: ${threadEmail.fromName || ''} <${threadEmail.from || ''}>\nDátum: ${formatFullDate(threadEmail.date)}\nTárgy: ${threadEmail.subject || ''}\nCímzett: ${threadEmail.to || ''}\n\n${threadEmail.body || ''}`,
                          });
                        }
                      : undefined
                  }
                />
              )}
            </div>
          ) : (
            <>
              {/* Single email view toggle - ha van thread, de az egyedi nézet van kiválasztva */}
              {hasThread && !showConversation && (
                <button
                  onClick={() => setShowConversation(true)}
                  className="mb-2 flex w-full items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 sm:mb-3 sm:text-sm dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20"
                >
                  <MessageSquare className="h-4 w-4" />
                  Teljes beszélgetés mutatása ({threadEmails.length} üzenet)
                </button>
              )}

              {/* Email body kártya */}
              <div className="dark:bg-dark-bg-secondary dark:border-dark-border overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm sm:rounded-2xl">
                {/* Translation banner */}
                {translatedContent && (
                  <div className="flex items-center justify-between border-b border-blue-100 bg-blue-50 px-3 py-2 sm:px-5 dark:border-blue-500/20 dark:bg-blue-500/10">
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
                      className="rounded p-1 text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-500/20"
                      title="Eredeti mutatása"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <div className="p-3 sm:p-5 md:p-6">
                  {translatedContent?.body ? (
                    <pre className="dark:text-dark-text-secondary font-sans text-xs leading-relaxed whitespace-pre-wrap text-gray-700 sm:text-sm">
                      {translatedContent.body}
                    </pre>
                  ) : sanitizedHtml ? (
                    <div
                      className="email-content prose prose-sm prose-headings:text-gray-900 dark:prose-headings:text-gray-200 prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-strong:text-gray-900 dark:prose-strong:text-gray-200 prose-blockquote:text-gray-600 dark:prose-blockquote:text-gray-400 prose-blockquote:border-gray-300 dark:prose-blockquote:border-gray-600 prose-code:text-gray-800 dark:prose-code:text-gray-300 prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800 prose-hr:border-gray-200 dark:prose-hr:border-gray-700 prose-img:rounded-lg prose-img:shadow-md max-w-none text-gray-900 dark:text-gray-300"
                      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                    />
                  ) : email.body ? (
                    <pre className="dark:text-dark-text-secondary font-sans text-xs leading-relaxed whitespace-pre-wrap text-gray-700 sm:text-sm">
                      {email.body}
                    </pre>
                  ) : (
                    <p className="dark:text-dark-text-muted py-4 text-center text-sm text-gray-400 italic sm:py-8">
                      Nincs megjeleníthető tartalom
                    </p>
                  )}
                </div>

                {/* Mellékletek */}
                {email.attachments && email.attachments.length > 0 && (
                  <div className="dark:border-dark-border dark:bg-dark-bg-tertiary/50 border-t border-gray-100 bg-gray-50 p-2.5 sm:p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-blue-100 p-1.5 dark:bg-blue-500/20">
                          <Paperclip className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <span className="dark:text-dark-text text-sm font-medium text-gray-700">
                          {email.attachments.length} melléklet
                        </span>
                      </div>
                      {email.attachments.length > 1 && (
                        <button
                          onClick={() => {
                            // Clear any existing timeouts first
                            downloadTimeoutsRef.current.forEach(clearTimeout);
                            downloadTimeoutsRef.current = [];
                            // Download all attachments one by one
                            email.attachments?.forEach((att, index) => {
                              const timeoutId = setTimeout(() => {
                                const url = api.attachments.downloadUrl(att.id);
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = att.filename;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }, index * 500); // Stagger downloads to avoid browser blocking
                              downloadTimeoutsRef.current.push(timeoutId);
                            });
                          }}
                          className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Összes letöltése
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {email.attachments.map((att) => (
                        <AttachmentView key={att.id} attachment={att} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Quick Reply */}
          <div className="mt-3">
            {showQuickReply ? (
              <div className="dark:bg-dark-bg-secondary dark:border-dark-border overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm sm:rounded-2xl">
                <div className="p-3 sm:p-4">
                  <textarea
                    value={quickReplyText}
                    onChange={(e) => setQuickReplyText(e.target.value)}
                    placeholder="Válasz írása..."
                    rows={4}
                    autoFocus
                    className="dark:bg-dark-bg-tertiary dark:border-dark-border dark:text-dark-text dark:placeholder:text-dark-text-muted w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 transition-colors outline-none placeholder:text-gray-400 focus:border-[#4f6ef7]/50 focus:ring-2 focus:ring-[#4f6ef7]/20"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        handleQuickReply();
                      }
                    }}
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <span className="dark:text-dark-text-muted text-xs text-gray-400">
                      Ctrl+Enter a küldéshez
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setShowQuickReply(false);
                          setQuickReplyText('');
                        }}
                        className="dark:text-dark-text-secondary dark:hover:bg-dark-bg-tertiary rounded-lg px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100"
                      >
                        Mégse
                      </button>
                      <button
                        onClick={handleQuickReply}
                        disabled={!quickReplyText.trim() || sendingQuickReply}
                        className="flex items-center gap-1.5 rounded-lg bg-[#4f6ef7] px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#3d5ce5] disabled:opacity-50"
                      >
                        <Send className="h-3.5 w-3.5" />
                        {sendingQuickReply ? 'Küldés...' : 'Küldés'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowQuickReply(true)}
                className="dark:bg-dark-bg-secondary dark:border-dark-border dark:text-dark-text-muted dark:hover:text-dark-text-secondary dark:hover:border-dark-border flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm text-gray-400 shadow-sm transition-all hover:border-gray-200 hover:text-gray-600 sm:rounded-2xl"
              >
                <Reply className="h-4 w-4" />
                <span>Kattints a gyors válaszhoz...</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
