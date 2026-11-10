/** Normalized college key used for event matching across parent accounts. */
export function collegeKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}
