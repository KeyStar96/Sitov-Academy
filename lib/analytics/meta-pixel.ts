/**
 * Meta Pixel (Facebook Pixel) Type-Safe Helper
 * Handles browser-only execution and prevents errors if fbq is blocked or not loaded.
 */

declare global {
  interface Window {
    fbq?: (
      action: 'track' | 'trackCustom' | 'init',
      eventName: string,
      params?: Record<string, unknown>
    ) => void;
  }
}

export type StandardMetaEvent =
  | 'PageView'
  | 'Lead'
  | 'CompleteRegistration'
  | 'Purchase'
  | 'SubmitApplication'
  | 'Contact'
  | 'ViewContent';

export interface MetaEventParams {
  content_name?: string;
  content_category?: string;
  content_ids?: string[];
  currency?: string;
  value?: number;
  [key: string]: unknown;
}

export function trackMetaEvent(
  eventName: StandardMetaEvent | string,
  params?: MetaEventParams
): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (typeof window.fbq === 'function') {
      if (params) {
        window.fbq('track', eventName, params);
      } else {
        window.fbq('track', eventName);
      }
    }
  } catch (err) {
    console.warn("[Meta Pixel] Tracking failed:");
  }
}
