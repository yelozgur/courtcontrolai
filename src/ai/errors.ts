export class AiNotConfiguredError extends Error {
  constructor() {
    super('ai_not_configured');
    this.name = 'AiNotConfiguredError';
  }
}
