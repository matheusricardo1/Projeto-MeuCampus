import { ExternalServiceError } from '@/domain/exceptions/external-service.error';

export interface RawRestaurant {
    id: string;
    nome: string;
    cidade: string;
}

/**
 * The restaurant list is server-rendered directly into `/restaurante/select`'s
 * initial RSC payload as a `restaurantes` prop — a flat array of flat
 * objects, so a bracket-matching regex is enough without needing to parse
 * the surrounding (non-JSON) React element tree.
 */
export function extractRestaurantList(rscPayload: string): RawRestaurant[] {
    const match = rscPayload.match(/"restaurantes":(\[[^\]]*\])/);
    if (!match?.[1]) {
        throw new ExternalServiceError('RU Digital response did not contain the restaurant list.');
    }

    try {
        return JSON.parse(match[1]) as RawRestaurant[];
    } catch {
        throw new ExternalServiceError('RU Digital restaurant list was not valid JSON.');
    }
}
