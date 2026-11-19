// Las notas guardan 'pink' en la DB; visualmente se muestra como 'wine'
// para alinear con la paleta v4. No se migra ningún dato.
const VALID = ['yellow', 'pink', 'blue', 'green'];

export const noteColorSuffix = (color) => {
  if (!VALID.includes(color)) return 'yellow';
  return color === 'pink' ? 'wine' : color;
};

export const noteColorClass = (color) => `vpm-note vpm-note--${noteColorSuffix(color)}`;

export const noteSwatchClass = (color) => `vpm-swatch vpm-swatch--${noteColorSuffix(color)}`;
