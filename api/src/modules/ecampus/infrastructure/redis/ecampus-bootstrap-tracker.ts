import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import {
    AcademicBootstrapTracker,
    type AcademicBootstrapState
} from '@academic/application/ports/academic-bootstrap-tracker';
import type { AcademicResource } from '@academic/domain/value-objects/academic-resource.value-object';
import { createApiRedisConnectionOptions } from '@/shared/redis-connection';

const BOOTSTRAP_TTL_SECONDS = 60 * 30;

@Injectable()
export class EcampusBootstrapTracker extends AcademicBootstrapTracker {
    private readonly redis = new Redis(createApiRedisConnectionOptions());

    async start(cpf: string, requiredResources: AcademicResource[]): Promise<AcademicBootstrapState> {
        const now = new Date().toISOString();
        const state: AcademicBootstrapState = {
            cpf,
            status: 'pending',
            requiredResources,
            readyResources: [],
            failedResources: [],
            startedAt: now,
            updatedAt: now
        };

        await this.save(state);
        return state;
    }

    async markReady(cpf: string, resource: AcademicResource): Promise<AcademicBootstrapState | null> {
        return this.runAtomicUpdate(cpf, resource, 'ready');
    }

    async markFailed(cpf: string, resource: AcademicResource): Promise<AcademicBootstrapState | null> {
        return this.runAtomicUpdate(cpf, resource, 'failed');
    }

    async get(cpf: string): Promise<AcademicBootstrapState | null> {
        const raw = await this.redis.get(this.getKey(cpf));
        if (!raw) {
            return null;
        }

        try {
            return JSON.parse(raw) as AcademicBootstrapState;
        } catch {
            await this.redis.del(this.getKey(cpf));
            return null;
        }
    }

    private async save(state: AcademicBootstrapState): Promise<void> {
        await this.redis.set(this.getKey(state.cpf), JSON.stringify(state), 'EX', BOOTSTRAP_TTL_SECONDS);
    }

    private async runAtomicUpdate(
        cpf: string,
        resource: AcademicResource,
        status: 'ready' | 'failed'
    ): Promise<AcademicBootstrapState | null> {
        const raw = await this.redis.eval(
            `
            local key = KEYS[1]
            local resource = ARGV[1]
            local status = ARGV[2]
            local updatedAt = ARGV[3]
            local ttl = tonumber(ARGV[4])

            local raw = redis.call('GET', key)
            if not raw then
              return nil
            end

            local ok, state = pcall(cjson.decode, raw)
            if not ok then
              redis.call('DEL', key)
              return nil
            end

            local isRequired = false
            for _, item in ipairs(state.requiredResources or {}) do
              if item == resource then
                isRequired = true
                break
              end
            end

            if not isRequired then
              return nil
            end

            local previousStatus = state.status

            if status == 'ready' then
              local alreadyReady = false
              for _, item in ipairs(state.readyResources or {}) do
                if item == resource then
                  alreadyReady = true
                  break
                end
              end

              if alreadyReady then
                return nil
              end

              table.insert(state.readyResources, resource)

              local nextFailed = {}
              for _, item in ipairs(state.failedResources or {}) do
                if item ~= resource then
                  table.insert(nextFailed, item)
                end
              end
              state.failedResources = nextFailed
            else
              local alreadyFailed = false
              for _, item in ipairs(state.failedResources or {}) do
                if item == resource then
                  alreadyFailed = true
                  break
                end
              end

              if alreadyFailed then
                return nil
              end

              table.insert(state.failedResources, resource)
            end

            -- The bootstrap set is done once every required resource has
            -- settled one way or the other, regardless of WHICH resource
            -- happened to settle last or whether it succeeded or failed.
            -- (Previously "ready" only completed when the last settlement
            -- was itself a success, so a set that finished failure-first-
            -- then-success-last never fired any completion event at all.)
            local totalResolved = #state.readyResources + #state.failedResources
            local isComplete = totalResolved >= #state.requiredResources
            state.status = isComplete and (#state.failedResources == 0 and 'ready' or 'failed') or 'pending'
            state.updatedAt = updatedAt
            redis.call('SET', key, cjson.encode(state), 'EX', ttl)

            if isComplete and previousStatus == 'pending' then
              return cjson.encode(state)
            end

            return nil
            `,
            1,
            this.getKey(cpf),
            resource,
            status,
            new Date().toISOString(),
            BOOTSTRAP_TTL_SECONDS.toString()
        );

        if (typeof raw !== 'string') {
            return null;
        }

        try {
            return JSON.parse(raw) as AcademicBootstrapState;
        } catch {
            return null;
        }
    }

    private getKey(cpf: string): string {
        return `academic:bootstrap:${cpf}`;
    }
}
