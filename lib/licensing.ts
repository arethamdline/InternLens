/** A posting can be persisted only when its source has an explicit licensed status. */
export function canStoreJob(storagePolicy: string): boolean {
  return storagePolicy === 'licensed';
}
