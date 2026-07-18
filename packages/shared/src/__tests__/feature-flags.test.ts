import { describe, it, expect, afterEach } from 'bun:test';
import {
  isDevRuntime,
  isDeveloperFeedbackEnabled,
  isGroseAgentsCliEnabled,
  isEmbeddedServerEnabled,
  isWorkbenchShellEnabled,
} from '../feature-flags.ts';

const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  GROSE_DEBUG: process.env.GROSE_DEBUG,
  GROSE_FEATURE_DEVELOPER_FEEDBACK: process.env.GROSE_FEATURE_DEVELOPER_FEEDBACK,
  GROSE_FEATURE_GROSE_AGENTS_CLI: process.env.GROSE_FEATURE_GROSE_AGENTS_CLI,
  GROSE_FEATURE_EMBEDDED_SERVER: process.env.GROSE_FEATURE_EMBEDDED_SERVER,
  GROSE_FEATURE_WORKBENCH_SHELL: process.env.GROSE_FEATURE_WORKBENCH_SHELL,
};

afterEach(() => {
  if (ORIGINAL_ENV.NODE_ENV === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = ORIGINAL_ENV.NODE_ENV;

  if (ORIGINAL_ENV.GROSE_DEBUG === undefined) delete process.env.GROSE_DEBUG;
  else process.env.GROSE_DEBUG = ORIGINAL_ENV.GROSE_DEBUG;

  if (ORIGINAL_ENV.GROSE_FEATURE_DEVELOPER_FEEDBACK === undefined) delete process.env.GROSE_FEATURE_DEVELOPER_FEEDBACK;
  else process.env.GROSE_FEATURE_DEVELOPER_FEEDBACK = ORIGINAL_ENV.GROSE_FEATURE_DEVELOPER_FEEDBACK;

  if (ORIGINAL_ENV.GROSE_FEATURE_GROSE_AGENTS_CLI === undefined) delete process.env.GROSE_FEATURE_GROSE_AGENTS_CLI;
  else process.env.GROSE_FEATURE_GROSE_AGENTS_CLI = ORIGINAL_ENV.GROSE_FEATURE_GROSE_AGENTS_CLI;

  if (ORIGINAL_ENV.GROSE_FEATURE_EMBEDDED_SERVER === undefined) delete process.env.GROSE_FEATURE_EMBEDDED_SERVER;
  else process.env.GROSE_FEATURE_EMBEDDED_SERVER = ORIGINAL_ENV.GROSE_FEATURE_EMBEDDED_SERVER;

  if (ORIGINAL_ENV.GROSE_FEATURE_WORKBENCH_SHELL === undefined) delete process.env.GROSE_FEATURE_WORKBENCH_SHELL;
  else process.env.GROSE_FEATURE_WORKBENCH_SHELL = ORIGINAL_ENV.GROSE_FEATURE_WORKBENCH_SHELL;
});

describe('feature-flags runtime helpers', () => {
  it('isDevRuntime returns true for explicit dev NODE_ENV', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.GROSE_DEBUG;

    expect(isDevRuntime()).toBe(true);
  });

  it('isDevRuntime returns true for GROSE_DEBUG override', () => {
    process.env.NODE_ENV = 'production';
    process.env.GROSE_DEBUG = '1';

    expect(isDevRuntime()).toBe(true);
  });

  it('isDeveloperFeedbackEnabled honors explicit override false', () => {
    process.env.NODE_ENV = 'development';
    process.env.GROSE_FEATURE_DEVELOPER_FEEDBACK = '0';

    expect(isDeveloperFeedbackEnabled()).toBe(false);
  });

  it('isDeveloperFeedbackEnabled honors explicit override true', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.GROSE_DEBUG;
    process.env.GROSE_FEATURE_DEVELOPER_FEEDBACK = '1';

    expect(isDeveloperFeedbackEnabled()).toBe(true);
  });

  it('isDeveloperFeedbackEnabled falls back to dev runtime when no override', () => {
    process.env.NODE_ENV = 'production';
    process.env.GROSE_DEBUG = '1';
    delete process.env.GROSE_FEATURE_DEVELOPER_FEEDBACK;

    expect(isDeveloperFeedbackEnabled()).toBe(true);
  });

  it('isGroseAgentsCliEnabled defaults to false when no override is set', () => {
    delete process.env.GROSE_FEATURE_GROSE_AGENTS_CLI;

    expect(isGroseAgentsCliEnabled()).toBe(false);
  });

  it('isGroseAgentsCliEnabled honors explicit override true', () => {
    process.env.GROSE_FEATURE_GROSE_AGENTS_CLI = '1';

    expect(isGroseAgentsCliEnabled()).toBe(true);
  });

  it('isGroseAgentsCliEnabled honors explicit override false', () => {
    process.env.GROSE_FEATURE_GROSE_AGENTS_CLI = '0';

    expect(isGroseAgentsCliEnabled()).toBe(false);
  });

  it('isEmbeddedServerEnabled defaults to false when no override is set', () => {
    delete process.env.GROSE_FEATURE_EMBEDDED_SERVER;

    expect(isEmbeddedServerEnabled()).toBe(false);
  });

  it('isEmbeddedServerEnabled honors explicit override true', () => {
    process.env.GROSE_FEATURE_EMBEDDED_SERVER = '1';

    expect(isEmbeddedServerEnabled()).toBe(true);
  });

  it('isEmbeddedServerEnabled honors explicit override false', () => {
    process.env.GROSE_FEATURE_EMBEDDED_SERVER = '0';

    expect(isEmbeddedServerEnabled()).toBe(false);
  });

  it('isWorkbenchShellEnabled defaults to false when no override is set', () => {
    delete process.env.GROSE_FEATURE_WORKBENCH_SHELL;

    expect(isWorkbenchShellEnabled()).toBe(false);
  });

  it('isWorkbenchShellEnabled honors explicit override true', () => {
    process.env.GROSE_FEATURE_WORKBENCH_SHELL = '1';

    expect(isWorkbenchShellEnabled()).toBe(true);
  });

  it('isWorkbenchShellEnabled honors explicit override false', () => {
    process.env.GROSE_FEATURE_WORKBENCH_SHELL = '0';

    expect(isWorkbenchShellEnabled()).toBe(false);
  });
});
