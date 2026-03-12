import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useThreadConversation } from '../../hooks/useEmails';
import { useSession } from '../../hooks/useAccounts';
import { useReplyEmail } from '../../hooks/useEmails';
import {
  Loader2,
  ArrowLeft,
  Reply,
  Send,
  ChevronDown,
  ChevronUp,
  Paperclip,
  Mail,
} from 'lucide-react';
import { cn, formatFileSize } from '../../lib/utils';
import { toast } from '../../lib/toast';
import { api } from '../../lib/api';
import type { ThreadEmail } from '../../types';
import DOMPurify from 'dompurify';

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

function formatDate(timestamp: number): string {
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
}

function EmailMessage({
  email,
  accountEmail,
  isLast,
  defaultExpanded,
}: {
  email: ThreadEmail;
  accountEmail: string | null;
  isLast: boolean;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isSent = email.isSent || (accountEmail && email.from === accountEmail);

  return (
    <div
      className={cn(
        'dark:border-dark-border rounded-xl border bg-white dark:bg-dark-bg-secondary',
        isLast && 'ring-2 ring-[#4f6ef7]/20',
      )}
    >
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {/* Avatar */}
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white',
            isSent ? 'bg-green-500' : 'bg-[#4f6ef7]',
          )}
        >
          {isSent ? (
            <Reply className="h-4 w-4" />
          ) : (
            (email.fromName || email.from || '?').charAt(0).toUpperCase()
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="dark:text-dark-text truncate text-sm font-medium text-gray-900">
              {isSent ? 'Én' : email.fromName || email.from || 'Ismeretlen'}
            </span>
            {isSent && (
              <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-500/20 dark:text-green-400">
                Küldött
              </span>
            )}
          </div>
          {!expanded && email.snippet && (
            <p className="dark:text-dark-text-muted mt-0.5 truncate text-xs text-gray-400">
              {email.snippet}
            </p>
          )}
        </div>

        <span className="dark:text-dark-text-muted shrink-0 text-xs text-gray-400">
          {formatDate(email.date)}
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
        )}
      </button>

      {/* Body — expandable */}
      {expanded && (
        <div className="dark:border-dark-border border-t px-4 py-3">
          {/* To/CC info */}
          <div className="mb-3 space-y-1 text-xs text-gray-500 dark:text-dark-text-muted">
            {email.to && (
              <p>
                <span className="font-medium">Címzett:</span> {email.to}
              </p>
            )}
            {email.cc && (
              <p>
                <span className="font-medium">Másolat:</span> {email.cc}
              </p>
            )}
          </div>

          {/* Email body */}
          {email.bodyHtml ? (
            <div
              className="prose prose-sm dark:prose-invert max-w-none overflow-auto"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(email.bodyHtml, {
                  ADD_ATTR: ['target'],
                }),
              }}
            />
          ) : email.body ? (
            <pre className="dark:text-dark-text whitespace-pre-wrap font-sans text-sm text-gray-700">
              {email.body}
            </pre>
          ) : (
            <p className="dark:text-dark-text-muted text-sm italic text-gray-400">
              Nincs elérhető tartalom
            </p>
          )}

          {/* Attachments */}
          {email.attachments && email.attachments.length > 0 && (
            <div className="dark:border-dark-border mt-3 border-t pt-3">
              <div className="flex flex-wrap gap-2">
                {email.attachments.map((att) => (
                  <a
                    key={att.id}
                    href={api.attachments.downloadUrl(att.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="dark:bg-dark-bg-tertiary flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-xs transition-colors hover:bg-gray-200 dark:hover:bg-dark-bg-tertiary/80"
                  >
                    <Paperclip className="h-3.5 w-3.5 text-gray-500" />
                    <span className="dark:text-dark-text max-w-[150px] truncate text-gray-700">
                      {att.filename}
                    </span>
                    <span className="text-gray-400">{formatFileSize(att.size)}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ThreadView() {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const { data: session } = useSession();
  const accountId = session?.activeAccountId || undefined;

  // threadId is actually the emailId — we pass it to getThread which finds the thread
  const { data, isLoading, error } = useThreadConversation(threadId || null, accountId);
  const replyEmail = useReplyEmail();
  const bottomRef = useRef<HTMLDivElement>(null);

  const [showReply, setShowReply] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Scroll to bottom when data loads
  useEffect(() => {
    if (data && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#4f6ef7]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <Mail className="h-8 w-8 text-gray-400" />
        <p className="dark:text-dark-text-secondary text-sm text-gray-500">
          {error ? 'Hiba a beszélgetés betöltésekor' : 'Beszélgetés nem található'}
        </p>
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-[#4f6ef7] hover:underline"
        >
          Vissza
        </button>
      </div>
    );
  }

  const emails = data.emails || [];
  const subject = emails[0]?.subject || '(nincs tárgy)';
  const lastEmail = emails[emails.length - 1];

  const handleSendReply = async () => {
    if (!replyBody.trim() || !lastEmail) return;
    setIsSending(true);

    try {
      await replyEmail.mutateAsync({
        to: lastEmail.from || '',
        subject: `Re: ${lastEmail.subject || ''}`,
        body: replyBody,
        threadId: data.threadId || undefined,
      });
      toast.success('Válasz elküldve!');
      setReplyBody('');
      setShowReply(false);
    } catch {
      toast.error('Nem sikerült elküldeni a választ');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="dark:text-dark-text-secondary dark:hover:text-dark-text mb-3 flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Vissza
        </button>
        <h1 className="dark:text-dark-text text-xl font-semibold text-gray-900">{subject}</h1>
        <p className="dark:text-dark-text-muted mt-1 text-sm text-gray-400">
          {emails.length} üzenet a beszélgetésben
        </p>
      </div>

      {/* Thread emails */}
      <div className="space-y-3">
        {emails.map((email, idx) => (
          <EmailMessage
            key={email.id}
            email={email}
            accountEmail={data.accountEmail}
            isLast={idx === emails.length - 1}
            defaultExpanded={idx === emails.length - 1 || emails.length <= 3}
          />
        ))}
      </div>

      {/* Reply section */}
      <div className="mt-4" ref={bottomRef}>
        {!showReply ? (
          <button
            onClick={() => setShowReply(true)}
            className="flex items-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500 transition-colors hover:border-[#4f6ef7] hover:text-[#4f6ef7] dark:border-dark-border dark:text-dark-text-muted dark:hover:border-[#4f6ef7] dark:hover:text-[#4f6ef7]"
          >
            <Reply className="h-4 w-4" />
            Válasz írása...
          </button>
        ) : (
          <div className="dark:border-dark-border dark:bg-dark-bg-secondary rounded-xl border bg-white p-4">
            <textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder="Írd meg a válaszod..."
              className="dark:text-dark-text min-h-[120px] w-full resize-none rounded-lg border-0 bg-transparent p-0 text-sm outline-none placeholder:text-gray-400"
              autoFocus
            />
            <div className="mt-3 flex items-center justify-between">
              <button
                onClick={handleSendReply}
                disabled={!replyBody.trim() || isSending}
                className="flex items-center gap-2 rounded-lg bg-[#4f6ef7] px-5 py-2 text-sm text-white transition-colors hover:bg-[#3d5ce5] disabled:opacity-50"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Küldés
              </button>
              <button
                onClick={() => {
                  setShowReply(false);
                  setReplyBody('');
                }}
                className="dark:text-dark-text-secondary text-sm text-gray-500 hover:text-gray-700"
              >
                Mégse
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
