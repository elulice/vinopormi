import './Skeleton.css';

/**
 * Esqueleto de carga global de v4. Reemplaza al Skeleton local de Dashboard.
 *
 * Props:
 *  - variant: 'text' | 'value' | 'sm' | 'title' | 'rect' | 'card' | 'circle' | 'avatar'
 *  - count:   cantidad de bloques (por defecto 1)
 *  - width / height / size: overrides CSS (size aplica a circle/avatar)
 *  - circle:  atajo para variant circle
 *  - gap:     separacion entre bloques cuando count > 1
 *  - as:      tag HTML del bloque ('span' | 'div')
 *  - className / style: escape hatch
 */
const VARIANTS = {
  text: 'vpm-skeleton--text',
  value: 'vpm-skeleton--value',
  sm: 'vpm-skeleton--sm',
  title: 'vpm-skeleton--title',
  rect: 'vpm-skeleton--rect',
  card: 'vpm-skeleton--card',
  circle: 'vpm-skeleton--circle',
  avatar: 'vpm-skeleton--avatar',
};

const Skeleton = ({
  variant = 'text',
  count = 1,
  width,
  height,
  size,
  circle = false,
  gap,
  className = '',
  style,
  as: Tag = 'span',
}) => {
  const variantClass = VARIANTS[variant] || VARIANTS.text;
  const classes = [
    'vpm-skeleton',
    variantClass,
    circle ? 'vpm-skeleton--circle' : '',
    className,
  ].filter(Boolean).join(' ');

  const itemStyle = {
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    ...(size ? { width: size, height: size } : {}),
    ...style,
  };

  if (count === 1) {
    return <Tag className={classes} style={itemStyle} aria-hidden="true" />;
  }

  // El envoltorio sigue el mismo tag que los hijos para no anidar div en span.
  const GroupTag = Tag === 'div' ? 'div' : 'span';

  return (
    <GroupTag
      className="vpm-skeleton-group"
      style={gap ? { gap } : undefined}
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, i) => (
        <Tag key={i} className={classes} style={itemStyle} />
      ))}
    </GroupTag>
  );
};

/** Variante lista: N filas de texto con ancho alternado (para tablas/listas). */
export const SkeletonLines = ({ rows = 3, className = '', ...rest }) => (
  <span className={`vpm-skeleton-group ${className}`} aria-hidden="true">
    {Array.from({ length: rows }, (_, i) => (
      <Skeleton
        key={i}
        variant="text"
        width={i === rows - 1 ? '65%' : '100%'}
        {...rest}
      />
    ))}
  </span>
);

/** Variante tabla: header + filas con varias columnas. */
export const SkeletonTable = ({ rows = 5, columns = 4, className = '' }) => (
  <div className={`vpm-skeleton-table ${className}`} aria-hidden="true">
    <div className="vpm-skeleton-table-head">
      {Array.from({ length: columns }, (_, i) => (
        <Skeleton key={i} variant="sm" width="70%" />
      ))}
    </div>
    {Array.from({ length: rows }, (_, r) => (
      <div className="vpm-skeleton-table-row" key={r}>
        {Array.from({ length: columns }, (_, c) => (
          <Skeleton key={c} variant="text" width={c === 0 ? '85%' : '60%'} />
        ))}
      </div>
    ))}
  </div>
);

/** Variante card: bloque con titulo y N lineas. */
export const SkeletonCard = ({ lines = 3, className = '' }) => (
  <div className={`vpm-skeleton-card ${className}`} aria-hidden="true">
    <Skeleton variant="title" />
    <SkeletonLines rows={lines} />
  </div>
);

export default Skeleton;
