import { describe, expect, it } from 'vitest';
import {
  EBC_COMPANY,
  EC_COMPANY,
  COMPANY_TARGETS,
  UNKNOWN_COMPANY,
  assessVatStatus,
  classifyCompanyFromText,
  hasInvoiceDocumentIntent,
  hasInvoiceIntent,
  reviewInvoiceEvidence,
  shouldSkipInvoiceAttachment,
} from './invoice-rules.service.js';

describe('invoice-rules.service', () => {
  it('classifies companies from extracted invoice text', () => {
    expect(classifyCompanyFromText('Buyer: Exclusive Best Change Zrt. VAT HU32313332')).toBe(
      EBC_COMPANY,
    );
    expect(classifyCompanyFromText('Vevő: EC Ingatlan Kft. Számla sorszáma ABC-123')).toBe(
      EC_COMPANY,
    );
    expect(classifyCompanyFromText('Invoice for unrelated customer')).toBe(UNKNOWN_COMPANY);
  });

  it('detects invoice intent without accepting bank account false positives', () => {
    expect(hasInvoiceIntent('e-számla elkészült')).toBe(true);
    expect(hasInvoiceDocumentIntent('Számla sorszáma: ABC-123')).toBe(true);
    expect(hasInvoiceDocumentIntent('számlavezető pénzintézet OTP Bank')).toBe(false);
  });

  it('skips inline noise attachments but keeps invoice documents', () => {
    expect(shouldSkipInvoiceAttachment('logo.png')).toBe(true);
    expect(shouldSkipInvoiceAttachment('meeting.ics')).toBe(true);
    expect(shouldSkipInvoiceAttachment('invoice.pdf')).toBe(false);
  });

  it('keeps non-secret default accounting recipients for Gmail distribution', () => {
    expect(COMPANY_TARGETS[EBC_COMPANY].defaultRecipients).toEqual([
      'kardos.ildiko.ebc@gmail.com',
      'brandt.zsuzsanna.ebc@gmail.com',
    ]);
    expect(COMPANY_TARGETS[EC_COMPANY].defaultRecipients).toEqual([
      'nagy.marianna.exz.hu@gmail.com',
      'kardos.ildiko.ebc@gmail.com',
    ]);
  });

  it('flags Anthropic reverse-charge invoices with 27 percent VAT after 2026-04-01', () => {
    const result = assessVatStatus(
      'Anthropic Ireland Limited. Customer may be obliged to account for VAT on reverse charge basis. VAT 27%. HU TIN 32313332-2-02',
      Date.UTC(2026, 3, 2),
    );
    expect(result.status).toBe('needs_storno_reverse_charge_and_vat_27');
    expect(result.findings).toContain('reverse_charge_text_present');
    expect(result.findings).toContain('vat_27_present');
  });

  it('blocks unknown company or risky VAT before dispatch', () => {
    const unknown = reviewInvoiceEvidence({
      documentText: 'Invoice number INV-1 for unrelated buyer',
      emailText: 'invoice',
    });
    expect(unknown.routeStatus).toBe('manual_review');
    expect(unknown.needsHumanReview).toBe(true);

    const ready = reviewInvoiceEvidence({
      documentText: 'Számla sorszáma INV-2 Vevő: EC Ingatlan Kft.',
      emailText: 'e-számla',
    });
    expect(ready.routeStatus).toBe('ready');
    expect(ready.company).toBe(EC_COMPANY);
  });
});
