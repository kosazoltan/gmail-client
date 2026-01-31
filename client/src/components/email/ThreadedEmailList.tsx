import { useState, useMemo } from 'react';
import { EmailItem } from './EmailItem';
import { useToggleStar } from '../../hooks/useEmails';
import { Loader2, MailX, ChevronDown, ChevronRight, MessageSquare } from 'lucide-react';
import { cn, formatEmailDate, displaySender, getInitials, emailToColor } from '../../lib/utils';
import type { Email } from '../../types';

interface ThreadedEmailListProps {
  emails: Email[];
  isLoading?: boolean;
  selectedEmailId: string | null;
  onSelectEmail: (email: Email) => void;
  onDeleteEmail?: (emailId: string) => void;
  title?: string;
  emptyMessage?: string;
}

// Email csoport típus
interface EmailThread {
  id: string;
  groupKey: string;
  displayName: string; // Megjelenített csoport név (subject vagy küldő neve)
  emails: Email[];
  latestDate: number;
  hasUnread: boolean;
  isStarred: boolean;
}

// Normalizálja a subject-et csoportosításhoz (Re:, Fwd: eltávolítása)
function normalizeSubject(subject: string | undefined | null): string {
  if (!subject) return '';
  // Re:, Fwd:, Fw:, stb. eltávolítása
  return subject
    .replace(/^(Re|Fwd|Fw|VS|SV|AW|Antw):\s*/gi, '')
    .trim()
    .toLowerCase();
}

// Csoportosítási kulcs generálása
function getGroupKey(email: Email): { key: string; displayName: string } {
  const normalizedSubject = normalizeSubject(email.subject);

  // Ha van threadId és subject, használjuk a threadId-t
  if (email.threadId && normalizedSubject) {
    return {
      key: `thread:${email.threadId}`,
      displayName: email.subject?.replace(/^(Re|Fwd|Fw|VS|SV|AW|Antw):\s*/gi, '').trim() || '(Nincs tárgy)',
    };
  }

  // Ha nincs subject de van threadId, akkor küldő alapján csoportosítunk
  if (email.threadId && !normalizedSubject) {
    const senderKey = email.from?.toLowerCase() || 'unknown';
    return {
      key: `sender:${senderKey}:${email.threadId}`,
      displayName: displaySender(email.fromName, email.from),
    };
  }

  // Ha van subject de nincs threadId, subject alapján
  if (normalizedSubject) {
    return {
      key: `subject:${normalizedSubject}`,
      displayName: email.subject?.replace(/^(Re|Fwd|Fw|VS|SV|AW|Antw):\s*/gi, '').trim() || '(Nincs tárgy)',
    };
  }

  // Ha se subject se threadId, akkor küldő + snippet alapján egyedi
  const senderKey = email.from?.toLowerCase() || 'unknown';
  return {
    key: `single:${email.id}`,
    displayName: displaySender(email.fromName, email.from),
  };
}

// Emailek csoportosítása thread-ekbe
function groupEmailsIntoThreads(emails: Email[]): EmailThread[] {
  const threadMap = new Map<string, EmailThread>();

  for (const email of emails) {
    const { key, displayName } = getGroupKey(email);

    if (threadMap.has(key)) {
      const thread = threadMap.get(key)!;
      thread.emails.push(email);
      if (email.date > thread.latestDate) {
        thread.latestDate = email.date;
      }
      if (!email.isRead) {
        thread.hasUnread = true;
      }
      if (email.isStarred) {
        thread.isStarred = true;
      }
    } else {
      threadMap.set(key, {
        id: key,
        groupKey: key,
        displayName,
        emails: [email],
        latestDate: email.date,
        hasUnread: !email.isRead,
        isStarred: email.isStarred || false,
      });
    }
  }

  // Thread-ek rendezése dátum szerint (legújabb elöl)
  const threads = Array.from(threadMap.values());
  threads.sort((a, b) => b.latestDate - a.latestDate);

  // Thread-en belüli emailek rendezése (legrégebbi elöl - időrendi sorrend)
  for (const thread of threads) {
    thread.emails.sort((a, b) => a.date - b.date);
  }

  return threads;
}

