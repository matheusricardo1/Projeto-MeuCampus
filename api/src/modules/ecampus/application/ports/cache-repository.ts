import { NotFoundException } from '@nestjs/common';
import { EcampusCredentials } from '@ecampus/domain/models/ecampus-credentials';

/**
 * Port – contrato que o domínio usa para ler os dados que já foram
 * processados pelos workers e armazenados em cache (Redis).
 */
export abstract class CacheRepository {
  abstract getProfile(cpf: string): Promise<any>;
  abstract getSchedule(cpf: string): Promise<any>;
  abstract getGrades(cpf: string): Promise<any>;
  abstract getLessonPlanSubjects(cpf: string): Promise<any>;
  abstract getLessonPlan(cpf: string, planId: string): Promise<any>;
}
