import axios, { AxiosError } from 'axios';
import { Exercise, ExerciseSet, WeightUnit } from '../types';
import { API_BASE_URL } from '../config';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

/** Normalise axios errors into readable messages */
function handleError(err: unknown): never {
  if (err instanceof AxiosError) {
    const msg = err.response?.data?.error ?? err.message;
    throw new Error(msg);
  }
  throw err;
}

/** Payload shape for a single set on create/update */
export interface SetInput {
  reps?:   number | null;
  weight?: number | null;
}

export interface CreateExerciseDto {
  name:   string;
  date:   string;       // 'YYYY-MM-DD'
  unit:   WeightUnit;
  notes?: string | null;
  sets:   SetInput[];   // non-empty
}

export const workoutApi = {
  /** All exercises in [startDate, endDate] */
  getByRange: async (startDate: string, endDate: string): Promise<Exercise[]> => {
    try {
      const { data } = await client.get<Exercise[]>('/workouts', {
        params: { startDate, endDate },
      });
      return data;
    } catch (e) { handleError(e); }
  },

  /** All exercises on a single day */
  getByDate: async (date: string): Promise<Exercise[]> => {
    try {
      const { data } = await client.get<Exercise[]>('/workouts/day', { params: { date } });
      return data;
    } catch (e) { handleError(e); }
  },

  /** Create a new exercise (with one or more sets) */
  create: async (dto: CreateExerciseDto): Promise<Exercise> => {
    try {
      const { data } = await client.post<Exercise>('/workouts', dto);
      return data;
    } catch (e) { handleError(e); }
  },

  /** Update an existing exercise. If `sets` is provided, all sets are replaced. */
  update: async (id: number, dto: Partial<CreateExerciseDto>): Promise<Exercise> => {
    try {
      const { data } = await client.put<Exercise>(`/workouts/${id}`, dto);
      return data;
    } catch (e) { handleError(e); }
  },

  /** Delete an exercise (cascades to its sets) */
  delete: async (id: number): Promise<void> => {
    try {
      await client.delete(`/workouts/${id}`);
    } catch (e) { handleError(e); }
  },
};