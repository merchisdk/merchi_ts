"use client";
import * as React from 'react';
import { FC, ReactNode } from 'react';
import { Tooltip } from 'react-tooltip';
import { useTooltipBody } from '../hooks/useTooltipBody';

interface Props {
  children: ReactNode;
  id?: string;
  place?: 'top' | 'bottom' | 'left' | 'right';
  tooltip?: string;
}

const TooltipElement: FC<Props> = ({ children, id, place = 'top', tooltip }) => {
  // Keep the server, hydration and later renders attached to the same anchor.
  // React 18 IDs contain colons, which need removing for anchorSelect.
  const generatedId = React.useId();
  const ttid = id || `id-${generatedId.replace(/:/g, '')}`;

  const { body, revision } = useTooltipBody(Boolean(tooltip));

  // react-tooltip observes document.body in an effect. Keep the anchor usable
  // while body is absent, and reconnect its observer after body replacement.
  const renderTooltip = tooltip && body ? (
    <Tooltip
      key={revision}
      anchorSelect={`#${ttid}`}
      place={place}
      style={{ zIndex: 2, display: 'block' }}
    >
      {tooltip}
    </Tooltip>
  ) : <></>;

  return (
    <>
      {children &&
        <span id={ttid} role="tooltip">
          {children}
        </span>
      }
      {renderTooltip}
    </>
  );
};

export default TooltipElement;
