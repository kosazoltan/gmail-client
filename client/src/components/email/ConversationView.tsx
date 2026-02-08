import { useState, useMemo, useRef, useEffect } from 'react';
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
  Loader2,
  Download,
} from 'lucide-react';
import {
  formatFullDate,
  displaySender,
  getInitials,
  emailToColor,
  cn,
} from '../../lib/utils';
import { AttachmentView } from './AttachmentView';
import { api } from '../../lib/api';
import type { ThreadEmail } from '../../types';

interface ConversationViewProps {
  emails: ThreadEmail[];
  accountEmail: string | null;
  onReply: (email: ThreadEmail) => void;
  onReplyAll?: (email: ThreadEmail) => void;
  onForward?: (email: ThreadEmail) => void;
}

// Egyetlen üzenet buborék a beszélgetésben
function MessageBubble({
  email,
  isSent,
  accountEmail,
  isExpanded,
  onToggleExpand,
  onReply,
  onReplyAll,
  onForward,
  isLatest,
}: {
  email: ThreadEmail;
  isSent: boolean;
  accountEmail: string | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onReply: () => void;
  onReplyAll?: () => void;
  onForward?: () => void;
  isLatest: boolean;
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

  const sanitizedHtml = useMemo(() => {
    if (!email.bodyHtml) return '';
    return DOMPurify.sanitize(email.bodyHtml, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'strike', 'sub', 'sup', 'small', 'big',
        'a', 'img',
        'ul', 'ol', 'li', 'dl', 'dt', 'dd',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'blockquote', 'pre', 'code', 'div', 'span', 'hr', 'address', 'center',
        'table', 'caption', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'colgroup', 'col',
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
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    });
  }, [email.bodyHtml]);

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
    <div
      className={cn(
        'flex gap-2 sm:gap-3',
        isSent ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-white text-[10px] sm:text-xs font-medium mt-1',
          isSent && 'ring-2 ring-blue-400 dark:ring-blue-500',
        )}
        style={{ backgroundColor: isSent ? '#4f6ef7' : avatarColor }}
      >
        {isSent ? (
          <Send className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
        ) : (
          initials
        )}
      </div>

      {/* Üzenet buborék */}
      <div
        className={cn(
          'flex-1 max-w-[85%] sm:max-w-[80%] rounded-2xl overflow-hidden border transition-shadow',
          isSent
            ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30'
            : 'bg-white dark:bg-dark-bg-secondary border-gray-100 dark:border-dark-border',
          isExpanded && 'shadow-md',
        )}
      >
        {/* Fejléc - mindig látszik */}
        <button
          onClick={onToggleExpand}
          className={cn(
            'w-full text-left px-3 sm:px-4 py-2 sm:py-2.5 flex items-center gap-2 transition-colors',
            isExpanded
              ? 'border-b border-gray-100 dark:border-dark-border'
              : 'hover:bg-gray-50/50 dark:hover:bg-dark-bg-tertiary/30',
          )}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span
                className={cn(
                  'text-xs sm:text-sm font-medium truncate',
                  isSent ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-dark-text',
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
                <Paperclip className="h-3 w-3 text-gray-400 dark:text-dark-text-muted flex-shrink-0" />
              )}
            </div>
            {!isExpanded && (
              <div className="text-[10px] sm:text-xs text-gray-400 dark:text-dark-text-muted truncate mt-0.5">
                {email.snippet || ''}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
            <span className="text-[9px] sm:text-[11px] text-gray-400 dark:text-dark-text-muted">
              {formatTime(email.date)}
            </span>
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5 text-gray-400 dark:text-dark-text-muted" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-gray-400 dark:text-dark-text-muted" />
            )}
          </div>
        </button>

        {/* Kibontott tartalom */}
        {isExpanded && (
          <div>
            {/* Címzett infó */}
            <div className="px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs text-gray-500 dark:text-dark-text-secondary border-b border-gray-50 dark:border-dark-border/50">
              <div className="flex items-center gap-1">
                <span className="text-gray-400 dark:text-dark-text-muted">Címzett:</span>
                <span className="truncate">{email.to || 'Ismeretlen'}</span>
              </div>
              {email.cc && (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-gray-400 dark:text-dark-text-muted">Másolat:</span>
                  <span className="truncate">{email.cc}</span>
                </div>
              )}
            </div>

            {/* Email body */}
            <div className="px-3 sm:px-4 py-2.5 sm:py-3">
              {sanitizedHtml ? (
                <div
                  className="email-content prose prose-sm max-w-none text-gray-900 dark:text-gray-300 prose-img:rounded-lg prose-img:shadow-md"
                  dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                />
              ) : email.body ? (
                <pre className="whitespace-pre-wrap text-xs sm:text-sm text-gray-700 dark:text-dark-text-secondary font-sans leading-relaxed">
                  {email.body}
                </pre>
              ) : (
                <p className="text-gray-400 dark:text-dark-text-muted italic text-center py-4 text-xs sm:text-sm">
                  Nincs megjeleníthető tartalom
                </p>
              )}
            </div>

            {/* Mellékletek */}
            {email.attachments && email.attachments.length > 0 && (
              <div className="border-t border-gray-100 dark:border-dark-border bg-gray-50/50 dark:bg-dark-bg-tertiary/30 px-3 sm:px-4 py-2 sm:py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-xs font-medium text-gray-600 dark:text-dark-text-secondary">
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
                      className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
                    >
                      <Download className="h-3 w-3" />
                      Összes
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {email.attachments.map((att) => (
                    <AttachmentView key={att.id} attachment={att} />
                  ))}
                </div>
              </div>
            )}

            {/* Gyors akciók */}
            <div className="flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 border-t border-gray-100 dark:border-dark-border">
              <button
                onClick={(e) => { e.stopPropagation(); onReply(); }}
                className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium text-gray-600 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary rounded-lg transition-colors"
              >
                <Reply className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                <span className="hidden sm:inline">Válasz</span>
              </button>
              {onReplyAll && (
                <button
                  onClick={(e) => { e.stopPropagation(); onReplyAll(); }}
                  className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium text-gray-600 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary rounded-lg transition-colors"
                >
                  <ReplyAll className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  <span className="hidden sm:inline">Válasz mind</span>
                </button>
              )}
              {onForward && (
                <button
                  onClick={(e) => { e.stopPropagation(); onForward(); }}
                  className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium text-gray-600 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary rounded-lg transition-colors"
                >
                  <Forward className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  <span className="hidden sm:inline">Továbbítás</span>
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
  onReply,
  onReplyAll,
  onForward,
}: ConversationViewProps) {
  // Az utolsó email alapból kibontva, a többi összecsukva
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    if (emails.length === 0) return new Set();
    // Utolsó email kibontva
    return new Set([emails[emails.length - 1].id]);
  });
  const scrollEndRef = useRef<HTMLDivElement>(null);

  // Ha változik az email lista (új email érkezik), bővítsük a kibontottakat
  useEffect(() => {
    if (emails.length > 0) {
      const latestId = emails[emails.length - 1].id;
      setExpandedIds((prev) => {
        if (prev.has(latestId)) return prev;
        const newSet = new Set(prev);
        newSet.add(latestId);
        return newSet;
      });
    }
  }, [emails]);

  // Scroll az aljára ha új email érkezik
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [emails.length]);

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
    setExpandedIds(new Set(emails.map(e => e.id)));
  };

  const collapseAll = () => {
    // Mindig hagyjuk az utolsót kibontva
    if (emails.length > 0) {
      setExpandedIds(new Set([emails[emails.length - 1].id]));
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
  const sentCount = emails.filter(isSentEmail).length;
  const receivedCount = emails.length - sentCount;
  const unreadCount = emails.filter(e => !e.isRead && !isSentEmail(e)).length;

  return (
    <div className="flex flex-col gap-1 sm:gap-2">
      {/* Thread statisztika sáv */}
      {emails.length > 1 && (
        <div className="flex items-center justify-between px-1 sm:px-2 mb-1">
          <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-gray-500 dark:text-dark-text-secondary">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {emails.length} üzenet
            </span>
            {sentCount > 0 && (
              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                <Send className="h-3 w-3" />
                {sentCount} küldött
              </span>
            )}
            {receivedCount > 0 && (
              <span>{receivedCount} beérkezett</span>
            )}
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full font-medium">
                {unreadCount} olvasatlan
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={expandAll}
              className="px-2 py-1 text-[10px] sm:text-xs text-gray-500 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary rounded transition-colors"
            >
              Összes kibontása
            </button>
            <button
              onClick={collapseAll}
              className="px-2 py-1 text-[10px] sm:text-xs text-gray-500 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary rounded transition-colors"
            >
              Összecsukás
            </button>
          </div>
        </div>
      )}

      {/* Üzenetek listája */}
      {emails.map((email, index) => (
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
          isLatest={index === emails.length - 1}
        />
      ))}

      {/* Scroll anchor */}
      <div ref={scrollEndRef} />
    </div>
  );
}
