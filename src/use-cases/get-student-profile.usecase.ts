// src/use-cases/get-student-profile.usecase.ts
import { parse, type HTMLElement } from 'node-html-parser';
import { EcampusClient } from '../core/ecampus-client';
import { AuthenticationError, logger } from '../core/logger';

export class GetStudentProfileUseCase {
    constructor(private readonly client: EcampusClient) {}

    async execute(): Promise<Record<string, any>> {
        if (!this.client.isAuthenticated) {
            throw new AuthenticationError("Attempted to access protected route without auth.");
        }

        logger.info("Fetching student profile data...");
        
        try {
            const response = await this.client.session.get('/atualizarDadosAluno/index', { timeout: 15000 });
            const tree = parse(response.data);

            const profileData = {
                academic: {
                    admission_type: this._getInputValue(tree, "tipoIngresso"),
                    admission_term: this._getInputValue(tree, "anoIngresso"),
                    admission_date: this._getInputValue(tree, "dataIngresso"),
                    course: this._getInputValue(tree, "nomeCurso"),
                    shift: this._getInputValue(tree, "turno"),
                    enrollment_number: this._getInputValue(tree, "matricula"),
                },
                personal: {
                    full_name: this._getInputValue(tree, "nomePessoa"),
                    birth_date: this._getInputValue(tree, "aluno.dtNascimento"),
                    gender: this._getRadioValue(tree, "aluno.sexo"),
                    marital_status: this._getSelectText(tree, "aluno.estadoCivilItem"),
                    nationality: this._getSelectText(tree, "aluno.nacionalidadeItem"),
                    ethnicity: this._getSelectText(tree, "aluno.etniaItem"),
                    father_name: this._getInputValue(tree, "aluno.nomePai"),
                    mother_name: this._getInputValue(tree, "aluno.nomeMae"),
                },
                contact: {
                    email: this._getInputValue(tree, "endereco.descrMail"),
                    cellphone: this._getInputValue(tree, "endereco.foneCelular"),
                    home_phone: this._getInputValue(tree, "endereco.foneResidencial"),
                },
                address: {
                    zip_code: this._getInputValue(tree, "endereco.descrCep"),
                    street: this._getInputValue(tree, "endereco.descrRua"),
                    number: this._getInputValue(tree, "endereco.descrNumero"),
                    neighborhood: this._getInputValue(tree, "endereco.descrBairro"),
                    state: this._getSelectText(tree, "endereco.uf.id"),
                    city: this._getSelectText(tree, "endereco.cidade.id"),
                }
            };

            logger.info("Profile data extraction complete.");
            return profileData;

        } catch (error: any) {
            logger.error(`Failed to load student profile: ${error.message}`);
            throw error;
        }
    }

    private _getInputValue(tree: HTMLElement, elementId: string): string {
        const node = tree.querySelector(`input[id="${elementId}"]`);
        return node?.getAttribute('value')?.trim() || "";
    }

    private _getSelectText(tree: HTMLElement, elementId: string): string {
        const node = tree.querySelector(`select[id="${elementId}"] option[selected="selected"]`);
        return node?.textContent?.trim() || "";
    }

    private _getRadioValue(tree: HTMLElement, elementName: string): string {
        const node = tree.querySelector(`input[type="radio"][name="${elementName}"][checked="checked"]`);
        return node?.getAttribute('value')?.trim() || "";
    }
}
