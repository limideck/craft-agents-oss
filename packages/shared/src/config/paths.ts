/**
 * Centralized path configuration for Grose Agent.
 *
 * Supports multi-instance development via GROSE_CONFIG_DIR environment variable.
 * When running from a numbered folder (e.g., grose-tui-agent-1), the detect-instance.sh
 * script sets GROSE_CONFIG_DIR to ~/.grose-agent-1, allowing multiple instances to run
 * simultaneously with separate configurations.
 *
 * Default (non-numbered folders): ~/.grose-agent/
 * Instance 1 (-1 suffix): ~/.grose-agent-1/
 * Instance 2 (-2 suffix): ~/.grose-agent-2/
 */

import { homedir } from 'os';
import { join } from 'path';

// Allow override via environment variable for multi-instance dev
// Falls back to default ~/.grose-agent/ for production and non-numbered dev folders
export const CONFIG_DIR = process.env.GROSE_CONFIG_DIR || join(homedir(), '.grose-agent');
