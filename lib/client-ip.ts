import { headers } from 'next/headers'

/**
 * Ermittelt die IP-Adresse des Clients hinter vertrauenswürdigen Proxys.
 * 
 * Vertrauensmodell:
 * Die Anwendung wird in einer Umgebung mit einem vorgeschalteten Reverse Proxy (z.B. Nginx/Traefik) betrieben.
 * Der Proxy hängt die IP des Verbindungspartners an den `x-forwarded-for` Header an.
 * 
 * - Bei direkten Zugriffen ohne Proxy (z.B. lokales Setup oder Bypass) darf der Client den Header nicht selbst bestimmen können.
 * - Bei einem vertrauenswürdigen Proxy-Hop (TRUSTED_PROXY_HOPS=1) ist der vorletzte Eintrag in der Liste der Client,
 *   da der Proxy den Client an die Liste anhängt, die der Client evtl. mitgeschickt hat.
 * 
 * Wenn die Kette ungültig oder zu kurz ist, wird ein stabiler Fallback ('unknown') zurückgegeben,
 * den ein Angreifer nicht manipulieren kann.
 */
export async function getClientIp(): Promise<string> {
  try {
    const headerList = await headers()
    const xForwardedFor = headerList.get('x-forwarded-for')
    
    if (!xForwardedFor) {
      // Wenn kein X-Forwarded-For Header existiert, läuft die Anfrage evtl. nicht über den Proxy
      // oder der Proxy ist falsch konfiguriert. Wir blocken Manipulation ab.
      return 'unknown'
    }

    const hopsStr = process.env.TRUSTED_PROXY_HOPS
    const trustedHops = hopsStr ? parseInt(hopsStr, 10) : 1
    
    if (isNaN(trustedHops) || trustedHops < 0) {
      console.warn('[client-ip] TRUSTED_PROXY_HOPS ist ungültig, Fallback auf unknown')
      return 'unknown'
    }

    const parts = xForwardedFor.split(',').map(part => part.trim()).filter(Boolean)
    
    if (parts.length < trustedHops) {
      // Kette zu kurz. Wenn TRUSTED_PROXY_HOPS=1 gefordert ist, aber nur 0 Hops in der Kette sind.
      // Hinweis: Wenn der Proxy IMMER einen Hop anhängt, muss die Liste >= 1 sein.
      // Wenn der Client keine eigene IP mitschickt, setzt der Proxy den Header auf "Client-IP".
      // Parts length wäre dann 1. Bei TRUSTED_PROXY_HOPS=1 ist die Client-IP an Index 0 (length - 1).
      // Wenn der Client "Fake-IP" mitschickt, setzt der Proxy "Fake-IP, Client-IP". Parts length = 2.
      // Index ist length - trustedHops.
      console.warn('[client-ip] Header-Kette zu kurz, möglicher direkter Zugriff oder Bypass', {
        xForwardedFor,
        trustedHops
      })
      return 'unknown'
    }

    const clientIp = parts[parts.length - trustedHops]
    
    if (!clientIp || clientIp.length < 3) {
      return 'unknown'
    }

    return clientIp
  } catch (error) {
    console.error('[client-ip] Unerwarteter Fehler bei IP-Ermittlung', error)
    return 'unknown'
  }
}
