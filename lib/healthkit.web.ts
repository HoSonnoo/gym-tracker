// HealthKit non è disponibile su web — stub no-op

export async function initHealthKit(): Promise<boolean> {
  return false;
}

export async function getHealthDataLast30Days() {
  return [];
}
