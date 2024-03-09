import { nanoid, customAlphabet } from 'nanoid';

export const createUUID = () => nanoid(10);
export const createDefinedUUID = (characters: number) => {
  const alphabet = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', characters);
  return alphabet(characters);
};