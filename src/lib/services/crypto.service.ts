import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from "@aws-sdk/client-kms";
import crypto from "crypto";
import { env } from "@/lib/env";

export interface EncryptedPayload {
  encryptedData: Buffer;
  encryptedKey: Buffer;
  iv: Buffer;
  authTag: Buffer;
  kmsKeyId: string;
}

export class CryptoService {
  private kms: KMSClient;
  private masterKeyId: string;

  constructor(region?: string, masterKeyId?: string) {
    this.masterKeyId = masterKeyId || process.env.KMS_MASTER_KEY_ID || env.KMS_MASTER_KEY_ID;
    this.kms = new KMSClient({ region: region || process.env.AWS_REGION || env.AWS_REGION });
  }

  /**
   * Encrypts plaintext using KMS Envelope Encryption with AES-256-GCM and AAD.
   *
   * @param plaintext - The raw string to encrypt (e.g. OAuth token or lead message snippet)
   * @param aad - Additional Authenticated Data bound to the tenant (e.g. org_id)
   */
  async encrypt(plaintext: string, aad: string): Promise<EncryptedPayload> {
    // 1. Request a 256-bit Data Encryption Key (DEK) from KMS
    const cmd = new GenerateDataKeyCommand({
      KeyId: this.masterKeyId,
      KeySpec: "AES_256",
    });

    const response = await this.kms.send(cmd);
    const rawKey = response.Plaintext;
    const encryptedKey = response.CiphertextBlob;

    if (!rawKey || !encryptedKey) {
      throw new Error("KMS failed to generate Data Encryption Key");
    }

    const keyBuffer = Buffer.from(rawKey);

    // 2. Generate cryptographically secure 96-bit IV (12 bytes)
    const iv = crypto.randomBytes(12);

    // 3. Perform local AEAD AES-256-GCM encryption
    const cipher = crypto.createCipheriv("aes-256-gcm", keyBuffer, iv);
    cipher.setAAD(Buffer.from(aad, "utf8"));

    const encryptedData = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // 4. Memory hygiene: zero out the plaintext key buffer immediately
    keyBuffer.fill(0);

    return {
      encryptedData,
      encryptedKey: Buffer.from(encryptedKey),
      iv,
      authTag,
      kmsKeyId: this.masterKeyId,
    };
  }

  /**
   * Decrypts ciphertext by unwrapping the DEK via KMS and verifying the AAD tag.
   *
   * @param payload - The encrypted envelope package
   * @param aad - The expected AAD (must match original org_id)
   */
  async decrypt(payload: EncryptedPayload, aad: string): Promise<string> {
    // 1. Decrypt the Data Encryption Key with KMS
    const decryptCmd = new DecryptCommand({
      CiphertextBlob: payload.encryptedKey,
      KeyId: payload.kmsKeyId,
    });

    const response = await this.kms.send(decryptCmd);
    const rawKey = response.Plaintext;

    if (!rawKey) {
      throw new Error("KMS failed to decrypt Data Encryption Key");
    }

    const keyBuffer = Buffer.from(rawKey);

    try {
      // 2. Perform AES-256-GCM decryption and verify Auth Tag & AAD
      const decipher = crypto.createDecipheriv("aes-256-gcm", keyBuffer, payload.iv);
      decipher.setAAD(Buffer.from(aad, "utf8"));
      decipher.setAuthTag(payload.authTag);

      const decrypted = Buffer.concat([
        decipher.update(payload.encryptedData),
        decipher.final(),
      ]).toString("utf8");

      return decrypted;
    } finally {
      // 3. Memory hygiene: zero out the plaintext key buffer
      keyBuffer.fill(0);
    }
  }
}
