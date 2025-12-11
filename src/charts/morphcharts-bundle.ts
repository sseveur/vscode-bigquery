/**
 * MorphCharts bundle entry point for webview usage.
 * This file re-exports MorphCharts for use in chart webviews,
 * eliminating the need for external CDN dependency.
 */

// Re-export everything from morphcharts
export * from 'morphcharts';

// Also export as default namespace for compatibility
import * as MorphCharts from 'morphcharts';
export default MorphCharts;
