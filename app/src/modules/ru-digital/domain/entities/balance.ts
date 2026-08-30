export interface RuDigitalMealBalance {
    mealPrice: number;
    currentBalance: number;
    availableForPurchase: number;
}

export interface RuDigitalBalance {
    breakfast: RuDigitalMealBalance;
    lunch: RuDigitalMealBalance;
    dinner: RuDigitalMealBalance;
}
