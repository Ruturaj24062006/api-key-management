export type UserRole = 'ADMIN' | 'MEMBER';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
}

export interface AuthResponse {
  token: string;
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
}
