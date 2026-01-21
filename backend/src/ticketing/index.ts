/**
 * Ticketing Module Entry Point
 * 
 * Re-exports types and registers all adapters.
 */

export * from './types.js';

// Import adapters to trigger registration
import './adapters/rallyAdapter.js';
import './adapters/githubAdapter.js';
import './adapters/jiraAdapter.js';
