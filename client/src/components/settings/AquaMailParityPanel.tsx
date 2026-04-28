import {
  Archive,
  Bell,
  Bot,
  CalendarClock,
  FileDown,
  FolderSearch,
  LockKeyhole,
  MoveHorizontal,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { cn } from '../../lib/utils';

const parityGroups = [
  {
    title: 'AquaMail-szintű kezelés',
    items: [
      { label: 'Swipe műveletek', state: 'ready', icon: MoveHorizontal },
      { label: 'Bulk műveletek', state: 'ready', icon: Archive },
      { label: 'Szundi és ütemezés', state: 'ready', icon: CalendarClock },
      { label: 'VIP értesítések', state: 'ready', icon: Bell },
    ],
  },
  {
    title: 'Export és biztonság',
    items: [
      { label: 'PDF export', state: 'ready', icon: FileDown },
      { label: 'EML export', state: 'ready', icon: FileDown },
      { label: 'Eredet panel', state: 'ready', icon: ShieldCheck },
      { label: 'S/MIME', state: 'limited', icon: LockKeyhole },
    ],
  },
  {
    title: 'ZMail többlettudás',
    items: [
      { label: 'AI Asszisztens', state: 'plus', icon: Bot },
      { label: 'Smart Folders', state: 'plus', icon: FolderSearch },
      { label: 'PWA web app', state: 'plus', icon: Smartphone },
      { label: 'AI dokumentumelemzés', state: 'plus', icon: Bot },
    ],
  },
] as const;

const stateStyle = {
  ready:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
  plus: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200',
  limited:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
} as const;

const stateLabel = {
  ready: 'Kész',
  plus: 'ZMail+',
  limited: 'Korlát',
} as const;

export function AquaMailParityPanel() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="dark:text-dark-text text-sm font-medium text-gray-800">
          AquaMail parity térkép
        </h3>
        <p className="dark:text-dark-text-muted mt-1 text-sm text-gray-500">
          A mobil kliensből hiányzó erős pontok és a ZMail saját előnyei egyben.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {parityGroups.map((group) => (
          <div
            key={group.title}
            className="dark:border-dark-border rounded-xl border border-gray-200 p-3"
          >
            <div className="dark:text-dark-text mb-3 text-xs font-semibold tracking-wide text-gray-700 uppercase">
              {group.title}
            </div>
            <div className="space-y-2">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-xs',
                      stateStyle[item.state],
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate font-medium">{item.label}</span>
                    </div>
                    <span className="shrink-0 rounded-full bg-white/60 px-1.5 py-0.5 text-[10px] font-semibold dark:bg-black/20">
                      {stateLabel[item.state]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="dark:text-dark-text-muted text-xs leading-relaxed text-gray-500">
        IMAP/POP3/EWS, natív widget és Wear OS csak külön protokoll- vagy natív kliensréteggel
        érhető el. A Gmail API-s ZMail előnyei: AI, PWA, Neon-alapú szinkron és webes elérés.
      </div>
    </div>
  );
}
