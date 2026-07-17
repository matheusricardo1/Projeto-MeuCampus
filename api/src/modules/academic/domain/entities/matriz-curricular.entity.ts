/** Curriculum matrix scraped from eCampus's "Matriz de Curso" report and
 *  cached by the worker. Mirrors workers/ecampus's MatrizCurricular shape. */

export interface MatrizCargaHoraria {
    teorica: number;
    pratica: number;
    extensao: number;
    total: number;
}

export interface MatrizDisciplina {
    periodo: number | null;
    codigo: string;
    nome: string;
    creditos: number | null;
    cargaHoraria: MatrizCargaHoraria;
    preRequisitos: string[];
}

export interface MatrizCategoria {
    nome: string;
    disciplinas: MatrizDisciplina[];
}

export interface MatrizCurricular {
    curso: string;
    grau: string;
    turno: string;
    versao: string;
    situacao: string;
    categorias: MatrizCategoria[];
    totalDisciplinas: number;
}
