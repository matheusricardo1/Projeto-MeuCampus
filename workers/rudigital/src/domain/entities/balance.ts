export interface MealBalance {
    mealPrice: number;
    currentBalance: number;
    availableForPurchase: number;
}

/** Maps RU Digital's "saldo" resource, keyed by `queryKey: ["saldo","session"]`. */
export interface Balance {
    breakfast: MealBalance;
    lunch: MealBalance;
    dinner: MealBalance;
}
