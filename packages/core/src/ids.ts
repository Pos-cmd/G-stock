/**
 * Identifiants UUID v7 (RFC 9562) : uniques sans compteur partagé, et triés dans l'ordre de
 * création (les 48 premiers bits sont l'horodatage en millisecondes). Trier par identifiant
 * revient donc à trier par date de création, même pour deux lignes créées dans la même
 * milliseconde : un compteur aléatoire de 12 bits garantit l'ordre au sein d'un même processus.
 */

const MAX_SEQUENCE = 0xfff;
const SEQUENCE_START_RANGE = 0x7ff;

let lastTimestamp = 0;
let sequence = 0;

const hex = (value: number, length: number): string => value.toString(16).padStart(length, "0");

const randomBytes = (length: number): Uint8Array =>
  globalThis.crypto.getRandomValues(new Uint8Array(length));

export const uuidv7 = (): string => {
  const now = Date.now();
  if (now > lastTimestamp) {
    lastTimestamp = now;
    // Départ aléatoire dans la moitié basse : il reste de la place pour incrémenter.
    sequence = ((randomBytes(2)[0] ?? 0) * 8) & SEQUENCE_START_RANGE;
  } else {
    sequence += 1;
    if (sequence > MAX_SEQUENCE) {
      lastTimestamp += 1;
      sequence = 0;
    }
  }

  const time = hex(lastTimestamp, 12);
  const tail = randomBytes(8);
  // Variante RFC 4122 : les deux bits de poids fort du 9e octet valent 10.
  tail[0] = ((tail[0] ?? 0) & 0x3f) | 0x80;
  const tailHex = [...tail].map((byte) => hex(byte, 2)).join("");

  return [
    time.slice(0, 8),
    time.slice(8, 12),
    `7${hex(sequence, 3)}`,
    tailHex.slice(0, 4),
    tailHex.slice(4, 16),
  ].join("-");
};

const UUID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/u;

export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_PATTERN.test(value);
