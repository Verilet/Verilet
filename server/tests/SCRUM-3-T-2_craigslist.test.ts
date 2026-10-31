import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('SCRUM-3-T-2 Dedicated Craigslist Scraper and Domain Router', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Criterion 1
  it('SCRUM-3-T-2 extracts numeric rent from Craigslist .price selector', async () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Craigslist Listing</title></head>
        <body>
          <h1 class="postingtitle">
            <span class="price">$2,800</span>
            <span id="titletextonly">2BR Flat in Mission</span>
          </h1>
          <div class="mapaddress">
            123 Mission St
            <small>(<a target="_blank" href="https://maps.google.com">google map</a>)</small>
          </div>
        </body>
      </html>
    `;

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      text: async () => mockHtml,
    } as Response);

    const res = await request(app).post('/api/scrape').send({
      url: 'https://sfbay.craigslist.org/sfc/apa/d/san-francisco-2br-flat/1234567890.html',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.rent).toBe(2800);
    expect(res.body.data.title).toBe('2BR Flat in Mission');
    expect(res.body.data.address).toBe('123 Mission St');
  });

  // Criterion 2
  it('SCRUM-3-T-2 extracts title and clean description from Craigslist DOM', async () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Craigslist Listing</title></head>
        <body>
          <h1 class="postingtitle">
            <span id="titletextonly">Sunny 1BR Apartment near Beach</span>
            <span class="postingtitletext"><small> (Westside)</small></span>
          </h1>
          <section id="postingbody">
            <div class="print-information print-qrcode-container">
              QR Code Link to This Post
            </div>
            Spacious 1 bedroom with updated kitchen.<br>Hard wood floors and great natural light.
          </section>
        </body>
      </html>
    `;

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      text: async () => mockHtml,
    } as Response);

    const res = await request(app)
      .post('/api/scrape')
      .send({ url: 'https://santacruz.craigslist.org/apa/d/santa-cruz-sunny-1br/9876543210.html' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Sunny 1BR Apartment near Beach');
    expect(res.body.data.address).toBe('Westside');
    expect(res.body.data.description).not.toContain('QR Code Link to This Post');
    expect(res.body.data.description).toContain('Spacious 1 bedroom with updated kitchen.');
    expect(res.body.data.description).toContain('Hard wood floors and great natural light.');
  });

  // Criterion 3
  it('SCRUM-3-T-2 extracts gallery photos from Craigslist #thumbs', async () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Craigslist Listing</title></head>
        <body>
          <h1 class="postingtitle"><span id="titletextonly">Cozy Studio</span></h1>
          <div id="thumbs">
            <a href="https://images.craigslist.org/00101_image1_600x450.jpg" class="thumb">
              <img src="https://images.craigslist.org/00101_image1_50x50c.jpg" alt="1" />
            </a>
            <a href="/images/00202_image2_600x450.jpg" class="thumb">
              <img src="/images/00202_image2_50x50c.jpg" alt="2" />
            </a>
          </div>
        </body>
      </html>
    `;

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      text: async () => mockHtml,
    } as Response);

    const res = await request(app)
      .post('/api/scrape')
      .send({ url: 'https://sfbay.craigslist.org/apa/d/studio/1111222233.html' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.photos).toEqual([
      'https://images.craigslist.org/00101_image1_600x450.jpg',
      'https://sfbay.craigslist.org/images/00202_image2_600x450.jpg',
    ]);
  });

  // Criterion 4
  it('SCRUM-3-T-2 falls back to Schema.org and OpenGraph when Craigslist DOM lacks selectors', async () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Minimal Craigslist Listing</title>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Apartment",
            "name": "Fallback Apartment from JSON-LD",
            "description": "Description in Schema.org JSON-LD.",
            "offers": {
              "@type": "Offer",
              "price": 3100
            },
            "address": "123 Ocean St, Santa Cruz, CA"
          }
          </script>
          <meta property="og:image" content="https://example.com/fallback-photo.jpg" />
        </head>
        <body>
          <!-- Missing standard Craigslist DOM elements like .price, #postingbody, etc. -->
          <div>Plain body content</div>
        </body>
      </html>
    `;

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      text: async () => mockHtml,
    } as Response);

    const res = await request(app)
      .post('/api/scrape')
      .send({ url: 'https://sfbay.craigslist.org/apa/d/minimal/5555555555.html' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Fallback Apartment from JSON-LD');
    expect(res.body.data.rent).toBe(3100);
    expect(res.body.data.address).toBe('123 Ocean St, Santa Cruz, CA');
    expect(res.body.data.description).toBe('Description in Schema.org JSON-LD.');
    expect(res.body.data.photos).toContain('https://example.com/fallback-photo.jpg');
  });

  // Criterion 5
  it('SCRUM-3-T-2 delegates non-Craigslist domains to generic fallback pipeline', async () => {
    const mockZillowHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Zillow Listing</title>
          <meta property="og:title" content="Modern Condo on Zillow" />
          <meta property="og:description" content="Stunning views and pool." />
          <meta property="og:image" content="https://zillow.com/condo.jpg" />
        </head>
        <body>
          <div class="zillow-custom-class">Not parsed by craigslist parser</div>
        </body>
      </html>
    `;

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      text: async () => mockZillowHtml,
    } as Response);

    const res = await request(app)
      .post('/api/scrape')
      .send({ url: 'https://www.zillow.com/homedetails/123456_zpid/' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({
      title: 'Modern Condo on Zillow',
      rent: null,
      address: null,
      description: 'Stunning views and pool.',
      photos: ['https://zillow.com/condo.jpg'],
    });
  });
});
