import { inject } from '@vercel/analytics';

/**
 * Vercel Web Analytics on the website: anonymous page views, no cookies. Note pages are reported as /note/[id]
 * so it never records which note someone opened.
 */
export function startAnalytics() {
  inject({
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    beforeSend: (event) => ({ ...event, url: event.url.replace(/\/note\/[^/?#]+/, '/note/[id]') }),
  });
}
