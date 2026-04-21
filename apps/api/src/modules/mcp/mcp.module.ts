import { Global, Module } from '@nestjs/common';
import { McpRegistry } from './domain/mcp-registry';
import { DefaultMcpRegistry } from './infrastructure/default-mcp-registry';

@Global()
@Module({
  providers: [{ provide: McpRegistry, useClass: DefaultMcpRegistry }],
  exports: [McpRegistry],
})
export class McpModule {}
