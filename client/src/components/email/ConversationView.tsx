import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import DOMPurify from 'dompurify';
import {
  ChevronDown,
  ChevronUp,
  Reply,
  ReplyAll,
  Forward,
  Check,
  CheckCheck,
  Clock,
  Paperclip,
  Send,
  Download,
  Trash2,
} from 'lucide-react';
import { displaySender, getInitials, emailToColor, cn } from '../../lib/utils';
import { AttachmentView } from './AttachmentView';
import { api } from '../../lib/api';
import type { ThreadEmail } from '../../types';
import { trySplitLegacyAiDigestBodyHtml } from '../../lib/legacyDigestEmail';
import { isGoogleCalendarNotificationFrom } from '../../lib/googleCalendarNotification';

interface ConversationViewProps {
  emails: ThreadEmail[];
  accountEmail: string | null;
  /** A listából megnyitott üzenet ID-ja — ez is kibontva jelenik meg, ne csak a legutolsó. */
  focusEmailId?: string;
  onReply: (email: ThreadEmail) => void;
  onReplyAll?: (email: ThreadEmail) => void;
  onForward?: (email: ThreadEmail) => void;
  onDelete?: (emailId: string) => void;
}

// Egyetlen üzenet buborék a beszélgetésben
function MessageBubble({
  email,
  isSent,
  accountEmail: _accountEmail,
  isExpanded,
  onToggleExpand,
  onReply,
  onReplyAll,
  onForward,
  onDelete,
}: {
  email: ThreadEmail;
  isSent: boolean;
  accountEmail: string | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onReply: () => void;
  onReplyAll?: () => void;
  onForward?: () => void;
  onDelete?: () => void;
}) {
  const downloadTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const sender = displaySender(email.fromName, email.from);
  const initials = getInitials(sender);
  const avatarColor = emailToColor(email.from || '');

  useEffect(() => {
    return () => {
      downloadTimeoutsRef.current.forEach(clearTimeout);
      downloadTimeoutsRef.current = [];
    };
  }, []);

  // Plain text → HTML konverzió (linkek + sortörések)
  const plainTextToHtml = useCallback((text: string): string => {
    let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html = html.replace(
      /(https?:\/\/[^\s<>"')\]]+)/gi,
      '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 break-all">$1</a>',
    );
    html = html.replace(
      /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
      '<a href="mailto:$1" class="text-blue-600 dark:text-blue-400 underline">$1</a>',
    );
    html = html.replace(/\n/g, '<br>');
    return html;
  }, []);

  const legacyAiDigest = useMemo(
    () => trySplitLegacyAiDigestBodyHtml(email.bodyHtml),
    [email.bodyHtml],
  );

  const sanitizedHtml = useMemo(() => {
    const htmlSource = legacyAiDigest?.restHtml ?? email.bodyHtml;
    if (htmlSource) {
      return DOMPurify.sanitize(htmlSource, {
        ALLOWED_TAGS: [
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
          'a',
          'img',
          'ul',
          'ol',
          'li',
          'dl',
          'dt',
          'dd',
          'h1',
          'h2',
          'h3',
          'h4',
          'h5',
          'h6',
          'blockquote',
          'pre',
          'code',
          'div',
          'span',
          'hr',
          'address',
          'center',
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
        ALLOWED_URI_REGEXP:
          /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
      });
    }
    if (email.body) {
      return DOMPurify.sanitize(plainTextToHtml(email.body), {
        ALLOWED_TAGS: ['br', 'a', 'p', 'span'],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
        ADD_ATTR: ['target'],
      });
    }
    return '';
  }, [email.bodyHtml, email.body, legacyAiDigest, plainTextToHtml]);

  const sanitizedLegacyDigestPlain = useMemo(() => {
    if (!legacyAiDigest?.plain) return '';
    return DOMPurify.sanitize(plainTextToHtml(legacyAiDigest.plain), {
      ALLOWED_TAGS: ['br', 'a', 'p', 'span'],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
      ADD_ATTR: ['target'],
    });
  }, [legacyAiDigest, plainTextToHtml]);

  const googleCalendarBodyClass = isGoogleCalendarNotificationFrom(email.from)
    ? 'email-content--google-calendar'
    : '';

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('hu-HU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={cn('flex gap-2 sm:gap-3', isSent ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div
        className={cn(
          'mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-white sm:h-9 sm:w-9 sm:text-xs',
          isSent && 'ring-2 ring-blue-400 dark:ring-blue-500',
        )}
        style={{ backgroundColor: isSent ? '#4f6ef7' : avatarColor }}
      >
        {isSent ? <Send className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> : initials}
      </div>

      {/* Üzenet buborék */}
      <div
        className={cn(
          'max-w-[85%] flex-1 overflow-hidden rounded-2xl border transition-shadow sm:max-w-[80%]',
          isSent
            ? 'border-blue-200 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10'
            : 'dark:bg-dark-bg-secondary dark:border-dark-border border-gray-100 bg-white',
          isExpanded && 'shadow-md',
        )}
      >
        {/* Fejléc - mindig látszik */}
        <button
          onClick={onToggleExpand}
          className={cn(
            'flex w-full items-center gap-2 px-3 py-2 text-left transition-colors sm:px-4 sm:py-2.5',
            isExpanded
              ? 'dark:border-dark-border border-b border-gray-100'
              : 'dark:hover:bg-dark-bg-tertiary/30 hover:bg-gray-50/50',
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span
                className={cn(
                  'truncate text-xs font-medium break-words sm:text-sm',
                  isSent ? 'text-blue-700 dark:text-blue-300' : 'dark:text-dark-text text-gray-900',
                )}
              >
                {isSent ? 'Én' : sender}
              </span>
              {isSent && (
                <span className="flex items-center text-blue-500 dark:text-blue-400">
                  {email.isRead ? (
                    <CheckCheck className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  ) : (
                    <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  )}
                </span>
              )}
              {email.hasAttachments && (
                <Paperclip className="dark:text-dark-text-muted h-3 w-3 flex-shrink-0 text-gray-400" />
              )}
            </div>
            {!isExpanded && (
              <div className="dark:text-dark-text-muted mt-0.5 truncate text-[10px] break-words text-gray-400 sm:text-xs">
                {email.snippet || ''}
              </div>
            )}
          </div>

          <div className="flex flex-shrink-0 items-center gap-1 sm:gap-1.5">
            <span className="dark:text-dark-text-muted text-[9px] text-gray-400 sm:text-[11px]">
              {formatTime(email.date)}
            </span>
            {isExpanded ? (
              <ChevronUp className="dark:text-dark-text-muted h-3.5 w-3.5 text-gray-400" />
            ) : (
              <ChevronDown className="dark:text-dark-text-muted h-3.5 w-3.5 text-gray-400" />
            )}
          </div>
        </button>

        {/* Kibontott tartalom */}
        {isExpanded && (
          <div>
            {/* Címzett infó */}
            <div className="dark:text-dark-text-secondary dark:border-dark-border/50 border-b border-gray-50 px-3 py-1.5 text-[10px] text-gray-500 sm:px-4 sm:py-2 sm:text-xs">
              <div className="flex items-center gap-1">
                <span className="dark:text-dark-text-muted text-gray-400">Címzett:</span>
                <span className="truncate break-words">{email.to || 'Ismeretlen'}</span>
              </div>
              {email.cc && (
                <div className="mt-0.5 flex items-center gap-1">
                  <span className="dark:text-dark-text-muted text-gray-400">Másolat:</span>
                  <span className="truncate break-words">{email.cc}</span>
                </div>
              )}
            </div>

            {/* Email body */}
            <div className="px-3 py-2.5 sm:px-4 sm:py-3">
              {legacyAiDigest && (sanitizedLegacyDigestPlain || sanitizedHtml) ? (
                <>
                  {sanitizedLegacyDigestPlain ? (
                    <div
                      className={cn(
                        'email-content dark:border-dark-border mb-4 max-w-none min-w-0 overflow-x-auto border-b border-gray-100 pb-4 text-gray-900 dark:text-gray-200',
                        googleCalendarBodyClass,
                      )}
                      dangerouslySetInnerHTML={{ __html: sanitizedLegacyDigestPlain }}
                    />
                  ) : null}
                  {sanitizedHtml ? (
                    <div
                      className={cn(
                        'email-content max-w-none min-w-0 overflow-x-auto text-gray-900 dark:text-gray-200',
                        googleCalendarBodyClass,
                      )}
                      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                    />
                  ) : null}
                </>
              ) : sanitizedHtml ? (
                <div
                  className={cn(
                    'email-content max-w-none min-w-0 overflow-x-auto text-gray-900 dark:text-gray-200',
                    googleCalendarBodyClass,
                  )}
                  dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                />
              ) : (
                <p className="dark:text-dark-text-muted py-4 text-center text-xs text-gray-400 italic sm:text-sm">
                  Nincs megjeleníthető tartalom
                </p>
              )}
            </div>

            {/* Mellékletek */}
            {email.attachments && email.attachments.length > 0 && (
              <div className="dark:border-dark-border dark:bg-dark-bg-tertiary/30 border-t border-gray-100 bg-gray-50/50 px-3 py-2 sm:px-4 sm:py-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5 text-gray-400" />
                    <span className="dark:text-dark-text-secondary text-xs font-medium text-gray-600">
                      {email.attachments.length} melléklet
                    </span>
                  </div>
                  {email.attachments.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadTimeoutsRef.current.forEach(clearTimeout);
                        downloadTimeoutsRef.current = [];
                        email.attachments?.forEach((att, index) => {
                          const timeoutId = setTimeout(() => {
                            const url = api.attachments.downloadUrl(att.id);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = att.filename;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }, index * 500);
                          downloadTimeoutsRef.current.push(timeoutId);
                        });
                      }}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
                    >
                      <Download className="h-3 w-3" />
                      Összes
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {email.attachments.map((att) => (
                    <AttachmentView key={att.id} attachment={att} />
                  ))}
                </div>
              </div>
            )}

            {/* Gyors akciók */}
            <div className="dark:border-dark-border flex items-center gap-1 border-t border-gray-100 px-2 py-1.5 sm:px-3 sm:py-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReply();
                }}
                className="dark:text-dark-text-secondary dark:hover:bg-dark-bg-tertiary flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-gray-600 transition-colors hover:bg-gray-100 sm:px-3 sm:py-1.5 sm:text-xs"
              >
                <Reply className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                <span className="hidden sm:inline">Válasz</span>
              </button>
              {onReplyAll && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onReplyAll();
                  }}
                  className="dark:text-dark-text-secondary dark:hover:bg-dark-bg-tertiary flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-gray-600 transition-colors hover:bg-gray-100 sm:px-3 sm:py-1.5 sm:text-xs"
                >
                  <ReplyAll className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  <span className="hidden sm:inline">Válasz mind</span>
                </button>
              )}
              {onForward && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onForward();
                  }}
                  className="dark:text-dark-text-secondary dark:hover:bg-dark-bg-tertiary flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-gray-600 transition-colors hover:bg-gray-100 sm:px-3 sm:py-1.5 sm:text-xs"
                >
                  <Forward className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  <span className="hidden sm:inline">Továbbítás</span>
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-red-500 transition-colors hover:bg-red-50 sm:px-3 sm:py-1.5 sm:text-xs dark:text-red-400 dark:hover:bg-red-500/10"
                >
                  <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  <span className="hidden sm:inline">Törlés</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ConversationView({
  emails,
  accountEmail,
  focusEmailId,
  onReply,
  onReplyAll,
  onForward,
  onDelete,
}: ConversationViewProps) {
  const memoEmails = useMemo(() => emails ?? [], [emails]);

  // Az utolsó email + a megnyitott üzenet alapból kibontva, a többi összecsukva
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    if (memoEmails.length === 0) return new Set();
    const initial = new Set([memoEmails[memoEmails.length - 1].id]);
    if (focusEmailId) initial.add(focusEmailId);
    return initial;
  });
  const scrollEndRef = useRef<HTMLDivElement>(null);

  // Ha változik az email lista (új email érkezik) vagy a megnyitott üzenet,
  // bővítsük a kibontottakat
  useEffect(() => {
    if (memoEmails.length === 0) return;
    const latestId = memoEmails[memoEmails.length - 1].id;
    const focusId =
      focusEmailId && memoEmails.some((e) => e.id === focusEmailId) ? focusEmailId : null;

    queueMicrotask(() => {
      setExpandedIds((prev) => {
        if (prev.has(latestId) && (!focusId || prev.has(focusId))) return prev;
        const newSet = new Set(prev);
        newSet.add(latestId);
        if (focusId) newSet.add(focusId);
        return newSet;
      });
    });
  }, [memoEmails, focusEmailId]);

  // Scroll az aljára ha új email érkezik
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [memoEmails.length]);

  const toggleExpand = (emailId: string) => {
    setExpandedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(emailId)) {
        newSet.delete(emailId);
      } else {
        newSet.add(emailId);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(memoEmails.map((e) => e.id)));
  };

  const collapseAll = () => {
    // Mindig hagyjuk az utolsót kibontva
    if (memoEmails.length > 0) {
      setExpandedIds(new Set([memoEmails[memoEmails.length - 1].id]));
    } else {
      setExpandedIds(new Set());
    }
  };

  // Meghatározzuk melyik email küldött (sent)
  const isSentEmail = (email: ThreadEmail): boolean => {
    if (email.isSent) return true;
    if (email.labels?.includes('SENT')) return true;
    // Fallback: ha a küldő a saját accountunk
    if (accountEmail && email.from) {
      return email.from.toLowerCase() === accountEmail.toLowerCase();
    }
    return false;
  };

  // Statisztikák
  const sentCount = memoEmails.filter(isSentEmail).length;
  const receivedCount = memoEmails.length - sentCount;
  const unreadCount = memoEmails.filter((e) => !e.isRead && !isSentEmail(e)).length;

  return (
    <div className="flex flex-col gap-1 sm:gap-2">
      {/* Thread statisztika sáv */}
      {memoEmails.length > 1 && (
        <div className="mb-1 flex items-center justify-between px-1 sm:px-2">
          <div className="dark:text-dark-text-secondary flex items-center gap-2 text-[10px] text-gray-500 sm:gap-3 sm:text-xs">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {memoEmails.length} üzenet
            </span>
            {sentCount > 0 && (
              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                <Send className="h-3 w-3" />
                {sentCount} küldött
              </span>
            )}
            {receivedCount > 0 && <span>{receivedCount} beérkezett</span>}
            {unreadCount > 0 && (
              <span className="rounded-full bg-blue-100 px-1.5 py-0.5 font-medium text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                {unreadCount} olvasatlan
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={expandAll}
              className="dark:text-dark-text-secondary dark:hover:bg-dark-bg-tertiary rounded px-2 py-1 text-[10px] text-gray-500 transition-colors hover:bg-gray-100 sm:text-xs"
            >
              Összes kibontása
            </button>
            <button
              onClick={collapseAll}
              className="dark:text-dark-text-secondary dark:hover:bg-dark-bg-tertiary rounded px-2 py-1 text-[10px] text-gray-500 transition-colors hover:bg-gray-100 sm:text-xs"
            >
              Összecsukás
            </button>
          </div>
        </div>
      )}

      {/* Üzenetek listája */}
      {memoEmails.map((email, _index) => (
        <MessageBubble
          key={email.id}
          email={email}
          isSent={isSentEmail(email)}
          accountEmail={accountEmail}
          isExpanded={expandedIds.has(email.id)}
          onToggleExpand={() => toggleExpand(email.id)}
          onReply={() => onReply(email)}
          onReplyAll={onReplyAll ? () => onReplyAll(email) : undefined}
          onForward={onForward ? () => onForward(email) : undefined}
          onDelete={onDelete ? () => onDelete(email.id) : undefined}
        />
      ))}

      {/* Scroll anchor */}
      <div ref={scrollEndRef} />
    </div>
  );
}
