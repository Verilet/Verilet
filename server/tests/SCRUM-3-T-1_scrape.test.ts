import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('SCRUM-3-T-1 Scrape Endpoint', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Criterion 1
  it('SCRUM-3-T-1 rejects non-HTTP or empty URL with 400', async () => {
    // Missing URL in body
    const resMissing = await request(app).post('/api/scrape').send({});
    expect(resMissing.status).toBe(400);
    expect(resMissing.body).toEqual({ error: 'Invalid listing URL' });

    // Empty string URL
    const resEmpty = await request(app).post('/api/scrape').send({ url: '' });
    expect(resEmpty.status).toBe(400);
    expect(resEmpty.body).toEqual({ error: 'Invalid listing URL' });

    // Malformed string (not a URL)
    const resBad = await request(app).post('/api/scrape').send({ url: 'not-a-url' });
    expect(resBad.status).toBe(400);
    expect(resBad.body).toEqual({ error: 'Invalid listing URL' });

    // Non-HTTP protocol
    const resFtp = await request(app).post('/api/scrape').send({ url: 'ftp://bad' });
    expect(resFtp.status).toBe(400);
    expect(resFtp.body).toEqual({ error: 'Invalid listing URL' });

    // SSRF / Loopback blocking
    const resLocalhost = await request(app)
      .post('/api/scrape')
      .send({ url: 'http://localhost:5000/internal' });
    expect(resLocalhost.status).toBe(400);
    expect(resLocalhost.body).toEqual({ error: 'Invalid listing URL' });

    const resLoopback = await request(app)
      .post('/api/scrape')
      .send({ url: 'http://127.0.0.1:8080/secrets' });
    expect(resLoopback.status).toBe(400);
    expect(resLoopback.body).toEqual({ error: 'Invalid listing URL' });
  });

  // Criterion 2
  it('SCRUM-3-T-1 extracts Schema.org JSON-LD property details', async () => {
    const mockJsonLdHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Apartment",
            "name": "2BR Apartment near UCSC",
            "description": "Cozy sunny apartment close to campus and bus lines.",
            "offers": {
              "@type": "Offer",
              "price": 2800
            },
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "456 High St",
              "addressLocality": "Santa Cruz",
              "addressRegion": "CA"
            },
            "image": [
              "https://example.com/photos/living-room.jpg",
              "https://example.com/photos/bedroom.jpg"
            ]
          }
          </script>
        </head>
        <body><h1>Listing Details</h1></body>
      </html>
    `;

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => mockJsonLdHtml,
    } as Response);

    const res = await request(app)
      .post('/api/scrape')
      .send({ url: 'https://example.com/listing/123' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: {
        title: '2BR Apartment near UCSC',
        rent: 2800,
        address: '456 High St, Santa Cruz, CA',
        description: 'Cozy sunny apartment close to campus and bus lines.',
        photos: [
          'https://example.com/photos/living-room.jpg',
          'https://example.com/photos/bedroom.jpg',
        ],
      },
    });
  });

  // Criterion 3
  it('SCRUM-3-T-1 falls back to OpenGraph meta tags when JSON-LD is absent', async () => {
    const mockOpenGraphHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Fallback Page Title</title>
          <meta property="og:title" content="Studio on Mission St" />
          <meta property="og:description" content="Charming private studio with utilities included." />
          <meta property="og:image" content="/photos/studio.jpg" />
        </head>
        <body><h1>Social Listing</h1></body>
      </html>
    `;

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => mockOpenGraphHtml,
    } as Response);

    const res = await request(app)
      .post('/api/scrape')
      .send({ url: 'https://example.com/marketplace/item/999' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: {
        title: 'Studio on Mission St',
        rent: null,
        address: null,
        description: 'Charming private studio with utilities included.',
        photos: ['https://example.com/photos/studio.jpg'],
      },
    });
  });

  // Criterion 4
  it('SCRUM-3-T-1 catches timeouts and HTTP error codes gracefully', async () => {
    // Test simulated 5000ms timeout / network drop
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
      new Error('The operation was aborted due to timeout'),
    );

    const resTimeout = await request(app)
      .post('/api/scrape')
      .send({ url: 'https://slow-site.com/listing' });

    expect(resTimeout.status).toBe(200);
    expect(resTimeout.body).toEqual({
      success: false,
      data: null,
      message: 'Failed to scrape listing details',
    });

    // Test 403 Forbidden anti-bot response
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    } as Response);

    const resForbidden = await request(app)
      .post('/api/scrape')
      .send({ url: 'https://antibot-site.com/blocked' });

    expect(resForbidden.status).toBe(200);
    expect(resForbidden.body).toEqual({
      success: false,
      data: null,
      message: 'Failed to scrape listing details',
    });

    // Test non-HTML content-type
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'video/mp4' }),
      text: async () => 'binary video data',
    } as unknown as Response);

    const resBinary = await request(app)
      .post('/api/scrape')
      .send({ url: 'https://example.com/huge-video.mp4' });

    expect(resBinary.status).toBe(200);
    expect(resBinary.body).toEqual({
      success: false,
      data: null,
      message: 'Failed to scrape listing details',
    });
  });

  // Criterion 5
  it('SCRUM-3-T-1 server remains healthy and serves requests after failed scrape', async () => {
    // Failure on network error
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Connection reset by peer'));

    const resFail = await request(app)
      .post('/api/scrape')
      .send({ url: 'https://crashing-site.com' });

    expect(resFail.status).toBe(200);
    expect(resFail.body.success).toBe(false);

    // Succeeds with valid listing
    const mockSuccessHtml = `
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@type": "Apartment",
            "name": "Reliable 1BR",
            "offers": { "price": 2000 }
          }
          </script>
        </head>
      </html>
    `;

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => mockSuccessHtml,
    } as Response);

    const resSuccess = await request(app)
      .post('/api/scrape')
      .send({ url: 'https://working-site.com/apartment' });

    expect(resSuccess.status).toBe(200);
    expect(resSuccess.body.success).toBe(true);
    expect(resSuccess.body.data.title).toBe('Reliable 1BR');
    expect(resSuccess.body.data.rent).toBe(2000);
  });
});
