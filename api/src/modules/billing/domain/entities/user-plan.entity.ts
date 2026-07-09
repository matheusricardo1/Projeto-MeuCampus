export type PlanTier = 'FREE' | 'PAID';

export interface UserPlan {
    id: string;
    plan: PlanTier;
    planExpiresAt: Date | null;
}

export function isPlanActive(user: UserPlan): boolean {
    if (user.plan !== 'PAID') return false;
    if (!user.planExpiresAt) return false;
    return user.planExpiresAt.getTime() > Date.now();
}