// Thread header komponens
function ThreadHeader({
  thread,
  isExpanded,
  isSelected,
  onToggle,
  onSelectLatest,
}: {
  thread: EmailThread;
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onSelectLatest: () => void;
}) {
  const latestEmail = thread.emails[thread.emails.length - 1];
  const sender = displaySender(latestEmail.fromName, latestEmail.from);
  const initials = getInitials(sender);
  const avatarColor = emailToColor(latestEmail.from || '');
  const emailCount = thread.emails.length;

  // Összegyűjtjük az összes küldőt a thread-ben
  const uniqueSenders = [...new Set(thread.emails.map(e => displaySender(e.fromName, e.from)))];
  const sendersText = uniqueSenders.length > 2
    ? `${uniqueSenders[0]}, ${uniqueSenders[1]} és ${uniqueSenders.length - 2} másik`
    : uniqueSenders.join(', ');

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-gray-100 dark:border-dark-border transition-colors',
        isSelected ? 'bg-blue-50 dark:bg-blue-500/10 border-l-2 border-l-blue-500' : 'hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary',
        thread.hasUnread && 'bg-white dark:bg-dark-bg-secondary',
        !thread.hasUnread && !isSelected && 'bg-gray-50/50 dark:bg-dark-bg/50',
      )}
      onClick={(e) => {
        // Ha egynél több email van, toggle expand, egyébként select
        if (emailCount > 1) {
          // Shift+click vagy ha már expanded, akkor select latest
          if (e.shiftKey || isExpanded) {
            onSelectLatest();
          } else {
            onToggle();
          }
        } else {
          onSelectLatest();
        }
      }}
    >
      {/* Expand/collapse gomb - csak ha több email van */}
      {emailCount > 1 ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="flex-shrink-0 p-1 rounded hover:bg-gray-200 dark:hover:bg-dark-bg-tertiary transition-colors mt-1"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-500 dark:text-dark-text-secondary" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500 dark:text-dark-text-secondary" />
          )}
        </button>
      ) : (
        <div className="w-6" /> // Spacer az igazításhoz
      )}

      {/* Avatar */}
      <div
        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium"
        style={{ backgroundColor: avatarColor }}
      >
        {initials}
      </div>

      {/* Tartalom */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={cn(
                'text-sm truncate',
                thread.hasUnread ? 'font-semibold text-gray-900 dark:text-dark-text' : 'text-gray-700 dark:text-dark-text-secondary',
              )}
            >
              {sendersText}
            </span>
            {emailCount > 1 && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-medium rounded-full flex-shrink-0">
                <MessageSquare className="h-3 w-3" />
                {emailCount}
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400 dark:text-dark-text-muted flex-shrink-0">
            {formatEmailDate(thread.latestDate)}
          </span>
        </div>

        <div
          className={cn(
            'text-sm truncate mt-0.5',
            thread.hasUnread ? 'font-medium text-gray-800 dark:text-dark-text' : 'text-gray-600 dark:text-dark-text-secondary',
          )}
        >
          {thread.displayName || '(Nincs tárgy)'}
        </div>

        <div className="text-xs text-gray-400 dark:text-dark-text-muted truncate mt-0.5">
          {latestEmail.snippet || ''}
        </div>
      </div>

      {/* Csillag indikátor */}
      {thread.isStarred && (
        <div className="flex-shrink-0">
          <span className="text-yellow-400">★</span>
        </div>
      )}
    </div>
  );
}

export function ThreadedEmailList({
  emails,
  isLoading,
  selectedEmailId,
  onSelectEmail,
  onDeleteEmail,
  title,
  emptyMessage = 'Nincsenek levelek',
}: ThreadedEmailListProps) {
  const toggleStar = useToggleStar();
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());

  // Emailek csoportosítása
  const threads = useMemo(() => groupEmailsIntoThreads(emails), [emails]);

  // Melyik thread tartalmazza a kiválasztott emailt
  const selectedThreadId = useMemo(() => {
    if (!selectedEmailId) return null;
    for (const thread of threads) {
      if (thread.emails.some(e => e.id === selectedEmailId)) {
        return thread.id;
      }
    }
    return null;
  }, [threads, selectedEmailId]);

  const toggleThread = (threadId: string) => {
    setExpandedThreads(prev => {
      const newSet = new Set(prev);
      if (newSet.has(threadId)) {
        newSet.delete(threadId);
      } else {
        newSet.add(threadId);
      }
      return newSet;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500 dark:text-blue-400" />
        <span className="ml-3 text-gray-500 dark:text-dark-text-secondary">Levelek betöltése...</span>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-dark-text-muted">
        <MailX className="h-12 w-12 mb-3" />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {title && (
        <div className="px-4 py-2 bg-gray-50 dark:bg-dark-bg-tertiary border-b border-gray-200 dark:border-dark-border">
          <h2 className="text-sm font-medium text-gray-600 dark:text-dark-text-secondary">
            {title}
            <span className="ml-2 text-xs text-gray-400 dark:text-dark-text-muted">
              ({threads.length} beszélgetés)
            </span>
          </h2>
        </div>
      )}

      {threads.map((thread) => {
        const isExpanded = expandedThreads.has(thread.id);
        const isThreadSelected = selectedThreadId === thread.id;

        return (
          <div key={thread.id}>
            {/* Thread header */}
            <ThreadHeader
              thread={thread}
              isExpanded={isExpanded}
              isSelected={isThreadSelected && !isExpanded}
              onToggle={() => toggleThread(thread.id)}
              onSelectLatest={() => {
                const latestEmail = thread.emails[thread.emails.length - 1];
                onSelectEmail(latestEmail);
              }}
            />

            {/* Expanded emails */}
            {isExpanded && (
              <div className="border-l-2 border-blue-200 dark:border-blue-500/30 ml-4 bg-gray-50/50 dark:bg-dark-bg/30">
                {thread.emails.map((email) => (
                  <EmailItem
                    key={email.id}
                    email={email}
                    isSelected={email.id === selectedEmailId}
                    onClick={() => onSelectEmail(email)}
                    onToggleStar={(e) => {
                      e.stopPropagation();
                      toggleStar.mutate({
                        emailId: email.id,
                        isStarred: !email.isStarred,
                      });
                    }}
                    onDelete={onDeleteEmail}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
