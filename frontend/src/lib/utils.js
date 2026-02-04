import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function capitalizeWords(str) {
  if (!str || typeof str !== 'string') return str;
  return str.replace(/(^|[\s\-_.,;:!?()[\]{}'"\/\\])([a-zA-ZÁÉÍÓÚÜáéíóúüñÑ])/g, 
    (match, delimiter, char) => delimiter + char.toUpperCase()
  );
}
