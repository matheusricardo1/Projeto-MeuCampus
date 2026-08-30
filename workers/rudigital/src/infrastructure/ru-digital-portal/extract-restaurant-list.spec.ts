import { describe, expect, it } from 'vitest';
import { extractRestaurantList } from '@/infrastructure/ru-digital-portal/extract-restaurant-list';
import { ExternalServiceError } from '@/domain/exceptions/external-service.error';

// Real snippet captured from RU Digital's /restaurante/select RSC payload during discovery.
const REAL_PAYLOAD_SNIPPET = '["$","div",null,{"className":"px-5 pt-10","children":["$","$L19",null,{"restaurantes":[{"id":"HUM","nome":"Humaitá - IEAA","cidade":"Humaitá - IEAA"},{"id":"BJN","nome":"Benjamin Constant - INC","cidade":"Benjamin Constant - INC"},{"id":"MAO","nome":"Manaus - Campus Coroado","cidade":"Manaus - Campus Coroado"}]}]}]';

describe('extractRestaurantList', () => {
    it('extracts the restaurant array from a real RSC payload', () => {
        expect(extractRestaurantList(REAL_PAYLOAD_SNIPPET)).toEqual([
            { id: 'HUM', nome: 'Humaitá - IEAA', cidade: 'Humaitá - IEAA' },
            { id: 'BJN', nome: 'Benjamin Constant - INC', cidade: 'Benjamin Constant - INC' },
            { id: 'MAO', nome: 'Manaus - Campus Coroado', cidade: 'Manaus - Campus Coroado' }
        ]);
    });

    it('throws ExternalServiceError when the payload has no restaurantes field', () => {
        expect(() => extractRestaurantList('{"a":"$@1","f":"","b":"xyz"}')).toThrow(ExternalServiceError);
    });
});
