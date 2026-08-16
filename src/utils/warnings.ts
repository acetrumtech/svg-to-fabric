import type { ConversionWarning, ConversionWarningCode } from '../types/options.js';

/**
 * Conversion never throws for an element it cannot handle — it records a
 * warning and carries on. A file with one unreadable `<filter>` should still
 * import; the host decides whether the warnings are worth showing.
 */
export class WarningCollector {
  private readonly items: ConversionWarning[] = [];

  add(
    code: ConversionWarningCode,
    message: string,
    severity: ConversionWarning['severity'] = 'warning',
    layer?: { id: string; name: string },
  ): void {
    this.items.push({
      code,
      message,
      severity,
      ...(layer ? { layerId: layer.id, layerName: layer.name } : {}),
    });
  }

  info(code: ConversionWarningCode, message: string, layer?: { id: string; name: string }): void {
    this.add(code, message, 'info', layer);
  }

  error(code: ConversionWarningCode, message: string, layer?: { id: string; name: string }): void {
    this.add(code, message, 'error', layer);
  }

  all(): ConversionWarning[] {
    return this.items.slice();
  }
}
