const cheerio = require('cheerio');
const { sampleHtmlWithYale } = require('./test-utils');
const app = require('../app');

const applyReplacementLogic = ($) => {
  // Replace text nodes in body
  $('body *').contents().filter(function () {
    return this.nodeType === 3; // text node
  }).each(function () {
    const originalText = $(this).text();
    const replacedText = app.replaceYaleWithFale(originalText);
    if (originalText !== replacedText) {
      $(this).replaceWith(replacedText);
    }
  });

  // Replace title text
  const title = $('title').text();
  $('title').text(app.replaceYaleWithFale(title));
};

describe('Yale to Fale replacement logic', () => {
  test('replaces "Yale" with "Fale" in HTML text content', () => {
    const $ = cheerio.load(sampleHtmlWithYale);
    applyReplacementLogic($);

    const modifiedHtml = $.html();

    // Text content assertions
    expect(modifiedHtml).toContain('Fale University Test Page');
    expect(modifiedHtml).toContain('Welcome to Fale University');
    expect(modifiedHtml).toContain('Fale University is a private Ivy League');
    expect(modifiedHtml).toContain('Fale was founded in 1701');

    // URL and attribute checks (should not be replaced)
    expect(modifiedHtml).toContain('https://www.yale.edu/about');
    expect(modifiedHtml).toContain('mailto:info@yale.edu');
    expect(modifiedHtml).toMatch(/href="https:\/\/www\.yale\.edu\/about"/);
    expect(modifiedHtml).toContain('alt="Yale Logo"');

    // Link text should be changed
    expect(modifiedHtml).toContain('>About Fale<');
    expect(modifiedHtml).toContain('>Fale Admissions<');
  });

  test('leaves HTML unchanged when there are no Yale references', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Test Page</title></head>
        <body>
          <h1>Hello World</h1>
          <p>This is a test page with no Yale references.</p>
        </body>
      </html>
    `;

    const $ = cheerio.load(html);
    applyReplacementLogic($);

    const modifiedHtml = $.html();
    expect(modifiedHtml).toContain('<title>Test Page</title>');
    expect(modifiedHtml).toContain('<h1>Hello World</h1>');
    expect(modifiedHtml).toContain('<p>This is a test page with no Yale references.</p>');
  });

  test('handles case-insensitive replacements', () => {
    const html = `<p>YALE University, Yale College, and yale medical school are all part of the same institution.</p>`;
    const $ = cheerio.load(html);
    applyReplacementLogic($);

    const result = $('p').html();
    expect(result).toContain('FALE University, Fale College, and fale medical school');
  });
});

describe('replaceYaleWithFale function', () => {
  test('replaces "Yale" with "Fale" in various capitalizations', () => {
    expect(app.replaceYaleWithFale('Yale University')).toBe('Fale University');
    expect(app.replaceYaleWithFale('YALE UNIVERSITY')).toBe('FALE UNIVERSITY');
    expect(app.replaceYaleWithFale('yale university')).toBe('fale university');
    expect(app.replaceYaleWithFale('Welcome to Yale!')).toBe('Welcome to Fale!');
  });

  test('does not alter strings without "Yale"', () => {
    expect(app.replaceYaleWithFale('Harvard University')).toBe('Harvard University');
    expect(app.replaceYaleWithFale('')).toBe('');
    expect(app.replaceYaleWithFale('No references here.')).toBe('No references here.');
  });

  test('handles mixed content including email and domain references', () => {
    expect(app.replaceYaleWithFale('Yale and Harvard are Ivy League')).toBe('Fale and Harvard are Ivy League');
    expect(app.replaceYaleWithFale('Contact: info@yale.edu or visit yale.edu')).toBe('Contact: info@fale.edu or visit fale.edu');
  });
});