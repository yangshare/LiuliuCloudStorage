import { safeStorage } from 'electron'
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16

class CryptoService {
  private key: Buffer | null = null
  private keyFilePath: string = ''

  async initialize(): Promise<void> {
    const userDataPath = app.getPath('userData')
    this.keyFilePath = join(userDataPath, '.encryption_key')

    if (safeStorage.isEncryptionAvailable()) {
      await this.initWithSafeStorage()
    } else {
      this.initWithEnvKey()
    }
  }

  private async initWithSafeStorage(): Promise<void> {
    if (existsSync(this.keyFilePath)) {
      const encryptedKey = readFileSync(this.keyFilePath)
      const keyHex = safeStorage.decryptString(encryptedKey)
      this.key = Buffer.from(keyHex, 'hex')
    } else {
      this.key = randomBytes(KEY_LENGTH)
      const encryptedKey = safeStorage.encryptString(this.key.toString('hex'))
      const dir = app.getPath('userData')
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
      writeFileSync(this.keyFilePath, encryptedKey)
    }
  }

  private initWithEnvKey(): void {
    const envKey = process.env.LIULIU_ENCRYPTION_KEY
    if (envKey && envKey.length === 64) {
      this.key = Buffer.from(envKey, 'hex')
    } else {
      // Generate and store key for development
      this.key = randomBytes(KEY_LENGTH)
      console.warn('CryptoService: Using generated key. Set LIULIU_ENCRYPTION_KEY for production.')
    }
  }

  encrypt(plaintext: string): string {
    if (!this.key) throw new Error('CryptoService not initialized')
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, this.key, iv)
    let encrypted = cipher.update(plaintext, 'utf8', 'base64')
    encrypted += cipher.final('base64')
    const authTag = cipher.getAuthTag()
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`
  }

  decrypt(ciphertext: string): string {
    if (!this.key) throw new Error('CryptoService not initialized')
    const [ivB64, authTagB64, encryptedB64] = ciphertext.split(':')
    if (!ivB64 || !authTagB64 || !encryptedB64) {
      throw new Error('Invalid ciphertext format')
    }
    const iv = Buffer.from(ivB64, 'base64')
    const authTag = Buffer.from(authTagB64, 'base64')
    const decipher = createDecipheriv(ALGORITHM, this.key, iv)
    decipher.setAuthTag(authTag)
    let decrypted = decipher.update(encryptedB64, 'base64', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  }

  isInitialized(): boolean {
    return this.key !== null
  }
}

export const cryptoService = new CryptoService()
