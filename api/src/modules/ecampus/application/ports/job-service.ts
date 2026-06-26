import { Job } from 'bullmq';

/**
 * Port – contrato que permite à camada de aplicação enfileirar jobs e,
 * opcionalmente, aguardar sua conclusão.
 */
export abstract class JobService {
  /**
   * Enqueue a job of the given name.
   * @param name  name of the job (login, profile, …)
   * @param data  payload compatible with EcampusScrapeJobData
   */
  abstract enqueue(name: string, data: Record<string, unknown>): Promise<Job>;

  /** Queue instance – needed only for awaiting a job (e.g., login). */
  abstract getQueue(): import('bullmq').Queue;
}
