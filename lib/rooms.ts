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

export const CODE_LENGTH = 10;

export function isValidCode(value: string): value is string {
  return typeof value === "string" && value.length === CODE_LENGTH;
}
