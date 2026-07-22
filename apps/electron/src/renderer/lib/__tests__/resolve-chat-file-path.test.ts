import { describe, expect, it } from 'bun:test'
import { resolveChatFilePath } from '../resolve-chat-file-path'

describe('resolveChatFilePath', () => {
  const workspaceRoot = '/Users/me/.grose-agent/workspaces/demo'
  const mydataCwd = `${workspaceRoot}/mydata`

  it('keeps absolute paths', () => {
    expect(resolveChatFilePath('/tmp/a.mp4', { workingDirectory: mydataCwd })).toBe('/tmp/a.mp4')
  })

  it('resolves mydata-prefixed paths against workspace root (not cwd)', () => {
    expect(
      resolveChatFilePath('mydata/jobs-profile/renders/final.mp4', {
        workingDirectory: mydataCwd,
        workspaceRootPath: workspaceRoot,
      }),
    ).toBe(`${workspaceRoot}/mydata/jobs-profile/renders/final.mp4`)
  })

  it('resolves cwd-relative deliverable paths against workingDirectory', () => {
    expect(
      resolveChatFilePath('jobs-profile/renders/final.mp4', {
        workingDirectory: mydataCwd,
        workspaceRootPath: workspaceRoot,
      }),
    ).toBe(`${mydataCwd}/jobs-profile/renders/final.mp4`)
  })

  it('falls back to workspace root when workingDirectory is unset', () => {
    expect(
      resolveChatFilePath('docs/readme.md', {
        workspaceRootPath: workspaceRoot,
      }),
    ).toBe(`${workspaceRoot}/docs/readme.md`)
  })
})
