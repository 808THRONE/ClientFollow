import { describe, it, expect, vi, beforeEach } from "vitest";
import { CryptoService, EncryptedPayload } from "@/lib/services/crypto.service";

// Mock KMS Client
vi.mock("@aws-sdk/client-kms", () => {
  return {
    KMSClient: vi.fn().mockImplementation(() => {
      return {
        send: vi.fn().mockImplementation(async (command: any) => {
          // Mock GenerateDataKeyCommand
          if (command.constructor.name === "GenerateDataKeyCommand" || command.KeySpec) {
            // Return 32 bytes (256-bit key)
            const rawKey = Buffer.from("01234567890123456789012345678901"); // 32 bytes
            const encryptedKey = Buffer.from("MOCK_ENCRYPTED_KMS_KEY_BLOB_32B");
            return {
              Plaintext: rawKey,
              CiphertextBlob: encryptedKey,
            };
          }
          // Mock DecryptCommand
          if (command.constructor.name === "DecryptCommand" || command.CiphertextBlob) {
            const rawKey = Buffer.from("01234567890123456789012345678901");
            return {
              Plaintext: rawKey,
            };
          }
          throw new Error("Unknown KMS command");
        }),
      };
    }),
    GenerateDataKeyCommand: class GenerateDataKeyCommand {
      constructor(public params: any) {}
    },
    DecryptCommand: class DecryptCommand {
      constructor(public params: any) {}
    },
  };
});

describe("CryptoService (NIST Envelope Encryption)", () => {
  let service: CryptoService;
  const sampleOrgId = "org_12345678-abcd-ef01-2345-6789abcdef01";

  beforeEach(() => {
    process.env.AWS_REGION = "us-east-1";
    process.env.KMS_MASTER_KEY_ID = "arn:aws:kms:us-east-1:123456789012:key/test-key";
    service = new CryptoService();
  });

  it("successfully encrypts plaintext and returns valid payload with IV and AuthTag", async () => {
    const secretText = "ya29.a0AfH6SMD_secret_google_oauth_refresh_token_123";
    const payload = await service.encrypt(secretText, sampleOrgId);

    expect(payload.encryptedData).toBeDefined();
    expect(payload.encryptedKey).toBeDefined();
    expect(payload.iv).toHaveLength(12); // 96-bit IV
    expect(payload.authTag).toHaveLength(16); // 128-bit Auth Tag
    expect(payload.kmsKeyId).toBe("arn:aws:kms:us-east-1:123456789012:key/test-key");
  });

  it("successfully decrypts ciphertext with matching AAD", async () => {
    const secretText = "confidential-client-lead-snippet: looking for dental implant pricing";
    const payload = await service.encrypt(secretText, sampleOrgId);
    const decrypted = await service.decrypt(payload, sampleOrgId);

    expect(decrypted).toBe(secretText);
  });

  it("fails to decrypt if AAD (tenant org_id) does not match", async () => {
    const secretText = "sensitive-lawyer-consultation-notes";
    const payload = await service.encrypt(secretText, sampleOrgId);

    const wrongOrgId = "org_attacker_tenant_999999";
    await expect(service.decrypt(payload, wrongOrgId)).rejects.toThrow();
  });

  it("fails to decrypt if ciphertext is tampered with", async () => {
    const secretText = "secret-token";
    const payload = await service.encrypt(secretText, sampleOrgId);

    // Tamper with one byte of ciphertext
    payload.encryptedData[0] = payload.encryptedData[0] ^ 0xff;

    await expect(service.decrypt(payload, sampleOrgId)).rejects.toThrow();
  });
});
