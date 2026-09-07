import test from "node:test";
import assert from "node:assert/strict";
import {
  generatePairingCode,
  cleanCode,
  hashCode,
  generateDeviceToken,
  hashToken,
  parseClaimPayload,
  parseRevokePayload,
} from "../lib/pairing/policy.mjs";
import { PairingStore } from "../lib/pairing/store.mjs";

test("pairing code generation and format", () => {
  const code = generatePairingCode();
  assert.match(code, /^JRV-[0-9A-F]{4}-[0-9A-F]{4}$/, "Code should follow JRV-XXXX-XXXX uppercase format");

  assert.equal(cleanCode("jrv-12ab-cdef"), "JRV-12AB-CDEF");
  assert.equal(cleanCode("12ABCDEF"), "JRV-12AB-CDEF");
  assert.equal(cleanCode("  JRV 12AB CDEF  "), "JRV-12AB-CDEF");
  assert.equal(cleanCode("invalid"), "");
  assert.equal(cleanCode(""), "");
});

test("pairing token and code hashing", () => {
  const code = "JRV-1234-5678";
  const hash1 = hashCode(code);
  const hash2 = hashCode("12345678");
  assert.equal(hash1, hash2, "Normalized code produces identical hash");
  assert.equal(typeof hash1, "string");
  assert.equal(hash1.length, 64, "SHA-256 hex string");

  const token = generateDeviceToken();
  assert.equal(token.length, 64);
  const tokenHash = hashToken(token);
  assert.equal(tokenHash.length, 64);
});

test("parseClaimPayload validation and bounding", () => {
  const valid = parseClaimPayload({
    code: "JRV-1234-5678",
    device_id: "mac-studio-01",
    device_name: "MacBook Pro de Roberto",
  });
  assert.equal(valid.code, "JRV-1234-5678");
  assert.equal(valid.deviceId, "mac-studio-01");
  assert.equal(valid.deviceName, "MacBook Pro de Roberto");

  assert.throws(() => parseClaimPayload(null), /invalid_request/);
  assert.throws(() => parseClaimPayload({ code: "bad", device_id: "dev" }), /invalid_pairing_code/);
  assert.throws(() => parseClaimPayload({ code: "JRV-1234-5678", device_id: "" }), /invalid_device_id/);
  assert.throws(() => parseClaimPayload({ code: "JRV-1234-5678", device_id: "a".repeat(129) }), /invalid_device_id/);
});

test("parseRevokePayload validation", () => {
  const valid = parseRevokePayload({ device_id: "mac-01" });
  assert.equal(valid.deviceId, "mac-01");

  assert.throws(() => parseRevokePayload(null), /invalid_request/);
  assert.throws(() => parseRevokePayload({ device_id: "" }), /invalid_device_id/);
});

test("PairingStore claim logic against synthetic mock pool", async () => {
  let queryLog = [];
  const syntheticRows = [
    { owner_id: "user_neon_123", status: "pending", is_expired: false },
  ];

  const mockClient = {
    query: async (sql, params) => {
      queryLog.push({ sql, params });
      if (sql.includes("SELECT owner_id, status")) {
        return { rowCount: syntheticRows.length, rows: syntheticRows };
      }
      if (sql.includes("INSERT INTO cloud_device_pairings_v1")) {
        return { rowCount: 1, rows: [{ expires_at: new Date(Date.now() + 600000).toISOString() }] };
      }
      return { rowCount: 1, rows: [] };
    },
    release: () => {},
  };

  const mockPool = {
    connect: async () => mockClient,
    query: async (sql, params) => mockClient.query(sql, params),
  };

  const store = new PairingStore(mockPool);

  const created = await store.createPairing("user_neon_123");
  assert.match(created.code, /^JRV-/);

  const claimed = await store.claimPairing({
    code: created.code,
    deviceId: "device_mac_01",
    deviceName: "Roberto's Mac",
  });

  assert.equal(claimed.ownerId, "user_neon_123");
  assert.equal(claimed.deviceId, "device_mac_01");
  assert.equal(claimed.deviceName, "Roberto's Mac");
  assert.equal(typeof claimed.deviceToken, "string");
  assert.equal(claimed.deviceToken.length, 64);
});
