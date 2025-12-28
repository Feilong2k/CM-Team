// Vitest setup file to provide DOM globals when jsdom environment fails
import { JSDOM } from 'jsdom'

console.log('Vitest setup executing...')

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable',
})

global.window = dom.window
global.document = dom.window.document
global.Element = dom.window.Element
global.HTMLElement = dom.window.HTMLElement
global.SVGElement = dom.window.SVGElement
global.HTMLDivElement = dom.window.HTMLDivElement
global.HTMLButtonElement = dom.window.HTMLButtonElement
global.HTMLInputElement = dom.window.HTMLInputElement
global.HTMLTextAreaElement = dom.window.HTMLTextAreaElement
global.MouseEvent = dom.window.MouseEvent
global.Event = dom.window.Event
global.KeyboardEvent = dom.window.KeyboardEvent
global.FocusEvent = dom.window.FocusEvent
global.CustomEvent = dom.window.CustomEvent

// Ensure global.navigator exists (some libraries need it)
global.navigator = dom.window.navigator

// Provide requestAnimationFrame and cancelAnimationFrame for Vue
global.requestAnimationFrame = (cb) => setTimeout(cb, 0)
global.cancelAnimationFrame = (id) => clearTimeout(id)

// Provide matchMedia (needed by some UI libraries)
global.matchMedia = () => ({
  matches: false,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
})

// Provide scrollIntoView mock (used in tests)
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

console.log('Global document defined?', !!global.document)
