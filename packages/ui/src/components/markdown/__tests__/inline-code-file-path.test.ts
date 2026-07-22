/**
 * Tests for inline-code file-path click detection used by chat markdown tables.
 */

import { describe, it, expect } from 'bun:test'
import { inlineCodeText } from '../CodeBlock'
import { isFilePathTarget } from '../linkify'

describe('inlineCodeText', () => {
  it('trims string children', () => {
    expect(inlineCodeText('  mydata/jobs-profile/renders/final.mp4  ')).toBe(
      'mydata/jobs-profile/renders/final.mp4',
    )
  })

  it('joins array children', () => {
    expect(inlineCodeText(['mydata/jobs-profile/', 'renders/final.mp4'])).toBe(
      'mydata/jobs-profile/renders/final.mp4',
    )
  })
})

describe('inline code file path click eligibility', () => {
  it('treats AI table deliverable paths as clickable file targets', () => {
    const paths = [
      'mydata/jobs-profile/renders/final.mp4',
      'mydata/jobs-profile/renders/final.contact.jpg',
      'mydata/jobs-profile/reports/render-report.final.json',
    ]
    for (const path of paths) {
      const text = inlineCodeText(path)
      expect(isFilePathTarget(text)).toBe(true)
    }
  })

  it('does not treat ordinary code snippets as file paths', () => {
    expect(isFilePathTarget(inlineCodeText('npm run build'))).toBe(false)
    expect(isFilePathTarget(inlineCodeText('foo.bar.baz'))).toBe(false)
  })
})
