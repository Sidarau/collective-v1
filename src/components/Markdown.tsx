import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";

/**
 * Member-authored markdown, rendered safely (no raw HTML, no images) and
 * styled for the glass surfaces. Single newlines become line breaks so
 * profiles read the way people typed them.
 */
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="md-prose">
      <ReactMarkdown
        remarkPlugins={[remarkBreaks]}
        allowedElements={[
          "p", "br", "strong", "em", "del",
          "ul", "ol", "li",
          "blockquote", "a", "code",
          "h1", "h2", "h3", "h4",
        ]}
        unwrapDisallowed
        components={{
          a: ({ href, children: kids }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {kids}
            </a>
          ),
          // Member headings render as elegant small caps, not shouty h1s.
          h1: ({ children: kids }) => <p className="md-heading">{kids}</p>,
          h2: ({ children: kids }) => <p className="md-heading">{kids}</p>,
          h3: ({ children: kids }) => <p className="md-heading">{kids}</p>,
          h4: ({ children: kids }) => <p className="md-heading">{kids}</p>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
