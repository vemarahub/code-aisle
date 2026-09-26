/**
 * TemplateRenderer — renders notification templates with variables.
 *
 * Substitutes {{placeholders}} in a template string with values, used to build
 * the body of emails and push notifications from reusable templates.
 */
export class TemplateRenderer {
  /** Render a template by replacing {{key}} tokens with provided values. */
  render(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => {
      if (!(key in variables)) {
        throw new Error(`Missing template variable: ${key}`);
      }
      return variables[key];
    });
  }
}
