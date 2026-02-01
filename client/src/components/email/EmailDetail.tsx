import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
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
  Mail,
  ChevronDown,
  ChevronUp,
  Calendar,
  User,
  Users,
  Tag,
} from 'lucide-react';
import { SnoozeMenu } from './SnoozeMenu';
import { ReminderMenu } from './ReminderMenu';
import { LabelManager } from './LabelManager';

interface EmailDetailProps {
  emailId: string | null;
  accountId?: string;
  onBack: () => void;
  onReply: (email: { to: string; subject: string; threadId?: string; cc?: string }) => void;
  onForward?: (email: { subject: string; body: string }) => void;
  onDeleteSuccess?: () => void;
}

// Iframe-ben megjelenített HTML email komponens
function EmailHtmlFrame({ html, isDark }: { html: string; isDark: boolean }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(400);

  // Szanitizált HTML wrapper stílusokkal
  const wrappedHtml = useMemo(() => {
    // A HTML-t megtisztítjuk de több tag-et engedélyezünk a jobb megjelenítéshez
    const cleanHtml = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'html', 'head', 'body', 'style',
        'div', 'span', 'p', 'br', 'hr',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'strong', 'b', 'em', 'i', 'u', 's', 'strike',
        'a', 'img',
        'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
        'ul', 'ol', 'li', 'dl', 'dt', 'dd',
        'blockquote', 'pre', 'code',
        'center', 'font', 'small', 'big', 'sup', 'sub',
      ],
      ALLOWED_ATTR: [
        'href', 'src', 'alt', 'title', 'width', 'height',
        'style', 'class', 'id', 'name',
        'border', 'cellpadding', 'cellspacing', 'align', 'valign',
        'bgcolor', 'color', 'face', 'size',
        'colspan', 'rowspan',
        'target', 'rel',
      ],
      ALLOW_DATA_ATTR: false,
      ADD_ATTR: ['target'],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select'],
    });

    // Dark mode stílusok
    const darkModeStyles = isDark ? `
      body {
        background-color: #1a1a2e !important;
        color: #e0e0e0 !important;
      }
      a { color: #60a5fa !important; }
      table { border-color: #374151 !important; }
      td, th { border-color: #374151 !important; }
      hr { border-color: #374151 !important; }
      blockquote { border-color: #3b82f6 !important; background-color: rgba(59, 130, 246, 0.1) !important; }
    ` : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          * {
            box-sizing: border-box;
          }
          html, body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            font-size: 15px;
            line-height: 1.6;
            color: #1f2937;
            background-color: transparent;
            overflow-x: hidden;
            word-wrap: break-word;
            overflow-wrap: break-word;
          }
          body {
            padding: 4px;
          }
          img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
          }
          a {
            color: #2563eb;
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
          table {
            border-collapse: collapse;
            max-width: 100%;
          }
          td, th {
            padding: 8px 12px;
          }
          blockquote {
            margin: 16px 0;
            padding: 12px 16px;
            border-left: 4px solid #3b82f6;
            background-color: #eff6ff;
            border-radius: 0 8px 8px 0;
          }
          pre {
            background-color: #1f2937;
            color: #e5e7eb;
            padding: 16px;
            border-radius: 12px;
            overflow-x: auto;
            font-size: 14px;
          }
          code {
            font-family: 'Fira Code', 'Monaco', 'Consolas', monospace;
          }
          hr {
            border: none;
            border-top: 1px solid #e5e7eb;
            margin: 24px 0;
          }
          h1, h2, h3, h4, h5, h6 {
            margin-top: 24px;
            margin-bottom: 12px;
            font-weight: 600;
            line-height: 1.3;
          }
          h1 { font-size: 1.875rem; }
          h2 { font-size: 1.5rem; }
          h3 { font-size: 1.25rem; }
          p {
            margin: 0 0 16px 0;
          }
          ul, ol {
            padding-left: 24px;
            margin: 12px 0;
          }
          li {
            margin: 4px 0;
          }
          /* Email specifikus stílusok */
          .gmail_quote, .yahoo_quoted {
            border-left: 2px solid #d1d5db;
            padding-left: 12px;
            margin: 16px 0;
            color: #6b7280;
          }
          /* Gombok szép megjelenítése */
          a[style*="background"],
          a[style*="border-radius"],
          td[style*="background"] a {
            display: inline-block;
            padding: 12px 24px;
            border-radius: 12px;
            font-weight: 600;
            text-align: center;
            text-decoration: none !important;
          }
          ${darkModeStyles}
        </style>
      </head>
      <body>${cleanHtml}</body>
      </html>
    `;
  }, [html, isDark]);

  // Magasság automatikus állítása
  const updateHeight = useCallback(() => {
    const iframe = iframeRef.current;
    if (iframe?.contentDocument?.body) {
      const newHeight = Math.max(
        iframe.contentDocument.body.scrollHeight,
        iframe.contentDocument.documentElement.scrollHeight,
        200
      );
      setHeight(newHeight + 20);
    }
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      updateHeight();
      // Linkek új ablakban nyíljanak
      const links = iframe.contentDocument?.querySelectorAll('a');
      links?.forEach(link => {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
      });
    };

    iframe.addEventListener('load', handleLoad);

    // srcdoc változás esetén is frissítsük
    const timer = setTimeout(updateHeight, 100);

    return () => {
      iframe.removeEventListener('load', handleLoad);
      clearTimeout(timer);
    };
  }, [wrappedHtml, updateHeight]);

  // Window resize esetén is frissítsük
  useEffect(() => {
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [updateHeight]);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={wrappedHtml}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      className="w-full border-0"
      style={{
        height: `${height}px`,
        minHeight: '200px',
        backgroundColor: 'transparent',
      }}
      title="Email tartalom"
    />
  );
}

export function EmailDetail({
  emailId,
  accountId,
  onBack,
  onReply,
  onForward,
  onDeleteSuccess,
}: EmailDetailProps) {
  const { data: email, isLoading } = useEmailDetail(emailId, accountId);
  const markRead = useMarkRead();
  const deleteEmail = useDeleteEmail();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showLabelManager, setShowLabelManager] = useState(false);

  // Dark mode detektálás
  const isDark = document.documentElement.classList.contains('dark');

  // Automatikus olvasottnak jelölés - ref-fel elkerüljük a felesleges újrafutást
  const markReadRef = useRef(markRead);
  markReadRef.current = markRead;

  useEffect(() => {
    if (email && !email.isRead) {
      markReadRef.current.mutate({ emailId: email.id, isRead: true });
    }
  }, [email?.id, email?.isRead]);

  if (!emailId) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gradient-to-b from-gray-50 to-gray-100 dark:from-dark-bg dark:to-dark-bg-secondary">
        <div className="p-8 rounded-3xl bg-white/60 dark:bg-dark-bg-secondary/60 backdrop-blur-sm">
          <Mail className="h-20 w-20 mb-4 text-gray-300 dark:text-dark-text-muted mx-auto" />
          <p className="text-lg font-medium text-gray-500 dark:text-dark-text-secondary text-center">
            Válassz ki egy levelet
          </p>
          <p className="text-sm mt-1 text-gray-400 dark:text-dark-text-muted text-center">
            a megtekintéshez
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-gradient-to-b from-gray-50 to-gray-100 dark:from-dark-bg dark:to-dark-bg-secondary">
        <div className="flex flex-col items-center gap-4 p-8 rounded-3xl bg-white/60 dark:bg-dark-bg-secondary/60 backdrop-blur-sm">
          <div className="relative">
            <div className="absolute inset-0 bg-blue-400/20 rounded-full animate-ping" />
            <Loader2 className="h-10 w-10 animate-spin text-blue-500 relative" />
          </div>
          <span className="text-sm font-medium text-gray-500 dark:text-dark-text-secondary">
            Betöltés...
          </span>
        </div>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gradient-to-b from-gray-50 to-gray-100 dark:from-dark-bg dark:to-dark-bg-secondary">
        <div className="p-8 rounded-3xl bg-white/60 dark:bg-dark-bg-secondary/60 backdrop-blur-sm">
          <Mail className="h-20 w-20 mb-4 text-gray-300 dark:text-dark-text-muted mx-auto" />
          <p className="text-gray-500 dark:text-dark-text-secondary text-center">
            Email nem található
          </p>
        </div>
      </div>
    );
  }

  const sender = displaySender(email.fromName, email.from);
  const initials = getInitials(sender);
  const avatarColor = emailToColor(email.from || '');

  // Dátum formázás
  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isYesterday = new Date(now.getTime() - 86400000).toDateString() === date.toDateString();

    const time = date.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });

    if (isToday) {
      return `Ma, ${time}`;
    }
    if (isYesterday) {
      return `Tegnap, ${time}`;
    }
    return date.toLocaleDateString('hu-HU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-50 via-gray-50 to-slate-100 dark:from-dark-bg dark:via-dark-bg dark:to-dark-bg-secondary">
      {/* Sticky fejléc műveleti gombokkal */}
      <div className="sticky top-0 z-20 backdrop-blur-md bg-white/80 dark:bg-dark-bg-secondary/80 border-b border-gray-200/50 dark:border-dark-border/50">
        <div className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-3">
          {/* Vissza gomb - mobil */}
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary text-gray-600 dark:text-dark-text-secondary lg:hidden transition-all active:scale-95"
            aria-label="Vissza"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Műveleti gombok */}
          <div className="flex items-center gap-1">
            <button
              onClick={() =>
                onReply({
                  to: email.from || '',
                  subject: `Re: ${email.subject || ''}`,
                  threadId: email.threadId || undefined,
                })
              }
              className="p-2.5 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-500/10 text-gray-500 dark:text-dark-text-secondary hover:text-blue-600 dark:hover:text-blue-400 transition-all active:scale-95 touch-manipulation"
              aria-label="Válasz"
              title="Válasz"
            >
              <Reply className="h-5 w-5" />
            </button>

            <button
              onClick={() =>
                onForward?.({
                  subject: `Fwd: ${email.subject || ''}`,
                  body: `\n\n---------- Továbbított üzenet ----------\nKüldő: ${email.fromName || ''} <${email.from}>\nDátum: ${formatFullDate(email.date)}\nTárgy: ${email.subject}\nCímzett: ${email.to}\n\n${email.body || ''}`,
                })
              }
              className="p-2.5 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-500/10 text-gray-500 dark:text-dark-text-secondary hover:text-blue-600 dark:hover:text-blue-400 transition-all active:scale-95 touch-manipulation"
              aria-label="Továbbítás"
              title="Továbbítás"
            >
              <Forward className="h-5 w-5" />
            </button>

            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-500 dark:text-dark-text-secondary hover:text-red-600 dark:hover:text-red-400 transition-all active:scale-95 touch-manipulation"
              aria-label="Törlés"
              title="Törlés"
            >
              <Trash2 className="h-5 w-5" />
            </button>

            {/* Címkék gomb */}
            <div className="relative">
              <button
                onClick={() => setShowLabelManager(!showLabelManager)}
                className="p-2.5 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-500/10 text-gray-500 dark:text-dark-text-secondary hover:text-purple-600 dark:hover:text-purple-400 transition-all active:scale-95 touch-manipulation"
                aria-label="Címkék"
                title="Címkék kezelése"
              >
                <Tag className="h-5 w-5" />
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

            {/* További műveletek */}
            <div className="relative">
              <button
                onClick={() => setShowMoreActions(!showMoreActions)}
                className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary text-gray-500 dark:text-dark-text-secondary transition-all active:scale-95 touch-manipulation"
                aria-label="További műveletek"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>

              {showMoreActions && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowMoreActions(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-dark-bg-secondary rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-black/20 border border-gray-100 dark:border-dark-border py-2 z-50">
                    <div className="px-2">
                      <SnoozeMenu emailId={email.id} variant="menu-item" onClose={() => setShowMoreActions(false)} />
                    </div>
                    <div className="px-2">
                      <ReminderMenu emailId={email.id} variant="menu-item" onClose={() => setShowMoreActions(false)} />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Törlés megerősítő modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-bg-secondary rounded-3xl p-6 max-w-sm w-full shadow-2xl shadow-gray-400/20 dark:shadow-black/40 dark:border dark:border-dark-border animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-red-50 to-red-100 dark:from-red-500/20 dark:to-red-500/10 mb-4">
                <Trash2 className="h-8 w-8 text-red-500 dark:text-red-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-dark-text">
                Email törlése
              </h3>
              <p className="text-sm text-gray-500 dark:text-dark-text-secondary mt-1">
                A levél a kukába kerül
              </p>
            </div>
            {deleteError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30">
                <p className="text-sm text-red-600 dark:text-red-400 text-center">{deleteError}</p>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-3 text-sm font-medium rounded-2xl border border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary dark:text-dark-text transition-all active:scale-[0.98]"
              >
                Mégse
              </button>
              <button
                onClick={() => {
                  setDeleteError(null);
                  deleteEmail.mutate(email.id, {
                    onSuccess: () => {
                      setShowDeleteConfirm(false);
                      if (onDeleteSuccess) {
                        onDeleteSuccess();
                      } else {
                        onBack();
                      }
                    },
                    onError: (error) => {
                      console.error('Delete failed:', error);
                      setDeleteError('Nem sikerült törölni az emailt. Próbáld újra.');
                    },
                  });
                }}
                disabled={deleteEmail.isPending}
                className="flex-1 px-4 py-3 text-sm font-medium rounded-2xl bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 disabled:opacity-50 transition-all active:scale-[0.98] shadow-lg shadow-red-500/25"
              >
                {deleteEmail.isPending ? 'Törlés...' : 'Törlés'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email tartalom - scrollozható */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-3 py-4 sm:px-6 sm:py-6">
          {/* Tárgy kártya */}
          <div className="mb-4 sm:mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-dark-text leading-tight">
              {email.subject || '(Nincs tárgy)'}
            </h1>
          </div>

          {/* Küldő információs kártya */}
          <div className="bg-white dark:bg-dark-bg-secondary rounded-3xl shadow-lg shadow-gray-200/50 dark:shadow-black/20 border border-gray-100/80 dark:border-dark-border/50 mb-4 sm:mb-6 overflow-hidden">
            <div className="p-4 sm:p-5">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-white text-lg sm:text-xl font-bold shadow-lg"
                    style={{
                      background: `linear-gradient(135deg, ${avatarColor} 0%, ${avatarColor}dd 100%)`,
                      boxShadow: `0 8px 24px -4px ${avatarColor}40`,
                    }}
                  >
                    {initials}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-400 rounded-full border-2 border-white dark:border-dark-bg-secondary" />
                </div>

                {/* Küldő infó */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text truncate">
                        {sender}
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-dark-text-secondary truncate mt-0.5">
                        {email.from}
                      </p>
                    </div>
                    {/* Törlés gomb */}
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-all flex-shrink-0"
                      aria-label="Törlés"
                      title="Törlés"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Dátum */}
                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-dark-bg-tertiary text-xs font-medium text-gray-600 dark:text-dark-text-secondary">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{formatDateTime(email.date)}</span>
                    </div>
                  </div>

                  {/* Részletek toggle */}
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="flex items-center gap-1.5 mt-3 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                  >
                    {showDetails ? (
                      <>
                        <ChevronUp className="h-4 w-4" />
                        <span>Részletek elrejtése</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4" />
                        <span>Részletek mutatása</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Részletes infó */}
              {showDetails && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-dark-border/50">
                  <div className="grid gap-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-gray-100 dark:bg-dark-bg-tertiary">
                        <User className="h-4 w-4 text-gray-500 dark:text-dark-text-secondary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-400 dark:text-dark-text-muted uppercase tracking-wider">Küldő</p>
                        <p className="text-sm text-gray-700 dark:text-dark-text-secondary mt-0.5 break-all">
                          {email.fromName ? `${email.fromName} <${email.from}>` : email.from}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-gray-100 dark:bg-dark-bg-tertiary">
                        <Users className="h-4 w-4 text-gray-500 dark:text-dark-text-secondary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-400 dark:text-dark-text-muted uppercase tracking-wider">Címzett</p>
                        <p className="text-sm text-gray-700 dark:text-dark-text-secondary mt-0.5 break-all">{email.to}</p>
                      </div>
                    </div>
                    {email.cc && (
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-gray-100 dark:bg-dark-bg-tertiary">
                          <Users className="h-4 w-4 text-gray-500 dark:text-dark-text-secondary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-400 dark:text-dark-text-muted uppercase tracking-wider">Másolat</p>
                          <p className="text-sm text-gray-700 dark:text-dark-text-secondary mt-0.5 break-all">{email.cc}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-gray-100 dark:bg-dark-bg-tertiary">
                        <Calendar className="h-4 w-4 text-gray-500 dark:text-dark-text-secondary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-400 dark:text-dark-text-muted uppercase tracking-wider">Dátum</p>
                        <p className="text-sm text-gray-700 dark:text-dark-text-secondary mt-0.5">{formatFullDate(email.date)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Műveleti gombok - Válasz, Válasz mindenkinek, Továbbítás */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <button
              onClick={() =>
                onReply({
                  to: email.from || '',
                  subject: `Re: ${email.subject || ''}`,
                  threadId: email.threadId || undefined,
                })
              }
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-500/25 hover:shadow-lg transition-all active:scale-[0.98]"
            >
              <Reply className="h-4 w-4" />
              <span>Válasz</span>
            </button>
            {/* Válasz mindenkinek - csak ha van CC vagy több címzett */}
            {(email.cc || (email.to && email.to.includes(','))) && (
              <button
                onClick={() =>
                  onReply({
                    to: email.from || '',
                    subject: `Re: ${email.subject || ''}`,
                    threadId: email.threadId || undefined,
                    cc: [email.to, email.cc].filter(Boolean).join(', '),
                  })
                }
                className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-dark-bg-tertiary hover:bg-gray-50 dark:hover:bg-dark-bg text-gray-700 dark:text-dark-text border border-gray-200 dark:border-dark-border rounded-xl text-sm font-medium shadow-sm hover:shadow transition-all active:scale-[0.98]"
              >
                <ReplyAll className="h-4 w-4" />
                <span>Válasz mindenkinek</span>
              </button>
            )}
            <button
              onClick={() =>
                onForward?.({
                  subject: `Fwd: ${email.subject || ''}`,
                  body: `\n\n---------- Továbbított üzenet ----------\nKüldő: ${email.fromName || ''} <${email.from}>\nDátum: ${formatFullDate(email.date)}\nTárgy: ${email.subject}\nCímzett: ${email.to}\n\n${email.body || ''}`,
                })
              }
              className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-dark-bg-tertiary hover:bg-gray-50 dark:hover:bg-dark-bg text-gray-700 dark:text-dark-text border border-gray-200 dark:border-dark-border rounded-xl text-sm font-medium shadow-sm hover:shadow transition-all active:scale-[0.98]"
            >
              <Forward className="h-4 w-4" />
              <span>Továbbítás</span>
            </button>
          </div>

          {/* Mellékletek - AZ ÜZENET FÖLÖTT */}
          {email.attachments && email.attachments.length > 0 && (
            <div className="bg-white dark:bg-dark-bg-secondary rounded-2xl shadow-md shadow-gray-200/50 dark:shadow-black/20 border border-gray-100/80 dark:border-dark-border/50 p-4 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-md shadow-blue-500/25">
                  <Paperclip className="h-4 w-4 text-white" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-800 dark:text-dark-text">
                    {email.attachments.length} melléklet
                  </span>
                  <p className="text-xs text-gray-500 dark:text-dark-text-muted">
                    Kattints a letöltéshez
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {email.attachments.map((att) => (
                  <AttachmentView key={att.id} attachment={att} />
                ))}
              </div>
            </div>
          )}

          {/* Email body kártya */}
          <div className="bg-white dark:bg-dark-bg-secondary rounded-3xl shadow-lg shadow-gray-200/50 dark:shadow-black/20 border border-gray-100/80 dark:border-dark-border/50 overflow-hidden">
            <div className="p-4 sm:p-6">
              {email.bodyHtml ? (
                <EmailHtmlFrame html={email.bodyHtml} isDark={isDark} />
              ) : email.body ? (
                <pre className="whitespace-pre-wrap text-sm sm:text-base text-gray-700 dark:text-dark-text-secondary font-sans leading-relaxed">
                  {email.body}
                </pre>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-dark-text-muted">
                  <Mail className="h-12 w-12 mb-3 opacity-50" />
                  <p className="italic">Nincs megjeleníthető tartalom</p>
                </div>
              )}
            </div>
          </div>

          {/* Alsó válasz gombok */}
          <div className="flex items-center justify-center gap-3 mt-6 pb-6">
            <button
              onClick={() =>
                onReply({
                  to: email.from || '',
                  subject: `Re: ${email.subject || ''}`,
                  threadId: email.threadId || undefined,
                })
              }
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-500/25 hover:shadow-lg transition-all active:scale-[0.98]"
            >
              <Reply className="h-4 w-4" />
              <span>Válasz</span>
            </button>
            {(email.cc || (email.to && email.to.includes(','))) && (
              <button
                onClick={() =>
                  onReply({
                    to: email.from || '',
                    subject: `Re: ${email.subject || ''}`,
                    threadId: email.threadId || undefined,
                    cc: [email.to, email.cc].filter(Boolean).join(', '),
                  })
                }
                className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-dark-bg-secondary hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary text-gray-700 dark:text-dark-text border border-gray-200 dark:border-dark-border rounded-xl text-sm font-medium shadow-sm hover:shadow transition-all active:scale-[0.98]"
              >
                <ReplyAll className="h-4 w-4" />
                <span>Válasz mindenkinek</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
