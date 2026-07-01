// Shared API response wrapper — every backend endpoint returns this shape.
// T is the type of the data inside (e.g., APIResponse<SessionContext>)
export type APIResponse<T> = {
  success: boolean;
  data: T | null;
  error: string | null;
};
