import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { RequirePermission, PERMISSIONS } from '../../identity';
import { ASSISTANT_SERVICE, type IAssistantService } from '../application/assistant.service.interface';
import type { AskRequest, AssistantSurface } from '../domain/models';

/** HTTP edge for the AI Accountant (read-only; ADR-001). No business logic here. */
@Controller('assistant')
export class AssistantController {
  constructor(@Inject(ASSISTANT_SERVICE) private readonly assistant: IAssistantService) {}

  @Post('ask') @RequirePermission(PERMISSIONS.ASSISTANT_ASK)
  ask(@Body() body: AskRequest) { return this.assistant.ask(body); }

  @Get('questions') @RequirePermission(PERMISSIONS.ASSISTANT_ASK)
  questions(@Query('surface') surface?: AssistantSurface) { return this.assistant.questions(surface); }
}
