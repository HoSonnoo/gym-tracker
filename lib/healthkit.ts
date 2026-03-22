import { Platform } from 'react-native';
import AppleHealthKit, {
  HealthInputOptions,
  HealthKitPermissions,
} from 'react-native-health';

const PERMISSIONS: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.StepCount,
      AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
    ],
    write: [],
  },
};

export type DailyHealthData = {
  date: string;
  steps: number;
  distanceKm: number;
  caloriesBurned: number;
};

let healthKitInitialized = false;

export async function initHealthKit(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;

  return new Promise((resolve) => {
    AppleHealthKit.initHealthKit(PERMISSIONS, (error: string) => {
      if (error) {
        console.log('HealthKit init error:', error);
        resolve(false);
      } else {
        healthKitInitialized = true;
        resolve(true);
      }
    });
  });
}

export async function getHealthDataLast30Days(): Promise<DailyHealthData[]> {
  if (Platform.OS !== 'ios' || !healthKitInitialized) return [];

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 29);

  const options: HealthInputOptions = {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    ascending: true,
    includeManuallyAdded: true,
  };

  const [steps, distance, calories] = await Promise.all([
    getDailySteps(options),
    getDailyDistance(options),
    getDailyCalories(options),
  ]);

  const result: DailyHealthData[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    result.push({
      date: key,
      steps: steps[key] ?? 0,
      distanceKm: distance[key] ?? 0,
      caloriesBurned: calories[key] ?? 0,
    });
  }

  return result;
}

function getDailySteps(options: HealthInputOptions): Promise<Record<string, number>> {
  return new Promise((resolve) => {
    AppleHealthKit.getDailyStepCountSamples(options, (err: string, results: any[]) => {
      if (err || !results) { resolve({}); return; }
      const map: Record<string, number> = {};
      for (const r of results) {
        const key = new Date(r.startDate).toISOString().slice(0, 10);
        map[key] = (map[key] ?? 0) + Math.round(r.value ?? 0);
      }
      resolve(map);
    });
  });
}

function getDailyDistance(options: HealthInputOptions): Promise<Record<string, number>> {
  return new Promise((resolve) => {
    AppleHealthKit.getDistanceWalkingRunning(options, (err: string, results: any) => {
      if (err || !results) { resolve({}); return; }
      const map: Record<string, number> = {};
      const list = Array.isArray(results) ? results : [results];
      for (const r of list) {
        if (!r?.startDate) continue;
        const key = new Date(r.startDate).toISOString().slice(0, 10);
        map[key] = Math.round(((map[key] ?? 0) + (r.value ?? 0) / 1000) * 100) / 100;
      }
      resolve(map);
    });
  });
}

function getDailyCalories(options: HealthInputOptions): Promise<Record<string, number>> {
  return new Promise((resolve) => {
    AppleHealthKit.getActiveEnergyBurned(options, (err: string, results: any[]) => {
      if (err || !results) { resolve({}); return; }
      const map: Record<string, number> = {};
      for (const r of results) {
        if (!r?.startDate) continue;
        const key = new Date(r.startDate).toISOString().slice(0, 10);
        map[key] = Math.round((map[key] ?? 0) + (r.value ?? 0));
      }
      resolve(map);
    });
  });
}