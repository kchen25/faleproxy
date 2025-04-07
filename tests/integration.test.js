const cheerio = require('cheerio');
const { sampleHtmlWithYale } = require('./test-utils');
const nock = require('nock');
const request = require('supertest');
const app = require('../app');

describe('Integration Tests', () => {
  const originalConsoleError = console.error;

  beforeAll(() => {
    // Disable external network requests, allow localhost
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');

    // Suppress console.error during test runs
    console.error = jest.fn();
  });

  afterAll(() => {
    // Restore console.error and network settings
    console.error = originalConsoleError;
    nock.cleanAll();
    nock.enableNetConnect();
  });

  test('replaces "Yale" with "Fale" in fetched HTML content', async () => {
    // Mock response from example.com
    nock('https://example.com')
      .get('/')
      .reply(200, sampleHtmlWithYale);

    const response = await request(app)
      .post('/fetch')
      .send({ url: 'https://example.com/' })
      .expect(200);

    expect(response.body.success).toBe(true);

    const $ = cheerio.load(response.body.content);

    // Text content checks
    expect($('title').text()).toBe('Fale University Test Page');
    expect($('h1').text()).toBe('Welcome to Fale University');
    expect($('p').first().text()).toContain('Fale University is a private');

    // Ensure URLs are preserved
    const hasYaleUrl = $('a')
      .toArray()
      .some((el) => $(el).attr('href')?.includes('yale.edu'));

    expect(hasYaleUrl).toBe(true);

    // Link text is updated
    expect($('a').first().text()).toBe('About Fale');
  });

  test('returns 500 for invalid URLs', async () => {
    await request(app)
      .post('/fetch')
      .send({ url: 'not-a-valid-url' })
      .expect(500);

    expect(console.error).toHaveBeenCalledWith(
      'Error fetching URL:',
      expect.stringContaining('Disallowed net connect')
    );
  });

  test('returns 400 when URL parameter is missing', async () => {
    const response = await request(app)
      .post('/fetch')
      .send({})
      .expect(400);

    expect(response.body.error).toBe('URL is required');
  });
});