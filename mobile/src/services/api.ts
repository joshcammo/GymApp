import axios, { AxiosError } from 'axios';
import { Exercise, WeightUnit } from '../types';
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

export interface CreateExerciseDto {
  name:    string;
  date:    string;       // 'YYYY-MM-DD'
  sets:    number;
  reps?:   number | null;
  weight:  number;
  unit:    WeightUnit;
  notes?:  string | null;
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

  /** Create a new exercise */
  create: async (dto: CreateExerciseDto): Promise<Exercise> => {
    try {
      const { data } = await client.post<Exercise>('/workouts', dto);
      return data;
    } catch (e) { handleError(e); }
  },

  /** Update an existing exercise */
  update: async (id: number, dto: Partial<CreateExerciseDto>): Promise<Exercise> => {
    try {
      const { data } = await client.put<Exercise>(`/workouts/${id}`, dto);
      return data;
    } catch (e) { handleError(e); }
  },

  /** Delete an exercise */
  delete: async (id: number): Promise<void> => {
    try {
      await client.delete(`/workouts/${id}`);
    } catch (e) { handleError(e); }
  },
};
