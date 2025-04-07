const request = require('supertest');
const nock = require('nock');
const express = require('express');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const { sampleHtmlWithYale } = require('./test-utils');

// Set up Express app for testing
const testApp = express();
testApp.use(express.json());
testApp.use(express.urlencoded({ extended: true }));

// Define test route
testApp.post('/fetch', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    // Replace "Yale" with "Fale" in text nodes
    $('body *').contents().filter(function () {
      return this.nodeType === 3; // Text node
    }).each(function () {
      const original = $(this).text();
      const modified = original.replace(/Yale/g, 'Fale').replace(/yale/g, 'fale');
      if (original !== modified) {
        $(this).replaceWith(modified);
      }
    });

    // Replace title text
    const updatedTitle = $('title').text().replace(/Yale/g, 'Fale').replace(/yale/g, 'fale');
    $('title').text(updatedTitle);

    return res.json({
      success: true,
      content: $.html(),
      title: updatedTitle,
      originalUrl: url
    });
  } catch (error) {
    return res.status(500).json({
      error: `Failed to fetch content: ${error.message}`
    });
  }
});

// Tests
describe('POST /fetch API', () => {
  beforeAll(() => {
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');
  });

  afterAll(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  test('returns 400 if no URL is provided', async () => {
    const res = await request(testApp).post('/fetch').send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('URL is required');
  });

  test('replaces "Yale" with "Fale" in content but not URLs', async () => {
    nock('https://example.com')
      .get('/')
      .reply(200, sampleHtmlWithYale);

    const res = await request(testApp).post('/fetch').send({ url: 'https://example.com/' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.title).toBe('Fale University Test Page');
    expect(res.body.content).toContain('Welcome to Fale University');
    expect(res.body.content).toContain('https://www.yale.edu/about'); // URL unchanged
    expect(res.body.content).toContain('>About Fale<'); // Link text changed
  });

  test('handles external site errors gracefully', async () => {
    nock('https://error-site.com')
      .get('/')
      .replyWithError('Connection refused');

    const res = await request(testApp).post('/fetch').send({ url: 'https://error-site.com/' });

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toContain('Failed to fetch content');
  });
});