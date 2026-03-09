/**
 * Public API helper - fetches event data from the public events endpoint.
 * The backend resolves flyer_key to presigned download URLs automatically.
 */

import { createClient } from '@metagptx/web-sdk';

const client = createClient();

/**
 * Sort events by date descending (newest first).
 */
function sortEventsByDateDesc(events: any[]): any[] {
  return events.slice().sort((a, b) => {
    const dateA = a.date || '0000-00-00';
    const dateB = b.date || '0000-00-00';
    if (dateB > dateA) return 1;
    if (dateB < dateA) return -1;
    return 0;
  });
}

export async function fetchPublicEvents(params?: {
  limit?: number;
  sort?: string;
  query?: Record<string, any>;
}): Promise<any[]> {
  let items: any[] = [];
  const statusFilter = params?.query?.status;

  // Strategy 1: Use the custom public endpoint (no auth required)
  try {
    const queryParams: Record<string, any> = {};
    if (params?.limit) queryParams.limit = params.limit;
    if (params?.sort) queryParams.sort = params.sort;
    if (statusFilter) queryParams.status = statusFilter;

    const response = await client.apiCall.invoke({
      url: '/api/v1/public/events',
      method: 'GET',
      data: queryParams,
    });
    const responseItems = response?.data?.items;
    if (Array.isArray(responseItems) && responseItems.length > 0) {
      items = responseItems;
    }
  } catch (err) {
    console.warn('[publicApi] Strategy 1 failed:', err);
  }

  // Strategy 2: Native fetch fallback
  if (items.length === 0) {
    try {
      const queryParams = new URLSearchParams();
      if (params?.limit) queryParams.set('limit', String(params.limit));
      if (params?.sort) queryParams.set('sort', params.sort);
      if (statusFilter) queryParams.set('status', statusFilter);

      const response = await fetch(`/api/v1/public/events?${queryParams.toString()}`);
      if (response.ok) {
        const data = await response.json();
        const responseItems = data?.items;
        if (Array.isArray(responseItems) && responseItems.length > 0) {
          items = responseItems;
        }
      }
    } catch (fetchErr) {
      console.warn('[publicApi] Strategy 2 failed:', fetchErr);
    }
  }

  // flyer_url is already resolved by the backend - no additional resolution needed
  return sortEventsByDateDesc(items);
}

/**
 * Get flyer URL for an event - already resolved by the backend API.
 */
export async function fetchPublicFlyerUrl(
  event: any,
): Promise<string | null> {
  if (typeof event === 'object' && event?.flyer_url) {
    return event.flyer_url;
  }
  return null;
}