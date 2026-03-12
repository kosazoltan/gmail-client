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
  // Selection mode props
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (emailId: string, event?: React.MouseEvent) => void;
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
      displayName:
        email.subject?.replace(/^(Re|Fwd|Fw|VS|SV|AW|Antw):\s*/gi, '').trim() || '(Nincs tárgy)',
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
      displayName:
        email.subject?.replace(/^(Re|Fwd|Fw|VS|SV|AW|Antw):\s*/gi, '').trim() || '(Nincs tárgy)',
    };
  }

  // Ha se subject se threadId, akkor küldő + snippet alapján egyedi
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
  const uniqueSenders = [...new Set(thread.emails.map((e) => displaySender(e.fromName, e.from)))];
  const sendersText =
    uniqueSenders.length > 2
      ? `${uniqueSenders[0]}, ${uniqueSenders[1]} és ${uniqueSenders.length - 2} másik`
      : uniqueSenders.join(', ');

  return (
    <div
      className={cn(
        'dark:border-dark-border flex cursor-pointer items-start gap-3 border-b border-gray-100 px-4 py-3 transition-colors',
        isSelected
          ? 'border-l-2 border-l-blue-500 bg-blue-50 dark:bg-blue-500/10'
          : 'dark:hover:bg-dark-bg-tertiary hover:bg-gray-50',
        thread.hasUnread && 'dark:bg-dark-bg-secondary bg-white',
        !thread.hasUnread && !isSelected && 'dark:bg-dark-bg/50 bg-gray-50/50',
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
          className="dark:hover:bg-dark-bg-tertiary mt-1 flex-shrink-0 rounded p-1 transition-colors hover:bg-gray-200"
        >
          {isExpanded ? (
            <ChevronDown className="dark:text-dark-text-secondary h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRight className="dark:text-dark-text-secondary h-4 w-4 text-gray-500" />
          )}
        </button>
      ) : (
        <div className="w-6" /> // Spacer az igazításhoz
      )}

      {/* Avatar */}
      <div
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-medium text-white"
        style={{ backgroundColor: avatarColor }}
      >
        {initials}
      </div>

      {/* Tartalom */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                'truncate text-sm',
                thread.hasUnread
                  ? 'dark:text-dark-text font-semibold text-gray-900'
                  : 'dark:text-dark-text-secondary text-gray-700',
              )}
            >
              {sendersText}
            </span>
            {emailCount > 1 && (
              <span className="flex flex-shrink-0 items-center gap-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                <MessageSquare className="h-3 w-3" />
                {emailCount}
              </span>
            )}
          </div>
          <span className="dark:text-dark-text-muted flex-shrink-0 text-xs text-gray-400">
            {formatEmailDate(thread.latestDate)}
          </span>
        </div>

        <div
          className={cn(
            'mt-0.5 truncate text-sm',
            thread.hasUnread
              ? 'dark:text-dark-text font-medium text-gray-800'
              : 'dark:text-dark-text-secondary text-gray-600',
          )}
        >
          {thread.displayName || '(Nincs tárgy)'}
        </div>

        <div className="dark:text-dark-text-muted mt-0.5 truncate text-xs text-gray-400">
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
  selectionMode = false,
  selectedIds = new Set(),
  onToggleSelect,
}: ThreadedEmailListProps) {
  const toggleStar = useToggleStar();
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());

  // Emailek csoportosítása
  const threads = useMemo(() => groupEmailsIntoThreads(emails), [emails]);

  // Melyik thread tartalmazza a kiválasztott emailt
  const selectedThreadId = useMemo(() => {
    if (!selectedEmailId) return null;
    for (const thread of threads) {
      if (thread.emails.some((e) => e.id === selectedEmailId)) {
        return thread.id;
      }
    }
    return null;
  }, [threads, selectedEmailId]);

  const toggleThread = (threadId: string) => {
    setExpandedThreads((prev) => {
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
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500 dark:text-blue-400" />
        <span className="dark:text-dark-text-secondary ml-3 text-gray-500">
          Levelek betöltése...
        </span>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="dark:text-dark-text-muted flex h-64 flex-col items-center justify-center text-gray-400">
        <MailX className="mb-3 h-12 w-12" />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {title && (
        <div className="dark:bg-dark-bg-tertiary dark:border-dark-border border-b border-gray-200 bg-gray-50 px-4 py-2">
          <h2 className="dark:text-dark-text-secondary text-sm font-medium text-gray-600">
            {title}
            <span className="dark:text-dark-text-muted ml-2 text-xs text-gray-400">
              ({threads.length} beszélgetés)
            </span>
          </h2>
        </div>
      )}

      {threads.map((thread) => {
        const isExpanded = expandedThreads.has(thread.id);
        const isThreadSelected = selectedThreadId === thread.id;

        // Ha csak 1 email van a threadben, egyszerű EmailItem-et használunk
        if (thread.emails.length === 1) {
          const email = thread.emails[0];
          return (
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
              selectionMode={selectionMode}
              isChecked={selectedIds.has(email.id)}
              onToggleCheck={onToggleSelect}
            />
          );
        }

        return (
          <div key={thread.id}>
            {/* Thread header - csak ha több email van */}
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
              <div className="dark:bg-dark-bg/30 ml-4 border-l-2 border-blue-200 bg-gray-50/50 dark:border-blue-500/30">
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
                    selectionMode={selectionMode}
                    isChecked={selectedIds.has(email.id)}
                    onToggleCheck={onToggleSelect}
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
