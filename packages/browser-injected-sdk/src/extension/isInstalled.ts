export function isInstalled(): boolean {
  try {
    // Attempt to access the Phantom extension's global object
    const phantom = (window as any)?.phantom;
    return !!phantom;
  } catch {
    // If accessing the global object fails, the extension is likely not installed
    return false;
  }
}
