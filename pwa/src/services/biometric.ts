/*
 * Face ID / Touch ID app lock (WebAuthn platform authenticator).
 *
 * Scope, honestly stated: this is a LOCAL gate. A device passkey is created
 * once; every launch then requires Face ID before the app UI opens and the
 * stored password is used. The server is still authenticated by the app
 * password header — the passkey never leaves the device and no signature is
 * verified server-side. It upgrades "anyone holding the unlocked phone can
 * open Tend" to "only an enrolled face/finger can".
 */

const CRED_KEY = 'tend.bio.credId';

function b64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function unb64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

/** Platform authenticator available on this device/browser? */
export async function bioAvailable(): Promise<boolean> {
  try {
    return (
      !!window.PublicKeyCredential &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    );
  } catch {
    return false;
  }
}

/** Has the user enrolled Face ID on this device? */
export function bioEnabled(): boolean {
  try {
    return !!localStorage.getItem(CRED_KEY);
  } catch {
    return false;
  }
}

/** One-time enrollment (triggers the Face ID sheet). */
export async function enrollBiometric(): Promise<boolean> {
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'Tend' }, // rp.id defaults to this origin's domain
        user: {
          id: crypto.getRandomValues(new Uint8Array(16)),
          name: 'tend',
          displayName: 'Tend',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;
    if (!cred) return false;
    localStorage.setItem(CRED_KEY, b64(cred.rawId));
    return true;
  } catch {
    return false;
  }
}

/** Prompt Face ID; true only when the ceremony succeeds. */
export async function biometricUnlock(): Promise<boolean> {
  const id = (() => {
    try {
      return localStorage.getItem(CRED_KEY);
    } catch {
      return null;
    }
  })();
  if (!id) return false;
  try {
    const res = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [
          { type: 'public-key', id: unb64(id).buffer as ArrayBuffer },
        ],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    return !!res;
  } catch {
    return false;
  }
}

/** Turn the Face ID gate off (falls back to password-only). */
export function disableBiometric(): void {
  try {
    localStorage.removeItem(CRED_KEY);
  } catch {
    /* ignore */
  }
}
