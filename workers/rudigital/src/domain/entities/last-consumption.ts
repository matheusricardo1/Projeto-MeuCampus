/** Maps RU Digital's "getUltimoConsumoAction" resource — whether the student has a meal awaiting feedback. */
export interface LastConsumption {
    hasPendingFeedback: boolean;
    consumptionId: string | null;
    meal: string | null;
}
