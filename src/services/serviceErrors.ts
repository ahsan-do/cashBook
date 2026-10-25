export interface DatabaseError {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}

const friendlyMessages: Record<string, string> = {
  '42501': "You don't have permission to do that. Check that your email is verified and that you have access to this book.",
  '23505': 'This record already exists or this invitation has already been used.',
  P0002: 'The requested record was not found or is no longer available.',
  '55000': 'This action is no longer available. The invitation may have expired or already been used.',
};

/** Convert Supabase/Postgres failures into messages suitable for the UI. */
export const toServiceError = (error: unknown, operation: string): Error => {
  const databaseError = (error ?? {}) as DatabaseError;
  const message = databaseError.code
    ? friendlyMessages[databaseError.code]
    : undefined;

  if (message) return new Error(message);
  if (error instanceof Error && error.message.trim()) return new Error(error.message);
  if (databaseError.message?.trim()) return new Error(databaseError.message);
  return new Error(`${operation} failed. Please try again.`);
};

export const throwServiceError = (error: unknown, operation: string): never => {
  throw toServiceError(error, operation);
};
