import { describe, expect, it } from 'vitest';
import { parseFlightPayload } from '@/infrastructure/ru-digital-portal/parse-flight-payload';
import { ExternalServiceError } from '@/domain/exceptions/external-service.error';

describe('parseFlightPayload', () => {
    it('parses a real "saldo" (balance) action response', () => {
        const raw = '0:{"a":"$@1","f":"","b":"dEHL7K9A8AstV3iQv9ySh"}\n'
            + '1:{"almoco":{"valorRefeicao":1.3,"saldoAtual":0,"disponivelParaCompra":26},"desjejum":{"valorRefeicao":0.75,"saldoAtual":0,"disponivelParaCompra":26},"jantar":{"valorRefeicao":1.4,"saldoAtual":0,"disponivelParaCompra":26}}\n';

        expect(parseFlightPayload(raw)).toEqual({
            almoco: { valorRefeicao: 1.3, saldoAtual: 0, disponivelParaCompra: 26 },
            desjejum: { valorRefeicao: 0.75, saldoAtual: 0, disponivelParaCompra: 26 },
            jantar: { valorRefeicao: 1.4, saldoAtual: 0, disponivelParaCompra: 26 }
        });
    });

    it('parses a real "discente" (student) action response', () => {
        const raw = '0:{"a":"$@1","f":"","b":"dEHL7K9A8AstV3iQv9ySh"}\n'
            + '1:{"idAluno":171988,"idCursoAluno":193808,"cpf":"061.245.552-12","idPessoa":"MATHEUS RICARDO OLIVEIRA LIMA","matrAluno":"22551205","codCurso":"IE17","nomeCursoDiploma":"Engenharia de Software"}\n';

        expect(parseFlightPayload<{ idAluno: number; cpf: string }>(raw)).toMatchObject({
            idAluno: 171988,
            cpf: '061.245.552-12'
        });
    });

    it('throws ExternalServiceError on a real "action failed" digest response', () => {
        const raw = '0:{"a":"$@1","f":"","b":"dEHL7K9A8AstV3iQv9ySh"}\n1:E{"digest":"253021997"}\n';

        expect(() => parseFlightPayload(raw)).toThrow(ExternalServiceError);
    });

    it('throws ExternalServiceError when no segment is parsable JSON', () => {
        const raw = '0:{"a":"$@1","f":"","b":"dEHL7K9A8AstV3iQv9ySh"}\n1:$Sreact.fragment\n';

        expect(() => parseFlightPayload(raw)).toThrow(ExternalServiceError);
    });

    it('skips the bootstrap segment and returns the last real data segment', () => {
        const raw = '0:{"a":"$@1","f":"","b":"xyz"}\n1:{"id":"MAO","nome":"Manaus - Campus Coroado","cidade":"Manaus - Campus Coroado"}\n';

        expect(parseFlightPayload(raw)).toEqual({ id: 'MAO', nome: 'Manaus - Campus Coroado', cidade: 'Manaus - Campus Coroado' });
    });
});
