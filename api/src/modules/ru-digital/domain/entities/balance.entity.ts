export interface MealBalance {
    mealPrice: number;
    currentBalance: number;
    availableForPurchase: number;
}

export interface Balance {
    breakfast: MealBalance;
    lunch: MealBalance;
    dinner: MealBalance;
}
