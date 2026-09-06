import React from 'react';

export interface Fact {
  label: string;
  value: string;
}

interface FactListProps {
  items: Fact[];
  as?: 'ul' | 'ol';
  className?: string;
}

/** Lista de "fato": cada item é `<li><strong>Rótulo</strong><span>Texto</span></li>`. */
export const FactList: React.FC<FactListProps> = ({ items, as = 'ul', className }) => {
  const List = as;
  return (
    <List className={className}>
      {items.map((item) => (
        <li key={item.label}>
          <strong>{item.label}</strong>
          <span>{item.value}</span>
        </li>
      ))}
    </List>
  );
};
