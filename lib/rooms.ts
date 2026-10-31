export const ROOM_LETTERS = ["a", "b", "c", "d", "e"] as const;

export type RoomLetter = (typeof ROOM_LETTERS)[number];

export const ROOM_UPPER: Record<RoomLetter, string> = {
  a: "A",
  b: "B",
  c: "C",
  d: "D",
  e: "E",
};

export function isRoomLetter(value: string): value is RoomLetter {
  return (ROOM_LETTERS as readonly string[]).includes(value);
}

export function parseRoomLetter(value: string): RoomLetter | null {
  const lowercase = value.toLowerCase();
  return isRoomLetter(lowercase) ? lowercase : null;
}

export const ROOM_PASSWORD_MIN_LENGTH = 4;
export const ROOM_PASSWORD_MAX_LENGTH = 64;
export const ROOM_PASSWORD_PATTERN = new RegExp(
  `^[A-Za-z0-9]{${ROOM_PASSWORD_MIN_LENGTH},${ROOM_PASSWORD_MAX_LENGTH}}$`,
);

export function isValidRoomPassword(value: unknown): value is string {
  return typeof value === "string" && ROOM_PASSWORD_PATTERN.test(value);
}
