import DOMPurify from 'dompurify';
import type { Email } from '../../types';
import { formatFullDate } from '../../lib/utils';

interface Props {
  emails: Email[];
}

export function PrintView({ emails }: Props) {
  const sorted = [...emails].sort((a, b) => a.date - b.date);

  return (
    <div id="zmail-print-view" className="mx-auto max-w-3xl bg-white p-6 text-black">
      <style>{`@media print { .no-print { display:none !important; } body { background:#fff!important; } }`}</style>
      {sorted.map((email) => (
        <article key={email.id} className="mb-8 border-b border-gray-200 pb-6 last:border-b-0">
          <h1 className="mb-2 text-xl font-semibold">{email.subject || '(Nincs tárgy)'}</h1>
          <p>
            <strong>Feladó:</strong> {email.fromName || ''} {email.from ? `<${email.from}>` : ''}
          </p>
          <p>
            <strong>Címzett:</strong> {email.to || '-'}
          </p>
          {email.cc && (
            <p>
              <strong>Másolat:</strong> {email.cc}
            </p>
          )}
          <p>
            <strong>Dátum:</strong> {formatFullDate(email.date)}
          </p>
          <div
            className="mt-4 whitespace-pre-wrap"
            dangerouslySetInnerHTML={{
              __html:
                DOMPurify.sanitize(email.bodyHtml || '') ||
                (email.body || '').replace(/\n/g, '<br/>'),
            }}
          />
          {email.attachments && email.attachments.length > 0 && (
            <div className="mt-4">
              <p className="font-medium">Mellékletek:</p>
              <ul className="list-disc pl-5 text-sm">
                {email.attachments.map((a) => (
                  <li key={a.id}>
                    {a.filename} ({Math.round(a.size / 1024)} KB)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
