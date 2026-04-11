import { describe, it, expect } from 'vitest';
import { sanitizeEmailBodyHtml } from './sanitize-email-html';

describe('sanitizeEmailBodyHtml', () => {
  it('preserves safe HTML tags', () => {
    const input = '<p>Hello <strong>world</strong></p>';
    expect(sanitizeEmailBodyHtml(input)).toBe(input);
  });

  it('preserves links with href', () => {
    const input = '<a href="https://example.com" target="_blank">Link</a>';
    const result = sanitizeEmailBodyHtml(input);
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('target="_blank"');
  });

  it('preserves images with src', () => {
    const input = '<img src="https://example.com/img.png" alt="Image" width="100" height="50">';
    const result = sanitizeEmailBodyHtml(input);
    expect(result).toContain('src="https://example.com/img.png"');
    expect(result).toContain('alt="Image"');
  });

  it('preserves table elements', () => {
    const input =
      '<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Cell</td></tr></tbody></table>';
    const result = sanitizeEmailBodyHtml(input);
    expect(result).toContain('<table>');
    expect(result).toContain('<th>Header</th>');
    expect(result).toContain('<td>Cell</td>');
  });

  it('strips script tags', () => {
    const input = '<p>Hello</p><script>alert("xss")</script>';
    const result = sanitizeEmailBodyHtml(input);
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert');
    expect(result).toContain('<p>Hello</p>');
  });

  it('strips iframe tags', () => {
    const input = '<iframe src="https://evil.com"></iframe><p>Safe</p>';
    const result = sanitizeEmailBodyHtml(input);
    expect(result).not.toContain('<iframe');
    expect(result).toContain('<p>Safe</p>');
  });

  it('strips form elements', () => {
    const input = '<form action="/steal"><input type="text"><button>Submit</button></form>';
    const result = sanitizeEmailBodyHtml(input);
    expect(result).not.toContain('<form');
    expect(result).not.toContain('<input');
    expect(result).not.toContain('<button');
  });

  it('strips event handlers', () => {
    const input = '<p onclick="alert(1)">Click me</p>';
    const result = sanitizeEmailBodyHtml(input);
    expect(result).not.toContain('onclick');
    expect(result).toContain('<p>Click me</p>');
  });

  it('strips javascript: protocol in links', () => {
    const input = '<a href="javascript:alert(1)">XSS</a>';
    const result = sanitizeEmailBodyHtml(input);
    expect(result).not.toContain('javascript:');
  });

  it('preserves inline styles', () => {
    const input = '<p style="color: red; font-size: 14px;">Styled</p>';
    const result = sanitizeEmailBodyHtml(input);
    expect(result).toContain('style=');
    expect(result).toContain('color');
  });

  it('handles empty string', () => {
    expect(sanitizeEmailBodyHtml('')).toBe('');
  });

  it('strips data attributes', () => {
    const input = '<div data-custom="value">Content</div>';
    const result = sanitizeEmailBodyHtml(input);
    expect(result).not.toContain('data-custom');
  });

  it('strips object/embed tags', () => {
    const input = '<object data="flash.swf"></object><embed src="flash.swf">';
    const result = sanitizeEmailBodyHtml(input);
    expect(result).not.toContain('<object');
    expect(result).not.toContain('<embed');
  });
});
