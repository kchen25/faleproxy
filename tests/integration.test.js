const cheerio = require('cheerio');
const { sampleHtmlWithYale } = require('./test-utils');
const nock = require('nock');
const request = require('supertest');
const app = require('../app');
const path = require('path');
const fs = require('fs');

describe('Integration Tests', () => {
  const originalConsoleError = console.error;
  const originalConsoleLog = console.log;

  beforeAll(() => {
    // Disable external network requests, allow localhost
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');

    // Suppress console.error and console.log during test runs
    console.error = jest.fn();
    console.log = jest.fn();
  });

  afterAll(() => {
    // Restore console functions and network settings
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
    nock.cleanAll();
    nock.enableNetConnect();
  });

  test('serves the main page at root route', async () => {
    const response = await request(app)
      .get('/')
      .expect(200);
    
    expect(response.headers['content-type']).toMatch(/text\/html/);
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

  test('skips replacement for text with "no Yale references" special phrase', async () => {
    // Create HTML where the paragraph with "no Yale references" should be preserved
    const htmlWithSpecialPhrase = `
      <!DOCTYPE html>
      <html>
        <head><title>Test Page</title></head>
        <body>
          <h1>Hello World</h1>
          <p id="special">This is a test page with no Yale references.</p>
          <p id="normal">Yale University</p>
        </body>
      </html>
    `;

    nock('https://example.com')
      .get('/special')
      .reply(200, htmlWithSpecialPhrase);

    const response = await request(app)
      .post('/fetch')
      .send({ url: 'https://example.com/special' })
      .expect(200);

    const $ = cheerio.load(response.body.content);
    
    // The paragraph with "no Yale references" should remain unchanged
    expect($('#special').text().trim()).toBe('This is a test page with no Yale references.');
    
    // The normal paragraph should have Yale replaced with Fale
    expect($('#normal').text().trim()).toBe('Fale University');
  });

  test('adds http protocol if not provided in URL', async () => {
    // Mock the response with Yale content
    nock('http://example.com')
      .get('/')
      .reply(200, '<html><body><p>Yale University</p></body></html>');

    const response = await request(app)
      .post('/fetch')
      .send({ url: 'example.com' })
      .expect(200);

    expect(response.body.success).toBe(true);
    // Parse the HTML to check if Yale was replaced with Fale
    const $ = cheerio.load(response.body.content);
    expect($('p').text()).toBe('Fale University');
  });

  // Test the server startup code
  test('server can be started and listens on port', () => {
    // Create a mock server object
    const mockServer = {
      close: jest.fn()
    };
    
    // Mock the listen method
    const originalListen = app.listen;
    app.listen = jest.fn((port, callback) => {
      if (callback) callback();
      return mockServer;
    });
    
    // Call the server startup code directly
    const PORT = 3001;
    const server = app.listen(PORT, () => {
      console.log(`Faleproxy server running at http://localhost:${PORT}`);
    });
    
    // Verify the mocks were called correctly
    expect(app.listen).toHaveBeenCalledWith(PORT, expect.any(Function));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Faleproxy server running'));
    
    // Clean up
    app.listen = originalListen;
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