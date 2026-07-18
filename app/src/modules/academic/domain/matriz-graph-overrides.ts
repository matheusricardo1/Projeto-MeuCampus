import type { MatrizCurricular } from '@/modules/academic/domain/entities/matriz-curricular';

export type MatrizGraphColor = 'bege' | 'roxo' | 'azul' | 'rosa';

export interface MatrizGraphOverrideNode {
    id: string;
    label: string;
    /** 1-indexed grid position, matching the hand-drawn reference diagram. */
    col: number;
    row: number;
    color: MatrizGraphColor;
}

export interface MatrizGraphOverride {
    id: string;
    match: (matriz: MatrizCurricular) => boolean;
    nodes: MatrizGraphOverrideNode[];
    /** [prerequisito, disciplina] pairs, arrow points from the first to the second. */
    edges: Array<[string, string]>;
}

export const MATRIZ_GRAPH_COLOR_HEX: Record<MatrizGraphColor, { fill: string; stroke: string; text: string }> = {
    bege: { fill: '#E2C88F', stroke: '#B89552', text: '#4A3B12' },
    roxo: { fill: '#E6B8E0', stroke: '#B97DAF', text: '#4A1F44' },
    azul: { fill: '#A9D6F5', stroke: '#6FA8C9', text: '#143550' },
    rosa: { fill: '#F5C6DC', stroke: '#D98CB0', text: '#5C1030' }
};

/**
 * Hand-curated node positions/labels/colors for specific courses, matching a
 * reference diagram pixel-for-pixel rather than relying on the automatic
 * (Sugiyama-style) layout. Used only when a course+versão matches; every
 * other course still falls back to the automatic layout in matriz.tsx.
 */
export const MATRIZ_GRAPH_OVERRIDES: MatrizGraphOverride[] = [
    {
        id: 'ie17-2025-2',
        match: (matriz) => matriz.curso.toUpperCase().includes('IE17') && matriz.versao === '2025/2',
        nodes: [
            { id: 'introd_comp', label: 'Introdução a Computação', col: 1, row: 1, color: 'bege' },
            { id: 'aed1', label: 'AED I', col: 1, row: 2, color: 'bege' },
            { id: 'pooo', label: 'Prog. Orientada a Objeto', col: 1, row: 4, color: 'bege' },
            { id: 'redes', label: 'Redes de Computadores', col: 1, row: 5, color: 'bege' },
            { id: 'proj_alg', label: 'Projeto e Análise de Algoritmo', col: 1, row: 6, color: 'bege' },
            { id: 'empre', label: 'Empre. em Informática', col: 1, row: 8, color: 'azul' },

            { id: 'mtc', label: 'MTC. em Computação', col: 2, row: 2, color: 'roxo' },
            { id: 'aed2', label: 'AED II', col: 2, row: 3, color: 'bege' },
            { id: 'ciencia_dados', label: 'Ciência de Dados', col: 2, row: 4, color: 'bege' },
            { id: 'ling_prog', label: 'Linguagens de Programação', col: 2, row: 5, color: 'bege' },
            { id: 'fund_ciberseg', label: 'Fund. de Ciberseg. e Des.', col: 2, row: 6, color: 'bege' },
            { id: 'comp_etica', label: 'Computação, Ética e Sociedade', col: 2, row: 8, color: 'azul' },

            { id: 'calc1', label: 'Cálculo I', col: 3, row: 1, color: 'bege' },
            { id: 'calc2', label: 'Cálculo II', col: 3, row: 2, color: 'bege' },
            { id: 'prob_estat', label: 'Prob. & Estat.', col: 3, row: 3, color: 'bege' },
            { id: 'intro_bd', label: 'Intro. BD', col: 3, row: 4, color: 'bege' },
            { id: 'prog_web', label: 'Programação para Web', col: 3, row: 7, color: 'bege' },
            { id: 'proj_prat_es', label: 'Proj. Prat. em Eng. Software', col: 3, row: 8, color: 'rosa' },

            { id: 'comp_univ', label: 'Computação e Universidade', col: 4, row: 1, color: 'azul' },
            { id: 'ling_form', label: 'Ling. Formais e Autômatos', col: 4, row: 2, color: 'bege' },
            { id: 'es1', label: 'Eng. de Software I', col: 4, row: 3, color: 'rosa' },
            { id: 'es2', label: 'Eng. de Software II', col: 4, row: 4, color: 'rosa' },
            { id: 'ver_val', label: 'Ver. e Val. de Software', col: 4, row: 5, color: 'rosa' },
            { id: 'proc_des', label: 'Proc. de Des. de Software', col: 4, row: 6, color: 'rosa' },
            { id: 'ihc', label: 'Interação Humano-Comp', col: 4, row: 7, color: 'rosa' },

            { id: 'mat_discreta', label: 'Matemática Discreta', col: 5, row: 1, color: 'bege' },
            { id: 'fund_ia', label: 'Fundamentos de IA', col: 5, row: 2, color: 'bege' },
            { id: 'alg_lin2', label: 'Álgebra Linear II', col: 5, row: 3, color: 'bege' },

            { id: 'tx_acad', label: 'Tx. Acad. em Computação', col: 6, row: 1, color: 'roxo' },
            { id: 'alg_lin1', label: 'Álgebra Linear I', col: 6, row: 2, color: 'bege' },
            { id: 'intro_oc', label: 'Intro. OC', col: 6, row: 3, color: 'bege' },
            { id: 'so1', label: 'SO I', col: 6, row: 4, color: 'bege' },
            { id: 'ger_proj', label: 'Gerência de Projetos', col: 6, row: 5, color: 'rosa' },
            { id: 'ger_config', label: 'Gerência de Configuração', col: 6, row: 6, color: 'rosa' },
            { id: 'tcc', label: 'TCC', col: 6, row: 8, color: 'rosa' }
        ],
        edges: [
            ['introd_comp', 'aed1'],
            ['aed1', 'aed2'],
            ['aed1', 'pooo'],
            ['aed1', 'ciencia_dados'],
            ['aed1', 'redes'],
            ['pooo', 'redes'],
            ['redes', 'proj_alg'],

            ['mtc', 'aed2'],
            ['aed2', 'ciencia_dados'],
            ['aed2', 'intro_bd'],
            ['aed2', 'ling_prog'],
            ['ling_prog', 'fund_ciberseg'],

            ['calc1', 'calc2'],
            ['calc2', 'prob_estat'],
            ['prob_estat', 'intro_bd'],
            ['intro_bd', 'prog_web'],

            ['comp_univ', 'ling_form'],
            ['ling_form', 'es1'],
            ['es1', 'es2'],
            ['es2', 'ver_val'],
            ['es2', 'ger_proj'],
            ['es2', 'ger_config'],
            ['ver_val', 'proc_des'],
            ['proc_des', 'ihc'],
            ['proc_des', 'proj_prat_es'],

            ['mat_discreta', 'fund_ia'],
            ['fund_ia', 'alg_lin2'],
            ['alg_lin2', 'es2'],

            ['tx_acad', 'tcc'],
            ['alg_lin1', 'alg_lin2'],
            ['alg_lin1', 'intro_oc'],
            ['intro_oc', 'so1']
        ]
    }
];

export function findMatrizGraphOverride(matriz: MatrizCurricular): MatrizGraphOverride | null {
    return MATRIZ_GRAPH_OVERRIDES.find((o) => o.match(matriz)) ?? null;
}
