interface TooltipContext {
  category?: string;
  subcategory?: string;
  type?: 'archetype' | 'species' | 'section' | 'filter';
  explicitClass?: string;
}

export class TooltipClassNameFactory {
  static generate(context: TooltipContext): string {
    if (context.explicitClass) {
      return context.explicitClass;
    }
    if (context.type) {
      return `tooltip-${context.type}`;
    }
    if (context.subcategory) {
      return `tooltip-${context.subcategory}`;
    }
    if (context.category) {
      return `tooltip-${context.category}`;
    }
    return 'tooltip-grid';
  }
}