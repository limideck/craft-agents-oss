import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { shouldAllowToolInMode, extractBashWriteTarget, getPathHint } from '../../agent/mode-manager.ts';

describe('mode-manager path containment for plans/data/mydata exceptions', () => {
  let base: string;
  let plansDir: string;
  let dataDir: string;
  let mydataDir: string;
  let siblingPlans: string;
  let siblingData: string;
  let siblingMydata: string;

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'grose-mode-boundary-test-'));
    plansDir = join(base, 'plans');
    dataDir = join(base, 'data');
    mydataDir = join(base, 'mydata');
    siblingPlans = join(base, 'plans-evil', 'pwn.md');
    siblingData = join(base, 'data-bypass', 'out.json');
    siblingMydata = join(base, 'mydata-evil', 'pwn.md');

    mkdirSync(plansDir, { recursive: true });
    mkdirSync(dataDir, { recursive: true });
    mkdirSync(mydataDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(base, { recursive: true, force: true });
  });

  it('allows Write inside plans folder', () => {
    const result = shouldAllowToolInMode(
      'Write',
      { file_path: join(plansDir, 'ok.md') },
      'safe',
      { plansFolderPath: plansDir, dataFolderPath: dataDir, mydataFolderPath: mydataDir }
    );
    expect(result.allowed).toBe(true);
  });

  it('allows Write inside mydata folder', () => {
    const result = shouldAllowToolInMode(
      'Write',
      { file_path: join(mydataDir, 'x-bookmarks', 'last-sync.json') },
      'safe',
      { plansFolderPath: plansDir, dataFolderPath: dataDir, mydataFolderPath: mydataDir }
    );
    expect(result.allowed).toBe(true);
  });

  it('blocks Write to sibling path with plans prefix', () => {
    const result = shouldAllowToolInMode(
      'Write',
      { file_path: siblingPlans },
      'safe',
      { plansFolderPath: plansDir, dataFolderPath: dataDir, mydataFolderPath: mydataDir }
    );
    expect(result.allowed).toBe(false);
  });

  it('blocks Write to sibling path with mydata prefix', () => {
    const result = shouldAllowToolInMode(
      'Write',
      { file_path: siblingMydata },
      'safe',
      { plansFolderPath: plansDir, dataFolderPath: dataDir, mydataFolderPath: mydataDir }
    );
    expect(result.allowed).toBe(false);
  });

  it('blocks Bash redirect to sibling path with data prefix', () => {
    const result = shouldAllowToolInMode(
      'Bash',
      { command: `echo "x" > "${siblingData}"` },
      'safe',
      { plansFolderPath: plansDir, dataFolderPath: dataDir, mydataFolderPath: mydataDir }
    );
    expect(result.allowed).toBe(false);
  });

  it('allows Bash redirect inside data folder', () => {
    const result = shouldAllowToolInMode(
      'Bash',
      { command: `echo "x" > "${join(dataDir, 'ok.json')}"` },
      'safe',
      { plansFolderPath: plansDir, dataFolderPath: dataDir, mydataFolderPath: mydataDir }
    );
    expect(result.allowed).toBe(true);
  });

  it('allows Bash redirect inside mydata folder', () => {
    const result = shouldAllowToolInMode(
      'Bash',
      { command: `echo "x" > "${join(mydataDir, 'notes.md')}"` },
      'safe',
      { plansFolderPath: plansDir, dataFolderPath: dataDir, mydataFolderPath: mydataDir }
    );
    expect(result.allowed).toBe(true);
  });

  it('blocks Write via symlink escape from plans folder', () => {
    if (process.platform === 'win32') return;

    const outsideDir = join(base, 'outside');
    mkdirSync(outsideDir, { recursive: true });
    symlinkSync(outsideDir, join(plansDir, 'escape-link'), 'dir');

    const result = shouldAllowToolInMode(
      'Write',
      { file_path: join(plansDir, 'escape-link', 'evil.md') },
      'safe',
      { plansFolderPath: plansDir, dataFolderPath: dataDir, mydataFolderPath: mydataDir }
    );
    expect(result.allowed).toBe(false);
  });

  it('blocks Bash redirect via symlink escape from data folder', () => {
    if (process.platform === 'win32') return;

    const outsideDir = join(base, 'outside');
    mkdirSync(outsideDir, { recursive: true });
    symlinkSync(outsideDir, join(dataDir, 'escape-link'), 'dir');

    const result = shouldAllowToolInMode(
      'Bash',
      { command: `echo "x" > "${join(dataDir, 'escape-link', 'evil.json')}"` },
      'safe',
      { plansFolderPath: plansDir, dataFolderPath: dataDir, mydataFolderPath: mydataDir }
    );
    expect(result.allowed).toBe(false);
  });

  it('does not treat JavaScript arrow syntax (=>) as a bash write redirect target', () => {
    const command = "node -e \"const f = (s) => s.includes('electron'); console.log(f('typecheck'))\"";
    expect(extractBashWriteTarget(command)).toBeNull();
  });

  it('keeps allowlist mismatch messaging for node -e arrow command (no write-path error)', () => {
    const command = "node -e \"const f = (s) => s.includes('electron'); console.log(f('typecheck'))\"";
    const result = shouldAllowToolInMode(
      'Bash',
      { command },
      'safe',
      { plansFolderPath: plansDir, dataFolderPath: dataDir, mydataFolderPath: mydataDir }
    );

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toContain('read-only allowlist');
      expect(result.reason).not.toContain('Write blocked (Explore mode) - target not in allowed folders');
    }
  });

  it('getPathHint does not reject mydata as workspace root', () => {
    const mydataFile = '/Users/me/.grose-agent/workspaces/ws/mydata/foo.md';
    const plans = '/Users/me/.grose-agent/workspaces/ws/sessions/s1/plans';
    expect(getPathHint(mydataFile, plans, undefined, '/Users/me/.grose-agent/workspaces/ws/mydata')).toBeNull();
    expect(getPathHint(mydataFile, plans)).toBeNull();
  });

  it('getPathHint still warns for workspace root outside mydata/sessions', () => {
    const rootFile = '/Users/me/.grose-agent/workspaces/ws/readme.md';
    const plans = '/Users/me/.grose-agent/workspaces/ws/sessions/s1/plans';
    const hint = getPathHint(rootFile, plans, undefined, '/Users/me/.grose-agent/workspaces/ws/mydata');
    expect(hint).toContain('mydataFolderPath');
    expect(hint).toContain('not the workspace root');
  });
});
