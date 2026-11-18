/** Bloqueio do app neste aparelho. O PIN nunca é guardado: só um hash PBKDF2 com sal aleatório.
 *  É uma tela de privacidade (quem pega o celular desbloqueado não vê as contas); os dados não são cifrados. */
export interface PinLock { salt: string; hash: string; iterations: number; credentialId?: string }

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf instanceof Uint8Array ? buf : new Uint8Array(buf))))
const unb64 = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s), c => c.charCodeAt(0))

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256)
  return b64(bits)
}

export async function makePinLock(pin: string): Promise<PinLock> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iterations = 150_000
  return { salt: b64(salt), hash: await derive(pin, salt, iterations), iterations }
}

export async function checkPin(lock: PinLock, pin: string): Promise<boolean> {
  return (await derive(pin, unb64(lock.salt), lock.iterations)) === lock.hash
}

/** Digital/rosto do próprio aparelho (WebAuthn). Só destrava a tela; não sai do aparelho. */
export async function biometricsAvailable(): Promise<boolean> {
  try {
    return !!window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch { return false }
}

export async function registerBiometrics(): Promise<string> {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Provisão' },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'familia', displayName: 'Provisão' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
      timeout: 60_000,
    },
  }) as PublicKeyCredential | null
  if (!cred) throw new Error('Não foi possível usar a digital neste aparelho.')
  return b64(cred.rawId)
}

export async function verifyBiometrics(credentialId: string): Promise<boolean> {
  try {
    const got = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: unb64(credentialId) }],
        userVerification: 'required',
        timeout: 60_000,
      },
    })
    return !!got
  } catch { return false }
}
