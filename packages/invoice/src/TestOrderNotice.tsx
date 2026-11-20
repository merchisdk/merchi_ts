import * as React from 'react';

export default function TestOrderNotice({ title, paymentReceived = false }: { title: string; paymentReceived?: boolean }) {
  return (
    <div
      role='note'
      aria-label={title}
      style={{
        backgroundColor: '#fffbeb',
        border: '2px solid #92400e',
        borderRadius: 6,
        color: '#451a03',
        margin: '0.75rem 0',
        padding: '0.75rem 1rem',
      }}
    >
      <strong>{title}</strong>
      <p style={{ margin: '0.25rem 0 0' }}>
        {paymentReceived ? 'Simulated payment received.' : 'Payments are simulated.'}{' '}
        Do not produce, ship or release goods.
      </p>
    </div>
  );
}
