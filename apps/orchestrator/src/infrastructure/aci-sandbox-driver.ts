import { ContainerInstanceManagementClient } from '@azure/arm-containerinstance';
import { DefaultAzureCredential } from '@azure/identity';
import { randomBytes } from 'node:crypto';
import { SandboxError, type Sandbox, type SandboxSpec, type SandboxStatus } from '@code-ae/shared';
import type { OrchestratorConfig } from '../config.js';
import type { SandboxDriver } from '../domain/sandbox-driver.js';

const AGENT_PORT = 4200;

export class AciSandboxDriver implements SandboxDriver {
  private readonly client: ContainerInstanceManagementClient;

  constructor(private readonly config: OrchestratorConfig) {
    this.client = new ContainerInstanceManagementClient(
      new DefaultAzureCredential(),
      config.AZURE_SUBSCRIPTION_ID,
    );
  }

  async create(spec: SandboxSpec): Promise<Sandbox> {
    const containerGroupName = `sbx-${spec.projectId.slice(0, 8)}-${Date.now().toString(36)}`;
    const dnsLabel = containerGroupName.toLowerCase();
    const agentToken = randomBytes(32).toString('hex');

    const portsWithAgent = Array.from(new Set([...spec.ports, AGENT_PORT]));

    const poller = await this.client.containerGroups.beginCreateOrUpdate(
      this.config.AZURE_RESOURCE_GROUP,
      containerGroupName,
      {
        location: this.config.AZURE_LOCATION,
        osType: 'Linux',
        restartPolicy: 'Never',
        tags: { projectId: spec.projectId },
        imageRegistryCredentials: [
          {
            server: this.config.AZURE_ACR_LOGIN_SERVER,
            username: this.config.AZURE_ACR_USERNAME,
            password: this.config.AZURE_ACR_PASSWORD,
          },
        ],
        containers: [
          {
            name: 'workspace',
            image: `${this.config.AZURE_ACR_LOGIN_SERVER}/${spec.image}`,
            resources: {
              requests: { cpu: spec.cpuCores, memoryInGB: spec.memoryGb },
            },
            ports: portsWithAgent.map((port) => ({ port, protocol: 'TCP' })),
            environmentVariables: [
              { name: 'SANDBOX_TOKEN', secureValue: agentToken },
              { name: 'PORT', value: String(AGENT_PORT) },
              { name: 'WORKSPACE_ROOT', value: '/home/workspace/project' },
            ],
          },
        ],
        ipAddress: {
          type: 'Public',
          dnsNameLabel: dnsLabel,
          ports: portsWithAgent.map((port) => ({ port, protocol: 'TCP' })),
        },
      },
    );

    const result = await poller.pollUntilDone();
    const fqdn = result.ipAddress?.fqdn;
    const previewPort = spec.ports[0] ?? 3000;

    return {
      id: containerGroupName,
      projectId: spec.projectId,
      status: this.mapStatus(result.provisioningState),
      previewUrl: fqdn ? `http://${fqdn}:${previewPort}` : undefined,
      agentUrl: fqdn ? `http://${fqdn}:${AGENT_PORT}` : undefined,
      agentToken,
      createdAt: new Date(),
    };
  }

  async get(id: string): Promise<Sandbox | null> {
    try {
      const group = await this.client.containerGroups.get(this.config.AZURE_RESOURCE_GROUP, id);
      return {
        id,
        projectId: group.tags?.projectId ?? '',
        status: this.mapStatus(group.provisioningState),
        previewUrl: group.ipAddress?.fqdn
          ? `http://${group.ipAddress.fqdn}:${group.ipAddress.ports?.[0]?.port ?? 3000}`
          : undefined,
        createdAt: new Date(),
      };
    } catch (err) {
      if (err instanceof Error && err.message.includes('NotFound')) return null;
      throw new SandboxError(`Failed to fetch sandbox ${id}: ${err instanceof Error ? err.message : err}`);
    }
  }

  async stop(id: string): Promise<void> {
    await this.client.containerGroups.beginDeleteAndWait(this.config.AZURE_RESOURCE_GROUP, id);
  }

  async listByProject(projectId: string): Promise<Sandbox[]> {
    const sandboxes: Sandbox[] = [];
    const iter = this.client.containerGroups.listByResourceGroup(this.config.AZURE_RESOURCE_GROUP);
    for await (const group of iter) {
      if (group.tags?.projectId !== projectId || !group.name) continue;
      sandboxes.push({
        id: group.name,
        projectId,
        status: this.mapStatus(group.provisioningState),
        previewUrl: group.ipAddress?.fqdn
          ? `http://${group.ipAddress.fqdn}:${group.ipAddress.ports?.[0]?.port ?? 3000}`
          : undefined,
        createdAt: new Date(),
      });
    }
    return sandboxes;
  }

  private mapStatus(state: string | undefined): SandboxStatus {
    switch (state) {
      case 'Succeeded':
        return 'running';
      case 'Creating':
      case 'Pending':
        return 'creating';
      case 'Deleting':
        return 'stopping';
      case 'Failed':
        return 'failed';
      default:
        return 'pending';
    }
  }
}
