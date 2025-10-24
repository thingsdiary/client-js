export type Version = number;

export function NewVersion(): Version {
  return Math.floor(Date.now());
}
