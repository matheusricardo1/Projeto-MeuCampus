import type { EcampusCredentials } from '@/domain/value-objects/ecampus-credentials';
import type { Grade } from '@/domain/entities/grade';
import type { LessonPlanItem } from '@/domain/value-objects/lesson-plan-item';
import type { LessonPlanSubject } from '@/domain/entities/lesson-plan-subject';
import type { MatrizCurricular, MatrizCursoOption, MatrizVersaoOption } from '@/domain/entities/matriz-curricular';
import type { ScheduleClass } from '@/domain/value-objects/schedule-class';
import type { StudentProfile } from '@/domain/entities/student-profile';

export interface CurrentAcademicPeriod {
    year: string;
    period: string;
}

export interface MatrizCurricularQuery {
    /** Nível do curso (default '3' = Ensino Superior - Graduação Regular). */
    nivelCurso?: string;
    cursoId: number;
    versaoId: number;
}

export interface EcampusRepository {
    logout(credentials: EcampusCredentials): Promise<void>;
    getStudentProfile(credentials: EcampusCredentials): Promise<StudentProfile>;
    /**
     * eCampus's own session already knows which year/period the student is
     * currently enrolled in — it's the pre-selected default on the grades
     * form. Reading it there is authoritative and avoids guessing.
     */
    getCurrentPeriod(credentials: EcampusCredentials): Promise<CurrentAcademicPeriod>;
    getGrades(credentials: EcampusCredentials, year: string, period: string): Promise<Grade[]>;
    getSchedule(credentials: EcampusCredentials): Promise<ScheduleClass[]>;
    getLessonPlanSubjects(credentials: EcampusCredentials): Promise<LessonPlanSubject[]>;
    getLessonPlan(credentials: EcampusCredentials, planId: string): Promise<LessonPlanItem[]>;
    /** Cursos available for a given nível (report "Matriz de Curso" selector). */
    listMatrizCursos(credentials: EcampusCredentials, nivelCurso: string): Promise<MatrizCursoOption[]>;
    /** Versões (currículos) available for a course. */
    listMatrizVersoes(credentials: EcampusCredentials, cursoId: number): Promise<MatrizVersaoOption[]>;
    /** Downloads and parses the curriculum matrix PDF into structured JSON. */
    getMatrizCurricular(credentials: EcampusCredentials, query: MatrizCurricularQuery): Promise<MatrizCurricular>;
}
