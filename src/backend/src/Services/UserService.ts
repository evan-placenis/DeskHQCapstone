import { SupabaseClient } from '@supabase/supabase-js';
import { User, UserRole } from '../domain/core/user.types';

export class UserService {
    constructor(private supabase: SupabaseClient) {}

    /**
     * Register a new user and create their profile + organization link.
     */
    async registerUser(email: string, fullName: string, organizationName: string, password?: string): Promise<User> {
        // 1. Create User in Supabase Auth
        // Note: For a real client-side flow, user signs up on frontend, 
        // but here we are doing it via admin or assuming we handle the full flow.
        // If we use admin.createUser, we bypass email verification for testing.
        const { data: authData, error: authError } = await this.supabase.auth.admin.createUser({
            email,
            password: password || 'TemporaryPassword123!', // Use provided password or default
            email_confirm: true,
            user_metadata: { full_name: fullName }
        });

        if (authError) throw new Error(`Auth Error: ${authError.message}`);
        if (!authData.user) throw new Error("Failed to create auth user");

        const userId = authData.user.id;

        // 2. Create Organization
        const { data: orgData, error: orgError } = await this.supabase
            .from('organizations')
            .insert({ name: organizationName })
            .select()
            .single();

        if (orgError) throw new Error(`Org Error: ${orgError.message}`);

        // 3. Create Profile linked to Org
        // We use upsert because the 'handle_new_user' trigger might have already created the profile
        // We temporarily remove 'role' because the user reported it missing in their DB schema
        const { error: profileError } = await this.supabase
            .from('profiles')
            .upsert({
                id: userId,
                full_name: fullName,
                organization_id: orgData.id,
                // role: 'ADMIN' // Re-enable this once the 'role' column exists in your profiles table
            });

        if (profileError) throw new Error(`Profile Error: ${profileError.message}`);

        return {
            userId,
            email,
            fullName,
            roles: [UserRole.ADMIN],
            isActive: true,
            // We don't return password hash
            passwordHash: '' 
        };
    }

    /**
     * Authenticate user with Supabase Auth
     */
    async loginUser(email: string, password: string): Promise<any> {
        const { data, error } = await this.supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw new Error(error.message);
        
        // Also fetch the profile to return full user context
        if (data.session?.user) {
             const profile = await this.getUserProfile(data.session.user.id);
             return {
                 ...data.session,
                 profile
             };
        }

        return data.session;
    }

    /**
     * Get user profile details by Auth ID
     */
    async getUserProfile(userId: string): Promise<any> {
        const { data, error } = await this.supabase
            .from('profiles')
            .select('*, organization:organizations(*)')
            .eq('id', userId)
            .single();

        if (error) return null;
        return data;
    }
}

