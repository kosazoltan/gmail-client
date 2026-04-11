import { describe, it, expect } from 'vitest';

// We test the convertSql function which is internal.
// Access it by importing the module and testing through its effect on queryOne/queryAll.
// Since convertSql is not exported, we test the pattern matching directly:

function convertSql(sql: string): string {
  let i = 0;
  let result = sql.replace(/\?/g, () => `$${++i}`);
  result = result.replace(/\bNOT\s+LIKE\s+(\$\d+)\s+COLLATE\s+NOCASE/gi, 'NOT ILIKE $1');
  result = result.replace(/\bLIKE\s+(\$\d+)\s+COLLATE\s+NOCASE/gi, 'ILIKE $1');
  result = result.replace(/=\s+(\$\d+)\s+COLLATE\s+NOCASE/gi, 'ILIKE $1');
  result = result.replace(/\s+COLLATE\s+NOCASE/gi, '');
  return result;
}

describe('convertSql', () => {
  it('replaces ? placeholders with $1, $2, etc.', () => {
    expect(convertSql('SELECT * FROM t WHERE a = ? AND b = ?')).toBe(
      'SELECT * FROM t WHERE a = $1 AND b = $2',
    );
  });

  it('handles zero placeholders', () => {
    expect(convertSql('SELECT 1')).toBe('SELECT 1');
  });

  it('converts LIKE ? COLLATE NOCASE to ILIKE', () => {
    const input = 'SELECT * FROM t WHERE name LIKE ? COLLATE NOCASE';
    expect(convertSql(input)).toBe('SELECT * FROM t WHERE name ILIKE $1');
  });

  it('converts NOT LIKE ? COLLATE NOCASE to NOT ILIKE', () => {
    const input = 'SELECT * FROM t WHERE name NOT LIKE ? COLLATE NOCASE';
    expect(convertSql(input)).toBe('SELECT * FROM t WHERE name NOT ILIKE $1');
  });

  it('converts = ? COLLATE NOCASE to ILIKE', () => {
    const input = 'SELECT * FROM t WHERE email = ? COLLATE NOCASE';
    expect(convertSql(input)).toBe('SELECT * FROM t WHERE email ILIKE $1');
  });

  it('strips remaining COLLATE NOCASE', () => {
    const input = 'SELECT * FROM t ORDER BY name COLLATE NOCASE';
    expect(convertSql(input)).toBe('SELECT * FROM t ORDER BY name');
  });

  it('handles multiple conversions in one query', () => {
    const input =
      'SELECT * FROM t WHERE a LIKE ? COLLATE NOCASE AND b = ? AND c NOT LIKE ? COLLATE NOCASE';
    expect(convertSql(input)).toBe(
      'SELECT * FROM t WHERE a ILIKE $1 AND b = $2 AND c NOT ILIKE $3',
    );
  });

  it('handles empty string', () => {
    expect(convertSql('')).toBe('');
  });
});
