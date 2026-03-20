import { useState } from 'react';
import { Bold, Italic, Underline, Link2, List, ListOrdered, Quote, ImagePlus } from 'lucide-react';

interface Props {
  editorRef: React.RefObject<HTMLDivElement | null>;
  onInsertImageUrl: (url: string) => void;
}

export function ComposerToolbar({ editorRef, onInsertImageUrl }: Props) {
  const [showLink, setShowLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  };

  return (
    <div className="dark:border-dark-border mb-2 flex flex-wrap items-center gap-1 rounded-lg border border-gray-200 p-2">
      <button
        onClick={() => exec('bold')}
        className="dark:hover:bg-dark-bg-tertiary rounded p-1.5 hover:bg-gray-100"
        title="Félkövér (Ctrl+B)"
      >
        <Bold className="h-4 w-4" />
      </button>
      <button
        onClick={() => exec('italic')}
        className="dark:hover:bg-dark-bg-tertiary rounded p-1.5 hover:bg-gray-100"
        title="Dőlt (Ctrl+I)"
      >
        <Italic className="h-4 w-4" />
      </button>
      <button
        onClick={() => exec('underline')}
        className="dark:hover:bg-dark-bg-tertiary rounded p-1.5 hover:bg-gray-100"
        title="Aláhúzott (Ctrl+U)"
      >
        <Underline className="h-4 w-4" />
      </button>
      <button
        onClick={() => exec('insertUnorderedList')}
        className="dark:hover:bg-dark-bg-tertiary rounded p-1.5 hover:bg-gray-100"
        title="Felsorolás"
      >
        <List className="h-4 w-4" />
      </button>
      <button
        onClick={() => exec('insertOrderedList')}
        className="dark:hover:bg-dark-bg-tertiary rounded p-1.5 hover:bg-gray-100"
        title="Számozott lista"
      >
        <ListOrdered className="h-4 w-4" />
      </button>
      <button
        onClick={() => exec('formatBlock', 'blockquote')}
        className="dark:hover:bg-dark-bg-tertiary rounded p-1.5 hover:bg-gray-100"
        title="Idézet"
      >
        <Quote className="h-4 w-4" />
      </button>
      <input
        type="color"
        onChange={(e) => exec('foreColor', e.target.value)}
        className="dark:border-dark-border dark:bg-dark-bg-secondary dark:text-dark-text h-7 w-7 cursor-pointer rounded border"
        title="Szövegszín"
      />
      <button
        onClick={() => setShowLink(true)}
        className="dark:hover:bg-dark-bg-tertiary rounded p-1.5 hover:bg-gray-100"
        title="Link (Ctrl+K)"
      >
        <Link2 className="h-4 w-4" />
      </button>
      <button
        onClick={() => {
          const url = prompt('Kép URL');
          if (url) onInsertImageUrl(url);
        }}
        className="dark:hover:bg-dark-bg-tertiary rounded p-1.5 hover:bg-gray-100"
        title="Kép URL"
      >
        <ImagePlus className="h-4 w-4" />
      </button>

      {showLink && (
        <div className="ml-2 flex items-center gap-1">
          <input
            value={linkText}
            onChange={(e) => setLinkText(e.target.value)}
            placeholder="Szöveg"
            className="dark:border-dark-border dark:bg-dark-bg-secondary dark:text-dark-text dark:placeholder-dark-text-muted rounded border px-2 py-1 text-xs"
          />
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://"
            className="dark:border-dark-border dark:bg-dark-bg-secondary dark:text-dark-text dark:placeholder-dark-text-muted rounded border px-2 py-1 text-xs"
          />
          <button
            onClick={() => {
              editorRef.current?.focus();
              if (linkText) {
                document.execCommand(
                  'insertHTML',
                  false,
                  `<a href="${linkUrl}" target="_blank" rel="noopener">${linkText}</a>`,
                );
              } else {
                document.execCommand('createLink', false, linkUrl);
              }
              setShowLink(false);
              setLinkText('');
              setLinkUrl('');
            }}
            className="rounded bg-blue-600 px-2 py-1 text-xs text-white"
          >
            OK
          </button>
        </div>
      )}
    </div>
  );
}
