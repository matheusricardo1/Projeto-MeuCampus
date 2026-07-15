import type { AcademicResource } from '@academic/domain/value-objects/academic-resource.value-object';

export type AcademicBootstrapStatus = 'pending' | 'ready' | 'failed';

export interface AcademicBootstrapState {
  cpf: string;
  status: AcademicBootstrapStatus;
  requiredResources: AcademicResource[];
  readyResources: AcademicResource[];
  failedResources: AcademicResource[];
  startedAt: string;
  updatedAt: string;
}

export abstract class AcademicBootstrapTracker {
  abstract start(cpf: string, requiredResources: AcademicResource[]): Promise<AcademicBootstrapState>;
  abstract markReady(cpf: string, resource: AcademicResource): Promise<AcademicBootstrapState | null>;
  abstract markFailed(cpf: string, resource: AcademicResource): Promise<AcademicBootstrapState | null>;
  /**
   * Current persisted state for a CPF, or null if there's no bootstrap in
   * flight (never started, or already expired). Used by the gateway to replay
   * a completed bootstrap to a socket that joined the room after the original
   * bootstrap-ready event was already emitted (the room-join race).
   */
  abstract get(cpf: string): Promise<AcademicBootstrapState | null>;
}
