import { queryOne, queryAll, execute } from '../db/index.js';

interface EmailForCategorization {
  from: string;
  subject: string;
  labels: string[];
}

// Levél kategorizalasa a szabalyok alapjan
export function categorizeEmail(
  accountId: string,
  email: EmailForCategorization,
): string | null {
  const rules = queryAll<{
    id: string;
    category_id: string;
    type: string;
    value: string;
    priority: number;
    account_id: string;
  }>(
    'SELECT * FROM categorization_rules WHERE account_id = ? ORDER BY priority DESC',
    [accountId],
  );

  const fromDomain = email.from.split('@')[1]?.toLowerCase() || '';
  const fromEmail = email.from.toLowerCase();
  const subjectLower = email.subject.toLowerCase();

  for (const rule of rules) {
    const value = rule.value.toLowerCase();

    switch (rule.type) {
      case 'sender_domain':
        if (fromDomain.includes(value)) {
          return rule.category_id;
        }
        break;

      case 'sender_email':
        if (fromEmail.includes(value)) {
          return rule.category_id;
        }
        break;

      case 'subject_keyword':
        if (subjectLower.includes(value)) {
          return rule.category_id;
        }
        break;

      case 'label':
        if (email.labels.some((l) => l.toUpperCase() === value.toUpperCase())) {
          return rule.category_id;
        }
        break;
    }
  }

  // Ha nincs talalat, az Egyeb kategoria
  const otherCategory = queryOne<{ id: string }>(
    'SELECT id FROM categories WHERE account_id = ? AND name = ?',
    [accountId, 'Egyéb'],
  );

  return otherCategory?.id || null;
}

// Minden email ujrakategorizalasa (pl. szabaly modositas utan)
export function recategorizeAllEmails(accountId: string) {
  const allEmails = queryAll<{
    id: string;
    from_email: string;
    subject: string;
    labels: string;
  }>(
    'SELECT id, from_email, subject, labels FROM emails WHERE account_id = ?',
    [accountId],
  );

  let updated = 0;
  for (const email of allEmails) {
    const labels = email.labels ? JSON.parse(email.labels) : [];
    const categoryId = categorizeEmail(accountId, {
      from: email.from_email || '',
      subject: email.subject || '',
      labels,
    });

    if (categoryId) {
      execute(
        'UPDATE emails SET category_id = ? WHERE id = ?',
        [categoryId, email.id],
      );
      updated++;
    }
  }

  return updated;
}
