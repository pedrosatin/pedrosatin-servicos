import React from 'react';

export const StatusGlyph: React.FC<{ status: string }> = ({ status }) => {
  if (status === 'running') return <span className="lp-glyph running">···</span>;
  if (status === 'done') return <span className="lp-glyph done">ok</span>;
  if (status === 'failed') return <span className="lp-glyph failed">falhou</span>;
  if (status === 'skipped') return <span className="lp-glyph skipped">pulado</span>;
  return <span className="lp-glyph pending">·</span>;
};
