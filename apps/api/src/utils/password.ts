import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { authConfig } from "../config/auth";

/** Algorithm marker every stored digest starts with. */
export const PASSWORD_HASH_ALGORITHM = "scrypt";

/**
 * Ceiling on the input. scrypt cost is set by the parameters, not by the
 * password, so a long password buys an attacker nothing; the limit only stops a
 * request from pushing an unbounded string through the KDF.
 */
const MAXIMUM_PASSWORD_LENGTH = 4096;

/** `scrypt$N$r$p$salt$hash` — six segments, both salt and hash base64url. */
const HASH_SEGMENT_COUNT = 6;

export interface PasswordHashingParameters {
  /** scrypt cost parameter N. */
  cost: number;
  /** scrypt block size r. */
  blockSize: number;
  /** scrypt parallelisation p. */
  parallelization: number;
  /** Length in bytes of the derived key. */
  keyLength: number;
  /** Length in bytes of the random salt. */
  saltBytes: number;
  /** Memory ceiling passed through to scrypt. */
  maxmem: number;
}

export type PasswordHashingOverrides = Partial<PasswordHashingParameters>;

interface ParsedPasswordHash {
  parameters: Omit<PasswordHashingParameters, "keyLength" | "saltBytes">;
  salt: Buffer;
  hash: Buffer;
}

function deriveKey(
  password: string,
  salt: Buffer,
  parameters: PasswordHashingParameters,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      parameters.keyLength,
      {
        N: parameters.cost,
        r: parameters.blockSize,
        p: parameters.parallelization,
        maxmem: parameters.maxmem,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey);
      },
    );
  });
}

function assertHashablePassword(password: string): void {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("Password must be a non-empty string");
  }

  if (password.length > MAXIMUM_PASSWORD_LENGTH) {
    throw new Error(
      `Password must be at most ${MAXIMUM_PASSWORD_LENGTH} characters`,
    );
  }
}

function toPositiveInteger(value: string): number | null {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parsePasswordHash(storedHash: string): ParsedPasswordHash | null {
  const segments = storedHash.split("$");

  if (segments.length !== HASH_SEGMENT_COUNT) {
    return null;
  }

  const [
    algorithm,
    costText,
    blockSizeText,
    parallelizationText,
    saltText,
    hashText,
  ] = segments;

  if (
    algorithm !== PASSWORD_HASH_ALGORITHM ||
    !costText ||
    !blockSizeText ||
    !parallelizationText ||
    !saltText ||
    !hashText
  ) {
    return null;
  }

  const cost = toPositiveInteger(costText);
  const blockSize = toPositiveInteger(blockSizeText);
  const parallelization = toPositiveInteger(parallelizationText);

  if (cost === null || blockSize === null || parallelization === null) {
    return null;
  }

  const salt = Buffer.from(saltText, "base64url");
  const hash = Buffer.from(hashText, "base64url");

  if (salt.length === 0 || hash.length === 0) {
    return null;
  }

  return {
    parameters: {
      cost,
      blockSize,
      parallelization,
      // Node refuses a derivation whose working set exceeds maxmem, so a stored
      // hash always has to be verified with a ceiling of its own.
      maxmem: 256 * cost * blockSize,
    },
    salt,
    hash,
  };
}

/**
 * Hashes a password with scrypt and returns a self-describing digest:
 * `scrypt$N$r$p$salt$hash`, both parts base64url. Every verification parameter
 * travels with the digest, so a stored password survives a configuration change
 * and can be reported as needing a re-hash instead of becoming unreadable.
 */
export async function hashPassword(
  password: string,
  overrides: PasswordHashingOverrides = {},
): Promise<string> {
  assertHashablePassword(password);

  const parameters: PasswordHashingParameters = {
    ...authConfig.password,
    ...overrides,
  };

  if (parameters.saltBytes <= 0) {
    throw new Error("Password salt must be at least one byte");
  }

  const salt = randomBytes(parameters.saltBytes);
  const derivedKey = await deriveKey(password, salt, parameters);

  return [
    PASSWORD_HASH_ALGORITHM,
    parameters.cost,
    parameters.blockSize,
    parameters.parallelization,
    salt.toString("base64url"),
    derivedKey.toString("base64url"),
  ].join("$");
}

/**
 * Checks a password against a stored digest in constant time.
 *
 * The check fails closed and never throws. An account with no password yet
 * (`passwordHash` is null, which is every row created before authentication
 * existed) and a row whose digest cannot be parsed both return `false`, so a
 * stored row can never turn a sign-in attempt into a server error and a caller
 * cannot tell one failed sign-in from another.
 */
export async function verifyPassword(
  password: string,
  storedHash: string | null | undefined,
): Promise<boolean> {
  if (
    typeof password !== "string" ||
    password.length === 0 ||
    password.length > MAXIMUM_PASSWORD_LENGTH
  ) {
    return false;
  }

  if (typeof storedHash !== "string" || storedHash.length === 0) {
    return false;
  }

  const parsed = parsePasswordHash(storedHash);

  if (!parsed) {
    return false;
  }

  const derivedKey = await deriveKey(password, parsed.salt, {
    ...parsed.parameters,
    keyLength: parsed.hash.length,
    saltBytes: parsed.salt.length,
  });

  if (derivedKey.length !== parsed.hash.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, parsed.hash);
}

/**
 * True when a stored digest was produced with parameters other than the current
 * ones, so a successful sign-in should transparently re-hash the password. An
 * unparseable digest is reported as needing a re-hash too.
 */
export function needsPasswordRehash(storedHash: string): boolean {
  const parsed = parsePasswordHash(storedHash);

  if (!parsed) {
    return true;
  }

  const current = authConfig.password;

  return (
    parsed.parameters.cost !== current.cost ||
    parsed.parameters.blockSize !== current.blockSize ||
    parsed.parameters.parallelization !== current.parallelization ||
    parsed.hash.length !== current.keyLength
  );
}

/** True when a value looks like a digest this module produced. */
export function isPasswordHash(value: string): boolean {
  return typeof value === "string" && parsePasswordHash(value) !== null;
}
