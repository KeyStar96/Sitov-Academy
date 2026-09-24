/**
 * Meta Pixel (Facebook Pixel) Type-Safe Helper
 *
 * Das Pixel wird ausschließlich nach Marketing-Einwilligung geladen
 * (`components/analytics/ConsentManager.tsx`, `next/script` afterInteractive).
 * Ohne Einwilligung verlässt kein Request den Browser in Richtung Meta.
 */
import { hasMarketingConsent } from '@/lib/analytics/consent'

declare global {
  interface Window {
    fbq?: (
      action: 'track' | 'trackCustom' | 'init' | 'consent',
      eventName: string,
      params?: Record<string, unknown>
    ) => void;
  }
}

export const META_PIXEL_ID = '1550332886706723';

/** Offizieller Meta-Bootstrap; lädt `fbevents.js` und zählt den ersten Seitenaufruf. */
export const META_PIXEL_BOOTSTRAP = `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('consent', 'grant');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');`;

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

  // Ohne Marketing-Einwilligung wird nichts gesendet – auch nicht, wenn ein
  // bereits geladenes Pixel nach einem Widerruf noch im Speicher liegt.
  if (!hasMarketingConsent()) {
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
  } catch {
    console.warn("[Meta Pixel] Tracking failed:");
  }
}

/** Widerruf in einer laufenden Seite: Das geladene Pixel sendet nichts mehr. */
export function revokeMetaPixel(): void {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;
  try {
    window.fbq('consent', 'revoke');
  } catch {
    console.warn("[Meta Pixel] Revoke failed:");
  }
}
