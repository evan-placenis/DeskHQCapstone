export enum UserRole {
    ENGINEER = 'ENGINEER',
    REVIEWER = 'REVIEWER',
    ADMIN = 'ADMIN'
}

export interface User {
    userId: string;
    email: string;
    fullName: string;
    passwordHash: string; // In real app, never send this to frontend!
    roles: UserRole[];
    isActive: boolean;
}