export function httpUrl(value: string) {
  if (!/^https?:\/\//i.test(value)) return;
  try {
    return new URL(value).href;
  } catch {
    return;
  }
}
