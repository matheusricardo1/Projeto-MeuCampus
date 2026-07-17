/** Carga horária (in hours) broken down as shown in the matriz report. */
export interface MatrizCargaHoraria {
    teorica: number;
    pratica: number;
    extensao: number;
    total: number;
}

export interface MatrizDisciplina {
    /** Período recomendado (1..N). Null for blocks that aren't period-bound
     *  (eletivas/optativas are listed without a período). */
    periodo: number | null;
    codigo: string;
    nome: string;
    creditos: number | null;
    cargaHoraria: MatrizCargaHoraria;
    /** Códigos das disciplinas pré-requisito (ex.: ["ICC001", "ICC120"]). */
    preRequisitos: string[];
}

/** A section of the matriz: OBRIGATÓRIAS, ELETIVAS, OPTATIVAS, ATIVIDADE
 *  CURRICULAR DE EXTENSÃO, etc. */
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

/** One option in the report's course/version selectors (from loadCursos/loadVersoes). */
export interface MatrizCursoOption {
    id: number;
    codCurso: string;
    nome: string;
}

export interface MatrizVersaoOption {
    id: number;
    numVersao: string;
    situacao: string;
}
