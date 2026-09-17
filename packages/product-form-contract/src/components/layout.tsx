import * as React from 'react';

/**
 * Presentational building blocks for custom product forms. Self-styled with
 * inline styles so they render consistently in any host (dashboard preview or
 * the embed) without depending on an external stylesheet.
 */

export const theme = {
  text: '#32325d',
  muted: '#8898aa',
  border: '#e9ecef',
  primary: '#ff4449',
  primaryText: '#ffffff',
  card: '#ffffff',
  surface: '#f6f9fc',
  radius: 12,
  font:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

export function Stack({
  children,
  gap = 12,
  style,
}: {
  children?: React.ReactNode;
  gap?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap, ...style }}>
      {children}
    </div>
  );
}

export function Section({
  title,
  children,
  style,
}: {
  title?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12, ...style }}>
      {title ? (
        <h3
          style={{
            margin: 0,
            fontFamily: theme.font,
            fontSize: 13,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: theme.muted,
          }}
        >
          {title}
        </h3>
      ) : null}
      {children}
    </section>
  );
}

export function Card({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: theme.card,
        border: `1px solid ${theme.border}`,
        borderRadius: theme.radius,
        padding: 20,
        boxShadow: '0 1px 2px rgba(50,50,93,0.06)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Heading({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <h2
      style={{
        margin: 0,
        fontFamily: theme.font,
        fontSize: 18,
        fontWeight: 800,
        color: theme.text,
        ...style,
      }}
    >
      {children}
    </h2>
  );
}

export function Text({
  children,
  muted,
  style,
}: {
  children?: React.ReactNode;
  muted?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <p
      style={{
        margin: 0,
        fontFamily: theme.font,
        fontSize: 14,
        lineHeight: 1.5,
        color: muted ? theme.muted : theme.text,
        ...style,
      }}
    >
      {children}
    </p>
  );
}

export function Divider({ style }: { style?: React.CSSProperties }) {
  return (
    <hr
      style={{
        border: 'none',
        borderTop: `1px solid ${theme.border}`,
        margin: '4px 0',
        ...style,
      }}
    />
  );
}
