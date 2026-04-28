import type { Email } from '../types';

export type EmailSecurityLevel = 'good' | 'warning' | 'info';

export interface EmailSecurityInsight {
  id: string;
  level: EmailSecurityLevel;
  label: string;
  detail: string;
}

const RISKY_ATTACHMENT_EXTENSIONS = new Set([
  'bat',
  'cmd',
  'com',
  'exe',
  'js',
  'msi',
  'ps1',
  'scr',
  'vbs',
  'wsf',
]);

function extractDomain(emailAddress: string | null | undefined): string | null {
  const match = emailAddress?.match(/@([^>\s]+)>?$/);
  return match?.[1]?.toLowerCase() ?? null;
}

function extractLinks(email: Email): URL[] {
  const source = [email.bodyHtml, email.body, email.snippet].filter(Boolean).join('\n');
  const matches = source.match(/https?:\/\/[^\s"'<>]+/gi) || [];
  return matches.flatMap((value) => {
    try {
      return [new URL(value)];
    } catch {
      return [];
    }
  });
}

function extensionOf(filename: string): string {
  const parts = filename.toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

export function getEmailSecurityInsights(email: Email): EmailSecurityInsight[] {
  const insights: EmailSecurityInsight[] = [];
  const senderDomain = extractDomain(email.from);
  const recipientDomain = extractDomain(email.to);
  const links = extractLinks(email);
  const uniqueLinkDomains = Array.from(new Set(links.map((link) => link.hostname.toLowerCase())));
  const riskyAttachments = (email.attachments || []).filter((attachment) =>
    RISKY_ATTACHMENT_EXTENSIONS.has(extensionOf(attachment.filename)),
  );

  if (senderDomain) {
    insights.push({
      id: 'sender-domain',
      level: 'good',
      label: 'Feladó domain',
      detail: senderDomain,
    });
  } else {
    insights.push({
      id: 'sender-domain-missing',
      level: 'warning',
      label: 'Feladó hiányos',
      detail: 'A feladó címe nem értelmezhető egyértelműen.',
    });
  }

  if (recipientDomain && senderDomain && recipientDomain === senderDomain) {
    insights.push({
      id: 'same-domain',
      level: 'info',
      label: 'Belső domain',
      detail: 'A feladó és címzett azonos domainen van.',
    });
  }

  if (riskyAttachments.length > 0) {
    insights.push({
      id: 'risky-attachments',
      level: 'warning',
      label: 'Kockázatos melléklet',
      detail: riskyAttachments.map((attachment) => attachment.filename).join(', '),
    });
  } else if (email.attachments?.length) {
    insights.push({
      id: 'attachments',
      level: 'info',
      label: 'Mellékletek',
      detail: `${email.attachments.length} fájl, ismert futtatható kiterjesztés nélkül.`,
    });
  }

  if (uniqueLinkDomains.length > 0) {
    const offDomainLinks = senderDomain
      ? uniqueLinkDomains.filter(
          (domain) => domain !== senderDomain && !domain.endsWith(`.${senderDomain}`),
        )
      : uniqueLinkDomains;

    insights.push({
      id: 'external-links',
      level: offDomainLinks.length > 0 ? 'warning' : 'good',
      label: offDomainLinks.length > 0 ? 'Külső linkek' : 'Link domain egyezés',
      detail:
        offDomainLinks.length > 0
          ? offDomainLinks.slice(0, 3).join(', ')
          : uniqueLinkDomains.slice(0, 3).join(', '),
    });
  }

  insights.push({
    id: 'transport-note',
    level: 'info',
    label: 'Gmail API forrás',
    detail:
      'A levél OAuth-alapú Gmail API szinkronból érkezett; DKIM/SPF nyers fejléc csak backend bővítéssel jeleníthető meg.',
  });

  return insights;
}
