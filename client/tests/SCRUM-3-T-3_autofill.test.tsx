import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ListingForm from '../src/components/ListingForm';

const VALID_URL = 'https://example.com/rentals/sunny-apartment-1';

function renderForm(onSubmit = vi.fn()) {
  render(<ListingForm onSubmit={onSubmit} submitting={false} submitError={null} />);
  return { user: userEvent.setup(), onSubmit };
}

function mockFetchSuccess(data: unknown, ok = true, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok,
    status,
    json: async () => data,
  } as Response);
}

describe('SCRUM-3-T-3: ListingForm autofill integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('SCRUM-3-T-3 [Criterion 1] rejects invalid or non-HTTP URL, focuses input, and sends no request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { user } = renderForm();

    const linkInput = screen.getByLabelText('Listing link');
    const autofillButton = screen.getByRole('button', { name: 'Autofill' });

    // Empty input
    await user.click(autofillButton);
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the listing link.');
    expect(linkInput).toHaveFocus();
    expect(fetchSpy).not.toHaveBeenCalled();

    // Non-HTTP/HTTPS protocol (ftp)
    await user.type(linkInput, 'ftp://example.com/listing');
    await user.click(autofillButton);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a full link that starts with http:// or https://.',
    );
    expect(linkInput).toHaveFocus();
    expect(fetchSpy).not.toHaveBeenCalled();

    // Not a valid URL
    await user.clear(linkInput);
    await user.type(linkInput, 'not-a-valid-url');
    await user.click(autofillButton);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a full link that starts with http:// or https://.',
    );
    expect(linkInput).toHaveFocus();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('SCRUM-3-T-3 [Criterion 2] sends single POST to /api/scrape with url and 10s timeout signal', async () => {
    const fetchSpy = mockFetchSuccess({
      success: true,
      data: {
        title: 'Sunny Studio',
        rent: 1800,
        address: '100 Ocean St, Santa Cruz, CA',
        description: 'Hardwood floors throughout.',
        photos: [],
      },
    });

    const { user } = renderForm();
    await user.type(screen.getByLabelText('Listing link'), VALID_URL);
    await user.click(screen.getByRole('button', { name: 'Autofill' }));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, options] = fetchSpy.mock.calls[0];
    expect(String(calledUrl)).toMatch(/\/api\/scrape$/);
    expect(options).toMatchObject({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: VALID_URL }),
    });
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });

  it('SCRUM-3-T-3 [Criterion 3] sets button text to Reading… and disables button while request is in flight', async () => {
    let resolveFetch!: (value: Response) => void;
    const pendingPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(() => pendingPromise);

    const { user } = renderForm();
    await user.type(screen.getByLabelText('Listing link'), VALID_URL);
    await user.click(screen.getByRole('button', { name: 'Autofill' }));

    const button = screen.getByRole('button', { name: 'Reading…' });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();

    // Resolve the pending fetch
    resolveFetch({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          title: 'Studio',
          rent: 1500,
          address: 'Santa Cruz, CA',
          description: 'Cozy',
          photos: [],
        },
      }),
    } as Response);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Autofill' })).toBeEnabled();
    });
  });

  it('SCRUM-3-T-3 [Criterion 4] populates rent, location, combined description, and shows success banner', async () => {
    mockFetchSuccess({
      success: true,
      data: {
        title: 'Spacious 2BR Apt',
        rent: 2800,
        address: '220 Pacific Ave, Santa Cruz, CA',
        description: 'Available for immediate move-in. Washer/dryer in unit.',
        photos: ['https://example.com/p1.jpg'],
      },
    });

    const { user } = renderForm();
    await user.type(screen.getByLabelText('Listing link'), VALID_URL);
    await user.click(screen.getByRole('button', { name: 'Autofill' }));

    expect(await screen.findByText('Details filled. Please review below.')).toBeInTheDocument();
    expect(screen.getByLabelText('Monthly rent')).toHaveValue('2800');
    expect(screen.getByLabelText('City or address')).toHaveValue('220 Pacific Ave, Santa Cruz, CA');
    expect(screen.getByLabelText('Description and messages (optional)')).toHaveValue(
      'Spacious 2BR Apt\n\nAvailable for immediate move-in. Washer/dryer in unit.',
    );
  });

  it('SCRUM-3-T-3 [Criterion 5] preserves user-typed inputs and keeps autofilled fields editable', async () => {
    mockFetchSuccess({
      success: true,
      data: {
        title: 'Downtown Loft',
        rent: 3000,
        address: '500 Front St, Santa Cruz, CA',
        description: 'High ceilings and lots of light.',
        photos: [],
      },
    });

    const { user } = renderForm();
    // Pre-fill fields prior to autofill
    await user.type(screen.getByLabelText('Monthly rent'), '2400');
    await user.type(
      screen.getByLabelText('Description and messages (optional)'),
      'Notes from landlord conversation.',
    );

    await user.type(screen.getByLabelText('Listing link'), VALID_URL);
    await user.click(screen.getByRole('button', { name: 'Autofill' }));

    expect(await screen.findByText('Details filled. Please review below.')).toBeInTheDocument();

    // Rent and description should NOT be overwritten
    expect(screen.getByLabelText('Monthly rent')).toHaveValue('2400');
    expect(screen.getByLabelText('Description and messages (optional)')).toHaveValue(
      'Notes from landlord conversation.',
    );
    // Blank location field was populated
    expect(screen.getByLabelText('City or address')).toHaveValue('500 Front St, Santa Cruz, CA');

    // Autofilled fields remain editable
    const locationInput = screen.getByLabelText('City or address');
    await user.clear(locationInput);
    await user.type(locationInput, 'Capitola, CA');
    expect(locationInput).toHaveValue('Capitola, CA');

    const rentInput = screen.getByLabelText('Monthly rent');
    await user.clear(rentInput);
    await user.type(rentInput, '2600');
    expect(rentInput).toHaveValue('2600');
  });

  it('SCRUM-3-T-3 [Criterion 6] displays appropriate banner on unreadable scrape or server/timeout error without crashing', async () => {
    const { user } = renderForm();
    const linkInput = screen.getByLabelText('Listing link');
    const autofillButton = () => screen.getByRole('button', { name: 'Autofill' });

    // 6A: Unreadable scrape (success: false reported by backend)
    const fetchSpy = mockFetchSuccess({
      success: false,
      data: null,
      message: 'Failed to scrape listing details',
    });

    await user.type(linkInput, VALID_URL);
    await user.click(autofillButton());

    expect(
      await screen.findByText("Couldn't read link. Please enter details below."),
    ).toBeInTheDocument();
    expect(autofillButton()).toBeEnabled();

    // 6B: Empty scrape data (all fields null or missing)
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          title: null,
          rent: null,
          address: null,
          description: null,
          photos: [],
        },
      }),
    } as Response);

    await user.click(autofillButton());
    expect(
      await screen.findByText("Couldn't read link. Please enter details below."),
    ).toBeInTheDocument();

    // 6C: HTTP 500 server error
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal Server Error' }),
    } as Response);

    await user.click(autofillButton());
    expect(await screen.findByText('Server error. Please try again.')).toBeInTheDocument();
    expect(autofillButton()).toBeEnabled();

    // 6D: Network failure (TypeError)
    fetchSpy.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await user.click(autofillButton());
    expect(await screen.findByText('Server error. Please try again.')).toBeInTheDocument();
    expect(autofillButton()).toBeEnabled();

    // 6E: Request timeout (AbortError / TimeoutError)
    fetchSpy.mockRejectedValueOnce(
      new DOMException('The operation was aborted due to timeout', 'TimeoutError'),
    );
    await user.click(autofillButton());
    expect(await screen.findByText('Server error. Please try again.')).toBeInTheDocument();
    expect(autofillButton()).toBeEnabled();
  });

  it('SCRUM-3-T-3 handles partial field extraction with only title or only description', async () => {
    // Only title present
    const fetchSpy = mockFetchSuccess({
      success: true,
      data: {
        title: 'Only Title Given',
        rent: null,
        address: null,
        description: null,
        photos: [],
      },
    });

    const { user } = renderForm();
    await user.type(screen.getByLabelText('Listing link'), VALID_URL);
    await user.click(screen.getByRole('button', { name: 'Autofill' }));

    expect(await screen.findByText('Details filled. Please review below.')).toBeInTheDocument();
    expect(screen.getByLabelText('Description and messages (optional)')).toHaveValue(
      'Only Title Given',
    );
    expect(screen.getByLabelText('Monthly rent')).toHaveValue('');
    expect(screen.getByLabelText('City or address')).toHaveValue('');

    // Only description present
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          title: null,
          rent: 1950,
          address: 'Santa Cruz, CA',
          description: 'Only description here.',
          photos: [],
        },
      }),
    } as Response);

    const descInput = screen.getByLabelText('Description and messages (optional)');
    await user.clear(descInput);
    await user.click(screen.getByRole('button', { name: 'Autofill' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Description and messages (optional)')).toHaveValue(
        'Only description here.',
      );
    });
    expect(screen.getByLabelText('Monthly rent')).toHaveValue('1950');
    expect(screen.getByLabelText('City or address')).toHaveValue('Santa Cruz, CA');
  });
});
