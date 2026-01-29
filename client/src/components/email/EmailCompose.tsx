import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSendEmail, useReplyEmail } from '../../hooks/useEmails';
import { Send, X, Loader2 } from 'lucide-react';

export function EmailCompose() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sendEmail = useSendEmail();
  const replyEmail = useReplyEmail();

  const isReply = searchParams.get('reply') === 'true';
  const isForward = searchParams.has('body') && !isReply;
  const [to, setTo] = useState(searchParams.get('to') || '');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(searchParams.get('subject') || '');
  const [body, setBody] = useState(searchParams.get('body') || '');
  const [showCc, setShowCc] = useState(false);

  const threadId = searchParams.get('threadId') || undefined;

  const handleSend = async () => {
    if (!to || !body) return;

    try {
      if (isReply) {
        await replyEmail.mutateAsync({ to, subject, body, cc, threadId });
      } else {
        await sendEmail.mutateAsync({ to, subject, body, cc });
      }
      navigate(-1);
    } catch (error) {
      console.error('Küldési hiba:', error);
    }
  };

  const isPending = sendEmail.isPending || replyEmail.isPending;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* Fejléc */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="font-medium text-gray-800">
            {isReply ? 'Válasz' : isForward ? 'Továbbítás' : 'Új levél'}
          </h2>
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Űrlap */}
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 w-16">Címzett:</label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="pelda@gmail.com"
              className="flex-1 px-3 py-1.5 text-sm border-b border-gray-200 focus:border-blue-400 outline-none"
            />
            {!showCc && (
              <button
                onClick={() => setShowCc(true)}
                className="text-xs text-blue-500 hover:text-blue-600"
              >
                Másolat
              </button>
            )}
          </div>

          {showCc && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500 w-16">Másolat:</label>
              <input
                type="email"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="masik@gmail.com"
                className="flex-1 px-3 py-1.5 text-sm border-b border-gray-200 focus:border-blue-400 outline-none"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 w-16">Tárgy:</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Levél tárgya"
              className="flex-1 px-3 py-1.5 text-sm border-b border-gray-200 focus:border-blue-400 outline-none"
            />
          </div>

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Levél szövege..."
            rows={12}
            className="w-full px-3 py-2 text-sm resize-none outline-none"
          />
        </div>

        {/* Küldés gomb */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
          <button
            onClick={handleSend}
            disabled={!to || !body || isPending}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Küldés
          </button>

          <button
            onClick={() => navigate(-1)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Elvetés
          </button>
        </div>
      </div>
    </div>
  );
}
