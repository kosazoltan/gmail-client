export const EBC_COMPANY = 'EXCLUSIVE BEST CHANGE ZRT';
export const EC_COMPANY = 'EC INGATLAN KFT';
export const UNKNOWN_COMPANY = 'UNKNOWN';

export type InvoiceCompany = typeof EBC_COMPANY | typeof EC_COMPANY | typeof UNKNOWN_COMPANY;

export const COMPANY_TARGETS: Record<
  Exclude<InvoiceCompany, typeof UNKNOWN_COMPANY>,
  {
    aliases: RegExp[];
    envRecipients: string[];
    defaultRecipients: string[];
    fallbackNames: string[];
  }
> = {
  [EBC_COMPANY]: {
    aliases: [
      /exclusive\s+best\s+change/i,
      /exclusive\s+best\s+change\s+zrt/i,
      /\bebc\s+zrt\b/i,
      /\b32313332\b/i,
      /\bhu\s*tin\s*32313332\b/i,
      /\bhu\s*32313332\b/i,
    ],
    envRecipients: ['ACCOUNTING_KARDOS_ILDIKO_EMAIL', 'ACCOUNTING_BRAND_ZSUZSA_EMAIL'],
    defaultRecipients: ['kardos.ildiko.ebc@gmail.com', 'brandt.zsuzsanna.ebc@gmail.com'],
    fallbackNames: ['Kardos Ildiko', 'Brand Zsuzsa'],
  },
  [EC_COMPANY]: {
    aliases: [/\bec\s+ingatlan\b/i, /\bec\s+ingatlan\s+kft\b/i],
    envRecipients: ['ACCOUNTING_NAGY_MARIAN_EMAIL', 'ACCOUNTING_KARDOS_ILDIKO_EMAIL'],
    defaultRecipients: ['nagy.marianna.exz.hu@gmail.com', 'kardos.ildiko.ebc@gmail.com'],
    fallbackNames: ['Nagy Marian', 'Kardos Ildiko'],
  },
};

const INVOICE_TERMS = [
  'invoice',
  'bill',
  'billing',
  'proforma',
  'receipt',
  'tax invoice',
  'szamla',
  'e-szamla',
  'dijbekero',
  'vegszamla',
  'eloszamla',
  'bizonylat',
  'nyugta',
  'fizetes',
  'payment',
];

const INVOICE_DOCUMENT_PATTERNS = [
  /\binvoice\b/i,
  /\btax\s+invoice\b/i,
  /\breceipt\b/i,
  /\bproforma\b/i,
  /\bszamla\b/i,
  /\be\s*-\s*szamla\b/i,
  /\bdijbekero\b/i,
  /\bvegszamla\b/i,
  /\beloszamla\b/i,
  /\bbizonylat\b/i,
  /\bnyugta\b/i,
  /\bsorszam\b/i,
  /\bszamlaszam\b/i,
  /\bteljesites\s+datuma\b/i,
];

const CORRECTION_TERMS = [
  'storno',
  'sztorno',
  'credit note',
  'credit memo',
  'corrective invoice',
  'correction invoice',
  'helyesbito',
  'jovairo',
];

const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  '.pdf',
  '.xlsx',
  '.xls',
  '.doc',
  '.docx',
  '.csv',
  '.xml',
  '.nav',
  '.txt',
]);

const SKIP_ATTACHMENT_PATTERNS = [
  /^image\d+\./i,
  /^logo/i,
  /^signature/i,
  /^icon/i,
  /^spacer/i,
  /\.ics$/i,
  /^att\d+\./i,
  /^noname/i,
];

export interface VatAssessment {
  status:
    | 'ok_or_not_applicable'
    | 'needs_storno_reverse_charge_and_vat_27'
    | 'needs_tax_number_correction'
    | 'needs_human_review_reverse_charge_tax_number';
  findings: string[];
}

export interface InvoiceReviewDecision {
  isInvoiceCandidate: boolean;
  company: InvoiceCompany;
  routeStatus: 'ready' | 'already_sent' | 'manual_review';
  needsHumanReview: boolean;
  humanReviewReason: string;
  correctionCandidate: boolean;
  vat: VatAssessment;
}

export function normalizeInvoiceText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function hasInvoiceIntent(text: string): boolean {
  const normalized = normalizeInvoiceText(text);
  return INVOICE_TERMS.some((term) => normalized.includes(term));
}

