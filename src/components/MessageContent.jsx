import React, { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import './MessageContent.css'

// The model is asked for $...$ and $$...$$, but sometimes writes the \( \) and
// \[ \] forms instead, which remark-math does not recognise. Normalise them so
// the math renders either way.
const normaliseMath = (text) =>
  text
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, body) => `\n$$\n${body.trim()}\n$$\n`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, body) => `$${body.trim()}$`)

const components = {
  // Links from the model open in a new tab, never in place of the conversation.
  a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
}

/**
 * A tutor reply: Markdown with LaTeX math.
 *
 * Raw HTML in the reply is not rendered (react-markdown's default), so nothing
 * the model writes can inject markup. Math that does not parse is shown as its
 * source rather than breaking the reply, which also covers a formula that is
 * still half-streamed. While `streaming`, a caret blinks at the end of the text.
 */
const MessageContent = ({ text, streaming = false }) => (
  <div className={`md ${streaming ? 'is-streaming' : ''}`}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: true }]]}
      rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: 'ignore' }]]}
      components={components}
    >
      {normaliseMath(text)}
    </ReactMarkdown>
  </div>
)

export default memo(MessageContent)
