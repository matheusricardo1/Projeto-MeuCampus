/**
 * Maps RU Digital's "cardapio" (daily menu) resource for a given date.
 * `items` is left as raw strings — the portal returned an empty menu for
 * every date probed during discovery, so its populated item shape is
 * unconfirmed; treat this as best-effort until a non-empty response is seen.
 */
export interface DailyMenu {
    date: string;
    restaurantId: string;
    mealId: string;
    items: string[];
}
