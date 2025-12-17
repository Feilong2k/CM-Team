import { marked } from 'marked'

// Configure marked for security (disallow raw HTML as per SSOT requirement)
marked.setOptions({
  sanitize: true, // Disallow raw HTML to prevent XSS
  breaks: true,   // Convert \n to <br>
  gfm: true,      // GitHub Flavored Markdown
})

/**
 * Convert markdown text to sanitized HTML
 * @param {string} markdownText - Markdown text to convert
 * @returns {string} Sanitized HTML string
 */
export function renderMarkdown(markdownText) {
  if (!markdownText) return ''
  return marked.parse(markdownText)
}

/**
 * Example markdown content for testing.
 * You may replace or remove this export if not needed.
 */
export const exampleMarkdown = `Welcome! Replace this markdown content as needed.`
