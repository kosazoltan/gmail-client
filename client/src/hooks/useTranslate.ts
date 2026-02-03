import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useTranslate() {
  return useMutation({
    mutationFn: ({ text, targetLang = 'hu', sourceLang = 'auto' }: {
      text: string;
      targetLang?: string;
      sourceLang?: string;
    }) => api.translate.translate(text, targetLang, sourceLang),
  });
}

export function useDetectLanguage() {
  return useMutation({
    mutationFn: (text: string) => api.translate.detect(text),
  });
}

export function useAvailableLanguages() {
  return useQuery({
    queryKey: ['translate-languages'],
    queryFn: () => api.translate.languages(),
    staleTime: Infinity, // Languages don't change
  });
}

// Hook for translating email content with state management
export function useEmailTranslation() {
  const [translatedContent, setTranslatedContent] = useState<{
    subject?: string;
    body?: string;
    targetLang: string;
    detectedLang?: string;
  } | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const translateEmail = useCallback(async (
    subject: string | null | undefined,
    body: string | null | undefined,
    targetLang = 'hu'
  ) => {
    setIsTranslating(true);
    setError(null);

    try {
      const results: { subject?: string; body?: string; detectedLang?: string } = {};

      // Translate subject if present
      if (subject) {
        const subjectResult = await api.translate.translate(subject, targetLang, 'auto');
        results.subject = subjectResult.translatedText;
        results.detectedLang = subjectResult.detectedLanguage;
      }

      // Translate body if present
      if (body) {
        const bodyResult = await api.translate.translate(body, targetLang, 'auto');
        results.body = bodyResult.translatedText;
        if (!results.detectedLang) {
          results.detectedLang = bodyResult.detectedLanguage;
        }
      }

      setTranslatedContent({
        ...results,
        targetLang,
      });

      return results;
    } catch (err) {
      setError('Fordítás sikertelen');
      throw err;
    } finally {
      setIsTranslating(false);
    }
  }, []);

  const clearTranslation = useCallback(() => {
    setTranslatedContent(null);
    setError(null);
  }, []);

  return {
    translatedContent,
    isTranslating,
    error,
    translateEmail,
    clearTranslation,
  };
}