export function hasInvoiceDocumentIntent(text: string): boolean {
  const normalized = normalizeInvoiceText(text);
  if (/\bszamlavezeto\b/.test(normalized)) return false;
  return INVOICE_DOCUMENT_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isCorrectionCandidate(text: string): boolean {
  const normalized = normalizeInvoiceText(text);
  return CORRECTION_TERMS.some((term) => normalized.includes(term));
}

export function shouldSkipInvoiceAttachment(filename: string): boolean {
  const lower = filename.toLowerCase();
  const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.')) : '';
  if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(ext)) return true;
  return SKIP_ATTACHMENT_PATTERNS.some((pattern) => pattern.test(lower));
}

export function classifyCompanyFromText(text: string): InvoiceCompany {
  const normalized = normalizeInvoiceText(text);
  const matches: InvoiceCompany[] = [];
  for (const [company, target] of Object.entries(COMPANY_TARGETS)) {
    if (target.aliases.some((pattern) => pattern.test(normalized))) {
      matches.push(company as InvoiceCompany);
    }
  }
  if (matches.length === 1) return matches[0];
  return UNKNOWN_COMPANY;
}

export function assessVatStatus(text: string, emailDate?: string | number | null): VatAssessment {
  const normalized = normalizeInvoiceText(text);
  const findings: string[] = [];
  const isAnthropic = normalized.includes('anthropic');
  const dateMs = typeof emailDate === 'number' ? emailDate : Date.parse(String(emailDate || ''));
  const afterRuleStart = Number.isFinite(dateMs) ? dateMs >= Date.UTC(2026, 3, 1) : true;
  if (!isAnthropic || !afterRuleStart) return { status: 'ok_or_not_applicable', findings };

  if (/reverse\s+charge|account\s+for\s+vat/i.test(normalized)) {
    findings.push('reverse_charge_text_present');
  }
  if (/\b27\s*%|\b27\s+percent|afa\s*27/i.test(normalized)) {
    findings.push('vat_27_present');
  }
  if (/hu\s*tin\s*32313332/i.test(normalized)) {
    findings.push('bad_tax_number_hu_tin_present');
  }
  if (/hu\s*32313332/i.test(normalized)) {
    findings.push('eu_tax_number_present');
  }

  if (findings.includes('reverse_charge_text_present') && findings.includes('vat_27_present')) {
    return { status: 'needs_storno_reverse_charge_and_vat_27', findings };
  }
  if (findings.includes('bad_tax_number_hu_tin_present')) {
    return { status: 'needs_tax_number_correction', findings };
  }
  if (findings.includes('reverse_charge_text_present')) {
    return { status: 'needs_human_review_reverse_charge_tax_number', findings };
  }
  return { status: 'ok_or_not_applicable', findings };
}

export function reviewInvoiceEvidence(input: {
  documentText: string;
  emailText: string;
  emailDate?: string | number | null;
  alreadySent?: boolean;
}): InvoiceReviewDecision {
  const combined = `${input.documentText || ''}\n${input.emailText || ''}`;
  const hasDocumentText = Boolean(input.documentText.trim());
  const isInvoiceCandidate = hasDocumentText
    ? hasInvoiceDocumentIntent(input.documentText)
    : hasInvoiceIntent(input.emailText);
  const company = classifyCompanyFromText(hasDocumentText ? input.documentText : combined);
  const vat = assessVatStatus(combined, input.emailDate);
  const correctionCandidate = isCorrectionCandidate(combined);

  const reasons: string[] = [];
  if (!isInvoiceCandidate) reasons.push('not_invoice_document');
  if (company === UNKNOWN_COMPANY) reasons.push('unknown_or_ambiguous_company');
  if (vat.status !== 'ok_or_not_applicable') reasons.push(vat.status);

  if (input.alreadySent) {
    return {
      isInvoiceCandidate,
      company,
      routeStatus: 'already_sent',
      needsHumanReview: false,
      humanReviewReason: '',
      correctionCandidate,
      vat,
    };
  }

  const needsHumanReview = reasons.length > 0;
  return {
    isInvoiceCandidate,
    company,
    routeStatus: needsHumanReview ? 'manual_review' : 'ready',
    needsHumanReview,
    humanReviewReason: reasons.join('; '),
    correctionCandidate,
    vat,
  };
}
